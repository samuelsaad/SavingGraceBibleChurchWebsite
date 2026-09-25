import type{Pool,PoolClient}from"pg";
import {verifyAcceptanceTarget,type AcceptanceEnvironment}from"./restricted-acceptance-service";
import {verifyReleaseSchema}from"../staging/database-verification";
import {canonicalReviewJson}from"../domain/delegated-ai-review";
import {d167ReviewerSubject,d167RuntimeModel,d167SourceManifest,d167Hash}from"../domain/d167-review";
import {d167AcceptanceManifestHash,parseD167RestrictedManifest}from"../domain/d167-restricted-acceptance";
import {remainingComponents}from"../domain/remaining-ai-review";
import {readD167Snapshot}from"./d167-review-service";

const fail=(code="d167_acceptance_evidence_or_concurrency_conflict"):never=>{throw new Error(code);};
async function transaction<T>(pool:Pool,environment:AcceptanceEnvironment,work:(c:PoolClient)=>Promise<T>){const c=await pool.connect();let discard=false;
  try{await verifyAcceptanceTarget(c,environment);await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");await c.query("SET LOCAL savinggrace.application_request='on'");await c.query("SET LOCAL statement_timeout='120s'");
    await c.query("SELECT pg_advisory_xact_lock(1397176899,1397111886)");await verifyReleaseSchema(c,22);const result=await work(c);await c.query("COMMIT");return result;
  }catch(error){try{await c.query("ROLLBACK");}catch{discard=true;}const code=error instanceof Error&&/^d167_acceptance_[a-z_]+$/u.test(error.message)?error.message:undefined;return fail(code);}
  finally{c.release(discard);}}

async function verifyMember(c:PoolClient,member:{sermonId:string;rowVersion:number;dependencySha256:string;passageBasis:string}){
  const loaded=await readD167Snapshot(c,member.sermonId);if(loaded===null)return fail();
  const s=loaded;
  if(s.rowVersion!==member.rowVersion||s.status!=="draft"||s.publishedAt!==null||!s.substantiveComplete)return fail();
  const rows=(await c.query("SELECT DISTINCT ON(component) component,dependency_sha256,policy_sha256,outcome,assessment,provenance,reviewer_subject FROM sermon_ai_component_reviews WHERE scope_id='D-167' AND sermon_id=$1 ORDER BY component,created_at DESC,id DESC",[member.sermonId])).rows;
  const components=remainingComponents.map(component=>rows.find(r=>r.component===component));
  if(components.some((r,i)=>!r||r.dependency_sha256!==s.dependencies[remainingComponents[i]!]||r.policy_sha256!==s.policySha256||r.outcome==="needs_human"||r.reviewer_subject!==d167ReviewerSubject||r.provenance?.model!==d167RuntimeModel))return fail();
  const acceptedComponents=components as Record<string,any>[];
  const dependency=d167Hash({scope:d167SourceManifest,policy:s.policySha256,components:acceptedComponents.map((r,i)=>({component:remainingComponents[i],dependency:r.dependency_sha256,outcome:r.outcome})),substantive:true,status:s.status,publishedAt:s.publishedAt});
  const completion=rows.find(r=>r.component==="completion")??(await c.query("SELECT dependency_sha256,outcome,policy_sha256,provenance,reviewer_subject FROM sermon_ai_component_reviews WHERE scope_id='D-167' AND sermon_id=$1 AND component='completion' ORDER BY created_at DESC,id DESC LIMIT 1",[member.sermonId])).rows[0];
  if(!completion||completion.outcome!=="accepted"||completion.dependency_sha256!==dependency||completion.policy_sha256!==s.policySha256||completion.reviewer_subject!==d167ReviewerSubject||completion.provenance?.model!==d167RuntimeModel)fail();
  const passage=acceptedComponents[remainingComponents.indexOf("passage")];const basis=passage?.assessment?.checks?.noSinglePrimarySupported===true?"no_single_primary":"primary_passage";
  if(member.passageBasis!==basis)fail();
  const current=(await c.query("SELECT d167_restricted_acceptance_dependency($1) digest",[member.sermonId])).rows[0]?.digest;
  if(current!==member.dependencySha256)fail();return current as string;
}

export async function applyD167RestrictedAcceptance(pool:Pool,raw:unknown,environment:AcceptanceEnvironment){const manifest=parseD167RestrictedManifest(raw),hash=d167AcceptanceManifestHash(manifest);
  return transaction(pool,environment,async c=>{
    const scope=(await c.query("SELECT scope_sha256,member_count FROM remaining_ai_review_scopes WHERE id='D-167'")).rows[0];if(!scope||scope.scope_sha256!==d167SourceManifest||scope.member_count<1||scope.member_count>36)fail();
    const ids=(await c.query("SELECT sequence,sermon_id FROM remaining_ai_review_members WHERE scope_id='D-167' ORDER BY sequence")).rows;
    const all=[...manifest.members,...manifest.blocked].sort((a,b)=>a.sequence-b.sequence).map(v=>({sequence:v.sequence,sermon_id:v.sermonId}));
    const imported=all.filter(v=>ids.some(row=>row.sequence===v.sequence&&row.sermon_id===v.sermon_id));
    if(all.length!==36||imported.length!==scope.member_count||ids.length!==scope.member_count||
      canonicalReviewJson(ids)!==canonicalReviewJson(imported))fail();
    const receipts=(await c.query("SELECT * FROM sermon_d167_restricted_acceptances ORDER BY sermon_id")).rows;
    if(receipts.length){if(receipts.length!==manifest.members.length)fail();for(const member of manifest.members){const prior=receipts.find(r=>r.sermon_id===member.sermonId),s=(await c.query(`SELECT status,published_at,row_version,d167_restricted_acceptance_dependency(id) digest,
        EXISTS(SELECT 1 FROM sermon_d167_restricted_acceptance_withdrawals w WHERE w.sermon_id=$1) withdrawn FROM sermons WHERE id=$1`,[member.sermonId])).rows[0];
        if(!prior||prior.acceptance_manifest_sha256!==hash||prior.environment!==environment||prior.evidence_sha256!==member.dependencySha256||prior.accepted_row_version!==member.rowVersion||!s||s.status!=="draft"||s.published_at!==null||s.withdrawn||s.row_version!==member.rowVersion||s.digest!==prior.content_dependency_sha256)fail();}
      return{outcome:"unchanged"as const,accepted:0,unchanged:receipts.length,manifestSha256:hash};}
    const timestamp=(await c.query("SELECT clock_timestamp() at")).rows[0].at;
    for(const member of manifest.members){const dependency=await verifyMember(c,member);
      await c.query(`INSERT INTO sermon_d167_restricted_acceptances(sermon_id,decision,source_manifest_sha256,acceptance_manifest_sha256,evidence_sha256,content_dependency_sha256,fingerprint_format,accepted_row_version,authorized_by,executed_by,manual_review_claimed,passage_basis,environment,accepted_at)
        VALUES($1,'D-167',$2,$3,$4,$5,'d167-utc-jsonb-v1',$6,'samuel-saad-d167-authorization',$7,false,$8,$9,$10)`,[member.sermonId,d167SourceManifest,hash,member.dependencySha256,dependency,member.rowVersion,d167ReviewerSubject,member.passageBasis,environment,timestamp]);
      await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id) VALUES($1,'system','sermon.d167.restricted_acceptance','sermon',$2,'succeeded','[\"d167RestrictedAcceptance\"]'::jsonb,$3)",[d167ReviewerSubject,member.sermonId,hash]);}
    return{outcome:"accepted"as const,accepted:manifest.members.length,unchanged:0,manifestSha256:hash};
  });}
