import {readFile,lstat} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {configureCompletedCohort} from '../domain/completed-staging';
export async function loadCompletedCohort(path:string){
 if(!isAbsolute(path))throw Error('d171_cohort_path_refused');
 const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||st.size>65536)throw Error('d171_cohort_file_refused');
 const json=JSON.parse(await readFile(path,'utf8'));
 if(json.decision!=='D-171'||Object.keys(json).sort().join(',')!=='decision,ids')throw Error('d171_cohort_file_refused');
 configureCompletedCohort(json.ids);
}
