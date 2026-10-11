import {createHash,randomUUID} from "node:crypto";
import {mkdir,lstat,realpath,open,readFile} from "node:fs/promises";
import {isAbsolute,resolve,dirname,parse} from "node:path";
import type {Pool} from "pg";
import type {IdentityProvider} from "../server/auth/identity-provider";
import {buildCmsEmbeddedAssetSeeds} from "./seed";
export const cmsUploadMaximum=20*1024*1024;
const keyPattern=/^[a-f0-9]{64}\.(?:png|jpg|webp|gif|pdf)$/;
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow, noarchive","Referrer-Policy":"no-referrer"};
export type CmsAssetActor=string|{subject:string;role:'system';correlationId:string};
export type CmsAsset={id:string;url:string;name:string;type:string;size:number;width:number|null;height:number|null;alt:string;storageKey:string};
export interface CmsAssetStore{list():Promise<CmsAsset[]>;save(asset:CmsAsset,hash:string,actor?:CmsAssetActor):Promise<CmsAsset>;find(key:string):Promise<CmsAsset|null>;}
export class PostgresCmsAssetStore implements CmsAssetStore{
 constructor(private readonly pool:Pool){}
 private map(row:Record<string,unknown>):CmsAsset{return{id:String(row.id),url:"/cms-assets/"+row.storage_key,name:String(row.original_filename??"Upload"),type:String(row.content_type),size:Number(row.size_bytes),width:row.width_pixels===null?null:Number(row.width_pixels),height:row.height_pixels===null?null:Number(row.height_pixels),alt:String(row.alt_text??""),storageKey:String(row.storage_key)};}
 async list(){return(await this.pool.query("SELECT * FROM media_assets WHERE storage_provider='cms_local' AND availability_status='available' ORDER BY created_at DESC,id LIMIT 1000")).rows.map(r=>this.map(r));}
 async find(key:string){const row=(await this.pool.query("SELECT * FROM media_assets WHERE storage_provider='cms_local' AND storage_key=$1 AND availability_status='available'",[key])).rows[0];return row?this.map(row):null;}
 async save(a:CmsAsset,hash:string,actor:CmsAssetActor="cms-admin"){
  const c=await this.pool.connect();try{await c.query("BEGIN");await c.query("SET LOCAL savinggrace.application_request='on'");
   const inserted=await c.query("INSERT INTO media_assets(id,storage_provider,storage_key,original_filename,content_type,size_bytes,width_pixels,height_pixels,checksum_sha256,alt_text,availability_status) VALUES($1,'cms_local',$2,$3,$4,$5,$6,$7,$8,$9,'available') ON CONFLICT(storage_provider,storage_key) DO NOTHING RETURNING id",[a.id,a.storageKey,a.name,a.type,a.size,a.width,a.height,hash,a.alt]);
   const row=(await c.query("SELECT * FROM media_assets WHERE storage_provider='cms_local' AND storage_key=$1",[a.storageKey])).rows[0],stored=row?this.map(row):null;if(!stored||stored.type!==a.type||stored.size!==a.size||row.checksum_sha256!==hash)throw Error("cms_asset_metadata_conflict");
   if(inserted.rowCount)await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id) VALUES($1,$2,$3,'cms_asset',$4,$5::jsonb,$6)",[typeof actor==='string'?actor:actor.subject,typeof actor==='string'?'admin':actor.role,typeof actor==='string'?'cms.asset.upload':'cms.asset.import',stored.id,JSON.stringify(["asset"]),typeof actor==='string'?randomUUID():actor.correlationId]);
   await c.query("COMMIT");return stored;
  }catch(error){await c.query("ROLLBACK");throw error;}finally{c.release();}
 }
}
export function inspectCmsUpload(bytes:Uint8Array,contentType:string){
 const b=Buffer.from(bytes),type=contentType.split(";")[0]?.trim().toLowerCase();let ext:string,width:number|null=null,height:number|null=null;
 if(b.length===0||b.length>cmsUploadMaximum)throw Error("cms_upload_size_refused");
 if(type==="image/png"&&b.length>=33&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.toString("ascii",12,16)==="IHDR"){ext="png";width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
 else if(type==="image/gif"&&b.length>=14&&/^GIF8[79]a$/.test(b.toString("ascii",0,6))){ext="gif";width=b.readUInt16LE(6);height=b.readUInt16LE(8);}
 else if(type==="image/jpeg"&&b.length>=4&&b[0]===255&&b[1]===216&&b[b.length-2]===255&&b[b.length-1]===217){
  ext="jpg";let p=2;while(p+4<b.length){if(b[p]!==255)break;const marker=b[p+1]!;p+=2;if(marker===218||marker===217)break;if(marker===1||(marker>=208&&marker<=215))continue;const length=b.readUInt16BE(p);if(length<2||p+length>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=b.readUInt16BE(p+3);width=b.readUInt16BE(p+5);break;}p+=length;}
 }
 else if(type==="image/webp"&&b.length>=30&&b.toString("ascii",0,4)==="RIFF"&&b.toString("ascii",8,12)==="WEBP"&&b.readUInt32LE(4)+8===b.length){
  ext="webp";const kind=b.toString("ascii",12,16);
  if(kind==="VP8X"){width=1+b.readUIntLE(24,3);height=1+b.readUIntLE(27,3);}
  else if(kind==="VP8 "&&b[23]===157&&b[24]===1&&b[25]===42){width=b.readUInt16LE(26)&16383;height=b.readUInt16LE(28)&16383;}
  else if(kind==="VP8L"&&b[20]===47){const bits=b.readUInt32LE(21);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
 }
 else if(type==="application/pdf"&&b.length>=16&&/^%PDF-1\.[0-9]/.test(b.toString("ascii",0,8))&&b.subarray(Math.max(0,b.length-1024)).includes(Buffer.from("%%EOF"))){ext="pdf";}
 else throw Error("cms_upload_type_refused");
 if(ext!=="pdf"&&(!width||!height||width*height>40000000||width>20000||height>20000||b.length>10*1024*1024))throw Error("cms_upload_dimensions_refused");
 return{type:type!,ext,width,height};
}
export class CmsDiskAssets{
 private constructor(readonly directory:string,private readonly store:CmsAssetStore){}
 static async create(directory:string,store:CmsAssetStore){
  if(!isAbsolute(directory)||resolve(directory)===parse(resolve(directory)).root)throw Error("cms_asset_root_refused");
  const absolute=resolve(directory);await mkdir(absolute,{recursive:true,mode:0o700});
  let current=absolute;while(current!==dirname(current)){if((await lstat(current)).isSymbolicLink())throw Error("cms_asset_symlink_refused");current=dirname(current);}
  if(await realpath(absolute)!==absolute)throw Error("cms_asset_root_refused");return new CmsDiskAssets(absolute,store);
 }
 async upload(bytes:Uint8Array,type:string,filename:string,alt="",actor:CmsAssetActor="cms-admin"){
  const info=inspectCmsUpload(bytes,type),hash=createHash("sha256").update(bytes).digest("hex"),key=hash+"."+info.ext,target=resolve(this.directory,key);
  try{const handle=await open(target,"wx",0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}}
  catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;const stat=await lstat(target);if(!stat.isFile()||stat.isSymbolicLink()||createHash("sha256").update(await readFile(target)).digest("hex")!==hash)throw Error("cms_asset_storage_conflict");}
  const name=filename.replace(/[\\/\x00-\x1f\x7f]/g,"_").slice(0,180).trim()||"Upload."+info.ext;
  return this.store.save({id:randomUUID(),url:"/cms-assets/"+key,name,type:info.type,size:bytes.length,width:info.width,height:info.height,alt:alt.slice(0,500),storageKey:key},hash,actor);
 }
 list(){return this.store.list();}
 async read(key:string){if(!keyPattern.test(key))return null;const asset=await this.store.find(key);if(!asset)return null;const path=resolve(this.directory,key),stat=await lstat(path).catch(()=>null);if(!stat?.isFile()||stat.isSymbolicLink()||await realpath(path)!==path)return null;const bytes=await readFile(path);if(createHash("sha256").update(bytes).digest("hex")!==key.slice(0,64))throw Error("cms_asset_integrity_refused");return{asset,bytes};}
}
export function createCmsAssetHandler(assets:CmsDiskAssets,identity:IdentityProvider,security:{authorizeMutation(request:Request):boolean|Promise<boolean>},canReadAsset:(key:string,draft:boolean)=>Promise<boolean>){
 return async(request:Request):Promise<Response|null>=>{
  const path=new URL(request.url).pathname;const isAdmin=path==="/api/v1/admin/cms/assets"||path==="/api/v1/admin/cms/assets/upload";
  if(!isAdmin&&!path.startsWith("/cms-assets/"))return null;
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,"Content-Type":"application/json"}});
  try{
   const user=await identity.authenticate(request),authenticated=user?.role==="admin";
   const header=(name:string)=>{try{return decodeURIComponent(request.headers.get(name)??"");}catch{throw Error("cms_upload_header_refused");}};
   const present=(a:CmsAsset)=>({...a,mimeType:a.type,caption:""});
   if(isAdmin){
    if(!authenticated)return json({error:{code:"authentication_required"}},401);
    if(path.endsWith("/upload")){
     if(request.method!=="POST")return json({error:{code:"method_not_allowed"}},405);
     if(!await security.authorizeMutation(request))return json({error:{code:"csrf_required"}},403);
     if(Number(request.headers.get("content-length")??0)>cmsUploadMaximum)return json({error:{code:"cms_upload_size_refused"}},413);
     const bytes=new Uint8Array(await request.arrayBuffer());const asset=await assets.upload(bytes,request.headers.get("content-type")??"",header("x-upload-filename")||"Upload",header("x-upload-alt"),user!.subject);return json({asset:{...present(asset),caption:header("x-upload-caption").slice(0,1000)}},201);
    }
    if(request.method!=="GET")return json({error:{code:"method_not_allowed"}},405);
    const data=[...(await assets.list()).map(present),...buildCmsEmbeddedAssetSeeds().map(a=>({id:a.key,url:a.path,name:a.originalFilename,type:a.contentType,mimeType:a.contentType,size:a.sizeBytes,width:a.width,height:a.height,alt:a.alt,caption:"",storageKey:a.key}))];return json({data});
   }
   if(!["GET","HEAD"].includes(request.method))return json({error:{code:"method_not_allowed"}},405);
   const key=path.slice("/cms-assets/".length);if(!keyPattern.test(key)||(!authenticated&&!await canReadAsset(key,false)))return json({error:{code:"not_found"}},404);
   const result=await assets.read(key);if(!result)return json({error:{code:"not_found"}},404);
   return new Response(request.method==="HEAD"?null:new Uint8Array(result.bytes),{headers:{...headers,"Content-Type":result.asset.type,"Content-Length":String(result.bytes.length),"Content-Security-Policy":"default-src 'none'; sandbox; frame-ancestors 'none'",...(result.asset.type==="application/pdf"?{"Content-Disposition":'attachment; filename="document.pdf"'}:{})}});
  }catch(error){const code=error instanceof Error&&/^cms_upload_/.test(error.message)?error.message:"cms_asset_unavailable";return json({error:{code}},code.startsWith("cms_upload_")?400:503);}
 };
}
