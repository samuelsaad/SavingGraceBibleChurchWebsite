# Private grounding contract

Use a versioned private JSON result. Keep real values in approved Git-ignored storage.

Required top-level fields:

- `schemaVersion`, `privateContent`, `skillName`, `skillVersion`, `generationMethod`, `generatedAt`
- `target`: stable private source identifier and application sermon identifier
- `transcript`: application transcript identifier, immutable grounding revision, approval state, SHA-256, character count, and word count; retain the current row version only as concurrency/audit evidence. The normal state is `approved`; only a result bound to the exact D-151 36-record manifest, its integrity-proven D-152 retry, or the exact D-153 second-batch manifest may record `unapproved`.
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
