import {describe,it,expect} from 'vitest';
import {readCmsPreviewSources} from '../src/seo/source-preview';
import {readSourcePublicPages} from '../src/seo/source-public-store';
import {sourcePageSchema,sourceVersionHash} from '../src/seo/source-public-model';
const origin='https://www.savinggrace.org.au';
const page=sourcePageSchema.parse({path:'/anonymous/',kind:'page',sourceUrl:origin+'/anonymous/',sourceId:900001,capturedAt:'2026-10-11T00:00:00Z',responseSha256:'a'.repeat(64),title:'Anonymous original',heading:'Anonymous original',description:null,indexable:true,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[],sermon:null,socialImageSource:origin+'/wp-content/uploads/anonymous.png'});
const photo=sourcePageSchema.parse({...page,path:'/wp-content/uploads/anonymous.png',sourceUrl:origin+'/wp-content/uploads/anonymous.png',kind:'asset',responseSha256:'b'.repeat(64),socialImageSource:undefined,asset:{storageKey:'b'.repeat(64)+'.png',sha256:'b'.repeat(64),contentType:'image/png',bytes:40}});
function database(){const calls:Array<{sql:string;paths:readonly string[]|undefined}>=[];return{calls,query:async(sql:string,values?:unknown[])=>{const paths=values?.[0] as readonly string[]|undefined;calls.push({sql,paths});return{rows:[page,photo].filter(p=>paths?.includes(p.path)).map(p=>({path:p.path,source_wordpress_id:p.sourceId,payload:p,version_sha256:sourceVersionHash(p)}))};}};}
describe('bounded original sources for authenticated CMS preview',()=>{
 it('loads only the selected original and verified owned social image with unchanged public exclusions',async()=>{
  const db=database(),rows=await readCmsPreviewSources(db as never,'/anonymous/',{});
  expect(rows.map(p=>p.path)).toEqual([page.path,photo.path]);expect(db.calls.map(c=>c.paths)).toEqual([[page.path],[photo.path]]);
  for(const call of db.calls){expect(call.sql).toContain('r.path=ANY($1::text[])');expect(call.sql).toContain('NOT r.withdrawn');expect(call.sql).toContain("s.status IN ('unpublished','archived')");expect(call.sql).toContain('d.old_path=r.path');}
 });
 it('uses the immutable verified original URL for a renamed source sermon and rejects foreign/GUID-shaped origins',async()=>{
  const db=database();await readCmsPreviewSources(db as never,'/sermons/renamed/',{template:'source-sermon',source:{link:origin+'/anonymous/'}});expect(db.calls[0]?.paths).toEqual(['/anonymous/']);
  for(const link of ['https://elsewhere.example/anonymous/','http://192.0.2.1/?p=1',origin+'/anonymous/#draft'])await expect(readCmsPreviewSources(db as never,'/sermons/renamed/',{template:'source-sermon',source:{link}})).rejects.toThrow('source_cms_preview_identity');
 });
 it('decodes bounded text payloads with the same complete schema and identity checks',async()=>{
  const query=async()=>({rows:[{path:page.path,source_wordpress_id:page.sourceId,payload:JSON.stringify(page),version_sha256:sourceVersionHash(page)}]});
  expect(await readSourcePublicPages({query} as never,[page.path])).toEqual([page]);
  const altered={...page,title:'Different anonymous source title'};
  await expect(readSourcePublicPages({query:async()=>({rows:[{payload:JSON.stringify(altered),version_sha256:sourceVersionHash(page)}]})} as never,[page.path])).rejects.toThrow('source_public_version_integrity');
 });
 it('rejects oversized or unsafe read scopes and verifies every selected payload hash',async()=>{
  const db=database();await expect(readSourcePublicPages(db as never,['/a/','/b/','/c/'])).rejects.toThrow('source_public_read_scope');
  await expect(readSourcePublicPages(db as never,['/admin/'])).rejects.toThrow();expect(await readSourcePublicPages(db as never,[])).toEqual([]);expect(db.calls).toEqual([]);
  await expect(readSourcePublicPages({query:async()=>({rows:[{payload:page,version_sha256:'c'.repeat(64)}]})} as never,[page.path])).rejects.toThrow('source_public_version_integrity');
 });
 it('rejects a route or WordPress identity that disagrees with its validated payload',async()=>{for(const identity of [{path:'/different/',source_wordpress_id:page.sourceId},{path:page.path,source_wordpress_id:page.sourceId!+1}])await expect(readSourcePublicPages({query:async()=>({rows:[{...identity,payload:JSON.stringify(page),version_sha256:sourceVersionHash(page)}]})}as never)).rejects.toThrow('source_public_route_integrity');});

});
