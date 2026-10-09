import type {CmsObject,CmsValue} from './fields';
export type ContentPath = string[];
const forbidden=new Set(['__proto__','prototype','constructor']);
export function readPath(root:CmsObject,path:ContentPath):CmsValue|undefined {
 let value:CmsValue|undefined=root;for(const key of path){if(forbidden.has(key)||!value||typeof value!=='object')return undefined;value=(value as CmsObject)[key];}return value;
}
export function writePath(root:CmsObject,path:ContentPath,value:CmsValue):void {
 if(!path.length||path.some(key=>forbidden.has(key)))throw Error('This content selection is unavailable.');
 let parent:CmsValue=root;for(const key of path.slice(0,-1)){if(!parent||typeof parent!=='object'||!(key in parent))throw Error('This content selection has moved. Select it again.');parent=(parent as CmsObject)[key]!;}
 if(!parent||typeof parent!=='object')throw Error('This content selection has moved.');(parent as CmsObject)[path.at(-1)!]=value;
}
export function duplicateValue<T extends CmsValue>(value:T):T {const copy=structuredClone(value);const visit=(item:CmsValue):void=>{if(!item||typeof item!=='object')return;if(!Array.isArray(item)&&typeof item.id==='string')item.id=crypto.randomUUID();Object.values(item).forEach(visit);};visit(copy);return copy;}
export function moveItem(content:CmsObject,listPath:ContentPath,from:number,to:number):boolean {const list=readPath(content,listPath);if(!Array.isArray(list)||!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=list.length||to<0||to>=list.length||from===to)return false;const item=list.splice(from,1)[0]!;list.splice(to,0,item);return true;}
export class VisualHistory {
 private past:Array<{content:CmsObject;label:string}>=[];private future:Array<{content:CmsObject;label:string}>=[];private current:CmsObject;private group='';private last=0;
 constructor(content:CmsObject){this.current=structuredClone(content);}
 get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
 record(content:CmsObject,label:string,group=''):void {if(JSON.stringify(content)===JSON.stringify(this.current))return;const now=Date.now();if(!group||group!==this.group||now-this.last>800){this.past.push({content:this.current,label});if(this.past.length>80)this.past.shift();}this.current=structuredClone(content);this.group=group;this.last=now;this.future=[];}
 undo():CmsObject|null {const previous=this.past.pop();if(!previous)return null;this.future.push({content:this.current,label:previous.label});this.current=previous.content;this.group='';return structuredClone(this.current);}
 redo():CmsObject|null {const next=this.future.pop();if(!next)return null;this.past.push({content:this.current,label:next.label});this.current=next.content;this.group='';return structuredClone(this.current);}
 reset(content:CmsObject):void {this.current=structuredClone(content);this.past=[];this.future=[];this.group='';}
}
