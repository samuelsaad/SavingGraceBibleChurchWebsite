import {createCmsLocalPool,verifyCmsLocalIdentity} from '../src/cms/local-database';
import {readSourcePublicPages} from '../src/seo/source-public-store';
import {repairInheritedSourceAliases} from '../src/seo/source-alias-repair';
async function main(){const apply=process.argv[2]==='--apply';if(!['--apply','--dry-run'].includes(process.argv[2]??'')||process.argv.length!==3||apply&&process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('source_alias_repair_arguments');const pool=await createCmsLocalPool(!apply);try{await verifyCmsLocalIdentity(pool);const results=await repairInheritedSourceAliases(pool,await readSourcePublicPages(pool),apply);console.log(JSON.stringify({outcome:'source_alias_reconciliation',apply,results}));}finally{await pool.end();}}
void main().catch(()=>{console.error('source_alias_repair_refused');process.exitCode=1;});
