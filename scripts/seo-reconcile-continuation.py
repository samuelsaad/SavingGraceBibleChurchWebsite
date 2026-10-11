"""Reconcile a later source-evidence report without losing the earlier denominator."""
from __future__ import annotations
import argparse, csv, hashlib, importlib.util, json
from collections import Counter
from pathlib import Path
SPEC=importlib.util.spec_from_file_location('safe_export',Path(__file__).with_name('seo-export-acceptance.py'))
E=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(E)

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def reports(folder):
    folder=Path(folder);summary=json.loads((folder/'seo-acceptance-summary.json').read_text(encoding='utf8'))
    if summary.get('format')!='sgbc-seo-safe-acceptance-v1': raise ValueError('report_format_invalid')
    tables={}
    for name,fields in (('seo-url-migration-map.csv',E.MAP_FIELDS),('seo-content-metadata-diff.csv',E.DIFF_FIELDS)):
        with (folder/name).open(encoding='utf8',newline='') as f:
            reader=csv.DictReader(f)
            if reader.fieldnames!=list(fields):raise ValueError('unsafe_report_header')
            rows=list(reader)
        if len(rows)!=summary['inventoryCount']:raise ValueError('report_count_invalid')
        keyed={r['source_url_sha256']:r for r in rows}
        if len(keyed)!=len(rows) or any(not E.HASH.fullmatch(k) for k in keyed):raise ValueError('report_identity_invalid')
        tables[name]=keyed
    maps=tables['seo-url-migration-map.csv'];diffs=tables['seo-content-metadata-diff.csv']
    if maps.keys()!=diffs.keys() or any(maps[k]['disposition']!=diffs[k]['disposition'] for k in maps):raise ValueError('report_disposition_mismatch')
    counts=Counter(r['disposition'] for r in maps.values())
    if any(k not in E.DISPOSITIONS for k in counts) or {k:v for k,v in summary['dispositionCounts'].items() if v}!={k:v for k,v in counts.items() if v}:raise ValueError('report_disposition_count_invalid')
    return summary,tables

def reconcile(previous, continuation, proof_path, output):
    previous,continuation,proof_path,output=map(Path,(previous,continuation,proof_path,output))
    old,old_tables=reports(previous);new,new_tables=reports(continuation)
    proof=json.loads(proof_path.read_text(encoding='utf8'))
    if proof.get('format')!='sgbc-seo-finite-frontier-delta-v1' or proof.get('candidateChecksPerformed') is not False:raise ValueError('frontier_proof_invalid')
    if (new['bindings']['baselineSha256']!=proof['ledgerSha256'] or new['bindings']['assetsSha256']!=proof['assetsSha256']
            or new['bindings']['bundleSha256']!=proof['bundleSha256'] or new['inventoryCount']!=proof['deltaRows']):raise ValueError('continuation_report_binding_invalid')
    if old['bindings']['baselineSha256']!=proof['previousBaselineSha256']:raise ValueError('previous_report_binding_invalid')
    old_keys=set(old_tables['seo-url-migration-map.csv']);new_keys=set(new_tables['seo-url-migration-map.csv'])
    if len(new_keys-old_keys)!=proof['newObservedUrls'] or len(old_keys&new_keys)!=proof['laterEvidencePreviouslyObservedUrls']:raise ValueError('delta_denominator_invalid')
    if output.exists():raise ValueError('fresh_output_required')
    output.mkdir(parents=True)
    for name,fields in (('seo-url-migration-map.csv',E.MAP_FIELDS),('seo-content-metadata-diff.csv',E.DIFF_FIELDS)):
        rows={**old_tables[name],**new_tables[name]}
        if not old_keys <= rows.keys():raise ValueError('previous_denominator_lost')
        with (output/name).open('x',encoding='utf8',newline='') as f:
            writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows[k] for k in sorted(rows))
    merged={**old_tables['seo-url-migration-map.csv'],**new_tables['seo-url-migration-map.csv']}
    changes=[{'source_url_sha256':k,'previous_disposition':old_tables['seo-url-migration-map.csv'][k]['disposition'],
              'current_disposition':new_tables['seo-url-migration-map.csv'][k]['disposition'],
              'basis':'later_hash_bound_source_capture_and_fresh_candidate_http'} for k in sorted(old_keys&new_keys)]
    with (output/'seo-source-continuation-changes.csv').open('x',encoding='utf8',newline='') as f:
        fields=('source_url_sha256','previous_disposition','current_disposition','basis')
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(changes)
    value={'format':'sgbc-seo-reconciled-safe-acceptance-v1','inventoryCount':len(merged),
           'previousRows':len(old_keys),'newRows':len(new_keys-old_keys),'updatedRows':len(old_keys&new_keys),
           'dispositionCounts':{s:sum(r['disposition']==s for r in merged.values()) for s in sorted(E.DISPOSITIONS)},
           'inputs':{'previousSummarySha256':sha(previous/'seo-acceptance-summary.json'),
                    'continuationSummarySha256':sha(continuation/'seo-acceptance-summary.json'),'frontierProofSha256':sha(proof_path)},
           'outputHashes':{n:sha(output/n) for n in ('seo-url-migration-map.csv','seo-content-metadata-diff.csv','seo-source-continuation-changes.csv')},
           'originalRowsRetained':True,'verdict':'NOT_READY',
           'limits':['Earlier original and final reports remain separately retained.','Later source evidence does not prove authoritative completeness.','No automatic approvals or conversion of unresolved outcomes.']}
    (output/'seo-acceptance-reconciled-summary.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf8')
    print(json.dumps(value));return value

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('previous','continuation','proof','output'):p.add_argument('--'+name,required=True)
    a=p.parse_args();reconcile(a.previous,a.continuation,a.proof,a.output)
