"""Merge hash-bound safe acceptance inventories; never add prose or change dispositions."""
from pathlib import Path
import argparse,csv,json,hashlib,importlib.util,re
SPEC=importlib.util.spec_from_file_location('safe_export',Path(__file__).with_name('seo-export-acceptance.py'));EXPORT=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(EXPORT)
EXPECTED={'seo-url-migration-map.csv':list(EXPORT.MAP_FIELDS),'seo-content-metadata-diff.csv':list(EXPORT.DIFF_FIELDS)}
from collections import Counter

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def merge(directories,output):
    output=Path(output);reports=[];maps=[];diffs=[];seen=set();headers={}
    for directory in map(Path,directories):
        summary=directory/'seo-acceptance-summary.json';value=json.loads(summary.read_text(encoding='utf8'))
        if value.get('format')!='sgbc-seo-safe-acceptance-v1':raise ValueError('acceptance_format_invalid')
        reports.append({'summarySha256':sha(summary),'csvHashes':{name:sha(directory/name) for name in EXPECTED},'bindings':value['bindings'],'dispositionCounts':value['dispositionCounts'],'inventoryCount':value['inventoryCount']})
        local={}
        for name in ('seo-url-migration-map.csv','seo-content-metadata-diff.csv'):
            with (directory/name).open(encoding='utf8',newline='') as stream:
                reader=csv.DictReader(stream);fields=reader.fieldnames;rows=list(reader)
            if fields!=EXPECTED[name]:raise ValueError('acceptance_unsafe_header')
            if name in headers and headers[name]!=fields:raise ValueError('acceptance_header_mismatch')
            headers[name]=fields;local[name]=rows
        if len(local['seo-url-migration-map.csv'])!=value['inventoryCount'] or len(local['seo-content-metadata-diff.csv'])!=value['inventoryCount']:raise ValueError('acceptance_count_mismatch')
        if {r['source_url_sha256'] for r in local['seo-url-migration-map.csv']}!={r['source_url_sha256'] for r in local['seo-content-metadata-diff.csv']}:raise ValueError('acceptance_diff_identity_mismatch')
        local_counts=Counter(row['disposition'] for row in local['seo-url-migration-map.csv'])
        if {k:v for k,v in value.get('dispositionCounts',{}).items() if v}!={k:v for k,v in local_counts.items() if v}:raise ValueError('acceptance_disposition_counts_mismatch')
        diff_by_key={row['source_url_sha256']:row for row in local['seo-content-metadata-diff.csv']}
        if len(diff_by_key)!=len(local['seo-content-metadata-diff.csv']):raise ValueError('acceptance_duplicate_diff_identity')
        for row in local['seo-url-migration-map.csv']:
            key=row['source_url_sha256']
            if not re.fullmatch('[a-f0-9]{64}',key):raise ValueError('acceptance_identity_invalid')
            if diff_by_key[key]['disposition']!=row['disposition']:raise ValueError('acceptance_diff_disposition_mismatch')
            if key in seen:raise ValueError('acceptance_duplicate_identity')
            seen.add(key)
            if row['disposition'] not in ('preserved','redirected','intentionally_removed','unresolved'):raise ValueError('acceptance_disposition_invalid')
        maps+=local['seo-url-migration-map.csv'];diffs+=local['seo-content-metadata-diff.csv']
    counts=dict(Counter(row['disposition'] for row in maps));output.mkdir(parents=True,exist_ok=True)
    for name,rows in (('seo-url-migration-map.csv',maps),('seo-content-metadata-diff.csv',diffs)):
        with (output/name).open('w',encoding='utf8',newline='') as stream:
            writer=csv.DictWriter(stream,fieldnames=headers[name]);writer.writeheader();writer.writerows(sorted(rows,key=lambda r:r['source_url_sha256']))
    summary={'format':'sgbc-seo-combined-safe-acceptance-v1','inventoryCount':len(maps),'dispositionCounts':{key:counts.get(key,0) for key in ('preserved','redirected','intentionally_removed','unresolved')},'inputs':reports,'outputHashes':{name:sha(output/name) for name in headers},'verdict':'NOT_READY','limitations':['Merged dispositions remain unchanged. Source, account, restoration and staging gates are assessed separately. No cutover or ranking guarantee.']}
    (output/'seo-acceptance-combined-summary.json').write_text(json.dumps(summary,sort_keys=True,indent=2)+'\n',encoding='utf8');return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',action='append',required=True);parser.add_argument('--output',required=True);args=parser.parse_args();value=merge(args.input,args.output);print(json.dumps({'inventoryCount':value['inventoryCount'],'dispositionCounts':value['dispositionCounts']}))
if __name__=='__main__':main()
