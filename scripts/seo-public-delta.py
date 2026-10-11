"""Bounded read-only public inventory refresh. No recording bodies or account APIs."""
import argparse, hashlib, json, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError

ORIGIN = 'https://www.savinggrace.org.au'
def sha(value): return hashlib.sha256(value).hexdigest()
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None
def save(path, value):
    with path.open('x', encoding='utf-8') as file: json.dump(value,file,ensure_ascii=False,indent=2)
def compare_records(old, fresh, totals):
    delta={}
    for kind,records in fresh.items():
        before={str(r['id']):r for r in old.get(kind,[])};after={str(r['id']):r for r in records}
        changed=[k for k in set(before)&set(after) if any(after[k].get(field)!=value for field,value in before[k].items())]
        delta[kind]={'headerTotal':totals.get(kind),'readable':len(after),'duplicateResponses':len(records)-len(after),'addedIds':sorted(set(after)-set(before)),'notExposedPreviouslyObservedIds':sorted(set(before)-set(after)),'changedRetainedFieldIds':sorted(changed),'comparedFields':sorted(set.intersection(*(set(r) for r in before.values()))) if before else [],'rawBodyChangeComparisonAvailable':False}
    return delta
def reconcile_capture(capture, retained, output):
    """Correct old comparison shape without another source request or overwrite."""
    if 'private' not in capture.resolve().parts or 'private' not in output.resolve().parts or output.exists():raise ValueError('private_nonoverwriting_output_required')
    requests=json.loads((capture/'requests.private.json').read_text(encoding='utf-8'));fresh={};totals={};sitemaps={}
    for request in requests:
        if request.get('status')!=200:continue
        path=request['path'];body=(capture/(sha(path.encode())+'.body')).read_bytes()
        if sha(body)!=request['sha256']:raise ValueError('capture_witness_changed')
        if path.startswith('/wp-json/wp/v2/'):
            kind=path.split('/')[4].split('?')[0];fresh.setdefault(kind,[]).extend(json.loads(body));totals[kind]=int(request['headers'].get('x-wp-total','0'))
        elif path.endswith('.xml') and path!='/sitemap.xml':
            sitemaps[ORIGIN+path]=[child.text for node in ET.fromstring(body) if node.tag.split('}')[-1]=='url' for child in node if child.tag.split('}')[-1]=='loc' and child.text]
    result={'format':'sgbc-source-public-delta-reconciliation-v1','reconciledAt':datetime.now(timezone.utc).isoformat(),'captureStart':requests[0].get('capturedAt'),'captureEnd':requests[-1].get('capturedAt'),'requestsSha256':sha((capture/'requests.private.json').read_bytes()),'retainedRecordsSha256':sha(retained.read_bytes()),'originalSummaryRetained':True,'newSourceRequests':0,'successfulWitnessesVerified':sum(r.get('status')==200 for r in requests),'collections':compare_records(json.loads(retained.read_text(encoding='utf-8')),fresh,totals),'sitemapPageCounts':{key:len(set(value)) for key,value in sitemaps.items()},'sermonSitemapUrls':sorted(set(sitemaps.get(ORIGIN+'/sermons-sitemap.xml',[]))),'authoritativeStoredSermonCountProven':False}
    save(output,result);print(json.dumps({'outcome':'captured_source_delta_reconciled','newSourceRequests':0,'successfulWitnessesVerified':result['successfulWitnessesVerified'],'sermonSitemapUrlCount':len(result['sermonSitemapUrls']),'collections':{kind:{key:len(value) if key.endswith('Ids') else value for key,value in item.items()} for kind,item in result['collections'].items()}}))
def run(output, retained):
    if 'private' not in output.resolve().parts or output.exists(): raise ValueError('fresh_private_output_required')
    output.mkdir(parents=True); opener=build_opener(NoRedirect); requests=[]; last=0
    def get(path):
        nonlocal last
        if not path.startswith('/') or path.startswith('//') or any(x in path for x in ('preview','_wpnonce','admin')): raise ValueError('public_path_refused')
        time.sleep(max(0,1-(time.monotonic()-last)));last=time.monotonic()
        try:
            try: response=opener.open(Request(ORIGIN+path,headers={'User-Agent':'SGBC read-only SEO reconciliation','Accept-Encoding':'identity'}),timeout=25)
            except HTTPError as error: response=error
            with response:
                body=response.read(4000001)
                if len(body)>4000000: raise ValueError('body_limit')
                record={'path':path,'status':response.status,'capturedAt':datetime.now(timezone.utc).isoformat(),'sha256':sha(body),'headers':{k.lower():v for k,v in response.headers.items() if k.lower() in ('content-type','x-wp-total','x-wp-totalpages','location','etag','last-modified')}}
                requests.append(record);(output/(sha(path.encode())+'.body')).write_bytes(body)
                return record,body
        except Exception as error:
            requests.append({'path':path,'errorClass':type(error).__name__});return {'status':0},b''
    index,body=get('/wp-json/'); config=json.loads(body) if index['status']==200 else {}
    root,body=get('/sitemap.xml'); sitemaps=[]
    if root['status']==200:
        sitemaps=[n.text for n in ET.fromstring(body).iter() if n.tag.split('}')[-1]=='loc' and n.text and n.text.startswith(ORIGIN+'/')]
    urls={};
    for url in sitemaps[:25]:
        record,body=get(url[len(ORIGIN):])
        if record['status']==200:
            try: urls[url]=[child.text for node in ET.fromstring(body) if node.tag.split('}')[-1]=='url' for child in node if child.tag.split('}')[-1]=='loc' and child.text]
            except ET.ParseError: pass
    fresh={}; totals={}
    for kind in ('pages','posts','tribe_events','tribe_venue','tribe_organizer','media'):
        records=[]; pages=1
        for page in range(1,26):
            if page>pages: break
            record,body=get('/wp-json/wp/v2/'+kind+'?per_page=100&page='+str(page))
            if record['status']!=200: break
            values=json.loads(body)
            if not isinstance(values,list): break
            records.extend(values);pages=int(record['headers'].get('x-wp-totalpages','1')); totals[kind]=int(record['headers'].get('x-wp-total','0'))
        fresh[kind]=records
    delta=compare_records(json.loads(retained.read_text(encoding='utf-8')),fresh,totals)
    sermon_urls=urls.get(ORIGIN+'/sermons-sitemap.xml',[])
    summary={'capturedAt':datetime.now(timezone.utc).isoformat(),'requestCount':len(requests),'statuses':{str(code):sum(r.get('status')==code for r in requests) for code in set(r.get('status') for r in requests)},'configuredOriginVerified':config.get('home')==ORIGIN and config.get('url')==ORIGIN,'publicSermonTypeExposed':'sermons' in config.get('routes',{}),'sitemapCounts':{key:len(value) for key,value in urls.items()},'uniqueSitemapSermonUrls':len(set(sermon_urls)),'collections':delta,'authoritativeStoredSermonCountProven':False}
    save(output/'requests.private.json',requests);save(output/'records.private.json',fresh);save(output/'sitemaps.private.json',urls);save(output/'summary.json',summary)
    print(json.dumps({**summary,'collections':{key:{field:len(value) if field.endswith('Ids') else value for field,value in item.items()} for key,item in delta.items()}}))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--retained',type=Path,required=True);parser.add_argument('--reconcile-capture',type=Path);args=parser.parse_args()
    if args.reconcile_capture:reconcile_capture(args.reconcile_capture,args.retained,args.output)
    else:run(args.output,args.retained)
