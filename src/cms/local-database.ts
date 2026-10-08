import {Pool} from "pg";
import {assertDisposableLocalDatabase} from "../migration/local-database-safety";
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from "../migration/protected-local-postgres";
export async function createCmsLocalPool(readOnly=false){
 const connectionString=process.env.DATABASE_URL;
 assertDisposableLocalDatabase(connectionString??"postgresql://127.0.0.1:5432/savinggrace_sermons_test");
 const connection=connectionString?{connectionString}:{host:"127.0.0.1",port:5432,database:"savinggrace_sermons_test",user:protectedLocalPostgresUser,password:await protectedLocalPostgresPassword()};
 return new Pool({...connection,max:4,options:(readOnly?"-c default_transaction_read_only=on ":"")+"-c timezone=UTC -c jit=off",statement_timeout:15000,application_name:readOnly?"cms-local-reader":"cms-local-writer"});
}
export async function verifyCmsLocalIdentity(pool:Pool){
 const row=(await pool.query("SELECT current_database() db,current_setting('server_version_num')::integer version,inet_server_port() port,host(inet_server_addr()) address")).rows[0];
 if(row.db!=="savinggrace_sermons_test"||row.version<160000||row.version>=170000||row.port!==5432||!["127.0.0.1","::1"].includes(row.address))throw Error("cms_local_identity_refused");
}
