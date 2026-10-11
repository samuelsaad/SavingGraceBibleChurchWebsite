import type {Pool,PoolClient} from 'pg';
import {expect} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {PostgresCmsRepository} from '../../src/cms/postgres-repository';
import {sourceCmsAdoption} from '../../src/seo/source-cms-adoption';
import {importSourcePublicBundle} from '../../src/seo/source-public-store';
import {sourcePageSchema} from '../../src/seo/source-public-model';
import {CompositeSourceSermonRepository} from '../../src/seo/composite-sermon-repository';
import {createSeoHttpAdapter} from '../../src/seo/http-adapter';
import {repairInheritedSourceAliases} from '../../src/seo/source-alias-repair';
export async function sourceCmsPostgresLifecycle(client:PoolClient){
 // Real PostgreSQL savepoints keep this anonymous fixture inside its outer
 // disposable-run transaction. No fake query results or application database.
 let serial=0;const stack:string[]=[];
 const connection={query:async(sql:string,values?:unknown[])=>{
  if(/^BEGIN/u.test(sql)){const key='source_cms_'+(++serial);stack.push(key);return client.query('SAVEPOINT '+key);}
  if(sql==='COMMIT'){const key=stack.pop()!;return client.query('RELEASE SAVEPOINT '+key);}
  if(sql==='ROLLBACK'){const key=stack.pop()!;await client.query('ROLLBACK TO SAVEPOINT '+key);return client.query('RELEASE SAVEPOINT '+key);}
  return client.query(sql,values);
 },release:()=>{}};
 const pool={query:(sql:string,values?:unknown[])=>client.query(sql,values),connect:async()=>connection} as unknown as Pool;
 const repo=new PostgresCmsRepository(pool),origin='https://www.savinggrace.org.au';
 const detail={id:'77777777-7777-4777-8777-777777777777',slug:'anonymous-source-editor',title:'Anonymous source heading',serviceDate:'2000-01-01',summary:null,speaker:null,series:[],books:[],scriptureReferences:[],primaryPassages:[],primaryPassageState:'unresolved',primaryMedia:null,media:[],seoDescription:null,body:null,transcript:null,questionAnswers:[],relatedSermons:[]};
 const source=sourcePageSchema.parse({path:'/sermons/anonymous-source-editor/',kind:'sermon',sourceId:919193,sourceUrl:origin+'/sermons/anonymous-source-editor/',capturedAt:'2026-01-01T00:00:00Z',responseSha256:'b'.repeat(64),title:'Anonymous original metadata',heading:detail.title,description:null,indexable:true,canonicalSource:null,publishedAt:'2000-01-01T00:00:00Z',modifiedAt:null,content:[{tag:'p',text:'Anonymous source original body'}],sermon:detail});
 await importSourcePublicBundle(client,{format:'sgbc-source-public-v1',capturedAt:'2026-01-01T00:00:00Z',inventorySha256:'b'.repeat(64),pages:[source],expectedVersions:{[source.path]:null}},'a'.repeat(40));
 const seed=sourceCmsAdoption([source],[],[]).seeds[0]!;await repo.seed([seed],'anonymous-source-migration');
 let entity=(await repo.list()).find(e=>e.key===seed.key)!;const initial=entity.draftRevisionId,actor={subject:'anonymous-source-fixture',role:'admin' as const,correlationId:'anonymous-source-http'};
 const server=createServer(async(req,res)=>{try{const snapshot=await repo.getPublishedSnapshot(),repository=await CompositeSourceSermonRepository.create([source],[],async()=>null,false,undefined,snapshot.entities),handler=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:repository});const response=await handler(new Request(origin+(req.url??'/')));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('anonymous_fixture_failure');}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw Error('anonymous_listener');const base='http://127.0.0.1:'+address.port;
 const read=async(path=source.path)=>{const response=await fetch(base+path,{redirect:'manual'});return {response,body:await response.text()};};
 try{
  expect((await read()).body).toContain('Anonymous source original body');
  entity=await repo.save(entity.id,{expectedRowVersion:entity.rowVersion,content:{...entity.draft.content,seo:{title:'Anonymous changed draft SEO'},modules:[{id:'original-content',enabled:true,block:{kind:'source-content',nodes:[{tag:'p',text:'Anonymous changed published body'}]}}]}},actor);
  expect((await read()).body).not.toContain('Anonymous changed draft SEO');entity=await repo.publish(entity.id,{expectedRowVersion:entity.rowVersion,revisionId:entity.draftRevisionId},actor);expect((await read()).body).toContain('Anonymous changed draft SEO');expect((await read()).body).toContain('Anonymous changed published body');
  entity=await repo.restore(entity.id,{expectedRowVersion:entity.rowVersion,revisionId:initial},actor);expect((await read()).body).toContain('Anonymous changed published body');entity=await repo.publish(entity.id,{expectedRowVersion:entity.rowVersion,revisionId:entity.draftRevisionId},actor);expect((await read()).body).toContain('Anonymous source original body');
  const serialized=JSON.stringify((await repo.list()).find(e=>e.id===entity.id));expect(serialized).not.toContain('approved');
 }finally{server.closeAllConnections();await new Promise<void>(done=>server.close(()=>done()));}
 const venue=sourcePageSchema.parse({...source,path:'/venue/saving-grace-bible-church/',sourceUrl:origin+'/venue/saving-grace-bible-church/',kind:'archive',sourceId:919194,sermon:null,title:'Anonymous venue metadata',heading:'Anonymous venue'});
 await importSourcePublicBundle(client,{format:'sgbc-source-public-v1',capturedAt:'2026-01-01T00:00:00Z',inventorySha256:'c'.repeat(64),pages:[venue],expectedVersions:{[venue.path]:null}},'a'.repeat(40));
 await repo.seed([{key:'anonymous-inherited-alias',kind:'page',title:'Anonymous contact',publish:true,payload:{id:'anonymous-native-contact',path:'/contact/',title:'Anonymous contact',heading:'Anonymous contact',description:'',section:'about',status:'published',modules:[],legacyPaths:[venue.path]}}]);
 let native=(await repo.list()).find(e=>e.key==='anonymous-inherited-alias')!;const nativeInitial=native.draftRevisionId;
 native=await repo.save(native.id,{expectedRowVersion:native.rowVersion,content:{...native.draft.content,description:'Anonymous unpublished native change'}},actor);
 const dry=await repairInheritedSourceAliases(pool,[venue],false);expect(dry[0]?.outcome).toBe('planned');
 const fixed=await repairInheritedSourceAliases(pool,[venue],true);expect(fixed[0]?.outcome).toBe('repaired');
 const retained=(await repo.get(native.id))!;expect(retained.draft.content.description).toBe('Anonymous unpublished native change');expect(retained.published!.content.description).toBe('');expect(retained.draft.content.legacyPaths).toEqual([]);expect((await repo.history(native.id)).some(r=>r.id===nativeInitial)).toBe(true);
 const route=(await repo.getPublishedSnapshot()).routes.find(r=>r.path===venue.path)!;expect(route.status).toBe(200);expect(route.entityId).not.toBe(native.id);
 const beforeReplay=await repo.history(route.entityId);expect((await repairInheritedSourceAliases(pool,[venue],true))[0]?.outcome).toBe('already_repaired');expect(await repo.history(route.entityId)).toEqual(beforeReplay);
}
