import type {CmsDocument,CmsEntity,CmsRevision} from './model';
/** Directory choices contain identity and revision state; fetch an entity before editing. */
export const cmsDirectoryFields=['id','title','name','path','status','template'] as const;
export function cmsDirectoryContent(content:CmsDocument):CmsDocument {
 return Object.fromEntries(cmsDirectoryFields.filter(key=>Object.hasOwn(content,key)).map(key=>[key,content[key]]));
}
export function cmsDirectoryEntity(entity:CmsEntity):CmsEntity {
 const revision=(value:CmsRevision):CmsRevision=>({...value,content:cmsDirectoryContent(value.content)});
 return {...entity,draft:revision(entity.draft),published:entity.published?revision(entity.published):null};
}
