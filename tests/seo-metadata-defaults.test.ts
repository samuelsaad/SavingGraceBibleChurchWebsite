import {describe,expect,it} from 'vitest';
import {pageShell} from '../src/frontend/shell';
import {html} from '../src/frontend/html';
import {publicRenderContext} from '../src/frontend/routes';
import {createCmsFrontendSnapshot} from '../src/cms/frontend-adapter';
describe('original SEO defaults',()=>{
 it('does not replace valid source titles with generated template defaults; explicit CMS edits still win',()=>{
  const site=createCmsFrontendSnapshot({entities:[],documents:{},routes:[]});site.sourceSeoByPath={'/sermons/':{title:'Original archive title',description:'Original metadata'}};
  const input={title:'Template heading',seo:{title:'Generated template title',description:'Template metadata',noindex:true},canonicalPath:'/sermons/',robots:'noindex, follow' as const,body:html`<h1>Template heading</h1>`};
  const render=()=>pageShell(input,{...publicRenderContext,siteContent:site});
  expect(render()).toContain('<title>Original archive title</title>');expect(render()).toContain('content="Original metadata"');expect(render()).toContain('noindex, follow');
  site.cmsExplicitSeoByPath={'/sermons/':{title:'Explicit editor title'}};expect(render()).toContain('<title>Explicit editor title</title>');
 });
});
