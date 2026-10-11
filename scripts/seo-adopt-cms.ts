import {mkdir,writeFile} from 'node:fs/promises';
import {createCmsLocalPool,verifyCmsLocalIdentity} from '../src/cms/local-database';
import {PostgresCmsRepository} from '../src/cms/postgres-repository';
import {readSourcePublicPages} from '../src/seo/source-public-store';
import {adoptSourceCmsAssets} from '../src/seo/source-cms-assets';
import {PostgresCmsAssetStore} from '../src/cms/assets';
import {sourceCmsAdoption} from '../src/seo/source-cms-adoption';
async function main(){const apply=process.argv[2]==='--apply';if(!apply&&process.argv[2]!=='--dry-run'||apply&&process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('source_cms_arguments');
 const pool=await createCmsLocalPool(!apply);try{await verifyCmsLocalIdentity(pool);const repository=new PostgresCmsRepository(pool),pages=await readSourcePublicPages(pool),entities=await repository.list(),snapshot=await repository.getPublishedSnapshot();const plan=sourceCmsAdoption(pages,entities,snapshot.routes);let result;
 if(apply){if(!process.env.CMS_STORAGE_DIRECTORY)throw Error('source_cms_assets_required');const assets=await adoptSourceCmsAssets(pages,process.env.CMS_STORAGE_DIRECTORY,new PostgresCmsAssetStore(pool));result={cms:await repository.seed(plan.seeds.map(seed=>({...seed,publish:process.env.SOURCE_CMS_LOCAL_PUBLISH==='1'})),'source-public-migration'),assets:{inserted:assets.inserted,unchanged:assets.unchanged,held:assets.held.length}};}
 await mkdir('private/seo-cms-adoption',{recursive:true});const receipt={capturedAt:new Date().toISOString(),apply,planned:plan.seeds.length,plannedByKind:Object.fromEntries(['page','post','event'].map(kind=>[kind,plan.seeds.filter(s=>s.kind===kind).length])),unchanged:plan.unchanged,held:plan.held,result};await writeFile(`private/seo-cms-adoption/${Date.now()}.private.json`,JSON.stringify(receipt),{flag:'wx',mode:0o600});console.log(JSON.stringify({...receipt,held:plan.held.reduce<Record<string,number>>((counts,item)=>({...counts,[item.reason]:(counts[item.reason]??0)+1}),{})}));
 }finally{await pool.end();}}
main().catch(()=>{console.error('source_cms_adoption_refused');process.exitCode=1;});
