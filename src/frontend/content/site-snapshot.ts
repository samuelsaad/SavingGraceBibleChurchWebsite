/** Request-scoped CMS projection. Static builds retain the immutable checked-in defaults. */
import type { CmsHomePayload } from "../../cms/model";
import type { SitePage, BlogPost } from "./types";
import type { ChurchEvent, Venue } from "./events";
import type { MenuItem } from "./navigation";
import type { FrontendRenderContext } from "../routes";
import { aboutCopy, bottomBarCopy, churchNotice, contactCopy, eventsCopy, footerServicesCopy, getInvolvedCopy, heroCopy, navigationCopy, pillars, sermonsCopy, servicesCopy, socialPlatforms, welcomeCopy } from "./home-content";
import { primaryMenu, footerMenu } from "./navigation";

type TextFields<T> = { [K in keyof T]: string };
export interface FrontendSiteSettings {
  siteName: string;
  primaryMenu: readonly MenuItem[];
  footerMenu: readonly MenuItem[];
  navigationCopy: TextFields<typeof navigationCopy>;
  contactCopy: TextFields<typeof contactCopy>;
  footerServicesCopy: TextFields<typeof footerServicesCopy> & {morningHref?:string;eveningHref?:string};
  getInvolvedHeading: string;
  sermonFooterHeading: string;
  bottomBarCopy: TextFields<typeof bottomBarCopy>;
  socialPlatforms: readonly {id: "facebook"|"youtube"|"instagram"|"podcast";name:string;href:string|null;enabled:boolean}[];
  notice: {text:string;enabled:boolean};
  branding: {logoAsset:string;footerLogoAsset:string;faviconAsset:string;touchIconAsset:string;logoAlt:string};
  headerAction?:{enabled:boolean;label:string;href:string};
  archiveAbout?:{enabled:boolean;heading:string;text:string};
  footerExtraMenu?:readonly MenuItem[];
  footerVisibility: {contact:boolean;navigation:boolean;services:boolean;recentSermon:boolean;social:boolean;archiveLinks:boolean};
}
export interface FrontendAsset {
  id:string; path:string; type:string; width:number; height:number; alt:string;
  focalX?:number; focalY?:number;
}
export interface FrontendSiteSnapshot {
  sourceContentAdoptedByPath?:Readonly<Record<string,boolean>>;
  cmsExplicitSeoByPath?:Readonly<Record<string,import("../seo").ContentSeo>>;
  initialMetadataByPath?:Readonly<Record<string,{title:string;heading:string;seeded:boolean}>>;
  sourceContentByPath?:Readonly<Record<string,readonly import("../../seo/source-public-model").SourcePublicPage[]>>;
  sourceSeoByPath?:Readonly<Record<string,import("../seo").ContentSeo>>;
  modifiedAtByPath?:Readonly<Record<string,string>>;
  pages: readonly SitePage[];
  posts: readonly BlogPost[];
  events: readonly ChurchEvent[];
  venues: Readonly<Record<string, Venue>>;
  home: CmsHomePayload | null;
  settings: FrontendSiteSettings;
  assets: Readonly<Record<string, FrontendAsset>>;
  routes: readonly {path:string;entityId:string;status:200|301|410;targetPath:string|null}[];
}
export const defaultSiteSettings: FrontendSiteSettings = {
  siteName: "Saving Grace Bible Church", primaryMenu, footerMenu, navigationCopy, contactCopy, footerServicesCopy:{...footerServicesCopy,morningHref:"/lords-day-service/",eveningHref:"/evening-service/"},
  getInvolvedHeading:getInvolvedCopy.heading,sermonFooterHeading:sermonsCopy.footerHeading,bottomBarCopy,
  socialPlatforms:socialPlatforms.map(item=>({...item,href:null,enabled:true})),
  notice:{text:churchNotice,enabled:true},
  branding:{logoAsset:"church-logo",footerLogoAsset:"logo-white",faviconAsset:"favicon-32",touchIconAsset:"icon-192",logoAlt:"Saving Grace Bible Church"},
  headerAction:{enabled:true,label:navigationCopy.give,href:"/support-saving-grace-church-offering/"},
  archiveAbout:{enabled:true,heading:"How this archive is organised",text:"Every sermon is shelved under the Bible book it was preached from. The bookshelf mark used in the archive is this website's own device; the Saving Grace Bible Church logo is the church's own."},
  footerExtraMenu:[{label:"Sermons",href:"/sermons/"},{label:"Speakers",href:"/speakers/"},{label:"Series",href:"/series/"},{label:"Books",href:"/books/"},{label:navigationCopy.newsEvents,href:"/events/"},{label:navigationCopy.contactUs,href:"/contact/"},{label:navigationCopy.sitemap,href:"/sitemap/"}],
  footerVisibility:{contact:true,navigation:true,services:true,recentSermon:true,social:true,archiveLinks:true}
};
export function siteSettings(context:FrontendRenderContext): FrontendSiteSettings { return context.siteContent?.settings ?? defaultSiteSettings; }
export const defaultHomeContent: CmsHomePayload = {
  title:"Saving Grace Bible Church",
  description:"Saving Grace Bible Church in Westmeadows, Victoria: Lord's Day services, recent sermons, who we are, upcoming events and how to find us.",
  modules:[
    {id:"home-arrival",enabled:true,block:{kind:"home-arrival",hero:{nameLine1:heroCopy.nameLine1,nameLine2:heroCopy.nameLine2,newHere:heroCopy.newHere,serviceTime:heroCopy.serviceTime,address:heroCopy.address,join:heroCopy.join,joinHref:heroCopy.joinHref,place:"Westmeadows, Melbourne",moreLabel:"What to expect",moreHref:"/lords-day-service/"},media:"congregation",services:{heading:servicesCopy.heading,items:[{id:"morning",enabled:true,...servicesCopy.morning},{id:"evening",enabled:true,...servicesCopy.evening}]}}},
    {id:"home-welcome",enabled:true,block:{kind:"home-welcome",...welcomeCopy,pillars:pillars.map(item=>({...item,enabled:true})),media:"welcome-door"}},
    {id:"home-sermons",enabled:true,block:{kind:"home-sermons",heading:sermonsCopy.heading,viewAll:sermonsCopy.viewAll,limit:3,order:"DESC",sermonIds:[]}},
    {id:"home-about",enabled:true,block:{kind:"home-about",heading:aboutCopy.heading,paragraph:aboutCopy.paragraph,learnMore:aboutCopy.learnMore,learnMoreHref:aboutCopy.learnMoreHref,giving:{heading:aboutCopy.giveHeading,link:aboutCopy.giveLink,href:aboutCopy.giveHref,quote:aboutCopy.quote,attribution:aboutCopy.attribution,enabled:true}}},
    {id:"home-events",enabled:true,block:{kind:"home-events",...eventsCopy,days:35,limit:4}}
  ]
};
