"""Bounded unchanged recording backup; private receipts only, resumable by hash."""
import argparse, concurrent.futures, hashlib, json, os, pathlib, threading, time, urllib.request, urllib.parse
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
AUTHORIZED_MANIFEST_SHA256='10833a17ef8adb0acde739b765340a1b677463ec6b3ec5fcf4c82e945e1b46db'
class OwnedRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,request,response,code,message,headers,newurl):
  target=urllib.parse.urlsplit(newurl)
  if target.scheme!='https' or target.hostname not in ('www.savinggrace.org.au','savinggrace.org.au') or target.username or target.password or target.port or not target.path.startswith('/wp-content/uploads/'):raise ValueError('recording_redirect_scope')
  return super().redirect_request(request,response,code,message,headers,newurl)
def main():
 p=argparse.ArgumentParser();p.add_argument('--inventory',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 root=pathlib.Path(a.output).resolve();root.mkdir(parents=True,exist_ok=True)
 source=pathlib.Path(a.inventory).read_bytes();rows=[r for r in json.loads(source)['rows'] if r.get('extension') in ('.mp3','.mp4')]
 if len(rows)!=118 or sum(r['extension']=='.mp3' for r in rows)!=117 or len({r['sourceUrl'] for r in rows})!=118:raise ValueError('recording_scope_mismatch')
 for r in rows:
  u=urllib.parse.urlsplit(r['sourceUrl'])
  if u.scheme!='https' or u.hostname not in ('www.savinggrace.org.au','savinggrace.org.au') or not u.path.startswith('/wp-content/uploads/') or u.query or u.fragment or u.username or u.password or u.port:raise ValueError('recording_source_refused')
 manifest={'format':'sgbc-original-recording-backup-v1','inventorySha256':hashlib.sha256(source).hexdigest(),'rows':[{'wordpressId':r['wordpressId'],'url':r['sourceUrl'],'extension':r['extension']} for r in rows]}
 raw=json.dumps(manifest,sort_keys=True,ensure_ascii=False).encode();
 if hashlib.sha256(raw).hexdigest()!=AUTHORIZED_MANIFEST_SHA256:raise ValueError('recording_authorized_manifest_mismatch')
 manifestPath=root/'manifest.private.json'
 if manifestPath.exists() and manifestPath.read_bytes()!=raw:raise ValueError('recording_manifest_conflict')
 manifestPath.write_bytes(raw);opener=urllib.request.build_opener(OwnedRedirect);lock=threading.Lock();nextStart=[0];total=[0];receipts=[]
 def fetch(r):
  key=hashlib.sha256(r['sourceUrl'].encode()).hexdigest();receipt=root/(key+'.private.json')
  if receipt.exists():
   old=json.loads(receipt.read_bytes());file=root/old['file']
   if old.get('outcome')=='verified' and file.is_file() and file.stat().st_size==old['bytes'] and digest(file)==old['sha256']:return old
   raise ValueError('recording_retained_backup_conflict')
  result={'wordpressId':r['wordpressId'],'sourceUrl':r['sourceUrl'],'capturedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
  temporary=root/(key+'.partial')
  try:
   with lock:
    delay=max(0,nextStart[0]-time.monotonic());time.sleep(delay);nextStart[0]=time.monotonic()+1
   request=urllib.request.Request(r['sourceUrl'],headers={'User-Agent':'SGBC-authorized-migration-backup/1.0','Accept-Encoding':'identity'})
   with opener.open(request,timeout=90) as response:
    u=urllib.parse.urlsplit(response.url);mime=response.headers.get_content_type();expected='audio/mpeg' if r['extension']=='.mp3' else 'video/mp4'
    if response.status!=200 or u.hostname not in ('www.savinggrace.org.au','savinggrace.org.au') or mime!=expected:raise ValueError('recording_response_identity')
    h=hashlib.sha256();size=0;head=b''
    with temporary.open('xb') as f:
     while True:
      chunk=response.read(1048576)
      if not chunk:break
      if not head:head=chunk[:16]
      size+=len(chunk)
      with lock:
       total[0]+=len(chunk)
       if size>2147483648 or total[0]>21474836480:raise ValueError('recording_byte_budget')
      h.update(chunk);f.write(chunk)
    declared=response.headers.get('Content-Length')
    if size==0 or declared and int(declared)!=size:raise ValueError('recording_length_mismatch')
    if r['extension']=='.mp4' and head[4:8]!=b'ftyp' or r['extension']=='.mp3' and not(head.startswith(b'ID3') or len(head)>1 and head[0]==255 and head[1]&224==224):raise ValueError('recording_magic_mismatch')
    name=h.hexdigest()+r['extension'];destination=root/name
    if destination.exists():
     if digest(destination)!=h.hexdigest():raise ValueError('recording_destination_conflict')
     temporary.unlink()
    else:temporary.rename(destination)
    result.update(outcome='verified',sha256=h.hexdigest(),bytes=size,contentType=mime,file=name,finalUrl=response.url)
   with destination.open('rb') as f:first=f.read(min(1024,size))
   rr=urllib.request.Request(r['sourceUrl'],headers={'Range':'bytes=0-'+str(len(first)-1),'Accept-Encoding':'identity','User-Agent':'SGBC-authorized-migration-backup/1.0'})
   with lock:
    time.sleep(max(0,nextStart[0]-time.monotonic()));nextStart[0]=time.monotonic()+1
   with opener.open(rr,timeout=90) as response:
    result['sourceRangeVerified']=response.status==206 and response.read(len(first)+1)==first and response.headers.get('Content-Range')=='bytes 0-'+str(len(first)-1)+'/'+str(size)
   receipt.write_text(json.dumps(result),encoding='utf8')
   return result
  except Exception as error:
   # No source/transport secrets in ordinary output.
   if temporary.exists():temporary.unlink()
   result.update(outcome='failed',errorType=type(error).__name__);receipt.write_text(json.dumps(result),encoding='utf8');return result
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for result in pool.map(fetch,rows):
   receipts.append(result)
   if len(receipts)%10==0:print(json.dumps({'completed':len(receipts),'verified':sum(r.get('outcome')=='verified' for r in receipts)}),flush=True)
 result={'format':'sgbc-original-recording-backup-result-v1','manifestSha256':hashlib.sha256(raw).hexdigest(),'rows':receipts}
 (root/'results.private.json').write_text(json.dumps(result),encoding='utf8')
 print(json.dumps({'completed':len(receipts),'verified':sum(r.get('outcome')=='verified' for r in receipts),'rangeVerified':sum(r.get('sourceRangeVerified',False) for r in receipts),'bytes':sum(r.get('bytes',0) for r in receipts)}))
if __name__=='__main__':main()

