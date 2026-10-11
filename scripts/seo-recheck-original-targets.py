"""Recheck every original failed internal URL through the guarded loopback client."""
import argparse, collections, csv, importlib.util, json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

spec = importlib.util.spec_from_file_location('candidate', Path(__file__).with_name('seo-verify-candidate.py'))
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)

def original_targets(path, expected):
    rows = list(csv.DictReader(Path(path).open(encoding='utf8', newline='')))
    selected = [row for row in rows if row['status'] != '200']
    if len(selected) != expected or len({row['urlSha256'] for row in selected}) != expected:
        raise ValueError('original_failed_target_denominator_changed')
    if any(not V.church_url(row['url']) or V.digest(row['url']) != row['urlSha256'] for row in selected):
        raise ValueError('original_target_identity_invalid')
    return selected

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('original', 'candidate', 'output', 'expected-runtime-label'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--expected-original-failures', type=int, default=975)
    args = parser.parse_args()
    rows = original_targets(args.original, args.expected_original_failures)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=False)
    client = V.LoopbackClient(args.candidate, output, timeout=30, request_limit=5000,
                              expected_label=args.expected_runtime_label)
    def check(row):
        result = client.follow(row['url'])
        return {'url': row['url'], 'urlSha256': row['urlSha256'],
                'status': result['final'].get('status'), 'inSitemap': '',
                'inlinkCount': row.get('inlinkCount', ''),
                'issues': json.dumps(result['issues'])}
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(check, rows))
    with (output / 'internal-targets.csv').open('x', encoding='utf8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=list(results[0]))
        writer.writeheader(); writer.writerows(results)
    summary = {'originalFailedTargets': len(rows), 'checkedTargets': len(results),
               'requests': client.requests, 'runtimeLabel': client.label,
               'originalCsvSha256': V.digest(Path(args.original).read_bytes()),
               'statuses': dict(collections.Counter(str(row['status']) for row in results)),
               'issueCounts': dict(collections.Counter(issue for row in results for issue in json.loads(row['issues']))),
               'finishedAt': V.stamp(), 'limits': ['Successful HTTP alone does not prove equivalent content.']}
    V.save(output / 'summary.json', summary)
    print(json.dumps(summary))

if __name__ == '__main__': main()
