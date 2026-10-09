import {describe,it,expect} from 'vitest';
import {validateCmsContent} from '../src/cms/validation';
import {pageShell} from '../src/frontend/shell';
import {html} from '../src/frontend/html';
import {publicRenderContext,previewRenderContext} from '../src/frontend/routes';
import {renderFrontendBoundaryPage} from '../src/frontend/pages/boundary';
import {resolveHref,inline} from '../src/frontend/content/markup';
import {createCmsFrontendSnapshot} from '../src/cms/frontend-adapter';
import {optionalFieldsFor} from '../src/admin/cms/fields';
const page={id:'anonymous-page',path:'/anonymous-page/',title:'Visible title',description:'Visible description',section:'about',modules:[]};
const input={title:'Visible title',description:'A **plain** [description](/about/).',canonicalPath:'/anonymous-page/',robots:'index, follow' as const,body:html`<h1>Visible heading</h1>`};

describe('Controlled CMS search appearance',()=>{
 it('validates explicit metadata while rejecting executable, arbitrary or external canonical inputs',()=>{
  expect(validateCmsContent('page',{...page,seo:{title:'Exact title',description:'Metadata',socialTitle:'Share',socialDescription:'Share text',image:'congregation',imageAlt:'People',noindex:true}}).seo).toMatchObject({title:'Exact title',noindex:true});
  for(const seo of [{canonical:'https://evil.example/'},{robots:'index,follow'},{jsonLd:'{}'},{title:'<script>alert(1)</script>'},{description:'Line\nHeader'},{image:'https://staging.example/image.jpg'}])expect(()=>validateCmsContent('page',{...page,seo})).toThrow();
 });
 it('keeps visible content independent and uses exact SEO overrides and managed sharing images',()=>{
  const document=pageShell({...input,seo:{title:'Exact source title',description:'Exact description',socialTitle:'Sharing title',socialDescription:'Sharing description',image:'congregation',imageAlt:'Congregation & visitors'}},publicRenderContext);
  expect(document).toContain('<title>Exact source title</title>');expect(document).toContain('<h1>Visible heading</h1>');
  expect(document).toContain('name="description" content="Exact description"');expect(document).toContain('property="og:title" content="Sharing title"');
  expect(document).toMatch(/property="og:image" content="https:\/\/www\.savinggrace\.org\.au\/media\//);
  expect(document).toContain('Congregation &amp; visitors');expect(document).not.toContain('staging.');
 });
 it('derives canonicals from the validated environment and omits absent optional imagery',()=>{
  const document=pageShell(input,{...publicRenderContext,seo:{canonicalOrigin:'https://church.example',indexable:true}});
  expect(document).toContain('rel="canonical" href="https://church.example/anonymous-page/"');expect(document).toContain('content="A plain description."');expect(document).not.toContain('property="og:image"');
 });
 it('never permits an SEO override to expose private, staging, or error canonical identity',()=>{
  for(const context of [previewRenderContext,{...publicRenderContext,seo:{canonicalOrigin:'https://church.example',indexable:false}}]){
   const document=pageShell({...input,seo:{title:'Private draft',noindex:false}},context);expect(document).toContain('noindex, nofollow, noarchive');expect(document).not.toContain('rel="canonical"');expect(document).not.toContain('property="og:');
  }
  const error=renderFrontendBoundaryPage({title:'Gone',message:'Removed'},publicRenderContext);expect(error).not.toContain('rel="canonical"');expect(error).not.toContain('property="og:');
  expect(pageShell({...input,seo:{noindex:true}})).toContain('name="robots" content="noindex, follow"');
 });
 it('resolves old internal destinations to the final route and preserves query/fragment',()=>{
  const context={...publicRenderContext,siteContent:createCmsFrontendSnapshot({entities:[],documents:{},routes:[{path:'/old/',entityId:'page',status:301,targetPath:'/current/'},{path:'/current/',entityId:'page',status:200,targetPath:null},{path:'/gone/',entityId:'gone',status:410,targetPath:null}]})};
  expect(resolveHref('/old/?a=1#section',context)).toBe('/current/?a=1#section');
  expect(String(inline('[Current](/old/)',context))).toContain('href="/current/"');
  expect(String(inline('[Removed](/gone/)',context))).not.toContain('href=');
 });
 it('exposes optional metadata without inserting defaults into existing revisions',()=>{
  const content={...page};expect(optionalFieldsFor(content,'','page',content).find(field=>field.key==='seo')?.value).toEqual({});expect(content).not.toHaveProperty('seo');
  expect(optionalFieldsFor({},'seo','page',content).map(field=>field.key)).toEqual(['title','description','socialTitle','socialDescription','image','imageAlt','noindex','replaceSourceContent']);
 });
});
