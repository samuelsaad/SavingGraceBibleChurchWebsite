import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {sha256, SafeRetrievalError, type WordPressTranscriptSource} from './transcript-retrieval';

interface MetadataRow {source_id:number; title:string; service_date_local:string; source_status:string; source_modified_local:string; meta_key:string|null; meta_value:string|null;}
interface SpeakerRow {source_id:number; name:string;}
export function assembleSources(rows:readonly MetadataRow[], speakers:readonly SpeakerRow[]):WordPressTranscriptSource[] {
  const sources=new Map<number,WordPressTranscriptSource>();
  for(const row of rows){
    const id=Number(row.source_id);if(!Number.isSafeInteger(id)||id<=0)throw new SafeRetrievalError('source_identity_invalid');
    let source=sources.get(id);
    if(!source){source={sourceWordPressId:id,title:row.title,serviceDate:row.service_date_local.slice(0,10),status:row.source_status,sourceModifiedAt:row.source_modified_local,
      speakerNames:[...new Set(speakers.filter(s=>Number(s.source_id)===id).map(s=>s.name))],passageTexts:[],audioValues:[],youtubeValues:[],videoEmbedValues:[]};sources.set(id,source);}
    if(source.title!==row.title||source.serviceDate!==row.service_date_local.slice(0,10)||source.status!==row.source_status)throw new SafeRetrievalError('source_snapshot_conflict');
    const value=row.meta_value??'';
    if(row.meta_key==='asp_sermon_audio_embed')source.audioValues.push(value);
    if(row.meta_key==='asp_sermon_youtube')source.youtubeValues.push(value);
    if(row.meta_key==='asp_sermon_video_embed')source.videoEmbedValues.push(value);
    if(row.meta_key==='asp_sermon_bible_passage'&&value.trim())source.passageTexts.push(value);
  }
  return [...sources.values()].sort((a,b)=>a.sourceWordPressId-b.sourceWordPressId);
}
export async function retainedWordPressMetadata(root:string):Promise<{retrievedAt:string;sources:WordPressTranscriptSource[];metadataSha256:string;guardVerified:boolean;sourceOrigin:string;limitations:string[];artifactHashes:Record<string,string>}> {
  const files=['live-wordpress-evidence.private.json','live-wordpress-speakers.private.json','wordpress-media-evidence.private.json'];
  const values:Record<string,any>={},hashes:Record<string,string>={};
  for(const name of files){const raw=await readFile(root+'/'+name);hashes[name]=sha256(raw);values[name]=JSON.parse(raw.toString());}
  const raw=values[files[0]!]!,taxonomy=values[files[1]!]!,exported=values[files[2]!]!;
  if(raw.status!=='verified'||taxonomy.status!=='verified'||!Array.isArray(raw.rows)||!Array.isArray(taxonomy.rows)||!Array.isArray(exported.records))throw new SafeRetrievalError('retained_source_evidence_unverified');
  const exports=new Map<number,any>(exported.records.map((r:any)=>[Number(r.sourceWordPressId),r]));
  const rows:MetadataRow[]=raw.rows.map((r:any)=>({...r,source_modified_local:exports.get(Number(r.source_id))?.modifiedLocal??''}));
  const sources=assembleSources(rows,taxonomy.rows);
  for(const source of sources){
    const old=exports.get(source.sourceWordPressId);if(!old)continue;
    // Custom video markup is an additional exclusion source, not a fabricated
    // YouTube association. Newer explicit captured fields retain precedence.
    const embed=old.meta?.asp_sermon_video_embed;
    if(Array.isArray(embed))source.videoEmbedValues.push(...embed.filter((v:unknown):v is string=>typeof v==='string'));
    else if(typeof embed==='string')source.videoEmbedValues.push(embed);
  }
  return {retrievedAt:raw.retrievedAt,sources,metadataSha256:sha256(JSON.stringify(hashes)),guardVerified:false,sourceOrigin:'retained_read_only_wordpress_capture_and_export',
    limitations:['LIVE_REFRESH_STOPPED_ACCOUNT_HAS_PROCESS_EVENT_TRIGGER','CURRENT_WORDPRESS_CHANGES_NOT_RECHECKED'],artifactHashes:hashes};
}
async function protectedConfiguration():Promise<Record<string,string>> {
  const env:Record<string,string>={};
  for(const k of ['HOST','PORT','NAME','USER'])if(process.env['SG_LEGACY_DB_'+k])env[k]=process.env['SG_LEGACY_DB_'+k]!;
  for(const path of ['C:/Users/samue/SavingGraceBibleChurchWebsite/.env','C:/Users/samue/SavingGraceBibleChurchWebsite/.env.local']) {
    const text=await readFile(path,'utf8').catch(()=>null);if(!text)continue;
    for(const m of text.matchAll(/^\s*SG_LEGACY_DB_(HOST|PORT|NAME|USER)\s*=\s*(.*?)\s*$/gm))if(!env[m[1]!])env[m[1]!]=m[2]!.replace(/^(?:"|')|(?:"|')$/g,'');
  }
  if(!['HOST','PORT','NAME','USER'].every(k=>env[k])||!/^\d{1,5}$/.test(env.PORT!)||!/^\w+$/.test(env.NAME!))throw new SafeRetrievalError('protected_wordpress_configuration_unavailable');
  return env;
}
function parseRows(stdout:string):Record<string,unknown>[] {
  const rows:Record<string,unknown>[]=[];
  const visit=(v:unknown)=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if('rows'in v)visit(v.rows);else if('source_id'in v||'source_database'in v||'Grants for'in v||Object.keys(v).some(k=>k.startsWith('Grants for ')))rows.push(v as Record<string,unknown>);}};
  try{visit(JSON.parse(stdout));}catch{for(const line of stdout.split(/\r?\n/)){try{visit(JSON.parse(line));}catch{}}}
  return rows;
}
async function select(config:Record<string,string>, sql:string):Promise<Record<string,unknown>[]> {
  // MySQL Shell uses the owner's existing protected credential store. No
  // password, secret URI or credential value is supplied on its command line.
  return new Promise((resolve,reject)=>{
    const child=spawn('C:/Program Files/MySQL/MySQL Shell 26.7/bin/mysqlsh.exe',['--sql','--host='+config.HOST,'--port='+config.PORT,'--user='+config.USER,'--schema='+config.NAME,'--result-format=json/raw','--execute',sql],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let stdout='',hasStderr=false;const timer=setTimeout(()=>child.kill(),35000);
    child.stdout.setEncoding('utf8');child.stdout.on('data',(s:string)=>{stdout+=s;if(stdout.length>20_000_000)child.kill();});child.stderr.on('data',()=>{hasStderr=true;});
    child.once('error',()=>{clearTimeout(timer);reject(new SafeRetrievalError('protected_wordpress_connection_unavailable'));});
    child.once('close',code=>{clearTimeout(timer);if(code!==0||hasStderr){reject(new SafeRetrievalError('protected_wordpress_connection_unavailable'));return;}resolve(parseRows(stdout));});
  });
}
export async function retrieveWordPressMetadata():Promise<{retrievedAt:string;sources:WordPressTranscriptSource[];metadataSha256:string;guardVerified:boolean}> {
  const config=await protectedConfiguration();
  const guard=await select(config,'SELECT DATABASE() source_database, VERSION() source_version; SHOW GRANTS FOR CURRENT_USER;');
  const database=guard.find(r=>r.source_database);
  const grants=guard.flatMap(r=>Object.entries(r).filter(([k])=>k.startsWith('Grants for ')).map(([,v])=>String(v)));
  if(database?.source_database!==config.NAME||!/MariaDB/i.test(String(database?.source_version??''))||!grants.length||grants.some(g=>!/^GRANT (?:SELECT|USAGE)(?:, SELECT|, USAGE)* ON /i.test(g)||/WITH GRANT OPTION/i.test(g))) {
    console.log(JSON.stringify({stage:'wordpress_read_only_guard',databaseMatched:database?.source_database===config.NAME,mariaDBMatched:/MariaDB/i.test(String(database?.source_version??'')),grantRows:grants.length,guardRows:guard.length,
      privilegeClasses:grants.map(g=>/^GRANT ([A-Z, ]+) ON /i.exec(g)?.[1]??'unrecognized').filter(v=>/^[A-Z, ]+$/.test(v)||v==='unrecognized')}));
    throw new SafeRetrievalError('wordpress_read_only_grant_or_destination_guard_failed');
  }
  const query=`SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ; START TRANSACTION READ ONLY;
    SELECT p.ID source_id,p.post_title title,p.post_date service_date_local,p.post_modified source_modified_local,p.post_status source_status,m.meta_key,m.meta_value
    FROM wp_posts p LEFT JOIN wp_postmeta m ON m.post_id=p.ID AND m.meta_key IN ('asp_sermon_audio_embed','asp_sermon_youtube','asp_sermon_video_embed','asp_sermon_bible_passage')
    WHERE p.post_type='sermons' ORDER BY p.ID,m.meta_id;
    SELECT p.ID source_id,term.name FROM wp_posts p JOIN wp_term_relationships rel ON rel.object_id=p.ID
    JOIN wp_term_taxonomy taxonomy ON taxonomy.term_taxonomy_id=rel.term_taxonomy_id JOIN wp_terms term ON term.term_id=taxonomy.term_id
    WHERE p.post_type='sermons' AND taxonomy.taxonomy='sermon_speaker' ORDER BY p.ID,term.term_id; COMMIT;`;
  const all=await select(config,query);
  const meta=all.filter(r=>'meta_key'in r) as unknown as MetadataRow[];
  const speakers=all.filter(r=>'name'in r&&!('meta_key'in r)) as unknown as SpeakerRow[];
  if(!meta.length)throw new SafeRetrievalError('wordpress_source_rows_unavailable');
  const sources=assembleSources(meta,speakers);
  return {retrievedAt:new Date().toISOString(),sources,metadataSha256:sha256(JSON.stringify({meta,speakers})),guardVerified:true};
}
