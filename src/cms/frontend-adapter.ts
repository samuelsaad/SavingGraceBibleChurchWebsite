/** Convert a repository-selected immutable snapshot into render data for one request. */
import type { CmsSnapshot, CmsPagePayload, CmsPostPayload, CmsHomePayload, CmsSettingsPayload, CmsModule, CmsEventPayload, CmsVenuePayload } from "./model";
import { defaultSiteSettings, type FrontendAsset, type FrontendSiteSnapshot } from "../frontend/content/site-snapshot";
import { siteImages } from "../frontend/assets/media";
import { logoPath, logoWidth, logoHeight, logoAlt } from "../frontend/assets/logo";
import type { Block, SitePage, BlogPost } from "../frontend/content/types";

function blocks(modules:readonly CmsModule[] = [],collection="modules",visualEditor=false):Block[] {
  return modules.flatMap((module,index)=>!visualEditor&&!module.enabled?[]:[({...structuredClone(module.block),cmsInstanceId:module.id,...(visualEditor?{cmsPath:[collection,index,"block"],cmsModulePath:[collection,index],cmsEnabled:module.enabled}:{}),...(module.presentation?{cmsPresentation:structuredClone(module.presentation)}:{})}) as unknown as Block]);
}
export function createCmsFrontendSnapshot(snapshot:CmsSnapshot,assets:readonly FrontendAsset[]=[],visualEditor=false):FrontendSiteSnapshot {
  const result:FrontendSiteSnapshot={pages:[],posts:[],events:[],venues:{},home:null,settings:structuredClone(defaultSiteSettings),assets:{},routes:snapshot.routes.map(route=>({...route}))};
  const pages:SitePage[]=[],posts:BlogPost[]=[];
  const events:CmsEventPayload[]=[],venues:Record<string,CmsVenuePayload>={};
  for(const entity of snapshot.entities){
    const content=entity.content;
    if(entity.kind==="page"){
      const page=content as unknown as CmsPagePayload;
      const {modules,asideModules,...metadata}=page;
      pages.push({...metadata,status:"published",blocks:blocks(modules,"modules",visualEditor),...(asideModules?.some(module=>visualEditor||module.enabled)?{aside:blocks(asideModules,"asideModules",visualEditor)}:{})} as SitePage);
    } else if(entity.kind==="post"){
      const post=content as unknown as CmsPostPayload;
      const {modules,...metadata}=post;
      posts.push({...metadata,blocks:blocks(modules,"modules",visualEditor)} as BlogPost);
    } else if(entity.kind==="home") result.home=structuredClone(content) as unknown as CmsHomePayload;
    else if(entity.kind==="settings") result.settings=structuredClone(content) as unknown as CmsSettingsPayload;
    else if(entity.kind==="event") events.push(structuredClone(content) as unknown as CmsEventPayload);
    else if(entity.kind==="venue"){const venue=structuredClone(content) as unknown as CmsVenuePayload;venues[venue.id]=venue;}
  }
  const embedded:FrontendAsset[]=siteImages.map(image=>({id:image.id,path:image.id==="favicon-32"?"/brand/favicon-32.png":image.id==="icon-192"?"/brand/icon-192.png":image.path,type:image.type,width:image.width,height:image.height,alt:image.alt}));
  embedded.push({id:"church-logo",path:logoPath,type:"image/png",width:logoWidth,height:logoHeight,alt:logoAlt});
  return {...result,pages,posts,events,venues,assets:Object.fromEntries([...embedded,...assets].map(asset=>[asset.id,{...asset}]))};
}
