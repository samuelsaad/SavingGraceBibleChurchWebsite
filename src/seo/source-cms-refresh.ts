/** Refresh only untouched source seeds. Any editor change is a held conflict. */
import type {CmsEntity,CmsRoute} from '../cms/model';
import type {SourcePublicPage} from './source-public-model';
import {stableJson} from './source-public-model';
import {sourceCmsAdoption} from './source-cms-adoption';
export function originalSourceCmsRefresh(previous:readonly SourcePublicPage[],current:readonly SourcePublicPage[],entities:readonly CmsEntity[],routes:readonly CmsRoute[]){
 const retained=entities.filter(e=>!e.key.startsWith('source-public:')),ids=new Set(retained.map(e=>e.id)),retainedRoutes=routes.filter(r=>ids.has(r.entityId));
 const before=new Map(sourceCmsAdoption(previous,retained,retainedRoutes).seeds.map(seed=>[seed.key,seed]));
 const after=new Map(sourceCmsAdoption(current,retained,retainedRoutes).seeds.map(seed=>[seed.key,seed]));
 const updates:Array<{entity:CmsEntity;content:Record<string,unknown>;publish:boolean}>=[],held:Array<{key:string;reason:string}>=[];let unchanged=0;
 for(const entity of entities){
  if(!entity.key.startsWith('source-public:'))continue;
  const old=before.get(entity.key),next=after.get(entity.key);
  if(!old||!next){held.push({key:entity.key,reason:'source_or_editorial_ownership_changed'});continue;}
  if(stableJson(entity.draft.content)===stableJson(next.payload)){unchanged++;continue;}
  if(stableJson(entity.draft.content)!==stableJson(old.payload)||entity.published&&stableJson(entity.published.content)!==stableJson(old.payload)){
   held.push({key:entity.key,reason:'newer_editorial_revision_preserved'});continue;
  }
  updates.push({entity,content:next.payload as Record<string,unknown>,publish:Boolean(entity.published)});
 }
 return {updates,held,unchanged};
}
