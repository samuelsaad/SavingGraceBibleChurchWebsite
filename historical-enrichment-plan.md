# Historical Sermon Enrichment Plan

## Current boundary

Phase 3B.2b remains limited to exactly the two records that the committed Phase 3B.2 outcome identified as `manual_punctuation_required`; the already-successful record was completed through the original path. A read-only reconciliation on 17 August 2026 confirmed that all three pilot sermons remain private drafts while their guided reviews, transcripts, descriptions and seven Q&A pairs each are approved. Each has confirmed identity metadata and one canonical Bible-book assignment. Import and automated verification did not create those approvals; they are attributable administrator actions. Samuel Saad subsequently accepted the bounded three-sermon pilot as successfully completed.

Phase 3B.2c now has one separately bounded representative Wave 1. A deterministic private manifest contains 36 primaries and 12 predetermined alternates, but only the first 12 resolved positions were authorised for retrieval and processing. All 12 Wave 1 primaries were available, so no alternate was used. Their prepared captions produced exactly 12 transcript drafts, 12 description drafts and 84 ordered Q&A drafts. Every item remains private and unapproved, all 12 imports were unchanged on an identical second run, and no later wave or other sermon is authorised.

The 12 original Wave 1 review rows had no atomic expectation metadata because the later review-seeding function no longer populated it. A bounded repair filled only the all-null source-identity, item-count, empty-set identity and transcript hash/version expectations from the existing private drafts. All 12 now verify as valid zero-finding review sets. The repair preserved the one genuine identity confirmation already recorded, created no acknowledgement, decision, approval or completion, and left every later stage locked until genuine administrator action. Every content body, provenance hash, warning, uncertainty marker and private state remained unchanged.

Subsequent read-only quality diagnosis proved that the Wave 1 descriptions and Q&A were mechanical excerpt assemblies rather than coherent synthesis. The processing version is now retired. Its 12 descriptions and 84 Q&A bodies remain preserved privately as superseded evidence and cannot be reviewed or approved. One authorised canary has been replaced from its current approved transcript using the repository `sermon-enrichment` skill, with transcript hash/version binding and private support ranges for each description paragraph and Q&A pair. The replacement remains draft/unapproved. The other 11 records remain quarantined; no regeneration authority extends to them.

A later single-description diagnosis confirmed the exact failure path: `enrichment:wave1-process-local` called a deterministic `prepareWaveOneContent` routine that ranked mechanically punctuated transcript sentences, inserted fixed generic wrapper text and assembled fixed-question Q&A answers from transcript excerpts. No text-generation model was invoked, and the repository `sermon-enrichment` skill was not loaded for those 12 outputs. The same provenance covers all 12 original descriptions and 84 original Q&A pairs; the later grounded canary accounts for the current one/seven replacements, leaving 11/77 quarantined outputs.

Current code contains no extractive generator or fallback. It exposes only a retired fail-closed entry point plus an `approved-description-generation-v1` boundary. The boundary supplies the complete approved transcript and complete versioned skill/grounding instructions to an explicitly identified approved text-generation model, records generator/prompt/source provenance, and rejects failed, malformed, generic, fragmentary, repetitive, excerpt-heavy, unsupported or mechanically defective output without creating a draft. No approved text-generation model is configured, so the newly requested bounded description replacement was not generated or written. The BAAI Related-themes model remains embeddings-only and ineligible.

Administrator review uses the dedicated `/admin/sermons/:id/review` route. It presents identity/provenance, 42 and 44 individually preserved atomic findings, transcript, description, ordered Q&A and final summary one stage at a time. The database now records 76 accepted and ten corrected current atomic decisions, zero pending/unresolved/rejected current items, an explicit zero-finding acknowledgement for the third record and three completed reviews. Every current atomic decision has exact subject/timestamp audit attribution. Retained warning codes—including unresolved caption-track type and the fact that punctuation was applied—remain provenance rather than active blockers. Saving, viewing and finishing review never publish. Whole-pilot acceptance is a separate human decision rather than a database field or audit action; Samuel Saad supplied that explicit bounded acceptance on 17 August 2026.

## Required outputs per included sermon

1. One complete plain-text transcript draft.
2. One coherent 180–220 word sermon-description draft grounded in the current approved transcript.
3. Five to ten ordered scripture- and transcript-grounded Q&A drafts.

Every output remains draft after import. Human review is mandatory. The sermon description uses `sermons.summary`; it must reach approved state before it becomes public, searchable or readiness-eligible. The enrichment contract requires a coherent 180–220 word synthesis of subject, reasoning and application; it forbids generic wrappers, disconnected excerpts and caption fragments. `seo_description` is a separate optional controlled override and is not an enrichment substitute.

## Grounded replacement workflow

The repository-scoped `sermon-enrichment` skill is mandatory for creating, regenerating, reviewing or validating sermon descriptions and Q&A. It uses the complete current approved transcript as the sole content authority; metadata is orientation only. Private requests and results record stable target identity, immutable transcript grounding revision, transcript hash and approval evidence, skill version, generation method, warnings, uncertainty, original-bundle hashes and bounded support locations for every description paragraph and every Q&A pair. A transcript source/body revision or hash change makes the result stale. Generic row versions, approval timestamps, passage decisions and saves in another generated content area do not.

Skill version 1.2.0 additionally required the actual generator provider/model/immutable revision/approval reference and hashes of the complete prompt policy supplied. Version 1.3.0 adds mandatory immutable transcript-grounding identity for new results while retaining older versions only for verified compatibility. Model absence or invocation failure is a structured manual-attention outcome with no extractive approximation.

Automated validation checks private/draft state, 180–220 description words, 5–10 ordered Q&A, support bounds/hashes, obvious generic wrappers/fragments/excerpt copying, fixed questions, disconnected answers and detectable unsupported claims. These checks are not theological review. Atomic import refuses approved or administrator-edited content, preserves the superseded bundle and genuine administrator evidence, updates only the description/Q&A drafts, creates no approval, search, semantic or publication state, and must be unchanged on an identical rerun.

Every new result also requires a completed deterministic `generated-text-mechanical-qa-v1` proofread before import or generated-content review/approval. The gate rejects incorrect Jesus/Christ casing and obvious spacing, punctuation, sentence-start and broken-join defects. It retains context-dependent capitalization, possible caption fragments and uncertain biblical-name or spelling findings for administrator review rather than changing meaning by inference. This mechanical outcome is separate from coherence, grounding, Scripture and theological judgment. The application enforces the contract independently; it does not invoke or impersonate the repository skill.

## Deterministic manifest and import

Manifest schema version 2 orders records by anonymised source WordPress ID and stable missing-requirement codes, including `missing_description` and `description_awaiting_review`. A bundle carries target/source identity, expected sermon row version, the three draft outputs, safe source type/reference, and bounded plain text. The importer:

- rejects unsafe HTML-like content and stale identity/version;
- stores every new output as draft with provenance;
- records a checksum receipt and safe audit changed-field names;
- returns `unchanged` for an identical rerun;
- refuses a differing description with `approved_description_conflict` when an approved description exists;
- never stores credentials or provider secrets and never marks any output approved.

## Post-pilot authorization boundary

The three pilot reviews are complete and their bounded pilot is accepted. The separate Wave 1 execution does not inherit pilot acceptance. One grounded replacement canary awaits genuine administrator review; the other 11 description/Q&A sets are quarantined. Wave 2, Wave 3, regeneration of another sermon, publication, public **Related themes**, semantic quality acceptance, production/deployment and Phase 3C remain unauthorised. Any later execution requires separate explicit authority for its exact allowlist and limits.

The bounded current-15 mechanical audit corrected 13 indisputable Jesus/Christ capitalization defects in unreviewed generated drafts across three sermons. It changed two descriptions and six Q&A pairs, changed no approved content, and was unchanged on its second run. One sentence-start finding and 15 context-dependent review flags remain unmodified in quarantined Wave 1 material. The repair did not regenerate wording or alter transcript, provenance, administrator, passage, privacy, public-search or semantic state.

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

The superseded Wave 1 processor's 777-minute estimate is retained only as prior-run evidence and cannot validate defective content or forecast the grounded workflow. Actual canary review time, corrections and acceptance outcome must be recorded by the administrator before quality or workload is extrapolated. Semantic evaluation cannot use any description until it is individually approved, and no embedding or relationship generation is authorised by Wave 1 or the canary.

## Launch gate

Public replacement launch requires all 448 currently published sermon candidates to have one reconciled speaker, an approved description, approved transcript, valid 5–10 approved ordered Q&A pairs, required metadata and controlled media. The five pending rows remain private/unpublished, require separate approval before any future publication, and do not block public launch. The three WordPress drafts remain excluded. This supersedes the earlier 453/453 launch wording without changing the 453-row migration inventory. Missing details are reported only with approved anonymised source WordPress IDs and safe requirement codes.
