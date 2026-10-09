import {readFile} from 'node:fs/promises';
import type {PoolClient} from 'pg';
import {loadSchemaMigrations,schemaMigrationChecksum,validateSchemaMigrationJournal} from '../migration/schema-migrations';

const suffix=['0023_d168_delegated_review_acceptance','0024_d169_followup_review','0025_d169_transcript_passage_proposal'];
export async function completedSchemaMigrations(){
 const base=await loadSchemaMigrations();
 if(base.length!==22)throw Error('d171_base_schema_mismatch');
 for(const [index,id] of suffix.entries()){
  const up=await readFile(`db/migrations/${id}.sql`,'utf8'),down=await readFile(`db/migrations/${id}.down.sql`,'utf8');
  const body=(sql:string)=>{const match=/^\s*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/u.exec(sql);if(!match)throw Error('d171_migration_transaction_missing');return match[1]!;};
  base.push({id,order:23+index,upPath:`db/migrations/${id}.sql`,downPath:`db/migrations/${id}.down.sql`,addedRelations:[],checksumSha256:schemaMigrationChecksum(up,down),upBody:body(up),downBody:body(down)});
 }
 return base;
}
export async function verifyCompletedSchema(c:Pick<PoolClient,'query'>){
 const definitions=await completedSchemaMigrations();
 const journal=(await c.query('SELECT migration_order,migration_id,checksum_sha256 FROM schema_migrations ORDER BY migration_order')).rows;
 if(journal.length>=26)definitions.push(await (await import('../semantic/accepted-semantic-migration')).loadAcceptedSemanticMigration());
 if(journal.length>=27)definitions.push(await (await import('../cms/migration')).loadCmsMigration());
 if(journal.length===28)definitions.push(await (await import('../seo/source-public-migration')).loadSourcePublicMigration());
 const count=validateSchemaMigrationJournal(definitions,journal);
 if(count!==25&&count!==26&&count!==27&&count!==28)throw Error('d171_schema_mismatch');
 return count;
}
