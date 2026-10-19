import type {Pool} from 'pg';
type Reader=Pick<Pool,'query'>;
/** This is an equality proof over committed visibility, never a TTL. Own writes,
 * temporary shadows, RLS, views and replicas fall back to the complete query.
 * A cache miss pins one connection for the before/full-hash/after certificate.
 */
export const fingerprintSnapshotProofSql=`SELECT pg_current_snapshot()::text AS snapshot,
 encode(sha256(convert_to(jsonb_build_array(current_database(),(SELECT oid FROM pg_database WHERE datname=current_database()),pg_postmaster_start_time(),inet_server_addr(),inet_server_port(),current_user,session_user,current_setting('TimeZone'),current_setting('search_path'),current_setting('row_security'),current_setting('transaction_isolation'))::text,'UTF8')),'hex') AS identity,
 (current_setting('transaction_read_only')='on' AND pg_current_xact_id_if_assigned() IS NULL AND pg_my_temp_schema()=0 AND NOT pg_is_in_recovery()
  AND (SELECT count(*)=cardinality($1::text[]) AND COALESCE(bool_and(c.relkind IN ('r','p') AND NOT c.relrowsecurity AND c.relnamespace='public'::regnamespace),false)
       FROM unnest($1::text[]) AS dependency(name) JOIN pg_class c ON c.oid=to_regclass(dependency.name))) AS safe`;
export function createSnapshotVerifiedFingerprint(pool:Pick<Pool,'query'|'connect'>,compute:(reader:Reader)=>Promise<string>,relations:readonly string[]){
 if(!relations.length||relations.length>64||new Set(relations).size!==relations.length||relations.some(name=>! /^[a-z][a-z0-9_]*$/u.test(name)))throw Error('source_snapshot_relations_invalid');
 let certificate:{key:string;fingerprint:string}|null=null,building:Promise<void>|null=null;
 const full=async(reader:Reader)=>{const value=await compute(reader);if(!/^[a-f0-9]{64}$/u.test(value))throw Error('source_runtime_fingerprint_missing');return value;};
 const proof=async(reader:Reader)=>{const row=(await reader.query(fingerprintSnapshotProofSql,[relations])).rows[0] as {snapshot?:unknown;identity?:unknown;safe?:unknown}|undefined;
  return row?.safe===true&&typeof row.snapshot==='string'&&/^[0-9]+:[0-9]+:(?:[0-9]+(?:,[0-9]+)*)?$/u.test(row.snapshot)&&typeof row.identity==='string'&&/^[a-f0-9]{64}$/u.test(row.identity)?row.identity+':'+row.snapshot:null;};
 return async()=>{
  for(let attempt=0;attempt<5;attempt++){
   const key=await proof(pool);
   if(!key){certificate=null;return full(pool);}
   if(certificate?.key===key)return certificate.fingerprint;
   if(building){await building;continue;}
   certificate=null;
   building=(async()=>{const reader=await pool.connect();try{const before=await proof(reader);if(!before)return;const fingerprint=await full(reader),after=await proof(reader);if(after===before)certificate={key:before,fingerprint};}finally{reader.release();}})().finally(()=>{building=null;});
   await building;
  }
  // Cluster-wide activity can change visibility without changing this database.
  // Never certify that state; retain the original complete-hash behavior.
  return full(pool);
 };
}
