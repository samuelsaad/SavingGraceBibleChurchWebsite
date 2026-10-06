import {it,expect} from 'vitest';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {applyLocalCorrectiveReview,readCorrectiveDependency} from '../src/application/local-corrective-review-service';
import {correctiveHash as hash,correctiveManifestSha256,correctiveMembershipSha256,correctiveAcceptanceSql,correctiveCompletionNamespace,correctiveAcceptanceNamespace} from '../src/domain/local-corrective-review';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';

export function registerLocalCorrectiveReviewPostgresTests(getPool:()=>Pool){
 it('atomically corrects a version, archives a human-approved original, saves separate local acceptance and replays without churn',async()=>{
  const name=assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE),pool=getPool(),id=randomUUID();
  const text='Synthetic source beginning. Do the synthetic distracting thing. Synthetic source conclusion. '+Array(100).fill('Additional synthetic source context remains available.').join(' ');
  const final=text.replace('Do the synthetic distracting thing.','Do not do the synthetic distracting thing.');
  const bytes=Buffer.from(`WEBVTT\n\n00:00:00.000 --> 00:05:01.000\n${text}\n\n`);
  const sentence='This synthetic description explains a sample subject and its reasoning, with clear application supported by the retained synthetic source evidence.';
  const summary=Array(9).fill(sentence).join(' '); // 216 synthetic words, no real sermon data.
  const speaker=randomUUID();
  try{
   await pool.query("INSERT INTO speakers(id,name,slug) VALUES($1,'Synthetic Speaker',$2)",[speaker,'synthetic-'+speaker]);
   await pool.query("INSERT INTO sermons(id,title,slug,speaker_id,status,service_date,source_wordpress_id,summary,summary_status) VALUES($1,'Synthetic original title',$2,$3,'draft','2026-01-04',987655201,$4,'draft')",[id,'corrective-'+id,null,summary]);
   await pool.query("INSERT INTO sermon_transcripts(sermon_id,body_text,status,source_kind,reviewed_at,reviewed_by_subject,approved_at,approved_by_subject) VALUES($1,$2,'approved','manual',now(),'synthetic-human',now(),'synthetic-human')",[id,text]);
   await pool.query(`INSERT INTO sermon_enrichment_sources(sermon_id,provider,video_id,canonical_url,caption_language,caption_track_type,original_filename,source_content_sha256,retrieval_attribution,source_character_count,cleaned_character_count,apparent_completeness,uncertainty_marker_count,warnings,unresolved_passages,processing_version,imported_at,processed_at,processing_duration_ms,estimated_review_minutes,manual_attention_required,accuracy_review_status)
    VALUES($1,'youtube','abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk','en','automatic','synthetic.vtt',$2,'authorised_youtube_data_api',$3,$3,'requires_manual_review',0,'[]','[]','synthetic-local-review',now(),now(),0,1,true,'required')`,[id,hash(bytes),text.length]);
   const qs=Array.from({length:7},(_,i)=>({question:`Which synthetic example supports sample question number ${i+1}?`,answer:`The synthetic source supports the sample answer number ${i+1}.`,order:i+1}));
   for(const q of qs)await pool.query("INSERT INTO sermon_question_answers(sermon_id,question_text,answer_text,display_order,status,source_kind) VALUES($1,$2,$3,$4,'draft','manual')",[id,q.question,q.answer,q.order]);
   const client=await pool.connect();let dep;try{await client.query('BEGIN READ ONLY');await client.query("SET LOCAL TIME ZONE 'UTC'");dep=await readCorrectiveDependency(client,id);}finally{await client.query('ROLLBACK');client.release();}
   const support={start:0,end:final.length,sha256:hash(final),purpose:'synthetic_answer_support'};
   const packet={decision:'D-173',manifestSha256:correctiveManifestSha256,membershipSha256:correctiveMembershipSha256,sermonId:id,expectedRowVersion:1,expectedDependencySha256:dep,reviewedAt:'2026-10-06T00:00:00.000Z',originalTranscriptSha256:hash(text),originalDescriptionSha256:hash(summary),questionsSha256:hash(JSON.stringify(qs)),sourceSha256:hash(bytes),transcriptSha256:hash(final),descriptionSha256:hash(summary),transcriptCharactersRead:text.length,questionAnswersRead:7,completeTranscriptRead:true,completeAvailableSourceRead:true,completeDescriptionRead:true,everyOrderedQuestionAnswerRead:true,captionReadingBasis:'Synthetic complete-source reading coverage.',audioVerified:false,humanApprovalClaimed:false,authorizedBy:'Samuel',transcriptEdits:[{original:'Do the synthetic distracting thing.',replacement:'Do not do the synthetic distracting thing.',kind:'context_supported_inference',reason:'Synthetic contrary instruction corrected by a bounded contextual inference, never verified as spoken.'}],descriptionEdit:null,identityTitleReplacement:'Synthetic source title',speakerAssignment:null,sourceMetadataSha256:'a'.repeat(64),sourceEvidence:{wordpressId:987655201,serviceDate:'2026-01-04',videoId:'abcdefghijk',originalTitle:'Synthetic source title',canonicalSpeaker:'Synthetic Speaker'},identityAssessment:'Synthetic exact source identity.',speakerAssessment:'Synthetic canonical source speaker.',passageAssessment:'Synthetic preserved passage decisions.',mediaAssessment:'Synthetic preserved media.',descriptionAssessment:'Synthetic full description review.',questionAssessments:Array(7).fill('Synthetic individual answer accepted after complete reading.'),descriptionSupport:[support],questionSupport:Array(7).fill(support),residualUncertainty:'Synthetic inference preserved internally.',reviewArtifactSha256:'b'.repeat(64),reviewer:{provider:'OpenAI',runtime:'current interactive Codex session',model:'not_exposed_by_runtime',immutableRevision:'not_exposed_by_runtime',sessionIdentifier:'not_exposed_by_runtime',separatelyBilledApiUsed:false}};
   const snapshot=async()=>{const c=await pool.connect();try{await c.query('BEGIN READ ONLY');await c.query("SET LOCAL TIME ZONE 'UTC'");return(await c.query(`SELECT to_jsonb(s) sermon,(SELECT to_jsonb(t) FROM sermon_transcripts t WHERE t.sermon_id=s.id) transcript,(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order) FROM sermon_question_answers q WHERE q.sermon_id=s.id) questions,(SELECT to_jsonb(e) FROM sermon_enrichment_sources e WHERE e.sermon_id=s.id) source,(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.namespace) FROM sermon_extensions e WHERE e.sermon_id=s.id) receipts,(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_events a WHERE a.entity_id=s.id) audits FROM sermons s WHERE id=$1`,[id])).rows[0];}finally{await c.query('ROLLBACK');c.release();}};
   packet.speakerAssignment={canonicalName:'Synthetic Speaker',suppliedName:'Synthetic Speaker',suppliedBy:'Samuel',expectedSourceWordPressId:987655201,reason:'Synthetic exact retained taxonomy and explicit assignment.'} as any;
   const before=await snapshot();
   const priorGate=process.env.ALLOW_LOCAL_DB_WRITE;process.env.ALLOW_LOCAL_DB_WRITE='0';
   try{await expect(applyLocalCorrectiveReview(pool,[id],packet,bytes)).rejects.toThrow();}finally{process.env.ALLOW_LOCAL_DB_WRITE=priorGate;}
   await expect(applyLocalCorrectiveReview(pool,[],packet,bytes)).rejects.toThrow('scope_refused');
   await expect(applyLocalCorrectiveReview(pool,[id],{...packet,expectedRowVersion:2},bytes)).rejects.toThrow('concurrent');
   await expect(applyLocalCorrectiveReview(pool,[id],{...packet,sourceEvidence:{...packet.sourceEvidence,wordpressId:987655202}},bytes)).rejects.toThrow('source_identity');
   await expect(applyLocalCorrectiveReview(pool,[id],{...packet,sourceEvidence:{...packet.sourceEvidence,canonicalSpeaker:'Different synthetic speaker'}},bytes)).rejects.toThrow('source_speaker');
   await expect(applyLocalCorrectiveReview(pool,[id],{...packet,speakerAssignment:{canonicalName:'Synthetic Speaker',suppliedName:'Synthetic Speaker',suppliedBy:'Samuel',expectedSourceWordPressId:987655202,reason:'Synthetic conflicting identity.'}},bytes)).rejects.toThrow('speaker_assignment_conflict');
   await expect(applyLocalCorrectiveReview(pool,[id],packet,Buffer.from('wrong bytes'))).rejects.toThrow('integrity');
   await expect(applyLocalCorrectiveReview(pool,[id],{...packet,questionSupport:Array(7).fill({...support,sha256:'c'.repeat(64)})},bytes)).rejects.toThrow('support_invalid');
   expect(await snapshot()).toEqual(before);
   expect(await applyLocalCorrectiveReview(pool,[id],packet,bytes)).toEqual({outcome:'completed',contentCorrected:true,metadataCorrected:true});
   const first=await snapshot();expect(first.sermon.status).toBe('draft');expect(first.sermon.published_at).toBe(null);expect(first.sermon.slug).toBe(before.sermon.slug);expect(first.sermon.speaker_id).toBe(speaker);expect(first.source).toEqual(before.source);
   expect(first.transcript.body_text).toBe(final);expect(first.transcript.status).toBe('draft');expect(first.transcript.approved_at).toBe(null);expect(first.transcript.grounding_revision_id).not.toBe(before.transcript.grounding_revision_id);
   const receipt=first.receipts.find((r:any)=>r.namespace===correctiveCompletionNamespace).payload;
   expect(receipt.lineage.originalTranscript).toEqual(before.transcript);expect(receipt.lineage.originalQuestions).toEqual(before.questions);expect(receipt.lineage.originalSermon).toEqual(before.sermon);
   expect(first.receipts.find((r:any)=>r.namespace===correctiveAcceptanceNamespace)).toBeTruthy();expect(first.audits).toHaveLength(2);
   expect((await applyLocalCorrectiveReview(pool,[id],packet,bytes)).outcome).toBe('unchanged');expect(await snapshot()).toEqual(first);
   const c=await pool.connect();try{await c.query('BEGIN READ ONLY');await c.query("SET LOCAL TIME ZONE 'UTC'");expect((await c.query(`SELECT ${correctiveAcceptanceSql('s',name)} local,${correctiveAcceptanceSql('s')} real_target FROM sermons s WHERE id=$1`,[id])).rows[0]).toEqual({local:true,real_target:false});}finally{await c.query('ROLLBACK');c.release();}
   await pool.query("UPDATE sermon_question_answers SET answer_text='Concurrent synthetic change.' WHERE sermon_id=$1 AND display_order=1",[id]);
   await expect(applyLocalCorrectiveReview(pool,[id],packet,bytes)).rejects.toThrow('conflict');
   await expect(applyLocalCorrectiveReview(pool,[id],{...packet,reviewedAt:'2026-10-06T01:00:00.000Z'},bytes)).rejects.toThrow('round_consumed');
   await pool.query("UPDATE sermons SET status='archived' WHERE id=$1",[id]);
   await expect(applyLocalCorrectiveReview(pool,[id],packet,bytes)).rejects.toThrow('private_draft_required');
  }finally{await pool.query('DELETE FROM audit_events WHERE entity_id=$1',[id]);await pool.query('DELETE FROM sermons WHERE id=$1',[id]);await pool.query('DELETE FROM speakers WHERE id=$1',[speaker]);}
 });
}
