import {describe,it,expect} from 'vitest';
import {sourcePageSchema} from '../src/seo/source-public-model';
import {sourceCmsAdoption} from '../src/seo/source-cms-adoption';
import {originalSourceCmsRefresh} from '../src/seo/source-cms-refresh';
import type {CmsEntity} from '../src/cms/model';
const old=sourcePageSchema.parse({path:'/anonymous-original/',kind:'page',sourceUrl:'https://www.savinggrace.org.au/anonymous-original/',sourceId:919195,capturedAt:'2026-01-01T00:00:00Z',responseSha256:'a'.repeat(64),title:'Anonymous original',heading:'Anonymous heading',description:null,indexable:true,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[{tag:'p',text:'Anonymous original copy'}],sermon:null});
const next={...old,content:[{tag:'p',id:'retained-fragment',text:'Anonymous original copy'}]};
function entity():CmsEntity{const seed=sourceCmsAdoption([old],[],[]).seeds[0]!;const revision={id:'revision',revisionNumber:1,content:seed.payload,createdAt:'2026-01-01T00:00:00Z',actor:'source-public-migration',sourceRevisionId:null};return {id:'entity',key:seed.key,kind:seed.kind,rowVersion:1,draftRevisionId:revision.id,publishedRevisionId:null,draft:revision,published:null} as CmsEntity;}
describe('no-clobber original seed refresh',()=>{
 it('updates only an exact untouched prior seed and preserves its draft state',()=>{const plan=originalSourceCmsRefresh([old],[next],[entity()],[]);expect(plan.updates).toHaveLength(1);expect(plan.updates[0]?.publish).toBe(false);expect(plan.updates[0]?.content).toHaveProperty('modules');});
 it('holds newer administrator changes rather than overwriting them',()=>{const edited=entity();edited.draft.content={...edited.draft.content,title:'Explicit administrator edit'};const plan=originalSourceCmsRefresh([old],[next],[edited],[]);expect(plan.updates).toEqual([]);expect(plan.held[0]?.reason).toBe('newer_editorial_revision_preserved');});
 it('replays the refreshed content without another revision',()=>{const updated=entity();updated.draft.content=sourceCmsAdoption([next],[],[]).seeds[0]!.payload as Record<string,unknown>;const plan=originalSourceCmsRefresh([old],[next],[updated],[]);expect(plan.updates).toEqual([]);expect(plan.unchanged).toBe(1);});
});
