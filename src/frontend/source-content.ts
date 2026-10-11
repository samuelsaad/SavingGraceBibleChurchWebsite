import type {SourceNode} from '../domain/source-content';
import {escapeHtml,raw,type Html} from './html';
const allowed=new Set(['p','h2','h3','h4','h5','h6','ul','ol','li','strong','em','b','i','a','blockquote','br','hr','figure','figcaption','img','table','thead','tbody','tr','th','td','div','span']);
/** Source markup is never trusted. Render an allowlisted tree and safe URL protocols. */
function url(value:string|undefined,image=false):string|null{if(!value)return null;try{const parsed=new URL(value,'https://www.savinggrace.org.au');if(!['https:','http:',...(image?[]:['mailto:','tel:'])].includes(parsed.protocol)||parsed.username||parsed.password)return null;if(parsed.hostname==='www.savinggrace.org.au'||parsed.hostname==='savinggrace.org.au'){if(!image&&parsed.pathname==='/elders/google.com')return null;return parsed.pathname+parsed.search+parsed.hash;}return parsed.href;}catch{return null;}}
export function renderSourceContent(nodes:readonly SourceNode[],resolveLink:(href:string)=>string=href=>href,options:{mark?:(node:SourceNode,path:(string|number)[])=>string|Html;image?:(src:string)=>string}={}):Html{
 const render=(node:SourceNode,depth=0,path:(string|number)[]=[]):string=>{if(depth>50)throw Error('source_content_depth');const mark=options.mark?.(node,path)??'';if(node.tag==='text')return mark?`<span${mark}>${escapeHtml(node.text??'')}</span>`:escapeHtml(node.text??'');if(!allowed.has(node.tag))throw Error('source_content_tag');const children=(node.children??[]).map((child,index)=>render(child,depth+1,[...path,'children',index])).join('');
  if(node.tag==='img'){const src=url(options.image?.(node.src??'')??node.src,true);if(!src)return '';return `<img${mark} src="${escapeHtml(src)}" alt="${escapeHtml(node.alt??'')}"${node.width?` width="${node.width}"`:''}${node.height?` height="${node.height}"`:''} loading="lazy" decoding="async" />`;}
  if(node.tag==='br'||node.tag==='hr')return `<${node.tag} />`;
  if(node.tag==='table')return `<div class="source-table" tabindex="0" role="region" aria-label="Scrollable table"><table>${children}</table></div>`;
  const normalizedHref=node.tag==='a'?url(node.href):null;const href=normalizedHref?url(resolveLink(normalizedHref)):null;return `<${node.tag}${mark}${href?` href="${escapeHtml(href)}"`:''}>${escapeHtml(node.text??'')}${children}</${node.tag}>`;
 };return raw(nodes.map((node,index)=>render(node,0,[index])).join(''));
}
