"""Export safe, hash-bound SEO acceptance reports without network or database access."""
from __future__ import annotations
import argparse
from functools import lru_cache
from collections import Counter
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import re
from urllib.parse import parse_qsl, urljoin, urlsplit

SPEC = importlib.util.spec_from_file_location('seo_comparator', Path(__file__).with_name('seo-verify-candidate.py'))
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)
ORIGIN = VERIFY.CANONICAL
DISPOSITIONS = frozenset(('preserved', 'redirected', 'intentionally_removed', 'unresolved'))
HASH = re.compile(r'^[a-f0-9]{64}$')
CODE = re.compile(r'^[a-z][a-z0-9_:.\-]{0,159}$')
SAFE_QUERY = frozenset(('p', 'page_id', 'paged', 'page', 'pagename', 'tribe_organizer', 'tribe_venue', 'post_type', 'feed', 's', 'order', 'sermon_dates', 'sermon_series', 'sermon_speaker', 'sermon_book', 'sermon_topics', 'tribe-bar-date', 'eventDisplay', 'tribe_events_cat', 'tag', 'ical', 'outlook-ical', 'related_series', 'shortcode', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ver', 'resize', 'ssl'))
MAP_FIELDS = ('source_url', 'source_url_sha256', 'source_wordpress_id', 'source_type', 'source_route_family', 'source_state', 'source_captured_at', 'source_status', 'source_redirect', 'source_canonical_urls', 'source_indexability', 'source_origin', 'source_provenance', 'traffic_evidence', 'backlink_evidence', 'retained_published_source_id', 'retained_reconciliation', 'target_identity', 'intended_url', 'candidate_first_status', 'candidate_final_status', 'candidate_final_url', 'redirect_hops', 'candidate_response_sha256', 'candidate_indexable', 'candidate_canonical_valid', 'candidate_robots_allowed', 'candidate_in_sitemap', 'raw_verification_issues', 'report_validation_issues', 'reviewed_issue_codes', 'unreviewed_issue_codes', 'explained_difference_policies', 'review_evidence_references', 'disposition', 'disposition_reason')
DIFF_GROUPS = ('blocks', 'metadata', 'language', 'dates', 'images', 'media', 'content_tree')
DIFF_FIELDS = ('source_url', 'source_url_sha256', 'source_response_sha256', 'candidate_response_sha256', 'comparison_available', 'source_block_count', 'matched_block_count', 'missing_block_count', 'missing_image_count', 'missing_media_count', 'metadata_change_count', *tuple(field for group in DIFF_GROUPS for field in ('source_' + group + '_sha256', 'candidate_' + group + '_sha256', group + '_changed')), 'missing_block_hashes', 'missing_image_hashes', 'missing_media_hashes', 'metadata_change_hashes', 'bundle_projection_sha256', 'explained_difference_policies', 'raw_verification_issues', 'disposition')


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode('utf8')).hexdigest()


def stable(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def fingerprint(value):
    return digest(stable(value))


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def safe_code(value):
    return value if isinstance(value, str) and CODE.fullmatch(value) else 'withheld_code:' + fingerprint(value)


def safe_url(value):
    if not isinstance(value, str): return ''
    if VERIFY.church_url(value) and len(value) <= 2000 and all(key in SAFE_QUERY for key, _ in parse_qsl(urlsplit(value).query, keep_blank_values=True)):
        return value
    return 'withheld-reference:' + digest(value)


def public_origin(value):
    if safe_url(value).startswith(('http://', 'https://')):
        parsed = urlsplit(value)
        return parsed.scheme + '://' + parsed.netloc
    return ''


def route(value):
    if not VERIFY.church_url(value): return None
    parsed = urlsplit(value)
    return (parsed.path or '/') + ('?' + parsed.query if parsed.query else '')


def number(value):
    if isinstance(value, bool): return None
    if isinstance(value, int): return value
    return int(value) if isinstance(value, str) and re.fullmatch(r'\d+', value) else None


def code_list(value):
    if isinstance(value, str): value = value.split(';')
    return sorted(set(safe_code(item) for item in value or [] if item))


def safe_hash(value):
    return value if isinstance(value, str) and HASH.fullmatch(value) else ''


def boolean_cell(value):
    return str(value).lower() if str(value).lower() in ('true', 'false') else ''


@lru_cache(maxsize=256)
def extracted_candidate(raw, url):
    # Cache parsing only. Every file read still verifies its current byte hash.
    decoded=raw.decode('utf8',errors='replace')
    value=VERIFY.parser.extract(decoded,url)
    value['verifiedMediaIdentities']=sorted(VERIFY.candidate_media(decoded,value))
    return stable(value)


def body_record(root, relative, expected_url=None):
    record = load(VERIFY.confined_file(root, relative))
    if expected_url and record.get('url') != expected_url: raise ValueError('report_response_url_mismatch')
    if record.get('responsePath'):
        raw = VERIFY.confined_file(root, record['responsePath']).read_bytes()
        if digest(raw) != record.get('bodySha256'): raise ValueError('report_response_hash_mismatch')
        if record.get('extracted') is not None:
            record['extracted'] = json.loads(extracted_candidate(raw,record['url']))
    return record


def candidate_chain(root, url):
    chain, seen, issues = [], set(), []
    while VERIFY.church_url(url):
        if url in seen: return chain, issues + ['candidate_redirect_loop']
        if len(chain) >= 6: return chain, issues + ['candidate_redirect_limit']
        seen.add(url)
        path = root / 'responses' / (digest(url) + '.json')
        if not path.is_file(): return chain, issues + ['candidate_response_evidence_missing']
        record = body_record(root, str(path.relative_to(root)), url)
        chain.append(record)
        if record.get('status') not in VERIFY.REDIRECTS: return chain, issues
        if record.get('status') != 301: issues.append('candidate_redirect_not_301')
        location = record.get('headers', {}).get('location')
        if not location: return chain, issues + ['candidate_redirect_location_missing']
        url = urljoin(url, location)
    return chain, issues + ['candidate_redirect_target_not_verified_church']


def source_chain(records, url):
    chain, seen = [], set()
    while VERIFY.church_url(url):
        if url in seen or len(chain) >= 6: return chain, ['source_redirect_chain_unresolved']
        seen.add(url)
        record = records.get(url)
        if not record: return chain, ['source_redirect_target_capture_missing']
        chain.append(record)
        if record.get('status') not in VERIFY.REDIRECTS: return chain, []
        target = record.get('redirectTarget') or urljoin(url, record.get('headers', {}).get('location', ''))
        if not target or target == url: return chain, ['source_redirect_chain_unresolved']
        url = target
    return chain, ['source_redirect_target_not_verified_church']


def source_indexability(record):
    if not record or record.get('status') != 200 or 'mainFound' not in record: return 'unknown'
    return 'indexable_observed' if VERIFY.indexable({'status': record['status'], 'headers': record.get('headers', {}), 'extracted': record}) else 'nonindexable_observed'


def path_family(url):
    path = urlsplit(url).path
    if path.startswith('/sermons/'): return 'sermon_or_archive_path'
    if path.startswith('/pages/'): return 'page_alias_path'
    if path.startswith('/event/'): return 'event_path'
    if path.startswith('/events/'): return 'calendar_path'
    if path.startswith(('/venue/', '/organiser/')): return 'venue_or_organiser_path'
    if re.match(r'^/\d{4}/\d{1,2}/', path): return 'dated_post_path'
    if path.endswith(('.xml', '.txt')): return 'control_path'
    return 'other_path'


def source_records(root, ledger):
    result = {}
    for url, summary in ledger.get('pages', {}).items():
        record = VERIFY.source_record(root, summary)
        if record.get('url') != url: raise ValueError('report_source_url_mismatch')
        if record.get('bodySha256') != summary.get('bodySha256'): raise ValueError('report_source_ledger_hash_mismatch')
        if record.get('sourcePostId') != summary.get('sourcePostId'): raise ValueError('report_source_identity_mismatch')
        result[url] = record
    return result


def retained_reconciliation(retained, records, bundle):
    if retained is None: return {}, {'available': False, 'reason': 'retained_export_not_supplied'}
    published = [record for record in retained.get('records', []) if record.get('status') == 'publish']
    by_url, ids, rows = {}, set(), []
    fresh = {record['sourcePostId'] for record in records.values() if record.get('status') == 200 and record.get('template') == 'sermon' and isinstance(record.get('sourcePostId'), int)}
    bundle_ids = {page.get('sourceId') for page in bundle.get('pages', []) if page.get('kind') == 'sermon'}
    for entry in published:
        ident, slug = entry.get('sourceWordPressId'), entry.get('slug')
        if not isinstance(ident, int) or ident <= 0 or not isinstance(slug, str) or not re.fullmatch(r'[A-Za-z0-9%_\-]+', slug): raise ValueError('retained_sermon_identity_or_slug_invalid')
        if ident in ids: raise ValueError('retained_sermon_identity_duplicate')
        ids.add(ident)
        url = ORIGIN + '/sermons/' + slug + '/'
        if url in by_url: raise ValueError('retained_sermon_path_duplicate')
        current = records.get(url); initial = current; seen = set()
        while current and current.get('status') in VERIFY.REDIRECTS:
            if current['url'] in seen: current = None; break
            seen.add(current['url'])
            target = current.get('redirectTarget') or urljoin(current['url'], current.get('headers', {}).get('location', ''))
            current = records.get(target)
        if current and current.get('status') == 200 and current.get('template') == 'sermon' and current.get('sourcePostId') == ident:
            outcome = 'fresh_same_identity_via_redirect' if seen else 'fresh_same_identity_same_path'
        elif current and current.get('status') == 200: outcome = 'fresh_identity_or_type_mismatch'
        elif initial and initial.get('status') == 404: outcome = 'fresh_source_404'
        elif initial and initial.get('status') in VERIFY.REDIRECTS: outcome = 'fresh_redirect_target_unresolved'
        elif not initial: outcome = 'source_path_not_captured'
        else: outcome = 'fresh_source_status_unresolved'
        row = {'sourceId': ident, 'url': url, 'outcome': outcome, 'sourceStatus': initial.get('status') if initial else None, 'presentInFinalBundle': ident in bundle_ids}
        by_url[url] = row; rows.append(row)
    return by_url, {'available': True, 'retainedPublishedCount': len(rows), 'freshUniqueSermonIds': len(fresh), 'outcomeCounts': dict(sorted(Counter(row['outcome'] for row in rows).items())), 'retainedIdsAbsentFromFreshSermons': sorted(ids - fresh), 'freshIdsAbsentFromRetainedPublished': sorted(fresh - ids), 'retainedIdsAbsentFromFinalBundle': sorted(ids - bundle_ids), 'freshIdsAbsentFromFinalBundle': sorted(fresh - bundle_ids), 'basis': 'explicit_retained_source_id_and_sermon_path_not_guid', 'retainedSeedSourceStatuses': dict(sorted(Counter(str(row['sourceStatus']) for row in rows).items())), 'freshPrimaryMediaMissingCount': sum(not record.get('primaryMediaReferences') for url, record in records.items() if record.get('status') == 200 and record.get('template') == 'sermon' and not urlsplit(url).query), 'freshDatabaseInventoryAvailable': False, 'limitation': 'retained_export_is_historical_fresh_wordpress_grant_guard_failed'}


def safe_reference(reference):
    return isinstance(reference, str) and bool(re.fullmatch(r'(?:docs/|seo-|legacy-url-|search-parity-|decision-log)[A-Za-z0-9_./\-]*\.md(?:#[A-Za-z0-9_\-]+)?', reference)) and '..' not in reference.split('/')


def reviewed_decisions(path, bindings, repo):
    if path is None: return {}, {}
    value = load(path)
    if value.get('format') != 'sgbc-seo-disposition-review-v1' or value.get('bindings') != bindings: raise ValueError('review_bindings_mismatch')
    policies = {}
    for policy in value.get('policies', []):
        ident, reference = policy.get('id'), policy.get('reference')
        if not isinstance(ident, str) or not CODE.fullmatch(ident) or not safe_reference(reference): raise ValueError('review_policy_reference_invalid')
        filename = reference.split('#')[0]
        if digest(VERIFY.confined_file(repo, filename).read_bytes()) != policy.get('sha256'): raise ValueError('review_policy_hash_mismatch')
        if ident in policies: raise ValueError('review_policy_duplicate')
        policies[ident] = reference
    decisions = {}
    for decision in value.get('decisions', []):
        key = decision.get('urlSha256')
        if not isinstance(key, str) or not HASH.fullmatch(key) or key in decisions: raise ValueError('review_url_identity_invalid')
        if decision.get('disposition') not in DISPOSITIONS: raise ValueError('review_disposition_invalid')
        if not CODE.fullmatch(decision.get('reasonCode', '')): raise ValueError('review_reason_code_invalid')
        if any(not isinstance(code, str) or not CODE.fullmatch(code) for code in decision.get('acceptedIssues', [])): raise ValueError('review_issue_code_invalid')
        if any(code not in policies for code in decision.get('policyIds', [])): raise ValueError('review_policy_not_bound')
        if not decision.get('policyIds'): raise ValueError('review_evidence_reference_required')
        decisions[key] = decision
    return decisions, policies


def classify(source, asset, row, diff, chain, issues, validation, decision, source_redirect_chain=None):
    if not decision: return 'unresolved', 'explicit_disposition_review_missing', [], issues
    accepted = sorted(set(decision.get('acceptedIssues', [])))
    remaining = sorted(set(issues) - set(accepted))
    if validation: return 'unresolved', 'report_evidence_validation_failed', accepted, remaining
    if set(accepted) - set(issues): return 'unresolved', 'review_issue_set_stale', accepted, remaining
    if remaining: return 'unresolved', 'verification_issues_not_reviewed', accepted, remaining
    disposition = decision['disposition']
    if disposition == 'unresolved': return disposition, decision['reasonCode'], accepted, remaining
    if not chain or not source and not asset: return 'unresolved', 'source_or_candidate_capture_evidence_missing', accepted, remaining
    final, first = chain[-1], chain[0]
    if decision.get('candidateResponseSha256') != final.get('bodySha256'): return 'unresolved', 'review_candidate_response_not_bound', accepted, remaining
    expected_source = source.get('bodySha256') if source else asset.get('sha256')
    if decision.get('sourceResponseSha256') != expected_source: return 'unresolved', 'review_source_response_not_bound', accepted, remaining
    if decision.get('targetUrl') != final.get('url'): return 'unresolved', 'review_target_url_not_bound', accepted, remaining
    if disposition == 'intentionally_removed':
        if final.get('status') not in (404, 410) or VERIFY.indexable(final): return 'unresolved', 'removal_status_or_indexability_invalid', accepted, remaining
        if decision.get('removalAuthorized') is not True: return 'unresolved', 'explicit_removal_review_required', accepted, remaining
    else:
        content_source = source
        if source and source.get('status') in VERIFY.REDIRECTS:
            if not source_redirect_chain or source_redirect_chain[0] != source or source_redirect_chain[-1].get('status') != 200: return 'unresolved', 'source_redirect_target_success_not_verified', accepted, remaining
            content_source = source_redirect_chain[-1]
            if decision.get('sourceFinalResponseSha256') != content_source.get('bodySha256') or decision.get('sourceFinalUrl') != content_source.get('url'): return 'unresolved', 'review_source_redirect_target_not_bound', accepted, remaining
        elif (source.get('status') if source else asset.get('status')) != 200: return 'unresolved', 'source_success_not_verified', accepted, remaining
        if final.get('status') != 200: return 'unresolved', 'target_success_not_verified', accepted, remaining
        if decision.get('identityVerified') is not True or decision.get('contentVerified') is not True: return 'unresolved', 'identity_and_content_review_required', accepted, remaining
        if content_source and 'mainFound' in content_source and diff is None: return 'unresolved', 'content_comparison_missing', accepted, remaining
        if disposition == 'preserved' and (len(chain) != 1 or first.get('status') != 200 or route(source['url'] if source else asset['url']) != route(final['url'])):
            return 'unresolved', 'preserved_route_not_unchanged_200', accepted, remaining
        if disposition == 'redirected' and (len(chain) != 2 or first.get('status') != 301): return 'unresolved', 'redirect_not_direct_301', accepted, remaining
    return disposition, decision['reasonCode'], accepted, remaining


def signal_groups(record):
    if not record: return {}
    return {'blocks': [VERIFY.normalized(block.get('text', '')) for block in record.get('semanticBlocks', [])],
            'metadata': {key: record.get(key) for key in ('title', 'meta', 'primaryHeading', 'headings', 'canonicalUrls', 'robots', 'schema')},
            'language': record.get('language'), 'dates': {key: record.get(key) for key in ('dates', 'serviceDate', 'publishedAt', 'modifiedAt')},
            'images': record.get('images', []), 'media': record.get('verifiedMediaIdentities', sorted({VERIFY.media_identity(item.get('url', '')) for item in record.get('primaryMediaReferences', [])} - {None})),
            'content_tree': record.get('contentTree', []) + record.get('eventMetadataTree', [])}


def safe_diff_hashes(value):
    if isinstance(value, str): return value if HASH.fullmatch(value) else 'withheld:' + digest(value)
    if isinstance(value, (int, bool)) or value is None: return value
    if isinstance(value, list): return [safe_diff_hashes(item) for item in value]
    if isinstance(value, dict): return {key if HASH.fullmatch(key) or key in ('title', 'description', 'primaryHeading', 'language', 'publishedAt', 'modifiedAt', 'sourceSha256', 'candidateSha256', 'sourcePresent', 'candidatePresent') else 'withheld:' + digest(key): safe_diff_hashes(item) for key, item in value.items()}
    return 'withheld:' + fingerprint(value)


def csv_cell(value):
    if isinstance(value, (list, dict)): value = stable(value)
    elif value is None: return ''
    elif isinstance(value, bool): return str(value).lower()
    else: value = str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) else value


def write_csv(path, fields, rows):
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w', newline='', encoding='utf8') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader()
        for row in rows: writer.writerow({key: csv_cell(row.get(key)) for key in fields})
    temporary.replace(path)


def export_reports(baseline, assets_path, candidate, bundle_path, output, *, reviews=None, retained_path=None, repo=None):
    baseline, assets_path, candidate, bundle_path = map(lambda p: Path(p).resolve(), (baseline, assets_path, candidate, bundle_path))
    repo = Path(repo).resolve() if repo else Path(__file__).resolve().parents[1]
    ledger, assets, bundle = load(baseline), load(assets_path), load(bundle_path)
    candidate_summary_path = candidate / 'summary.json'
    summary, candidate_bindings = load(candidate_summary_path), load(candidate / 'bindings.private.json')
    bindings = {'baselineSha256': digest(baseline.read_bytes()), 'assetsSha256': digest(assets_path.read_bytes()), 'candidateSummarySha256': digest(candidate_summary_path.read_bytes()), 'candidateBindingsSha256': digest((candidate / 'bindings.private.json').read_bytes()), 'candidateUrlLedgerSha256': digest((candidate / 'url-ledger.csv').read_bytes()), 'candidateDiffSha256': digest((candidate / 'content-metadata-diff.private.json').read_bytes()), 'candidateResponsesSha256': fingerprint([(path.name, digest(path.read_bytes())) for path in sorted((candidate / 'responses').glob('*.json'))]), 'bundleSha256': digest(bundle_path.read_bytes())}
    if candidate_bindings.get('baselineSha256') != bindings['baselineSha256'] or candidate_bindings.get('assetsSha256') != bindings['assetsSha256'] or summary.get('bindings') != candidate_bindings: raise ValueError('candidate_bindings_mismatch')
    if assets.get('sourceLedgerSha256') != bindings['baselineSha256'] or bundle.get('inventorySha256') != bindings['baselineSha256']: raise ValueError('source_bundle_or_assets_binding_mismatch')
    if not ledger.get('htmlPhaseFrozen'): raise ValueError('source_baseline_not_frozen')
    with (candidate / 'url-ledger.csv').open(newline='', encoding='utf-8-sig') as stream: comparator_rows = list(csv.DictReader(stream))
    observed = {}
    for row in comparator_rows:
        key = row.get('urlSha256')
        if not isinstance(key, str) or not HASH.fullmatch(key) or key in observed: raise ValueError('candidate_url_identity_invalid')
        observed[key] = row
    differences = {}
    for item in load(candidate / 'content-metadata-diff.private.json'):
        key = item.get('urlSha256')
        if not isinstance(key, str) or not HASH.fullmatch(key) or key in differences: raise ValueError('candidate_diff_identity_invalid')
        differences[key] = item
    records = source_records(baseline.parent, ledger)
    retained = load(retained_path) if retained_path else None
    retained_rows, reconciliation = retained_reconciliation(retained, records, bundle)
    inventory = VERIFY.inventory(ledger, assets)
    for url in assets.get('sourceDerivedOriginals', {}): inventory.setdefault(url, 'derived_external_asset_reference')
    for value in assets.get('sourceDerivedOriginals', {}).values(): inventory.setdefault(value['originalUrl'], 'derived_original_asset_reference')
    for url in retained_rows: inventory.setdefault(url, 'retained_published_source_unobserved')
    for page in bundle.get('pages', []): inventory.setdefault(page['sourceUrl'], 'final_bundle_source_reference')
    # Retain any comparator-only rows by a hash-safe identity; never reverse a withheld URL.
    urls_by_hash = {digest(url): url for url in inventory}
    for key, row in observed.items():
        if key not in urls_by_hash:
            if VERIFY.church_url(row.get('url', '')) and digest(row['url']) == key: inventory[row['url']] = 'candidate_inventory_only'; urls_by_hash[key] = row['url']
            else: inventory['withheld-reference:' + key] = 'candidate_inventory_only'; urls_by_hash[key] = 'withheld-reference:' + key
    decisions, policies = reviewed_decisions(reviews, bindings, repo)
    if set(decisions) - set(urls_by_hash): raise ValueError('review_contains_unknown_url_identity')
    projections = {page['path']: page for page in bundle.get('pages', [])}
    if len(projections) != len(bundle.get('pages', [])): raise ValueError('bundle_route_duplicate')
    rows, diff_rows = [], []
    for url, state in sorted(inventory.items()):
        key = url.removeprefix('withheld-reference:') if url.startswith('withheld-reference:') and HASH.fullmatch(url.removeprefix('withheld-reference:')) else digest(url)
        row, diff, source, asset = observed.get(key, {}), differences.get(key), records.get(url), assets.get('assets', {}).get(url)
        issues = code_list(row.get('issues', 'candidate_not_checked'))
        chain, validation = candidate_chain(candidate, url) if VERIFY.church_url(url) and not VERIFY.parser.MEDIA_EXT.search(url) else ([], [])
        first, final = (chain[0], chain[-1]) if chain else ({}, {})
        if summary.get('runtimeIdentityVerified') is not True: validation.append('candidate_runtime_identity_not_verified')
        if row and chain and (number(row.get('candidateStatus')) != final.get('status') or number(row.get('redirectHops')) != len(chain) - 1): validation.append('candidate_csv_response_mismatch')
        source_redirect_chain, source_redirect_issues = source_chain(records, url) if source and source.get('status') in VERIFY.REDIRECTS else ([], [])
        comparison_source = source_redirect_chain[-1] if source_redirect_chain and not source_redirect_issues and source_redirect_chain[-1].get('status') == 200 else source
        if source_redirect_chain and not source_redirect_issues and comparison_source.get('status') == 200 and 'mainFound' in comparison_source and final.get('extracted'):
            raw = VERIFY.confined_file(candidate, final['responsePath']).read_bytes().decode('utf8', errors='replace') if final.get('responsePath') else ''
            diff = {'url': VERIFY.safe_url(url), 'urlSha256': key, **VERIFY.compare_content(comparison_source, final['extracted'], raw)}
            issues = sorted(set(issues + code_list(diff.get('issues', []))))
        if source and source.get('status') in VERIFY.REDIRECTS: issues = sorted(set(issues + source_redirect_issues))
        if diff:
            if diff.get('url') != VERIFY.safe_url(url) or set(code_list(diff.get('issues', []))) - set(issues): validation.append('candidate_diff_issue_mismatch')
            for metric, code in (('missingBlockCount', 'source_semantic_blocks_missing'), ('missingMediaCount', 'original_sermon_media_relationship_missing'), ('missingImageCount', 'source_content_image_or_alt_missing')):
                if number(diff.get(metric)) and code not in issues: validation.append('candidate_diff_metric_issue_missing')
            if diff.get('metadataChanges') and 'metadata_change_requires_review' not in issues: validation.append('candidate_metadata_issue_missing')
        decision = decisions.get(key)
        disposition, reason, accepted, remaining = classify(source, asset, row, diff, chain, issues, validation, decision, source_redirect_chain)
        intended = decision.get('targetUrl') if decision else final.get('url') or (ORIGIN + route(url) if route(url) else '')
        projection = projections.get(route(intended)) if intended else None
        own_policies = decision.get('policyIds', []) if decision else []
        historical = retained_rows.get(url, {})
        provenance = list(ledger.get('discovered', {}).get(url, {}).get('sources', []))
        if asset: provenance += [{'kind': 'captured_asset_reference', 'from': value} for value in asset.get('sourcePages', [])]
        safe_provenance = [{'kind': safe_code(item.get('kind')), 'from': safe_url(item.get('from')) if item.get('from') else ''} for item in provenance]
        metadata = source or asset or {}
        source_id = source.get('sourcePostId') if source else None
        target_identity = ('source:' + str(projection['sourceId']) if isinstance(projection.get('sourceId'), int) else 'source-route:' + digest(projection['path'])) if projection else ('candidate-route:' + digest(route(intended)) if intended and route(intended) else '')
        safe_source = 'withheld-reference:' + key if url.startswith('withheld-reference:') else safe_url(url)
        report = {'source_url': safe_source, 'source_url_sha256': key, 'source_wordpress_id': source_id if isinstance(source_id, int) else None, 'source_type': safe_code(source.get('template') or ('non_html' if source else 'asset' if asset else 'unverified')) if source or asset else 'unverified', 'source_route_family': path_family(url) if VERIFY.church_url(url) else 'external_or_withheld_reference', 'source_state': safe_code(state), 'source_captured_at': metadata.get('capturedAt') if re.fullmatch(r'\d{4}-\d\d-\d\dT[0-9:.+Z\-]+', str(metadata.get('capturedAt', ''))) else '', 'source_status': metadata.get('status'), 'source_redirect': safe_url(source.get('redirectTarget')) if source else '', 'source_canonical_urls': [safe_url(value) for value in source.get('canonicalUrls', []) if value] if source else [], 'source_indexability': source_indexability(source), 'source_origin': public_origin(url), 'source_provenance': {'count': len(provenance), 'sha256': fingerprint(provenance), 'sample': safe_provenance[:10], 'sampleLimit': 10, 'fullEvidence': 'frozen_private_ledger_or_asset_manifest'}, 'traffic_evidence': 'unavailable', 'backlink_evidence': 'unavailable', 'retained_published_source_id': historical.get('sourceId'), 'retained_reconciliation': historical.get('outcome', ''), 'target_identity': target_identity, 'intended_url': safe_url(intended), 'candidate_first_status': first.get('status'), 'candidate_final_status': final.get('status'), 'candidate_final_url': safe_url(final.get('url')), 'redirect_hops': len(chain) - 1 if chain else None, 'candidate_response_sha256': safe_hash(final.get('bodySha256')), 'candidate_indexable': boolean_cell(row.get('indexable')), 'candidate_canonical_valid': boolean_cell(row.get('canonicalValid')), 'candidate_robots_allowed': boolean_cell(row.get('robotsAllowed')), 'candidate_in_sitemap': boolean_cell(row.get('inSitemap')), 'raw_verification_issues': issues, 'report_validation_issues': validation, 'reviewed_issue_codes': accepted, 'unreviewed_issue_codes': remaining, 'explained_difference_policies': own_policies, 'review_evidence_references': [policies[code] for code in own_policies], 'disposition': disposition, 'disposition_reason': reason}
        rows.append(report)
        source_groups, candidate_groups = signal_groups(comparison_source), signal_groups(final.get('extracted'))
        difference = {'source_url': safe_source, 'source_url_sha256': key, 'source_response_sha256': safe_hash(source.get('bodySha256') if source else asset.get('sha256') if asset else ''), 'candidate_response_sha256': safe_hash(final.get('bodySha256')), 'comparison_available': diff is not None, 'source_block_count': diff.get('sourceBlockCount') if diff else None, 'matched_block_count': diff.get('matchedBlockCount') if diff else None, 'missing_block_count': diff.get('missingBlockCount') if diff else None, 'missing_image_count': diff.get('missingImageCount') if diff else None, 'missing_media_count': diff.get('missingMediaCount') if diff else None, 'metadata_change_count': len(diff.get('metadataChanges', {})) if diff else None, 'missing_block_hashes': safe_diff_hashes(diff.get('missingBlockHashes', {})) if diff else {}, 'missing_image_hashes': safe_diff_hashes(diff.get('missingImageHashes', [])) if diff else [], 'missing_media_hashes': safe_diff_hashes(diff.get('missingMediaHashes', [])) if diff else [], 'metadata_change_hashes': safe_diff_hashes(diff.get('metadataChanges', {})) if diff else {}, 'bundle_projection_sha256': fingerprint(projection) if projection else '', 'explained_difference_policies': own_policies, 'raw_verification_issues': issues, 'disposition': disposition}
        for group in DIFF_GROUPS:
            before = fingerprint(source_groups[group]) if group in source_groups else ''
            after = fingerprint(candidate_groups[group]) if group in candidate_groups else ''
            difference.update({f'source_{group}_sha256': before, f'candidate_{group}_sha256': after, group + '_changed': before != after if before and after else None})
        diff_rows.append(difference)
    unresolved = sum(row['disposition'] == 'unresolved' for row in rows)
    counts = dict(sorted(Counter(row['disposition'] for row in rows).items()))
    aggregate = {'format': 'sgbc-seo-safe-acceptance-v1', 'bindings': bindings, 'reviewFileSha256': digest(Path(reviews).read_bytes()) if reviews else None, 'inventoryCount': len(rows), 'dispositionCounts': {value: counts.get(value, 0) for value in sorted(DISPOSITIONS)}, 'unresolvedCount': unresolved, 'rawIssueCounts': dict(sorted(Counter(issue for row in rows for issue in row['raw_verification_issues']).items())), 'reportIssueCounts': dict(sorted(Counter(issue for row in rows for issue in row['report_validation_issues']).items())), 'reviewedDifferencePolicyCounts': dict(sorted(Counter(code for row in rows for code in row['explained_difference_policies']).items())), 'sourceCoverageComplete': ledger.get('completed') is True, 'sourceDeferredCount': len(ledger.get('deferred', {})), 'sourcePendingCount': len(ledger.get('pendingUrls', [])), 'source404PathFamilies': dict(sorted(Counter(path_family(url) for url, record in records.items() if record.get('status') == 404).items())), 'retainedSermonReconciliation': reconciliation, 'retainedExportSha256': digest(Path(retained_path).read_bytes()) if retained_path else None, 'candidateRuntimeIdentityVerified': summary.get('runtimeIdentityVerified') is True, 'candidateComparatorPassed': summary.get('passed') is True, 'trafficEvidence': 'unavailable', 'backlinkEvidence': 'unavailable', 'freshWordpressDatabaseEvidence': 'unavailable_guard_rejected', 'verdict': 'NOT_READY', 'limitations': ['Explicit dispositions do not grant production cutover authority.', 'Unavailable source/account evidence remains a launch blocker.', 'Hash comparisons contain no source or candidate prose.', 'An intended target is not proof of equivalent content.']}
    output = Path(output).resolve(); output.mkdir(parents=True, exist_ok=True)
    write_csv(output / 'seo-url-migration-map.csv', MAP_FIELDS, rows)
    write_csv(output / 'seo-content-metadata-diff.csv', DIFF_FIELDS, diff_rows)
    VERIFY.save(output / 'seo-acceptance-summary.json', aggregate)
    return aggregate


def main():
    arguments = argparse.ArgumentParser(description=__doc__)
    for name in ('baseline', 'assets', 'candidate', 'bundle', 'output'): arguments.add_argument('--' + name, required=True)
    arguments.add_argument('--reviews'); arguments.add_argument('--retained-wordpress'); arguments.add_argument('--repo')
    args = arguments.parse_args()
    result = export_reports(args.baseline, args.assets, args.candidate, args.bundle, args.output, reviews=args.reviews, retained_path=args.retained_wordpress, repo=args.repo)
    print(json.dumps({'inventoryCount': result['inventoryCount'], 'dispositionCounts': result['dispositionCounts'], 'verdict': result['verdict']}))


if __name__ == '__main__': main()
