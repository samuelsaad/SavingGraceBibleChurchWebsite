/** Retain missing verified original copy without replacing the selected layout. */
import type {SourceNode} from '../domain/source-content';
import type {FrontendRenderContext} from './routes';
import {escapeHtml,raw,html,type Html} from './html';
import {renderSourceContent} from './source-content';
import {resolveHref} from './content/markup';
function text(value:string):string{return value.replace(/<[^>]*>/gu,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|#39);/giu,(_all,e:string)=>{const k=e.toLowerCase();if(k.startsWith('#')){const n=parseInt(k.slice(k[1]==='x'?2:1),k[1]==='x'?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '} as Record<string,string>)[k]??'';}).normalize('NFKC').replace(/\s+/gu,' ').trim();}
const nodeText=(node:SourceNode):string=>text([node.text??'',...(node.children??[]).map(nodeText)].join(' '));
const blocks=new Set(['p','h2','h3','h4','h5','h6','ul','ol','blockquote','figure','table']);
export function retainedSourceCopy(body:Html,path:string,replace:boolean,context:FrontendRenderContext):Html{
 const originals=context.siteContent?.sourceContentByPath?.[path];if(replace||!originals?.length)return body;
 const current=body.toString(),visible=text(current),extras:SourceNode[]=[],seenExtras=new Set<string>();
 const present=(node:SourceNode):boolean=>{
  const words=nodeText(node);if(words&&!visible.includes(words))return false;
  for(const key of ['id','lang','dir','title'] as const)if(node[key]!==undefined&&!current.includes(`${key}="${escapeHtml(node[key]!)}"`))return false;
  if(node.src&&!current.includes(node.src.replaceAll('&','&amp;')))return false;
  if(node.href){let input=node.href;try{const url=new URL(input);if(['www.savinggrace.org.au','savinggrace.org.au'].includes(url.hostname))input=url.pathname+url.search+url.hash;}catch{}const href=resolveHref(input,context);if(!current.includes(href.replaceAll('&','&amp;')))return false;}
  return (node.children??[]).every(present);
 };
 const visit=(node:SourceNode)=>{if(present(node))return;if(blocks.has(node.tag)||node.tag==='img'||node.tag==='a'||node.tag==='text'||node.id||node.lang||node.dir||node.title){const key=renderSourceContent([node],href=>resolveHref(href,context)).toString();if(!seenExtras.has(key)){seenExtras.add(key);extras.push(node);}return;}for(const child of node.children??[])visit(child);};
 for(const original of originals)for(const node of original.content)visit(node);
 if(!extras.length)return body;
 return html`${body}<section class="page__body prose source-copy">${renderSourceContent(extras,href=>resolveHref(href,context))}</section>`;
}

/** Seed presentation labels yield to verified headings; subsequent edits remain authoritative. */
export function sourceHeading(body:Html,heading:string):Html{return raw(body.toString().replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/u,(_all,open:string,close:string)=>open+escapeHtml(heading)+close));}
