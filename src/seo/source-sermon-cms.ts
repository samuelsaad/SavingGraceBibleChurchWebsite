import {canonicalStoredSermonSlug} from '../domain/slug';
import type {CmsPublishedDocument,CmsModule} from '../cms/model';
import type {SermonDetail} from '../domain/sermon';
import type {SourceNode} from '../domain/source-content';
const text=(nodes:readonly SourceNode[]):string=>nodes.map(n=>(n.text??'')+' '+text(n.children??[])).join(' ').replace(/\s+/gu,' ').trim();
/** Overlay only published original-content revisions, never generated enrichment. */
export function applyOriginalCmsSerMons(records:Array<{detail:SermonDetail;sourceWordpressId?:number|null;lastModified:string;indexable:boolean}>,documents:readonly CmsPublishedDocument[],alias:(oldPath:string,newPath:string)=>void){
 const seen=new Set<number>();
 for(const document of documents){const c=document.content;if(c.template!=='source-sermon')continue;const source=c.source as {id:number},record=records.find(r=>r.sourceWordpressId===source.id);if(!record)continue;if(!record.detail.sourcePublic)throw Error('source_cms_sermon_identity');if(seen.has(source.id))throw Error('source_cms_sermon_duplicate');seen.add(source.id);
  const path=String(c.path),slug=/^\/sermons\/([^/]+)\/$/u.exec(path)?.[1];if(!slug||canonicalStoredSermonSlug(slug)!==slug)throw Error('source_cms_sermon_path');const old='/sermons/'+record.detail.slug+'/';
  const modules=c.modules as CmsModule[];if(modules.some(m=>m.block.kind!=='source-content'))throw Error('source_cms_sermon_content');const nodes=modules.filter(m=>m.enabled).flatMap(m=>structuredClone((m.block as {nodes:SourceNode[]}).nodes));
  record.detail.slug=slug;record.detail.title=String(c.heading??c.title);record.detail.sourcePublic.content=nodes;record.detail.body=text(nodes)||null;
  const seo=c.seo as Record<string,unknown>|undefined;record.detail.sourcePublic.title=String(seo?.title??c.title);record.detail.sourcePublic.description=typeof seo?.description==='string'?seo.description:record.detail.sourcePublic.description;
  if(typeof seo?.socialTitle==='string')record.detail.sourcePublic.socialTitle=seo.socialTitle;if(typeof seo?.socialDescription==='string')record.detail.sourcePublic.socialDescription=seo.socialDescription;
  if(typeof seo?.image==='string')record.detail.sourcePublic.socialImage=seo.image;if(seo?.noindex===true)record.indexable=false;
  if(document.modifiedAt){record.lastModified=document.modifiedAt.slice(0,10);record.detail.sourcePublic.modifiedAt=document.modifiedAt;}
  if(old!==path)alias(old,path);
 }
}
