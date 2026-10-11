/** Exact inherited seed mistakes; no general override of administrator redirects. */
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {sourceCmsAdoption} from './source-cms-adoption';
import {PostgresCmsRepository} from '../cms/postgres-repository';
import {validateCmsContent} from '../cms/validation';
import type {SourcePublicPage} from './source-public-model';
import {stableJson,sourceVersionHash} from './source-public-model';
const scope=new Map([['/venue/saving-grace-bible-church/','/contact/'],['/organiser/saving-grace-bible-church/','/contact/']]);
export async function repairInheritedSourceAliases(pool:Pool,pages:readonly SourcePublicPage[],apply:boolean){
 const repository=new PostgresCmsRepository(pool),results:Array<{path:string;outcome:string}>=[];
 for(const [path,target] of scope){
  const entities=await repository.list(),snapshot=await repository.getPublishedSnapshot();
  const page=pages.find(p=>p.path===path&&p.kind==='archive'&&p.sourceId!==null&&!p.issues.length);if(!page){results.push({path,outcome:'verified_source_unavailable'});continue;}
  const route=snapshot.routes.find(r=>r.path===path);
  if(route?.status===200&&entities.find(e=>e.id===route.entityId)?.key.startsWith('source-public:')){results.push({path,outcome:'already_repaired'});continue;}
  const owner=route&&entities.find(e=>e.id===route.entityId);
  if(!owner||route?.status!==301||route.targetPath!==target||!owner.published||owner.published.content.path!==target){results.push({path,outcome:'existing_editorial_disposition_preserved'});continue;}
  const seed=sourceCmsAdoption([page],entities,snapshot.routes.filter(r=>r.path!==path)).seeds[0];if(!seed){results.push({path,outcome:'source_not_representable'});continue;}
  const content=validateCmsContent(seed.kind,seed.payload),c=await pool.connect();
  try{
   await c.query(apply?'BEGIN':'BEGIN READ ONLY');
   if(apply){await c.query("SET LOCAL savinggrace.application_request='on'");await c.query('SELECT pg_advisory_xact_lock(179,27)');}
   const row=(await c.query(`SELECT e.*,r.content AS draft,p.content AS published,(SELECT first.content->'legacyPaths' FROM cms_revisions first WHERE first.entity_id=e.id ORDER BY first.revision_number LIMIT 1) AS initial_aliases FROM cms_entities e JOIN cms_revisions r ON r.id=e.draft_revision_id JOIN cms_revisions p ON p.id=e.published_revision_id WHERE e.id=$1${apply?' FOR UPDATE OF e':''}`,[owner.id])).rows[0];
   const current=(await c.query('SELECT * FROM cms_routes WHERE path=$1',[path])).rows[0],source=(await c.query('SELECT version_sha256,withdrawn FROM source_public_routes WHERE path=$1',[path])).rows[0];
   const aliases=row?.initial_aliases;
   const changed=(await c.query("SELECT 1 FROM cms_revisions r WHERE r.entity_id=$1 AND r.actor<>'source-public-migration' AND r.revision_number>1 AND r.content->'legacyPaths' IS DISTINCT FROM(SELECT previous.content->'legacyPaths' FROM cms_revisions previous WHERE previous.entity_id=r.entity_id AND previous.revision_number<r.revision_number ORDER BY previous.revision_number DESC LIMIT 1) LIMIT 1",[owner.id])).rowCount;
   if(!row?.seed_key||row.row_version!==owner.rowVersion||stableJson(row.draft)!==stableJson(owner.draft.content)||stableJson(row.published)!==stableJson(owner.published.content)||!Array.isArray(aliases)||!aliases.includes(path)||changed||current?.entity_id!==owner.id||current?.status!==301||current.target_path!==target||source?.withdrawn||source?.version_sha256!==sourceVersionHash(page)){
    await c.query('ROLLBACK');results.push({path,outcome:'concurrent_or_explicit_editorial_change_preserved'});continue;
   }
   if(!apply){await c.query('ROLLBACK');results.push({path,outcome:'planned'});continue;}
   const append=async(original:Record<string,unknown>,sourceRevisionId:string)=>{const revisionId=randomUUID(),value={...original,legacyPaths:(original.legacyPaths as string[]).filter(p=>p!==path)};await c.query("INSERT INTO cms_revisions(id,entity_id,revision_number,content,actor,source_revision_id) SELECT $1,$2,COALESCE(MAX(revision_number),0)+1,$3::jsonb,'source-public-migration',$4 FROM cms_revisions WHERE entity_id=$2",[revisionId,owner.id,JSON.stringify(value),sourceRevisionId]);return revisionId;};
   const published=await append(row.published,row.published_revision_id),draft=row.draft_revision_id===row.published_revision_id?published:await append(row.draft,row.draft_revision_id);
   await c.query('UPDATE cms_entities SET draft_revision_id=$2,published_revision_id=$3,row_version=row_version+1,updated_at=now() WHERE id=$1',[owner.id,draft,published]);
   await c.query('DELETE FROM cms_routes WHERE path=$1 AND entity_id=$2',[path,owner.id]);
   const entityId=randomUUID(),revisionId=randomUUID();
   await c.query('INSERT INTO cms_entities(id,key,kind,draft_revision_id,published_revision_id,seed_key) VALUES($1,$2,$3,$4,$4,$2)',[entityId,seed.key,seed.kind,revisionId]);
   await c.query("INSERT INTO cms_revisions(id,entity_id,revision_number,content,actor) VALUES($1,$2,1,$3::jsonb,'source-public-migration')",[revisionId,entityId,JSON.stringify(content)]);
   await c.query('INSERT INTO cms_routes(path,entity_id,status) VALUES($1,$2,200)',[path,entityId]);
   for(const id of [owner.id,entityId])await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id) VALUES('source-public-migration','system','cms.source_alias_handoff','cms_entity',$1,$2::jsonb,'d182-original-alias-repair')",[id,JSON.stringify(['legacyPaths','sourceRoute'])]);
   await c.query('COMMIT');results.push({path,outcome:'repaired'});
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
 }
 return results;
}
