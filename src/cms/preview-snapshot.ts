import type {CmsSnapshot} from './model';
/** Keep discovery metadata and shared settings; only the rendered page needs
 * its complete section trees. Never mutate the repository-selected snapshot. */
export function cmsPreviewSnapshot(snapshot:CmsSnapshot,entityId:string,path:string):CmsSnapshot{
 const entities=snapshot.entities.map(document=>{
  const content=document.content,ownPath=document.kind==='home'?'/':content.path;
  if(document.id===entityId||ownPath===path||!['page','post','event'].includes(document.kind))return document;
  const trimmed={...content,...(Array.isArray(content.modules)?{modules:[]}:{}),...(Array.isArray(content.asideModules)?{asideModules:[]}: {})};
  return{...document,content:trimmed,payload:trimmed};
 });
 return{entities,documents:Object.fromEntries(entities.map(document=>[document.key,document.content])),routes:snapshot.routes.map(route=>({...route}))};
}
