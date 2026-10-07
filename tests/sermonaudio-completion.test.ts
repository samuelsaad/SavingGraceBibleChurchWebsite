import {describe,it,expect} from 'vitest';
import {prepareSource,lexicalWords,resolveSupport,hash,validateCandidate,completionManifestSha256,retainedRecordingDuration} from '../src/sermonaudio/completion';
describe('bounded SermonAudio completion',()=>{
 it('preserves complete English lexical wording and explicit uncertainty',()=>{const input='Synthetic source.\r\n\r\nKeep [unclear] words.\r\nNo invented speech.';const result=prepareSource(input);expect(lexicalWords(result)).toEqual(lexicalWords(input));expect(result).toContain('[unclear]');});
 it('preserves Arabic Unicode without translating',()=>{const input='نص تجريبي.\r\nكلمات عربية محفوظة؟';const result=prepareSource(input);expect(lexicalWords(result)).toEqual(lexicalWords(input));expect(result).toContain('عربية');});
 it('binds exact unique support ranges',()=>{expect(resolveSupport('Alpha synthetic evidence. Beta.', ['synthetic evidence.'])).toEqual([{start:6,end:25,sha256:hash('synthetic evidence.')}]);expect(()=>resolveSupport('same same',['same'])).toThrow('ambiguous');expect(()=>resolveSupport('one',['missing'])).toThrow('not_found');});
 it('rejects missing grounding and arbitrary markup',()=>{expect(()=>validateCandidate('Synthetic source',{sequence:1,description:'<iframe>bad</iframe>',descriptionSupport:[],questionAnswers:[],internalUncertainty:[]},'en')).toThrow();});
 it('uses the fixed 119 manifest, not historical YouTube batches',()=>expect(completionManifestSha256).toBe('a4fa3627682043c4b06aa65ddbebdab75f1fc29aec93e2d250bda537d9b0cd2b'));
 it('captures hash-verified cached recording seconds with honest retained timestamp semantics',()=>{
  const bytes=Buffer.from(JSON.stringify({sermonID:'1234567890123',broadcaster:{broadcasterID:'savinggrace'},hasAudio:true,audioDurationSeconds:4328,media:{audio:[{duration:4328}]}}));
  const target={recording:{sermonID:'1234567890123'} as any,metadataSha256:hash(bytes)};
  expect(retainedRecordingDuration(bytes,target,'2026-01-01T00:00:00.000Z')).toMatchObject({durationSeconds:4328,originalUnits:'seconds',sourceKind:'cached_official_api',metadataSha256:hash(bytes),retrievalTimeBasis:'retained_transcript_receipt_upper_bound'});
  expect(()=>retainedRecordingDuration(bytes,{...target,metadataSha256:'b'.repeat(64)},'2026-01-01T00:00:00.000Z')).toThrow('metadata_hash');
  expect(()=>retainedRecordingDuration(bytes,target,'unknown')).toThrow('receipt_time');
 });
});
