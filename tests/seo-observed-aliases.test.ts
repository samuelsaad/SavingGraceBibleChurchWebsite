import {describe,it,expect} from 'vitest';
import {bindObservedSourceAliases,observedAlias,type ObservedSourceAlias} from '../src/seo/source-observed-aliases';
import {sourceRoutePolicy} from '../src/seo/runtime-snapshot';
import {observedSourceAliases} from '../src/seo/source-original-alias-manifest';
import type {SourcePublicPage} from '../src/seo/source-public-model';
const page={sourceId:42,path:'/event/example/2024-01-14/',kind:'event',responseSha256:'a'.repeat(64),issues:[]} as unknown as SourcePublicPage;
const row:ObservedSourceAlias={alias:'/?p=42',target:page.path,sourceId:42,kind:'event',responseSha256:page.responseSha256,chain:[]};
describe('observed original redirect identities',()=>{
 it('resolves an explicit numeric occurrence despite a reused archive ID, without guessing other ambiguous IDs',()=>{
  const pages=[page,{...page,path:'/event/example/all/',kind:'archive' as const}];
  expect(sourceRoutePolicy(pages,[],undefined,undefined,[row]).sourceObservedAliases).toEqual({'/?p=42':page.path});
  expect(sourceRoutePolicy(pages,[],undefined,undefined,[]).sourceShortlinks).toEqual({});
 });
 it('requires the exact active source identity, kind and response hash',()=>{
  for(const changed of [{sourceId:43},{kind:'archive' as const},{responseSha256:'b'.repeat(64)},{issues:['conflict']}])expect(bindObservedSourceAliases([{...page,...changed}],[row],new Set(),x=>x)).toEqual({});
  expect(bindObservedSourceAliases([],[row],new Set(),x=>x)).toEqual({});
 });
 it('keeps editorial alias ownership and flattens current target edits and withdrawals',()=>{
  expect(bindObservedSourceAliases([page],[row],new Set([row.alias]),x=>x)).toEqual({});
  expect(bindObservedSourceAliases([page],[row],new Set(),()=>'/current/')).toEqual({'/?p=42':'/current/'});
  expect(bindObservedSourceAliases([page],[row],new Set(),()=>null)).toEqual({'/?p=42':null});
  expect(bindObservedSourceAliases([page],[row],new Set(),()=>undefined)).toEqual({});
  expect(sourceRoutePolicy([page],[{path:page.path,entityId:'42',status:301,targetPath:'/missing-target/'}],undefined,undefined,[row]).sourceObservedAliases).toEqual({});
  const sermon={...page,kind:'sermon' as const};expect(bindObservedSourceAliases([sermon],[{...row,kind:'sermon'}],new Set(),x=>x,{'42':'/sermons/audited-current-slug/'})).toEqual({'/?p=42':'/sermons/audited-current-slug/'});
 });
 it('preserves exact campaign encoding without discarding meaningful or ambiguous parameters',()=>{
  const aliases={'/?p=42':'/current/','/events/summary/?related_series=42':'/series/example/','/old':'/current/'};
  expect(observedAlias(new URL('https://example.test/?p=42&utm_campaign=a%20b'),aliases)).toEqual({target:'/current/?utm_campaign=a%20b'});
  for(const path of ['/?p=42&p=42','/?p=42&page_id=42','/?p=42&preview=true','/events/summary/?related_series=42&eventDisplay=past'])expect(observedAlias(new URL('https://example.test'+path),aliases)).toBeNull();
  expect(observedAlias(new URL('https://example.test/old?filter=kept'),aliases)).toEqual({target:'/current/?filter=kept'});
  expect(observedAlias(new URL('https://example.test/?p=42&utm_source=x'),{'/?p=42':null})).toEqual({target:null});
 });
 it('contains witnessed public menu, event-series and historical occurrence aliases with no homepage fallback',()=>{
  for(const [alias,target] of [['/pages/evening-service/','/evening-service/'],['/giving','/support-saving-grace-church-offering/'],['/?p=27942','/mens-ministry/'],['/?p=10000537','/event/sunday-evening-service/2024-01-14/'],['/events/summary/?related_series=27914','/series/sunday-evening-service/']])expect(observedSourceAliases.find(r=>r.alias===alias)?.target).toBe(target);
  for(const alias of observedSourceAliases){expect(alias.target).not.toBe('/');expect(alias.chain.at(-1)?.status).toBe(200);expect(alias.chain.slice(0,-1).every(r=>[301,302,303,307,308].includes(r.status))).toBe(true);}
 });
});
