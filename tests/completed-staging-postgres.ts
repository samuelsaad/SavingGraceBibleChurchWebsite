import type {Pool} from 'pg';
import {it,expect} from 'vitest';
import {completedSchemaMigrations,verifyCompletedSchema} from '../src/staging/completed-schema';
import {insertExactCompletedRow} from '../src/staging/completed-sync';
import {databaseFingerprint} from '../src/staging/database-verification';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';

export function registerCompletedStagingPostgresTests(getPool:()=>Pool){
 it('D-171 applies, verifies, rolls back and reapplies the exact compatibility suffix without altering existing rows',async()=>{
  assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);
  const c=await getPool().connect();
  try{await c.query('BEGIN');const before=await databaseFingerprint(c);const suffix=(await completedSchemaMigrations()).slice(22);
   const apply=async()=>{for(const m of suffix){await c.query(m.upBody);await c.query('INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256)VALUES($1,$2,$3)',[m.order,m.id,m.checksumSha256]);}await verifyCompletedSchema(c);};
   await apply();const first=await databaseFingerprint(c);
   await verifyCompletedSchema(c);expect((await databaseFingerprint(c)).sha256).toBe(first.sha256);
   for(const m of [...suffix].reverse()){await c.query(m.downBody);await c.query('DELETE FROM schema_migrations WHERE migration_order=$1',[m.order]);}
   expect((await databaseFingerprint(c)).sha256).toBe(before.sha256);
   await apply();
   const constraints=await c.query("SELECT count(*)::int n FROM pg_constraint WHERE conname IN('scripture_references_d169_transcript_origin_check','sermon_primary_passage_reviews_d169_transcript_origin_check')");expect(constraints.rows[0].n).toBe(2);
   const objects=await c.query("SELECT to_regclass('public.sermon_d169_restricted_acceptances') IS NOT NULL AND to_regprocedure('d169_restricted_acceptance_dependency(uuid)') IS NOT NULL ok");expect(objects.rows[0].ok).toBe(true);
  }finally{await c.query('ROLLBACK');c.release();}
 });
 it('D-171 exact append is idempotent, preserves timestamps and refuses changed existing values',async()=>{
  const c=await getPool().connect();try{await c.query('BEGIN');await c.query("SET LOCAL timezone='UTC'");
   const input=(await c.query("SELECT to_jsonb(s) r FROM speakers s LIMIT 1")).rows[0].r;
   expect(await insertExactCompletedRow(c,'speakers',['id'],input)).toBe(false);
   const before=await databaseFingerprint(c);
   await expect(insertExactCompletedRow(c,'speakers',['id'],{...input,name:'Anonymised conflicting speaker'})).rejects.toThrow('d171_concurrent_or_seeded_conflict');
   expect((await databaseFingerprint(c)).sha256).toBe(before.sha256);
   const fresh={...input,id:'11111111-1111-4111-8111-111111111171',name:'Anonymised transfer fixture',slug:'anonymised-d171-transfer',source_term_id:null,source_term_taxonomy_id:null};
   expect(await insertExactCompletedRow(c,'speakers',['id'],fresh)).toBe(true);
   const after=await databaseFingerprint(c);expect(await insertExactCompletedRow(c,'speakers',['id'],fresh)).toBe(false);expect((await databaseFingerprint(c)).sha256).toBe(after.sha256);
  }finally{await c.query('ROLLBACK');c.release();}
 });
}
