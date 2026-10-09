import {afterEach,describe,expect,it,vi} from 'vitest';
import {VisualHistory,duplicateValue,moveItem,readPath,writePath} from '../src/admin/cms/visual-state';
import type {CmsObject,CmsValue} from '../src/admin/cms/fields';

afterEach(()=>vi.restoreAllMocks());

describe('visual editor undo and redo',()=>{
 it('groups typing in the same field within 800ms and restores complete content',()=>{
  let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);
  const history=new VisualHistory({title:'Original',enabled:true});
  history.record({title:'O',enabled:true},'Edit title','title');now+=300;
  history.record({title:'Ou',enabled:true},'Edit title','title');now+=300;
  history.record({title:'Our page',enabled:true},'Edit title','title');
  expect(history.canUndo).toBe(true);expect(history.undo()).toEqual({title:'Original',enabled:true});expect(history.canUndo).toBe(false);expect(history.canRedo).toBe(true);
  expect(history.redo()).toEqual({title:'Our page',enabled:true});expect(history.canRedo).toBe(false);
 });
 it('separates delayed typing, other fields and structural edits into their own undo steps',()=>{
  let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);const history=new VisualHistory({title:'A',text:'X'});
  history.record({title:'B',text:'X'},'Title','title');now+=801;
  history.record({title:'C',text:'X'},'Title','title');now+=50;
  history.record({title:'C',text:'Y'},'Text','text');
  history.record({title:'C',text:'Y',visible:false},'Hide section');
  expect(history.undo()).toEqual({title:'C',text:'Y'});expect(history.undo()).toEqual({title:'C',text:'X'});expect(history.undo()).toEqual({title:'B',text:'X'});expect(history.undo()).toEqual({title:'A',text:'X'});expect(history.undo()).toBeNull();
 });
 it('bounds history at 80 recoverable steps and retains the newest changes',()=>{
  const history=new VisualHistory({count:0});for(let count=1;count<=95;count++)history.record({count},'Update');
  for(let count=94;count>=15;count--)expect(history.undo()).toEqual({count});
  expect(history.canUndo).toBe(false);expect(history.undo()).toBeNull();
  for(let count=16;count<=95;count++)expect(history.redo()).toEqual({count});
  expect(history.canRedo).toBe(false);expect(history.redo()).toBeNull();
 });
 it('does not add no-op edits and clears redo after a new branch of work',()=>{
  const history=new VisualHistory({title:'A'});history.record({title:'A'},'Unchanged');expect(history.canUndo).toBe(false);
  history.record({title:'B'},'Title');history.record({title:'C'},'Title');expect(history.undo()).toEqual({title:'B'});
  history.record({title:'B'},'Unchanged');expect(history.canRedo).toBe(true);
  history.record({title:'D'},'Replacement');expect(history.canRedo).toBe(false);expect(history.redo()).toBeNull();expect(history.undo()).toEqual({title:'B'});
 });
 it('isolates snapshots from caller mutation and resets after loading another revision',()=>{
  const initial:CmsObject={nested:{text:'A'}};const history=new VisualHistory(initial);(initial.nested as CmsObject).text='External change';
  const next:CmsObject={nested:{text:'B'}};history.record(next,'Text');(next.nested as CmsObject).text='Another external change';
  const restored=history.undo()!;expect(restored).toEqual({nested:{text:'A'}});(restored.nested as CmsObject).text='Changed returned object';expect(history.redo()).toEqual({nested:{text:'B'}});expect(history.undo()).toEqual({nested:{text:'A'}});
  const replacement:CmsObject={title:'Restored revision'};history.reset(replacement);replacement.title='External';expect(history.canUndo).toBe(false);expect(history.canRedo).toBe(false);history.record({title:'Later'},'Title');expect(history.undo()).toEqual({title:'Restored revision'});
 });
});

describe('visual section identity and reordering',()=>{
 it('regenerates every duplicate identity while preserving references and the original',()=>{
  const original:CmsObject={id:'section-original',enabled:true,block:{kind:'panel',id:'group-original',blocks:[{kind:'heading',id:'heading-original',text:'Example'},{kind:'home-welcome',pillars:[{id:'pillar-original',title:'One'}]},{kind:'sermon-cards',sermonIds:['existing-sermon'],heading:'Teaching'}]}};
  const before=structuredClone(original),first=duplicateValue(original),second=duplicateValue(original);
  const ids=(value:CmsValue):string[]=>!value||typeof value!=='object'?[]:Object.entries(value).flatMap(([key,child])=>key==='id'&&typeof child==='string'?[child]:ids(child));
  const all=[...ids(first),...ids(second)];expect(all).toHaveLength(8);expect(new Set(all).size).toBe(all.length);expect(all.some(id=>ids(original).includes(id))).toBe(false);expect(original).toEqual(before);
  expect(readPath(first,['block','blocks','2','sermonIds'])).toEqual(['existing-sermon']);expect(readPath(first,['block','blocks','0','text'])).toBe('Example');
  writePath(first,['block','blocks','0','text'],'Changed duplicate');expect(readPath(original,['block','blocks','0','text'])).toBe('Example');
 });
 it('moves supported nested blocks in both directions without losing or duplicating content',()=>{
  const content:CmsObject={modules:[{id:'group',block:{blocks:[{text:'A'},{text:'B'},{text:'C'}]}}]},path=['modules','0','block','blocks'];
  expect(moveItem(content,path,0,2)).toBe(true);expect(readPath(content,path)).toEqual([{text:'B'},{text:'C'},{text:'A'}]);expect(moveItem(content,path,2,0)).toBe(true);expect(readPath(content,path)).toEqual([{text:'A'},{text:'B'},{text:'C'}]);
 });
 it('refuses out-of-range, fractional, no-op and non-list moves without changing content',()=>{
  const content:CmsObject={items:['A','B','C'],title:'Example'},before=structuredClone(content);
  for(const [from,to]of [[-1,1],[0,-1],[3,0],[0,3],[0.5,1],[1,1.5],[1,1],[Number.NaN,0],[0,Number.POSITIVE_INFINITY]])expect(moveItem(content,['items'],from!,to!)).toBe(false);
  expect(moveItem(content,['missing'],0,1)).toBe(false);expect(moveItem(content,['title'],0,1)).toBe(false);expect(content).toEqual(before);
 });
});

describe('visual content paths',()=>{
 it('reads and writes actual content paths while refusing stale containers',()=>{
  const content:CmsObject={modules:[{block:{text:'Original'}}]};expect(readPath(content,['modules','0','block','text'])).toBe('Original');writePath(content,['modules','0','block','text'],'Edited');expect(readPath(content,['modules','0','block','text'])).toBe('Edited');
  writePath(content,['modules','0','block','alt'],'Added optional field');expect(readPath(content,['modules','0','block','alt'])).toBe('Added optional field');expect(readPath(content,['modules','8','block'])).toBeUndefined();
  expect(()=>writePath(content,[],'Invalid')).toThrow();expect(()=>writePath(content,['modules','8','block','text'],'Invalid')).toThrow();expect(()=>writePath(content,['modules','0','block','text','nested'],'Invalid')).toThrow();
 });
 it('rejects prototype-sensitive paths at every depth without affecting other objects',()=>{
  const content:CmsObject={safe:{text:'Original'}},before=structuredClone(content);
  for(const key of ['__proto__','prototype','constructor'])for(const path of [[key,'polluted'],['safe',key,'polluted'],['safe',key]]){expect(readPath(content,path)).toBeUndefined();expect(()=>writePath(content,path,'Injected')).toThrow();expect(moveItem(content,path,0,1)).toBe(false);}
  expect(content).toEqual(before);expect(Object.prototype).not.toHaveProperty('polluted');
 });
});
