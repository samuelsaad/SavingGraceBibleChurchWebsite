import {readFile} from 'node:fs/promises';
import {schemaMigrationChecksum,type LoadedSchemaMigration} from '../migration/schema-migrations';
export async function loadSourcePublicMigration():Promise<LoadedSchemaMigration>{
 const id='0028_source_public_migration',upPath=`db/migrations/${id}.sql`,downPath=`db/migrations/${id}.down.sql`;
 const up=await readFile(upPath,'utf8'),down=await readFile(downPath,'utf8');
 const body=(sql:string)=>{const match=/^\s*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/u.exec(sql.replace(/^\uFEFF/u,''));if(!match)throw Error('source_migration_transaction_missing');return match[1]!;};
 return {id,order:28,upPath,downPath,addedRelations:['source_public_versions','source_public_routes','source_public_imports'],addedFunctions:['protect_source_public_history()'],addedTriggers:['source_public_versions_immutable','source_public_imports_immutable'],checksumSha256:schemaMigrationChecksum(up,down),upBody:body(up),downBody:body(down)};
}
