/** Rebuildable, release-bound RSS extraction cache; original XML remains the source. */
import{lstat,readFile}from'node:fs/promises';import{resolve}from'node:path';
import{sourceRssFactAssets,type SourceRssFactAsset}from'./rss-fact-manifest';
import{sourceRssFactsSchema,type SourceRssFacts}from'./rss-facts';
import{sha256,type SourcePublicPage}from'./source-public-model';
export async function readSourceRssFacts(pages:readonly SourcePublicPage[],storageDirectory:string,manifest:readonly SourceRssFactAsset[]=sourceRssFactAssets):Promise<ReadonlyMap<string,SourceRssFacts>>{
 const output=new Map<string,SourceRssFacts>();if(!manifest.some(entry=>pages.some(page=>page.path===entry.path&&page.responseSha256===entry.sourceResponseSha256&&!page.issues.length)))return output;
 const directory=resolve(storageDirectory,'source-public'),root=await lstat(directory);if(root.isSymbolicLink()||!root.isDirectory())throw Error('rss_fact_directory_refused');
 for(const entry of manifest){
  const page=pages.find(row=>row.path===entry.path&&!row.issues.length);if(!page?.asset||page.asset.contentType!=='application/rss+xml'||page.responseSha256!==entry.sourceResponseSha256)continue;
  const sourceFile=resolve(directory,page.asset.storageKey),sourceStat=await lstat(sourceFile);if(sourceStat.isSymbolicLink()||!sourceStat.isFile()||sourceStat.size!==page.asset.bytes||sourceStat.size>4_000_000||sha256(await readFile(sourceFile))!==entry.sourceResponseSha256)throw Error('rss_original_source_integrity');
  if(!/^[a-f0-9]{64}\.rssfacts$/u.test(entry.key)||entry.key!==entry.sha256+'.rssfacts'||!Number.isSafeInteger(entry.bytes)||entry.bytes<1||entry.bytes>5_000_000)throw Error('rss_fact_manifest_refused');
  const file=resolve(directory,entry.key),stat=await lstat(file);if(stat.isSymbolicLink()||!stat.isFile()||stat.nlink!==1||stat.size!==entry.bytes)throw Error('rss_fact_file_refused');
  const bytes=await readFile(file);if(sha256(bytes)!==entry.sha256)throw Error('rss_fact_integrity');const facts=sourceRssFactsSchema.parse(JSON.parse(bytes.toString('utf8')));
  const expected:Record<string,string>={'/feed/':'posts','/category/posts/feed/':'posts','/sermons/feed/':'sermons','/events/feed/':'events'};
  if(facts.responseSha256!==entry.sourceResponseSha256||facts.kind!==expected[entry.path])throw Error('rss_fact_source_binding');output.set(entry.path,facts);
 }
 return output;
}
