import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {sourcePageSchema,sha256} from '../src/seo/source-public-model';
import {createSourcePublicAssetHandler} from '../src/seo/source-public-assets';
it('serves identical recording bytes, seeks, suffixes, conditional ranges, HEAD and genuine 416',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sgbc-anonymous-recording-'));if(!root.startsWith(join(tmpdir(),'sgbc-anonymous-recording-')))throw Error('fixture_scope');
 try{await mkdir(join(root,'source-public'));const bytes=Buffer.from('ID3anonymous unchanged recording bytes'),hash=sha256(bytes),file=hash+'.mp3';await writeFile(join(root,'source-public',file),bytes);
 const page=sourcePageSchema.parse({path:'/wp-content/uploads/anonymous.mp3',kind:'asset',sourceUrl:'https://www.savinggrace.org.au/wp-content/uploads/anonymous.mp3',sourceId:1,capturedAt:'2026-10-19T00:00:00Z',responseSha256:hash,title:'Anonymous recording',heading:'Anonymous recording',description:null,indexable:false,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[],sermon:null,asset:{storageKey:file,sha256:hash,contentType:'audio/mpeg',bytes:bytes.length}});
 const handler=createSourcePublicAssetHandler([page],root),request=(range?:string,method='GET',ifRange?:string)=>new Request(page.sourceUrl,{method,headers:{...(range?{Range:range}:{}),...(ifRange?{'If-Range':ifRange}:{})}});
 let r=(await handler(request()))!;expect(r.status).toBe(200);expect(Buffer.from(await r.arrayBuffer())).toEqual(bytes);expect(r.headers.get('Content-Type')).toBe('audio/mpeg');
 for(const [range,start,end]of [['bytes=0-3',0,4],['bytes=4-',4,bytes.length],['bytes=-5',bytes.length-5,bytes.length]] as const){r=(await handler(request(range)))!;expect(r.status).toBe(206);expect(Buffer.from(await r.arrayBuffer())).toEqual(bytes.subarray(start,end));}
 for(const range of ['bytes=999-','bytes=5-2','bytes=0-1,3-4','bytes=-0'])expect((await handler(request(range)))!.status).toBe(416);
 r=(await handler(request('bytes=0-3','HEAD')))!;expect(r.status).toBe(206);expect(await r.text()).toBe('');expect(r.headers.get('Content-Length')).toBe('4');
 r=(await handler(request('bytes=0-3','GET','"stale"')))!;expect(r.status).toBe(200);expect(Buffer.from(await r.arrayBuffer())).toEqual(bytes);
 await writeFile(join(root,'source-public',file),Buffer.from('X'.repeat(bytes.length)));await expect(handler(request())).rejects.toThrow('source_asset_integrity');
 }finally{await rm(root,{recursive:true,force:false});}
});
