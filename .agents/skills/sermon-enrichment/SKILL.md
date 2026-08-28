---
name: sermon-enrichment
description: Create, regenerate, review, or validate private sermon descriptions and Q&A drafts from a complete approved transcript. Use for transcript-grounded enrichment, replacement drafts, grounding evidence, coherence and readability review, or any request involving sermon description or question-and-answer quality.
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

## Workflow

1. Verify the exact private target by stable source identity and application identity, never by title alone.
2. Verify that the transcript is current and approved. Capture its row version, UTF-8 SHA-256, character count, and lexical word count before reading it for generation.
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
- Mention Scripture only when the approved transcript clearly supports the reference and its use. Record uncertainty instead of resolving ambiguity.
- Avoid generic introductions or conclusions, stock invitations, repeated scaffolding, disconnected excerpts, raw caption fragments, and obvious ASR errors.
- Do not invent claims, motivations, applications, quotations, speaker identity, Scripture references, or theological conclusions.

## Q&A requirements

- Produce 5–10 ordered pairs; target 7 when the transcript supports seven distinct useful questions.
- Make every question specific to the actual sermon and useful to a listener who wants to understand or apply it.
- Give a complete, concise, transcript-grounded answer. Paraphrase the preacher’s reasoning instead of pasting an excerpt.
- Cover distinct aspects of the message such as subject, reasoning, Scripture use, implications, cautions, encouragement, and application only when those aspects are present.
- Avoid a fixed question set, generic prompts, repeated answers, unrelated transcript passages, and claims unsupported by the approved transcript.
- Keep uncertainty visible when a name, reference, or wording is unclear.

## Fail-closed validation

Reject the result when any of these conditions is true:

- Transcript identity, SHA-256, row version, or approval state differs from the request.
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

- Transcript identity, row version, SHA-256, approval evidence, and generation request hash.
- Skill name and version, generation method, generation time, warnings, and uncertainties.
- Actual generator provider, model, immutable revision and approval reference; prompt-policy version and hashes of the complete skill and grounding instructions supplied; and the approved transcript source hash.
- Support locations and hashes for each description paragraph and every Q&A pair.
- Original superseded bundle path and integrity hash plus original description and Q&A hashes.
- Replacement result hash, validation result, import time, and idempotency evidence.
- Completed `generated-text-mechanical-qa-v1` result and any unresolved context-dependent review flags.

Mark a result stale whenever the approved transcript’s identity, body hash, or row version changes. Preserve superseded draft bodies and audit evidence; never delete or silently overwrite them.

## Human authority

Describe automated validation as structural and transcript-grounding evidence only. The administrator must still judge transcript accuracy, Scripture handling, theology, subject emphasis, application, tone, readability, Q&A usefulness, and whether to approve or reject each content area.
