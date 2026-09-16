import { Pool } from "pg";
import { isAbsolute } from "node:path";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";
import { runRestrictedAcceptanceCommand } from "../src/application/restricted-acceptance-command";
async function main() {
  const directory=process.env.D158_PRIVATE_DIRECTORY;
  if(!directory || !isAbsolute(directory)) throw new Error("private_directory_required");
  const pool=new Pool({host:"127.0.0.1",port:5432,database:"savinggrace_sermons_test",user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1});
  try{process.stdout.write(JSON.stringify(await runRestrictedAcceptanceCommand(pool,"local_loopback",directory,process.argv[2]??""))+"\n");}
  finally{await pool.end();}
}
main().catch(error=>{process.stderr.write(error instanceof Error && /^(restricted_[a-z_]+)$/.test(error.message)?error.message+"\n":"restricted_command_failed\n");process.exitCode=1;});
