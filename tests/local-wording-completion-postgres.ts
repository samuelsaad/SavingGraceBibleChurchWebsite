import {it,expect} from 'vitest';import type {Pool} from 'pg';import {randomUUID,createHash} from 'node:crypto';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';
import {applyLocalWordingCompletion,readLocalWordingDependency} from '../src/application/local-wording-completion-service';
import {localWordingScopeSha256,localWordingCompletionSql,localWordingNamespace} from '../src/domain/local-wording-completion';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function registerLocalWordingCompletionPostgresTests(getPool:()=>Pool){
 it('audits an isolated local completion once; preserves source/approval state and refuses stale, concurrent, forged and ineligible results',async()=>{
  const name=assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE),pool=getPool(),id=randomUUID();
  try{
   await pool.query("INSERT INTO sermons(id,title,slug,status,service_date,source_wordpress_id,summary,summary_status) VALUES($1,'Synthetic wording fixture',$2,'draft','2026-01-04',987655101,'Synthetic grounded description.','draft')",[id,'local-wording-'+id]);
   await pool.query("INSERT INTO sermon_transcripts(sermon_id,body_text,status,source_kind) VALUES($1,'Synthetic transcript source.','draft','manual')",[id]);
   await pool.query(`INSERT INTO sermon_enrichment_sources(sermon_id,provider,video_id,canonical_url,caption_language,caption_track_type,original_filename,source_content_sha256,retrieval_attribution,source_character_count,cleaned_character_count,apparent_completeness,uncertainty_marker_count,warnings,unresolved_passages,processing_version,imported_at,processed_at,processing_duration_ms,estimated_review_minutes,manual_attention_required,accuracy_review_status)
    VALUES($1,'youtube','abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk','en','automatic','synthetic.vtt',$2,'authorised_youtube_data_api',28,28,'requires_manual_review',1,'[]','[]','synthetic-local-review',now(),now(),0,1,true,'required')`,[id,'a'.repeat(64)]);
   for(let order=1;order<=7;order++)await pool.query("INSERT INTO sermon_question_answers(sermon_id,question_text,answer_text,display_order,status,source_kind) VALUES($1,$2,$3,$4,'draft','manual')",[id,'Synthetic question '+order+'?','Synthetic answer '+order+'.',order]);
   const c=await pool.connect();let dependency;try{await c.query('BEGIN READ ONLY');await c.query("SET LOCAL TIME ZONE 'UTC'");dependency=await readLocalWordingDependency(c,id);await c.query('COMMIT');}finally{await c.query('ROLLBACK');c.release();}
   const qs=Array.from({length:7},(_,i)=>({question:'Synthetic question '+(i+1)+'?',answer:'Synthetic answer '+(i+1)+'.',order:i+1}));
   const review={decision:'D-172',scopeSha256:localWordingScopeSha256,sermonId:id,expectedRowVersion:1,expectedDependencySha256:dependency,reviewedAt:'2026-10-06T00:00:00.000Z',transcriptSha256:hash('Synthetic transcript source.'),descriptionSha256:hash('Synthetic grounded description.'),questionsSha256:hash(JSON.stringify(qs)),sourceSha256:'a'.repeat(64),completeTranscriptRead:true,completeDescriptionRead:true,everyOrderedQuestionAnswerRead:true,sourceAvailable:false,completeAvailableSourceRead:true,audioVerified:false,humanApprovalClaimed:false,transcriptCharactersRead:28,questionAnswersRead:7,descriptionGrounded:true,questionsGrounded:true,sourceWordingResolved:false,uncertaintyAcceptedBy:'Samuel',localCompletionAuthorized:true,internalFindings:[{code:'synthetic_unresolved',outcome:'source_unavailable',note:'Synthetic unavailable original source retained internally.'}],reviewer:{provider:'OpenAI',product:'Codex',mode:'interactive Codex session',model:'not_exposed_by_runtime',immutableRevision:'not_exposed_by_runtime',sessionIdentifier:'not_exposed_by_runtime'},correction:null};
   const snapshot=async()=>{const c=await pool.connect();try{await c.query('BEGIN READ ONLY');await c.query("SET LOCAL TIME ZONE 'UTC'");return (await c.query(`SELECT row_version,updated_at,status,summary_status,(SELECT to_jsonb(t) FROM sermon_transcripts t WHERE t.sermon_id=s.id) transcript,(SELECT count(*)::int FROM audit_events WHERE entity_id=s.id) audits FROM sermons s WHERE id=$1`,[id])).rows[0];}finally{await c.query('ROLLBACK');c.release();}};
   const before=await snapshot();await expect(applyLocalWordingCompletion(pool,[id],{...review,expectedRowVersion:2})).rejects.toThrow('concurrent');
   expect(await applyLocalWordingCompletion(pool,[id],review)).toMatchObject({outcome:'completed',corrected:false});
   const eligible=async()=>{const c=await pool.connect();try{await c.query('BEGIN READ ONLY');await c.query("SET LOCAL TIME ZONE 'UTC'");return (await c.query(`SELECT ${localWordingCompletionSql('s',name)} local,${localWordingCompletionSql('s')} application_target FROM sermons s WHERE id=$1`,[id])).rows[0];}finally{await c.query('ROLLBACK');c.release();}};
   expect(await eligible()).toEqual({local:true,application_target:false});const first=await snapshot();expect(first).toEqual({...before,audits:1});
   expect((await applyLocalWordingCompletion(pool,[id],review)).outcome).toBe('unchanged');expect(await snapshot()).toEqual(first);
   expect((await pool.query('SELECT count(*)::int n FROM sermon_restricted_acceptances WHERE sermon_id=$1',[id])).rows[0].n).toBe(0);
   await pool.query("UPDATE sermon_question_answers SET answer_text='Changed synthetic answer.' WHERE sermon_id=$1 AND display_order=1",[id]);expect((await eligible()).local).toBe(false);await expect(applyLocalWordingCompletion(pool,[id],review)).rejects.toThrow('conflict');
   await pool.query("UPDATE sermon_question_answers SET answer_text='Synthetic answer 1.' WHERE sermon_id=$1 AND display_order=1",[id]);
   await pool.query("UPDATE sermon_extensions SET payload=jsonb_set(payload,'{humanApprovalClaimed}','true') WHERE sermon_id=$1 AND namespace=$2",[id,localWordingNamespace]);expect((await eligible()).local).toBe(false);
   // Disposable fixture only: exercise a fresh supported answer correction and
   // a caption-exact marker restoration without changing human approval fields.
   await pool.query('DELETE FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2',[id,localWordingNamespace]);await pool.query('DELETE FROM audit_events WHERE entity_id=$1',[id]);
   const qc=(await pool.query('SELECT * FROM sermon_question_answers WHERE sermon_id=$1 ORDER BY display_order',[id])).rows;
   const final=qs.map(q=>({...q}));final[0]!.answer='Supported synthetic answer.';
   const qReview={...review,originalQuestionsSha256:review.questionsSha256,questionsSha256:hash(JSON.stringify(final)),questionCorrections:[{id:qc[0].id,originalSha256:hash(JSON.stringify(qs[0])),question:qs[0]!.question,answer:final[0]!.answer,support:[{start:0,end:28,sha256:review.transcriptSha256}]}]};
   const fresh=await pool.connect();try{await fresh.query('BEGIN READ ONLY');await fresh.query("SET LOCAL TIME ZONE 'UTC'");qReview.expectedDependencySha256=await readLocalWordingDependency(fresh,id);}finally{await fresh.query('ROLLBACK');fresh.release();}
   await expect(applyLocalWordingCompletion(pool,[id],{...qReview,questionCorrections:[{...qReview.questionCorrections[0],support:[{start:0,end:28,sha256:'b'.repeat(64)}]}]})).rejects.toThrow('support_invalid');
   expect((await applyLocalWordingCompletion(pool,[id],qReview)).corrected).toBe(true);expect((await eligible()).local).toBe(true);
   const afterCorrection=await snapshot();expect((await applyLocalWordingCompletion(pool,[id],qReview)).outcome).toBe('unchanged');expect(await snapshot()).toEqual(afterCorrection);
   const kept=(await pool.query('SELECT * FROM sermon_question_answers WHERE sermon_id=$1 ORDER BY display_order',[id])).rows;expect(kept.slice(1)).toEqual(qc.slice(1));expect(kept[0].status).toBe('draft');expect(kept[0].approved_at).toBe(null);
   await pool.query('DELETE FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2',[id,localWordingNamespace]);await pool.query('DELETE FROM audit_events WHERE entity_id=$1',[id]);
   const caption=Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nSynthetic [ __ ] source.\n\n'),original='Synthetic source.',restored='Synthetic [ __ ] source.';
   await pool.query('UPDATE sermon_transcripts SET body_text=$2 WHERE sermon_id=$1',[id,original]);await pool.query('UPDATE sermon_enrichment_sources SET source_content_sha256=$2 WHERE sermon_id=$1',[id,hash(caption.toString())]);
   const sourceBefore=(await pool.query('SELECT * FROM sermon_enrichment_sources WHERE sermon_id=$1',[id])).rows[0];
   const trReview={...review,expectedRowVersion:2,sourceAvailable:true,sourceSha256:hash(caption.toString()),transcriptSha256:hash(restored),transcriptCharactersRead:original.length,questionsSha256:hash(JSON.stringify(final)),correction:{kind:'restore_retained_source_text',originalTranscriptSha256:hash(original),correctedTranscript:restored,captionSha256:hash(caption.toString())}};
   const check=await pool.connect();try{await check.query('BEGIN READ ONLY');await check.query("SET LOCAL TIME ZONE 'UTC'");trReview.expectedDependencySha256=await readLocalWordingDependency(check,id);}finally{await check.query('ROLLBACK');check.release();}
   await expect(applyLocalWordingCompletion(pool,[id],trReview)).rejects.toThrow('retained_source_integrity_required');
   await expect(applyLocalWordingCompletion(pool,[id],trReview,Buffer.from('wrong source'))).rejects.toThrow('retained_source_integrity_required');
   expect((await applyLocalWordingCompletion(pool,[id],trReview,caption)).corrected).toBe(true);expect((await eligible()).local).toBe(true);
   const afterRestore=await snapshot();expect((await applyLocalWordingCompletion(pool,[id],trReview,caption)).outcome).toBe('unchanged');expect(await snapshot()).toEqual(afterRestore);
   expect((await pool.query('SELECT * FROM sermon_enrichment_sources WHERE sermon_id=$1',[id])).rows[0]).toEqual(sourceBefore);
   expect((await pool.query('SELECT payload FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2',[id,localWordingNamespace])).rows[0].payload.correctionLineage.originalBody).toBe(original);
  }finally{await pool.query('DELETE FROM audit_events WHERE entity_id=$1',[id]);await pool.query('DELETE FROM sermons WHERE id=$1',[id]);}
 });
}
