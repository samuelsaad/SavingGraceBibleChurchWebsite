import type {Pool} from 'pg';
import {expect,it} from 'vitest';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';
import {completedSchemaMigrations,verifyCompletedSchema} from '../src/staging/completed-schema';
import {loadAcceptedSemanticMigration,verifyAcceptedSemanticSchema} from '../src/semantic/accepted-semantic-migration';
import {applyCmsMigration,loadCmsMigration,verifyCmsSchema} from '../src/cms/migration';
import {PostgresCmsRepository} from '../src/cms/postgres-repository';
import type {CmsAuditActor,CmsDocument} from '../src/cms/model';
import {verifyCmsSeoHttpLifecycle} from './helpers/cms-seo-http-lifecycle';
const actor:CmsAuditActor={subject:'anonymous-cms-integration',role:'admin',correlationId:'anonymous-cms-integration'};
function guard(){assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);}
function content(title='Anonymous CMS fixture',path='/anonymous-cms-fixture/'):CmsDocument{return{id:'anonymous-cms-fixture',path,title,description:'Anonymous website editing fixture; no real sermon content.',section:'about',modules:[{id:'text-1',enabled:true,block:{kind:'paragraph',text:'Anonymous original wording.'}}]};}
export function registerCmsPostgresTests(getPool:()=>Pool){
 it('CMS migration applies, independently rolls back, and cleanly reapplies with immutable history constraints',async()=>{
  guard();const pool=getPool(),migration=await loadCmsMigration();
  try{await pool.query(migration.upBody);expect((await pool.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_name IN('cms_entities','cms_revisions','cms_routes')")).rows[0].n).toBe(3);await pool.query(migration.downBody);expect((await pool.query("SELECT to_regclass('cms_entities') missing")).rows[0].missing).toBeNull();await pool.query(migration.upBody);expect((await pool.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='cms_revisions_immutable'")).rows[0].n).toBe(1);expect((await pool.query("SELECT count(*)::int n FROM pg_indexes WHERE indexname IN('cms_one_canonical_route','cms_singleton_kinds','cms_revisions_history_idx')")).rows[0].n).toBe(3);}finally{await pool.query(migration.downBody);}
 });
 it('CMS preserves published content, detects competing edits, restores to draft, migrates idempotently and keeps direct SEO routes',async()=>{
  guard();const pool=getPool(),suffix=[...(await completedSchemaMigrations()).slice(22),await loadAcceptedSemanticMigration()],migration=await loadCmsMigration();
  const before=(await pool.query('SELECT count(*)::int n,sum(row_version)::text versions FROM sermons')).rows;
  try{
   for(const item of suffix){await pool.query(item.upBody);await pool.query('INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256)VALUES($1,$2,$3)',[item.order,item.id,item.checksumSha256]);}
   const client=await pool.connect();try{await client.query('BEGIN');expect(await applyCmsMigration(client)).toBe('applied');expect(await applyCmsMigration(client)).toBe('unchanged');await client.query('COMMIT');}finally{client.release();}
   expect(await verifyCmsSchema(pool)).toBe(27);expect(await verifyCompletedSchema(pool)).toBe(27);expect(await verifyAcceptedSemanticSchema(pool)).toBe(27);
   const repository=new PostgresCmsRepository(pool);const seeds=[{key:'page:anonymous-cms-fixture',kind:'page' as const,title:'Anonymous CMS fixture',payload:content(),publish:true}];
   expect(await repository.seed(seeds)).toEqual({inserted:1,unchanged:0});let entity=(await repository.list())[0]!;const original=entity.publishedRevisionId!;
   const contenders=await Promise.allSettled([repository.save(entity.id,{expectedRowVersion:entity.rowVersion,content:content('Anonymous competing edit A')},actor),repository.save(entity.id,{expectedRowVersion:entity.rowVersion,content:content('Anonymous competing edit B')},actor)]);
   expect(contenders.filter(item=>item.status==='fulfilled')).toHaveLength(1);expect(contenders.filter(item=>item.status==='rejected')).toHaveLength(1);
   entity=(await repository.get(entity.id))!;expect(entity.rowVersion).toBe(2);expect(entity.published?.content.title).toBe('Anonymous CMS fixture');expect((await repository.getPublishedSnapshot()).entities[0]?.revisionId).toBe(original);
   expect((await repository.getPreviewSnapshot({entityId:entity.id})).entities[0]?.revisionId).toBe(entity.draftRevisionId);
   await expect(repository.publish(entity.id,{expectedRowVersion:entity.rowVersion,revisionId:original},actor)).rejects.toMatchObject({code:'stale_write'});
   entity=await repository.publish(entity.id,{expectedRowVersion:entity.rowVersion,revisionId:entity.draftRevisionId},actor);
   const published=entity.publishedRevisionId;entity=await repository.restore(entity.id,{expectedRowVersion:entity.rowVersion,revisionId:original},actor);expect(entity.publishedRevisionId).toBe(published);expect(entity.draft.content.title).toBe('Anonymous CMS fixture');expect(entity.draft.sourceRevisionId).toBe(original);
   expect(await repository.seed(seeds)).toEqual({inserted:0,unchanged:1});expect((await repository.get(entity.id))!.rowVersion).toBe(entity.rowVersion);
   entity=await repository.save(entity.id,{expectedRowVersion:entity.rowVersion,content:content('Anonymous renamed fixture','/anonymous-new-address/')},actor);entity=await repository.publish(entity.id,{expectedRowVersion:entity.rowVersion,revisionId:entity.draftRevisionId},actor);
   expect((await repository.getPublishedSnapshot()).routes).toEqual(expect.arrayContaining([{path:'/anonymous-cms-fixture/',entityId:entity.id,status:301,targetPath:'/anonymous-new-address/'},{path:'/anonymous-new-address/',entityId:entity.id,status:200,targetPath:null}]));
   await expect(repository.create({key:'page:conflicting',kind:'page',content:{...content('Conflicting address','/anonymous-new-address/'),id:'anonymous-conflict'}},actor)).rejects.toMatchObject({code:'path_in_use'});
   await expect(pool.query('UPDATE cms_revisions SET content=content WHERE entity_id=$1',[entity.id])).rejects.toThrow('immutable');
   await expect(pool.query(migration.downBody)).rejects.toThrow('refuses existing content');
   entity=await repository.unpublish(entity.id,{expectedRowVersion:entity.rowVersion,disposition:'gone'},actor);expect((await repository.getPublishedSnapshot()).entities).toHaveLength(0);expect((await repository.getPublishedSnapshot()).routes.every(route=>route.status===410)).toBe(true);
   expect((await repository.history(entity.id)).length).toBe(4);expect((await pool.query("SELECT count(*)::int n FROM audit_events WHERE entity_type='cms_entity'")).rows[0].n).toBe(7);
   const other=await repository.create({key:'page:second-fixture',kind:'page',content:{...content('Second fixture','/anonymous-second/'),id:'anonymous-second'}},actor);await expect(repository.restore(other.id,{expectedRowVersion:other.rowVersion,revisionId:original},actor)).rejects.toMatchObject({code:'not_found'});
   const draftLink=await repository.create({key:'page:unpublished-reference',kind:'page',content:{...content('Unpublished reference','/anonymous-reference/'),id:'anonymous-reference'}},actor);
   let linking=await repository.create({key:'page:linking',kind:'page',content:{...content('Linking fixture','/anonymous-linking/'),id:'anonymous-linking',modules:[{id:'link',enabled:true,block:{kind:'paragraph',text:'[Draft page](/anonymous-reference/)'}}]}},actor);
   await expect(repository.publish(linking.id,{expectedRowVersion:linking.rowVersion,revisionId:linking.draftRevisionId},actor)).rejects.toMatchObject({code:'unpublished_link'});
   const alias=await repository.create({key:'page:alias-conflict',kind:'page',content:{...content('Anonymous alias conflict','/anonymous-alias/'),id:'anonymous-alias',legacyPaths:['/anonymous-reference/']}},actor);
   await expect(repository.publish(alias.id,{expectedRowVersion:alias.rowVersion,revisionId:alias.draftRevisionId},actor)).rejects.toMatchObject({code:'legacy_path_in_use'});
   expect((await repository.get(alias.id))!.rowVersion).toBe(alias.rowVersion);expect((await repository.getPublishedSnapshot()).routes.some(route=>route.entityId===alias.id)).toBe(false);
   const venue=await repository.create({key:'venue:anonymous',kind:'venue',content:{id:'anonymous-venue',name:'Anonymous venue',address:'Anonymous street',locality:'Anonymous town',legacyPath:'/venue/anonymous/'}},actor);
   let event=await repository.create({key:'event:anonymous',kind:'event',content:{id:'anonymous-event',title:'Anonymous gathering',path:'/events/anonymous-gathering/',schedule:{kind:'single',date:'2026-11-01'},start:'10:00',end:'11:00',venue:'anonymous-venue',description:[],legacyPaths:[],sourceIds:[]}},actor);
   await expect(repository.publish(event.id,{expectedRowVersion:event.rowVersion,revisionId:event.draftRevisionId},actor)).rejects.toMatchObject({code:'unpublished_venue'});
   const publishedVenue=await repository.publish(venue.id,{expectedRowVersion:venue.rowVersion,revisionId:venue.draftRevisionId},actor);event=await repository.publish(event.id,{expectedRowVersion:event.rowVersion,revisionId:event.draftRevisionId},actor);
   await expect(repository.unpublish(publishedVenue.id,{expectedRowVersion:publishedVenue.rowVersion,disposition:'gone'},actor)).rejects.toMatchObject({code:'venue_in_use'});
   await expect(repository.save(draftLink.id,{expectedRowVersion:draftLink.rowVersion,content:{...draftLink.draft.content,id:'different-identity'}},actor)).rejects.toMatchObject({code:'immutable_identity'});
   const pdfId='d1790000-0000-4000-8000-000000000099',pdfKey='0'.repeat(64)+'.pdf';
   await pool.query("INSERT INTO media_assets(id,storage_provider,storage_key,content_type,availability_status)VALUES($1,'cms_local',$2,'application/pdf','available')",[pdfId,pdfKey]);
   linking=await repository.save(linking.id,{expectedRowVersion:linking.rowVersion,content:{...linking.draft.content,modules:[{id:'image',enabled:true,block:{kind:'figure',media:pdfId}}]}},actor);
   await expect(repository.publish(linking.id,{expectedRowVersion:linking.rowVersion,revisionId:linking.draftRevisionId},actor)).rejects.toMatchObject({code:'invalid_image'});
   expect(await repository.canReadAsset(pdfKey,false)).toBe(false);
   linking=await repository.save(linking.id,{expectedRowVersion:linking.rowVersion,content:{...linking.draft.content,modules:[{id:'document',enabled:true,block:{kind:'downloads',items:[{title:'Anonymous document',text:'An anonymous document fixture.',label:'Download',href:'/cms-assets/'+pdfKey}]}}]}},actor);
   await repository.publish(linking.id,{expectedRowVersion:linking.rowVersion,revisionId:linking.draftRevisionId},actor);expect(await repository.canReadAsset(pdfKey,false)).toBe(true);
   await verifyCmsSeoHttpLifecycle(repository);
   expect((await pool.query('SELECT count(*)::int n,sum(row_version)::text versions FROM sermons')).rows).toEqual(before);
  }finally{
   // Only this guarded disposable test family creates these tables and anonymous rows.
   await pool.query('TRUNCATE cms_routes,cms_entities,cms_revisions');await pool.query("DELETE FROM media_assets WHERE id='d1790000-0000-4000-8000-000000000099'");await pool.query("DELETE FROM audit_events WHERE entity_type='cms_entity' AND actor_subject IN('anonymous-cms-integration','cms-initializer')");await pool.query(migration.downBody);await pool.query('DELETE FROM schema_migrations WHERE migration_order=27');
   for(const item of [...suffix].reverse()){await pool.query(item.downBody);await pool.query('DELETE FROM schema_migrations WHERE migration_order=$1',[item.order]);}
  }
 });
}
