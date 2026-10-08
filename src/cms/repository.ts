import type {CmsAuditActor,CmsDocument,CmsEntity,CmsKind,CmsRevision,CmsRevisionMutation,CmsSeed,CmsSnapshot,CmsUnpublishInput} from './model';
export interface CmsRepository {
 list():Promise<CmsEntity[]>;
 get(id:string):Promise<CmsEntity|null>;
 history(id:string):Promise<CmsRevision[]>;
 create(input:{key:string;kind:CmsKind;content:CmsDocument},actor:CmsAuditActor):Promise<CmsEntity>;
 save(id:string,input:{expectedRowVersion:number;content:CmsDocument},actor:CmsAuditActor):Promise<CmsEntity>;
 publish(id:string,input:CmsRevisionMutation,actor:CmsAuditActor):Promise<CmsEntity>;
 unpublish(id:string,input:CmsUnpublishInput,actor:CmsAuditActor):Promise<CmsEntity>;
 restore(id:string,input:CmsRevisionMutation,actor:CmsAuditActor):Promise<CmsEntity>;
 seed(seeds:readonly CmsSeed[],actor?:string):Promise<{inserted:number;unchanged:number}>;
 getPublishedSnapshot():Promise<CmsSnapshot>;
 getPreviewSnapshot(selection:{entityId:string;revisionId?:string}):Promise<CmsSnapshot>;
 canReadAsset(storageKey:string,draft:boolean):Promise<boolean>;
}
