/** Read-only D-175 exact stored-content rendering verification. No prose output. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {plainTextParagraphs} from '../src/frontend/html.ts';
const origin=process.env.D175_LOCAL_ORIGIN||'http://127.0.0.1:4411';
assert.match(origin,/^http:\/\/127\.0\.0\.1:44\d\d$/u);
const checkpoint=JSON.parse(await readFile('private/sermonaudio-119-completion/checkpoint.private.json','utf8'));
assert.equal(checkpoint.manifestSha256,'a4fa3627682043c4b06aa65ddbebdab75f1fc29aec93e2d250bda537d9b0cd2b');
let checked=0,step='session';
try{
 const session=await fetch(origin+'/api/v1/admin/frontend-preview-session',{method:'POST',headers:{'x-local-identity':'admin',origin}});
 assert.equal(session.status,200);
 const cookie=session.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 assert(cookie);
 for(const [sequence,record] of Object.entries(checkpoint.records)){
  assert.equal(record.stage,'imported_and_ai_accepted');step='detail_'+sequence;
  const detailResponse=await fetch(origin+`/api/v1/admin/sermons/${record.sermonId}`,{headers:{'x-local-identity':'admin'}});
  assert.equal(detailResponse.status,200);const detail=await detailResponse.json();
  const response=await fetch(origin+`/frontend-preview/sermons/${detail.slug}/`,{headers:{cookie}});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/u);assert.match(response.headers.get('x-robots-tag'),/noindex/u);
  const html=await response.text();assert(html.includes(String(plainTextParagraphs(detail.transcript.bodyText))));assert(html.includes(String(plainTextParagraphs(detail.summary))));
  let previous=-1;for(const pair of [...detail.questionAnswers].sort((a,b)=>a.displayOrder-b.displayOrder)){
   const answer=String(plainTextParagraphs(pair.answer)),at=html.indexOf(answer,previous+1);assert(at>previous);previous=at;
  }
  assert.equal(detail.status,'draft');assert.equal(detail.publishedAt,null);assert.equal(detail.summaryStatus,'draft');assert.equal(detail.transcript.status,'draft');assert(detail.questionAnswers.every(pair=>pair.status==='draft'));
  const denied=await fetch(origin+`/frontend-preview/sermons/${detail.slug}/`);assert([401,403].includes(denied.status));
  checked++;
 }
 console.log(JSON.stringify({result:'passed',records:checked,completeTranscriptAndDescription:true,orderedAnswers:true,noStoreNoindex:true,unauthenticatedDenied:true,humanPublicationUnchanged:true,reviewWrites:0,proseOutput:false}));
}catch(error){console.log(JSON.stringify({result:'failed',step,errorType:error?.name??'unknown',recordsChecked:checked}));process.exitCode=1;}
