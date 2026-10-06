import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../migration/protected-local-postgres';
import {exportSermonAudioDataset} from './export-sermonaudio-dataset';
import {loadSermonAudioPortableDataset} from './sermonaudio-portable-dataset';
import {importTrackedProjectSermonSnapshot} from './import-project-sermon-snapshot';
async function main(){
 const command=process.argv[2];
 if(command==='export'){console.log(JSON.stringify(await exportSermonAudioDataset()));return;}
 if(command==='verify'||command==='dry-run'){const v=await loadSermonAudioPortableDataset();console.log(JSON.stringify({outcome:command==='verify'?'verified':'dry-run-valid',counts:v.manifest.counts,contentSha256:v.contentSha256,manifestSha256:v.manifestSha256,portableAcceptanceAuthority:false}));return;}
 if(command!=='import')throw Error('d175_dataset_command_refused');
 // Existing importer verifies uniquely named disposable PG16 targets. Never
 // use this Git snapshot to replace the working application database.
 const connectionString=process.env.DATABASE_URL;if(!connectionString)throw Error('d175_dataset_target_required');
 const u=new URL(connectionString),p=new Pool({host:u.hostname,port:Number(u.port),database:decodeURIComponent(u.pathname.slice(1)),user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1});
 try{console.log(JSON.stringify(await importTrackedProjectSermonSnapshot(p,{connectionString,datasetKind:'sermonaudio119',...(process.env.ALLOW_LOCAL_DB_WRITE?{writeOptIn:process.env.ALLOW_LOCAL_DB_WRITE}:{}),...(process.env.DISPOSABLE_TEST_DATABASE_TOKEN?{testRunToken:process.env.DISPOSABLE_TEST_DATABASE_TOKEN}: {})})));}finally{await p.end();}
}
main().catch(()=>{console.error(JSON.stringify({outcome:'stopped_safely',code:'d175_dataset_operation_refused'}));process.exitCode=1;});
