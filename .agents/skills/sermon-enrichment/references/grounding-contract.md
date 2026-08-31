# Private grounding contract

Use a versioned private JSON result. Keep real values in approved Git-ignored storage.

Required top-level fields:

- `schemaVersion`, `privateContent`, `skillName`, `skillVersion`, `generationMethod`, `generatedAt`
- `target`: stable private source identifier and application sermon identifier
- `transcript`: application transcript identifier, immutable grounding revision, approval state, SHA-256, character count, and word count; retain the current row version only as concurrency/audit evidence
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
