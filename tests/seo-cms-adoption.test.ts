import {describe,expect,it} from 'vitest';
import {sourceCmsAdoption} from '../src/seo/source-cms-adoption';
import {sourcePageSchema} from '../src/seo/source-public-model';
import {validateCmsContent} from '../src/cms/validation';
import {renderSourceContent} from '../src/frontend/source-content';
const original=sourcePageSchema.parse({path:'/original-page/',kind:'page',sourceUrl:'https://www.savinggrace.org.au/original-page/',sourceId:42,capturedAt:'2026-10-11T00:00:00Z',responseSha256:'a'.repeat(64),title:'Exact original SEO title',heading:'Original heading',description:'Original metadata',language:'en-AU',indexable:true,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[{tag:'div',children:[{tag:'h2',text:'Original section'},{tag:'p',children:[{tag:'text',text:'Original wording '},{tag:'a',href:'/about/',children:[{tag:'text',text:'and link'}]}]}]}],sermon:null});
describe('source-backed CMS adoption',()=>{
 it('preserves identity, original text, links and SEO in ordinary editable modules',()=>{
  const plan=sourceCmsAdoption([original],[],[]);expect(plan.seeds).toHaveLength(1);const seed=plan.seeds[0]!;
  expect(seed.key).toMatch(/^source-public:page:42:/);expect(seed.path).toBe(original.path);expect(seed.publish).toBe(true);
  const content=validateCmsContent(seed.kind,seed.payload);expect(content.seo).toMatchObject({title:original.title,description:original.description});expect(JSON.stringify(content.modules)).toContain('Original wording');expect(JSON.stringify(content.modules)).toContain('/about/');
 });
 it('preserves current drafts, gone routes, redirects and later editorial revisions',()=>{
  const plan=sourceCmsAdoption([original],[],[{path:original.path,entityId:'existing',status:410,targetPath:null}]);expect(plan.seeds).toEqual([]);expect(plan.held[0]?.reason).toBe('existing_editorial_ownership_preserved');
  const seed=sourceCmsAdoption([original],[],[]).seeds[0]!;const replay=sourceCmsAdoption([original],[{key:seed.key,draft:{content:{path:original.path}},published:null} as never],[]);expect(replay.seeds).toEqual([]);expect(replay.unchanged).toBe(1);
 });
 it('refuses to invent missing event or archive facts',()=>{
  const event={...original,kind:'event' as const};expect(sourceCmsAdoption([event],[],[]).held[0]?.reason).toBe('verified_event_facts_incomplete');
  const query={...original,path:'/events/?eventDisplay=list'};expect(sourceCmsAdoption([query],[],[]).seeds).toEqual([]);
 });
 it('keeps original node text plain and executable URLs inert during visual rendering',()=>{
  const rendered=renderSourceContent([{tag:'p',children:[{tag:'text',text:'<script>unsafe</script> **literal**'},{tag:'a',href:'javascript:alert(1)',text:'Label'}]}]).toString();
  expect(rendered).toContain('&lt;script&gt;');expect(rendered).toContain('**literal**');expect(rendered).not.toContain('javascript:');expect(rendered).not.toContain('<script>');
 });
});
