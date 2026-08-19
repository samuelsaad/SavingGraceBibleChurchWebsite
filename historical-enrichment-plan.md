# Historical Sermon Enrichment Plan

## Current boundary

Phase 3B.2b remains limited to exactly the two records that the committed Phase 3B.2 outcome identified as `manual_punctuation_required`; the already-successful record was completed through the original path. A read-only reconciliation on 17 August 2026 confirmed that all three pilot sermons remain private drafts while their guided reviews, transcripts, descriptions and seven Q&A pairs each are approved. Each has confirmed identity metadata and one canonical Bible-book assignment. Import and automated verification did not create those approvals; they are attributable administrator actions. Samuel Saad subsequently accepted the bounded three-sermon pilot as successfully completed.

Phase 3B.2c now has one separately bounded representative Wave 1. A deterministic private manifest contains 36 primaries and 12 predetermined alternates, but only the first 12 resolved positions were authorised for retrieval and processing. All 12 Wave 1 primaries were available, so no alternate was used. Their prepared captions produced exactly 12 transcript drafts, 12 description drafts and 84 ordered Q&A drafts. Every item remains private and unapproved, all 12 imports were unchanged on an identical second run, and no later wave or other sermon is authorised.

The 12 original Wave 1 review rows had no atomic expectation metadata because the later review-seeding function no longer populated it. A bounded repair filled only the all-null source-identity, item-count, empty-set identity and transcript hash/version expectations from the existing private drafts. All 12 now verify as valid zero-finding review sets. The repair preserved the one genuine identity confirmation already recorded, created no acknowledgement, decision, approval or completion, and left every later stage locked until genuine administrator action. Every content body, provenance hash, warning, uncertainty marker and private state remained unchanged.

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

The three pilot reviews are complete and their bounded pilot is accepted. The separate Wave 1 execution ended with 12 private drafts awaiting genuine administrator review; it does not inherit pilot acceptance. Wave 2, Wave 3, any additional sermon, publication, public **Related themes**, semantic quality acceptance, production/deployment and Phase 3C remain unauthorised. Any later execution requires separate explicit authority for its exact allowlist and limits.

## Pilot preparation boundary

- Inputs may be authorised local YouTube Studio exports or exact official YouTube Data API VTT bytes whose provenance is retained. Official-API source material remains private and is never treated as administrator-approved wording.
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

The Wave 1 processor estimated 777 administrator minutes across the 12 records, or about 13 hours. This is a formula-derived planning estimate, not observed human effort. Actual review time, corrections and acceptance outcomes must be recorded by the administrator before workload or quality is extrapolated. Semantic evaluation cannot use these descriptions until they are individually approved, and no embedding or relationship generation is authorised by Wave 1.

## Launch gate

Public replacement launch requires all 448 currently published sermon candidates to have one reconciled speaker, an approved description, approved transcript, valid 5–10 approved ordered Q&A pairs, required metadata and controlled media. The five pending rows remain private/unpublished, require separate approval before any future publication, and do not block public launch. The three WordPress drafts remain excluded. This supersedes the earlier 453/453 launch wording without changing the 453-row migration inventory. Missing details are reported only with approved anonymised source WordPress IDs and safe requirement codes.
