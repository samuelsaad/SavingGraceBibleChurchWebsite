# Project Decision Log

**Status:** Approved decisions through D-132; official YouTube three-pilot comparison complete with one private manual-review result on 19 August 2026
**Authority:** `church-website-architecture-plan.md` plus Yang’s confirmed migration decisions and Samuel Saad’s recorded project-owner decisions

## Evidence classifications

All source-comparison findings use exactly one of:

- `database observed`
- `source confirmed`
- `source and database confirmed`
- `provisional due to source version difference`
- `unresolved`

The live MariaDB database is authoritative for stored production data. The exact installed parent and Pro directories supplied on 5 August 2026 are authoritative for intended plugin behaviour at that snapshot; source registration does not prove that a field or option is populated.

## Approved migration decisions

### D-001 — Sermon date meaning

**Decision:** WordPress local `post_date` represents the date preached and maps to PostgreSQL `sermons.service_date` using its exact local calendar date.

**Rules:**

- Preserve the exact date; never move it to the nearest Sunday.
- Preserve original local/GMT/modified WordPress timestamps and source post ID.
- Flag every included sermon whose `service_date` is not Sunday.
- Continue importing a flagged record unless another validation error requires rejection.

**Current result:** Four included sermons are non-Sunday: four published and zero pending. The three excluded drafts are also non-Sunday but do not enter the migration set. (`database observed`)

### D-002 — Advanced Sermons inclusion scope

**Decision:**

- Include every published `sermons` record.
- Include a pending `sermons` record only when `TRIM(post_title)` is nonempty; preserve it as unpublished/pending.
- Exclude blank-title pending records.
- Exclude every draft.
- Record every exclusion with source ID, source status, and reason; never modify WordPress.

**Current result:** 448 published + 5 titled pending = 453 included. Zero blank-title pending and three drafts are excluded. (`database observed`)

### D-003 — Legacy sermon systems

**Decision:** Exclude all three `wp_sb_*` tables and all 12 sermon-like records in `ctc_sermon`, `wpfc_sermon`, and `wpv_sermon`. Do not expose them in the replacement public or admin sermon collections. Keep their existence documented; do not delete or clean them from WordPress.

**Evidence:** The rows/tables exist in the live database. (`database observed`)

### D-004 — Scripture conflicts

**Decision:** Preserve passage postmeta and `sermon_topics` taxonomy values independently with source provenance. Support multiple references, store a separate normalised display value, and reconcile only when normalisation is demonstrably safe and reversible.

**Current review set:** 36 published conflicts plus 13 published one-source-only records. (`database observed`)

### D-005 — Media normalisation

**Decision:** Convert YouTube and SermonAudio data into provider-specific records containing validated identifiers and canonical URLs. Preserve original values in controlled audit input, never render imported iframe/embed HTML, and generate accessible application-owned embeds. Media and resource relationships remain nullable.

**Evidence:** Live data has 324 populated YouTube values and 424 SermonAudio embeds; PDF, bulletin, featured-image, and other sermon resource fields are unpopulated. (`source and database confirmed`)

### D-006 — Exact installed plugin source snapshot

**Decision:** Use the statically inspected installed directories as the source snapshot for intended production plugin behaviour. Advanced Sermons is version 3.7. Advanced Sermons Pro is version 2.2 and is an add-on that requires `advanced-sermons/advanced-sermons.php`. (`source confirmed`)

**Snapshot identity:** The parent contains 69 files totalling 673,389 bytes and has deterministic aggregate SHA-256 `766fc92d041ea3c031bbf48af023c7ca3d3a77c39cae288d437d1a6565fc23f5`. Pro contains 31 files totalling 150,444 bytes and has aggregate SHA-256 `a753c8c594669c7363ade57934cc0a26649bd3414c6f94068acb5d7cd2bdd361`. Each aggregate hashes the sorted sequence `relative-path<TAB>length<TAB>file-sha256`; no plugin file or licence value is copied into the repository. (`source confirmed`)

**Earlier ZIP comparison:** The installed Pro has the same name, version, 31-file/150,444-byte expanded shape, and inspected behaviour as the earlier Pro 2.2 ZIP. No semantic difference was found. The earlier ZIP is no longer present, so byte-for-byte identity with its recorded archive hash cannot be re-proven and remains `unresolved`.

### D-007 — Production safety

**Decision:** MariaDB remains strictly read-only. `PROCESS`, `EVENT`, and `TRIGGER` are an accepted temporary grant exception but may not be used. No production migration, deployment, WordPress mutation, PostgreSQL production object, cloud infrastructure, or external account is authorised.

### D-008 — Legacy view counters

**Decision:** Preserve all 453 `post_views_count` values in private migration-audit storage, not on the public/runtime `sermons` row. Public API contracts must not expose them, and public display remains disabled until Yang makes a separate product decision. (`source and database confirmed`)

### D-009 — Legacy filter compatibility

**Decision:** Preserve the observed direct-request behaviour: filters across series, speaker, passage, and book combine with `AND`. The installed parent source has a contradictory AJAX-prepared branch that combines taxonomy clauses with `OR`; this is treated as an implementation defect and is not reproduced. Legacy date values use `YYYY-MM-DD - YYYY-MM-DD`, inclusive endpoints, against WordPress local `post_date`. (`source and database confirmed`)

## Local implementation decisions

These decisions fill gaps not prescribed by the architecture while preserving its required Astro/TypeScript/PostgreSQL boundaries. They are local and reversible.

### D-101 — Application structure

Use one Astro TypeScript project with explicit `domain`, `application`, `server`, `api`, and `migration` modules. Public/API routes may share a deployable application, but database access and privileged logic remain server-only. The AWS adapter/runtime remains unresolved and is not selected in this milestone.

### D-102 — SQL-first PostgreSQL migrations

Use ordered, reviewable SQL migration files and a typed Node PostgreSQL repository boundary. Do not introduce an ORM-generated schema during the migration proof: explicit SQL is needed for constraints, many-to-many relationships, full-text search, GIN indexes, audit tables, and migration idempotency.

### D-103 — Validation and tests

Use Zod for runtime request/import validation and Vitest for deterministic unit/contract tests. Use anonymised fixtures only. Real production rows are not copied into the repository or a shared/public environment.

### D-104 — API milestone boundary

Implement stable TypeScript/Zod contracts and server handlers/services for public sermon list/detail/search/filtering and protected admin lifecycle operations. Milestone 2 adds the PostgreSQL public repository and framework-independent HTTP handlers. Cognito verification and all mutation routes remain deferred. The final AWS runtime and Astro production adapter remain pending deployment decisions.

### D-105 — Disposable local PostgreSQL integration

The only authorised local write target is `savinggrace_sermons_test` on `127.0.0.1:5432`. The application safety gate and real integration suite enforce that exact database, port, loopback host, and explicit write opt-in. PostgreSQL 16.14 apply, fixture rerun, repository/API behavior, rollback, clean reapply, and final reload all passed. This local evidence does not authorise or select any production database/runtime.

### D-106 — Superseded provisional three-role editorial foundation

The `admin`/`editor`/`contributor` model was used only for the completed provisional Phase 3 foundation. Yang's final decision D-111 supersedes it. Editor/contributor roles, ownership restrictions, and role-switching behaviour are no longer active application concepts.

### D-107 — Superseded archive-only removal and retained explicit transitions

Phase 3 intentionally deferred permanent deletion. D-112 now authorises safeguarded deletion from `archived` only. The explicit submit, withdraw, schedule, publish, unpublish, archive, and restore operations remain approved; direct status patching remains forbidden. Restore returns an archived sermon to draft. A future schedule must be strictly later than the service clock. First publication sets `published_at`, while later unpublish/archive/restore/republish operations preserve it.

### D-108 — Provider-independent identity boundary

Repository and application services accept a verified provider-independent identity without Cognito dependencies. The local loopback harness has one explicitly enabled deterministic non-secret admin identity and no credentials. It is unavailable for non-loopback requests or a production runtime. Arbitrary subject/role headers do not alter the allowlisted identity. Cognito claim verification and the explicit administration-access grant remain a future adapter and must not weaken service policies.

### D-109 — Phase 3 database delta

Add ordered migration `0002_admin_foundation.sql`: nullable sermon creator/updater subjects, ownership index, optimistic row versions on managed speaker/series/book taxonomy definitions, provisional audit roles, and a constrained audit outcome. Imported rows remain null-owned. The migration has an independently tested down migration and the complete `0001`-`0002` set rolls back and reapplies cleanly on the exact disposable PostgreSQL 16 target.

### D-110 — Permanent whole-site SEO non-regression gate

The owner confirms that the existing website performs well in organic search. Preserve those signals at minimum across the entire website, not only sermons; improve technical SEO only when safely validated. Maintain a complete one-to-one legacy/target URL inventory, preserve indexable paths and content/metadata signals, use direct reviewed 301s for unavoidable changes, render primary content server-side, control canonicals/duplicates/indexability, validate sitemaps/robots/structured data/internal links/performance, correct the known staging-origin social-image defect, and monitor Search Console after launch. Ranking improvement is not guaranteed. Production launch is blocked unless the acceptance gates in `seo-migration-validation-plan.md` demonstrate parity and every material exception is approved.

Fresh production crawling and Search Console/analytics access are not authorised by this decision. They require a later explicitly approved read-only discovery task. Until then, existing sermon URL/canonical/social evidence seeds the plan and the whole-site baseline remains unresolved.

### D-111 — Final single-administrator authorization model

Yang approves one active administration access level: `admin`. Approved administrators may view and edit every sermon state, manage relationships and controlled media, perform every valid editorial transition, manage taxonomy definitions, view audit history, and invoke safeguarded permanent deletion. Editor/contributor roles, contributor ownership restrictions, role simulation, and multi-role dashboard controls are removed. Unknown, unauthenticated, and merely authenticated-but-unapproved identities remain denied by default. The future identity adapter must explicitly grant administration access rather than treating every authenticated identity as an administrator.

### D-112 — Safeguarded permanent deletion and mandatory SEO disposition

Permanent deletion is allowed only from `archived` through a separate explicit operation requiring exact slug/title confirmation, the current row version, and a short reason. The repository transaction writes a minimal non-content tombstone and safe audit event, records the required redirect or gone disposition for any previously published URL, then deletes the sermon and cascade-owned content/relationships/provenance. The tombstone retains actor, action, former identifier/slug, timestamp, reason, and disposition only. It must never retain deleted title/body/media/private provenance, credentials, or secrets. Previously published paths must never silently fall through to an unmanaged 404.

### D-113 — Local Phase 3B dashboard boundary

Build the administration dashboard with the existing static Astro/TypeScript stack and portable admin routes. The local Node harness serves the built `/admin` SPA only on loopback with a development-only admin identity, no remote calls, no production adapter, and explicit `noindex`/security headers. Service handlers remain authoritative for authorization, lifecycle validation, concurrency, transactions, media safety, redirects, and deletion.

### D-114 — Final one-speaker sermon model

Yang's final decision is exactly one speaker per sermon. A new draft or included historical row may temporarily have null `speaker_id` only while incomplete; schedule, publish, and historical launch readiness require it. Migration `0004_sermon_enrichment_readiness.sql` transactionally refuses any existing local sermon with more than one former join row and reports affected sermon UUIDs. The importer never chooses a speaker from a multi-speaker source anomaly: it leaves the target null and records a structured error warning plus safe audit evidence. Series remains many-to-many. This decision supersedes every earlier many-speaker runtime proposal. (`approved decision`, locally verified on PostgreSQL 16.14)

### D-115 — Transcript, Q&A, and exact historical launch gate

Every included historical sermon requires a complete approved plain-text transcript and 5–10 consecutively ordered, nonblank, all-approved question-and-answer pairs before launch. This covers all 453 records: 448 published and five titled pending; pending remains non-public. The three drafts, `wp_sb_*`, and 12 older-plugin posts remain excluded. New incomplete sermons may be saved but cannot schedule or publish. Readiness also requires the sole speaker, existing required metadata, and valid controlled media. The launch CLI must fail unless included/speaker/transcript/valid-Q&A counts are exactly 453 and incomplete is zero, reporting only safe source WordPress IDs and missing requirement codes.

Approved transcript/Q&A text participates in public search only at weight D. Public detail renders it server-side in initial HTML; the transcript is closed by default with native `<details>`, while list responses omit heavy bodies. No FAQ structured data is inferred. Deterministic queue and strict draft bundle contracts support idempotent local enrichment, but imported/generated drafts always require recorded human approval. No external provider or real production enrichment is approved by this decision.

### D-116 — Guided six-step administration workflow

The dashboard usability failure is treated as a product defect. The approved workflow is: sermon basics; speaker and scripture; media; full transcript; questions and answers; review and publish. It includes an anonymised-local-data notice, plain state descriptions, aggregate progress, issue filters, per-sermon checklist, field/empty-state guidance, obvious actions, and accessible responsive/concurrency/validation/unsaved-change feedback. Internal migration/database terms remain outside normal editing screens.

### D-117 - Approved sermon description required for every sermon

`sermons.summary` is the canonical visible sermon description; no duplicate description, blurb or generic metadata field is introduced. Administration labels it **Sermon description**. It uses missing, draft, in-review and approved states with bounded plain text, provenance, lifecycle timestamps, reviewer/approver subjects, optimistic row-version protection and material-change audit coverage. Existing nonblank summaries migrate as drafts and are never silently approved. Only approved descriptions are public, included in weight-C search or readiness. Approved text is 80-2,000 characters; approximately two to four useful sermon-grounded sentences is guidance, not a mechanical rule.

`seo_description` is a separate optional controlled 1-320 character override for metadata/social tags. When absent, the approved visible description is the deterministic fallback. The public SSR shows the complete description uncollapsed below title/core metadata and before media, transcript and Q&A. The publication gate and exact historical gate require approved descriptions; production needs 453/453 and zero incomplete. None of the 453 real descriptions is complete or approved under this milestone. Migration `0005_approved_sermon_descriptions.sql` and its independent rollback/reapply are locally verified. (`approved decision`, locally verified on PostgreSQL 16.14)

### D-118 - Phase 3B.2 private caption pilot boundary

The approved rehearsal is exactly three explicitly mapped local YouTube Studio text exports. Video identity is the allowlisted 11-character ID; playlist/tracking parameters have no identity effect. No video/audio download, speech-to-text, caption mutation, external provider, paid API, WordPress, AWS or production contact is permitted. Preparation may remove timestamp-only lines and exact adjacent overlap, normalise whitespace and capitalise existing boundaries, but must preserve the retained word sequence. Boundary-free or unreliable exports fail for manual attention rather than receiving guessed punctuation or invented content.

All successful outputs import as private drafts with structured source hash/filename/language/track-type/attribution, processing evidence, warnings and mandatory human accuracy review. Differing imports cannot replace approved descriptions, transcripts or Q&A. The pilot result does not authorise the remaining 450 sermons or Phase 3C. (`approved decision`, locally exercised against PostgreSQL 16.14)

### D-119 - Phase 3B.2b punctuation-only hardening boundary

The provisional offline completion path is limited to exactly the two records that the committed Phase 3B.2 outcome identified as `manual_punctuation_required`; it rejects the already-successful record and every unknown record. Trusted source state defines identity. Playlist and tracking parameters do not change the canonical 11-character video identity.

Source and cleaned text are normalised to Unicode NFC and tokenised independently on whitespace. Unicode punctuation is removed from within each token and the remaining text is case-folded; the resulting token count, boundaries, order and content must match exactly. Only punctuation, capitalisation and paragraph/line-break formatting may change. Stable non-overlapping chunks carry exact source ranges and source/output hashes, and deterministic whole-sermon reassembly is revalidated before any persistence. No-clobber paths, retained uncertainty/provenance, structured failures, exact-two scope and comprehensive fail-closed verification are mandatory. The authorised exact-two private processing and idempotent import completed with both sermons retained as drafts. Later administrator actions approved their content and completed their guided reviews without publishing them. Samuel Saad subsequently accepted the bounded pilot under D-129. (`approved implementation contract; administrator review and bounded pilot acceptance completed later`)

### D-120 - Fail-closed schema migration journal

Canonical local schema migration uses a runner-owned `schema_migrations` journal that is distinct from source/content migration records and draft-import receipts. Each ordered migration identity is bound to a deterministic SHA-256 checksum of its Unicode/line-ending-normalised paired up/down SQL definitions. The runner holds a PostgreSQL advisory lock around planning and execution, requires the stored receipts to be an exact canonical prefix, applies only the pending suffix, and records DDL plus its receipt in the same transaction. A matching rerun is a no-op. Rollback removes only matching latest receipts transactionally with their down SQL while preserving the standalone rollback files.

Unknown, changed, missing, duplicate or reordered receipts fail before apply or rollback. Existing application objects without the trusted journal also fail; the runner never infers or auto-baselines prior history. The existing exact disposable-database and explicit write-opt-in gates remain mandatory. (`local implementation decision`)

### D-121 - Guided imported-sermon review is distinct from lifecycle editing

Imported enrichment drafts use a dedicated six-stage administrator route: identity/provenance, typed flagged items, complete transcript, sermon description, ordered Q&A and final review summary. Only one stage is shown at a time. Technical provenance is collapsed; unresolved epoch service dates render blank; transcript and Q&A editors remain readable at supported desktop widths and 200% zoom. Every editorial decision has an explicit action, optimistic row version and safe audit event. Viewing, navigation and draft saving never imply approval.

Migration `0007_guided_sermon_review.sql` adds only private structured progress and typed caption/name/Scripture review items. Missing, rejected or deliberately unresolved item decisions block transcript approval; a transcript text change invalidates earlier transcript-bound decisions. Completing the workflow records completion only while the sermon remains draft/private and all content gates pass. The route intentionally has no submit, schedule, publish, archive or deletion controls. D-121 supersedes D-116's all-in-one editor only for imported enrichment review; the general sermon lifecycle editor remains available for other authorised administration. (`approved local implementation decision`)

### D-122 - Every private source finding is an atomic administrator decision

The six aggregate prompts created by migration `0007` do not preserve the 86 detailed private findings and cannot count toward review completion. Migration `0008_atomic_sermon_review_items.sql` adds deterministic collision-checked identities, trusted record/category ordinals, private finding detail and paragraph references, transcript content hash/version expectations, and an exact ordered identity-set commitment. The two authorised records require exactly 42 and 44 pending atomic rows. Their combined category remains `name_or_scripture_reference`; automation must not infer a more specific name-versus-Scripture classification.

Aggregate warning codes remain informational provenance only. Each atomic item requires its own explicit accepted or corrected outcome; resolving one never resolves a sibling. Missing, extra, duplicate, reordered, pending, stale or identity-mismatched rows block the stage and final completion. Direct correction is available only when an exact transcript phrase is truthfully attached. Assembly, restoration and import are no-clobber, deterministic, fail-closed and idempotent, and no review decision or approval is created by them. The 17 August 2026 read-only reconciliation found all 86 current items explicitly decided: 76 accepted and ten corrected, with exact administrator audit attribution and none pending, unresolved or rejected. (`approved local implementation decision; administrator decisions completed later`)

### D-123 - Confirmed speaker and Protestant Bible reference catalogues

The local application reference catalogue contains exactly the seven confirmed speakers Binoy Joseph, Matthew Johnston, Nathan Vella, Ralph Gambardella, Rodney Hole, Wesam Saad and Yang Yu, plus the exact 66-book Protestant Bible canon in canonical order with 39 Old Testament and 27 New Testament books. Speaker and canonical classification UUIDs are deterministic; canonical book IDs and order are 1 through 66. Supported names, slugs, abbreviations and aliases resolve through one collision-checked normaliser.

This is idempotent reference data, not a new schema version: migrations `0001` through `0008` remain unchanged. Seeding never assigns a speaker or book to a sermon, never imports legacy term counts, and never treats stored counts as current truth. Administrator counts are derived as distinct non-deleted sermon relationships; public counts are separately derived from complete published sermons only. Guarded rollback refuses partial, changed or referenced catalogue state. (`approved local implementation decision`)

### D-124 - Exact editable finding wording and unresolved-only queue

Stage 2 uses each atomic finding's ordered supporting-paragraph identities to display the actual associated cleaned-transcript wording in an editable field. A correction requires an exact current-wording echo, current transcript hash/version, item/review/sermon row versions, nonblank materially changed wording and unchanged paragraph boundaries. The transaction stores original and corrected wording, administrator identity and time, updates only the associated transcript paragraphs, marks only that item corrected, advances every item to the new transcript version without resetting sibling decisions, and appends a non-content audit event. Missing, duplicated, ambiguous or stale associations fail without a partial write.

The ordinary queue contains unresolved items only. Accept and correct remove one item immediately and advance to the next unresolved item; previous/next navigation cannot return to resolved items. Resolved items remain in a separate read-only history. The final item shows Stage 2 completion but never approves transcript, description, Q&A or sermon. This refines D-121/D-122: a full transcript edit still invalidates prior transcript-bound decisions, but the exact per-finding correction transaction preserves unrelated sibling decisions. (`approved local implementation decision`)

### D-125 - Whole-site replacement, production direction and 448-candidate launch gate

The project replaces the complete WordPress church website; WordPress remains live until authorised cutover. Continue the custom Astro/API/PostgreSQL architecture. The preferred direction is a statically generated Astro public site separated from a protected administrator/API/PostgreSQL environment. Remote production administration supports Samuel and Yang or another authorised church administrator with individual attributable identities and MFA. The exact identity provider and other AWS services/pricing remain undecided, superseding prior Cognito-specific production selection; aim below A$70/month where practical and avoid NAT gateways, Fargate, RDS Proxy and Multi-AZ unless evidence later justifies and approval authorises them. There is no fixed launch month, and frontend/whole-site development may proceed while sermon review continues.

Public launch requires all 448 currently published sermon candidates to pass the reviewed description/transcript/5–10-Q&A/speaker/metadata/media gate. The five pending sermons remain unpublished unless separately approved and do not block public launch. The three WordPress drafts remain excluded. This supersedes the 453/453 launch requirements in D-115 and the launch-count portions of D-117; it does not alter the 453-row migration inventory or authorise publication of pending rows.

The replacement requires a whole-WordPress inventory and preserved verified slugs/URLs. Bulk migration is repeatable extract/rehearse/delta/no-clobber work with explicit speaker reconciliation; production migrations are forward-only with backup/restore. Atomic findings, private provenance, audit history, migration checksums and draft isolation remain. Dormant resource/media structures stay unless proven harmful. Scheduling controls remain hidden until a real worker exists, static `health.json` is build information rather than runtime health, and social content, thumbnails, audio metadata, extra resources and advertising remain future backlog. (`approved architecture direction`)

### D-126 - Local public sermon discovery and deterministic related results

The local public sermon vertical slice preserves the existing PostgreSQL/API boundaries and adds a server-rendered archive, stable nine-item pagination, legacy-compatible keyword/speaker/series/passage/book/date filters, active-filter and empty states, the existing approved-only detail enrichment, a sermon-only sitemap, and stored redirect/gone handling. Search/filter pages are functional but non-indexable; no dedicated crawlable taxonomy landing pages are invented before the canonical/indexability allowlist is approved. The production Astro adapter remains undecided.

Related sermons use published/non-deleted metadata only: shared series 100, exact or overlapping Scripture 70, same approved canonical Bible-book classification 35, and same speaker 15. Results exclude the current sermon, omit zero-score/private candidates, deduplicate by candidate, limit to three, and tie-break by score, service date and stable ID. The current schema provides neither a curated override nor an approved topic lifecycle, so neither is invented.

This is an interim metadata-based baseline, not description-based semantic similarity, and it must not be labelled **Related themes**. A future **Related themes** score is explicitly deferred and, if separately authorised, must use approved public sermon descriptions only; Scripture, title, series, speaker, topics and all other metadata must not influence that score. Scripture-based recommendations may remain as a separate clearly labelled feature such as **More on this passage**. (`approved local implementation decision; isolated PostgreSQL 16 integration verified; production runtime remains gated`)

### D-127 - Description-only Related themes foundation

The semantic recommendation mechanism is separate from keyword/structured search and D-126 metadata recommendations. Its only model input is the exact approved public `sermons.summary`; title, Scripture, canonical book, speaker, series, topics, body, transcript, Q&A, dates, keywords, synonyms and all other metadata are excluded from embedding and scoring. Metadata may be displayed only after neighbour identities are selected. `Romans 8` and every other visitor query remain on the existing PostgreSQL keyword/structured-reference path.

Use a model-independent symmetric document interface, L2-normalised float32 vectors, exact pairwise float32 cosine comparison and private precomputed relationships. Do not add pgvector, ANN indexes, quantisation, client vector files, an embedding endpoint or a provider runtime. One shared database eligibility view governs generation, persistence and retrieval. Description/status/approval/deletion changes remove inbound and outbound relationships, reads revalidate both current hashes, and a full rebuild replaces stale state even for an empty corpus. Every build retains complete pipeline/model/tokenizer/corpus/policy provenance and remains quality-pending until a later human gate; the public API and renderer remain unwired. No approved local model exists, so only synthetic fixed-vector mechanics are authorised. (`approved offline foundation; not quality-approved or production-authorised`)

### D-128 - Locked external model for synthetic-only local verification

Acquire only MIT-licensed `BAAI/bge-small-en-v1.5` at immutable revision `5e62ea33e012fda8c02802b906664c915ebd1bb1`, using the unquantised ONNX artifact with approved SHA-256 `828e1496d7fabb79cfa4dcd84fa38625c0d3d21da474a00f08db0f559940cf35`. Keep every model file outside Git and address the exact revision directory only through `DESCRIPTION_EMBEDDING_MODEL_ROOT`.

Use only integrity-locked `@huggingface/transformers@4.2.0`, with lifecycle scripts disabled at installation. The server-only adapter disables remote models and caches, requires local files, CPU/FP32, feature extraction, CLS pooling, L2 float32 output, 384 dimensions, the model-configured 512-token limit, no prefixes and deterministic batching. Migration `0012` adds immutable model revision and exact runtime identity/version/integrity to build provenance and therefore the pipeline fingerprint. Only fictional synthetic acceptance text is authorised; the adapter remains unwired from public routes and real build execution. (`approved local acquisition and synthetic integration; not human-quality-approved, public or production-authorised`)

### D-129 - Explicit bounded acceptance of the Phase 3B.2 three-sermon pilot

On 17 August 2026, Samuel Saad explicitly accepted the Phase 3B.2 three-sermon pilot as successfully completed. The accepted result demonstrates that the local private workflow can import existing caption files, prepare readable transcripts, generate description and Q&A drafts, support detailed administrator review and corrections, record explicit approvals and audit evidence, and keep all content private until publication is separately authorised.

This acceptance applies only to the completed three-sermon pilot. It does not authorise processing any of the remaining 450 sermons; publishing the three pilot sermons; enabling **Related themes** publicly; accepting semantic recommendation quality; deploying or accessing production; or beginning Phase 3C. It is an explicit tracked human decision, not a database approval action and not authority for any later batch or public operation. (`explicit project-owner acceptance; documentation-only record`)

### D-130 - Bounded official YouTube pilot-caption proof

The official YouTube Data API proof is restricted to the three accepted pilot video identities hard-coded in the server-only local command. Owner OAuth forces fresh account selection and retains its protected out-of-repository token only after all three pilots resolve to one common owner channel and the authenticated `mine` channel is exactly that owner with the expected church-channel title. The tool implements only channel/video/caption read calls, disables retries, has no arbitrary video argument and cannot write to YouTube.

Track selection admits only serving, non-draft English tracks explicitly associated with primary audio, preferring one standard track and otherwise one ASR track; equal best-priority tracks are ambiguous and block retrieval. The 19 August 2026 inspection found exactly one serving, non-draft English ASR track per pilot, but every track reported `audioTrackType` as `unknown`. All three therefore produced `no_eligible_track`. No caption download, Studio-export read/comparison, database access, content generation, evaluation-batch processing, publication or deployment occurred. Treating `unknown` as `primary` is not authorised by this decision. (`explicitly authorised official-API proof; metadata inspection completed; retrieval stopped fail-closed`)

### D-131 - Three-pilot-only unknown-audio fallback and wording-review stop

For only the three already allowlisted pilots, an `audioTrackType` of `unknown` is eligible when the video has exactly one caption track in total and that sole track is English, serving, non-draft, unambiguous and either standard or ASR. Private provenance must record `audio_track_type_unverified` and must not claim that YouTube confirmed primary-audio association. Descriptive, dubbed, unexpected-audio, failed, draft, non-English, unsupported-kind and ambiguous tracks remain rejected. This amendment does not apply to another video or evaluation batch.

Reinspection selected all three sole ASR tracks with the required warning. The first exact VTT was privately retained without translation. Standards-compatible parsing and exact rolling suffix/prefix normalization across YouTube's contiguous cue boundaries reduced segmentation repetition; repetition across a positive timing gap remains untouched. The normalized official sequence contained 7,262 words versus 7,265 in the Studio export and did not match, with 45 common leading and 158 common trailing words. The proof stopped for manual review without exposing the differing wording. The other two pilots were not downloaded or compared. (`explicit project-owner amendment; first-pilot wording gate failed; no further retrieval authorised by this run`)

### D-132 - Independent completion and deterministic alignment of the three-pilot caption proof

Samuel Saad explicitly superseded only D-131's global stop-on-first-difference behavior. For the same three hard-coded pilots, a substantive difference or per-video failure must be recorded separately without preventing retrieval/comparison of the other authorised pilots. Global authentication/channel/credential, allowlist and private-storage failures still stop the command. This decision neither accepts a caption source nor extends authority to another sermon or operation.

Comparison version 3 applies the same Unicode NFKC, locale-stable case, punctuation/symbol and whitespace normalization to both sources, then uses deterministic full-sequence Hirschberg/Levenshtein alignment. All three exact untranslated VTT responses were retained in ignored private storage. All three tracks remained sole English serving non-draft ASR tracks with `audio_track_type_unverified`; YouTube-confirmed primary-audio association remains false.

Two pilots produced `normalized_exact_match`: 5,402/5,402 and 5,685/5,685 normalized words respectively, with zero aligned changes. The remaining pilot produced `differences_detected_manual_review_required`: 7,260 official versus 7,263 Studio normalized words, 7,182 matches, 28 insertions, 31 deletions and 50 substitutions, totalling 109 changes across 87 regions, a largest region of three, 1.500757% WER and 98.499243% normalized similarity. Its aligned passages and cue references are confined to one ignored private human-review artifact. No automated result decides which source is correct or constitutes administrator approval. (`explicit project-owner amendment; independently completed official-API proof; one manual-review result remains`)

### D-133 - Phase 3B.2c Wave 1 private evaluation boundary

The representative evaluation uses a deterministic private selection of 36 primary records and 12 predetermined alternates. Metadata mapping and caption-availability inspection covered those 48 records, but execution authority covered only the 12 resolved Wave 1 positions. All 12 primaries were available; no alternate was used. Records reserved for later waves were neither downloaded nor processed, and their inclusion in the private manifest is not future execution authority.

The official YouTube Data API caption provenance is recorded by migration `0013_official_youtube_caption_provenance`, which adds `authorised_youtube_data_api` while preserving `authorised_youtube_studio_export` and rejecting other values. Samuel Saad explicitly authorised retaining already-applied local migrations `0011`, `0012` and `0013` in only `savinggrace_sermons_test`. Read-only verification found the exact journal through `0013`, no later migration, and zero semantic eligibility, build or relationship rows. Migrations `0011` and `0012` therefore added structure only; no embedding or semantic relationship was generated.

Wave 1 imported exactly 12 transcripts, 12 descriptions and 84 ordered Q&A items as private unapproved drafts from already-prepared ignored material. The import retained official-API provenance, source hashes, uncertainty and warning evidence, including `audio_track_type_unverified` for every record. An identical second import returned unchanged for all 12. No approval marker, administrator-complete record, public-search candidate, semantic eligibility row, embedding or relationship was created.

Administrator review is now the only authorised next action for these 12 records. This decision does not accept transcript/content quality, administrator workload or semantic recommendation quality; authorise Wave 2, Wave 3, another sermon, embeddings or Related themes; or permit approval by automation, publication, production access, deployment, a Git push or Phase 3C. (`explicit bounded execution and migration-retention authority; Wave 1 ready for human review`)

### D-134 - Repair uninitialised Wave 1 guided-review expectations without content changes

The Wave 1 importer created the 12 private draft review rows after migration `0008` had replaced the earlier review seeding function, so the six atomic expectation fields remained null. The dashboard therefore reported four simultaneous integrity failures for every Wave 1 review set: source identity, expected item count, expected item identity set and transcript version. The underlying 12 transcripts, 12 descriptions, 84 Q&A items, provenance hashes, warnings, uncertainty markers and privacy states remained present and unchanged. There were no content decisions, approvals, review completions or zero-finding acknowledgements; one genuine identity confirmation and its Stage 2 position were preserved.

The authorised repair is limited to the exact 12 rows identified by the Wave 1 processing version. It derives a stable private source key, the cryptographic identity of the empty item set and the existing transcript hash/version, then fills only the previously all-null expectation fields. It creates no atomic finding because the stored sources contain zero unresolved markers, does not change current stage or administrator attribution, does not touch any sermon/transcript/description/Q&A/provenance body, and records one safe system audit event per repaired review. The command fails closed on an unexpected database, migration ledger, scope, content/provenance state, administrator decision or semantic/public state and is idempotent.

Post-repair application verification found all 12 review sets valid, with explicit zero-item acknowledgement available on all 12. The one confirmed identity remains ready at Stage 2; no zero-item acknowledgement or later-stage completion was manufactured, and all later stages remain locked. All 12 remain private, unapproved and absent from public search; semantic eligibility, build and relationship counts remain zero. (`explicit local metadata-only repair authority; genuine administrator review still required`)

## Decisions still required

- Final AWS runtime/adapter and production networking.
- Whether privately retained legacy view counts should ever be displayed publicly.
- Church approval of any term merge/reclassification and the 49 scripture reconciliation cases.
- Whether the replacement should provide JavaScript live filtering after the server-rendered/no-JS path is accepted; the legacy AJAX branch is inconsistent and was observed not to refresh reliably.
- Approved runtime secret-provider integration before any future upgrade from `pg` 8 to `pg` 9, whose automatic `pgpass` support is deprecated.
- Explicit read-only approval and access method for the fresh whole-site crawl and church-owned Search Console/analytics baseline.
- Production canonical host/slash policy, any intentionally crawlable filter landing pages, and baseline-derived SEO performance/rollback thresholds.
- Human review and separate acceptance decisions for the 12 Wave 1 private drafts. D-133 grants no authority for Wave 2, Wave 3, another sermon, publication, public **Related themes**, semantic quality acceptance, production/deployment or Phase 3C.
