import{validateSourcePagePayload,type SourcePageValidator}from'./source-page-validation';
import{originalNativeSourceIdSql,originalNativeIdentities,type OriginalNativeIdentity}from'./source-original-native-identities';
import type {PoolClient} from 'pg';
import {verifyCmsSchema} from '../cms/migration';
import {loadSourcePublicMigration} from './source-public-migration';
import {sourceBundleSchema,sourcePathSchema,sha256,stableJson,sourceVersionHash,type SourcePublicPage} from './source-public-model';
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
export async function readSourcePublicPages(db:Db,paths?:readonly string[],identityBindings:readonly OriginalNativeIdentity[]=originalNativeIdentities,validate:SourcePageValidator=validateSourcePagePayload):Promise<SourcePublicPage[]>{
 if(paths){if(paths.length>2)throw Error('source_public_read_scope');paths.forEach(path=>sourcePathSchema.parse(path));if(!paths.length)return [];}
 const rows=(await db.query<{payload:unknown;version_sha256:string}>(`SELECT v.payload::text AS payload,v.version_sha256 FROM source_public_routes r JOIN source_public_versions v USING(version_sha256) WHERE NOT r.withdrawn AND NOT EXISTS(SELECT 1 FROM sermons s WHERE ${originalNativeSourceIdSql('s',identityBindings)}=r.source_wordpress_id AND (s.status IN ('unpublished','archived') OR s.deleted_at IS NOT NULL)) AND NOT EXISTS(SELECT 1 FROM redirects d WHERE d.old_path=r.path)${paths?' AND r.path=ANY($1::text[])':''} ORDER BY r.path`,paths?[paths]:[])).rows;
 const pages:SourcePublicPage[]=[];
 // The decoded corpus remains alive; release each consumed wire payload rather
 // than retaining a second complete copy throughout validation.
 for(const row of rows){const payload=row.payload;row.payload=undefined;
  pages.push(validate(payload,row.version_sha256));
 }
 return pages;
}

/** Read-only active-pointer proof; a historical receipt alone is insufficient. */
export async function verifySourcePublicBundle(db:Db,input:unknown){
 const bundle=sourceBundleSchema.parse(input);
 for(const page of bundle.pages){
  const current=(await db.query<{version_sha256:string;withdrawn:boolean}>('SELECT version_sha256,withdrawn FROM source_public_routes WHERE path=$1',[page.path])).rows[0];
  if(!current||current.withdrawn||current.version_sha256!==sourceVersionHash(page))throw Error('source_public_active_version_mismatch');
 }
 return{pages:bundle.pages.length,activeVersionsMatched:true};
}

/** Restore only this import's pointers when they still match; content/history stay immutable. */
export async function restoreSourcePublicImport(db:Db,bundleHash:string,releaseCommit:string){
 if(!/^[a-f0-9]{64}$/u.test(bundleHash)||!/^[a-f0-9]{40}$/u.test(releaseCommit))throw Error('source_public_restore_identity');
 await db.query('SELECT pg_advisory_xact_lock(181,28)');
 const row=(await db.query<{inventory_sha256:string;changes:Array<{path:string;before:string|null;after:string}>}>('SELECT inventory_sha256,changes FROM source_public_imports WHERE bundle_sha256=$1',[bundleHash])).rows[0];
 if(!row)throw Error('source_public_restore_missing');
 const restoreHash=sha256(stableJson({operation:'restore',bundleHash,releaseCommit}));
 if((await db.query('SELECT 1 FROM source_public_imports WHERE bundle_sha256=$1',[restoreHash])).rowCount){
  for(const change of row.changes){const current=(await db.query<{version_sha256:string;withdrawn:boolean}>('SELECT version_sha256,withdrawn FROM source_public_routes WHERE path=$1 FOR UPDATE',[change.path])).rows[0];if(!current||current.version_sha256!==(change.before??change.after)||current.withdrawn!==(change.before===null))throw Error('source_public_restore_later_change');}
  return{restored:0,unchanged:row.changes.length};
 }
 for(const change of row.changes){const current=(await db.query<{version_sha256:string;withdrawn:boolean}>('SELECT version_sha256,withdrawn FROM source_public_routes WHERE path=$1 FOR UPDATE',[change.path])).rows[0];if(!current||current.withdrawn||current.version_sha256!==change.after)throw Error('source_public_restore_later_change');}
 for(const change of row.changes)await db.query('UPDATE source_public_routes SET version_sha256=$2,withdrawn=$3,row_version=row_version+1,updated_at=now() WHERE path=$1',[change.path,change.before??change.after,change.before===null]);
 await db.query('INSERT INTO source_public_imports(bundle_sha256,inventory_sha256,release_commit,changes) VALUES($1,$2,$3,$4::jsonb)',[restoreHash,row.inventory_sha256,releaseCommit,JSON.stringify(row.changes.map(change=>({path:change.path,before:change.after,after:change.before,operation:'restore',sourceImport:bundleHash})))]);
 return{restored:row.changes.length,unchanged:0};
}

/** Reapply only newly inserted rows withdrawn by this exact operator restoration.
 * Human withdrawals never gain a general resurrection path. Two immutable receipts,
 * complete bundle identity, the original row-version sequence and current disposition
 * checks are mandatory. Caller owns the guarded destination transaction.
 */
export async function reapplyRestoredNewSourceImport(db:Db,input:unknown,restoreRelease:string,releaseCommit=restoreRelease){
 if(!/^[a-f0-9]{40}$/u.test(restoreRelease)||!/^[a-f0-9]{40}$/u.test(releaseCommit))throw Error('source_public_reapply_identity');
 const bundle=sourceBundleSchema.parse(input),bundleHash=sha256(stableJson(bundle)),restoreHash=sha256(stableJson({operation:'restore',bundleHash,releaseCommit:restoreRelease})),reapplyHash=sha256(stableJson({operation:'reapply_restored_new_rows',bundleHash,restoreHash,releaseCommit}));
 await db.query('SELECT pg_advisory_xact_lock(181,28)');
 const original=(await db.query<{changes:Array<{path:string;before:string|null;after:string}>}>('SELECT changes FROM source_public_imports WHERE bundle_sha256=$1',[bundleHash])).rows[0];
 const restoration=(await db.query<{changes:Array<{path:string;before:string;after:null;operation:string;sourceImport:string}>}>('SELECT changes FROM source_public_imports WHERE bundle_sha256=$1',[restoreHash])).rows[0];
 const same=(a:unknown,b:unknown)=>stableJson(a)===stableJson(b),ordered=<T extends {path:string}>(rows:T[])=>[...rows].sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const expected=bundle.pages.map(page=>({path:page.path,before:null,after:sourceVersionHash(page)}));
 if(!expected.length||!original||!restoration||!same(ordered(original.changes),ordered(expected))||!same(ordered(restoration.changes),ordered(expected.map(row=>({path:row.path,before:row.after,after:null,operation:'restore',sourceImport:bundleHash})))))throw Error('source_public_reapply_scope');
 const replay=Boolean((await db.query('SELECT 1 FROM source_public_imports WHERE bundle_sha256=$1',[reapplyHash])).rowCount);
 for(const page of bundle.pages){
  const row=(await db.query<{version_sha256:string;withdrawn:boolean;row_version:number;unchanged_since_receipt:boolean}>('SELECT r.version_sha256,r.withdrawn,r.row_version,r.updated_at=i.imported_at AS unchanged_since_receipt FROM source_public_routes r CROSS JOIN source_public_imports i WHERE r.path=$1 AND i.bundle_sha256=$2 FOR UPDATE OF r',[page.path,replay?reapplyHash:restoreHash])).rows[0];
  if(!row||row.version_sha256!==sourceVersionHash(page)||row.withdrawn!==!replay||row.row_version!==(replay?3:2)||!row.unchanged_since_receipt)throw Error('source_public_reapply_later_change');
  const withdrawn=(await db.query(`SELECT 1 FROM sermons s WHERE ${originalNativeSourceIdSql('s')}=$1 AND (s.status IN ('unpublished','archived') OR s.deleted_at IS NOT NULL) UNION ALL SELECT 1 FROM redirects WHERE old_path=$2 UNION ALL SELECT 1 FROM cms_routes WHERE path=$2 AND status<>200 LIMIT 1`,[page.sourceId,page.path])).rowCount;
  if(withdrawn)throw Error('source_public_reapply_editorial_disposition');
 }
 if(replay)return {reapplied:0,unchanged:bundle.pages.length};
 for(const page of bundle.pages)await db.query('UPDATE source_public_routes SET withdrawn=false,row_version=row_version+1,updated_at=now() WHERE path=$1',[page.path]);
 await db.query('INSERT INTO source_public_imports(bundle_sha256,inventory_sha256,release_commit,changes) VALUES($1,$2,$3,$4::jsonb)',[reapplyHash,bundle.inventorySha256,releaseCommit,JSON.stringify(expected.map(row=>({...row,operation:'reapply_restored_new_rows',sourceImport:bundleHash,restoreImport:restoreHash,rowVersionBefore:2,rowVersionAfter:3})))]);
 return {reapplied:bundle.pages.length,unchanged:0};
}
