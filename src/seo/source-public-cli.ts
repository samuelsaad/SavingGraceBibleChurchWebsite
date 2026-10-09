import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createCmsLocalPool,verifyCmsLocalIdentity} from '../cms/local-database';
import {applySourcePublicMigration,importSourcePublicBundle,readSourcePublicPages,restoreSourcePublicImport} from './source-public-store';
import {sourceBundleSchema} from './source-public-model';
async function main(){const operation=process.argv[2],file=process.argv[3];
 if(!['validate','apply','import','inventory','restore'].includes(operation??''))throw Error('source_public_command');
 if(operation==='validate'){if(!file)throw Error('source_public_bundle_required');const bundle=sourceBundleSchema.parse(JSON.parse(await readFile(file,'utf8')));console.log(JSON.stringify({outcome:'source_bundle_valid',pages:bundle.pages.length,sermons:bundle.pages.filter(p=>p.kind==='sermon').length}));return;}
 const write=operation!=='inventory';if(write&&process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('source_public_write_gate');
 const pool=await createCmsLocalPool(!write);try{await verifyCmsLocalIdentity(pool);const client=await pool.connect();try{await client.query(write?'BEGIN':'BEGIN READ ONLY');let result:unknown;
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(operation==='apply')result={schema:await applySourcePublicMigration(client)};
 else if(operation==='import'){if(!file)throw Error('source_public_bundle_required');result=await importSourcePublicBundle(client,JSON.parse(await readFile(file,'utf8')),commit);}
 else if(operation==='restore'){if(!file)throw Error('source_public_import_hash_required');result=await restoreSourcePublicImport(client,file,commit);}
 else {const pages=await readSourcePublicPages(client);result={pages:pages.length,sermons:pages.filter(p=>p.kind==='sermon').length,indexable:pages.filter(p=>p.indexable).length};}
 await client.query(write?'COMMIT':'ROLLBACK');console.log(JSON.stringify({outcome:'source_public_'+operation,result}));
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}finally{await pool.end();}}
main().catch(error=>{const message=error instanceof Error?error.message:'';console.error(JSON.stringify({outcome:'stopped_safely',code:/^source_public_[a-z_]+$/u.test(message)?message:'source_public_operation_failed'}));process.exitCode=1;});
