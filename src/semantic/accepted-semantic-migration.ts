import {readFile} from 'node:fs/promises';
import type {PoolClient} from 'pg';
import {schemaMigrationChecksum,validateSchemaMigrationJournal,type LoadedSchemaMigration} from '../migration/schema-migrations';
import {completedSchemaMigrations} from '../staging/completed-schema';

export async function loadAcceptedSemanticMigration():Promise<LoadedSchemaMigration>{
 const id='0026_accepted_description_semantics';
 const upPath=`db/migrations/${id}.sql`,downPath=`db/migrations/${id}.down.sql`;
 const up=await readFile(upPath,'utf8'),down=await readFile(downPath,'utf8');
 const body=(sql:string)=>{const match=/^\s*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/u.exec(sql);if(!match)throw Error('semantic_migration_transaction_missing');return match[1]!;};
 return{id,order:26,upPath,downPath,addedRelations:['accepted_description_semantic_vectors','accepted_description_semantic_builds','accepted_description_semantic_members','accepted_description_semantic_active'],checksumSha256:schemaMigrationChecksum(up,down),upBody:body(up),downBody:body(down)};
}
export async function verifyAcceptedSemanticSchema(client:Pick<PoolClient,'query'>,options:{allowPreMigration?:boolean}={}):Promise<number>{
 const definitions=[...await completedSchemaMigrations(),await loadAcceptedSemanticMigration()];
 const journal=(await client.query('SELECT migration_order,migration_id,checksum_sha256 FROM schema_migrations ORDER BY migration_order')).rows;
 const count=validateSchemaMigrationJournal(definitions,journal);
 if(count!==26&&!(options.allowPreMigration&&count===25))throw Error('semantic_schema_mismatch');
 return count;
}
/** Caller must verify destination and begin a guarded transaction first. */
export async function applyAcceptedSemanticMigration(client:Pick<PoolClient,'query'>):Promise<'applied'|'unchanged'>{
 await client.query('SELECT pg_advisory_xact_lock(178,26)');
 if(await verifyAcceptedSemanticSchema(client,{allowPreMigration:true})===26)return 'unchanged';
 const migration=await loadAcceptedSemanticMigration();await client.query(migration.upBody);
 await client.query('INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256) VALUES($1,$2,$3)',[migration.order,migration.id,migration.checksumSha256]);
 await verifyAcceptedSemanticSchema(client);return 'applied';
}
