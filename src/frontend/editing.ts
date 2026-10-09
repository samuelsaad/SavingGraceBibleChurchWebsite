/** Authenticated visual-editor markers. Ordinary visitor HTML receives no markers. */
import {attribute,escapeHtml,html,raw,type Html} from "./html";
import type {FrontendRenderContext} from "./routes";
import type {CmsModule} from "../cms/model";
export type CmsContentPath=Array<string|number>;
export interface CmsRenderMetadata {cmsInstanceId?:string;cmsPath?:CmsContentPath;cmsModulePath?:CmsContentPath;cmsEnabled?:boolean;cmsPresentation?:CmsModule["presentation"]}
export type CmsEditKind="text"|"richtext"|"image"|"link"|"section";
export function editAttributes(context:FrontendRenderContext,path:CmsContentPath|undefined,kind:CmsEditKind,label:string,global?:"header"|"footer"|"navigation"):Html {
 if(!context.visualEditor||!path||(["settings","venue"].includes(context.visualEditor.kind)&&!global))return html``;
 return html`${attribute("data-cms-path",JSON.stringify(path.map(String)))}${attribute("data-cms-kind",kind)}${attribute("data-cms-label",label)}${attribute("data-cms-global",global)}`;
}
export function editRoot(fragment:Html,attributes:Html):Html {
 const attrs=attributes.toString();if(!attrs)return fragment;
 return raw(fragment.toString().replace(/<(?!style\b)([a-z][a-z0-9-]*)(?=[\s>])/iu,`<$1${attrs}`));
}
export function editField(fragment:Html,context:FrontendRenderContext,path:CmsContentPath|undefined,kind:CmsEditKind,label:string,global?:"header"|"footer"|"navigation"):Html{return editRoot(fragment,editAttributes(context,path,kind,label,global));}
export function fieldPath(block:unknown,...parts:Array<string|number>):CmsContentPath|undefined {const path=(block as CmsRenderMetadata).cmsPath;return path?[...path,...parts]:undefined;}
export function moduleName(kind:string):string {return ({"home-arrival":"Welcome and services","home-welcome":"Welcome and church life","home-about":"About and giving","home-sermons":"Recent sermons","home-events":"Upcoming events","sermon-cards":"Sermons","next-event":"Next gathering","contact-panel":"Contact details","giving-methods":"Giving","external-plate":"External resource","blog-list":"Blog posts","sitemap-list":"Site map","events-calendar":"Events calendar"} as Record<string,string>)[kind]??kind.replaceAll("-"," ").replace(/^./u,c=>c.toUpperCase());}
/** Annotate existing root elements so direct-child layout and typography remain exact. */
function mapRootTags(fragment:Html,change:(tag:string)=>string):Html {
 let depth=0;
 const voidTags=new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
 return raw(fragment.toString().replace(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/giu,(tag:string,name:string)=>{
  const lower=name.toLowerCase();
  if(tag.startsWith("</")){depth=Math.max(0,depth-1);return tag;}
  const root=depth===0&&lower!=="style";
  if(!voidTags.has(lower)&&!tag.endsWith("/>"))depth++;
  return root?change(tag):tag;
 }));
}
export function editSection(fragment:Html,block:unknown,context:FrontendRenderContext):Html {
 const value=block as CmsRenderMetadata&{kind:string};
 const presentation=value.cmsPresentation;
 const classes=presentation?Object.entries(presentation).filter(([,v])=>v!==undefined).map(([key,v])=>`cms-presentation--${key}-${v}`):[];
 const editor=Boolean(context.visualEditor&&!["settings","venue"].includes(context.visualEditor.kind)&&value.cmsPath);
 if(!classes.length&&!editor)return fragment;
 return mapRootTags(fragment,tag=>{
  let result=tag;
  if(classes.length){
   const addition=escapeHtml(`cms-presentation ${classes.join(" ")}`);
   result=/\bclass="[^"]*"/u.test(result)?result.replace(/\bclass="([^"]*)"/u,(_whole,existing:string)=>`class="${existing} ${addition}"`):result.replace(/^(<[a-z][a-z0-9-]*)/iu,`$1 class="${addition}"`);
  }
  if(editor){
   const attributes=html`${attribute("data-cms-section-path",JSON.stringify(value.cmsPath!.map(String)))}${attribute("data-cms-module",value.cmsInstanceId)}${attribute("data-cms-module-path",value.cmsModulePath?JSON.stringify(value.cmsModulePath.map(String)):undefined)}${attribute("data-cms-section-label",moduleName(value.kind))}${/\bdata-cms-path=/u.test(result)?html``:editAttributes(context,value.cmsPath,"section",moduleName(value.kind))}`;
   result=result.replace(/^(<[a-z][a-z0-9-]*)/iu,`$1${attributes}`);
  }
  return result;
 });
}
export function hiddenSection(block:unknown,context:FrontendRenderContext):Html|null {
 const value=block as CmsRenderMetadata&{kind:string};if(value.cmsEnabled!==false)return null;
 if(!context.visualEditor||["settings","venue"].includes(context.visualEditor.kind))return html``;
 return editSection(html`<div class="cms-editor-hidden"${editAttributes(context,value.cmsPath,"section",moduleName(value.kind))}>Hidden section: ${moduleName(value.kind)}<span>Choose Show section to restore it.</span></div>`,block,context);
}
export const cmsPresentationStyles=`
.cms-presentation{min-width:0}.cms-presentation--background-white{background:#fff}.cms-presentation--background-soft{background:var(--colour-recessed,#eef3f4)}.cms-presentation--background-ink{background:#183d50;color:#fff;--colour-ink:#fff;--colour-ink-soft:#e0e9ec;--colour-ink-muted:#c5d9e2;--colour-gilt:#edc697;--colour-rule:#6b7b84;--colour-on-ink:#183d50;--colour-on-ink-soft:#3e5360;--colour-ground:#183d50;--colour-raised:#244a5e;--colour-recessed:#244a5e;--colour-tile:#31596c}.cms-presentation--background-ink a{color:inherit}.cms-presentation--spacing-compact{padding-block:1rem}.cms-presentation--spacing-roomy{padding-block:4rem}.cms-presentation--alignment-center{text-align:center}.cms-presentation--alignment-left{text-align:left}.cms-presentation--width-reading{max-width:72ch;margin-inline:auto}.cms-presentation--width-full{width:100%}.cms-panel-columns{display:grid;grid-template-columns:repeat(var(--cms-columns),minmax(0,1fr));gap:1.5rem}.cms-panel-columns--1{--cms-columns:1}.cms-panel-columns--2{--cms-columns:2}.cms-panel-columns--3{--cms-columns:3}.cms-panel-columns>h3{grid-column:1/-1}.cms-panel-columns>*{min-width:0}@media(max-width:45rem){.cms-panel-columns{grid-template-columns:1fr}.cms-presentation--spacing-roomy{padding-block:2rem}}
`;
export const cmsEditorStyles=`
.cms-editor-section{display:contents}[data-cms-path],[data-cms-global]{cursor:pointer}.cms-editor-hover{outline:1px dashed #527485!important;outline-offset:3px}.cms-editor-selected{outline:2px solid #183d50!important;outline-offset:4px}[contenteditable=true]{cursor:text;caret-color:#183d50;outline:2px solid #183d50!important;outline-offset:4px}.cms-editor-hidden{border:1px dashed #6b7b84;background:#eef3f4;color:#183d50;padding:1rem;margin:1rem 0;font:600 .875rem/1.5 "Bitstream Vera Sans",sans-serif}.cms-editor-hidden span{display:block;font-weight:400}.cms-editor-drop-before{box-shadow:0 -4px 0 #183d50!important}.cms-editor-drop-after{box-shadow:0 4px 0 #183d50!important}::selection{background:#dbe8ec;color:#183d50}.ve-selected{outline:2px solid #90411f!important;outline-offset:3px}.ve-hovered{outline:1px solid #183d50!important;outline-offset:3px}.ve-frame-tools{position:fixed;inset:auto;top:0;left:0;z-index:100000;display:flex;align-items:center;gap:2px;padding:4px;background:#fff;border:1px solid #6b7b84;border-radius:4px;font:400 13px/1.4 "Bitstream Vera Sans",sans-serif;color:#183d50}.ve-frame-tools button{min-height:32px;padding:5px 8px;background:#fff;border:0;border-radius:3px;color:#183d50;cursor:pointer}.ve-frame-tools button:hover{background:#eef3f4}.ve-frame-tools button:focus-visible{outline:2px solid #183d50}.ve-frame-tools button:disabled{color:#53616a;cursor:default}.ve-insertion{position:fixed;height:3px;background:#90411f;pointer-events:none;z-index:100001}.ve-editable{outline:2px solid #90411f!important;outline-offset:3px;caret-color:#90411f}
`;

export function hasCmsPresentation(context:FrontendRenderContext):boolean {
 const walk=(value:unknown):boolean=>{if(!value||typeof value!=="object")return false;const item=value as Record<string,unknown>;if(item.presentation||item.cmsPresentation||item.kind==="panel"&&item.columns)return true;return Object.values(item).some(walk);};return walk(context.siteContent);
}
