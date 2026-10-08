import { describe,expect,it } from "vitest";
import { newArrayItem,optionalFieldsFor,safeHref,shouldShowField,type CmsObject,type CmsValue } from "../src/admin/cms/fields";
import { buildCmsSeeds } from "../src/cms/seed";
import { safeCmsHref,validateCmsContent } from "../src/cms/validation";

const seeds=buildCmsSeeds();
const at=(content:CmsObject,path:string):CmsValue=>path?path.split(".").reduce((value,key)=>(value as CmsObject)[key]!,content as CmsValue):content;
function visit(value:CmsValue,path:string,callback:(value:CmsObject,path:string)=>void):void {
 if(!value||typeof value!=="object")return;
 if(!Array.isArray(value))callback(value,path);
 Object.entries(value).forEach(([key,child])=>visit(child,path?path+"."+key:key,callback));
}

describe("CMS editor optional controls",()=>{
 it("only describes optional edits and every offered removal retains a valid document",()=>{
  let controls=0;
  for(const seed of seeds){
   const original=JSON.stringify(seed.payload),content=structuredClone(seed.payload)as CmsObject;
   visit(content,"",(object,path)=>{
    for(const control of optionalFieldsFor(object,path,seed.kind,content)){
     controls++;
     if(!control.present)continue;
     const draft=structuredClone(content);delete(at(draft,path)as CmsObject)[control.key];
     expect(()=>validateCmsContent(seed.kind,draft),`${seed.key}: remove ${path}.${control.key}`).not.toThrow();
    }
   });
   expect(JSON.stringify(content)).toBe(original);
  }
  expect(controls).toBeGreaterThan(100);
 });
 it("offers only supported tile/person metadata, and allows a decorative alt override",()=>{
  const content:CmsObject={modules:[{block:{kind:"tiles",items:[{title:"Tile",href:"/"}]}},{block:{kind:"index",items:[{title:"Page",href:"/",text:""}]}},{block:{kind:"figure",media:"church-photo"}}]};
  const fields=(path:string)=>optionalFieldsFor(at(content,path)as CmsObject,path,"page",content).map(item=>item.key);
  expect(fields("modules.0.block.items.0")).toContain("media");
  expect(fields("modules.1.block.items.0")).toEqual([]);
  const figure=optionalFieldsFor(at(content,"modules.2.block")as CmsObject,"modules.2.block","page",content);
  expect(figure.find(item=>item.key==="alt")?.value).toBe("");
 });
 it("can add hero, optional event data, recurrence dates and nested navigation without guessing missing data",()=>{
  const page:CmsObject={title:"Example page"};
  expect(optionalFieldsFor(page,"","page",page).map(item=>item.key)).toEqual(expect.arrayContaining(["hero","heading","lede","parent","related","asideModules"]));
  const event:CmsObject={schedule:{kind:"weekly",from:"2026-10-08",weekday:4}};
  expect(optionalFieldsFor(event,"","event",event).map(item=>item.key)).toEqual(["page","media","tag"]);
  expect(optionalFieldsFor(event.schedule as CmsObject,"schedule","event",event).map(item=>item.key)).toEqual(["until","exclusions"]);
  const navigation:CmsObject={primaryMenu:[{label:"Example",href:"/"}]};
  expect(optionalFieldsFor(at(navigation,"primaryMenu.0")as CmsObject,"primaryMenu.0","settings",navigation).map(item=>item.key)).toEqual(["children","enabled","sub"]);
  expect(shouldShowField("aboutUs","navigationCopy")).toBe(false);
  expect(shouldShowField("home","navigationCopy")).toBe(true);
  expect(shouldShowField("label","primaryMenu.0")).toBe(true);
 });
 it("restores schema-valid item types after every editable seeded collection is emptied",()=>{
  let collections=0;
  for(const seed of seeds){
   const content=structuredClone(seed.payload)as CmsObject;
   visit(content,"",(object,path)=>{
    for(const [key,array]of Object.entries(object)){
     if(!Array.isArray(array)||["sermonIds","sourceIds","legacyPaths","notes"].includes(key))continue;
     const draft=structuredClone(content),parent=at(draft,path)as CmsObject,arrayPath=path?path+"."+key:key;
     parent[key]=[];
     const item=newArrayItem(draft,arrayPath);
     parent[key]=[key==="related"?"about":item];
     expect(()=>validateCmsContent(seed.kind,draft),`${seed.key}: restore ${arrayPath}`).not.toThrow();
     collections++;
    }
   });
  }
  expect(collections).toBeGreaterThan(100);
 });
 it("retains unique identities and supported platform identities when rebuilding collections",()=>{
  const home:CmsObject={modules:[{block:{kind:"home-arrival",services:{items:[]}}}]};
  const first=newArrayItem(home,"modules.0.block.services.items")as CmsObject,second=newArrayItem(home,"modules.0.block.services.items")as CmsObject;
  expect(first.id).not.toBe(second.id);expect(first.enabled).toBe(true);
  const settings:CmsObject={socialPlatforms:[{id:"facebook"},{id:"youtube"},{id:"instagram"}]};
  expect(newArrayItem(settings,"socialPlatforms")).toEqual({id:"podcast",name:"Podcast",href:null,enabled:false});
  expect(newArrayItem({schedule:{from:"2026-10-08",exclusions:[]}},"schedule.exclusions")).toBe("2026-10-08");
 });
 it("accepts exactly the same destinations as the server for unsafe and valid link cases",()=>{
  const links=["/about/","/about/#welcome","#section-1","#section:one.two","https://example.org/a?b=c&d=e","mailto:church@example.org","tel:+61255551234","","http://example.org/","https://name:password@example.org/","javascript:alert(1)","//example.org/","/../private/","/a/%2f/private/","/a/%5c/private/","/a/%00/","/a/%0a/","#1bad","mailto:incomplete","tel:call-us","/bad path/","https://example.org/\\bad"];
  for(const link of links)expect(safeHref(link),link).toBe(safeCmsHref(link));
  expect(safeHref("http://example.org/")).toBe(false);
 });
});
