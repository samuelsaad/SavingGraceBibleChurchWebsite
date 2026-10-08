import {createHash} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {buildCmsSeeds,buildCmsEmbeddedAssetSeeds} from "./seed";
import {PostgresCmsRepository} from "./postgres-repository";
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** No record bodies leave this function; prior non-CMS rows and sequences remain invariant. */
export async function cmsPreservationFingerprint(client:PoolClient){
 const names=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename as string);
 const tables=[];for(const name of names){
  if(name.startsWith("cms_"))continue;if(!/^[a-z_][a-z0-9_]*$/.test(name))throw Error("cms_table_identifier_refused");
  const predicate=name==="media_assets"?" WHERE storage_provider NOT IN ('cms_local','cms_embedded')":name==="audit_events"?" WHERE entity_type NOT IN ('cms_entity','cms_asset')":name==="schema_migrations"?" WHERE migration_order<=26":"";
  const row=(await client.query(`SELECT count(*)::int count,encode(digest(COALESCE(string_agg(row_hash,'' ORDER BY row_hash COLLATE "C"),''),'sha256'),'hex') sha256 FROM (SELECT encode(digest(to_jsonb(t)::text,'sha256'),'hex') row_hash FROM "${name}" t${predicate}) hashes`)).rows[0];tables.push({name,...row});
 }
 const sequences=(await client.query("SELECT sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text,last_value::text FROM pg_sequences WHERE schemaname='public' AND sequencename NOT LIKE 'cms_%' ORDER BY sequencename")).rows;
 return{sha256:hash({tables,sequences}),tables:tables.length,sequences:sequences.length};
}
export async function captureCmsRecovery(client:PoolClient){
 const present=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('cms_entities','cms_revisions','cms_routes') ORDER BY tablename")).rows;
 const tables:Record<string,unknown[]>={};for(const {tablename} of present)tables[tablename]=(await client.query(`SELECT to_jsonb(t) row FROM "${tablename}" t`)).rows.map(r=>r.row);
 tables.media_assets=(await client.query("SELECT to_jsonb(t) row FROM media_assets t WHERE storage_provider IN ('cms_local','cms_embedded')")).rows.map(r=>r.row);
 tables.audit_events=(await client.query("SELECT to_jsonb(t) row FROM audit_events t WHERE entity_type IN ('cms_entity','cms_asset')")).rows.map(r=>r.row);
 return{format:"cms-scoped-recovery-v1",tables};
}
export async function initializeCmsSeeds(pool:Pool,actor:string){
 let assetsInserted=0;
 for(const a of buildCmsEmbeddedAssetSeeds()){
  const result=await pool.query("INSERT INTO media_assets(storage_provider,storage_key,original_filename,content_type,size_bytes,width_pixels,height_pixels,checksum_sha256,alt_text,source_url,availability_status) VALUES('cms_embedded',$1,$2,$3,$4,$5,$6,$7,$8,$9,'available') ON CONFLICT(storage_provider,storage_key) DO NOTHING",[a.key,a.originalFilename,a.contentType,a.sizeBytes,a.width,a.height,a.checksumSha256,a.alt,a.path]);assetsInserted+=result.rowCount??0;
 }
 return{...await new PostgresCmsRepository(pool).seed(buildCmsSeeds(),actor),assetsInserted};
}

