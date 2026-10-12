
import {describe,it,expect} from 'vitest';
import {createCmsFrontendSnapshot} from '../src/cms/frontend-adapter';
import {renderSourceContent} from '../src/frontend/source-content';
import type {CmsSnapshot,CmsDocument} from '../src/cms/model';
import type {SourceNode} from '../src/domain/source-content';
function fixture(){
 const nodes:SourceNode[]=[{tag:'p',text:'Anonymous original source text.',children:[{tag:'a',href:'/anonymous/',text:'Source link'}]},{tag:'p',lang:'ar',dir:'rtl',text:'نص عربي محفوظ'}];
 const modules=[{id:'original-content',enabled:true,block:{kind:'source-content',nodes}}];
 const page={id:'anonymous-page',title:'Anonymous page',heading:'Anonymous heading',path:'/anonymous/',description:'',section:'resources',status:'published',legacyPaths:[],modules} as unknown as CmsDocument;
 const event={id:'anonymous-event',title:'Anonymous event',path:'/event/anonymous/',schedule:{kind:'single',date:'2026-10-12'},start:'12:00',end:'13:00',venue:'anonymous-venue',description:[],calendarVisible:false,status:'published',legacyPaths:[],modules} as unknown as CmsDocument;
 const entities=[{id:'page-id',key:'page:anonymous',kind:'page' as const,revisionId:'page-revision',content:page,payload:page},{id:'event-id',key:'event:anonymous',kind:'event' as const,revisionId:'event-revision',content:event,payload:event}];
 return {nodes,snapshot:{entities,documents:Object.fromEntries(entities.map(e=>[e.key,e.content])),routes:[]} as CmsSnapshot};
}
function freeze(value:unknown,seen=new Set<object>()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);Object.freeze(value);for(const child of Object.values(value))freeze(child,seen);}
const sourceNodes=(value:unknown)=>(value as {nodes:SourceNode[]}).nodes;
describe('immutable visitor source content',()=>{
 it('renders every frozen source node identically without copying its tree or mutating the snapshot',()=>{
  const {nodes,snapshot}=fixture(),before=JSON.stringify(snapshot);freeze(snapshot);
  const shared=createCmsFrontendSnapshot(snapshot,[],false,false,{immutableSourceContent:true});
  const regular=createCmsFrontendSnapshot(snapshot);
  const blocks=[shared.pages[0]!.blocks[0],shared.events[0]!.modules![0]];
  for(const block of blocks){expect(sourceNodes(block)).toBe(nodes);expect(String(renderSourceContent(sourceNodes(block)))).toBe(String(renderSourceContent(nodes)));}
  expect(String(renderSourceContent(sourceNodes(regular.pages[0]!.blocks[0])))).toBe(String(renderSourceContent(nodes)));
  expect(JSON.stringify(snapshot)).toBe(before);
 });
 it('keeps default and editor trees independent even when the immutable visitor option is supplied to an editor',()=>{
  const {nodes,snapshot}=fixture();
  for(const result of [createCmsFrontendSnapshot(snapshot),createCmsFrontendSnapshot(snapshot,[],true,false,{immutableSourceContent:true})]){
   const copy=sourceNodes(result.pages[0]!.blocks[0]);expect(copy).not.toBe(nodes);copy[0]!.text='Anonymous draft change';expect(nodes[0]!.text).toBe('Anonymous original source text.');
   const eventCopy=sourceNodes(result.events[0]!.modules![0]);expect(eventCopy).not.toBe(nodes);eventCopy[0]!.text='Anonymous event draft change';expect(nodes[0]!.text).toBe('Anonymous original source text.');
  }
 });
 it('keeps event schedule metadata independent while sharing only immutable source trees',()=>{
  const {snapshot}=fixture();const result=createCmsFrontendSnapshot(snapshot,[],false,false,{immutableSourceContent:true});
  const schedule=result.events[0]!.schedule as {kind:string;date:string};schedule.date='2026-11-12';
  expect((snapshot.entities[1]!.content.schedule as {date:string}).date).toBe('2026-10-12');
 });
});
