"""Preserve the original URL denominator; account for exact issue dispositions."""
import argparse, collections, csv, hashlib, io, json
from pathlib import Path

CATEGORIES = ('metadata_change_requires_review', 'source_semantic_blocks_missing',
              'source_content_image_or_alt_missing', 'source_capture_pending_or_missing',
              'source_indexability_lost', 'previous_200_not_preserved',
              'non_html_mime_changed', 'non_html_source_bytes_changed_requires_review')

def load(path):
    raw = Path(path).read_bytes()
    rows = list(csv.DictReader(io.StringIO(raw.decode('utf8'),newline='')))
    keyed = {r['source_url_sha256']: r for r in rows}
    if len(keyed) != len(rows) or any(len(k) != 64 or any(c not in '0123456789abcdef' for c in k) for k in keyed):
        raise ValueError('duplicate_or_invalid_url_hash')
    return keyed, hashlib.sha256(raw).hexdigest()

def issues(row, field):
    value = json.loads(row.get(field) or '[]')
    if not isinstance(value,list) or any(not isinstance(v,str) for v in value):
        raise ValueError('issue_list_invalid')
    return set(value)

def account(original, candidate, expected=15252, original_field='unreviewed_issue_codes'):
    if len(original) != expected: raise ValueError('original_denominator_changed')
    missing = original.keys() - candidate.keys()
    if missing: raise ValueError('original_urls_missing_from_candidate_report')
    summary, details = {}, []
    for category in CATEGORIES:
        counts = collections.Counter()
        for key, old in original.items():
            if category not in issues(old,original_field): continue
            current = candidate[key]
            raw, reviewed = issues(current,'raw_verification_issues'), issues(current,'reviewed_issue_codes')
            status = 'fixed' if category not in raw else 'reclassified' if category in reviewed else 'remaining'
            counts[status] += 1
            details.append({'source_url_sha256':key,'category':category,'status':status,
                            'source_type':old.get('source_type',''),
                            'source_wordpress_id':old.get('source_wordpress_id',''),
                            'current_disposition':current['disposition']})
        summary[category] = {'original':sum(counts.values()), **{s:counts[s] for s in ('fixed','reclassified','remaining')}}
    return {'originalRows':len(original),'originalDistinctUrls':len(original),
            'candidateRows':len(candidate),'newInventoryRows':len(candidate)-len(original),
            'originalRowsByType':dict(collections.Counter(r.get('source_type','') for r in original.values())),
            'originalRowsByRouteFamily':dict(collections.Counter(r.get('source_route_family','') for r in original.values())),
            'originalRecordedIdentityPairs':len({(r.get('source_type'),r['source_wordpress_id']) for r in original.values() if r.get('source_wordpress_id')}),
            'originalCohortCurrentDispositions':dict(collections.Counter(candidate[k]['disposition'] for k in original)),
            'originalCategoryBasis':original_field,
            'originalRawCategoryCounts':{code:sum(code in issues(r,'raw_verification_issues') for r in original.values()) for code in CATEGORIES},
            'categories':summary,'limits':['Issue categories overlap; do not add their counts.','Recorded identity pairs are not proof of complete WordPress stored-row coverage.','Internal-target URL failures need separate target-level accounting.']}, details

def internal_account(original_path,candidate_path,mapping):
    def targets(path):
        raw=Path(path).read_bytes();rows=list(csv.DictReader(io.StringIO(raw.decode('utf8'),newline='')))
        result={r['urlSha256']:r for r in rows}
        if len(result)!=len(rows):raise ValueError('duplicate_internal_target')
        return result,hashlib.sha256(raw).hexdigest()
    original,oh=targets(original_path);candidate,ch=targets(candidate_path)
    failures={k:r for k,r in original.items() if r['status']!='200'};counts=collections.Counter();remaining=[]
    for key,old in failures.items():
        current=candidate.get(key);disposition=mapping.get(key,{})
        if current and current['status']=='200':counts['fixed']+=1
        elif current and current['status'] in ('404','410') and disposition.get('disposition')=='intentionally_removed':counts['reclassified']+=1
        else:counts['remaining']+=1;remaining.append({'urlSha256':key,'originalStatus':old['status'],'currentStatus':current['status'] if current else None,'reason':'not_in_final_discovery_requires_direct_verification' if not current else 'non_200_without_accepted_disposition'})
    return {'originalNon200Targets':len(failures),**{s:counts[s] for s in ('fixed','reclassified','remaining')},'originalCsvSha256':oh,'candidateCsvSha256':ch,'remainingTargets':remaining,'limits':['A changed discovery set never makes an untested original target pass.','Redirects are followed by the target verifier; 200 here means its successful final response.']}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ('original','candidate','output'):parser.add_argument('--'+name,required=True)
    parser.add_argument('--details');parser.add_argument('--expected-original-rows',type=int,default=15252)
    parser.add_argument('--original-internal-targets');parser.add_argument('--candidate-internal-targets')
    args=parser.parse_args();original,oh=load(args.original);candidate,ch=load(args.candidate)
    result,details=account(original,candidate,args.expected_original_rows)
    if bool(args.original_internal_targets)!=bool(args.candidate_internal_targets):raise ValueError('both_internal_target_reports_required')
    if args.original_internal_targets:result['originalInternalTargets']=internal_account(args.original_internal_targets,args.candidate_internal_targets,candidate)
    result.update(format='sgbc-seo-original-cohort-accounting-v1',originalCsvSha256=oh,candidateCsvSha256=ch)
    with Path(args.output).open('x',encoding='utf8') as f:json.dump(result,f,indent=2);f.write('\n')
    if args.details:
        with Path(args.details).open('x',encoding='utf8',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=list(details[0]) if details else ['source_url_sha256','category','status']);writer.writeheader();writer.writerows(details)
    print(json.dumps({'originalRows':len(original),'candidateRows':len(candidate),'categories':result['categories']}))
if __name__=='__main__':main()
