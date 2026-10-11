"""Read only the three retained public font/archive downloads; never recordings.

Opaque archives/fonts are inspected for identity and unsafe structure, never
installed, extracted or executed. Inputs and response bytes stay private.
"""
import argparse,hashlib,io,json,re,struct,time,zipfile
from datetime import datetime,timezone
from pathlib import Path,PurePosixPath
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
ORIGIN='https://www.savinggrace.org.au'
SCOPE={27323:('/wp-content/uploads/2023/10/icomoon-v1.0.zip','application/zip'),27322:('/wp-content/uploads/2023/10/icomoon.zip','application/zip'),2247:('/wp-content/uploads/2020/01/Merriweather-Regular.otf','application/x-font-otf')}
def sha(value):return hashlib.sha256(value).hexdigest()
def validate(data,mime):
    if mime=='application/zip':
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                infos=archive.infolist()
                if not infos or len(infos)>10000 or len(set(i.filename for i in infos))!=len(infos):raise ValueError('archive_structure')
                for item in infos:
                    raw_name=item.orig_filename;path=PurePosixPath(raw_name)
                    if path.is_absolute() or '..' in path.parts or chr(92) in raw_name or re.match(r'^[A-Za-z]:',raw_name) or any(ord(c)<32 for c in raw_name) or item.flag_bits&1 or (item.external_attr>>16)&0o170000==0o120000 or item.file_size>50000000 or item.file_size>max(1,item.compress_size)*1000:raise ValueError('archive_unsafe_structure')
                    if re.search(r'(?:^|/)(?:wp-config|\.env|id_rsa|credentials|secrets)(?:\.|$)',item.filename,re.I) or path.suffix.lower() in ('.php','.exe','.dll','.ps1','.bat','.sh'):raise ValueError('archive_private_or_executable_member')
                if sum(item.file_size for item in infos)>100000000 or archive.testzip() is not None:raise ValueError('archive_integrity')
                return {'valid':True,'detectedType':mime,'members':len(infos),'uncompressedBytes':sum(i.file_size for i in infos),'memberNamesSha256':sha('\n'.join(sorted(i.filename for i in infos)).encode()),'extracted':False,'executed':False}
        except zipfile.BadZipFile:raise ValueError('archive_invalid')
    if mime=='application/x-font-otf':
        if len(data)<12 or data[:4]!=b'OTTO':raise ValueError('font_header')
        count=struct.unpack('>H',data[4:6])[0]
        if not 1<=count<=128 or len(data)<12+16*count:raise ValueError('font_table_directory')
        tags=set()
        for i in range(count):
            tag,checksum,offset,length=struct.unpack('>4sIII',data[12+16*i:28+16*i]);tags.add(tag)
            if offset+length>len(data):raise ValueError('font_table_bounds')
        if not {b'head',b'cmap',b'name'}.issubset(tags):raise ValueError('font_required_tables')
        return {'valid':True,'detectedType':mime,'tableCount':count,'installed':False,'executed':False}
    raise ValueError('type_outside_scope')
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
def run(records,output,only_id=None):
    if 'private' not in output.resolve().parts or output.exists():raise ValueError('fresh_private_output_required')
    if only_id is not None and only_id not in SCOPE:raise ValueError('identity_outside_scope')
    scope={only_id:SCOPE[only_id]} if only_id is not None else SCOPE
    source=json.loads(records.read_text(encoding='utf-8'));media={r['id']:r for r in source['media']}
    for identity,(path,mime) in scope.items():
        if media.get(identity,{}).get('source_url')!=ORIGIN+path or media[identity].get('mime_type')!=mime:raise ValueError('source_identity_scope')
    output.mkdir(parents=True);opener=build_opener(NoRedirect);results={};last=0
    for identity,(path,mime) in scope.items():
        url=ORIGIN+path;record={'url':url,'sourceId':identity,'capturedAt':datetime.now(timezone.utc).isoformat(),'mime':mime,'recordingBodyRequested':False}
        for attempt in range(3):
            time.sleep(max(0,1-(time.monotonic()-last)));last=time.monotonic()
            try:
                try:response=opener.open(Request(url,headers={'User-Agent':'SGBC church-authorized read-only resource reconciliation','Accept-Encoding':'identity'}),timeout=25)
                except HTTPError as error:response=error
                with response:
                    record.update({'status':response.status,'attempts':attempt+1,'sourceMime':response.headers.get('content-type','')})
                    if response.status in (429,502,503,504) and attempt<2:
                        pause=response.headers.get('retry-after','');time.sleep(min(300,max(2,int(pause))) if pause.isdigit() else 120);continue
                    if response.status!=200:break
                    data=response.read(50000001)
                    actual=response.headers.get('content-type','').split(';')[0].lower()
                    allowed={mime,'font/otf','application/octet-stream'} if identity==2247 else {mime}
                    if not 0<len(data)<=50000000 or actual not in allowed:raise ValueError('resource_size_or_type')
                    record['validation']=validate(data,mime);key=sha(data)+Path(path).suffix
                    (output/key).write_bytes(data);record.update({'mime':actual,'sha256':sha(data),'byteCount':len(data),'relativePath':key});break
            except (URLError,TimeoutError,OSError):
                if attempt==2:record['error']='request_failed'
            except ValueError as error:record['validation']={'valid':False,'reason':str(error)};break
        results[url]=record
    manifest={'format':'sgbc-original-download-reconciliation-v1','sourceRecordsSha256':sha(records.read_bytes()),'assets':results,'scopeIds':sorted(scope),'completedAt':datetime.now(timezone.utc).isoformat()}
    (output/'manifest.private.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps({'scope':len(scope),'captured':sum(r.get('validation',{}).get('valid',False) for r in results.values()),'recordingBodiesRequested':0,'statuses':{str(r.get('status')):sum(v.get('status')==r.get('status') for v in results.values()) for r in results.values()}}))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--records',required=True,type=Path);parser.add_argument('--output',required=True,type=Path);parser.add_argument('--only-id',type=int,choices=tuple(SCOPE));args=parser.parse_args();run(args.records,args.output,args.only_id)
