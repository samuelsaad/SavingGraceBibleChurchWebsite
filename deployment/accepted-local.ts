import { createServer } from "node:http";
import { Pool } from "pg";
import { execFileSync } from "node:child_process";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";
import { verifyReleaseSchema } from "../src/staging/database-verification";
import { verifyRestrictedPublicationBoundary } from "../src/staging/restricted-publication-boundary";
import { createSealedStagingHandler } from "../src/staging/handler";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";
import { toWebRequest } from "../src/server/http/node-request-adapter";

async function main() {
  const port=Number(process.env.RESTRICTED_LOCAL_PORT??"4381");
  if(!Number.isInteger(port)||port<1024||port>65535||process.env.ENABLE_LOCAL_TEST_IDENTITIES||process.env.ENABLE_LOCAL_DASHBOARD||process.env.DATABASE_URL) throw new Error("restricted_local_configuration_refused");
  const commit=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  const pool=new Pool({host:"127.0.0.1",port:5432,database:"savinggrace_sermons_test",user:protectedLocalPostgresUser,
    password:protectedLocalPostgresPassword,max:4,options:"-c default_transaction_read_only=on -c timezone=UTC",statement_timeout:30000});
  const ready=async()=>{const c=await pool.connect();try{
    await c.query("BEGIN READ ONLY");
    const identity=(await c.query(`SELECT current_database()='savinggrace_sermons_test' AND inet_server_addr()='127.0.0.1'::inet
      AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999
      AND current_setting('transaction_read_only')='on' AS ok`)).rows[0];
    if(!identity?.ok) throw new Error("restricted_local_target_refused");
    await verifyReleaseSchema(c);await verifyRestrictedPublicationBoundary(c,"local_loopback");
  }finally{await c.query("ROLLBACK");c.release();}};
  await ready();
  const d162Enabled=process.env.D162_RESTRICTED_ACCEPTANCE_ENABLED==="1";
  const d161Enabled=process.env.D161_RESTRICTED_ACCEPTANCE_ENABLED==="1";
  const scope=d162Enabled?"d162_restricted_accepted":d161Enabled?"d161_restricted_accepted":"restricted_accepted";
  const handler=createSealedStagingHandler(new PostgresSermonRepository(pool,scope),ready,commit,process.env.RESTRICTED_FRONTEND_DISABLED==="1");
  const server=createServer(async(req,res)=>{try{
    const response=await handler(await toWebRequest(req,`http://127.0.0.1:${port}`,16384));
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(400,{"Cache-Control":"no-store","X-Robots-Tag":"noindex"});res.end("request_refused");}});
  server.requestTimeout=15000;server.headersTimeout=10000;
  server.listen(port,"127.0.0.1",()=>process.stdout.write(JSON.stringify({status:"restricted_local_frontend_ready",commit,port,authentication:"private_routes_disabled"})+"\n"));
  const stop=()=>server.close(()=>{void pool.end().then(()=>process.exit(0));});process.once("SIGTERM",stop);process.once("SIGINT",stop);
}
main().catch(()=>{process.stderr.write("restricted_local_startup_refused\n");process.exitCode=1;});
