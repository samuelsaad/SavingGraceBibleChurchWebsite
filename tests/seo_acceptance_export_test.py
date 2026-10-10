import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('acceptance', Path(__file__).parents[1] / 'scripts/seo-export-acceptance.py')
report = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(report)
URL = report.ORIGIN + '/anonymous-example/'
SECRET = 'Synthetic confidential body must never enter a tracked report.'


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding='utf8')


def fixture(folder, changed=False, source_status=200, candidate_status=200):
    baseline = folder / 'private/source'; candidate = folder / 'private/candidate'
    baseline.mkdir(parents=True); (candidate / 'responses').mkdir(parents=True)
    def html(words):
        return ('<html lang="en-AU"><head><title>Anonymous title</title><link rel="canonical" href="' + URL + '"></head><body class="page page-id-7"><h1>Anonymous heading</h1><main><p>' + words + '</p></main></body></html>').encode()
    original, replacement = html(SECRET), html('A changed synthetic paragraph.' if changed else SECRET)
    (baseline / 'source.body').write_bytes(original)
    source = {'url': URL, 'status': source_status, 'bodySha256': report.digest(original), 'responsePath': 'source.body', 'capturedAt': '2026-01-01T00:00:00Z', 'headers': {'content-type': 'text/html'}, **report.VERIFY.parser.extract(original.decode(), URL)}
    save(baseline / 'source.json', source)
    final = {'url': URL, 'status': candidate_status, 'bodySha256': report.digest(replacement), 'responsePath': 'responses/candidate.body', 'headers': {'content-type': 'text/html'}, 'mime': 'text/html', 'extracted': report.VERIFY.parser.extract(replacement.decode(), URL)}
    (candidate / 'responses/candidate.body').write_bytes(replacement)
    save(candidate / 'responses' / (report.digest(URL) + '.json'), final)
    difference = {'url': URL, 'urlSha256': report.digest(URL), **report.VERIFY.compare_content(source, final['extracted'], replacement.decode())}
    row = {'url': URL, 'urlSha256': report.digest(URL), 'sourceState': 'captured', 'sourceKind': 'page', 'sourceStatus': source_status, 'candidateStatus': candidate_status, 'finalUrl': URL, 'redirectHops': 0, 'indexable': candidate_status == 200, 'canonicalValid': True, 'robotsAllowed': True, 'inSitemap': True, 'issues': ';'.join(difference['issues']), 'outcome': 'checked'}
    ledger = {'htmlPhaseFrozen': True, 'completed': True, 'pages': {URL: {'recordPath': 'source.json', 'bodySha256': source['bodySha256'], 'sourcePostId': 7, 'status': source_status, 'template': 'page'}}, 'discovered': {URL: {'sources': [{'kind': 'fixture', 'from': 'C:/private/protected/source.json'}]}}, 'assets': {}, 'excluded': {}, 'deferred': {}, 'pendingUrls': []}
    assets = {'assets': {}, 'remainingDependencies': {}, 'sourceDerivedOriginals': {}}
    bundle = {'pages': [{'path': '/anonymous-example/', 'sourceUrl': URL, 'sourceId': 7, 'kind': 'page', 'content': [{'tag': 'text', 'text': SECRET}]}]}
    paths = {'baseline': baseline / 'ledger.private.json', 'assets': baseline / 'assets.private.json', 'candidate': candidate, 'bundle': folder / 'private/bundle.private.json', 'output': folder / 'docs', 'repo': folder}
    value = {'paths': paths, 'source': source, 'final': final, 'ledger': ledger, 'assets': assets, 'bundle': bundle, 'row': row, 'difference': difference}
    synchronize(value)
    return value


def synchronize(value):
    paths = value['paths']; save(paths['baseline'], value['ledger'])
    sha = report.digest(paths['baseline'].read_bytes())
    value['assets']['sourceLedgerSha256'] = sha; value['bundle']['inventorySha256'] = sha
    save(paths['assets'], value['assets']); save(paths['bundle'], value['bundle'])
    bindings = {'baselineSha256': sha, 'assetsSha256': report.digest(paths['assets'].read_bytes()), 'candidateId': 'synthetic'}
    save(paths['candidate'] / 'bindings.private.json', bindings)
    save(paths['candidate'] / 'summary.json', {'bindings': bindings, 'runtimeIdentityVerified': True, 'passed': False})
    save(paths['candidate'] / 'content-metadata-diff.private.json', [value['difference']])
    with (paths['candidate'] / 'url-ledger.csv').open('w', newline='', encoding='utf8') as stream:
        writer = csv.DictWriter(stream, fieldnames=value['row'].keys()); writer.writeheader(); writer.writerow(value['row'])


def run(value, reviews=None):
    p = value['paths']
    return report.export_reports(p['baseline'], p['assets'], p['candidate'], p['bundle'], p['output'], reviews=reviews, repo=p['repo'])


def rows(value, filename='seo-url-migration-map.csv'):
    with (value['paths']['output'] / filename).open(newline='', encoding='utf8') as stream: return list(csv.DictReader(stream))


def review_file(value, aggregate, *, disposition='preserved', accepted=None):
    p = value['paths']; policy = p['repo'] / 'docs/example-policy.md'; policy.parent.mkdir(exist_ok=True); policy.write_text('Synthetic task-reviewed policy.', encoding='utf8')
    decision = {'urlSha256': report.digest(URL), 'disposition': disposition, 'reasonCode': 'anonymous_policy_applied', 'policyIds': ['anonymous_policy'], 'acceptedIssues': accepted or [], 'sourceResponseSha256': value['source']['bodySha256'], 'candidateResponseSha256': value['final']['bodySha256'], 'targetUrl': URL, 'identityVerified': True, 'contentVerified': True}
    data = {'format': 'sgbc-seo-disposition-review-v1', 'bindings': aggregate['bindings'], 'policies': [{'id': 'anonymous_policy', 'reference': 'docs/example-policy.md', 'sha256': report.digest(policy.read_bytes())}], 'decisions': [decision]}
    path = p['repo'] / 'private/reviews.private.json'; save(path, data)
    return path, data


class AcceptanceExportTests(unittest.TestCase):
    def test_parsing_cache_does_not_mask_a_changed_response_body(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture(Path(directory))
            # Resolve fixture response evidence independently of tuple ordering.
            root=Path(directory)/'private/candidate'
            relative='responses/'+report.digest(URL)+'.json'
            first=report.body_record(root,relative,URL)
            first['extracted']['title']='Changed returned object'
            self.assertEqual(report.body_record(root,relative,URL)['extracted']['title'],'Anonymous title')
            (root/'responses/candidate.body').write_bytes(b'Changed anonymous bytes')
            with self.assertRaisesRegex(ValueError,'report_response_hash_mismatch'):
                report.body_record(root,relative,URL)

    def test_verified_public_query_identities_remain_visible_but_unknown_parameters_are_withheld(self):
        for query in ('page=2','pagename=calendar','tribe_organizer=7','tribe_venue=8'):
            value='https://www.savinggrace.org.au/?'+query
            self.assertEqual(report.safe_url(value),value)
        self.assertTrue(report.safe_url('https://www.savinggrace.org.au/?session=anonymous').startswith('withheld-reference:'))

    def test_200_without_explicit_review_stays_unresolved_and_contains_no_prose(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); summary = run(value)
            self.assertEqual(summary['dispositionCounts']['unresolved'], 1)
            self.assertEqual(summary['verdict'], 'NOT_READY')
            for path in value['paths']['output'].glob('*'):
                text = path.read_text(encoding='utf8')
                self.assertNotIn(SECRET, text); self.assertNotIn('Anonymous title', text); self.assertNotIn('C:/private/protected', text)
            self.assertEqual(rows(value)[0]['traffic_evidence'], 'unavailable')

    def test_exact_hash_bound_review_can_mark_preserved(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); summary = run(value); path, _ = review_file(value, summary)
            summary = run(value, path)
            self.assertEqual(summary['dispositionCounts']['preserved'], 1)
            self.assertEqual(rows(value)[0]['disposition_reason'], 'anonymous_policy_applied')

    def test_200_with_unreviewed_missing_content_stays_unresolved(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root), changed=True); summary = run(value); path, _ = review_file(value, summary)
            self.assertEqual(run(value, path)['dispositionCounts']['unresolved'], 1)
            self.assertEqual(rows(value)[0]['disposition_reason'], 'verification_issues_not_reviewed')
            self.assertIn('source_semantic_blocks_missing', rows(value)[0]['unreviewed_issue_codes'])

    def test_explicit_explained_difference_is_retained_separately(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root), changed=True); summary = run(value)
            path, _ = review_file(value, summary, accepted=value['difference']['issues'])
            self.assertEqual(run(value, path)['dispositionCounts']['preserved'], 1)
            row = rows(value)[0]
            self.assertIn('source_semantic_blocks_missing', row['raw_verification_issues'])
            self.assertIn('anonymous_policy', row['explained_difference_policies'])

    def test_redirect_requires_one_direct_301_and_bound_final_target(self):
        source = {'url': URL, 'status': 200, 'bodySha256': 'a' * 64, 'mainFound': True}
        target = report.ORIGIN + '/anonymous-target/'
        final = {'url': target, 'status': 200, 'bodySha256': 'b' * 64}
        decision = {'disposition': 'redirected', 'reasonCode': 'reviewed_equivalent', 'acceptedIssues': [], 'sourceResponseSha256': 'a' * 64, 'candidateResponseSha256': 'b' * 64, 'targetUrl': target, 'identityVerified': True, 'contentVerified': True}
        result = report.classify(source, None, {}, {}, [{'status': 301}, final], [], [], decision)
        self.assertEqual(result[0], 'redirected')
        for chain in ([{'status': 302}, final], [{'status': 301}, {'status': 301}, final]):
            self.assertEqual(report.classify(source, None, {}, {}, chain, [], [], decision)[0], 'unresolved')

    def test_historical_redirect_requires_captured_successful_bound_source_target(self):
        alias = {'url': URL, 'status': 301, 'bodySha256': 'a' * 64, 'redirectTarget': report.ORIGIN + '/old-final/'}
        original = {'url': alias['redirectTarget'], 'status': 200, 'bodySha256': 'c' * 64, 'mainFound': True}
        final = {'url': original['url'], 'status': 200, 'bodySha256': 'b' * 64}
        decision = {'disposition': 'redirected', 'reasonCode': 'reviewed_historical_alias', 'acceptedIssues': [], 'sourceResponseSha256': alias['bodySha256'], 'candidateResponseSha256': final['bodySha256'], 'targetUrl': final['url'], 'identityVerified': True, 'contentVerified': True}
        chain, issues = report.source_chain({URL: alias, original['url']: original}, URL)
        self.assertEqual(issues, [])
        self.assertEqual(report.classify(alias, None, {}, {}, [{'status': 301}, final], [], [], decision, chain)[0], 'unresolved')
        decision.update(sourceFinalResponseSha256=original['bodySha256'], sourceFinalUrl=original['url'])
        self.assertEqual(report.classify(alias, None, {}, {}, [{'status': 301}, final], [], [], decision, chain)[0], 'redirected')
        self.assertEqual(report.source_chain({URL: alias}, URL)[1], ['source_redirect_target_capture_missing'])
        original['status'] = 404
        self.assertEqual(report.classify(alias, None, {}, None, [{'status': 301}, final], [], [], decision, chain)[0], 'unresolved')

    def test_removal_needs_explicit_authority_and_error_status(self):
        source = {'url': URL, 'status': 200, 'bodySha256': 'a' * 64}
        final = {'url': URL, 'status': 410, 'bodySha256': 'b' * 64}
        decision = {'disposition': 'intentionally_removed', 'reasonCode': 'reviewed_retirement', 'acceptedIssues': [], 'sourceResponseSha256': 'a' * 64, 'candidateResponseSha256': 'b' * 64, 'targetUrl': URL}
        self.assertEqual(report.classify(source, None, {}, None, [final], [], [], decision)[0], 'unresolved')
        decision['removalAuthorized'] = True
        self.assertEqual(report.classify(source, None, {}, None, [final], [], [], decision)[0], 'intentionally_removed')
        final['status'] = 200
        self.assertEqual(report.classify(source, None, {}, None, [final], [], [], decision)[0], 'unresolved')

    def test_all_union_sources_survive_and_sensitive_urls_are_hashed(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); extra = report.ORIGIN + '/events/future/'
            secret_url = report.ORIGIN + '/?token=DO_NOT_EXPORT_TOKEN'
            external = 'https://external.example/hidden-secret-image.jpg'
            value['ledger']['deferred'][extra] = {'reason': 'generated_calendar_navigation_or_export_unverified'}
            value['ledger']['excluded'][secret_url] = 'administrative_endpoint'
            value['assets']['remainingDependencies'][external] = {'reason': 'external_origin_not_requested'}
            synchronize(value); summary = run(value)
            self.assertEqual(summary['inventoryCount'], 4)
            text = (value['paths']['output'] / 'seo-url-migration-map.csv').read_text(encoding='utf8')
            self.assertIn(extra, text); self.assertNotIn('DO_NOT_EXPORT_TOKEN', text); self.assertNotIn('external.example', text)
            self.assertIn('withheld-reference:', text)

    def test_changed_report_or_policy_invalidates_review_binding(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); summary = run(value); path, _ = review_file(value, summary)
            (value['paths']['candidate'] / 'url-ledger.csv').write_text('modified', encoding='utf8')
            with self.assertRaises(ValueError): run(value, path)
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); summary = run(value); path, _ = review_file(value, summary)
            (Path(root) / 'docs/example-policy.md').write_text('changed', encoding='utf8')
            with self.assertRaisesRegex(ValueError, 'review_policy_hash_mismatch'): run(value, path)

    def test_tampered_body_and_binding_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); (value['paths']['candidate'] / 'responses/candidate.body').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'report_response_hash_mismatch'): run(value)
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); value['bundle']['inventorySha256'] = '0' * 64; save(value['paths']['bundle'], value['bundle'])
            with self.assertRaisesRegex(ValueError, 'source_bundle_or_assets_binding_mismatch'): run(value)

    def test_diff_evidence_cannot_hide_missing_content_behind_checked_csv(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root), changed=True); value['row']['issues'] = ''; synchronize(value)
            summary = run(value); path, _ = review_file(value, summary)
            self.assertEqual(run(value, path)['dispositionCounts']['unresolved'], 1)
            self.assertIn('candidate_diff_issue_mismatch', rows(value)[0]['report_validation_issues'])

    def test_retained_reconciliation_uses_ids_and_paths_not_guids(self):
        retained = {'records': [{'status': 'publish', 'sourceWordPressId': 101, 'slug': 'first'}, {'status': 'publish', 'sourceWordPressId': 102, 'slug': 'second'}, {'status': 'draft', 'sourceWordPressId': 103, 'slug': 'private'}]}
        first = report.ORIGIN + '/sermons/first/'; second = report.ORIGIN + '/sermons/second/'
        records = {first: {'url': first, 'status': 200, 'template': 'sermon', 'sourcePostId': 101, 'primaryMediaReferences': [{'url': 'https://outside.example/example'}]}, second: {'url': second, 'status': 200, 'template': 'sermon', 'sourcePostId': 999}, report.ORIGIN + '/?p=102': {'url': report.ORIGIN + '/?p=102', 'status': 200, 'template': 'sermon', 'sourcePostId': 102}}
        rows_by_url, summary = report.retained_reconciliation(retained, records, {'pages': [{'kind': 'sermon', 'sourceId': 101}]})
        self.assertEqual(summary['retainedPublishedCount'], 2)
        self.assertEqual(rows_by_url[first]['outcome'], 'fresh_same_identity_same_path')
        self.assertEqual(rows_by_url[second]['outcome'], 'fresh_identity_or_type_mismatch')
        self.assertEqual(summary['retainedIdsAbsentFromFinalBundle'], [102])

    def test_private_policy_reference_and_stale_accepted_issues_refused(self):
        with tempfile.TemporaryDirectory() as root:
            value = fixture(Path(root)); summary = run(value); path, data = review_file(value, summary)
            data['policies'][0]['reference'] = 'private/protected.md'; save(path, data)
            with self.assertRaisesRegex(ValueError, 'review_policy_reference_invalid'): run(value, path)
        source = {'url': URL, 'status': 200, 'bodySha256': 'a' * 64}
        self.assertEqual(report.classify(source, None, {}, None, [], [], [], {'disposition': 'preserved', 'acceptedIssues': ['not_current']})[1], 'review_issue_set_stale')


if __name__ == '__main__': unittest.main()
