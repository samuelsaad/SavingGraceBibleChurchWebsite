import {it,expect} from 'vitest';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {applySermonAudioCompletion} from '../src/application/sermonaudio-completion-service';
import {hash,completionManifestSha256,runtimeProvenance} from '../src/sermonaudio/completion';
import {d175AcceptanceSql,d175AcceptanceNamespace} from '../src/domain/sermonaudio-completion';
import {deterministicSourceUuid} from '../src/migration/identity';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';
import {primaryKeys,quoted,completedClause} from '../src/staging/completed-packet';
import {sermonAudioCompletionTables,type SermonAudioCompletionPacket} from '../src/staging/sermonaudio-completion-packet';
import {appendSermonAudioTarget,captureSermonAudioTransferState,assertSermonAudioTransferPreserved} from '../src/staging/sermonaudio-completion-sync';
import {buildPublishedSermonFilterOptionsQuery,frontendSermonEligibilitySql} from '../src/server/queries/public-sermons';
import {completedSchemaMigrations} from '../src/staging/completed-schema';

export function registerSermonAudioCompletionPostgresTests(getPool:()=>Pool){
 it('atomically imports anonymous SermonAudio content, records honest acceptance, preserves publication and replays without churn',async()=>{
  assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);
  const pool=getPool(),sourceId=887751001,id=deterministicSourceUuid('wordpress-sermon',sourceId),missingId=deterministicSourceUuid('wordpress-sermon',sourceId+1),placeholderId=deterministicSourceUuid('wordpress-sermon',sourceId+2),rangeId=deterministicSourceUuid('wordpress-sermon',sourceId+3),speakerId=randomUUID();
  const transcript='Unique synthetic supporting evidence for anonymous examples. The synthetic focus is verse 4 of Matthew chapter 5. Matthew, chapter 5. Our synthetic reading is verse 1 to verse 9. '+Array(120).fill('Additional synthetic context has no actual sermon wording.').join(' ');
  const sentence='This anonymous description explains a synthetic subject with supporting context and practical reasoning while preserving the limited scope of the fictional sample.';
  const description=Array(9).fill(sentence).join(' ');
  const answer='The anonymous source provides synthetic supporting evidence for this fictional example. Its context explains the sample subject and the stated practical reasoning without using actual sermon wording, personal identities, private information, or external material in the test fixture.';
  const candidate={sequence:1,description,descriptionSupport:['Unique synthetic supporting evidence for anonymous examples.'],questionAnswers:Array.from({length:7},(_,i)=>({question:`What does anonymous synthetic source example number ${i+1} illustrate here?`,answer,support:['Unique synthetic supporting evidence for anonymous examples.']})),internalUncertainty:[]};
  const pairs=candidate.questionAnswers.map((q,i)=>({displayOrder:i+1,question:q.question,answer:q.answer}));
  const artifactBody={description,questionAnswers:pairs,preparation:{transcriptSha256:hash(transcript)},sourceSha256:'a'.repeat(64)};
  const candidateHash=hash(JSON.stringify(artifactBody));
  const reviewBody={decision:'D-175',manifestSha256:completionManifestSha256,sequence:1,candidateHash,outcome:'accepted',completeSourceRead:true,completeTranscriptRead:true,completeDescriptionRead:true,everyOrderedQuestionAnswerRead:true,transcriptCharactersRead:transcript.length,transcriptAssessment:'Synthetic complete-source review fixture.',descriptionAssessment:'Synthetic supported description fixture.',questionAssessments:Array(7).fill('Synthetic supported individual Q&A fixture.'),identityAssessment:'Synthetic source identity.',speakerAssessment:'Synthetic canonical identity.',passageAssessment:'Synthetic no explicit primary field.',mediaAssessment:'Synthetic structured media identity.',residualUncertainty:[],audioVerified:false,humanApprovalClaimed:false,uncertaintyAcceptedBy:'Samuel',sourceSha256:'a'.repeat(64),transcriptSha256:hash(transcript),descriptionSha256:hash(description),questionAnswersSha256:hash(JSON.stringify(pairs)),reviewer:runtimeProvenance};
  const primaryPassageCorrection={originalText:'Matthew 5:3',correctedText:'Matthew 5:4',sourceAnchor:'The synthetic focus is verse 4 of Matthew chapter 5.',assessment:'Synthetic complete-source review demonstrates an explicit coordinate mismatch while retaining the original metadata.'};
  Object.assign(reviewBody,{primaryPassageCorrection});
  const reviewHash=hash(JSON.stringify(reviewBody));
  const packet={decision:'D-175',manifestSha256:completionManifestSha256,sequence:1,sourceWordPressId:sourceId,title:'Anonymous SermonAudio example',slug:'anonymous-d175-example',serviceDate:'2026-01-04',sourceStatus:'publish',canonicalSpeaker:'Anonymous D175 Speaker',series:[],passageTexts:[],sermonAudioId:'1234567890123',broadcaster:'savinggrace',language:'en',sourceSha256:'a'.repeat(64),metadataSha256:'b'.repeat(64),sourceCaptureSha256:'c'.repeat(64),transcript,transcriptSha256:hash(transcript),candidate,candidateArtifact:{...artifactBody,candidateHash,version:0},candidateHash,review:{...reviewBody,reviewHash},reviewHash,expectedRowVersion:null,sourceRetrievedAt:'2026-10-06T00:00:00.000Z',sourceVersion:{autoGenerated:true},governanceCommit:'d'.repeat(40)};
  Object.assign(packet,{passageTexts:['Matthew 5:3']});
  const snapshot=async()=>(await pool.query(`SELECT to_jsonb(s) sermon,(SELECT to_jsonb(t) FROM sermon_transcripts t WHERE t.sermon_id=s.id) transcript,(SELECT jsonb_agg(to_jsonb(q) ORDER BY display_order) FROM sermon_question_answers q WHERE q.sermon_id=s.id) questions,(SELECT jsonb_agg(to_jsonb(e) ORDER BY namespace) FROM sermon_extensions e WHERE e.sermon_id=s.id) extensions,(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM audit_events a WHERE a.entity_id=s.id) audits FROM sermons s WHERE id=$1`,[id])).rows[0];
  const readFilters=async()=>{
   // The suite intentionally keeps its base at 0022 for migration lifecycle
   // tests. Exercise the actual deployed 0025 selector in a rollback-only
   // transaction on this explicitly guarded disposable fixture database.
   const client=await pool.connect();try{
    await client.query('BEGIN');await client.query("SET LOCAL TIME ZONE 'UTC'");
    for(const migration of (await completedSchemaMigrations()).slice(22))await client.query(migration.upBody);
    const query=buildPublishedSermonFilterOptionsQuery('d175_local_completed');
    const options=(await client.query(query.text,query.values)).rows[0];
    const eligible=(await client.query('WITH matching_sermons AS MATERIALIZED (SELECT s.* FROM sermons s WHERE '+frontendSermonEligibilitySql('s','d175_local_completed')+') SELECT id FROM matching_sermons')).rows.map(r=>r.id);
    return {options,eligible};
   }finally{await client.query('ROLLBACK');client.release();}
  };
  try{
   await pool.query("INSERT INTO speakers(id,name,slug)VALUES($1,'Anonymous D175 Speaker','anonymous-d175-speaker')",[speakerId]);
   await expect(applySermonAudioCompletion(pool,[],packet)).rejects.toThrow('out_of_scope');
   await expect(applySermonAudioCompletion(pool,[sourceId],{...packet,reviewHash:'e'.repeat(64)})).rejects.toThrow('review_hash');
   await expect(applySermonAudioCompletion(pool,[sourceId],{...packet,transcriptSha256:'e'.repeat(64)})).rejects.toThrow('transcript_hash');
   const priorGate=process.env.ALLOW_LOCAL_DB_WRITE;process.env.ALLOW_LOCAL_DB_WRITE='0';try{await expect(applySermonAudioCompletion(pool,[sourceId],packet)).rejects.toThrow('ALLOW_LOCAL_DB_WRITE');}finally{process.env.ALLOW_LOCAL_DB_WRITE=priorGate;}
   await expect(applySermonAudioCompletion(pool,[sourceId],{...packet,series:[{name:'Rollback-only synthetic series',slug:'rollback-only-series'}],canonicalSpeaker:'Missing synthetic speaker'})).rejects.toThrow('speaker_unavailable');
   expect((await pool.query('SELECT count(*)::int n FROM sermons WHERE id=$1',[id])).rows[0].n).toBe(0);
   expect((await applySermonAudioCompletion(pool,[sourceId],packet)).outcome).toBe('imported_and_ai_accepted');
   const first=await snapshot();expect(first.sermon.status).toBe('draft');expect(first.sermon.published_at).toBeNull();expect(first.sermon.summary_status).toBe('draft');expect(first.transcript.status).toBe('draft');expect(first.questions).toHaveLength(7);expect(first.questions.every((q:any)=>q.status==='draft')).toBe(true);
   expect(first.extensions.find((e:any)=>e.namespace===d175AcceptanceNamespace).payload.humanApprovalClaimed).toBe(false);expect(first.audits).toHaveLength(4);expect(first.audits.every((a:any)=>a.actor_role==='system')).toBe(true);
   const corrected=(await pool.query('SELECT display_text,original_reference_text,parser_version,review_status FROM scripture_references WHERE sermon_id=$1',[id])).rows;expect(corrected).toEqual([{display_text:'Matthew 5:4',original_reference_text:'Matthew 5:3',parser_version:'d175-explicit-source-coordinate-correction-v1',review_status:'unreviewed'}]);
   const sourceEvidence=first.extensions.find((e:any)=>e.namespace==='website.d175-sermonaudio-source').payload;expect(sourceEvidence.originalPassageTexts).toEqual(['Matthew 5:3']);expect(sourceEvidence.deliveredPassageTexts).toEqual(['Matthew 5:4']);expect(sourceEvidence.passageCorrection.sourceAnchor).toBe(primaryPassageCorrection.sourceAnchor);
   expect((await applySermonAudioCompletion(pool,[sourceId],packet)).outcome).toBe('unchanged');expect(await snapshot()).toEqual(first);
   expect((await pool.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[id])).rows[0].accepted).toBe(true);
   const filters=await readFilters();
   expect(filters.options.speakers.some((s:any)=>s.slug==='anonymous-d175-speaker')).toBe(true);
   expect(filters.options.books.some((b:any)=>b.slug==='matthew')).toBe(true);
   expect(filters.eligible).toContain(id);
   const timezoneClient=await pool.connect();try{await timezoneClient.query('BEGIN READ ONLY');await timezoneClient.query("SET LOCAL TIME ZONE 'Australia/Melbourne'");expect((await timezoneClient.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[id])).rows[0].accepted).toBe(true);}finally{await timezoneClient.query('ROLLBACK');timezoneClient.release();}
   // Exercise the real append helper using only the guarded anonymous fixture.
   // This intentionally is not a sealed production manifest/transfer packet.
   const transferClient=await pool.connect();
   try{
    await transferClient.query('BEGIN');await transferClient.query("SET LOCAL TIME ZONE 'UTC'");
    const transfer={ids:[id],tables:{}} as SermonAudioCompletionPacket;
    for(const t of sermonAudioCompletionTables){const keys=await primaryKeys(transferClient,t);const clause=t==='audit_events'?"entity_type='sermon' AND entity_id=ANY($1::uuid[]) AND actor_role='system'":completedClause(t);transfer.tables[t]={keys,rows:(await transferClient.query('SELECT to_jsonb(t) row FROM '+quoted(t)+' t WHERE '+clause,[ [id] ])).rows.map(r=>r.row)};}
    const unchangedState=await captureSermonAudioTransferState(transferClient);
    expect((await appendSermonAudioTarget(transferClient,transfer,id,true)).outcome).toBe('unchanged');
    expect((await captureSermonAudioTransferState(transferClient)).sha256).toBe(unchangedState.sha256);
    const conflicting=structuredClone(transfer);conflicting.tables.sermon_media.rows[0]!.canonical_url='https://www.sermonaudio.com/sermons/9999999999999';
    expect((await appendSermonAudioTarget(transferClient,conflicting,id,true)).outcome).toBe('conflict');
    expect((await captureSermonAudioTransferState(transferClient)).sha256).toBe(unchangedState.sha256);
    // Remove only this disposable fixture inside a transaction, then prove an
    // empty target receives the exact rows and genuine source review receipts.
    await transferClient.query('DELETE FROM audit_events WHERE entity_id=$1',[id]);await transferClient.query('DELETE FROM sermons WHERE id=$1',[id]);
    const emptyState=await captureSermonAudioTransferState(transferClient);
    expect((await appendSermonAudioTarget(transferClient,transfer,id,true)).outcome).toBe('imported');
    const copiedState=await captureSermonAudioTransferState(transferClient);assertSermonAudioTransferPreserved(emptyState,copiedState);
    expect(copiedState.sha256).toBe(unchangedState.sha256);
    expect((await appendSermonAudioTarget(transferClient,transfer,id,true)).outcome).toBe('unchanged');expect((await captureSermonAudioTransferState(transferClient)).sha256).toBe(copiedState.sha256);
   }finally{await transferClient.query('ROLLBACK');transferClient.release();}
   const absentReviewBody={...reviewBody,sequence:2,primaryPassageCorrection:{...primaryPassageCorrection,originalText:null}};
   const absentReviewHash=hash(JSON.stringify(absentReviewBody));
   const absentPacket={...packet,sequence:2,sourceWordPressId:sourceId+1,slug:'anonymous-d175-absent-passage',passageTexts:[],candidate:{...candidate,sequence:2},review:{...absentReviewBody,reviewHash:absentReviewHash},reviewHash:absentReviewHash};
   expect((await applySermonAudioCompletion(pool,[sourceId+1],absentPacket)).outcome).toBe('imported_and_ai_accepted');
   expect((await pool.query('SELECT display_text,original_reference_text,parser_version,review_status FROM scripture_references WHERE sermon_id=$1',[missingId])).rows).toEqual([{display_text:'Matthew 5:4',original_reference_text:null,parser_version:'d175-explicit-source-passage-assignment-v1',review_status:'unreviewed'}]);
   expect((await applySermonAudioCompletion(pool,[sourceId+1],absentPacket)).outcome).toBe('unchanged');
   expect((await pool.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[missingId])).rows[0].accepted).toBe(true);
   const placeholderReviewBody={...reviewBody,sequence:3,primaryPassageCorrection:{...primaryPassageCorrection,originalText:'Selected Text'}};
   const placeholderReviewHash=hash(JSON.stringify(placeholderReviewBody));
   const placeholderPacket={...packet,sequence:3,sourceWordPressId:sourceId+2,slug:'anonymous-d175-placeholder-passage',passageTexts:['Selected Text'],candidate:{...candidate,sequence:3},review:{...placeholderReviewBody,reviewHash:placeholderReviewHash},reviewHash:placeholderReviewHash};
   expect((await applySermonAudioCompletion(pool,[sourceId+2],placeholderPacket)).outcome).toBe('imported_and_ai_accepted');
   expect((await pool.query('SELECT display_text,original_reference_text,parser_version,review_status FROM scripture_references WHERE sermon_id=$1',[placeholderId])).rows).toEqual([{display_text:'Matthew 5:4',original_reference_text:'Selected Text',parser_version:'d175-explicit-source-passage-assignment-v1',review_status:'unreviewed'}]);
   const placeholderBefore=(await captureSermonAudioTransferState(pool as any)).sha256;
   expect((await applySermonAudioCompletion(pool,[sourceId+2],placeholderPacket)).outcome).toBe('unchanged');
   expect((await captureSermonAudioTransferState(pool as any)).sha256).toBe(placeholderBefore);
   expect((await pool.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[placeholderId])).rows[0].accepted).toBe(true);
   const rangeReviewBody={...reviewBody,sequence:4,primaryPassageCorrection:{originalText:'Matthew 4:1-9',correctedText:'Matthew 5:1-9',sourceAnchor:'Matthew, chapter 5. Our synthetic reading is verse 1 to verse 9.',assessment:'The anonymous complete-source reading explicitly corrects a chapter while preserving both original verse endpoints.'}};
   const rangeReviewHash=hash(JSON.stringify(rangeReviewBody));
   const rangePacket={...packet,sequence:4,sourceWordPressId:sourceId+3,slug:'anonymous-d175-range-chapter',passageTexts:['Matthew 4:1-9'],candidate:{...candidate,sequence:4},review:{...rangeReviewBody,reviewHash:rangeReviewHash},reviewHash:rangeReviewHash};
   expect((await applySermonAudioCompletion(pool,[sourceId+3],rangePacket)).outcome).toBe('imported_and_ai_accepted');
   expect((await pool.query('SELECT display_text,original_reference_text,parser_version,review_status FROM scripture_references WHERE sermon_id=$1',[rangeId])).rows).toEqual([{display_text:'Matthew 5:1-9',original_reference_text:'Matthew 4:1-9',parser_version:'d175-explicit-source-coordinate-correction-v1',review_status:'unreviewed'}]);
   const rangeBefore=(await captureSermonAudioTransferState(pool as any)).sha256;
   expect((await applySermonAudioCompletion(pool,[sourceId+3],rangePacket)).outcome).toBe('unchanged');
   expect((await captureSermonAudioTransferState(pool as any)).sha256).toBe(rangeBefore);
   expect((await pool.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[rangeId])).rows[0].accepted).toBe(true);
   await pool.query("UPDATE sermon_question_answers SET answer_text='Concurrent synthetic edit.' WHERE sermon_id=$1 AND display_order=1",[id]);
   expect((await pool.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[id])).rows[0].accepted).toBe(false);
   const staleFilters=await readFilters();
   // Other independently accepted anonymous records may still use this speaker;
   // only the changed record must disappear from the materialized eligibility.
   expect(staleFilters.eligible).not.toContain(id);
   expect(Array.isArray(staleFilters.options.speakers)).toBe(true);
   await expect(applySermonAudioCompletion(pool,[sourceId],packet)).rejects.toThrow('receipt_conflict');
   await pool.query("UPDATE sermons SET status='archived' WHERE id=$1",[id]);await expect(applySermonAudioCompletion(pool,[sourceId],packet)).rejects.toThrow('private_status');
  }finally{await pool.query('DELETE FROM audit_events WHERE entity_id=ANY($1::uuid[])',[[id,missingId,placeholderId,rangeId]]);await pool.query('DELETE FROM sermons WHERE id=ANY($1::uuid[])',[[id,missingId,placeholderId,rangeId]]);await pool.query('DELETE FROM speakers WHERE id=$1',[speakerId]);}
 });
}
