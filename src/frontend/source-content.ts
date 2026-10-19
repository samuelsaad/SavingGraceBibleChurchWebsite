import type {SourceNode} from '../domain/source-content';
import {escapeHtml,raw,type Html} from './html';
const allowed=new Set(['p','h2','h3','h4','h5','h6','ul','ol','li','strong','em','b','i','a','blockquote','br','hr','figure','figcaption','img','table','thead','tbody','tr','th','td','div','span']);
/** Source markup is never trusted. Render an allowlisted tree and safe URL protocols. */
function url(value:string|undefined,image=false):string|null{if(!value)return null;if(!image&&value==='ralph@savinggrace.org.au')return 'mailto:ralph@savinggrace.org.au';try{const parsed=new URL(value,'https://www.savinggrace.org.au');if(!['https:','http:',...(image?[]:['mailto:','tel:'])].includes(parsed.protocol)||parsed.username||parsed.password)return null;if(parsed.hostname==='www.savinggrace.org.au'||parsed.hostname==='savinggrace.org.au'){if(!image&&parsed.pathname==='/music-ministry/ralph@savinggrace.org.au'&&!parsed.search&&!parsed.hash)return 'mailto:ralph@savinggrace.org.au';if(!image&&parsed.pathname==='/elders/google.com')return null;if(!image&&parsed.pathname==='/events/'&&parsed.searchParams.size===3&&parsed.searchParams.get('pagename')==='church-events'&&parsed.searchParams.get('shortcode')==='9ddfb0dc'&&parsed.searchParams.get('eventDisplay')==='past'&&!parsed.hash)return '/events/list/?eventDisplay=past';return parsed.pathname+parsed.search+parsed.hash;}return parsed.href;}catch{return null;}}
/** Entering Day view resets an inherited collection page, never a page link.
 * Retained source markup identifies these controls by their exact Day label,
 * own-site event post type and view parameters. Typed scope/campaigns survive.
 */
export function legacyDayViewTarget(href:string):string{

 const source=new URL(href,'https://www.savinggrace.org.au');if(source.origin!=='https://www.savinggrace.org.au'||!/^\/(?:page\/[1-9][0-9]*\/)?$/u.test(source.pathname)||source.searchParams.get('post_type')!=='tribe_events'||source.searchParams.get('eventDisplay')!=='day')return href;
 const keys=['post_type','eventDisplay','eventDate','paged','page','tag','tribe_events_cat','tribe_venue','tribe_organizer','tribe-bar-search','tribe-bar-location','tribe-events-views[tribe-bar-search]','tribe-events-views[tribe-bar-location]'];
 if([...source.searchParams.keys()].some(key=>!keys.includes(key)&&!/^utm_[a-z_]+$|^(?:gclid|wbraid|gbraid)$/u.test(key))||keys.some(key=>source.searchParams.getAll(key).length>1))return href;
 const date=source.searchParams.get('eventDate');if(date&&(!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))return href;
 for(const key of ['paged','page'])if(source.searchParams.has(key)&&!/^[1-9][0-9]*$/u.test(source.searchParams.get(key)!))return href;
 const retained=source.search.slice(1).split('&').filter(part=>!['post_type','eventDisplay','eventDate','paged','page'].includes([...new URLSearchParams(part).keys()][0]??''));
 return '/events/day/'+(date?date+'/':'')+(retained.length?'?'+retained.join('&'):'');
}
const sourceNodeText=(node:SourceNode):string=>(node.text??'')+(node.children??[]).map(sourceNodeText).join('');
export function renderSourceContent(nodes:readonly SourceNode[],resolveLink:(href:string)=>string=href=>href,options:{mark?:(node:SourceNode,path:(string|number)[])=>string|Html;image?:(src:string)=>string}={}):Html{
 const render=(node:SourceNode,depth=0,path:(string|number)[]=[]):string=>{if(depth>50)throw Error('source_content_depth');const mark=options.mark?.(node,path)??'';if(node.tag==='text')return mark?`<span${mark}>${escapeHtml(node.text??'')}</span>`:escapeHtml(node.text??'');if(!allowed.has(node.tag))throw Error('source_content_tag');const attributes=(['id','lang','dir','title'] as const).map(key=>node[key]!==undefined?` ${key}="${escapeHtml(node[key]!)}"`:'').join('')+(['td','th'].includes(node.tag)?(['colspan','rowspan'] as const).map(key=>node[key]!==undefined?` ${key}="${Number(node[key])}"`:'').join(''):'');const children=(node.children??[]).map((child,index)=>render(child,depth+1,[...path,'children',index])).join('');
  if(node.tag==='img'){const src=url(options.image?.(node.src??'')??node.src,true);if(!src)return '';return `<img${mark}${attributes} src="${escapeHtml(src)}" alt="${escapeHtml(node.alt??'')}"${node.width?` width="${node.width}"`:''}${node.height?` height="${node.height}"`:''} loading="lazy" decoding="async" />`;}
  if(node.tag==='br'||node.tag==='hr')return `<${node.tag}${attributes} />`;
  if(node.tag==='table')return `<div class="source-table" tabindex="0" role="region" aria-label="Scrollable table"><table${attributes}>${children}</table></div>`;
  const normalizedHref=node.tag==='a'?url(node.href):null;const href=normalizedHref?url(resolveLink(node.tag==='a'&&sourceNodeText(node).trim()==='Day'?legacyDayViewTarget(normalizedHref):normalizedHref)):null;return `<${node.tag}${mark}${attributes}${href?` href="${escapeHtml(href)}"`:''}>${escapeHtml(node.text??'')}${children}</${node.tag}>`;
 };return raw(nodes.map((node,index)=>render(node,0,[index])).join(''));
}
