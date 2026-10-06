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
});
