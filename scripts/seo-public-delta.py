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
            try: urls[url]=[n.text for n in ET.fromstring(body).iter() if n.tag.split('}')[-1]=='loc' and n.text]
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
    old=json.loads(retained.read_text(encoding='utf-8')); delta={}
    for kind,records in fresh.items():
        before={str(r['id']):r for r in old.get(kind,[])}; after={str(r['id']):r for r in records}
        changed=[k for k in set(before)&set(after) if any(after[k].get(field)!=value for field,value in before[k].items())]
        delta[kind]={'headerTotal':totals.get(kind),'readable':len(after),'duplicateResponses':len(records)-len(after),'addedIds':sorted(set(after)-set(before)),'notExposedPreviouslyObservedIds':sorted(set(before)-set(after)),'changedRetainedFieldIds':sorted(changed),'comparedFields':sorted(set.intersection(*(set(r) for r in before.values()))) if before else [],'rawBodyChangeComparisonAvailable':False}
    sermon_urls=urls.get(ORIGIN+'/sermons-sitemap.xml',[])
    summary={'capturedAt':datetime.now(timezone.utc).isoformat(),'requestCount':len(requests),'statuses':{str(code):sum(r.get('status')==code for r in requests) for code in set(r.get('status') for r in requests)},'configuredOriginVerified':config.get('home')==ORIGIN and config.get('url')==ORIGIN,'publicSermonTypeExposed':'sermons' in config.get('routes',{}),'sitemapCounts':{key:len(value) for key,value in urls.items()},'uniqueSitemapSermonUrls':len(set(sermon_urls)),'collections':delta,'authoritativeStoredSermonCountProven':False}
    save(output/'requests.private.json',requests);save(output/'records.private.json',fresh);save(output/'sitemaps.private.json',urls);save(output/'summary.json',summary)
    print(json.dumps({**summary,'collections':{key:{field:len(value) if field.endswith('Ids') else value for field,value in item.items()} for key,item in delta.items()}}))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--retained',type=Path,required=True);args=parser.parse_args();run(args.output,args.retained)
