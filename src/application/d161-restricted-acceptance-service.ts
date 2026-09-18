import type{Pool,PoolClient}from"pg";
import {verifyAcceptanceTarget,type AcceptanceEnvironment}from"./restricted-acceptance-service";
import {verifyReleaseSchema}from"../staging/database-verification";
import {canonicalReviewJson}from"../domain/delegated-ai-review";
import {d161ReviewerSubject,d161RuntimeModel,d161SourceManifest,d161Hash}from"../domain/d161-review";
import {d161AcceptanceManifestHash,parseD161RestrictedManifest}from"../domain/d161-restricted-acceptance";
import {remainingComponents}from"../domain/remaining-ai-review";
import {readD161Snapshot}from"./d161-review-service";

const fail=(code="d161_acceptance_evidence_or_concurrency_conflict"):never=>{throw new Error(code);};
async function transaction<T>(pool:Pool,environment:AcceptanceEnvironment,work:(c:PoolClient)=>Promise<T>){const c=await pool.connect();let discard=false;
  try{await verifyAcceptanceTarget(c,environment);await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");await c.query("SET LOCAL savinggrace.application_request='on'");await c.query("SET LOCAL statement_timeout='120s'");
    await c.query("SELECT pg_advisory_xact_lock(1397176899,1397111886)");await verifyReleaseSchema(c,20);const result=await work(c);await c.query("COMMIT");return result;
  }catch(error){try{await c.query("ROLLBACK");}catch{discard=true;}const code=error instanceof Error&&/^d161_acceptance_[a-z_]+$/u.test(error.message)?error.message:undefined;return fail(code);}
  finally{c.release(discard);}}

async function verifyMember(c:PoolClient,member:{sermonId:string;rowVersion:number;dependencySha256:string;passageBasis:string}){
  const loaded=await readD161Snapshot(c,member.sermonId);if(loaded===null)return fail();
  const s=loaded;
  if(s.rowVersion!==member.rowVersion||s.status!=="draft"||s.publishedAt!==null||!s.substantiveComplete)return fail();
  const rows=(await c.query("SELECT DISTINCT ON(component) component,dependency_sha256,policy_sha256,outcome,assessment,provenance,reviewer_subject FROM sermon_ai_component_reviews WHERE scope_id='D-161' AND sermon_id=$1 ORDER BY component,created_at DESC,id DESC",[member.sermonId])).rows;
  const components=remainingComponents.map(component=>rows.find(r=>r.component===component));
  if(components.some((r,i)=>!r||r.dependency_sha256!==s.dependencies[remainingComponents[i]!]||r.policy_sha256!==s.policySha256||r.outcome==="needs_human"||r.reviewer_subject!==d161ReviewerSubject||r.provenance?.model!==d161RuntimeModel))return fail();
  const acceptedComponents=components as Record<string,any>[];
  const dependency=d161Hash({scope:d161SourceManifest,policy:s.policySha256,components:acceptedComponents.map((r,i)=>({component:remainingComponents[i],dependency:r.dependency_sha256,outcome:r.outcome})),substantive:true,status:s.status,publishedAt:s.publishedAt});
  const completion=rows.find(r=>r.component==="completion")??(await c.query("SELECT dependency_sha256,outcome,policy_sha256,provenance,reviewer_subject FROM sermon_ai_component_reviews WHERE scope_id='D-161' AND sermon_id=$1 AND component='completion' ORDER BY created_at DESC,id DESC LIMIT 1",[member.sermonId])).rows[0];
  if(!completion||completion.outcome!=="accepted"||completion.dependency_sha256!==dependency||completion.policy_sha256!==s.policySha256||completion.reviewer_subject!==d161ReviewerSubject||completion.provenance?.model!==d161RuntimeModel)fail();
  const passage=acceptedComponents[remainingComponents.indexOf("passage")];const basis=passage?.assessment?.checks?.noSinglePrimarySupported===true?"no_single_primary":"primary_passage";
  if(member.passageBasis!==basis)fail();
  const current=(await c.query("SELECT d161_restricted_acceptance_dependency($1) digest",[member.sermonId])).rows[0]?.digest;
  if(current!==member.dependencySha256)fail();return current as string;
}

export async function applyD161RestrictedAcceptance(pool:Pool,raw:unknown,environment:AcceptanceEnvironment){const manifest=parseD161RestrictedManifest(raw),hash=d161AcceptanceManifestHash(manifest);
  return transaction(pool,environment,async c=>{
    const scope=(await c.query("SELECT scope_sha256,member_count FROM remaining_ai_review_scopes WHERE id='D-161'")).rows[0];if(!scope||scope.scope_sha256!==d161SourceManifest||scope.member_count!==36)fail();
    const ids=(await c.query("SELECT sequence,sermon_id FROM remaining_ai_review_members WHERE scope_id='D-161' ORDER BY sequence")).rows;
    const expected=[...manifest.members,...manifest.blocked].sort((a,b)=>a.sequence-b.sequence).map(v=>({sequence:v.sequence,sermon_id:v.sermonId}));if(canonicalReviewJson(ids)!==canonicalReviewJson(expected))fail();
    const receipts=(await c.query("SELECT * FROM sermon_d161_restricted_acceptances ORDER BY sermon_id")).rows;
    if(receipts.length){if(receipts.length!==manifest.members.length)fail();for(const member of manifest.members){const prior=receipts.find(r=>r.sermon_id===member.sermonId),s=(await c.query(`SELECT status,published_at,row_version,d161_restricted_acceptance_dependency(id) digest,
        EXISTS(SELECT 1 FROM sermon_d161_restricted_acceptance_withdrawals w WHERE w.sermon_id=$1) withdrawn FROM sermons WHERE id=$1`,[member.sermonId])).rows[0];
        if(!prior||prior.acceptance_manifest_sha256!==hash||prior.environment!==environment||prior.evidence_sha256!==member.dependencySha256||prior.accepted_row_version!==member.rowVersion||!s||s.status!=="draft"||s.published_at!==null||s.withdrawn||s.row_version!==member.rowVersion||s.digest!==prior.content_dependency_sha256)fail();}
      return{outcome:"unchanged"as const,accepted:0,unchanged:receipts.length,manifestSha256:hash};}
    const timestamp=(await c.query("SELECT clock_timestamp() at")).rows[0].at;
    for(const member of manifest.members){const dependency=await verifyMember(c,member);
      await c.query(`INSERT INTO sermon_d161_restricted_acceptances(sermon_id,decision,source_manifest_sha256,acceptance_manifest_sha256,evidence_sha256,content_dependency_sha256,fingerprint_format,accepted_row_version,authorized_by,executed_by,manual_review_claimed,passage_basis,environment,accepted_at)
        VALUES($1,'D-161',$2,$3,$4,$5,'d161-utc-jsonb-v1',$6,'samuel-saad-d161-authorization',$7,false,$8,$9,$10)`,[member.sermonId,d161SourceManifest,hash,member.dependencySha256,dependency,member.rowVersion,d161ReviewerSubject,member.passageBasis,environment,timestamp]);
      await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id) VALUES($1,'system','sermon.d161.restricted_acceptance','sermon',$2,'succeeded','[\"d161RestrictedAcceptance\"]'::jsonb,$3)",[d161ReviewerSubject,member.sermonId,hash]);}
    return{outcome:"accepted"as const,accepted:manifest.members.length,unchanged:0,manifestSha256:hash};
  });}
