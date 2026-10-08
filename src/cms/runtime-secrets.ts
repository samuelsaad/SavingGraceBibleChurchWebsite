import {lstat,readFile,realpath} from "node:fs/promises";
import {isAbsolute,resolve} from "node:path";
/** Secret bytes never enter arguments, responses or logs. Callers supply a protected mount. */
export async function readCmsSecret(filename:string):Promise<string>{
 if(!isAbsolute(filename))throw Error("cms_secret_path_refused");
 const path=resolve(filename),stat=await lstat(path);
 if(!stat.isFile()||stat.isSymbolicLink()||await realpath(path)!==path||(process.platform!=="win32"&&(stat.mode&0o077)!==0))throw Error("cms_secret_permissions_refused");
 const secret=(await readFile(path,"utf8")).trim();if(!/^[a-f0-9]{64}$/.test(secret))throw Error("cms_secret_format_refused");return secret;
}

