import type {CmsObject} from "./fields";
import {readPath,type ContentPath} from "./visual-state";
export interface VisualLinkField {path:ContentPath;label:string;value:string;format:"destination"|"email"}
/** Visible labels and their destinations sometimes have distinct legacy field names. */
export function relatedLinkFields(content:CmsObject,selected:ContentPath):VisualLinkField[] {
 const key=selected.at(-1);if(!key||/(?:href|url)$/iu.test(key))return [];
 const parent=selected.slice(0,-1),owner=readPath(content,parent);
 if(!owner||typeof owner!=="object"||Array.isArray(owner))return [];
 let destination:string|undefined,fallback="",format:"destination"|"email"="destination";
 const named:Record<string,string>={join:"joinHref",moreLabel:"moreHref",learnMore:"learnMoreHref",viewCalendar:"viewCalendarHref"};
 if(named[key]){destination=named[key];if(key==="moreLabel")fallback="/lords-day-service/";}
 else if(parent.join(".")==="contactCopy"){
  destination=({telephone:"telephoneHref",email:"emailAddress",directions:"directionsHref"}as Record<string,string>)[key];
  if(key==="email")format="email";
 }else if(parent.join(".")==="footerServicesCopy"){
  destination=({morningLink:"morningHref",eveningLink:"eveningHref"}as Record<string,string>)[key];
  fallback=key==="morningLink"?"/lords-day-service/":"/evening-service/";
 }else if(["label","title","readMore","linkLabel","link"].includes(key)&&("href"in owner))destination="href";
 if(!destination)return [];
 const value=owner[destination];if(value!==undefined&&value!==null&&typeof value!=="string")return [];
 return [{path:[...parent,destination],label:format==="email"?"Email destination":"Link destination",value:typeof value==="string"?value:fallback,format}];
}
