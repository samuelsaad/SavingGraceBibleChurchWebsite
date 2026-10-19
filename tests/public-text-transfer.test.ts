import {describe,it,expect}from 'vitest';
import {gunzipSync}from 'node:zlib';
import {publicTextTransfer}from '../src/server/http/public-text-transfer';
const text='<main><h1>Anonymous title</h1><p lang="ar">نص محفوظ</p>'+('original wording '.repeat(2000))+'</main>';
const request=(path='/',encoding='gzip',method='GET')=>new Request('http://127.0.0.1:4430'+path,{method,headers:{'Accept-Encoding':encoding}});
const response=(type='text/html; charset=utf-8',extra:Record<string,string>={})=>new Response(text,{headers:{'Content-Type':type,'X-SEO-Candidate':'a'.repeat(64),'Content-Length':String(Buffer.byteLength(text)),...extra}});
describe('public visitor text transfer',()=>{
 it('streams gzip with exactly the same UTF-8 content, metadata and privacy headers',async()=>{const r=publicTextTransfer(response('text/html; charset=utf-8',{'X-Robots-Tag':'noindex','Vary':'Origin'}),request());const bytes=Buffer.from(await r.arrayBuffer());expect(gunzipSync(bytes).toString('utf8')).toBe(text);expect(bytes.length).toBeLessThan(Buffer.byteLength(text)/4);expect(r.headers.get('Content-Length')).toBeNull();expect(r.headers.get('Content-Encoding')).toBe('gzip');expect(r.headers.get('Vary')).toBe('Origin, Accept-Encoding');expect(r.headers.get('X-Robots-Tag')).toBe('noindex');expect(r.headers.get('X-SEO-Candidate')).toBe('a'.repeat(64));});
 it('keeps identity requests and disabled gzip byte-identical',async()=>{for(const encoding of ['identity','br','gzip;q=0','gzip;q=0.000','gzip;q=bad']){const r=publicTextTransfer(response(),request('/',encoding));expect(r.headers.get('Content-Encoding')).toBeNull();expect(await r.text()).toBe(text);expect(r.headers.get('Vary')).toContain('Accept-Encoding');}});
 it('gives HEAD the negotiated GET headers without allocating a body',async()=>{const r=publicTextTransfer(new Response(null,{headers:{'Content-Type':'text/html','X-SEO-Candidate':'a'.repeat(64),'Content-Length':'20000'}}),request('/','gzip','HEAD'));expect(r.headers.get('Content-Encoding')).toBe('gzip');expect(r.headers.get('Content-Length')).toBeNull();expect(await r.text()).toBe('');});
 it('never compresses private, preview, form, already encoded, tagged assets or recording ranges',()=>{
  for(const path of ['/admin/cms','/api/sermons','/cms-preview/','/%61dmin/cms','/frontend-preview/']){const r=response();expect(publicTextTransfer(r,request(path))).toBe(r);}
  for(const r of [response('audio/mpeg'),response('video/mp4'),response('application/pdf'),response('text/html',{'ETag':'"original"'}),response('text/html',{'Content-Encoding':'br'}),response('text/html',{'Content-Range':'bytes 0-20/50'}),new Response(text,{headers:{'Content-Type':'text/html'}})])expect(publicTextTransfer(r,request())).toBe(r);
  const r=response();expect(publicTextTransfer(r,request('/contact/send/','gzip','POST'))).toBe(r);
 });
});
