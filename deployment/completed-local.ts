import {createServer} from 'node:http';
import {Pool} from 'pg';
import {execFileSync} from 'node:child_process';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';
import {verifyCompletedSchema} from '../src/staging/completed-schema';
import {loadCompletedCohort} from '../src/staging/completed-cohort';
import {createSealedStagingHandler} from '../src/staging/handler';
import {PostgresSermonRepository} from '../src/server/repositories/postgres-sermon-repository';
import {toWebRequest} from '../src/server/http/node-request-adapter';
async function main(){
 const port=Number(process.env.D171_LOCAL_PORT??'4407');
 if(!Number.isInteger(port)||port<1024||port>65535||process.env.DATABASE_URL||process.env.ENABLE_LOCAL_TEST_IDENTITIES)throw Error('d171_local_configuration_refused');
 await loadCompletedCohort(process.env.D171_COHORT_FILE??'');
 const pool=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:4,options:'-c default_transaction_read_only=on -c timezone=UTC'});
 const ready=async()=>{const c=await pool.connect();try{await c.query('BEGIN READ ONLY');const r=(await c.query("SELECT current_database()='savinggrace_sermons_test' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AND current_setting('transaction_read_only')='on' ok")).rows[0];if(!r?.ok)throw Error('d171_local_target_refused');await verifyCompletedSchema(c);}finally{await c.query('ROLLBACK');c.release();}};
 await ready();const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const handler=createSealedStagingHandler(new PostgresSermonRepository(pool,'d171_completed'),ready,commit);
 const server=createServer(async(req,res)=>{try{const r=await handler(await toWebRequest(req,`http://127.0.0.1:${port}`,16384));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(503,{'Cache-Control':'no-store'});res.end('unavailable');}});
 server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({status:'d171_local_ready',port,commit,readOnly:true})));
 const stop=()=>server.close(()=>void pool.end().then(()=>process.exit(0)));process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
main().catch(()=>{console.error('d171_local_startup_refused');process.exitCode=1;});
