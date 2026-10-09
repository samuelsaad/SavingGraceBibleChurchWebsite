import {canonicalOrigin} from '../../frontend/routes';
import {escape,type CmsObject} from './fields';
/** A draft projection, never a claim that local/staging content is indexable. */
export function cmsSearchAppearance(content:CmsObject,kind:string):string {
 if(!['page','post','event','home'].includes(kind))return '';
 const seo=(content.seo??{})as CmsObject,path=kind==='home'?'/':String(content.path??'/');
 const title=String(seo.title||content.title||'');
 const description=String(seo.description||(Array.isArray(content.description)?content.description[0]:content.description)||'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*|_/g,'').replace(/\s+/g,' ').trim();
 return `<section class="cms-fieldset" aria-label="Search appearance preview"><h3>Search appearance</h3><p><strong>${escape(title)}</strong></p><p>${escape(canonicalOrigin+path)}</p>${description?`<p>${escape(description)}</p>`:''}<p class="cms-help">${seo.noindex?'Excluded from search engines even after publication.':'Eligible production publications use this address. Drafts, local and staging previews remain excluded.'} ${seo.replaceSourceContent?"Published edited copy will replace the migrated original copy. Check that no required paragraphs or links are lost.":"Verified original copy remains visible when it is missing from the edited page. Choose Replace source content only when the edited page is a complete replacement."} The page address controls the canonical URL. Search engines may choose different wording.</p></section>`;
}
