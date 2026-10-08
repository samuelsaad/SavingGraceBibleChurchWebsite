import {lstat,realpath,writeFile} from "node:fs/promises";
import {isAbsolute,resolve} from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {createCmsLocalPool,verifyCmsLocalIdentity} from "./local-database";
import {verifyCmsSchema,applyCmsMigration} from "./migration";
import {cmsPreservationFingerprint,captureCmsRecovery,initializeCmsSeeds} from "./initialization";
async function main(){
 if(process.env.NODE_ENV==="production"||process.argv[2]!=="initialize")throw Error("cms_local_initializer_refused");
 const root=process.env.CMS_RECOVERY_DIRECTORY??"";if(!isAbsolute(root))throw Error("cms_recovery_directory_required");
 const directory=resolve(root),info=await lstat(directory);if(!info.isDirectory()||info.isSymbolicLink()||await realpath(directory)!==directory||(process.platform!=="win32"&&(info.mode&0o077)!==0))throw Error("cms_recovery_permissions_refused");
 const pool=await createCmsLocalPool();try{
  await verifyCmsLocalIdentity(pool);const c=await pool.connect();let before,backup,migration;
  try{await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await c.query("SET LOCAL timezone='UTC'");await verifyCmsSchema(c,{allowPreMigration:true});before=await cmsPreservationFingerprint(c);backup=await captureCmsRecovery(c);await c.query("COMMIT");}catch(error){await c.query("ROLLBACK");throw error;}finally{c.release();}
  const bytes=JSON.stringify({createdAt:new Date().toISOString(),before,backup}),backupSha256=createHash("sha256").update(bytes).digest("hex");
  await writeFile(resolve(directory,Date.now()+"-"+randomUUID()+".cms-recovery.private.json"),bytes,{flag:"wx",mode:0o600});
  const m=await pool.connect();try{await m.query("BEGIN");migration=await applyCmsMigration(m);await m.query("COMMIT");}catch(error){await m.query("ROLLBACK");throw error;}finally{m.release();}
  const seeds=await initializeCmsSeeds(pool,"d179-local-initialization");
  const verify=await pool.connect();let after;try{await verify.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await verifyCmsSchema(verify);after=await cmsPreservationFingerprint(verify);await verify.query("COMMIT");}finally{verify.release();}
  if(before.sha256!==after.sha256)throw Error("cms_unrelated_preservation_failed");
  process.stdout.write(JSON.stringify({outcome:"cms_initialized",migration,seeds,backupSha256,preservationSha256:after.sha256,unrelatedPreserved:true})+"\n");
 }finally{await pool.end();}
}
void main().catch(error=>{const code=error instanceof Error&&/^cms_[a-z_]+$/.test(error.message)?error.message:"cms_initialization_refused";process.stderr.write(code+"\n");process.exitCode=1;});
