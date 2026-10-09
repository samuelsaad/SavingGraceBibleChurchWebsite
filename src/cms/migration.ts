import {loadSourcePublicMigration} from '../seo/source-public-migration';
import {readFile} from 'node:fs/promises';
import type {PoolClient} from 'pg';
import {schemaMigrationChecksum,validateSchemaMigrationJournal,type LoadedSchemaMigration} from '../migration/schema-migrations';
import {completedSchemaMigrations} from '../staging/completed-schema';
import {loadAcceptedSemanticMigration} from '../semantic/accepted-semantic-migration';
export async function loadCmsMigration():Promise<LoadedSchemaMigration>{
 const id='0027_modular_cms',upPath=`db/migrations/${id}.sql`,downPath=`db/migrations/${id}.down.sql`;
 const up=await readFile(upPath,'utf8'),down=await readFile(downPath,'utf8');
 const body=(sql:string)=>{const match=/^\s*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/u.exec(sql.replace(/^\uFEFF/u,''));if(!match)throw Error('cms_migration_transaction_missing');return match[1]!;};
 return{id,order:27,upPath,downPath,addedRelations:['cms_entities','cms_revisions','cms_routes'],addedFunctions:['protect_cms_revisions()'],addedTriggers:['cms_revisions_immutable'],checksumSha256:schemaMigrationChecksum(up,down),upBody:body(up),downBody:body(down)};
}
export async function verifyCmsSchema(client:Pick<PoolClient,'query'>,options:{allowPreMigration?:boolean}={}):Promise<number>{
 const definitions=[...await completedSchemaMigrations(),await loadAcceptedSemanticMigration(),await loadCmsMigration(),await loadSourcePublicMigration()];
 const journal=(await client.query('SELECT migration_order,migration_id,checksum_sha256 FROM schema_migrations ORDER BY migration_order')).rows;
 const count=validateSchemaMigrationJournal(definitions,journal);if(count!==27&&count!==28&&!(options.allowPreMigration&&count===26))throw Error('cms_schema_mismatch');
 if(count>=27){const relations=(await client.query(`SELECT to_regclass('cms_entities') IS NOT NULL AND to_regclass('cms_revisions') IS NOT NULL AND to_regclass('cms_routes') IS NOT NULL AS ready`)).rows[0];if(!relations?.ready)throw Error('cms_schema_relations_missing');}
 return count;
}
/** The caller must verify the exact allowed destination and begin a guarded transaction. */
export async function applyCmsMigration(client:Pick<PoolClient,'query'>):Promise<'applied'|'unchanged'>{
 await client.query('SELECT pg_advisory_xact_lock(179,27)');if(await verifyCmsSchema(client,{allowPreMigration:true})>=27)return 'unchanged';
 const migration=await loadCmsMigration();await client.query(migration.upBody);await client.query('INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256) VALUES($1,$2,$3)',[migration.order,migration.id,migration.checksumSha256]);await verifyCmsSchema(client);return 'applied';
}
