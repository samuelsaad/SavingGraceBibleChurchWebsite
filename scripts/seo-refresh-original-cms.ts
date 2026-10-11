import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createCmsLocalPool,verifyCmsLocalIdentity} from '../src/cms/local-database';
import {PostgresCmsRepository} from '../src/cms/postgres-repository';
import {readSourcePublicPages} from '../src/seo/source-public-store';
import {sourceBundleSchema,sha256} from '../src/seo/source-public-model';
import {originalSourceCmsRefresh} from '../src/seo/source-cms-refresh';
async function main(){
 const [mode,path]=process.argv.slice(2),apply=mode==='--apply';if(!['--apply','--dry-run'].includes(mode??'')||!path||!resolve(path).replaceAll('\\','/').split('/').includes('private')||apply&&process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('source_cms_refresh_arguments');
 const bytes=await readFile(path),previous=sourceBundleSchema.parse(JSON.parse(bytes.toString())),pool=await createCmsLocalPool(!apply);
 try{
  await verifyCmsLocalIdentity(pool);const repository=new PostgresCmsRepository(pool),entities=await repository.list(),snapshot=await repository.getPublishedSnapshot(),current=await readSourcePublicPages(pool),plan=originalSourceCmsRefresh(previous.pages,current,entities,snapshot.routes);let refreshed=0;
  if(apply)for(const update of plan.updates){const actor={subject:'source-public-migration',role:'system' as const,correlationId:'d182-original-source-refresh'},saved=await repository.save(update.entity.id,{expectedRowVersion:update.entity.rowVersion,content:update.content},actor);if(update.publish)await repository.publish(saved.id,{expectedRowVersion:saved.rowVersion,revisionId:saved.draftRevisionId},actor);refreshed++;}
  await mkdir('private/seo-cms-adoption',{recursive:true});const receipt={at:new Date().toISOString(),apply,priorBundleSha256:sha256(bytes),planned:plan.updates.length,refreshed,unchanged:plan.unchanged,held:plan.held};await writeFile('private/seo-cms-adoption/refresh-'+Date.now()+'.private.json',JSON.stringify(receipt),{flag:'wx',mode:0o600});console.log(JSON.stringify({...receipt,held:plan.held.length}));
 }finally{await pool.end();}
}
void main().catch(()=>{console.error('source_cms_refresh_refused');process.exitCode=1;});
