---
name: sermon-enrichment
description: Create, regenerate, review, or validate private sermon descriptions and Q&A drafts from a complete approved transcript, plus the exact D-151 through D-155 private pre-approval batch attempts when their manifest contracts are satisfied. Use for transcript-grounded enrichment, replacement drafts, grounding evidence, coherence and readability review, or any request involving sermon description or question-and-answer quality.
---

# Sermon Enrichment

## Purpose

Produce coherent, transcript-grounded private drafts for later human review. Treat the approved transcript as the sole content authority and keep theological, editorial, and publication decisions with the administrator.

## Non-negotiable boundaries

- Use only the complete current administrator-approved transcript for content claims.
- Invoke an explicitly approved text-generation model for synthesis and record its provider, model, immutable revision and approval reference. If no approved generator is configured or it fails, create no draft and return a structured manual-attention failure.
- Use title, date, speaker, series, and classifications only for orientation and identity checks. Do not use metadata as authority for sermon claims.
- Stop when the approved transcript is missing, unreliable, stale, internally inconsistent, or cannot support a faithful draft.
- Preserve explicit uncertainty. Do not repair unclear names, quotations, Bible references, or doctrine by guessing.
- Keep every generated result private, draft, unapproved, non-public, and absent from search.
- Never mark transcript accuracy, theological accuracy, content approval, or publication approval on an administrator's behalf.
- Never create embeddings or semantic relationships as part of this workflow.
- Never use the description-only Related-themes embedding model as a text generator, and never fall back to ranked excerpts, fixed wrappers or deterministic transcript extraction.

### One-time D-151 exception

The approved-transcript rule above remains the default. Use an unapproved transcript only when all of these conditions hold:

- The request is the 3 September 2026 Samuel-authorised D-151 evaluation run and the target is in its Git-ignored, integrity-verified manifest of exactly 36 fixed, unique, previously inspected and unprocessed source/video identities.
- The manifest SHA-256, fixed order and D-151 governance commit are bound before reading or generating from the transcript. A failed record counts as attempted; no substitute or thirty-seventh record is allowed.
- The complete newly prepared transcript has valid official-caption provenance and remains explicitly unapproved. It is the sole authority for description and Q&A claims.
- The transcript, description and Q&A all stay private and unapproved. Transcript approval remains a prerequisite to approving either dependent content area.
- Every generated result records `source_transcript_sha256`, `source_transcript_approval_state_at_generation: unapproved`, `requires_administrator_review: true`, D-151, the manifest hash, generator provenance and timestamp, output hash and retry count.
- Runtime model, immutable revision or session identity is recorded only when exposed. Otherwise store null with `not_exposed_by_runtime`. Store `not_exposed_to_runtime` for unavailable workspace privacy/retention detail and attach `MODEL_REVISION_UNAVAILABLE_LIMITED_REPRODUCIBILITY` to every result.
- A changed transcript body hash or source identity makes every dependent result stale and requires regeneration or explicit re-review against the changed transcript.
- The exception expires once all 36 manifest records have been attempted, regardless of success count. It cannot authorise later use.

### One-time D-152 retry

D-151 is complete and remains immutable. D-152 permits one retry only when the prior private checkpoint proves that every one of the same 36 ordered manifest positions ended specifically as `caption_primary_audio_unconfirmed`, the manifest canonical SHA-256 is `7e513f03cab908f30223753832211d2593ce4ffab15706ee851760385d9acb30`, and the new attempt is bound to the D-152 governance commit.

- For this retry only, an otherwise eligible serving, non-draft English standard or ASR caption may have `audioTrackType: unknown`. Do not represent it as primary audio. Retain `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `primary_audio_confirmed: false`, and `accepted_under_bounded_exception: true` in source and generated-result provenance.
- Continue rejecting commentary, descriptive, forced, wrong-language, draft, failed, unsupported-kind and equal-priority ambiguous tracks. A primary-audio track remains eligible without the unknown-audio warning.
- The complete newly prepared transcript may remain unapproved and immediately ground private unapproved description and Q&A drafts under the same D-151 generator, grounding, privacy, staleness and administrator-review rules, additionally recording D-152 and the prior-checkpoint binding.
- Do not replace a failed record, alter the earlier checkpoint, introduce another identity or process a thirty-seventh record. The retry expires after its 36 manifest positions are attempted, regardless of success.

### One-time D-153 second batch

D-151 and D-152 remain complete and immutable. D-153 creates a separate exception only for the 36 exact ordered identities in the Git-ignored manifest whose canonical SHA-256 is `f25979b57aae574dcd4616509d7678f7f0b8e08b28ef6911ab322762c6fd69ab` and only after its D-153 governance commit is bound.

- Attempt each fixed position at most once through the resumable checkpoint. A failure consumes its position; do not substitute another record or process a thirty-seventh sermon.
- Select only a serving, non-draft English standard or ASR caption from the exact requested church-owned video. Use priority standard-primary, standard-unknown, ASR-primary, ASR-unknown and fail that position on equal highest priority.
- An accepted `audioTrackType: unknown` is not confirmed primary audio. Retain `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `primary_audio_confirmed: false`, and `accepted_under_bounded_exception: true`. Reject descriptive, commentary, forced, wrong-language, draft, failed and unexpected track types.
- The complete newly prepared transcript may remain unapproved and immediately ground private unapproved description and Q&A drafts. Apply the normal whole-sermon synthesis, support-evidence, editorial-validation, privacy and stale-result requirements.
- Bind every result to D-153, the manifest and governance hashes, exact unapproved transcript grounding revision and SHA-256, runtime-exposed generator identity or required unavailable markers, generation/output hashes, retry count and mandatory administrator review.
- Bounded correction applies only before the first successful import of a newly generated D-153 candidate. Preserve rejected candidates and answers when only a prohibited generic question opening is rephrased. After a receipt exists, only a byte-identical idempotency import is allowed.
- The exception expires when all 36 positions are terminal and cannot authorise another manifest, retry, approval, publication, semantic operation or provider call.

### One-time D-154 third batch

D-151 through D-153 remain complete and immutable. D-154 creates a separate exception only for the 36 exact ordered identities in the Git-ignored manifest whose canonical SHA-256 is `d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244` and only after its D-154 governance commit is bound.

- Attempt each fixed position at most once through its separate resumable checkpoint. A failure consumes its position; do not substitute another record or process a thirty-seventh sermon.
- Select only a serving, non-draft English standard or ASR caption from the exact requested church-owned video. Use priority standard-primary, standard-unknown, ASR-primary, ASR-unknown and fail that position on equal highest priority.
- An accepted `audioTrackType: unknown` is not confirmed primary audio. Retain `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `primary_audio_confirmed: false`, and `accepted_under_bounded_exception: true`. Reject descriptive, commentary, forced, wrong-language, draft, failed and unexpected track types.
- The complete newly prepared transcript may remain unapproved and immediately ground private unapproved description and Q&A drafts. Apply the normal whole-sermon synthesis, support-evidence, editorial-validation, privacy and stale-result requirements.
- Bind every result to D-154, the manifest and governance hashes, exact unapproved transcript grounding revision and SHA-256, runtime-exposed generator identity or required unavailable markers, generation/output hashes, retry count and mandatory administrator review.
- Bounded correction applies only before the first successful import of a newly generated D-154 candidate. Preserve rejected candidates and preserve answers when only a prohibited generic question opening is rephrased. After a receipt exists, only a byte-identical idempotency import is allowed.
- The exception expires when all 36 positions are terminal and cannot authorise another manifest, retry, replacement, approval, publication, semantic operation or provider call.

### One-time D-155 fourth batch

Decision D-155 creates one fourth fixed-batch exception bound only to canonical manifest SHA-256 `eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a`. The exact 36 new source/video pairs were deterministically frozen in ascending authoritative source-ID order after excluding all 123 prior attempts, including provider failures; 195 clean candidates became 36 fixed positions plus 159 remaining. Only the current interactive OpenAI Codex `gpt-6-astra` runtime may sequentially prepare private word-preserving transcripts and generate private unapproved 180–220-word descriptions and five to ten grounded ordered Q&A pairs from them before transcript approval. Complete transcript and candidate prose may pass only through the minimum primary Codex tool inputs/results and session context needed for this manifest, never another agent/provider or ordinary logs, progress, reports, Git, documentation, tests, screenshots, build or public output. Official captions use standard-primary, standard-unknown, ASR-primary, ASR-unknown priority; accepted unknown audio remains explicitly unconfirmed and retains the bounded-decision warning and D-155/manifest provenance. Preserve each original candidate before validation; allow at most one pre-import correction, retain rejected bytes and lineage, and do not reset that allowance on resumption. Every result binds the governance commit, exact manifest and transcript hashes, original/corrected output hashes, truthful Astra/runtime provenance, AUD 0 separately billed API cost, mandatory administrator review and all private/unapproved/public-search-feed-sitemap-SEO-build-semantic exclusions. Unexposed runtime details use `not_exposed_by_runtime`; retain the limited-reproducibility warning. Transcript changes make dependent drafts stale; transcript approval and separate human content decisions remain required. Import only atomically into the guarded local test target, preserve all prior 119 records, and permit only byte-identical idempotency imports after success. Each failure consumes its position; no substitution or thirty-seventh record is authorised. The exception expires after all 36 positions are terminal. Normal approved-transcript and primary-audio rules remain unchanged for every other manifest; D-151 through D-154 stay consumed and immutable. No approval, publication, embeddings, production access, schema change, frontend change, merge, deployment or push is authorised.

This is a separate manifest-bound exception, not permission to reuse a consumed earlier batch. Read the complete transcript in the primary Astra context one record at a time; preserve source wording and uncertainty. Ground each description paragraph and ordered Q&A pair using the unchanged support and editorial rules below. A missing or unusable source or failed final candidate consumes its position without substitution. An exact continuation reuses valid saved candidates and never repeats completed retrieval or preparation.

## Workflow

1. Verify the exact private target by stable source identity and application identity, never by title alone.
2. Verify that the transcript is current and approved, unless the exact target is bound to the one-time D-151 exception, its exact D-152 retry, the exact D-153 second-batch exception, the exact D-154 third-batch exception, or the exact D-155 fourth-batch exception above. Capture its immutable grounding revision, UTF-8 SHA-256, character count, lexical word count, current administrative row version, and approval state/evidence before reading it for generation. Administrative row version and approval timestamps are audit/concurrency evidence; they are not grounding identity.
3. Read the complete transcript. Identify the actual controlling subject, the sermon’s reasoning or development, its use of Scripture as stated in the transcript, and its concrete application.
4. Draft the description and Q&A set from the sermon as a whole. Do not rank, concatenate, or wrap transcript excerpts.
5. Attach bounded transcript support to every description paragraph and every Q&A pair using the private contract in `references/grounding-contract.md`.
6. Complete the final editorial-proofreading checklist below after drafting. Record the deterministic result and retain every contextual flag for human review.
7. Validate structure, grounding, transcript binding, coherence proxies, privacy state, mechanical proofreading, and stale-result prevention. Automated checks are safeguards, not theological approval.
8. Import only through an atomic draft-only operation that refuses approved or administrator-edited content and preserves the superseded bundle and hashes.
9. Present the replacement to the real administrator for independent review. Do not carry forward any prior acknowledgement or approval.

## Description requirements

- Write 180–220 words in natural Australian English unless a separately approved specification changes the range.
- Explain the sermon’s actual subject, how the message develops its reasoning, and the application the preacher gives listeners.
- Be accurate, clear, coherent, readable, and welcoming to a visitor unfamiliar with the sermon.
- Use complete sentences and connected paragraphs. Each paragraph must have a clear role in the summary.
- Paraphrase faithfully. Use a direct quotation only when the transcript is clear, the wording matters, and exact support is recorded.
- Mention Scripture only when the authorised source transcript clearly supports the reference and its use. Record uncertainty instead of resolving ambiguity.
- Avoid generic introductions or conclusions, stock invitations, repeated scaffolding, disconnected excerpts, raw caption fragments, and obvious ASR errors.
- Do not invent claims, motivations, applications, quotations, speaker identity, Scripture references, or theological conclusions.

## Q&A requirements

- Produce 5–10 ordered pairs; target 7 when the transcript supports seven distinct useful questions.
- Make every question specific to the actual sermon and useful to a listener who wants to understand or apply it.
- Give a complete, concise, transcript-grounded answer. Paraphrase the preacher’s reasoning instead of pasting an excerpt.
- Cover distinct aspects of the message such as subject, reasoning, Scripture use, implications, cautions, encouragement, and application only when those aspects are present.
- Avoid a fixed question set, generic prompts, repeated answers, unrelated transcript passages, and claims unsupported by the authorised source transcript.
- Keep uncertainty visible when a name, reference, or wording is unclear.

## Fail-closed validation

Reject the result when any of these conditions is true:

- The immutable transcript grounding revision, content SHA-256, source identity, or required approval state differs from the request. The sole permitted requested state other than approved is `unapproved` under the exact D-151 manifest binding, its integrity-proven D-152 retry, the exact D-153 manifest binding, the exact D-154 manifest binding, or the exact D-155 manifest binding. A row-version or approval-timestamp change alone is not staleness.
- A support range is missing, outside transcript bounds, reversed, empty, or hash-mismatched.
- Any description paragraph or Q&A pair lacks support.
- The description is outside 180–220 words, lacks the central subject or application, contains incomplete sentences, or matches known generic wrappers.
- The description resembles a sequence of disconnected transcript excerpts rather than a synthesized explanation.
- Questions match a fixed generic set, answers paste unrelated passages, or pairs are substantially duplicated.
- A detectable Scripture or theological assertion has no recorded supporting location.
- The result requests, implies, or records approval, publication, indexing, or semantic eligibility.
- The final mechanical proofreading result is missing or contains an unresolved blocking defect.

If an automated rule cannot decide a matter reliably, add a warning for human review; never convert uncertainty into approval.

## Final editorial-proofreading checklist

Run this after the description and every Q&A pair are complete, before the result is considered ready for administrator review:

- Verify that every reference to Jesus and Christ uses the correct proper-name capitalisation.
- Check biblical names and Bible-book names for capitalisation and consistent spelling.
- Check sentence starts, repeated spacing, spaces before punctuation, duplicated punctuation, and obvious broken sentence joins.
- Reject incomplete sentences, raw caption fragments, and wording that reads like mechanically stitched transcript material.
- Check that the same person and place are spelled consistently within the result.
- Flag lowercase or otherwise uncertain uses of context-sensitive terms such as god, spirit, and scripture for human review. Do not blindly capitalise them.
- Record the completed `generated-text-mechanical-qa-v1` outcome, blocking count, review-flag count, and safe issue categories without copying sermon text into logs or tracked files.

This mechanical pass is separate from the administrator's semantic, theological, Scripture, tone, application, and usefulness review. The application validator is an independent enforcement layer; do not claim that application code invokes this skill.

## Provenance and preservation

Record privately:

- Immutable transcript grounding revision, transcript SHA-256 and source identity, plus current administrative row version, approval state/evidence, and generation request hash.
- Skill name and version, generation method, generation time, warnings, and uncertainties.
- Actual generator provider, exposed model/revision/session identity or the required runtime-unavailable markers, approval/exception reference, execution surface/mode, prompt-policy version and hashes of the complete skill and grounding instructions supplied, manifest and governance commit hashes when D-151, D-152, D-153, D-154 or D-155 applies, D-152 prior-checkpoint binding when applicable, caption audio-association provenance and the source transcript hash.
- Support locations and hashes for each description paragraph and every Q&A pair.
- Original superseded bundle path and integrity hash plus original description and Q&A hashes.
- Replacement result hash, validation result, import time, and idempotency evidence.
- Completed `generated-text-mechanical-qa-v1` result and any unresolved context-dependent review flags.

Mark a result stale whenever the source transcript’s immutable grounding revision, source identity, or body hash changes, or its grounding evidence is missing or invalid. An approval-only transition with identical transcript bytes does not itself invalidate grounding, but a D-151, D-152, D-153, D-154 or D-155 dependent draft cannot be approved until the transcript is approved and the draft is explicitly re-reviewed against that approved transcript. Do not mark it stale for a generic sermon/transcript row-version change, approval timestamp, passage decision, administrator-review timestamp, or a save in another generated content area. Preserve superseded draft bodies and audit evidence; never delete or silently overwrite them.

## Human authority

Describe automated validation as structural and transcript-grounding evidence only. The administrator must still judge transcript accuracy, Scripture handling, theology, subject emphasis, application, tone, readability, Q&A usefulness, and whether to approve or reject each content area.
