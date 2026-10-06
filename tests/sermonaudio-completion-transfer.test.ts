import {describe,it,expect} from 'vitest';
import {d175Actor,d175AcceptanceAction,d175SourceNamespace} from '../src/domain/sermonaudio-completion';
import {validateSermonAudioTransferRows,validateSermonAudioCompletionPacket,sermonAudioCompletionTables,sermonAudioTargetRows,type SermonAudioCompletionPacket} from '../src/staging/sermonaudio-completion-packet';
import {assertSermonAudioTransferPreserved,type SermonAudioTransferState} from '../src/staging/sermonaudio-completion-sync';
const id='11111111-1111-4111-8111-111111111175',members=new Map([[id,881175001]]);
describe('D-175 scoped staging transfer boundaries',()=>{
 it('excludes accounts, sessions, old delegated scopes and unrelated audit exports',()=>{
  expect(sermonAudioCompletionTables).not.toContain('users');expect(sermonAudioCompletionTables).not.toContain('admin_sessions');expect(sermonAudioCompletionTables).not.toContain('delegated_ai_review_scopes');
  expect(()=>validateSermonAudioCompletionPacket({decision:'D-171'})).toThrow('packet_invalid');
 });
 it('rejects records outside the sealed membership and duplicate keys',()=>{
  expect(()=>validateSermonAudioTransferRows('sermon_media',[{id:'sample-media',sermon_id:'22222222-2222-4222-8222-222222222222'}],['id'],members)).toThrow('out_of_scope');
  expect(()=>validateSermonAudioTransferRows('sermon_media',[{id:'sample-media',sermon_id:id},{id:'sample-media',sermon_id:id}],['id'],members)).toThrow('duplicate_key');
 });
 it('requires draft content without fabricated human authority',()=>{
  const row={sermon_id:id,status:'draft',approved_at:null,reviewed_at:null,approved_by_subject:null,reviewed_by_subject:null};
  expect(()=>validateSermonAudioTransferRows('sermon_transcripts',[row],['sermon_id'],members)).not.toThrow();
  expect(()=>validateSermonAudioTransferRows('sermon_transcripts',[{...row,status:'approved'}],['sermon_id'],members)).toThrow('human_content_authority');
  expect(()=>validateSermonAudioTransferRows('sermon_transcripts',[{...row,reviewed_by_subject:'synthetic-admin'}],['sermon_id'],members)).toThrow('human_content_authority');
 });
 it('permits only the actual D-175 system actions, never administrator attribution',()=>{
  const row={id:'synthetic-event',entity_id:id,entity_type:'sermon',actor_role:'system',actor_subject:d175Actor,action:d175AcceptanceAction,outcome:'succeeded'};
  expect(()=>validateSermonAudioTransferRows('audit_events',[row],['id'],members)).not.toThrow();
  expect(()=>validateSermonAudioTransferRows('audit_events',[{...row,actor_role:'admin'}],['id'],members)).toThrow('audit_scope');
  expect(()=>validateSermonAudioTransferRows('audit_events',[{...row,action:'sermon.published'}],['id'],members)).toThrow('audit_scope');
  expect(()=>validateSermonAudioTransferRows('sermon_extensions',[{sermon_id:id,namespace:'unrelated.private-data'}],['sermon_id','namespace'],members)).toThrow('extension_scope');
  expect(()=>validateSermonAudioTransferRows('sermon_extensions',[{sermon_id:id,namespace:d175SourceNamespace}],['sermon_id','namespace'],members)).not.toThrow();
 });
 it('selects only one target and its direct dependencies rather than a whole catalogue',()=>{
  const tables=Object.fromEntries(sermonAudioCompletionTables.map(t=>[t,{keys:['id'],rows:[]}])) as unknown as SermonAudioCompletionPacket['tables'];
  tables.sermons.rows=[{id,speaker_id:'speaker-a',featured_asset_id:null}];tables.speakers.rows=[{id:'speaker-a',image_asset_id:'asset-a'},{id:'speaker-b',image_asset_id:'asset-b'}];tables.media_assets.rows=[{id:'asset-a'},{id:'asset-b'}];tables.series.rows=[{id:'unrelated-series'}];
  const p={ids:[id],tables} as SermonAudioCompletionPacket;const result=sermonAudioTargetRows(p,id);
  expect(result.speakers).toEqual([tables.speakers.rows[0]]);expect(result.media_assets).toEqual([{id:'asset-a'}]);expect(result.series).toEqual([]);
 });
 it('proves every pre-existing row and sequence survives, allowing additions only',()=>{
  const before:SermonAudioTransferState={ids:[id],sequenceHash:'same',sha256:'before',tables:{sermons:{keys:['id'],rows:[{key:'old',hash:'original'}]}}};
  const after={...before,sha256:'after',tables:{sermons:{keys:['id'],rows:[{key:'old',hash:'original'},{key:'new',hash:'added'}]}}};
  expect(()=>assertSermonAudioTransferPreserved(before,after)).not.toThrow();
  expect(()=>assertSermonAudioTransferPreserved(before,{...after,sequenceHash:'changed'})).toThrow('sequence_changed');
  expect(()=>assertSermonAudioTransferPreserved(before,{...after,tables:{sermons:{keys:['id'],rows:[{key:'old',hash:'changed'}]}}})).toThrow('row_changed');
 });
});
