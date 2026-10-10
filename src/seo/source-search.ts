/** Legacy WordPress keyword search over currently public source/CMS documents. */
import {html} from '../frontend/html';
import {pageShell} from '../frontend/shell';
import {frontendResponse} from '../server/http/frontend-response';
import {resolveHref,plainText} from '../frontend/content/markup';
import {legacyDisposition} from '../frontend/content/registry';
import type {FrontendRenderContext} from '../frontend/routes';
import type {FrontendSiteSnapshot} from '../frontend/content/site-snapshot';
import type {SourcePublicPage} from './source-public-model';
import type {PublicSermonRepository} from '../server/repositories/sermon-repository';
type Entry={path:string;title:string;text:string;kind:string;language:string;date:string};
const words=(value:string)=>plainText(value).normalize('NFKC').replace(/\s+/gu,' ').trim();
function visibleText(value:unknown,key=''):string{
 if(typeof value==='string')return ['text','paragraphs','title','heading','caption','label','description','body','intro','items'].includes(key)?words(value):'';
 if(Array.isArray(value))return value.map(child=>visibleText(child,key)).join(' ');
 if(!value||typeof value!=='object')return '';
 const node=value as Record<string,unknown>;if(node.enabled===false||node.hidden===true||(node.presentation as {hidden?:boolean}|undefined)?.hidden)return '';
 return Object.entries(node).filter(([name])=>!['source','seo','presentation','style','styles'].includes(name)).map(([name,child])=>visibleText(child,name)).join(' ');
}
function sourceText(page:SourcePublicPage):string{const walk=(nodes:SourcePublicPage['content']):string=>nodes.map(node=>[node.text??'',node.alt??'',walk(node.children??[])].join(' ')).join(' ');return words(walk(page.content));}
export function createLegacySourceSearch(pages:readonly SourcePublicPage[],snapshot:FrontendSiteSnapshot,sermons:PublicSermonRepository,sourceLinks:Readonly<Record<string,string>>){
 const records=new Map<string,Entry>();
 const managedPages=[...snapshot.pages.filter(page=>page.status==='published'),...snapshot.posts,...snapshot.events];
 const managedBody=(page:typeof managedPages[number])=>'blocks' in page?page.blocks:page;
 for(const page of pages){
  if(!['page','post','event','attachment','sermon'].includes(page.kind)||page.path.includes('?')||page.issues.length)continue;
  const disposition=legacyDisposition(page.path,{mode:'public',basePath:'',siteContent:snapshot});if(disposition?.kind==='gone')continue;
  const path=page.kind==='sermon'?sourceLinks[String(page.sourceId)]:resolveHref(page.path,{mode:'public',basePath:'',siteContent:snapshot});if(!path)continue;
  const managed=managedPages.find(item=>item.path===path);
  const text=managed?.seo?.replaceSourceContent?visibleText(managedBody(managed)):[sourceText(page),managed?visibleText(managedBody(managed)):'',page.description??'',page.title].join(' ');
  const prior=records.get(path);records.set(path,{path,title:managed?.title??page.heading,text:words([prior?.text??'',text].join(' ')),kind:page.kind,language:page.language,date:page.modifiedAt??page.publishedAt??''});
 }
 for(const page of managedPages)if(!records.has(page.path))records.set(page.path,{path:page.path,title:page.title,text:words(visibleText(managedBody(page))),kind:'page',language:'en-AU',date:snapshot.modifiedAtByPath?.[page.path]??''});
 return async(request:Request,context:FrontendRenderContext):Promise<Response|null>=>{
  const url=new URL(request.url);if(url.pathname!=='/'||!url.searchParams.has('s'))return null;
  const query=(url.searchParams.get('s')??'').trim(),rawPage=url.searchParams.get('paged')??'1',type=url.searchParams.get('post_type');
  const supported:Record<string,string[]>={page:['page','attachment'],post:['post'],tribe_events:['event'],sermons:['sermon'],any:['page','post','event','attachment','sermon']};
  if(query.length>120||url.searchParams.getAll('s').length!==1||!/^\d{1,5}$/u.test(rawPage)||Number(rawPage)<1||type&&!supported[type])return frontendResponse(pageShell({title:'Invalid search',canonicalPath:'/',suppressCanonical:true,robots:'noindex, follow',seo:{noindex:true},body:html`<h1>Invalid search</h1>`},context),{status:404});
  const terms=words(query).toLowerCase().split(/\s+/u).filter(Boolean),pageNumber=Number(rawPage),pageSize=20;
  const entries=[...records.values()];
  if(query&&(!type||type==='sermons'||type==='any')){
   const result=await sermons.listPublished({page:1,pageSize:50,query,order:'DESC'});
   for(const sermon of result.data){const path='/sermons/'+sermon.slug+'/';if(!entries.some(item=>item.path===path))entries.push({path,title:sermon.title,text:sermon.summary??'',kind:'sermon',language:'en-AU',date:sermon.serviceDate});}
  }
  const hits=query?entries.filter(item=>(!type||supported[type]!.includes(item.kind))&&terms.every(term=>words(item.title+' '+item.text).toLowerCase().includes(term))).sort((a,b)=>terms.reduce((score,term)=>score+(b.title.toLowerCase().includes(term)?1:0)-(a.title.toLowerCase().includes(term)?1:0),0)||b.date.localeCompare(a.date)||a.path.localeCompare(b.path)):[];
  const totalPages=Math.max(1,Math.ceil(hits.length/pageSize));
  const href=(page:number)=>{const params=new URLSearchParams(url.search);params.set('paged',String(page));return '/?'+params.toString();};
  const title=query?query+' - '+(pages.find(page=>page.path==='/')?.title??'Saving Grace Bible Church'):'Search';
  const selected=hits.slice((pageNumber-1)*pageSize,pageNumber*pageSize);
  const body=html`<section class="page__body prose"><h1>${query?'Search Results for: '+query:'Search the website'}</h1><form action="/" method="get" role="search"><label for="site-keyword">Search the website</label><input id="site-keyword" type="search" name="s" value="${query}" maxlength="120" dir="auto" />${type?html`<input type="hidden" name="post_type" value="${type}" />`:''}<button type="submit">Search</button></form>${query?html`<p>${hits.length} results</p><ol>${selected.map(item=>html`<li><h2><a lang="${item.language}" href="${item.path}">${item.title}</a></h2><p>${Array.from(item.text).slice(0,180).join('')}${item.text.length>180?'…':''}</p></li>`)}</ol>${!hits.length?html`<p>No results found. Try another word or phrase.</p>`:''}<nav aria-label="Search results pages">${pageNumber>1?html`<a href="${href(pageNumber-1)}">Previous page</a>`:''}${pageNumber<totalPages?html`<a href="${href(pageNumber+1)}">Next page</a>`:''}</nav>`:''}</section>`;
  return frontendResponse(pageShell({sourceContentRendered:true,suppressCanonical:true,title,suffixTitle:false,canonicalPath:'/?'+url.searchParams.toString(),seo:{title,noindex:true,description:''},robots:'noindex, follow',body},context),{status:pageNumber>totalPages?404:200});
 };
}
