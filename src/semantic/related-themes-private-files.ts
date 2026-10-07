import {lstat,mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {isAbsolute,resolve,relative,dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function readSemanticPrivateJson(path:string):Promise<unknown>{
 if(!isAbsolute(path)||!(await lstat(path)).isFile()||(await lstat(path)).isSymbolicLink())throw Error('semantic_private_file_refused');
 const stat=await lstat(path);if(stat.size>64*1024*1024)throw Error('semantic_private_file_too_large');
 return JSON.parse(await readFile(path,'utf8'));
}
export async function semanticPrivateDirectory():Promise<string>{
 const root=resolve('private/related-themes');
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())throw Error('semantic_private_directory_refused');
 return root;
}
export async function saveSemanticPrivateJson(root:string,name:string,value:unknown):Promise<string>{
 if(!/^[a-z0-9.-]+\.private\.json$/.test(name))throw Error('semantic_private_name_refused');
 const path=join(root,name);if(relative(root,path).startsWith('..'))throw Error('semantic_private_path_refused');
 await mkdir(dirname(path),{recursive:true});
 const content=JSON.stringify(value);try{const existing=await readFile(path,'utf8');if(existing===content)return path;throw Error('semantic_existing_private_artifact_conflict');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const temporary=join(root,`.${name}.${randomUUID()}.tmp`);await writeFile(temporary,content,{flag:'wx',mode:0o600});await rename(temporary,path);return path;
}
