/** Non-HTTP D-179 operator. No secret, content body or raw error is emitted. */
import {Pool} from "pg";
import {stagingConfiguration,stagingPassword,verifyStagingIdentity} from "../staging/guard";
import {verifyCmsSchema,applyCmsMigration} from "./migration";
import {PostgresCmsRepository} from "./postgres-repository";
import {buildCmsSeeds,buildCmsEmbeddedAssetSeeds} from "./seed";
async function main(){
 if(process.env.ALLOW_STAGING_CMS_SYNC!=="1"||process.env.CMS_TARGET!=="existing-protected"||process.env.D171_COMPLETED_ENABLED!=="1"||process.env.D175_COMPLETED_ENABLED!=="1")throw Error("cms_maintenance_gate_refused");
 const config=stagingConfiguration(process.env,true),pool=new Pool({...config,password:stagingPassword(config.passwordFile)});
 try{
  const command=process.argv[2];if(!["initialize","verify"].includes(command??""))throw Error("cms_maintenance_command_refused");
  const c=await pool.connect();let migration="unchanged";
  try{await c.query("BEGIN");await verifyStagingIdentity(c,true);await verifyCmsSchema(c,{allowPreMigration:command==="initialize"});if(command==="initialize")migration=await applyCmsMigration(c);await c.query("COMMIT");}catch(error){await c.query("ROLLBACK");throw error;}finally{c.release();}
  const repository=new PostgresCmsRepository(pool);let seeds={inserted:0,unchanged:0},assetsInserted=0;
  if(command==="initialize"){
   for(const asset of buildCmsEmbeddedAssetSeeds()){
    const result=await pool.query("INSERT INTO media_assets(storage_provider,storage_key,original_filename,content_type,size_bytes,width_pixels,height_pixels,checksum_sha256,alt_text,source_url,availability_status) VALUES('cms_embedded',$1,$2,$3,$4,$5,$6,$7,$8,$9,'available') ON CONFLICT(storage_provider,storage_key) DO NOTHING",[asset.key,asset.originalFilename,asset.contentType,asset.sizeBytes,asset.width,asset.height,asset.checksumSha256,asset.alt,asset.path]);assetsInserted+=result.rowCount??0;
   }
   seeds=await repository.seed(buildCmsSeeds(),"d179-staging-initialization");
  }
  const check=await pool.connect();try{await verifyCmsSchema(check);}finally{check.release();}
  const counts=(await pool.query("SELECT (SELECT count(*)::int FROM cms_entities) entities,(SELECT count(*)::int FROM cms_revisions) revisions,(SELECT count(*)::int FROM cms_routes) routes,(SELECT count(*)::int FROM cms_entities WHERE published_revision_id IS NOT NULL) published")).rows[0];
  process.stdout.write(JSON.stringify({outcome:"cms_"+command,migration,seeds,assetsInserted,counts})+"\n");
 }finally{await pool.end();}
}
void main().catch(()=>{process.stderr.write("cms_maintenance_refused\n");process.exitCode=1;});
