import {describe,it,expect} from 'vitest';
import {renderSourceContent} from '../src/frontend/source-content';
import {sourceRoutePolicy} from '../src/seo/runtime-snapshot';
import {reviewedArchiveAliases} from '../src/seo/source-reviewed-archive-aliases';
import type {SourcePublicPage} from '../src/seo/source-public-model';
describe('exact original link corrections',()=>{
 it('repairs the verified malformed music-ministry email without changing its address',()=>{
  for(const href of ['ralph@savinggrace.org.au','/music-ministry/ralph@savinggrace.org.au','https://www.savinggrace.org.au/music-ministry/ralph@savinggrace.org.au'])expect(String(renderSourceContent([{tag:'a',href,text:'Contact'}]))).toContain('href="mailto:ralph@savinggrace.org.au"');
  expect(String(renderSourceContent([{tag:'a',href:'/other/ralph@savinggrace.org.au',text:'Contact'}]))).toContain('href="/other/ralph@savinggrace.org.au"');
 });
 it('binds empty taxonomy aliases only to the exact original blog archive with all original members',()=>{
  const row=reviewedArchiveAliases[0]!;const page={path:row.target,sourceId:row.sourceId,kind:row.kind,responseSha256:row.responseSha256,issues:[],links:row.dispositionEvidence!.memberPaths} as unknown as SourcePublicPage;
  const policy=sourceRoutePolicy([page],[],undefined,undefined,reviewedArchiveAliases);expect(policy.sourceObservedAliases['/?taxonomy=&term=']).toBe('/blogs/');
  expect(sourceRoutePolicy([{...page,links:page.links.slice(1)}],[],undefined,undefined,reviewedArchiveAliases).sourceObservedAliases).toEqual({});
  expect(sourceRoutePolicy([{...page,sourceId:275}],[],undefined,undefined,reviewedArchiveAliases).sourceObservedAliases).toEqual({});
  expect(sourceRoutePolicy([page],[{path:'/blogs/',entityId:'x',status:410,targetPath:null}],undefined,undefined,reviewedArchiveAliases).sourceObservedAliases['/?taxonomy=&term=']).toBeNull();
 });
});
