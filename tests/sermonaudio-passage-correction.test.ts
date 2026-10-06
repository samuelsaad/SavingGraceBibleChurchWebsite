import {describe,it,expect} from 'vitest';
import {applySermonAudioPassageCorrection} from '../src/domain/sermonaudio-passage-correction';
describe('D-175 explicit passage correction, originals preserved',()=>{
 const source='Anonymous test introduction. The synthetic focus is verse 4 of Matthew chapter 5. Synthetic conclusion.';
 const correction={originalText:'Matthew 5:3',correctedText:'Matthew 5:4',sourceAnchor:'The synthetic focus is verse 4 of Matthew chapter 5.',assessment:'Synthetic evidence explicitly identifies the coordinate, rather than inferring it from a topic.'};
 it('keeps uncorrected metadata unchanged and binds a supported correction to exact source',()=>{
  expect(applySermonAudioPassageCorrection(['Selected Text'],source,undefined)).toEqual({passageTexts:['Selected Text'],evidence:undefined});
  const result=applySermonAudioPassageCorrection(['Matthew 5:3'],source,correction);
  expect(result.passageTexts).toEqual(['Matthew 5:4']);expect(result.evidence?.originalText).toBe('Matthew 5:3');expect(result.evidence?.sha256).toMatch(/^[a-f0-9]{64}$/u);expect(source.slice(result.evidence!.start,result.evidence!.end)).toBe(correction.sourceAnchor);
 });
 it('refuses different source identity, changed books, ambiguous support and invented coordinates',()=>{
  expect(()=>applySermonAudioPassageCorrection(['Matthew 5:2'],source,correction)).toThrow('identity_refused');
  expect(()=>applySermonAudioPassageCorrection(['Matthew 5:3'],source,{...correction,correctedText:'Mark 5:4'})).toThrow('identity_refused');
  expect(()=>applySermonAudioPassageCorrection(['Matthew 5:3'],source+source,correction)).toThrow('support_refused');
  expect(()=>applySermonAudioPassageCorrection(['Matthew 5:3'],source,{...correction,correctedText:'Matthew 5:6'})).toThrow('explicit_reference_required');
  expect(()=>applySermonAudioPassageCorrection(['Matthew 5:3'],source,{...correction,sourceAnchor:'An unavailable synthetic source anchor.'})).toThrow('support_refused');
 });
 it('fills only absent metadata from a unique explicit reading, without fabricating an original reference',()=>{
  const source='Synthetic reading: please turn to Psalm 127. Synthetic closing.';
  const evidence={originalText:null,correctedText:'Psalm 127',sourceAnchor:'Synthetic reading: please turn to Psalm 127.',assessment:'An explicit synthetic source reading establishes the absent primary passage; no topic inference.'};
  const result=applySermonAudioPassageCorrection([],source,evidence);
  expect(result.passageTexts).toEqual(['Psalm 127']);expect(result.evidence?.originalText).toBeNull();
  expect(()=>applySermonAudioPassageCorrection(['Psalm 126'],source,evidence)).toThrow('identity_refused');
  expect(()=>applySermonAudioPassageCorrection([],source+source,evidence)).toThrow('support_refused');
  expect(()=>applySermonAudioPassageCorrection([],source,{...evidence,correctedText:'Psalm 128'})).toThrow('explicit_reference_required');
  expect(()=>applySermonAudioPassageCorrection([],source,{...evidence,correctedText:'Psalm 127:2'})).toThrow('explicit_reference_required');
 });
 it('replaces only the exact non-specific placeholder, preserving it and requiring explicit source evidence',()=>{
  const source='Anonymous source: turn to Matthew chapter 5. Anonymous conclusion.';
  const evidence={originalText:'Selected Text',correctedText:'Matthew 5',sourceAnchor:'Anonymous source: turn to Matthew chapter 5.',assessment:'The anonymous source expressly announces this chapter. The placeholder contains no prior canonical assignment.'};
  const result=applySermonAudioPassageCorrection(['Selected Text'],source,evidence);
  expect(result.passageTexts).toEqual(['Matthew 5']);expect(result.evidence?.originalText).toBe('Selected Text');
  expect(()=>applySermonAudioPassageCorrection(['Unknown'],source,{...evidence,originalText:'Unknown'})).toThrow('identity_refused');
  expect(()=>applySermonAudioPassageCorrection(['Matthew 4'],source,evidence)).toThrow('identity_refused');
  expect(()=>applySermonAudioPassageCorrection(['Selected Text','Luke 1'],source,evidence)).toThrow('identity_refused');
  expect(()=>applySermonAudioPassageCorrection(['Selected Text'],source,{...evidence,correctedText:'Luke 5'})).toThrow('explicit_reference_required');
  expect(()=>applySermonAudioPassageCorrection(['Selected Text'],source+source,evidence)).toThrow('support_refused');
 });
});
