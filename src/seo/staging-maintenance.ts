/** Non-HTTP D-181 migration/import into the exact existing sealed staging DB. */
import {Pool} from 'pg';
import {lstat,readFile} from 'node:fs/promises';
import {stagingConfiguration,stagingPassword,verifyStagingIdentity} from '../staging/guard';
import {applySourcePublicMigration,importSourcePublicBundle,readSourcePublicPages,restoreSourcePublicImport} from './source-public-store';
import {sha256,stableJson} from './source-public-model';
import {PostgresCmsRepository} from '../cms/postgres-repository';
import {PostgresCmsAssetStore} from '../cms/assets';
import {sourceCmsAdoption} from './source-cms-adoption';
import {adoptSourceCmsAssets} from './source-cms-assets';

async function main(){
 if(process.env.ALLOW_STAGING_SOURCE_PUBLIC_SYNC!=='1'||process.env.SOURCE_PUBLIC_TARGET!=='existing-protected'||process.env.D171_COMPLETED_ENABLED!=='1'||process.env.D175_COMPLETED_ENABLED!=='1')throw Error('source_public_maintenance_gate');
 const operation=process.argv[2];if(!['apply','import','inventory','restore','cms-plan','adopt-cms'].includes(operation??'')||process.argv.length!==3)throw Error('source_public_maintenance_operation');
 const config=stagingConfiguration(process.env,true),pool=new Pool({...config,password:stagingPassword(config.passwordFile),statement_timeout:120000});
 try{
  if(operation==='cms-plan'||operation==='adopt-cms'){
   if(process.env.SOURCE_CMS_ADOPTION!=='1'||!process.env.CMS_STORAGE_DIRECTORY)throw Error('source_cms_staging_gate');
   const guard=await pool.connect();try{await guard.query('BEGIN READ ONLY');await verifyStagingIdentity(guard,true);await guard.query('ROLLBACK');}finally{guard.release();}
   const repository=new PostgresCmsRepository(pool),pages=await readSourcePublicPages(pool),snapshot=await repository.getPublishedSnapshot(),plan=sourceCmsAdoption(pages,await repository.list(),snapshot.routes),planSha256=sha256(stableJson(plan.seeds));
   if(operation==='cms-plan'){console.log(JSON.stringify({outcome:'source_cms_plan',planned:plan.seeds.length,planSha256,held:plan.held.length}));return;}
   if(plan.seeds.length&&planSha256!==process.env.SOURCE_CMS_PLAN_SHA256)throw Error('source_cms_staging_scope');
   const assets=await adoptSourceCmsAssets(pages,process.env.CMS_STORAGE_DIRECTORY,new PostgresCmsAssetStore(pool)),result=await repository.seed(plan.seeds,'source-public-migration');
   console.log(JSON.stringify({outcome:'source_cms_adopted',result,alreadyAdopted:plan.unchanged,assets:{inserted:assets.inserted,unchanged:assets.unchanged,held:assets.held.length}}));return;
  }
  const c=await pool.connect();try{
   await c.query(operation==='inventory'?'BEGIN READ ONLY':'BEGIN');await verifyStagingIdentity(c,true);
   let result:unknown;
   if(operation==='apply')result={migration:await applySourcePublicMigration(c)};
   else if(operation==='import'){
    const path='/run/source-public/bundle.json',stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>128*1024*1024)throw Error('source_public_bundle_file');
    const bytes=await readFile(path);if(!/^[a-f0-9]{64}$/u.test(process.env.SOURCE_PUBLIC_BUNDLE_SHA256??'')||sha256(bytes)!==process.env.SOURCE_PUBLIC_BUNDLE_SHA256)throw Error('source_public_bundle_hash');
    result=await importSourcePublicBundle(c,JSON.parse(bytes.toString('utf8')),process.env.RELEASE_COMMIT!);
   }else if(operation==='restore')result=await restoreSourcePublicImport(c,process.env.SOURCE_PUBLIC_IMPORT_SHA256??'',process.env.RELEASE_COMMIT!);
   else{const pages=await readSourcePublicPages(c);result={pages:pages.length,sermons:pages.filter(page=>page.kind==='sermon').length,indexable:pages.filter(page=>page.indexable).length};}
   await c.query(operation==='inventory'?'ROLLBACK':'COMMIT');process.stdout.write(JSON.stringify({outcome:'source_public_'+operation,result})+'\n');
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
 }finally{await pool.end();}
}
void main().catch(()=>{process.stderr.write('source_public_staging_maintenance_refused\n');process.exitCode=1;});
