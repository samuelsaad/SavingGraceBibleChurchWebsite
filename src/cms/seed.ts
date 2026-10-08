/** Curated church-owned content only. Initialization never queries or exports sermon content. */
import { createHash } from "node:crypto";
import { churchPages, blogPosts } from "../frontend/content/pages";
import { events, venues } from "../frontend/content/events";
import { siteImages, siteImageBytes } from "../frontend/assets/media";
import { logoBytes, logoPath, logoWidth, logoHeight, logoAlt } from "../frontend/assets/logo";
import { defaultHomeContent, defaultSiteSettings } from "../frontend/content/site-snapshot";
import type { Block } from "../frontend/content/types";
import type { CmsBlock, CmsModule, CmsSeed } from "./model";

function modules(key:string, blocks:readonly Block[], enabled=true):CmsModule[] {
  return blocks.map((block,index)=>({id:`${key}-${String(index+1).padStart(3,"0")}`,enabled,block:structuredClone(block) as unknown as CmsBlock}));
}
export function buildCmsSeeds():CmsSeed[] {
  return [
    {key:"home",kind:"home",title:defaultHomeContent.title,path:"/",payload:structuredClone(defaultHomeContent),publish:true},
    {key:"settings",kind:"settings",title:"Website settings",payload:structuredClone(defaultSiteSettings),publish:true},
    ...churchPages.map(({blocks,aside,...page}):CmsSeed=>({key:`page:${page.id}`,kind:"page",title:page.title,path:page.path,publish:page.status==="published",payload:{...structuredClone(page),...(page.hero?{hero:{...page.hero,enabled:true}}:{}),modules:modules(page.id,blocks),...(aside?{asideModules:modules(`${page.id}-aside`,aside,false)}:{})}})),
    ...blogPosts.map(({blocks,...post}):CmsSeed=>({key:`post:${post.id}`,kind:"post",title:post.title,path:post.path,publish:true,payload:{...structuredClone(post),status:"published",legacyPaths:[],modules:modules(post.id,blocks)}})),
    ...events.map(event=>({key:`event:${event.id}`,kind:"event" as const,title:event.title,path:event.path,payload:{...structuredClone(event),status:"published"},publish:true})),
    ...Object.values(venues).map(venue=>({key:`venue:${venue.id}`,kind:"venue" as const,title:venue.name,payload:structuredClone(venue),publish:true}))
  ];
}
export interface CmsEmbeddedAssetSeed {key:string;path:string;originalFilename:string;contentType:string;sizeBytes:number;width:number;height:number;checksumSha256:string;alt:string}
/** Register existing bytes under stable keys; upload storage must not duplicate or rewrite them. */
export function buildCmsEmbeddedAssetSeeds():CmsEmbeddedAssetSeed[] {
  const assets=siteImages.map(image=>({key:image.id,path:image.id==="favicon-32"?"/brand/favicon-32.png":image.id==="icon-192"?"/brand/icon-192.png":image.path,originalFilename:image.file,contentType:image.type,sizeBytes:siteImageBytes(image.id).byteLength,width:image.width,height:image.height,checksumSha256:createHash("sha256").update(siteImageBytes(image.id)).digest("hex"),alt:image.alt}));
  const bytes=logoBytes();
  return [...assets,{key:"church-logo",path:logoPath,originalFilename:"saving-grace-logo.png",contentType:"image/png",sizeBytes:bytes.byteLength,width:logoWidth,height:logoHeight,checksumSha256:createHash("sha256").update(bytes).digest("hex"),alt:logoAlt}];
}
