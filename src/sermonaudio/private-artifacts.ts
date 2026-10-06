import {readFile,writeFile,lstat,rename} from 'node:fs/promises';
import {sha256,SafeRetrievalError} from './transcript-retrieval';
export async function persistImmutable(path:string,bytes:string|Uint8Array):Promise<void>{
 const stat=await lstat(path).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw new SafeRetrievalError('private_artifact_inspection_failed');});
 if(stat){if(!stat.isFile()||stat.isSymbolicLink())throw new SafeRetrievalError('private_artifact_link_or_type_rejected');if(sha256(await readFile(path))!==sha256(bytes))throw new SafeRetrievalError('private_artifact_conflict');return;}
 try{await writeFile(path,bytes,{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw new SafeRetrievalError('private_artifact_write_failed');return persistImmutable(path,bytes);}
 if(sha256(await readFile(path))!==sha256(bytes))throw new SafeRetrievalError('private_artifact_reread_hash_mismatch');
}
export async function persistCheckpoint(path:string,value:object):Promise<void>{
 const stat=await lstat(path).catch(()=>null);if(stat&&(!stat.isFile()||stat.isSymbolicLink()))throw new SafeRetrievalError('checkpoint_link_or_type_rejected');
 const temp=path+'.'+process.pid+'.tmp';
 await writeFile(temp,JSON.stringify({...value,integritySha256:sha256(JSON.stringify(value))}),{flag:'wx',mode:0o600});
 await rename(temp,path);
}
export async function readCheckpoint<T>(path:string):Promise<T>{
 const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink())throw new SafeRetrievalError('checkpoint_link_or_type_rejected');
 const {integritySha256,...value}=JSON.parse(await readFile(path,'utf8')) as Record<string,unknown>;
 if(sha256(JSON.stringify(value))!==integritySha256)throw new SafeRetrievalError('checkpoint_integrity_conflict');return value as T;
}
