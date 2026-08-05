# Historical Sermon Enrichment Plan

## Current boundary

Phase 3B.1a defines and verifies contracts only. No external source/provider is contacted and none of the 453 real historical descriptions, transcripts or Q&A sets has been produced, reviewed or approved. The three-record anonymised fixture is demonstration evidence only.

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

The next milestone is **Phase 3B.2 - controlled historical description, transcript and Q&A production/review rehearsal**. Before it starts, approve the provider/source and secure access method, cost ceiling, privacy/retention terms, deterministic batch size, retry/resume and failure limits, reviewer/approver assignments, separate quality rubrics for all three outputs, correction/audit procedure, and rollback. Rehearse an approved anonymised/non-production batch first. Phase 3C remains paused.

## Launch gate

Production launch requires exactly 453 included records, 453 sole speakers, 453 approved descriptions, 453 approved transcripts, 453 valid approved Q&A sets, 453 valid controlled-media records, 453 complete records and zero incomplete. Missing details are reported only with approved anonymised source WordPress IDs and safe requirement codes.
