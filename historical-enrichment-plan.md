# Historical Sermon Enrichment Plan

## Current boundary

Phase 3B.2b remains limited to exactly the two records that the committed Phase 3B.2 outcome identified as `manual_punctuation_required`; the already-successful record and all other records remain excluded. The authorised exact-two private workflow produced and idempotently imported two draft enrichment sets. They remain private and unapproved. No conclusion about caption, Scripture or theological accuracy follows from import or automated verification. The remaining 450 sermons and Phase 3C are out of scope.

Administrator review now uses the dedicated `/admin/sermons/:id/review` route. It presents identity/provenance, typed flagged items, transcript, description, ordered Q&A and final summary one stage at a time. A missing decision is pending, not accepted; unresolved/rejected items block transcript approval; transcript edits invalidate earlier transcript-bound decisions. Saving, viewing and finishing review never publish. The human administrator must explicitly confirm identities/dates, decide every item, approve each content area and separately decide whether to accept the bounded pilot result.

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

## Phase 3B.2 authorization prerequisite

Phase 3B.2b does not authorise a larger batch. Before processing any of the remaining 450, Samuel must explicitly complete administrator review of both imported drafts and retained uncertainties, then explicitly accept the bounded verified report and workload evidence. A later authority must approve the next exact allowlist/batch, nominate reviewers/approvers, confirm source identities and dates, and reconfirm privacy/retention, retry/resume, correction/audit and rollback. Phase 3C remains paused.

## Pilot preparation boundary

- Inputs are local UTF-8 `.txt` exports attributed to authorised YouTube Studio access.
- URL identity is the allowlisted 11-character video ID; playlist/tracking parameters are discarded.
- The processor removes only timestamp-only lines and exact adjacent duplicate paragraphs, normalises whitespace, and capitalises existing sentence boundaries.
- A case-insensitive word-sequence equality check blocks any preparation that changes retained words.
- Sources without reliable sentence boundaries fail for manual attention unless separately allowlisted for the Phase 3B.2b Codex punctuation-only path.
- Phase 3B.2b uses deterministic, non-overlapping chunks of at most 450 lexical tokens with stable character/token ranges, source and cleaned SHA-256 hashes, exact ordering and complete source coverage.
- Source and cleaned text are normalised to Unicode NFC and tokenised independently on whitespace. Unicode punctuation is removed from each token and the remainder is case-folded. The token counts, boundaries, order and content must match for every chunk and the complete reassembly; deletion, addition, substitution, duplication, reordering, splitting or merging rolls back the complete sermon before persistence.
- The private bundle uses schema version 3 and records filename, SHA-256, language, track type (including unresolved `unknown`), counts, processing version/timestamps, warnings, unresolved markers, and mandatory accuracy review.
- Pilot migration records use the isolated `phase3b2_pilot` source-system discriminator and therefore cannot inflate the 453-record WordPress launch gate.
- No audio/video downloader, speech-to-text path, billable provider, or approval action exists in the pilot implementation.

## Remaining workload

No Phase 3B.2b private processing time, warning/review count or workload extrapolation is verified by the hardening task. Recalculate workload only after a separately authorised private rerun and administrator review, using clearly identified measured and estimated components. A larger authorised sample remains necessary before treating any extrapolation as a commitment.

## Launch gate

Production launch requires exactly 453 included records, 453 sole speakers, 453 approved descriptions, 453 approved transcripts, 453 valid approved Q&A sets, 453 valid controlled-media records, 453 complete records and zero incomplete. Missing details are reported only with approved anonymised source WordPress IDs and safe requirement codes.
