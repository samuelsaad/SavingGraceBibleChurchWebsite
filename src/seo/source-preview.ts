/** A private CMS frame needs its own source copy, not a second whole-site corpus. */
import type {PoolClient} from 'pg';
import type {CmsDocument} from '../cms/model';
import {readSourcePublicPages} from './source-public-store';
import {sourceHosts,sourcePathSchema} from './source-public-model';
function ownedPath(value:string):string|null{
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&sourceHosts.has(url.hostname)&&!url.username&&!url.password&&!url.port&&!url.hash?sourcePathSchema.parse(url.pathname+url.search):null;}catch{return null;}
}
export async function readCmsPreviewSources(db:Pick<PoolClient,'query'>,path:string,content:CmsDocument){
 const source=content.source as {link?:unknown}|undefined;
 const original=content.template==='source-sermon'&&typeof source?.link==='string'?ownedPath(source.link):null;
 if(content.template==='source-sermon'&&!original)throw Error('source_cms_preview_identity');
 const pages=await readSourcePublicPages(db,[original??path]);
 const photo=pages[0]?.socialImageSource?ownedPath(pages[0].socialImageSource):null;
 if(photo&&photo!==pages[0]?.path){const assets=await readSourcePublicPages(db,[photo]);pages.push(...assets.filter(p=>p.kind==='asset'&&p.asset?.contentType.startsWith('image/')));}
 return pages;
}
