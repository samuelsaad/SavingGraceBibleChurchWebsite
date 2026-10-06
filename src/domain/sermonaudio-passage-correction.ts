import {createHash} from 'node:crypto';
import {z} from 'zod';
import {resolveExplicitPassage} from './primary-book-resolution';
const spokenChapters=['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
function containsExactReference(text:string,reference:string){
 for(let offset=text.indexOf(reference);offset>=0;offset=text.indexOf(reference,offset+1)){
  if(!/[\p{L}\p{N}]/u.test(text[offset-1]??'')&&!/[\p{L}\p{N}]/u.test(text[offset+reference.length]??''))return true;
 }
 return false;
}
export const sermonAudioPassageCorrectionSchema=z.object({
 originalText:z.string().min(1).max(500).nullable(),correctedText:z.string().min(1).max(100),
 sourceAnchor:z.string().min(20).max(600),assessment:z.string().min(30).max(2000)
}).strict();
/** D-175-only, before import. A current substantive review may repair a single
 * retained primary coordinate using an explicit statement of sermon focus.
 * A null original or exact Selected Text placeholder permits filling only absent metadata from an explicit
 * source reading. Never infer topics, change an existing book, or edit source metadata. */
export function applySermonAudioPassageCorrection(original:string[],transcript:string,raw:unknown){
 if(raw===undefined)return{passageTexts:[...original],evidence:undefined};
 const correction=sermonAudioPassageCorrectionSchema.parse(raw),before=correction.originalText===null?null:resolveExplicitPassage(correction.originalText),after=resolveExplicitPassage(correction.correctedText);
 const placeholder=correction.originalText==='Selected Text';
 if(!after||(correction.originalText===null?original.length!==0:original.length!==1||original[0]!==correction.originalText||(!placeholder&&(!before||before.passage.canonicalBookId!==after.passage.canonicalBookId))))throw Error('d175_passage_correction_identity_refused');
 const start=transcript.indexOf(correction.sourceAnchor);
 if(start<0||transcript.indexOf(correction.sourceAnchor,start+1)>=0)throw Error('d175_passage_correction_support_refused');
 const match=/^(.+) ([1-9][0-9]*)(?::([1-9][0-9]*)(?:-([1-9][0-9]*))?)?$/u.exec(correction.correctedText);
 if(!match)throw Error('d175_passage_correction_coordinate_refused');
 const [,book,chapter,verse,endVerse]=match;
 if(correction.originalText!==null&&!placeholder&&!verse)throw Error('d175_passage_correction_coordinate_refused');
 // Repair only a chapter typo within an existing same-book verse range. The
 // complete reading announcement must expressly supply both exact endpoints;
 // do not expand/shorten a range or infer verses from a chapter-only statement.
 if(endVerse){
  if(!before||placeholder||before.passage.startVerse!==Number(verse)||before.passage.endVerse!==Number(endVerse)||before.passage.startChapter!==before.passage.endChapter)throw Error('d175_passage_correction_coordinate_refused');
  const escaped=book!.toLowerCase().replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
  const announced=new RegExp(`(?<![\\p{L}\\p{N}])${escaped},?\\s+chapter ${chapter}(?![\\p{L}\\p{N}])[^0-9]{0,100}?verse ${verse}(?![\\p{L}\\p{N}])\\s+to\\s+verse ${endVerse}(?![\\p{L}\\p{N}])`,'u');
  if(!containsExactReference(correction.sourceAnchor.toLowerCase(),correction.correctedText.toLowerCase())&&!announced.test(correction.sourceAnchor.toLowerCase()))throw Error('d175_passage_correction_explicit_reference_required');
  return{passageTexts:[correction.correctedText],evidence:{...correction,start,end:start+correction.sourceAnchor.length,sha256:createHash('sha256').update(correction.sourceAnchor).digest('hex')}};
 }
 const anchor=correction.sourceAnchor.toLowerCase(),linear=`${book!.toLowerCase()} chapter ${chapter}${verse?` verse ${verse}`:''}`,reverse=verse?`verse ${verse} of ${book!.toLowerCase()} chapter ${chapter}`:linear;
 // A spoken chapter name is evidence only for that exact chapter, never a verse.
 const spoken=!verse&&spokenChapters[Number(chapter)]&&containsExactReference(anchor,`${book!.toLowerCase()} chapter ${spokenChapters[Number(chapter)]}`);
 if(!containsExactReference(anchor,correction.correctedText.toLowerCase())&&!containsExactReference(anchor,linear)&&!containsExactReference(anchor,reverse)&&!spoken)throw Error('d175_passage_correction_explicit_reference_required');
 return{passageTexts:[correction.correctedText],evidence:{...correction,start,end:start+correction.sourceAnchor.length,sha256:createHash('sha256').update(correction.sourceAnchor).digest('hex')}};
}
