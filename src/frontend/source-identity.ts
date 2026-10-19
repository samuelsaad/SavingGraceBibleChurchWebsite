import type{SourcePublicPage}from'../seo/source-public-model';
/** A native page's recorded WordPress ID resolves aliases without guessing among them. */
export function primarySourcePage(pages:readonly SourcePublicPage[]|undefined,path:string,sourceId?:number):SourcePublicPage|undefined{
 if(!pages?.length)return undefined;
 if(Number.isSafeInteger(sourceId)&&sourceId!>0){const identified=pages.filter(page=>page.sourceId===sourceId);if(identified.length===1)return identified[0];if(identified.length>1){const exact=identified.filter(page=>page.path===path);return exact.length===1?exact[0]:undefined;}}
 const exact=pages.filter(page=>page.path===path);if(exact.length===1)return exact[0];
 if(pages.length===1)return pages[0];const primary=pages.filter(page=>page.kind!=='archive');return primary.length===1?primary[0]:undefined;
}
