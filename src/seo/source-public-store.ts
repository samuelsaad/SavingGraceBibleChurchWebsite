import type {PoolClient} from 'pg';
import {verifyCmsSchema} from '../cms/migration';
import {loadSourcePublicMigration} from './source-public-migration';
import {sourceBundleSchema,sourcePageSchema,sha256,stableJson,sourceVersionHash,type SourcePublicPage} from './source-public-model';
type Db=Pick<PoolClient,'query'>;
/** Caller holds a verified destination transaction. No provider/network activity. */
export async function applySourcePublicMigration(db:Db){
 await db.query('SELECT pg_advisory_xact_lock(181,28)');
 const count=await verifyCmsSchema(db);if(count===28)return 'unchanged';
 if(count!==27)throw Error('source_public_schema_prefix');
 const migration=await loadSourcePublicMigration();await db.query(migration.upBody);
 await db.query('INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256) VALUES($1,$2,$3)',[28,migration.id,migration.checksumSha256]);
 await verifyCmsSchema(db);return 'applied';
}
export async function importSourcePublicBundle(db:Db,input:unknown,releaseCommit:string){
 if(!/^[a-f0-9]{40}$/u.test(releaseCommit))throw Error('source_public_release_required');
 const bundle=sourceBundleSchema.parse(input),bundleHash=sha256(stableJson(bundle));
 await db.query('SELECT pg_advisory_xact_lock(181,28)');
 if(await verifyCmsSchema(db)!==28)throw Error('source_public_schema_required');
 const previous=(await db.query('SELECT 1 FROM source_public_imports WHERE bundle_sha256=$1',[bundleHash])).rowCount;
 const changes:Array<{path:string;before:string|null;after:string}>=[];
 for(const page of bundle.pages){
  const next=sourceVersionHash(page);
  const current=(await db.query<{version_sha256:string;withdrawn:boolean}>('SELECT version_sha256,withdrawn FROM source_public_routes WHERE path=$1 FOR UPDATE',[page.path])).rows[0];
  if(current?.withdrawn)throw Error('source_public_explicit_withdrawal');
  if(current?.version_sha256===next)continue;
  if(previous)throw Error('source_public_replay_after_change');
  if((current?.version_sha256??null)!==bundle.expectedVersions[page.path])throw Error('source_public_concurrent_change');
  // A source snapshot never resurrects an explicit editorial withdrawal.
  const withdrawn=(await db.query(`SELECT 1 FROM sermons WHERE source_wordpress_id=$1 AND status IN ('unpublished','archived') UNION ALL SELECT 1 FROM redirects WHERE old_path=$2 LIMIT 1`,[page.sourceId,page.path])).rowCount;
  if(withdrawn)throw Error('source_public_editorial_disposition');
  await db.query('INSERT INTO source_public_versions(version_sha256,source_url,source_wordpress_id,source_captured_at,response_sha256,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(version_sha256) DO NOTHING',[next,page.sourceUrl,page.sourceId,page.capturedAt,page.responseSha256,JSON.stringify(page)]);
  await db.query('INSERT INTO source_public_routes(path,version_sha256,source_wordpress_id) VALUES($1,$2,$3) ON CONFLICT(path) DO UPDATE SET version_sha256=excluded.version_sha256,source_wordpress_id=excluded.source_wordpress_id,row_version=source_public_routes.row_version+1,updated_at=now()',[page.path,next,page.sourceId]);
  changes.push({path:page.path,before:current?.version_sha256??null,after:next});
 }
 if(!previous)await db.query('INSERT INTO source_public_imports(bundle_sha256,inventory_sha256,release_commit,changes) VALUES($1,$2,$3,$4::jsonb)',[bundleHash,bundle.inventorySha256,releaseCommit,JSON.stringify(changes)]);
 return {bundleSha256:bundleHash,inserted:changes.filter(x=>x.before===null).length,updated:changes.filter(x=>x.before!==null).length,unchanged:bundle.pages.length-changes.length};
}
export async function readSourcePublicPages(db:Db):Promise<SourcePublicPage[]>{
 const rows=(await db.query<{payload:unknown;version_sha256:string}>(`SELECT v.payload,v.version_sha256 FROM source_public_routes r JOIN source_public_versions v USING(version_sha256) WHERE NOT r.withdrawn AND NOT EXISTS(SELECT 1 FROM sermons s WHERE s.source_wordpress_id=r.source_wordpress_id AND s.status IN ('unpublished','archived')) AND NOT EXISTS(SELECT 1 FROM redirects d WHERE d.old_path=r.path) ORDER BY r.path`)).rows;
 return rows.map(row=>{const page=sourcePageSchema.parse(row.payload);if(sourceVersionHash(page)!==row.version_sha256)throw Error('source_public_version_integrity');return page;});
}

/** Restore only this import's pointers when they still match; content/history stay immutable. */
export async function restoreSourcePublicImport(db:Db,bundleHash:string,releaseCommit:string){
 if(!/^[a-f0-9]{64}$/u.test(bundleHash)||!/^[a-f0-9]{40}$/u.test(releaseCommit))throw Error('source_public_restore_identity');
 await db.query('SELECT pg_advisory_xact_lock(181,28)');
 const row=(await db.query<{inventory_sha256:string;changes:Array<{path:string;before:string|null;after:string}>}>('SELECT inventory_sha256,changes FROM source_public_imports WHERE bundle_sha256=$1',[bundleHash])).rows[0];
 if(!row)throw Error('source_public_restore_missing');
 const restoreHash=sha256(stableJson({operation:'restore',bundleHash,releaseCommit}));
 if((await db.query('SELECT 1 FROM source_public_imports WHERE bundle_sha256=$1',[restoreHash])).rowCount)return{restored:0,unchanged:row.changes.length};
 for(const change of row.changes){const current=(await db.query<{version_sha256:string;withdrawn:boolean}>('SELECT version_sha256,withdrawn FROM source_public_routes WHERE path=$1 FOR UPDATE',[change.path])).rows[0];if(!current||current.withdrawn||current.version_sha256!==change.after)throw Error('source_public_restore_later_change');}
 for(const change of row.changes)await db.query('UPDATE source_public_routes SET version_sha256=$2,withdrawn=$3,row_version=row_version+1,updated_at=now() WHERE path=$1',[change.path,change.before??change.after,change.before===null]);
 await db.query('INSERT INTO source_public_imports(bundle_sha256,inventory_sha256,release_commit,changes) VALUES($1,$2,$3,$4::jsonb)',[restoreHash,row.inventory_sha256,releaseCommit,JSON.stringify(row.changes.map(change=>({path:change.path,before:change.after,after:change.before,operation:'restore',sourceImport:bundleHash})))]);
 return{restored:row.changes.length,unchanged:0};
}
