# Historical Sermon Enrichment Plan

## Current boundary

Phase 3B.2b remains limited to exactly the two records that the committed Phase 3B.2 outcome identified as `manual_punctuation_required`; the already-successful record and all other records remain excluded. The authorised exact-two private workflow produced and idempotently imported two draft enrichment sets, and the original Phase 3B.2 path produced the third. A read-only reconciliation on 17 August 2026 confirmed that all three sermons remain private drafts while their guided reviews, transcripts, descriptions and seven Q&A pairs each are approved. Each has confirmed identity metadata and one canonical Bible-book assignment. Import and automated verification did not create those approvals; they are attributable administrator actions. Samuel Saad subsequently accepted the bounded three-sermon pilot as successfully completed. The acceptance applies only to that pilot; the remaining 450 sermons and Phase 3C are out of scope and unauthorised.

Administrator review uses the dedicated `/admin/sermons/:id/review` route. It presents identity/provenance, 42 and 44 individually preserved atomic findings, transcript, description, ordered Q&A and final summary one stage at a time. The database now records 76 accepted and ten corrected current atomic decisions, zero pending/unresolved/rejected current items, an explicit zero-finding acknowledgement for the third record and three completed reviews. Every current atomic decision has exact subject/timestamp audit attribution. Retained warning codes—including unresolved caption-track type and the fact that punctuation was applied—remain provenance rather than active blockers. Saving, viewing and finishing review never publish. Whole-pilot acceptance is a separate human decision rather than a database field or audit action; Samuel Saad supplied that explicit bounded acceptance on 17 August 2026.

## Required outputs per included sermon

1. One complete plain-text transcript draft.
2. One concise sermon-description draft grounded in the transcript and scripture context.
3. Five to ten ordered scripture- and transcript-grounded Q&A drafts.

Every output remains draft after import. Human review is mandatory. The sermon description uses `sermons.summary`; it must reach approved state and 80-2,000 characters before it becomes public, searchable or readiness-eligible. Approximately two to four useful sentences is guidance, not a mechanical sentence count. `seo_description` is a separate optional controlled override and is not an enrichment substitute.

## Deterministic manifest and import

Manifest schema version 2 orders records by anonymised source WordPress ID and stable missing-requirement codes, including `missing_description` and `description_awaiting_review`. A bundle carries target/source identity, expected sermon row version, the three draft outputs, safe source type/reference, and bounded plain text. The importer:

- rejects unsafe HTML-like content and stale identity/version;
- stores every new output as draft with provenance;
- records a checksum receipt and safe audit changed-field names;
- returns `unchanged` for an identical rerun;
- refuses a differing description with `approved_description_conflict` when an approved description exists;
- never stores credentials or provider secrets and never marks any output approved.

## Post-pilot authorization boundary

Phase 3B.2b does not authorise a larger batch. The three per-sermon administrator reviews are complete, and Samuel Saad has explicitly accepted the bounded pilot as successfully completed. That acceptance does not authorise processing any of the remaining 450 sermons. Any future processing requires separate explicit authority for its exact allowlist and limits. Publishing the pilot sermons, enabling public **Related themes**, accepting semantic recommendation quality, accessing or deploying production, and beginning Phase 3C also remain unauthorised.

## Pilot preparation boundary

- Inputs are local UTF-8 `.txt` exports attributed to authorised YouTube Studio access.
- URL identity is the allowlisted 11-character video ID; playlist/tracking parameters are discarded.
- The processor removes only timestamp-only lines and exact adjacent duplicate paragraphs, normalises whitespace, and capitalises existing sentence boundaries.
- A case-insensitive word-sequence equality check blocks any preparation that changes retained words.
- Sources without reliable sentence boundaries fail for manual attention unless separately allowlisted for the Phase 3B.2b Codex punctuation-only path.
- Phase 3B.2b uses deterministic, non-overlapping chunks of at most 450 lexical tokens with stable character/token ranges, source and cleaned SHA-256 hashes, exact ordering and complete source coverage.
- Source and cleaned text are normalised to Unicode NFC and tokenised independently on whitespace. Unicode punctuation is removed from each token and the remainder is case-folded. The token counts, boundaries, order and content must match for every chunk and the complete reassembly; deletion, addition, substitution, duplication, reordering, splitting or merging rolls back the complete sermon before persistence.
- The private bundle uses schema version 3 and records filename, SHA-256, language, track type (including unresolved `unknown`), counts, processing version/timestamps, warnings, unresolved markers, and mandatory accuracy review.
- Pilot migration records use the isolated `phase3b2_pilot` source-system discriminator and therefore cannot inflate WordPress inventory or launch-readiness counts.
- No audio/video downloader, speech-to-text path, billable provider, or approval action exists in the pilot implementation.

## Remaining workload

No Phase 3B.2b private processing time, warning/review count or workload extrapolation is verified by the hardening task. Recalculate workload only after a separately authorised private rerun and administrator review, using clearly identified measured and estimated components. A larger authorised sample remains necessary before treating any extrapolation as a commitment.

## Launch gate

Public replacement launch requires all 448 currently published sermon candidates to have one reconciled speaker, an approved description, approved transcript, valid 5–10 approved ordered Q&A pairs, required metadata and controlled media. The five pending rows remain private/unpublished, require separate approval before any future publication, and do not block public launch. The three WordPress drafts remain excluded. This supersedes the earlier 453/453 launch wording without changing the 453-row migration inventory. Missing details are reported only with approved anonymised source WordPress IDs and safe requirement codes.
