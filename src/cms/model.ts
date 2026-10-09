import type { Block, SitePage, BlogPost } from '../frontend/content/types';
import type { ChurchEvent, Venue } from '../frontend/content/events';
import type { MenuItem } from '../frontend/content/navigation';
import type { contactCopy, footerServicesCopy, bottomBarCopy, navigationCopy } from '../frontend/content/home-content';

export const cmsKinds = ['page','home','settings','navigation','event','venue','post'] as const;
export type CmsKind = typeof cmsKinds[number];
type Assets<T> = T extends readonly (infer U)[] ? Assets<U>[] : T extends object ? { [K in keyof T]: K extends 'media' ? string : Assets<T[K]> } : T;
type Copy<T> = T extends string ? string : T extends readonly (infer U)[] ? Copy<U>[] : T extends object ? { -readonly [K in keyof T]: Copy<T[K]> } : T;
export type CmsHomeBlock =
 | {kind:'home-arrival';hero:{nameLine1:string;nameLine2:string;newHere:string;serviceTime:string;address:string;join:string;joinHref:string;place:string;moreLabel?:string;moreHref?:string};media:string;mediaAlt?:string;mediaFocalPoint?:{x:number;y:number};services:{heading:string;items:Array<{id:string;enabled:boolean;title:string;text:string;href:string}>}}
 | {kind:'home-welcome';heading:string;paragraph:string;pillars:Array<{id:string;title:string;text:string;href:string;readMore:string;enabled:boolean}>;media:string;mediaAlt?:string;mediaFocalPoint?:{x:number;y:number}}
 | {kind:'home-about';heading:string;paragraph:string;learnMore:string;learnMoreHref:string;giving:{heading:string;link:string;href:string;quote:string;attribution:string;enabled:boolean}}
 | {kind:'home-sermons';heading:string;viewAll:string;limit:number;order:'ASC'|'DESC';sermonIds:string[]}
 | {kind:'home-events';heading:string;viewCalendar:string;viewCalendarHref:string;days:number;limit:number};
export type CmsBlock = Assets<Block> | CmsHomeBlock;
export interface CmsPresentation {background?:'default'|'white'|'soft'|'ink';spacing?:'compact'|'normal'|'roomy';alignment?:'left'|'center';width?:'full'|'reading'}
export interface CmsModule {id:string;enabled:boolean;block:CmsBlock;presentation?:CmsPresentation}
export type CmsPagePayload = Omit<Assets<SitePage>,'blocks'|'aside'|'source'> & {modules:CmsModule[];asideModules?:CmsModule[];source?:SitePage['source']};
export type CmsPostPayload = Omit<Assets<BlogPost>,'blocks'|'source'> & {modules:CmsModule[];source?:BlogPost['source'];status?:'published'|'draft'|'private';legacyPaths?:string[]};
export interface CmsHomePayload {title:string;description:string;modules:CmsModule[]}
export interface CmsSettingsPayload {
 primaryMenu:MenuItem[];footerMenu:MenuItem[];navigationCopy:Copy<typeof navigationCopy>;contactCopy:Copy<typeof contactCopy>;
 footerServicesCopy:Copy<typeof footerServicesCopy>&{morningHref?:string;eveningHref?:string};getInvolvedHeading:string;sermonFooterHeading:string;bottomBarCopy:Copy<typeof bottomBarCopy>;
 socialPlatforms:Array<{id:'facebook'|'youtube'|'instagram'|'podcast';name:string;href:string|null;enabled:boolean}>;
 notice:{text:string;enabled:boolean};branding:{logoAsset:string;footerLogoAsset:string;faviconAsset:string;touchIconAsset:string;logoAlt:string};
 headerAction?:{enabled:boolean;label:string;href:string};archiveAbout?:{enabled:boolean;heading:string;text:string};footerExtraMenu?:MenuItem[];
 footerVisibility:{contact:boolean;navigation:boolean;services:boolean;recentSermon:boolean;social:boolean;archiveLinks:boolean};siteName:string;
}
export type CmsEventPayload = Omit<Assets<ChurchEvent>,'id'|'venue'> & {id:string;venue:string;status?:'published'|'draft'|'private'};
export type CmsVenuePayload = Omit<Venue,'id'> & {id:string};
export type CmsDocument = Record<string,unknown>;
export interface CmsSeed {key:string;kind:CmsKind;title:string;path?:string;payload:object;publish:boolean}
export interface CmsRevision {id:string;revisionNumber:number;content:CmsDocument;createdAt:string;actor:string;sourceRevisionId:string|null}
export interface CmsEntity {id:string;key:string;kind:CmsKind;rowVersion:number;draftRevisionId:string;publishedRevisionId:string|null;draft:CmsRevision;published:CmsRevision|null}
export interface CmsPublishedDocument {id:string;key:string;kind:CmsKind;revisionId:string;content:CmsDocument;payload:CmsDocument}
export interface CmsRoute {path:string;entityId:string;status:200|301|410;targetPath:string|null}
export interface CmsSnapshot {documents:Record<string,CmsDocument>;entities:CmsPublishedDocument[];routes:CmsRoute[]}
export interface CmsMutation {expectedRowVersion:number}
export interface CmsRevisionMutation extends CmsMutation {revisionId:string}
export interface CmsUnpublishInput extends CmsMutation {disposition:'gone'|'redirect';targetPath?:string}
export interface CmsAuditActor {subject:string;role:'admin'|'system';correlationId:string}
