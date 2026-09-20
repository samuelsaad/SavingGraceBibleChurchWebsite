import { z } from "zod";
import { inspectGeneratedText } from "../enrichment/generated-text-mechanical-qa";
import { aiContentSchema, canonicalReviewJson, contentHash, coveredCharacters, reviewHash } from "./delegated-ai-review";
import { remainingComponentDecisionSchema, remainingComponents, validateRemainingComponent, type RemainingReviewValidationContext } from "./remaining-ai-review";

export const d162Decision = "D-162" as const;
export const d162SourceManifest = "e47da706e8b458bed6f8198570cc4a51e4b9604049e394d71a02cc84f79ea17f" as const;
export const d162ReviewerSubject = "codex-d162-private-review" as const;
export const d162RuntimeModel = "not_exposed_by_runtime" as const;
const sha=z.string().regex(/^[a-f0-9]{64}$/u), safe=z.string().trim().min(1).max(3000).refine(v=>!/[<>\u0000]/u.test(v));
const range=z.object({start:z.number().int().nonnegative(),end:z.number().int().positive(),sha256:sha}).strict();
export const d162ProvenanceSchema=z.object({reviewer_kind:z.literal("ai"),provider:z.literal("OpenAI"),execution_surface:z.literal("Codex"),
  model:z.literal(d162RuntimeModel),mode:z.literal("interactive Codex session"),immutable_revision:z.literal("not_exposed_by_runtime"),
  session_id:z.literal("not_exposed_by_runtime"),privacy_details:z.literal("not_exposed_by_runtime"),
  separately_billed_api_used:z.literal(false),external_api_cost_aud:z.literal(0)}).strict();
export const d162SpeakerAssignmentSchema=z.object({decision:z.literal(d162Decision),scopeSha256:z.literal(d162SourceManifest),policySha256:sha,
  sermonId:z.uuid(),expectedSermonVersion:z.number().int().positive(),sourceSha256:sha,speakerId:z.uuid(),mediaId:z.uuid(),mediaTitleSha256:sha,
  reviewedAt:z.iso.datetime(),provenance:d162ProvenanceSchema,rationale:safe}).strict();
export type D162SpeakerAssignment=z.infer<typeof d162SpeakerAssignmentSchema>;
const canonicalWords=(value:string)=>value.normalize("NFKC").toLocaleLowerCase("en-AU").replace(/[^\p{L}\p{N}]+/gu," ").trim();
/** D-161 may fill a missing speaker only when a retained media title contains
 * the existing canonical full name. A first name, alias, or typical speaker is
 * never enough. */
export function d162CanonicalSpeakerInMediaTitle(mediaTitle:string,speakerName:string):boolean{
  const name=canonicalWords(speakerName);if(name.split(" ").length<2)return false;
  return (` ${canonicalWords(mediaTitle)} `).includes(` ${name} `);
}

export const d162ContentReviewSchema=z.object({decision:z.literal(d162Decision),scopeSha256:z.literal(d162SourceManifest),policySha256:sha,
  sermonId:z.uuid(),artifactKey:z.string().refine(v=>v==="description"||v.startsWith("qa:")&&z.uuid().safeParse(v.slice(3)).success),
  expectedSermonVersion:z.number().int().positive(),inputVersion:z.number().int().positive(),displayOrder:z.number().int().min(1).max(10).nullable(),
  transcriptSha256:sha,groundingRevisionId:z.uuid(),sourceSha256:sha,sourceProvenanceSha256:sha,inputSha256:sha,outputSha256:sha,
  original:aiContentSchema,output:aiContentSchema,outcome:z.enum(["accepted","corrected_accepted","needs_human"]),correctionRound:z.number().int().min(0).max(1),
  reviewedAt:z.iso.datetime(),provenance:d162ProvenanceSchema,evidence:z.array(range.extend({purpose:z.enum(["subject","reasoning","application","claim","qualification","scripture","ordering"])})).max(100),
  coverage:z.array(range).min(1).max(300),assessment:z.object({fullArtifactRead:z.literal(true),centralArgumentChecked:z.boolean(),substantiveClaimsSupported:z.boolean(),
    qualificationsPreserved:z.boolean(),questionAnswersDirectly:z.boolean(),scriptureAttributionChecked:z.boolean(),readabilityChecked:z.boolean(),orderingChecked:z.boolean(),
    integrity:z.enum(["verified","source_unavailable","unexplained_drift"]),rationale:safe,exceptionCode:z.string().regex(/^[a-z_]+$/u).nullable(),
    informationNeeded:safe.nullable(),standingWarnings:z.array(z.string().regex(/^[A-Z0-9_]+$/u)).max(100),audioVerified:z.literal(false),completeSemanticTranscriptReview:z.boolean()}).strict()}).strict();
export type D162ContentReview=z.infer<typeof d162ContentReviewSchema>;

export function validateD162ContentReview(raw:unknown,transcript:string):D162ContentReview{
  const fail=():never=>{throw new Error("d162_content_review_invalid");};
  const parsed=d162ContentReviewSchema.safeParse(raw);if(!parsed.success)return fail();const r=parsed.data;
  if(reviewHash(transcript)!==r.transcriptSha256||contentHash(r.original)!==r.inputSha256||contentHash(r.output)!==r.outputSha256)fail();
  const description=r.artifactKey==="description";
  if(description!==('description'in r.original)||description!==('description'in r.output)||description!==(r.displayOrder===null))fail();
  if((r.outcome==="corrected_accepted")!==(r.inputSha256!==r.outputSha256))fail();
  if(r.outcome==="corrected_accepted"&&r.correctionRound!==1||r.outcome==="accepted"&&r.correctionRound!==0)fail();
  for(const q of [...r.coverage,...r.evidence])if(q.start>=q.end||q.end>transcript.length||reviewHash(transcript.slice(q.start,q.end))!==q.sha256)fail();
  if(r.assessment.completeSemanticTranscriptReview&&coveredCharacters(r.coverage)!==transcript.length)fail();
  if(r.outcome==="needs_human"){if(!r.assessment.exceptionCode||!r.assessment.informationNeeded)return fail();return r;}
  const a=r.assessment;if(!r.evidence.length||!a.centralArgumentChecked||!a.substantiveClaimsSupported||!a.qualificationsPreserved||!a.questionAnswersDirectly||!a.scriptureAttributionChecked||!a.readabilityChecked||!a.orderingChecked||a.exceptionCode||a.informationNeeded||a.integrity!=="verified")fail();
  if('description'in r.output){const words=r.output.description.trim().split(/\s+/u).length;if(words<180||words>220||inspectGeneratedText(r.output.description,[]).blockingIssueCount)fail();}
  else if(inspectGeneratedText("",[r.output]).blockingIssueCount)fail();
  return r;
}

export const d162ComponentPacketSchema=z.object({decision:z.literal(d162Decision),scopeSha256:z.literal(d162SourceManifest),policySha256:sha,sermonId:z.uuid(),
  expectedSermonVersion:z.number().int().positive(),reviewedAt:z.iso.datetime(),provenance:d162ProvenanceSchema,
  components:z.array(remainingComponentDecisionSchema).min(1).max(6),requestPrivateCompletion:z.boolean()}).strict();
export type D162ComponentPacket=z.infer<typeof d162ComponentPacketSchema>;
export function validateD162ComponentPacket(raw:unknown,context:RemainingReviewValidationContext):D162ComponentPacket{
  const parsed=d162ComponentPacketSchema.safeParse(raw);if(!parsed.success)throw new Error("d162_component_review_invalid");
  if(new Set(parsed.data.components.map(c=>c.component)).size!==parsed.data.components.length)throw new Error("d162_component_review_invalid");
  for(const component of parsed.data.components)validateRemainingComponent(component,context);
  if(parsed.data.requestPrivateCompletion&&remainingComponents.some(k=>!parsed.data.components.some(c=>c.component===k&&c.outcome!=="needs_human")))throw new Error("d162_component_review_invalid");
  return parsed.data;
}
export function d162Hash(value:unknown):string{return reviewHash(canonicalReviewJson(value));}
