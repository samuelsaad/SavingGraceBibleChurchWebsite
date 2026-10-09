import {describe,it,expect}from "vitest";
import {relatedLinkFields}from "../src/admin/cms/visual-link-fields";
import {optionalFieldsFor,type CmsObject}from "../src/admin/cms/fields";
describe("contextual link destinations",()=>{
 it("resolves ordinary, navigation and homepage labels without writing defaults",()=>{
  const content:CmsObject={modules:[{block:{hero:{join:"Visit",joinHref:"/contact/",moreLabel:"Find out more"},giving:{link:"Give",href:"/giving/"},pillars:[{title:"Pillar",readMore:"Learn more",href:"/about/"}]}}],primaryMenu:[{label:"About",href:"/about/"}]};const before=JSON.stringify(content);
  expect(relatedLinkFields(content,["modules","0","block","hero","join"])[0]).toMatchObject({path:["modules","0","block","hero","joinHref"],value:"/contact/"});
  expect(relatedLinkFields(content,["modules","0","block","hero","moreLabel"])[0]).toMatchObject({path:["modules","0","block","hero","moreHref"],value:"/lords-day-service/"});
  expect(relatedLinkFields(content,["modules","0","block","giving","link"])[0]!.path).toEqual(["modules","0","block","giving","href"]);
  expect(relatedLinkFields(content,["modules","0","block","pillars","0","title"])[0]!.value).toBe("/about/");
  expect(relatedLinkFields(content,["primaryMenu","0","label"])[0]!.path).toEqual(["primaryMenu","0","href"]);
  expect(JSON.stringify(content)).toBe(before);
 });
 it("keeps bare email storage separate from a URL destination and handles legacy service defaults",()=>{
  const content:CmsObject={contactCopy:{email:"Email us",emailAddress:"office@example.org",telephone:"Call",telephoneHref:"tel:+61000000000",directions:"Find us",directionsHref:"https://example.org/map"},footerServicesCopy:{morningLink:"Morning",eveningLink:"Evening"}};
  expect(relatedLinkFields(content,["contactCopy","email"])[0]).toMatchObject({path:["contactCopy","emailAddress"],value:"office@example.org",format:"email"});
  expect(relatedLinkFields(content,["contactCopy","telephone"])[0]!.value).toBe("tel:+61000000000");
  expect(relatedLinkFields(content,["footerServicesCopy","morningLink"])[0]!.value).toBe("/lords-day-service/");
  expect(relatedLinkFields(content,["footerServicesCopy","eveningLink"])[0]!.value).toBe("/evening-service/");
 });
 it("does not invent links for ordinary text or repeat an already selected destination",()=>{
  const content:CmsObject={title:"Page",text:"Content",link:{label:"More",href:"/about/"}};
  expect(relatedLinkFields(content,["title"])).toEqual([]);expect(relatedLinkFields(content,["text"])).toEqual([]);expect(relatedLinkFields(content,["link","href"])).toEqual([]);expect(relatedLinkFields(content,[])).toEqual([]);
 });
 it("offers panel columns explicitly while leaving the loaded block unchanged",()=>{
  const block:CmsObject={kind:"panel",blocks:[]};expect(optionalFieldsFor(block,"modules.0.block","page",{modules:[{block}]})).toContainEqual({key:"columns",value:1,present:false});expect(block).not.toHaveProperty("columns");
 });
});
