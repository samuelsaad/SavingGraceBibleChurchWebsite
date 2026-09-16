# Private grounding contract

D-160 separately permits `unapproved` source transcripts only for manifest
`0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`. Apply every normal
support-range, source-hash, paragraph/Q&A, editorial, output-integrity, uncertainty,
staleness and administrator-review rule below. Bind each result to D-160, the exact
fixed sequence, governance commit, transcript hash and output hashes. Store Samuel's
selected label `gpt-5.6-sol` separately from verified runtime model metadata. When
runtime model/revision/session/privacy details are not exposed, use the required
unavailable markers and limited-reproducibility warning; never invent them or copy
Astra provenance from an earlier decision. Preserve the original candidate and allow
at most one pre-import correction with both hashes, issue codes and truthful correction
metadata. Unknown-audio captions retain the bounded warning and false primary-audio
confirmation under D-160 only. Necessary prose may enter only the current primary
Codex session and ignored artifacts. No public, search, feed, sitemap, metadata, build,
semantic or approval eligibility is created. Transcript identity/byte changes make
dependent drafts stale. The exception cannot be reused for another manifest, a
substitute or after all 36 fixed positions become terminal. See
`sixth-private-batch-plan.md`; every normal rule remains in force elsewhere.

D-159 separately permits `unapproved` source transcripts only for manifest
`49c7eac788ce5564678cc3ff0c8aa72ec09f3e4e8f746044c1c6e4ed00ea5297`. Apply every normal
support-range, source-hash, paragraph/Q&A, editorial and output-integrity rule below.
Bind the new governance commit and exact fixed sequence to each result; retain
`source_transcript_approval_state_at_generation: unapproved` and mandatory later
administrator review. Record interactive Codex Astra provenance, no separately
billed API (AUD 0), unavailable runtime fields honestly and the limited-reproducibility
warning. Preserve the original candidate; at most one pre-import correction binds
both hashes, failures and correction provenance. Unknown-audio captions retain
the bounded-decision warning and false primary-audio confirmation under D-159 only.
Necessary source/transcript/candidate context is permitted only in the current primary
Codex session and ignored artifacts. No historical receipt is changed and no public,
search, feed, sitemap, metadata, build or semantic eligibility is created. Changes
to transcript identity/bytes make dependent drafts stale. This exception cannot be
reused for another manifest or after 36 terminal positions. See the repository-root
`fifth-private-batch-plan.md`; earlier decision records remain unchanged.
D-158 permits only the separately authorized, manifest-bound bulk acceptance in
`restricted-acceptance-plan.md`. It does not regenerate content or rewrite these
historical grounding records. New acceptance has its own UTC fingerprint format;
historical timezone serialization is reproduced only for legacy validation.

D-157 separately permits evidence-based remaining private review and final
completion for manifest `c46c9125291f2d73d73162d1e0a2be42a7ce7a27c3166579e6b60fd0c7b9fa68`.
Read [remaining-review-contract.md](remaining-review-contract.md). This is not
generation or human approval. Preserve the historical D-156 frozen policy binding;
do not relabel its decisions or invalidate them merely because a new delegation
is added. Current relevant content/source changes still invalidate acceptance.

D-156 is a separate delegated-review mode, governed by [delegated-review-contract.md](delegated-review-contract.md), not a renewed batch-generation exception. Its immutable AI decisions bind exact current content and transcript hashes, source provenance, policy, contextual reading coverage and reviewer identity. An unapproved but integrity-checked transcript may support private AI acceptance; neither transcript approval nor human content approval is created. The ordinary generation result contract below remains unchanged outside this mode.

For the exact D-155 fourth manifest `eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a` only, `unapproved` is also a permitted source-transcript state. Bind the D-155 governance commit, exact immutable grounding revision and transcript SHA-256, fixed sequence/source identity, original candidate/output SHA-256, and current interactive Codex `gpt-6-astra` generation/validation/correction evidence. Keep the complete normal support-range contract below. Record separately billed API use as false and cost as AUD 0, unavailable runtime fields as `not_exposed_by_runtime`, and retain the limited-reproducibility warning. An original candidate has retry count zero and no correction; the sole permitted pre-import correction has count one, preserved original hash, validator-failure codes, correction kind, timestamp and Astra attribution. Candidate text may enter only this manifest's minimum primary Codex tool/session context and approved ignored persistence, never ordinary logs, user-facing prose, Git or another context. Successful import forbids later content changes; only an identical rerun is allowed. All results remain private/unapproved and require transcript approval and separate administrator review before dependent approval; changed transcript identity/hash makes them stale. No terminal retry, substitution or thirty-seventh record is allowed. Every other manifest retains its existing gate, and all 36 terminal positions consume D-155.

Use a versioned private JSON result. Keep real values in approved Git-ignored storage.

Required top-level fields:

- `schemaVersion`, `privateContent`, `skillName`, `skillVersion`, `generationMethod`, `generatedAt`
- `target`: stable private source identifier and application sermon identifier
- `transcript`: application transcript identifier, immutable grounding revision, approval state, SHA-256, character count, and word count; retain the current row version only as concurrency/audit evidence. The normal state is `approved`; only a result bound to the exact D-151 36-record manifest, its integrity-proven D-152 retry, the exact D-153 second-batch manifest, the exact D-154 third-batch manifest, or the exact D-155 fourth-batch manifest may record `unapproved`.
- `original`: superseded private bundle path and SHA-256 plus original description and Q&A body hashes
- `description`: body, central subject statement, application statement, and one support record per paragraph
- `questionAnswers`: 5–10 ordered pairs, each with support records
- `warnings`, `uncertainties`, and `integrity`

Each support record contains:

- One-based `paragraphNumber` for orientation.
- Zero-based half-open `characterStart` and `characterEnd` in the exact approved transcript.
- One-based inclusive `wordStart` and `wordEnd` in its normalized lexical word sequence.
- `supportSha256`, calculated over the exact UTF-8 transcript substring selected by the character range.
- A short safe `purpose` label such as `subject`, `reasoning`, `scripture_use`, `application`, or `answer_support`.

Do not store support quotations separately. The private transcript range is the evidence. Validate every range and hash before import.

The integrity block records a canonical SHA-256 over the result excluding the integrity block. Current results bind the immutable transcript grounding revision and exact content SHA-256. Approval metadata, passage changes, generic row versions and changes to another generated content area do not change that binding. Refuse import when the transcript revision/source/body differs, the result is stale, malformed, unsupported, not private, or not explicitly unapproved.

For D-151 only, the private result also requires the exception identifier, exact batch-manifest SHA-256, D-151 governance commit, `source_transcript_approval_state_at_generation: unapproved`, `requires_administrator_review: true`, generator execution surface/mode, runtime-exposed identity or the prescribed unavailable markers, generation and output hashes, retry count, zero external API cost, and `MODEL_REVISION_UNAVAILABLE_LIMITED_REPRODUCIBILITY`. Import must force transcript, description and Q&A to private unapproved states. A failure consumes that manifest position, no replacement is accepted, and no use is valid after all 36 positions have been attempted.

For D-152, retain the complete D-151 private-result contract and additionally bind the D-152 governance commit, the exact prior D-151 checkpoint hash and terminal failure identity, and the caption audio-association fields. An accepted `unknown` track requires `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `audio_track_type: unknown`, `primary_audio_confirmed: false`, and `accepted_under_bounded_exception: true`. The original D-151 checkpoint remains unchanged. D-152 is valid only for the same exact manifest hash and only until all 36 retry positions have been attempted; no substitute or thirty-seventh record is valid.

For D-153, bind the private result only to manifest SHA-256 `f25979b57aae574dcd4616509d7678f7f0b8e08b28ef6911ab322762c6fd69ab`, the D-153 governance commit and one of its 36 fixed ordered identities. Retain the exact unapproved source transcript grounding revision and SHA-256, generator provenance, output hash, retry count, mandatory administrator review and all ordinary support evidence. An accepted unknown-audio track requires the same truthful warning and false primary-audio assertion as D-152, but D-153 is not a retry of D-151/D-152. Each failure consumes its position, no substitution is valid, and the exception expires after all 36 positions are terminal. Bounded correction is allowed only before the first successful import; later imports must be byte-identical.

For D-154, bind the private result only to manifest SHA-256 `d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244`, the D-154 governance commit and one of its 36 fixed ordered identities. Retain the exact unapproved source transcript grounding revision and SHA-256, generator provenance, output hash, retry count, mandatory administrator review and all ordinary support evidence. An accepted unknown-audio track requires the same truthful warning and false primary-audio assertion as D-153, but D-154 is a separate third batch. Each failure consumes its position, no substitution or thirty-seventh record is valid, and the exception expires after all 36 positions are terminal. Bounded correction is allowed only before the first successful import; later imports must be byte-identical.
