import {lstat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {resolve,join} from 'node:path';
import type {SourcePublicPage} from './source-public-model';
/** Only exact current source-proven files. Recording bodies stream without reencoding. */
export function createSourcePublicAssetHandler(pages:readonly SourcePublicPage[],storageDirectory:string){
 const entries=new Map(pages.filter(p=>p.kind==='asset'&&p.asset&&p.issues.length===0).map(p=>[p.path,p])),directory=resolve(storageDirectory,'source-public');
 const verified=new Map<string,string>();
 return async(request:Request):Promise<Response|null>=>{
  const url=new URL(request.url),page=entries.get(url.pathname+url.search)??entries.get(url.pathname);if(!page)return null;
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  const asset=page.asset!,file=join(directory,asset.storageKey),stat=await lstat(file).catch(()=>null);
  if(!stat?.isFile()||stat.isSymbolicLink()||stat.size!==asset.bytes||await realpath(file)!==file)return new Response(null,{status:503,headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});
  const identity=[stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs].join(':');
  if(verified.get(file)!==identity){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);const after=await lstat(file);if(hash.digest('hex')!==asset.sha256||after.size!==stat.size||after.mtimeMs!==stat.mtimeMs||after.ctimeMs!==stat.ctimeMs)throw Error('source_asset_integrity');verified.set(file,identity);}
  const headers=new Headers({'Content-Type':asset.contentType,'Content-Length':String(asset.bytes),'Accept-Ranges':'bytes','ETag':'"'+asset.sha256+'"','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600',...((asset.emptySourceCalendar||['application/rss+xml','application/atom+xml','text/calendar'].includes(asset.contentType))?{'X-Robots-Tag':'noindex, follow'}:{}),...(['image/svg+xml','application/rss+xml','application/atom+xml'].includes(asset.contentType)?{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}:{})});
  let start=0,end=asset.bytes-1,status=200;
  const range=request.headers.get('range'),ifRange=request.headers.get('if-range');
  if(range&&(!ifRange||ifRange===headers.get('ETag'))){
   const match=/^bytes=(\d*)-(\d*)$/u.exec(range);let valid=Boolean(match&&(match[1]||match[2]));
   if(valid&&match){if(!match[1]){const suffix=Number(match[2]);valid=Number.isSafeInteger(suffix)&&suffix>0;start=Math.max(0,asset.bytes-suffix);}else{start=Number(match[1]);end=match[2]?Number(match[2]):end;valid=Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<=end;}
    valid=valid&&start<asset.bytes;end=Math.min(end,asset.bytes-1);}
   if(!valid){headers.set('Content-Range','bytes */'+asset.bytes);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
   status=206;headers.set('Content-Range','bytes '+start+'-'+end+'/'+asset.bytes);headers.set('Content-Length',String(end-start+1));
  }
  if(request.method==='HEAD'||asset.bytes===0)return new Response(null,{status,headers});
  const body=Readable.toWeb(createReadStream(file,{start,end})) as ReadableStream<Uint8Array>;
  return new Response(body,{status,headers});
 };
}
