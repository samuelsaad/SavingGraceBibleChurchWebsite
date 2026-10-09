import {escape,markupHtml,richTextValue,titleCase,moduleNames,newArrayItem,optionalFieldsFor,shouldShowField,type CmsObject,type CmsValue} from './fields';
import {readPath,writePath,moveItem,type ContentPath} from './visual-state';
export interface VisualAsset {id:string;url:string;name?:string;originalFilename?:string;mimeType?:string;type?:string;alt?:string}
export interface InspectorOptions {
 root:HTMLElement;content:CmsObject;kind:string;assets:VisualAsset[];entities:Array<{id:string;kind:string;draft:{content:Record<string,unknown>}}>;path:ContentPath;
 change:(path:ContentPath,value:CmsValue)=>void;mutate:(action:()=>void,label:string,path?:ContentPath)=>void;
 image:(path:ContentPath)=>void;link:(path:ContentPath)=>void;sermons:(path:ContentPath)=>void;addBlock:(path:ContentPath)=>void;
}
const hidden=new Set(['id','kind','status','source','sourceIds','legacyPaths','legacyPath','notes','template','modules','asideModules','presentation']);
const rich=new Set(['text','lede','paragraph','intro','quote','caption']);
const images=new Set(['image','media','logoAsset','footerLogoAsset','faviconAsset','touchIconAsset']);
const label=(key:string)=>({mediaAlt:'Image description / alternative text',mediaFocalPoint:'Image positioning',background:'Section background',spacing:'Vertical spacing',alignment:'Text alignment',width:'Content width'}[key]??titleCase(key));
const pkey=(path:ContentPath)=>path.join('.');
const isObject=(value:CmsValue|undefined):value is CmsObject=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export function mountInspector(options:InspectorOptions):void {
 const {root,content,kind,path}=options;
 const choices:Record<string,Array<[string,string]>>={
  section:['home','about','teaching','ministries','events','resources','giving','contact','blog','sermons'].map(v=>[v,titleCase(v)]),
  level:[['2','Large heading'],['3','Medium heading'],['4','Small heading']],columns:[['1','One column'],['2','Two columns'],['3','Three columns'],['4','Four columns']],
  size:[['full','Full width'],['inset','Inset'],['portrait','Portrait']],treatment:[['banner','Banner'],['aside','Alongside text']],order:[['DESC','Newest first'],['ASC','Oldest first']],
  weekday:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((v,i)=>[String(i),v]),
  kind:[['single','One date'],['weekly','Every week'],['monthly-first','First weekday of month']],
  background:[['default','Original design'],['white','White'],['soft','Pale blue'],['ink','Mineral blue']],spacing:[['normal','Original spacing'],['compact','Compact'],['roomy','Generous']],
  alignment:[['left','Left'],['center','Centred']],width:[['full','Original width'],['reading','Reading width']]
 };
 function field(key:string,value:CmsValue,parts:ContentPath):string {
  const name=label(key),address=pkey(parts),id='ve-'+address.replace(/[^a-z0-9]/gi,'-');
  if(hidden.has(key)&&!(key==='kind'&&parts.at(-2)==='schedule'))return '';
  if(Array.isArray(value)){
   if(key==='sermonIds')return `<div class="ve-field"><span>Selected sermons</span><button type="button" data-ve-sermons="${address}">${value.length?'Change '+value.length+' selected sermons':'Choose eligible sermons'}</button></div>`;
   return `<details class="ve-field-group" open><summary>${escape(name)} <span>${value.length}</span></summary>${value.map((item,i)=>`<div class="ve-array-item"><div class="ve-array-actions"><strong>${isObject(item)?escape(String(item.title??item.name??item.label??moduleNames[String(item.kind)]??'Item '+(i+1))):'Item '+(i+1)}</strong><button type="button" data-ve-array="up" data-list="${address}" data-index="${i}" aria-label="Move item ${i+1} up"${i===0?' disabled':''}>Up</button><button type="button" data-ve-array="down" data-list="${address}" data-index="${i}" aria-label="Move item ${i+1} down"${i===value.length-1?' disabled':''}>Down</button><button type="button" data-ve-array="remove" data-list="${address}" data-index="${i}" aria-label="Remove item ${i+1}">Remove</button></div>${isObject(item)?object(item,[...parts,String(i)]):field(['text','description'].includes(key)?'text':key,item,[...parts,String(i)])}</div>`).join('')}<button type="button" data-ve-array="add" data-list="${address}">Add ${key==='blocks'?'block':key==='items'?'item':name.toLowerCase().replace(/s$/,'')}</button></details>`;
  }
  if(isObject(value))return `<details class="ve-field-group" open><summary>${escape(name)}</summary>${object(value,parts)}</details>`;
  if(typeof value==='boolean')return `<label class="ve-check"><input type="checkbox" data-ve-field="${address}"${value?' checked':''}>${escape(name)}</label>`;
  if(images.has(key)){const asset=options.assets.find(a=>a.id===value||a.url===value);return `<div class="ve-field ve-image-field"><span>${escape(name)}</span>${asset?`<img src="${escape(asset.url)}" alt="${escape(asset.alt??'Selected image')}" loading="lazy">`:''}<button type="button" data-ve-image="${address}">${asset?'Replace image':'Choose image'}</button><small>Choose from your library or upload an image.</small></div>`;}
  if(['parent','page','venue','event'].includes(key)){const wanted=key==='venue'?'venue':key==='event'?'event':'page';return `<label class="ve-field">${escape(name)}<select data-ve-field="${address}">${['parent','page'].includes(key)?'<option value="">None</option>':''}${options.entities.filter(e=>e.kind===wanted).map(e=>`<option value="${escape(e.draft.content.id)}"${e.draft.content.id===value?' selected':''}>${escape(e.draft.content.title??e.draft.content.name)}</option>`).join('')}</select></label>`;}
  if(key==='videoId'||key==='listId')return `<label class="ve-field">${escape(name)} link<input type="url" data-ve-field="${address}" data-provider="${key}" value="${escape(value?(key==='videoId'?'https://www.youtube.com/watch?v=':'https://www.youtube.com/playlist?list=')+String(value):'')}" placeholder="Paste the YouTube link"></label>`;
  if(choices[key]){let items=choices[key]!;if(key==='columns'){const owner=readPath(content,parts.slice(0,-1))as CmsObject;items=items.filter(([v])=>owner.kind==='tiles'?v!=='1':v!=='4');}return `<label class="ve-field">${escape(name)}<select data-ve-field="${address}"${typeof value==='number'?' data-number':''}>${items.map(([v,l])=>`<option value="${v}"${String(value)===v?' selected':''}>${l}</option>`).join('')}</select></label>`;}
  if(rich.has(key)&&typeof value==='string')return `<div class="ve-field"><label id="${id}-label">${escape(name)}</label><div class="ve-rich-tools" aria-label="Text formatting"><button type="button" data-ve-format="bold" data-editor="${address}" aria-label="Bold"><strong>B</strong></button><button type="button" data-ve-format="italic" data-editor="${address}" aria-label="Italic"><em>I</em></button></div><div role="textbox" aria-multiline="true" aria-labelledby="${id}-label" contenteditable="true" class="ve-rich" data-ve-rich="${address}">${markupHtml(value)}</div></div>`;
  const isLink=/(?:href|url)$/i.test(key),type=typeof value==='number'?'number':key==='email'?'email':['date','from','until'].includes(key)?'date':['start','end'].includes(key)?'time':'text';
  const input=typeof value==='string'&&(key==='description'||value.length>150)?`<textarea rows="4" data-ve-field="${address}">${escape(value)}</textarea>`:`<input type="${type}" data-ve-field="${address}" value="${escape(value??'')}"${value===null?' data-nullable':''}${type==='number'?' step="1"':''}>`;
  return `<label class="ve-field">${escape(name)}${input}</label>${isLink?`<button type="button" class="ve-text-button" data-ve-link="${address}">Choose a page or document</button>`:''}`;
 }
 function object(value:CmsObject,parts:ContentPath):string {
  const fields=Object.entries(value).filter(([key])=>shouldShowField(key,pkey(parts))).map(([key,item])=>field(key,item,[...parts,key])).join('');
  const optional=optionalFieldsFor(value,pkey(parts),kind,content).filter(item=>!item.present&&!hidden.has(item.key));
  return fields+(optional.length?`<details class="ve-optional"><summary>More options</summary>${optional.map(item=>`<button type="button" data-ve-optional="${item.key}" data-parent="${pkey(parts)}">Add ${escape(label(item.key).toLowerCase())}</button>`).join('')}</details>`:'');
 }
 const selected=path.length?readPath(content,path):content;
 root.innerHTML=selected===undefined?'<p>This item has moved. Select it on the page again.</p>':isObject(selected)?object(selected,path):field(path.at(-1)??'text',selected,path);
 root.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('[data-ve-field]').forEach(input=>input.addEventListener(input.tagName==='SELECT'||input.type==='checkbox'?'change':'input',()=>{
  const parts=input.dataset.veField!.split('.');let value:CmsValue=input.type==='checkbox'?(input as HTMLInputElement).checked:input.type==='number'||input.hasAttribute('data-number')?Number(input.value):input.value;
  if(input.hasAttribute('data-nullable')&&!value)value=null;
  if(input.dataset.provider){try{const url=new URL(input.value);value=input.dataset.provider==='videoId'?(url.hostname==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v')??input.value):url.searchParams.get('list')??input.value;}catch{value=input.value;}}
  if(input.dataset.veField==='schedule.kind'){const date=new Date().toISOString().slice(0,10);options.mutate(()=>writePath(content,['schedule'],value==='single'?{kind:'single',date}:{kind:value,weekday:0,from:date,exclusions:[]}),'Change event recurrence',['schedule']);}else options.change(parts,value);
 }));
 root.querySelectorAll<HTMLElement>('[data-ve-rich]').forEach(editor=>{editor.addEventListener('input',()=>options.change(editor.dataset.veRich!.split('.'),richTextValue(editor).trimEnd()));editor.addEventListener('paste',event=>{event.preventDefault();const selection=window.getSelection();if(selection?.rangeCount){const range=selection.getRangeAt(0);range.deleteContents();const text=document.createTextNode((event as ClipboardEvent).clipboardData?.getData('text/plain')??'');range.insertNode(text);range.setStartAfter(text);range.collapse(true);selection.removeAllRanges();selection.addRange(range);editor.dispatchEvent(new Event('input'));}});});
 root.querySelectorAll<HTMLButtonElement>('[data-ve-format]').forEach(button=>{button.addEventListener('mousedown',event=>event.preventDefault());button.addEventListener('click',()=>{const editor=Array.from(root.querySelectorAll<HTMLElement>('[data-ve-rich]')).find(e=>e.dataset.veRich===button.dataset.editor);editor?.focus();document.execCommand(button.dataset.veFormat!);editor?.dispatchEvent(new Event('input'));});});
 for(const [selector,callback]of [['image',options.image],['link',options.link],['sermons',options.sermons]]as const)root.querySelectorAll<HTMLButtonElement>(`[data-ve-${selector}]`).forEach(button=>button.addEventListener('click',()=>callback(button.getAttribute('data-ve-'+selector)!.split('.'))));
 root.querySelectorAll<HTMLButtonElement>('[data-ve-optional]').forEach(button=>button.addEventListener('click',()=>{const parent=button.dataset.parent?button.dataset.parent.split('.'):[],value=readPath(content,parent);if(!isObject(value))return;const item=optionalFieldsFor(value,pkey(parent),kind,content).find(f=>f.key===button.dataset.veOptional);if(item)options.mutate(()=>writePath(content,[...parent,item.key],structuredClone(item.value)),'Add '+label(item.key),parent);}));
 root.querySelectorAll<HTMLButtonElement>('[data-ve-array]').forEach(button=>button.addEventListener('click',()=>{const parts=button.dataset.list!.split('.'),list=readPath(content,parts);if(!Array.isArray(list))return;const index=Number(button.dataset.index),action=button.dataset.veArray;if(action==='add'&&parts.at(-1)==='blocks'){options.addBlock(parts);return;}options.mutate(()=>{if(action==='add')list.push(newArrayItem(content,pkey(parts)));else if(action==='remove')list.splice(index,1);else moveItem(content,parts,index,index+(action==='up'?-1:1));},action==='remove'?'Remove item':'Rearrange content',path);const next=action==='up'?index-1:action==='down'?index+1:action==='remove'?Math.max(0,index-1):list.length-1;Array.from((options.root.isConnected?options.root:document.getElementById(options.root.id)??options.root).querySelectorAll<HTMLButtonElement>('[data-ve-array]')).find(b=>b.dataset.list===parts.join('.')&&b.dataset.index===String(next)&&!b.disabled)?.focus();}));
}
