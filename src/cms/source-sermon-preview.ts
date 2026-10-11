import type {CmsPublishedDocument} from './model';
import type {SourcePublicPage} from '../seo/source-public-model';
import type {FrontendRenderContext} from '../frontend/routes';
import type {Block} from '../frontend/content/types';
import {SourcePublicSermonRepository} from '../seo/source-public-repository';
import {applyOriginalCmsSerMons} from '../seo/source-sermon-cms';
import {renderPublicSermonPage} from '../frontend/pages/sermon';
import {frontendResponse} from '../server/http/frontend-response';
export async function originalSermonPreview(document:CmsPublishedDocument,sources:readonly SourcePublicPage[],context:FrontendRenderContext,blocks?:readonly Block[]){
 const source=document.content.source as {id:number},original=sources.find(p=>p.kind==='sermon'&&p.sourceId===source.id);if(!original)throw Error('source_cms_preview_identity');
 const detail=await new SourcePublicSermonRepository([original]).findPublishedBySlug(original.sermon!.slug);if(!detail)throw Error('source_cms_preview_identity');
 applyOriginalCmsSerMons([{detail,sourceWordpressId:source.id,lastModified:original.modifiedAt??original.capturedAt,indexable:original.indexable}],[document],()=>{});
 return frontendResponse(renderPublicSermonPage(detail,context,{...(blocks?{sourceBlocks:blocks}:{})}));
}
