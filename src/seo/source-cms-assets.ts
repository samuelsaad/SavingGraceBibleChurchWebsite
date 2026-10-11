/** Register already verified original files in the existing editable asset library. */
import {readFile,lstat,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {CmsDiskAssets,inspectCmsUpload,type CmsAssetStore} from '../cms/assets';
import {sha256,type SourcePublicPage} from './source-public-model';
import type {SourceNode} from '../domain/source-content';
export async function adoptSourceCmsAssets(pages:readonly SourcePublicPage[],directory:string,store:CmsAssetStore){
 const disk=await CmsDiskAssets.create(directory,store),root=await realpath(join(directory,'source-public')),seen=new Set<string>();let inserted=0,unchanged=0;
 const held:Array<{path:string;reason:string}>=[];const assetIds:Record<string,string>={};
 const alts=new Map<string,Set<string>>();const visit=(nodes:readonly SourceNode[])=>{for(const node of nodes){if(node.src&&node.alt?.trim()){try{const url=new URL(node.src,'https://www.savinggrace.org.au');if(['www.savinggrace.org.au','savinggrace.org.au'].includes(url.hostname)){const values=alts.get(url.pathname)??new Set<string>();values.add(node.alt);alts.set(url.pathname,values);}}catch{}}visit(node.children??[]);}};for(const page of pages)visit(page.content);
 for(const page of pages){
  if(page.kind!=='asset'||!page.asset||!['image/png','image/jpeg','image/gif','image/webp','application/pdf'].includes(page.asset.contentType)||page.issues.length)continue;
  if(seen.has(page.asset.storageKey))continue;seen.add(page.asset.storageKey);
  const path=join(root,page.asset.storageKey),stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isFile()||await realpath(path)!==path)throw Error('source_cms_asset_file');const bytes=await readFile(path);
  if(bytes.length!==page.asset.bytes||sha256(bytes)!==page.asset.sha256)throw Error('source_cms_asset_integrity');
  try{inspectCmsUpload(bytes,page.asset.contentType);}catch{held.push({path:page.path,reason:'existing_cms_upload_contract_not_representable'});continue;}
  const existing=await store.find(page.asset.storageKey);const filename=decodeURIComponent(new URL(page.sourceUrl).pathname.split('/').at(-1)??'Original resource');
  const values=alts.get(new URL(page.sourceUrl).pathname),alt=values?.size===1?[...values][0]!:'',asset=await disk.upload(bytes,page.asset.contentType,filename,alt,{subject:'source-public-migration',role:'system',correlationId:'d182-source-assets'});assetIds[page.path]=asset.id;
  if(existing)unchanged++;else inserted++;
 }
 return {inserted,unchanged,held,assetIds};
}
