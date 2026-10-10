"""Compare frozen source evidence to loopback; no source/provider requests or media playback."""
from __future__ import annotations
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from datetime import datetime, timezone
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urljoin, urlsplit, urlunsplit
from urllib.request import Request, ProxyHandler, build_opener
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

PARSER_PATH = Path(__file__).with_name('seo-source-capture.py')
_spec = importlib.util.spec_from_file_location('seo_capture_parser', PARSER_PATH)
parser = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(parser)
CANONICAL = 'https://www.savinggrace.org.au'
REDIRECTS = frozenset((301, 302, 303, 307, 308))
PRIVATE_PATH = re.compile(r'^/(?:admin|api|frontend-preview|draft-preview|cms-preview|__local|__cms|sermons-v\d+)(?:/|$)')
FIELDS = ('url', 'urlSha256', 'sourceState', 'sourceKind', 'sourceStatus', 'candidateStatus', 'finalUrl', 'redirectHops', 'sourceBlockCount', 'matchedBlockCount', 'missingBlockCount', 'missingMediaCount', 'missingImageCount', 'metadataChangeCount', 'indexable', 'canonicalValid', 'robotsAllowed', 'inSitemap', 'issues', 'outcome')

def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode('utf8')).hexdigest()

def stamp():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def normalized(value):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value or '')).strip()

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')
    temporary.replace(path)

def private_directory(path):
    result = Path(path).resolve()
    if 'private' not in [part.lower() for part in result.parts]:
        raise ValueError('output_must_be_private')
    result.mkdir(parents=True, exist_ok=True)
    return result

def confined_file(root, relative):
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise ValueError('source_evidence_path_invalid')
    result = (root / relative).resolve()
    if not result.is_relative_to(root.resolve()) or not result.is_file():
        raise ValueError('source_evidence_path_invalid')
    return result

def church_url(value):
    try:
        parts = urlsplit(value)
        return (parts.scheme in ('https', 'http') and parts.hostname in parser.HOSTS
                and not parts.username and not parts.password and parts.port is None
                and not parts.fragment and not any(ord(c) < 32 for c in value) and '\\' not in value)
    except (ValueError, TypeError):
        return False

def canonical_url(value):
    parts = urlsplit(value)
    return CANONICAL + (parts.path or '/') + ('?' + parts.query if parts.query else '')

def expected_canonical(value):
    parts = urlsplit(value)
    retained = [part for part in parts.query.split('&') if part and not next(iter(__import__('urllib.parse', fromlist=['parse_qsl']).parse_qsl(part)), ('', ''))[0].lower().startswith('utm_')]
    return CANONICAL + (parts.path or '/') + ('?' + '&'.join(retained) if retained else '')


def safe_url(value):
    return value if church_url(value) else 'external-reference:' + digest(value)

def inventory(ledger, asset_manifest=None):
    assets = asset_manifest or {}
    urls = set(ledger.get('pages', {})) | set(ledger.get('discovered', {})) | set(ledger.get('pendingUrls', [])) | set(ledger.get('excluded', {})) | set(ledger.get('assets', {})) | set(ledger.get('deferred', {}))
    for key in ('assets', 'remainingDependencies', 'excludedResources'):
        urls.update(assets.get(key, {}))
    result = {}
    for url in sorted(urls):
        if url in ledger.get('pages', {}): state = 'captured'
        elif url in assets.get('assets', {}): state = 'asset_captured'
        elif url in ledger.get('pendingUrls', []): state = 'pending'
        elif url in ledger.get('deferred', {}): state = 'deferred:' + ledger['deferred'][url].get('reason', 'unverified')
        elif url in ledger.get('excluded', {}): state = 'excluded:' + str(ledger['excluded'][url])
        elif url in assets.get('remainingDependencies', {}): state = 'asset_dependency_unverified'
        elif url in assets.get('excludedResources', {}): state = 'asset_excluded'
        else: state = 'discovered_uncaptured'
        result[url] = state
    return result

class LoopbackClient:
    """Every socket destination is the one validated literal loopback origin."""
    def __init__(self, base, output, *, timeout=15, request_limit=20000, max_bytes=52_428_800, opener=None, expected_label=None):
        parts = urlsplit(base)
        if (parts.scheme != 'http' or parts.hostname not in ('127.0.0.1', '::1')
                or parts.username or parts.password or parts.path not in ('', '/')
                or parts.query or parts.fragment or parts.port is None):
            raise ValueError('candidate_must_be_explicit_http_loopback_origin')
        if not 1 <= request_limit <= 100000 or not 0 < timeout <= 60 or not 1 <= max_bytes <= 64_000_000:
            raise ValueError('candidate_request_limits_invalid')
        self.base = urlunsplit((parts.scheme, parts.netloc, '', '', ''))
        self.output = output
        self.timeout, self.limit, self.max_bytes = timeout, request_limit, max_bytes
        self.opener = opener or build_opener(ProxyHandler({}), parser.NoRedirect())
        self.expected_label, self.label = expected_label, None
        self.requests, self.cache = 0, {}
        self.lock = Lock()

    def fetch(self, logical):
        if logical in self.cache: return json.loads(self.cache[logical].read_text(encoding='utf8'))
        if not church_url(logical): raise ValueError('candidate_logical_origin_refused')
        if parser.MEDIA_EXT.search(logical):
            return {'url': logical, 'status': None, 'headers': {}, 'error': 'recording_not_requested', 'bodySha256': None}
        with self.lock:
            if self.requests >= self.limit: raise ValueError('candidate_request_budget_exhausted')
            self.requests += 1
        parts = urlsplit(logical)
        physical = self.base + (parts.path or '/') + ('?' + parts.query if parts.query else '')
        headers = {'X-SEO-Rehearsal-Origin': parts.scheme + '://' + parts.netloc,
                   'User-Agent': 'SavingGrace-SEO-Loopback-Comparator/1.0', 'Accept-Encoding': 'identity'}
        response = None
        started = time.monotonic()
        try:
            try: response = self.opener.open(Request(physical, headers=headers, method='GET'), timeout=self.timeout)
            except HTTPError as failure: response = failure
            response_headers = {key.lower(): value for key, value in response.headers.items()
                                if key.lower() in ('content-type', 'location', 'x-robots-tag', 'x-seo-candidate', 'cache-control', 'content-length', 'link')}
            label = response_headers.get('x-seo-candidate')
            if self.expected_label and label != self.expected_label: raise ValueError('candidate_runtime_label_mismatch')
            with self.lock:
                if self.label is not None and label != self.label: raise ValueError('candidate_runtime_changed')
                if label is not None: self.label = label
            mime = response_headers.get('content-type', '').split(';')[0].strip().lower()
            recording = mime.startswith(('audio/', 'video/')) or mime in ('application/vnd.apple.mpegurl', 'application/x-mpegurl')
            body = b'' if recording else response.read(self.max_bytes + 1)
            result = {'url': logical, 'status': response.status, 'headers': response_headers, 'mime': mime,
                      'bodySha256': digest(body), 'byteCount': len(body), 'elapsedMs': round((time.monotonic() - started) * 1000), 'capturedAt': stamp()}
            if recording: result['error'] = 'recording_body_not_requested'
            if len(body) > self.max_bytes: result['error'] = 'candidate_body_limit_exceeded'
            if body:
                key = digest(body)
                path = self.output / 'responses' / (key + '.body')
                path.parent.mkdir(parents=True, exist_ok=True)
                if not path.exists(): path.write_bytes(body)
                result['responsePath'] = str(path.relative_to(self.output))
                if 'html' in mime: result['extracted'] = parser.extract(body.decode('utf8', errors='replace'), logical)
        except (URLError, TimeoutError, OSError):
            result = {'url': logical, 'status': None, 'headers': {}, 'error': 'candidate_request_failed', 'bodySha256': None}
        finally:
            if response is not None: response.close()
        record_path = self.output / 'responses' / (digest(logical) + '.json')
        save(record_path, result)
        self.cache[logical] = record_path
        return result

    def follow(self, logical, max_hops=5):
        chain, visited, issues = [], set(), []
        current = logical
        while True:
            if current in visited:
                issues.append('redirect_loop'); break
            visited.add(current)
            response = self.fetch(current)
            chain.append(response)
            if response.get('error'): issues.append(response['error'])
            if response.get('status') not in REDIRECTS: break
            if response['status'] != 301: issues.append('redirect_not_permanent_301')
            location = response['headers'].get('location')
            if not location:
                issues.append('redirect_location_missing'); break
            target = urljoin(current, location)
            if not church_url(target):
                issues.append('external_or_invalid_redirect_not_followed'); break
            if len(chain) > max_hops:
                issues.append('redirect_hop_limit'); break
            current = target
        if len(chain) > 2: issues.append('redirect_not_one_hop')
        return {'chain': chain, 'final': chain[-1] if chain else None, 'issues': sorted(set(issues))}

def source_record(root, summary):
    record = json.loads(confined_file(root, summary.get('recordPath')).read_text(encoding='utf8'))
    expected = summary.get('bodySha256')
    if record.get('bodySha256') != expected: raise ValueError('source_record_digest_mismatch')
    if record.get('responsePath'):
        body = confined_file(root, record['responsePath']).read_bytes()
        if digest(body) != expected: raise ValueError('source_body_digest_mismatch')
        mime = record.get('headers', {}).get('content-type', '').lower()
        if 'html' in mime or record.get('mainFound') is not None:
            record = {**record, **parser.extract(body.decode('utf8', errors='replace'), record['url'])}
    elif expected not in (None, digest(b'')): raise ValueError('source_body_missing')
    return record

def media_identity(url):
    try:
        parts = urlsplit(url)
        host = (parts.hostname or '').lower()
        if host in ('www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'youtu.be'):
            value = parts.path.strip('/') if host == 'youtu.be' else parse_qs(parts.query).get('v', [''])[0] if parts.path == '/watch' else re.sub(r'^/(?:embed|shorts)/', '', parts.path).strip('/')
            return 'youtube:' + value if re.fullmatch(r'[A-Za-z0-9_-]{11}', value) else None
        if host in ('sermonaudio.com', 'www.sermonaudio.com', 'embed.sermonaudio.com'):
            match = re.search(r'/(?:player/[av]|sermons)/(\d+)(?:/|$)', parts.path)
            value = match.group(1) if match else parse_qs(parts.query).get('SID', parse_qs(parts.query).get('sid', ['']))[0]
            return 'sermonaudio:' + value if re.fullmatch(r'\d+', value or '') else None
    except (ValueError, TypeError): pass
    return None

def candidate_media(document, extracted):
    tree = parser.Tree(); tree.feed(document)
    identities = set()
    for node in parser.nodes(tree.root):
        attrs = node['attrs']
        if 'data-load-youtube' in attrs and re.fullmatch(r'[A-Za-z0-9_-]{11}', attrs.get('data-video-id', '')):
            identities.add('youtube:' + attrs['data-video-id'])
        if 'data-audio-frame' in attrs and re.fullmatch(r'\d+', attrs.get('data-sermonaudio-id', '')): identities.add('sermonaudio:' + attrs['data-sermonaudio-id'])
    return identities

def tree_images(nodes):
    result = []
    for node in nodes or []:
        if not isinstance(node, dict): continue
        if node.get('tag') == 'img':
            result.append((node.get('src', ''), normalized(node.get('alt', ''))))
        result.extend(tree_images(node.get('children', [])))
    return result

def image_key(value):
    return canonical_url(value) if church_url(value) else value

def compare_content(source, candidate, candidate_document=''):
    """Exact normalized block accounting, never inferred semantic equivalence."""
    event_blocks = []
    def event_text(node):
        return node.get('text', '') if node.get('tag') == 'text' else ' '.join(event_text(child) for child in node.get('children', []))
    def event_visit(node):
        if node.get('tag') in ('p', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'figcaption'):
            value = normalized(event_text(node))
            if value: event_blocks.append({'text': value})
        for child in node.get('children', []): event_visit(child)
    for node in source.get('eventMetadataTree', []): event_visit(node)
    expected = Counter(digest(normalized(block['text'])) for block in source.get('semanticBlocks', []) + event_blocks if normalized(block.get('text')))
    actual = Counter(digest(normalized(block['text'])) for block in candidate.get('semanticBlocks', []) if normalized(block.get('text')))
    for heading in candidate.get('headings', []):
        key = digest(normalized(heading.get('text'))); actual[key] = max(actual[key], 1)
    missing = expected - actual
    changes = {}
    fields = {'title': (source.get('title'), candidate.get('title')),
              'description': (source.get('meta', {}).get('description', []), candidate.get('meta', {}).get('description', [])),
              'primaryHeading': (source.get('primaryHeading'), candidate.get('primaryHeading')),
              'language': (source.get('language'), candidate.get('language')),
              'publishedAt': (source.get('publishedAt'), candidate.get('publishedAt')),
              'modifiedAt': (source.get('modifiedAt'), candidate.get('modifiedAt'))}
    for key in ('og:title','og:description','og:type','og:url','og:image','twitter:card','twitter:title','twitter:description','twitter:image'):
        fields[key]=(source.get('meta',{}).get(key,[]),candidate.get('meta',{}).get(key,[]))
    def date_instant(value):
        if not value:return value
        try:return __import__('datetime').datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(__import__('datetime').timezone.utc).isoformat()
        except (ValueError,TypeError):return value
    for name, (old, new) in fields.items():
        if name in ('publishedAt','modifiedAt') and date_instant(old)==date_instant(new):continue
        encode = lambda value: json.dumps(value, sort_keys=True, ensure_ascii=False)
        if old != new:
            changes[name] = {'sourceSha256': digest(encode(old)), 'candidateSha256': digest(encode(new)), 'sourcePresent': bool(old), 'candidatePresent': bool(new)}
    source_media = {media_identity(item.get('url', '')) for item in source.get('primaryMediaReferences', [])} - {None}
    missing_media = source_media - candidate_media(candidate_document, candidate)
    expected_images = Counter((image_key(url), alt) for url, alt in tree_images(source.get('contentTree', []) + source.get('eventMetadataTree', [])))
    candidate_images = Counter((image_key(item['url']), normalized(item.get('alt'))) for item in candidate.get('images', []))
    missing_images = expected_images - candidate_images
    issues = []
    if not source.get('mainFound'): issues.append('source_main_region_unidentified')
    elif not candidate.get('mainFound'): issues.append('candidate_main_region_missing')
    if missing: issues.append('source_semantic_blocks_missing')
    if not expected and normalized(source.get('mainText')) and normalized(source['mainText']) not in normalized(candidate.get('mainText')):
        issues.append('source_unstructured_main_text_missing')
    if changes: issues.append('metadata_change_requires_review')
    if missing_media: issues.append('original_sermon_media_relationship_missing')
    if missing_images: issues.append('source_content_image_or_alt_missing')
    if any(not media_identity(item.get('url', '')) for item in source.get('primaryMediaReferences', [])):
        issues.append('source_media_identity_unresolved')
    return {'sourceBlockCount': sum(expected.values()), 'matchedBlockCount': sum(expected.values()) - sum(missing.values()),
            'missingBlockCount': sum(missing.values()), 'missingBlockHashes': dict(missing), 'metadataChanges': changes,
            'missingMediaCount': len(missing_media), 'missingMediaHashes': sorted(digest(value) for value in missing_media),
            'missingImageCount': sum(missing_images.values()), 'missingImageHashes': sorted(digest(json.dumps(key)) for key in missing_images.elements()),
            'additionalSignals': {key:{'sourceSha256':digest(json.dumps(source.get(key),sort_keys=True,ensure_ascii=False)),'candidateSha256':digest(json.dumps(candidate.get(key),sort_keys=True,ensure_ascii=False)),'changed':source.get(key)!=candidate.get(key)} for key in ('headings','schema','canonicalUrls','robots')},
            'emptySourceMain': bool(source.get('mainFound')) and not normalized(source.get('mainText')), 'issues': issues}

def indexable(response):
    extracted = response.get('extracted', {})
    robots = ' '.join(extracted.get('robots', [])) + ' ' + response.get('headers', {}).get('x-robots-tag', '')
    return response.get('status') == 200 and 'noindex' not in robots.lower() and 'none' not in re.split(r'[,\s]+', robots.lower())

class Verification:
    def __init__(self, baseline, candidate, output, *, assets=None, environment='production', candidate_id=None, expected_label=None, request_limit=20000, concurrency=1):
        if type(concurrency) is not int or not 1 <= concurrency <= 4: raise ValueError('candidate_concurrency_invalid')
        self.concurrency = concurrency
        self.baseline = Path(baseline).resolve()
        self.root = self.baseline.parent
        self.output = private_directory(output)
        baseline_bytes = self.baseline.read_bytes()
        self.ledger = json.loads(baseline_bytes)
        self.assets_path = Path(assets).resolve() if assets else None
        assets_bytes = self.assets_path.read_bytes() if self.assets_path else None
        self.assets = json.loads(assets_bytes) if assets_bytes else {}
        self.bindings = {'baselineSha256': digest(baseline_bytes), 'assetsSha256': digest(assets_bytes) if assets_bytes else None,
                         'parserSha256': digest(PARSER_PATH.read_bytes()), 'comparatorSha256': digest(Path(__file__).read_bytes()),
                         'candidateOrigin': candidate, 'candidateId': candidate_id, 'expectedRuntimeLabel': expected_label,
                         'environment': environment, 'requestLimit': request_limit, 'concurrency': concurrency}
        state_path = self.output / 'bindings.private.json'
        if state_path.exists(): raise ValueError('verification_output_already_used_choose_fresh_directory')
        save(state_path, self.bindings)
        (self.output / 'frozen-ledger.private.json').write_bytes(baseline_bytes)
        if assets_bytes: (self.output / 'frozen-assets.private.json').write_bytes(assets_bytes)
        self.environment = environment
        self.client = LoopbackClient(candidate, self.output, request_limit=request_limit, expected_label=expected_label)
        self.rows, self.differences, self.link_rows, self.control_issues = [], [], [], []
        self.sitemap_urls, self.internal_targets = set(), set()
        self.internal_inlinks = Counter()
        self.robots = RobotFileParser()

    def body(self, result):
        return confined_file(self.output, result['responsePath']).read_bytes() if result.get('responsePath') else b''

    def controls(self):
        robots = self.client.follow(CANONICAL + '/robots.txt')
        result = robots['final']
        if result.get('error') == 'candidate_request_failed': raise ValueError('candidate_unreachable')
        self.control_issues.extend(robots['issues'])
        if result.get('status') != 200: self.control_issues.append('robots_not_200')
        self.robots.parse(self.body(result).decode('utf8', errors='replace').splitlines())
        if self.environment == 'production' and not self.robots.can_fetch('*', CANONICAL + '/'):
            self.control_issues.append('production_robots_disallows_home')
        if self.environment != 'production' and self.robots.can_fetch('*', CANONICAL + '/'):
            self.control_issues.append('private_robots_allows_home')
        queue, visited = [CANONICAL + '/sitemap.xml'], set()
        while queue:
            target = queue.pop(0)
            if target in visited:
                self.control_issues.append('sitemap_index_cycle_or_duplicate'); continue
            if len(visited) >= 50:
                self.control_issues.append('sitemap_index_limit'); break
            visited.add(target)
            followed = self.client.follow(target)
            result = followed['final']
            self.control_issues.extend(followed['issues'])
            if self.environment != 'production':
                if result.get('status') != 404: self.control_issues.append('private_sitemap_not_denied')
                break
            if result.get('status') != 200:
                self.control_issues.append('sitemap_not_200'); continue
            try: root = ET.fromstring(self.body(result))
            except ET.ParseError:
                self.control_issues.append('sitemap_xml_invalid'); continue
            kind = root.tag.rsplit('}', 1)[-1]
            if kind not in ('sitemapindex', 'urlset'):
                self.control_issues.append('sitemap_root_invalid'); continue
            for node in root.iter():
                if node.tag.rsplit('}', 1)[-1] != 'loc': continue
                url = (node.text or '').strip()
                if not church_url(url) or not url.startswith(CANONICAL + '/'):
                    self.control_issues.append('sitemap_noncanonical_or_external_url'); continue
                if kind == 'sitemapindex': queue.append(url)
                elif url in self.sitemap_urls: self.control_issues.append('sitemap_duplicate_url')
                else: self.sitemap_urls.add(url)

    def asset_diff(self, url, response):
        source = self.assets.get('assets', {}).get(url)
        if not source: return ['asset_bytes_not_captured']
        if source.get('status') != 200 or source.get('validation', {}).get('valid') is not True: return ['source_asset_not_validated']
        body = confined_file(self.assets_path.parent, source.get('relativePath')).read_bytes()
        if digest(body) != source.get('sha256') or len(body) != source.get('byteCount'): raise ValueError('source_asset_digest_mismatch')
        issues = []
        if response.get('status') != 200: issues.append('asset_not_200')
        if response.get('bodySha256') != source['sha256']: issues.append('asset_bytes_changed')
        if response.get('mime') != source.get('mime', '').split(';')[0].lower(): issues.append('asset_mime_changed')
        return issues

    def inspect_page(self, result, row):
        extracted = result.get('extracted')
        if not extracted: return []
        url = result['url']
        is_indexable = indexable(result)
        canonicals = extracted.get('canonicalUrls', [])
        valid = len(canonicals) == 1 and canonicals[0] == expected_canonical(url)
        row.update(indexable=is_indexable, canonicalValid=valid, robotsAllowed=self.robots.can_fetch('*', url), inSitemap=expected_canonical(url) in self.sitemap_urls)
        issues = []
        if self.environment == 'production':
            if result['status'] == 200 and is_indexable and not valid: issues.append('indexable_canonical_not_self_or_missing')
            if is_indexable and not row['robotsAllowed']: issues.append('indexable_page_blocked_by_robots')
            if is_indexable and valid and not row['inSitemap']: issues.append('indexable_page_missing_from_sitemap')
            if is_indexable and PRIVATE_PATH.search(urlsplit(url).path): issues.append('private_or_variant_page_indexable')
            if result['status'] >= 400 and (canonicals or is_indexable): issues.append('error_page_canonical_or_indexable')
        elif is_indexable or canonicals: issues.append('private_page_indexable_or_canonical')
        for item in extracted.get('links', []) + extracted.get('images', []) + extracted.get('resources', []):
            raw = item.get('href') or item.get('url')
            if result.get('status') != 200 or not raw or raw.startswith('#'): continue
            target = parser.address(raw, url)
            if target and church_url(target) and not parser.MEDIA_EXT.search(target):
                if item.get('rel') == 'canonical': continue
                self.internal_targets.add(target)
                self.internal_inlinks[target] += 1
        return issues

    def verify_url(self, url, state):
        row = dict.fromkeys(FIELDS, '')
        row.update(url=safe_url(url), urlSha256=digest(url), sourceState=state)
        issues = []
        if not church_url(url): issues.append('external_dependency_not_requested')
        elif parser.MEDIA_EXT.search(url): issues.append('recording_not_requested')
        else:
            followed = self.client.follow(url)
            result = followed['final']
            issues.extend(followed['issues'])
            row.update(candidateStatus=result.get('status'), finalUrl=safe_url(result['url']), redirectHops=max(0, len(followed['chain']) - 1))
            source = None
            if url in self.ledger.get('pages', {}):
                try:
                    source = source_record(self.root, self.ledger['pages'][url])
                    if source.get('url') != url: raise ValueError('source_record_url_mismatch')
                    row.update(sourceStatus=source.get('status'), sourceKind=source.get('template', 'non_html'))
                except (ValueError, OSError, json.JSONDecodeError):
                    issues.append('source_evidence_integrity_failed')
                if source:
                    if source.get('status') == 200 and result.get('status') != 200: issues.append('previous_200_not_preserved')
                    elif source.get('status') != 200 and source.get('status') != followed['chain'][0].get('status'):
                        issues.append('status_mapping_change_requires_review')
                    if source.get('status') == 200 and 'mainFound' in source:
                        if self.environment == 'production' and indexable({'status': 200, 'headers': source.get('headers', {}), 'extracted': source}) and not indexable(result):
                            issues.append('source_indexability_lost')
                        if result.get('extracted'):
                            diff = compare_content(source, result['extracted'], self.body(result).decode('utf8', errors='replace'))
                            issues.extend(diff['issues'])
                            for key in ('sourceBlockCount', 'matchedBlockCount', 'missingBlockCount', 'missingMediaCount', 'missingImageCount'): row[key] = diff[key]
                            row['metadataChangeCount'] = len(diff['metadataChanges'])
                            self.differences.append({'url': safe_url(url), 'urlSha256': digest(url), **diff})
                        else: issues.append('previous_html_not_rendered')
                    elif source.get('status') == 200:
                        if source.get('bodySha256') != result.get('bodySha256'):
                            issues.append('non_html_source_bytes_changed_requires_review')
                        old_mime=source.get('headers', {}).get('content-type', '').split(';')[0].lower()
                        new_mime=result.get('mime', '')
                        xml_types={'application/xml','text/xml','application/rss+xml','application/atom+xml'}
                        if old_mime and old_mime!=new_mime and not (old_mime in xml_types and new_mime in xml_types):
                            issues.append('non_html_mime_changed')
            elif url in self.assets.get('assets', {}) or url in self.ledger.get('assets', {}):
                row['sourceKind'] = 'asset'
                try: issues.extend(self.asset_diff(url, result))
                except (ValueError, OSError): issues.append('source_asset_integrity_failed')
            elif state.startswith('excluded:'):
                row['sourceKind'] = 'excluded'; issues.append('source_excluded_no_comparison_evidence')
            else: issues.append('source_capture_pending_or_missing')
            issues.extend(self.inspect_page(result, row))
        row['issues'] = ';'.join(sorted(set(issues)))
        row['outcome'] = 'review_required' if issues else 'checked'
        self.rows.append(row)

    def audit_targets(self):
        # A finite union, not a recursive candidate/provider crawl.
        for target in sorted(self.internal_targets | self.sitemap_urls):
            followed = self.client.follow(target)
            result = followed['final']
            issues = list(followed['issues'])
            if result.get('status') != 200: issues.append('internal_target_not_200')
            if len(followed['chain']) > 1: issues.append('internal_target_redirects')
            if target in self.sitemap_urls:
                if not result.get('extracted') or not indexable(result): issues.append('sitemap_target_not_indexable_html')
                elif result['extracted'].get('canonicalUrls') != [target]: issues.append('sitemap_target_not_self_canonical')
                if not self.robots.can_fetch('*', target): issues.append('sitemap_target_blocked_by_robots')
                if PRIVATE_PATH.search(urlsplit(target).path): issues.append('sitemap_private_or_variant_path')
            self.link_rows.append({'url': safe_url(target), 'urlSha256': digest(target), 'status': result.get('status'),
                                   'inSitemap': target in self.sitemap_urls, 'inlinkCount': self.internal_inlinks[target],
                                   'issues': ';'.join(sorted(set(issues)))})

    def reports(self, fatal=None):
        attempted_rows = len(self.rows)
        recorded = {row['urlSha256'] for row in self.rows}
        for url, state in inventory(self.ledger, self.assets).items():
            if digest(url) not in recorded:
                row = dict.fromkeys(FIELDS, '')
                row.update(url=safe_url(url), urlSha256=digest(url), sourceState=state, issues='candidate_not_checked', outcome='incomplete')
                self.rows.append(row)
        issue_counts = Counter(issue for row in self.rows + self.link_rows for issue in row['issues'].split(';') if issue)
        issue_counts.update(self.control_issues)
        pending = len(self.ledger.get('pendingUrls', []))
        complete = self.ledger.get('completed') is True and not pending and not self.ledger.get('capReached')
        if not complete: issue_counts['source_baseline_incomplete'] += 1
        if self.ledger.get('deferred'): issue_counts['source_deferred_urls_unresolved'] += len(self.ledger['deferred'])
        if self.assets.get('remainingDependencies'): issue_counts['source_asset_dependencies_unresolved'] += len(self.assets['remainingDependencies'])
        if fatal: issue_counts[fatal] += 1
        for name, rows, fields in [('url-ledger.csv', self.rows, FIELDS), ('internal-targets.csv', self.link_rows, ('url', 'urlSha256', 'status', 'inSitemap', 'inlinkCount', 'issues'))]:
            with (self.output / name).open('w', newline='', encoding='utf8') as handle:
                writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(rows)
        save(self.output / 'content-metadata-diff.private.json', self.differences)
        summary = {'format': 'sgbc-seo-candidate-verification-v1', 'bindings': self.bindings, 'finishedAt': stamp(),
                   'baselineComplete': complete, 'sourcePendingCount': pending, 'sourceDeferredCount': len(self.ledger.get('deferred', {})), 'inventoryCount': len(inventory(self.ledger, self.assets)),
                   'checkedInventoryRows': attempted_rows, 'inventoryReportRows': len(self.rows), 'candidateRequests': self.client.requests,
                   'sitemapUrlCount': len(self.sitemap_urls), 'internalTargetCount': len(self.link_rows),
                   'sourceStateCounts': dict(Counter(row['sourceState'] for row in self.rows)), 'issueCounts': dict(sorted(issue_counts.items())),
                   'runtimeLabelObserved': self.client.label, 'runtimeIdentityVerified': self.client.expected_label is not None,
                   'unverifiedRuntimeIdentity': self.client.expected_label is None,
                   'passed': not issue_counts and attempted_rows == len(inventory(self.ledger, self.assets)),
                   'limitations': ['No JavaScript/browser rendering or account analytics.', 'Exact normalized block coverage does not assert content correctness.',
                                   'Metadata/status differences require an explicit reviewed migration decision.', 'Provider recordings and external dependencies were not retrieved.']}
        save(self.output / 'summary.json', summary)
        return summary

    def run(self):
        fatal = None
        try:
            self.controls()
            if self.concurrency > 1:
                # Unique logical URLs, literal loopback sockets, unchanged budgets.
                urls=[url for url in inventory(self.ledger,self.assets) if church_url(url) and not parser.MEDIA_EXT.search(url)]
                with ThreadPoolExecutor(max_workers=self.concurrency) as pool:
                    for _ in pool.map(self.client.fetch,urls): pass
                print(json.dumps({'prefetchedRequests':self.client.requests,'concurrency':self.concurrency}),flush=True)
            for index, (url, state) in enumerate(inventory(self.ledger, self.assets).items(), 1):
                self.verify_url(url, state)
                if index % 25 == 0:
                    save(self.output / 'progress.private.json', {'rows': index, 'requests': self.client.requests, 'updatedAt': stamp()})
                    print(json.dumps({'checkedRows': index, 'candidateRequests': self.client.requests}), flush=True)
            self.audit_targets()
        except (ValueError, OSError) as error:
            fatal = str(error) if isinstance(error, ValueError) else 'verification_io_failure'
        if digest(self.baseline.read_bytes()) != self.bindings['baselineSha256']:
            self.control_issues.append('live_source_ledger_changed_during_frozen_run')
        return self.reports(fatal)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--baseline', required=True)
    cli.add_argument('--candidate', required=True)
    cli.add_argument('--output', required=True)
    cli.add_argument('--assets')
    cli.add_argument('--environment', choices=('production', 'staging'), default='production')
    cli.add_argument('--candidate-id', help='Caller-supplied provenance label, not proof of running bytes.')
    cli.add_argument('--expected-runtime-label', help='Require every HTTP response X-SEO-Candidate header to match.')
    cli.add_argument('--request-limit', type=int, default=20000)
    cli.add_argument('--concurrency', type=int, default=1, choices=range(1,5), help='Bounded loopback-only HTTP prefetch; source/provider traffic is never enabled.')
    args = cli.parse_args()
    try:
        summary = Verification(args.baseline, args.candidate, args.output, assets=args.assets, environment=args.environment,
                               candidate_id=args.candidate_id, expected_label=args.expected_runtime_label, request_limit=args.request_limit, concurrency=args.concurrency).run()
        print(json.dumps({key: summary[key] for key in ('checkedInventoryRows', 'inventoryCount', 'candidateRequests', 'baselineComplete', 'passed', 'issueCounts')}))
        return 0 if summary['passed'] else 1
    except (ValueError, OSError, json.JSONDecodeError):
        print(json.dumps({'passed': False, 'error': 'verification_configuration_or_evidence_invalid'})); return 2

if __name__ == '__main__':
    raise SystemExit(main())
