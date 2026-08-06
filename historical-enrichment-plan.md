# Historical Sermon Enrichment Plan

## Current boundary

Phase 3B.2 has completed a private, local three-caption rehearsal using the exact user-supplied filename/video mapping. No external source/provider was contacted. One caption had sufficient existing sentence boundaries for word-preserving preparation and produced private draft description/transcript/seven-Q&A output. Two captions had essentially no sentence boundaries and stopped with `manual_punctuation_required`; they produced no derived content. Nothing is approved, public, searchable, committed, or evidence of launch readiness. The remaining 450 sermons are out of scope.

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

The three-record Phase 3B.2 pilot does not authorise a larger batch. Before processing any of the remaining 450, explicitly accept the pilot report, approve the next exact allowlist/batch, nominate reviewers/approvers, supply or approve a non-billable method for punctuation-free captions, confirm source identities and dates, and reconfirm privacy/retention, retry/resume, correction/audit and rollback. Phase 3C remains paused.

## Pilot preparation boundary

- Inputs are local UTF-8 `.txt` exports attributed to authorised YouTube Studio access.
- URL identity is the allowlisted 11-character video ID; playlist/tracking parameters are discarded.
- The processor removes only timestamp-only lines and exact adjacent duplicate paragraphs, normalises whitespace, and capitalises existing sentence boundaries.
- A case-insensitive word-sequence equality check blocks any preparation that changes retained words.
- Sources without reliable sentence boundaries fail for manual attention; punctuation is never guessed.
- The private bundle uses schema version 3 and records filename, SHA-256, language, track type (including unresolved `unknown`), counts, processing version/timestamps, warnings, unresolved markers, and mandatory accuracy review.
- Pilot migration records use the isolated `phase3b2_pilot` source-system discriminator and therefore cannot inflate the 453-record WordPress launch gate.
- No audio/video downloader, speech-to-text path, billable provider, or approval action exists in the pilot implementation.

## Launch gate

Production launch requires exactly 453 included records, 453 sole speakers, 453 approved descriptions, 453 approved transcripts, 453 valid approved Q&A sets, 453 valid controlled-media records, 453 complete records and zero incomplete. Missing details are reported only with approved anonymised source WordPress IDs and safe requirement codes.
