# Project Decision Log

**Status:** Approved decisions through D-157; public frontend preview remains private and local
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

### D-135 - Quarantine superseded Wave 1 generation and require grounded skill workflow

The deterministic Wave 1 description/Q&A generator is rejected as a content-quality failure. It ranked mechanically punctuated caption passages, inserted a generic description wrapper and paired a fixed seven-question set with transcript excerpts. All 12 descriptions and 84 Q&A items produced by `phase3b2c-wave1-extractive-drafts-v2` are defective generation evidence, not approvable drafts. Their original bodies and hashes remain in preserved private bundles; database provenance, warnings and audit evidence remain intact. Current database bodies with the superseded source reference cannot enter review or approval, and the dashboard identifies the quarantine. The old `process` command and preparation function fail closed.

Every future creation, regeneration, review or validation of transcript-grounded descriptions or Q&A must use the repository-scoped `sermon-enrichment` skill. The current approved transcript is the sole claim authority. A structured private result binds the transcript identity, SHA-256 and row version; records support ranges for every description paragraph and Q&A pair; rejects stale, unsupported, generic, fragmentary, excerpt-assembled or public/approved output; and preserves warnings and uncertainty for human review. Automated checks establish structure and recorded grounding only, never transcript accuracy, Scripture accuracy, theology, content approval or publication approval.

The separately authorised repair canary is limited to one stable source/application identity. Its replacement contains a 200-word description, seven Q&A pairs and 12 private support records. The atomic import changed only the untouched unapproved description and Q&A fields, retained the original bundle, preserved transcript/provenance/review/genuine-administrator/other-Wave-1 evidence, created no approval or public/search/semantic state, and returned unchanged on a second import. The remaining 11 description/Q&A sets stay quarantined. Human canary review is required before any request to regenerate another record. (`explicit bounded quality-repair authority; one private canary awaiting administrator review`)

### D-136 - Reviewed primary preaching passages remain separate from search and recommendations

Primary preaching passage is a reviewed relationship on the existing `scripture_references` model, not a replacement for imported Scripture metadata. Relationships distinguish `primary`, `supporting` and historic `unclassified` roles; a confirmed set has exactly one lead primary passage and may have additional co-preached or supporting passages. Title extraction creates only a pending private proposal with exact ignored evidence and parser provenance. Missing, malformed or multiple title references require manual review, and no proposal is an administrator decision. Samuel must explicitly confirm, correct, reject or confirm no primary passage with current row versions and attributable audit evidence.

Public Bible-passage search uses only confirmed `primary` coordinates and inclusive structured interval overlap. It remains an independent `AND` dimension beside PostgreSQL keyword/structured Scripture-topic search. Existing metadata-related sermons are unchanged, and description-only semantic **Related themes** remains unwired and publicly disabled. Parameterised passage results remain `noindex, follow` with the archive canonical; no crawlable verse-page system or unsupported structured data is created. Migration `0014_primary_preaching_passages` is the bounded local schema change, and preparation is restricted to the three accepted pilots plus 12 Wave 1 records selected by their exact existing processing versions. (`explicit local implementation direction; administrator confirmation remains required`)

### D-137 - Bounded official-title evidence repairs only current Wave 1 passage proposals

The official title read is one retry-disabled YouTube Data API `videos.list` request with `part=snippet` for exactly the 12 fixed Wave 1 video identities. It reuses the previously verified protected owner token and recorded common church-channel identity, accepts no arbitrary identifier and calls no other endpoint. Exact UTF-8 title, video/channel identity, retrieval time/version and SHA-256 evidence are retained only in one ignored private artifact; descriptions, tags, thumbnails and every unrelated snippet field are discarded. All 12 identities were returned by the common channel with no missing, duplicate, wrong-channel or manual-review result.

The local repair maps that evidence only to the 12 existing Wave 1 source identities, preserves the three pilot proposal records, rejects any administrator decision or unexpected prior state, and never changes display title or sermon/transcript/description/Q&A content. Eleven Wave 1 titles produced one valid pending primary-passage proposal each; one remained a pending no-reference outcome; none was ambiguous. The first run repaired 12 review records, the second preserved all 12, and there are now 14 pending proposals across the current 15 records, one pending no-reference outcome, zero confirmed passages and zero administrator decisions. Protected content, provenance, guided-review and privacy hashes remained unchanged.

The administrator list may filter proposed and confirmed primary passages by inclusive book/chapter/verse overlap and by explicit review state, and its Primary passage column must name the state. Public `/sermons/` passage search remains confirmed-only, independent from keyword/structured Scripture search, metadata recommendations and disabled description-only **Related themes**. Pending proposals remain private and absent from public results. (`explicit project-owner official-title and local metadata-repair authority; all 15 passage records still await administrator decisions`)

### D-138 - Administrator YouTube source links use reconciled stored identity

Administrator surfaces derive a nullable canonical YouTube source from the existing `sermon_media` relationship and private `sermon_enrichment_sources` provenance row. Every populated candidate must be an approved HTTPS YouTube URL form with a valid 11-character video ID, and all candidates for one sermon must agree. Missing evidence, an invalid candidate or conflicting IDs fails closed to no link; no identity is guessed. Playlist, tracking and timestamp parameters do not affect identity, and the rendered destination is always the canonical HTTPS watch URL.

The source action appears separately from the administrator sermon-record link on list, overview/edit and guided-review surfaces, including identity/provenance and primary-passage review. It uses descriptive accessible text, a visible external-link indicator, a new tab and `noopener noreferrer`. It never embeds or preloads YouTube and does not alter public pages. The bounded current-data check covers only the three pilots and 12 Wave 1 records; it grants no provider request, historical backfill, content processing, approval, publication or deployment authority. (`explicit administrator convenience implementation; current-15 read-only verification only`)

### D-139 - Generated-text mechanical proofreading and bounded current-15 repair

The current-15 quality diagnosis confirmed that the affected description and Q&A wording came from the retired `phase3b2c-wave1-extractive-drafts-v2` path. That command ranked and wrapped transcript sentences, applied only structural/length checks and did not invoke the repository-scoped `sermon-enrichment` skill or perform a final editorial proofread. The skill existed only for the later grounded replacement workflow; application code does not and must not claim to invoke an external Codex skill.

Generated descriptions and Q&A now pass an independent deterministic `generated-text-mechanical-qa-v1` gate before grounded import and before generated drafts can enter review or approval. Incorrect Jesus/Christ casing and obvious mechanical spacing, punctuation, sentence-start or join defects are blocking. Context-dependent uses of terms such as god, spirit and scripture, possible fragments and uncertain biblical-name spelling are retained as human-review flags rather than blindly changed. The skill checklist separately requires the same final proofread and records its safe outcome; neither layer decides meaning, Scripture accuracy, theology or approval.

The authorised current-15 command inspected exactly three accepted pilots plus 12 Wave 1 records. It corrected 13 indisputable capitalisation defects in unreviewed generated drafts across three sermons: 12 references to Jesus and one to Christ, affecting two descriptions and six Q&A pairs. No approved content was changed. One separate sentence-start finding and 15 context-dependent review flags remain unchanged for human judgment within already-quarantined Wave 1 material. Transcript bodies, source hashes, warnings, provenance, administrator progress, passage decisions, privacy, public-search state and zero semantic rows were preserved. The identical second run changed zero records. (`explicit bounded local draft repair; quarantine and human review remain`)

### D-140 - Description generation requires an identified approved generative model and has no extractive fallback

The `phase3b2c-wave1-extractive-drafts-v2` output was produced by `enrichment:wave1-process-local` through `wave1-process-cli.ts` and `prepareWaveOneContent`. It invoked no language model. The implementation mechanically punctuated caption words, ranked transcript sentences, surrounded selected excerpts with fixed generic opening/closing sentences and built a fixed seven-question set from nearby excerpts. Its checks enforced only broad field shape, character bounds and a small minimum answer length; they did not establish coherent synthesis, connected reasoning, subject/application fidelity or final editorial quality. The repository-scoped `sermon-enrichment` skill was not loaded or used by that run. All 12 Wave 1 descriptions and 84 Q&A pairs from the path are affected original outputs; one description/seven-Q&A set was later replaced through the separate grounded canary, leaving 11 descriptions and 77 Q&A pairs currently quarantined under the superseded reference.

The retired implementation has now been removed from current bytes, while the historical processing-version constant and private evidence remain. The entry point always fails closed. A provider-neutral `approved-description-generation-v1` boundary creates no candidate unless it receives an explicitly identified approved generator with provider, model, immutable revision and approval reference. It passes the complete approved transcript, complete versioned `sermon-enrichment` and grounding instructions, the 180–220 word requirement and final-proofreading safeguards. Model absence, invocation failure, malformed output or any gate failure returns structured manual-attention evidence with no draft and no transcript-excerpt fallback.

The mandatory description gate now rejects known wrappers, incomplete/caption-like sentences, overlong transcript-copy runs, repeated wording, abrupt joins, disconnected support, missing subject/reasoning/application grounding, unexplained verse fragments, unsupported detectable Scripture/theological claims and deterministic punctuation/spacing/capitalisation failures. These checks are safeguards rather than theological or editorial approval. The skill is version 1.2.0 and future private results must record the actual generator identity, prompt-policy/instruction hashes and approved transcript source hash.

No approved text-generation provider or model is configured in the repository. The locked BAAI model is an embedding model for the separate disabled Related-themes foundation and cannot generate descriptions. Therefore the newly requested single-description replacement was not generated or written: its current private unapproved draft, approved transcript, seven existing Q&A pairs, provenance, administrator evidence, privacy and publication state remain unchanged. A fresh bounded provider decision must name the generative service/model, immutable version, approval reference, privacy/retention terms, retry and cost limits before real content can be sent to or generated by it. (`explicit single-target repair authority; implementation failed closed because the required approved model integration is absent`)

### D-141 - Passage absence is a reviewed outcome and transcript grounding uses immutable identity

A canonical Bible-book classification or primary Scripture coordinate is not mandatory for every sermon. Passage review has three meaningful outcomes: pending, a structurally valid assigned primary passage, or an explicit administrator-confirmed absence of one. Pending remains incomplete. Book-only, book-and-chapter and full verse/range references are valid; verses require their parent chapter. An attributed `No single primary passage` decision satisfies readiness without creating Scripture metadata, while public passage fields and filters continue to use confirmed structured passages only.

Grounded descriptions and Q&A bind the transcript's immutable grounding revision and exact UTF-8 SHA-256. That revision rotates only when transcript bytes or source identity change. Approval metadata, passage decisions, generic row versions, review timestamps and saves in another generated content area do not create staleness. Legacy row-version references are usable only through migration-recorded compatibility evidence for the exact unchanged transcript hash and current grounding revision. Exact-hash repair is limited to private, unapproved, non-administrator-edited artifacts, preserves bodies and historical provenance, is idempotent, and creates no approval or publication state.

Migration `0015_optional_passage_and_grounding_identity` implements these rules. The bounded local repair recorded one explicit administrator no-primary decision and rebound one private description plus seven private Q&A pairs byte-for-byte; an identical rerun was unchanged. The current 15-record scan found no other eligible automatic repair. No transcript, approval, public/search/semantic state or external system was changed. (`explicit product/governance and bounded local-repair authority; human content review remains required`)

### D-142 - Legacy completed passage reviews require exact evidence before carry-forward

Migration `0015` correctly made an unresolved primary-passage decision incomplete, but legacy reviews completed before that gate could contain an unchanged structurally valid passage without a separate passage-decision row. Migration `0016_legacy_completed_passage_reviews` adds the forward rule: Stage 6 cannot finish with a pending passage decision, and a completed review cannot later be made passage-pending.

The bounded carry-forward is not a general auto-approval. It requires the exact current 15-record pilot/Wave-1 scope, completion before `0015`, intact transcript/description/Q&A/final-review decisions, one structurally valid lead primary passage, proof that the proposal existed unchanged through completion, and no later passage audit. Nine records met all conditions. Each gained a new `local-admin-0001` audit event under authorization `SAMUEL-LEGACY-PASSAGE-REVIEW-CARRY-FORWARD-2026-08-31`, while all original review actors and timestamps were preserved. Five later, changed or post-gate proposals remain pending and `Needs Work`; the existing explicit no-primary decision remains unchanged. The dashboard identifies carried-forward results as `Reviewed passage`, not as a newly performed confirmation. (`explicit bounded legacy-review carry-forward authority; no new content judgment or publication authority`)

### D-143 - First cohesive sermon frontend uses an authenticated private preview

The first cohesive sermon frontend reuses one server-rendered component system for the homepage, archive, detail, metadata-related sermons, search/filter controls, taxonomy browsing and controlled empty/error/private states. The approved description precedes media, transcript and Q&A. Complete approved transcript and Q&A text stays in initial HTML behind accessible native disclosures. YouTube is click-to-load through the privacy-enhanced host with no autoplay. Keyword/structured Scripture search, metadata-based **Related sermons**, and the disabled description-only **Related themes** foundation remain separate.

The 15 completed pilot/Wave-1 sermons remain private drafts. Their design preview is limited to loopback `/frontend-preview/`, requires a short-lived session issued through the existing local administrator identity, uses strict private/no-store/noindex headers, emits no canonical, social metadata, sitemap, feed or structured data, and is absent from the static production build. Both public and preview selectors independently require approved current content, controlled media and a reviewed primary-passage outcome; D-141's explicit no-primary outcome remains valid without an invented Bible-book classification. Lifecycle state alone cannot expose a sermon. This decision authorises no publication, staging, deployment, production access, external service, semantic generation, public **Related themes**, remote or Git push. (`explicit bounded frontend implementation and authenticated local-preview authority`)

### D-144 - Sermon archive separates compact search, recent discovery and trusted classifications

The sermon archive uses one compact primary row containing exactly Search, Speaker, Bible book and Series. Advanced filters remain a native disclosure with server-rendered state and browser-history restoration. Precise passage selection cascades Book → Chapter → Verse and remains separate from both keyword/structured Scripture search and metadata recommendations. Canonical chapter counts are checked in; because complete per-chapter verse counts are not, the UI exposes only verse values verified from eligible confirmed single-chapter primary-passage ranges while the server retains inclusive structured overlap semantics.

The unfiltered discovery view shows exactly three most recent full-description landscape cards. A URL-addressable expanded mode provides nine-item numbered pagination and hides discovery carousels, as does every search/filter result. Series discovery selects one latest eligible sermon per series deterministically. Topical discovery fails closed until an explicit administrator-approved topic lifecycle exists; neither absent primary passage nor unreviewed metadata is treated as topical. The public detail retains privacy-enhanced click-to-load YouTube but removes the separate website-owned outbound YouTube link; administrator source access is unchanged. All 15 preview records remain private drafts, and this revision creates no publication, semantic, staging, production or deployment authority. (`explicit bounded frontend revision; authenticated local-preview verification only`)

### D-145 - Compact recent cards and an explicit-scope canonical Bible picker

The three default **Most Recent Sermons** cards retain title, date, speaker, series, reviewed passage and detail access but use a five-line desktop/tablet description preview and adaptive compact sizing. The target is approximately half the prior desktop/tablet height, not a brittle fixed height: narrow layouts may expand, expose up to six description lines and must never clip metadata, the link or content. Expanded recent mode and ordinary result cards remain unaffected.

The precise-passage control is a progressive Books → Chapters → Verses tile picker backed by a checked-in count-only Protestant/KJV versification revision. It contains all 66 books in canonical order, 1,189 chapters and 31,102 verses, plus stable abbreviations and ten labelled colour categories. A single book/chapter activation reveals the next level without submitting; double activation and explicit controls search the whole book/chapter; a verse activation searches the exact verse. URL state records `book`, `chapter` or `verse` scope explicitly. Keyboard, touch, Back/Escape navigation, live announcements, focus movement, minimum target size and non-colour selected/applied markers are required behavior.

Passage results continue to use confirmed-primary inclusive interval overlap only. Keyword/structured Scripture search, the broad Bible-book filter, metadata-based **Related sermons**, and the publicly disabled description-only **Related themes** foundation remain separate. Scripture-shaped keyword searches such as `Romans 8` are not diverted to the picker. All current preview data remains private; this decision creates no content change, publication, semantic, staging, production or deployment authority. (`explicit bounded frontend revision; local canonical count data and authenticated private-preview verification only`)

### D-146 - Bible picker follows the approved flat three-grid visual reference

The supplied visual reference supersedes only D-145's picker presentation and ten-colour grouping. On desktop and tablet, Books, Chapters and Verses are aligned adjacent panels within one flat navigation surface. Each uses five equal columns where the 44-pixel minimum target permits, near-square tiles, two-pixel gaps, centred compact labels, restrained category colour and neutral blue-grey number tiles. Secondary colour-key and whole-book/chapter controls sit below the primary grids. Mobile and 200%-equivalent layouts progressively reveal one panel while retaining the same tile system.

The visual categories are Law/Pentateuch, History, Wisdom/Poetry, Major Prophets, Minor Prophets, Gospels and Acts, Pauline Epistles, General Epistles and Revelation. Dark selected state, a visible check, applied-state marker and keyboard focus remain distinct. Search scope, URL state, confirmed-primary interval overlap, single/double activation, reset behavior, explicit touch/keyboard alternatives and every separation from keyword search, broad book filtering, metadata recommendations and disabled semantic **Related themes** remain unchanged. The supplied reference image is not a project asset and must not enter Git. (`explicit visual-source-of-truth correction; no search or data-boundary change`)

### D-147 - Sermon discovery links use one accessible header disclosure

In the authenticated frontend preview, the four former top-level Sermons, Speakers, Series and Bible books links are grouped under one top-level **Sermons** disclosure. Its compact desktop panel contains the same destinations in that order and changes no route, slug, canonical rule or page content. The control is a real button with explicit expanded/controlled state; the panel remains a normal list of links rather than an application menu. Repeated activation, link selection, Escape, focus departure and click-away close it, while keyboard activation and ordered Tab/Shift+Tab traversal retain visible focus. The parent and exact section link have separate non-colour active indicators.

The mobile **Menu** retains those links as an expandable in-flow Sermons section rather than reusing the floating desktop panel. The footer continues to expose the direct links, and the public-mode header remains Home plus Sermons because the three preview taxonomy indexes are not public routes. A CSP hash covers the small navigation enhancement only in authenticated preview responses; public pages receive neither that script nor its hash. This decision changes no sermon data, search behavior, privacy/publication rule, semantic feature, public route or deployment boundary. (`explicit bounded navigation revision; authenticated local-preview verification only`)

### D-148 - Exact 15-sermon public development dataset and tracked handover governance

Samuel Saad explicitly authorises a future public, repository-tracked curated development dataset for exactly the three accepted pilot sermons and 12 Wave 1 sermons already used by the authenticated frontend preview. This narrowly supersedes D-103 and the former blanket real-content-in-Git prohibition only for that designated dataset. It may contain church-owned titles/slugs/dates, speakers, series, Bible-book and passage relationships, current descriptions, cleaned transcripts, ordered Q&A, YouTube video IDs, public media metadata and the taxonomy relationships needed to reproduce the frontend preview. It must use an exact identity/scope manifest and idempotent no-clobber importer; it must not be a raw PostgreSQL dump.

Raw YouTube Studio/API caption exports, credentials, secret-bearing environment files, OAuth configuration/tokens, cookies/sessions, administrator audit evidence, private keys, AWS/Google/YouTube account credentials, unrelated records, production database content, proprietary source and model payloads remain prohibited. The dataset must import every record as draft/unpublished and remain absent from ordinary public routes, public search, feeds, sitemaps, semantic processing and production builds. Public GitHub visibility is source-sharing authority only; it is not administrator approval, website publication, deployment or authority for a sixteenth sermon.

The canonical tracked handover is `/CURRENT_PROJECT_HANDOVER.md`. It must stay public-safe and may record safe repository facts, decisions, aggregate verification, the designated dataset location/format and setup commands, but never sermon bodies, secrets, authentication/session data, raw captions, administrator audit detail, private local paths or unrelated private evidence. This governance-only decision creates no dataset and authorises no PostgreSQL access; a later bounded task must implement and verify the export/import path before any real content is staged. (`explicit project-owner governance change; documentation-only milestone`)

### D-151 - One-time private 36-sermon generation from unapproved prepared transcripts

Samuel Saad selected the bounded pre-approval-generation option on 3 September 2026. The normal rule remains that description and Q&A generation requires the complete current administrator-approved transcript. The sole exception is one private run bound after this governance commit to a Git-ignored, integrity-hashed manifest containing exactly the 36 previously inspected, uniquely mapped and unprocessed evaluation source/video identities in fixed order. A failed attempt consumes its manifest position and cannot be replaced; the exception expires after all 36 records have been attempted and is unusable for any later record or batch.

For each usable official-caption source, the run may prepare a complete transcript and use that still-unapproved transcript immediately as the sole claim authority for one private description and 5–10 ordered private Q&A drafts. Transcript, description and Q&A remain unapproved, require real administrator review and stay excluded from public routes, search, feeds, sitemaps, canonical/social/structured metadata, semantic processing and production build output. Transcript approval remains a prerequisite to approving dependent content. A later transcript body-hash or source-identity change makes dependent drafts stale or requires explicit re-review against the changed transcript.

The only approved generator for this run is the authenticated interactive OpenAI Codex execution of Samuel's instruction. No separately billed generative API is authorised; external generative API cost is AUD 0 and there is at most one regeneration retry for an invalid description or Q&A result. Record only runtime-exposed model/revision/session identity; otherwise use null with `not_exposed_by_runtime`, use `not_exposed_to_runtime` for unavailable workspace privacy/retention detail and attach `MODEL_REVISION_UNAVAILABLE_LIMITED_REPRODUCIBILITY`. Every result also binds the D-151 governance commit, manifest hash, prompt/processing hash, source transcript hash, generation time, output hash, retry count and mandatory administrator review. This exception creates no administrator decision, content approval, publication, embedding, Related-themes, production, deployment, push or Phase 3C authority. (`explicit project-owner one-time private execution and governance amendment; normal approved-transcript rule retained`)

**Execution outcome (4 September 2026):** The integrity-bound private manifest contained exactly 36 unique previously inspected records. A refreshed protected owner token first verified the expected church channel and all three accepted pilot ownership anchors. The retry-disabled run then attempted all 36 manifest positions. Every otherwise eligible English caption candidate lacked confirmed primary-audio association, so all 36 received `caption_primary_audio_unconfirmed` before any caption download. The earlier frozen inspection recorded each selected candidate as ASR; the completed run makes no stronger current track-kind claim because it stopped at the audio-association gate. Zero captions, transcripts, descriptions, Q&A sets or database rows were created, and nothing was approved, published or made semantically eligible. Failed positions count under D-151, so the exception is consumed and cannot be reused. (`official API metadata observed; fail-closed one-time run completed with zero usable captions`)

### D-152 - Exact-manifest retry with truthful unknown-audio provenance

Samuel Saad authorises one retry of only D-151's existing private 36-record manifest with canonical SHA-256 `7e513f03cab908f30223753832211d2593ce4ffab15706ee851760385d9acb30`. The immutable D-151 checkpoint must prove that all 36 ordered positions ended specifically as `caption_primary_audio_unconfirmed`; another prior failure is not reopenable. The malformed redundant identity block supplied with the retry request is expressly disregarded, and the existing integrity-bound manifest is the sole identity authority. Failed records retain their position, no substitute or thirty-seventh identity is accepted, and the D-151 attempt remains historical evidence.

For this retry only, a serving, non-draft English standard or ASR caption may be selected when `audioTrackType` is `unknown`, provided requested video identity, caption resource identity, verified church-channel ownership, supported language/kind and equal-priority ambiguity checks all pass. Standard remains preferred over ASR. Commentary, descriptive, forced, wrong-language, draft, failed, unsupported-kind and ambiguous tracks remain rejected. Unknown is never treated as proof of primary audio: provenance must retain `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `audio_track_type: unknown`, `primary_audio_confirmed: false` and `accepted_under_bounded_exception: true`.

D-152 reauthorises the D-151 private pre-approval generation exception only for this exact retry. Each usable caption may become one complete private unapproved transcript and may immediately ground private unapproved description and Q&A drafts through the authenticated interactive Codex runtime under D-151's model-identity, zero-external-API-cost, one-regeneration-retry, grounding, source-hash, stale-result and administrator-review rules. No result is approved, public, searchable, feed/sitemap/metadata eligible, semantically eligible or production-build eligible. The retry expires after all 36 positions have received a D-152 attempt, regardless of outcome, and creates no later-batch, provider, publication, deployment, push, Related-themes or Phase 3C authority. (`explicit project-owner exact-manifest retry and bounded unknown-audio decision; D-151 history preserved`)

**Execution outcome (4 September 2026):** All 36 fixed manifest positions were attempted once without substitution. Thirty-two exact ASR VTT sources were retrieved under the truthful unknown-audio provenance rule and four positions ended as per-record provider failures. The 32 usable sources produced private unapproved transcript, description and Q&A drafts. Final validation identified seven generic question openings across six records and one associated support-metadata defect. Samuel expressly authorised one correction limited to those seven question wordings plus required support/hash/reference/receipt synchronisation. Every answer, transcript body and description body was preserved byte-for-byte, the rejected artifacts remain private, and the identical second import was unchanged for all 32 records. Zero approval, public/search/semantic eligibility, audio/video processing, substitution or additional record was created. D-151/D-152 are consumed. (`private manifest, artifact and local test-database evidence; human review still required`)

### D-153 - Second fixed 36-sermon private-draft processing exception

Samuel Saad authorises one checkpoint-resumable attempt for each of the 36 exact ordered identities in the independently frozen Git-ignored manifest whose canonical SHA-256 is `f25979b57aae574dcd4616509d7678f7f0b8e08b28ef6911ab322762c6fd69ab`. The manifest is fixed, unique, previously unattempted and collision-free against the existing local PostgreSQL identities. A failure consumes its position; no substitute, replacement or thirty-seventh sermon is valid. D-151, D-152 and their records remain immutable.

For this manifest only, official YouTube identity and caption reads may select one serving, non-draft English standard or ASR track using priority standard-primary, standard-unknown, ASR-primary, ASR-unknown. Equal highest priority fails that position. Unknown audio is never represented as confirmed primary audio and must retain `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `primary_audio_confirmed: false` and `accepted_under_bounded_exception: true`. Descriptive, commentary, forced, wrong-language, draft, failed and unexpected tracks remain ineligible.

Each usable exact VTT may become a word-preserving private unapproved transcript that immediately grounds one 180–220-word private description and five to ten ordered private Q&A pairs through the current interactive OpenAI Codex runtime. Runtime identity and privacy details are recorded only when exposed; unavailable fields use the approved markers, external generative API cost is AUD 0 and one pre-import regeneration retry is the maximum. Every result binds D-153, the manifest and governance hashes, exact transcript grounding identity/hash, generation/output hashes, audio provenance, mandatory administrator review and stale-result rules. Automated correction is limited to newly generated candidates before their first successful import and preserves rejected evidence. Atomic local import and its identical idempotency rerun force draft/private/unapproved state and exclude all public/search/feed/sitemap/metadata/build/semantic eligibility. D-153 expires when all 36 positions are terminal and grants no approval, publication, production, deployment, push, Related-themes, later-batch or Phase 3C authority. (`explicit project-owner exact-manifest private execution authority; normal approved-transcript rule otherwise retained`)

### D-154 - Third fixed 36-sermon private enrichment batch

Samuel Saad authorises one checkpoint-resumable attempt for each of the 36 exact ordered identities in the independently frozen Git-ignored manifest whose canonical SHA-256 is `d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244`. The manifest is fixed, unique, previously unattempted and collision-free against all 87 prior attempts and the existing local PostgreSQL identities. A failure consumes its position; no substitute, replacement or thirty-seventh sermon is valid. D-151 through D-153 and their records remain immutable.

For this manifest only, official YouTube identity and caption reads may select one serving, non-draft English standard or ASR track using priority standard-primary, standard-unknown, ASR-primary, ASR-unknown. Equal highest priority fails that position. Unknown audio is never represented as confirmed primary audio and must retain `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `primary_audio_confirmed: false` and `accepted_under_bounded_exception: true`. Descriptive, commentary, forced, wrong-language, draft, failed and unexpected tracks remain ineligible.

Each usable exact VTT may become a word-preserving private unapproved transcript that immediately grounds one 180–220-word private description and five to ten ordered private Q&A pairs through the current interactive OpenAI Codex runtime. Runtime identity and privacy details are recorded only when exposed; unavailable fields use the approved markers, external generative API cost is AUD 0 and one pre-import regeneration retry is the maximum. Every result binds D-154, the manifest and governance hashes, exact transcript grounding identity/hash, generation/output hashes, audio provenance, mandatory administrator review and stale-result rules. Automated correction is limited to newly generated candidates before their first successful import and preserves rejected evidence. Atomic local import and its identical idempotency rerun force draft/private/unapproved state and exclude all public/search/feed/sitemap/metadata/build/semantic eligibility. D-154 expires when all 36 positions are terminal and grants no approval, publication, production, deployment, push, Related-themes, later retry/batch or Phase 3C authority. (`explicit project-owner exact-manifest private execution authority; normal approved-transcript rule otherwise retained`)

**D-154 continuity addendum and completion (5 September 2026):** Samuel explicitly authorised `gpt-6-astra` to continue the same interactive Codex batch after the subscription/model-access interruption, without changing its manifest, retry ceiling or permanent protections. He separately resolved the provisional candidate-count discrepancy: the preserved sequence 25 was to be validated, not discarded or automatically declared successful. Runtime evidence supports Sol generation for sequences 1–25 and Astra generation for 26–36. Astra used the remaining permitted pre-import correction for sequence 25, preserving its original Sol provenance and all seven answers, and corrected one generic question opening in its own sequence 36. No correction allowance was reset. Immutable revision and unavailable privacy details retain their unavailable markers and warnings.

All 36 final candidates passed the unchanged validators and were imported as private unapproved drafts; the identical second pass returned `unchanged` for all 36. Seventeen candidates used one pre-import correction across the original and resumed work; rejected evidence is retained. The original 83 database records and Claude's frontend remain unchanged. The local totals are 119 sermons, 104 pending Stage-1 reviews and 15 completed private-preview sermons. All 36 manifest positions are terminal, so D-154 is consumed and grants no further attempt, replacement, generation, approval, publication or semantic authority.

### D-155 - Fourth fixed 36-sermon private enrichment batch

Decision D-155 creates one fourth fixed-batch exception bound only to canonical manifest SHA-256 `eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a`. The exact 36 new source/video pairs were deterministically frozen in ascending authoritative source-ID order after excluding all 123 prior attempts, including provider failures; 195 clean candidates became 36 fixed positions plus 159 remaining. Only the current interactive OpenAI Codex `gpt-6-astra` runtime may sequentially prepare private word-preserving transcripts and generate private unapproved 180–220-word descriptions and five to ten grounded ordered Q&A pairs from them before transcript approval. Complete transcript and candidate prose may pass only through the minimum primary Codex tool inputs/results and session context needed for this manifest, never another agent/provider or ordinary logs, progress, reports, Git, documentation, tests, screenshots, build or public output. Official captions use standard-primary, standard-unknown, ASR-primary, ASR-unknown priority; accepted unknown audio remains explicitly unconfirmed and retains the bounded-decision warning and D-155/manifest provenance. Preserve each original candidate before validation; allow at most one pre-import correction, retain rejected bytes and lineage, and do not reset that allowance on resumption. Every result binds the governance commit, exact manifest and transcript hashes, original/corrected output hashes, truthful Astra/runtime provenance, AUD 0 separately billed API cost, mandatory administrator review and all private/unapproved/public-search-feed-sitemap-SEO-build-semantic exclusions. Unexposed runtime details use `not_exposed_by_runtime`; retain the limited-reproducibility warning. Transcript changes make dependent drafts stale; transcript approval and separate human content decisions remain required. Import only atomically into the guarded local test target, preserve all prior 119 records, and permit only byte-identical idempotency imports after success. Each failure consumes its position; no substitution or thirty-seventh record is authorised. The exception expires after all 36 positions are terminal. Normal approved-transcript and primary-audio rules remain unchanged for every other manifest; D-151 through D-154 stay consumed and immutable. No approval, publication, embeddings, production access, schema change, frontend change, merge, deployment or push is authorised.

Samuel explicitly authorised the protected governance/skill changes, deterministic freeze and automatic binding to the resulting hash, the bounded official YouTube workflow, private primary-session prose access, and guarded local imports/tests. This is draft execution authority, not deferred human review or publication authority. The verified starting commit is `696f90b5e22bdc4de1bf24729afb36f9875f0345`; the local baseline is 119 sermons, 104 pending Stage-1 reviews and 15 completed private previews. The selected service-date range is 14 February 2021 through 17 April 2022. Execution evidence is recorded separately.

**D-155 execution completion (7 September 2026):** All 36 fixed positions are terminal and the exception is consumed. The post-reset sequence-4 download succeeded; preserved sources 1–3 were reused, and all 36 exact English ASR sources retain the bounded unknown-audio warning. This does not retroactively diagnose the original unclassified 403. All 36 Astra-generated candidates passed final validation; sequences 17 and 27 each used one preserved pre-import correction, with no allowance reset or post-import content change. Safe backend commit `a491f94f6e3a43dd494eaa05ffd972bc91aa3419` preserves four provider-redacted source markers as pending atomic review findings, without altering transcript bytes or making human decisions. All 36 imports and identical idempotency passes succeeded. The prior 119 records and frontend are unchanged; local totals are 155 sermons, 140 pending Stage-1 reviews and 15 completed private previews. Every new content area remains private and unapproved. No further D-155 attempt, substitution, approval, publication or semantic processing is authorised.

### D-156 — Delegated private description and Q&A review

Samuel explicitly delegates substantive review of the existing local collection to interactive Codex Astra and separately authorises the protected instruction amendments. Freeze existing identities before review. Read every pending description and individual Q&A fully; combine full-file mechanical integrity checks with sufficient contextual transcript evidence, honestly reporting semantic reading coverage. An unapproved transcript can support this private AI review without becoming approved. Preserve valid human approvals, source uncertainty, completed metadata corrections, historical provenance and all consumed batch decisions. No source retrieval or new enrichment batch is authorised.

Use a separate immutable, version/source/policy-bound AI review record, explicit AI/system attribution and per-artifact accepted/corrected-accepted/needs-human outcomes. These outcomes discharge repeated substantive description/Q&A review but never claim human approval or complete unrelated identity, finding, transcript or passage stages. One focused correction round is permitted only for defective unapproved artifacts, preserving original and corrected bytes, source/import receipts, ordering and history. Concurrency conflicts fail closed; identical writes are no-ops; changed inputs make prior acceptance stale. Existing publication/public-search/SEO/feed/sitemap/build/semantic gates remain unchanged. The additive private review schema, audited service, administrator status display, guarded fixture tests and safe local commits are authorised. All real evidence remains private. See the repository-scoped delegated-review contract for the complete requirements.

**D-156 post-rejection compatibility authority (11 September 2026):** Samuel separately authorises removal of sermon-linked private D-156 membership and review records only when a future separately authorised permanent deletion passes the existing archived-state, exact-confirmation, concurrency, reason, tombstone, audit and SEO safeguards. The new history remains immutable to direct updates/deletes; its narrow cascade requires the guarded application transaction, absence of the deleted parent, and its preserved minimal tombstone. Scope hashes and non-content historical audit events remain retained. This authorises no sermon deletion now, no broad history purge, and no change to the substantive-review or publication boundaries.

### D-157 — Evidence-based remaining private review of the existing collection

Samuel delegates the remaining identity, explicit-source speaker, individual
finding/set acknowledgement, retained-caption-fidelity transcript, primary-passage
and existing-media-reference checks for only the existing 155 records frozen by
canonical manifest SHA-256 `c46c9125291f2d73d73162d1e0a2be42a7ce7a27c3166579e6b60fd0c7b9fa68`.
He separately authorised the protected AGENTS/skill/grounding amendments after
execution review rejected their initial application, then explicitly authorised
the decision log, contracts, backend/admin implementation, necessary additive
schema, guarded database application and safe local commits after a second rejection.
Both rejections remain historical; no workaround or new sermon is authorised.

Use current interactive Codex Astra and immutable dependency-bound AI decisions,
never Samuel's human identity or lifecycle approval fields. Preserve D-156's
frozen policy and 1,121 decisions, all 118 human artifact approvals and every
human transcript/passage/finding/identity decision. Read retained local evidence
first; only when insufficient, read official church public sermon pages/metadata
for these records. No production database, YouTube API, new captions, audio/video
processing, other generative provider, content regeneration or deletion is allowed.

Transcript acceptance verifies fidelity and completeness relative to retained
captions, not the recording. Record full deterministic comparison separately from
actual/reused contextual semantic-reading coverage. Never normalize away missing
words, numbers, negation, redaction or uncertainty. Preserve human-approved
transcripts with missing retained sources and record that limitation honestly.
Each finding needs its own evidence-supported disposition; warnings are retained,
not erased by acknowledgement. Missing/conflicting evidence remains a precise
exception. Supported passage granularity and explicit canonical speaker mappings
may be persisted without inventing absent metadata or overriding human decisions.

The guarded local application may atomically record supported components and
private final completion with explicit AI attribution only when every current
requirement is satisfied, `status = draft`, and no prior publication timestamp
exists. A separate AI-completion record is not human approval. Preserve dependency
staleness, concurrency, idempotency, audit, original content/provenance, guarded
deletion/tombstone behavior, authentication and all public/search/feed/sitemap/SEO/
build/semantic exclusion. Additive schema and narrowly scoped admin status changes
are permitted only to implement these distinctions. The public publication and
scheduling checklists remain human-controlled and unchanged. D-151–D-155 stay closed.
See the repository-scoped remaining-review contract for complete evidence,
preservation, private-context, test and exceptions-only completion requirements.

**D-157 database application (12 September 2026):** All 155 fixed records were
assessed. The guarded workflow persisted 847 component decisions/limitations and
132 private-completion decisions, with 12 earlier human completions preserved.
The 11 records with 16 overlapping component exceptions remain incomplete. Five
missing speaker assignments, two new pending passage proposals and one exact-bound
machine-only proposal refinement were audited separately. One explicitly sourced
canonical speaker reference was added; the seven original references were not
relabeled or changed. Human approvals and D-156 decisions remain unchanged.
All 155 identical review packets and eight identical metadata packets replayed
without any database-table fingerprint change. Full marker-aware source comparison
identifies three actual missing-redaction exceptions, unlike the prior word-only
test; no source or transcript was edited to conceal them. The bounded official
public-page metadata lookup could not connect and supplied no missing speaker
evidence. No production database or provider API was accessed. Detailed evidence,
remaining requirements and verification are in `remaining-private-review-plan.md`.

### D-159 — Fifth fixed 36-sermon private enrichment batch

Samuel separately authorised this new batch and its protected governance/skill
amendments. It is bound only to canonical manifest SHA-256
`49c7eac788ce5564678cc3ff0c8aa72ec09f3e4e8f746044c1c6e4ed00ea5297`.
The 36 new unique source/video pairs follow the retained ascending source-ID order
after excluding 159 earlier attempts; 159 clean candidates become 36 fixed
positions plus 123 remaining. The eleven existing unresolved records are excluded.
D-158 remains the separately integrated restricted-acceptance decision, not a
number available for reuse on this backend branch.

Only this exact manifest may use complete prepared but unapproved transcripts for
private draft descriptions and Q&A in the current primary interactive Codex Astra
session. Necessary private source/transcript/candidate tool context is authorised,
not ordinary logs, other agents/providers, Git or public output. Official caption
selection uses standard-primary, standard-unknown, ASR-primary, ASR-unknown
priority; unknown audio retains its bounded warning and truthful unconfirmed
association. Preserve every normal grounding, source-word, uncertainty, editorial,
provenance, stale-result, approval and publication protection.

Commit and verify the safe implementation before caption access. Preserve each
original candidate and at most one pre-import correction. Atomic private imports
and identical idempotency reruns use only the guarded local test database. All
155 previous records and acceptance history remain unchanged; no new approval or
public/semantic eligibility is created. The exception expires at 36 terminal
positions, never permitting a substitute, 37th record or another batch. Quota or
access interruptions preserve pending positions. Full scope, privacy, retry,
cost, preservation and verification requirements are in
`fifth-private-batch-plan.md`. No staging/frontend change, production access,
schema change, deployment, push or merge is authorised.

### D-160 — Sixth fixed 36-sermon private enrichment batch

Samuel separately authorised the next deterministic fixed batch and the protected
governance/skill amendments. D-160 is bound only to canonical manifest SHA-256
`0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`.
The 36 unique source/video pairs are the first 36 clean records in the preserved
ascending authoritative source-ID order after excluding all 195 earlier attempts and
current PostgreSQL identities. A failed position consumes its place; no substitute,
reselection, historical manifest reuse or thirty-seventh sermon is permitted.

For this manifest only, official YouTube caption retrieval, word-preserving private
transcript preparation and grounded private description/Q&A generation may use the
complete prepared but unapproved transcript in the current primary Codex session.
Samuel selected model label `gpt-5.6-sol`. This selection must be stored separately
from runtime-reported identity: absent verifiable runtime metadata is recorded as
`not_exposed_by_runtime`, never inferred from the selection or copied from D-159.
No separately billed generative API is permitted and its cost is AUD 0.

Unknown audio association is eligible only under D-160's exact manifest-bound warning
and false primary-audio confirmation. Preserve complete grounding evidence, source and
output hashes, uncertainties, original candidates and at most one recorded pre-import
correction. Imports are atomic, idempotent and limited to the guarded local test
database. All outputs remain private, unapproved, review-required and excluded from
public/search/feed/sitemap/build/semantic use. Existing 191 sermons, 144 acceptances,
11 unresolved records, all earlier decisions, frontend and staging remain unchanged.
D-160 expires after the 36 positions are terminal. See `sixth-private-batch-plan.md`.

## Decisions still required

- Final AWS runtime/adapter and production networking.
- Whether privately retained legacy view counts should ever be displayed publicly.
- Church approval of any term merge/reclassification and the 49 scripture reconciliation cases.
- Whether the replacement should provide JavaScript live filtering after the server-rendered/no-JS path is accepted; the legacy AJAX branch is inconsistent and was observed not to refresh reliably.
- Approved runtime secret-provider integration before any future upgrade from `pg` 8 to `pg` 9, whose automatic `pgpass` support is deprecated.
- Explicit read-only approval and access method for the fresh whole-site crawl and church-owned Search Console/analytics baseline.
- Production canonical host/slash policy, any intentionally crawlable filter landing pages, and baseline-derived SEO performance/rollback thresholds.
- Human review and a separate acceptance/rejection decision for the one grounded replacement canary. The other 11 Wave 1 description/Q&A sets remain quarantined and have no regeneration authority. D-133/D-135 grant no authority for Wave 2, Wave 3, another sermon, publication, public **Related themes**, semantic quality acceptance, production/deployment or Phase 3C.
- Selection and bounded approval of an actual text-generation provider/model, including immutable identity, privacy/retention terms, retry and cost ceilings, is required before the authorised single-description canary can be generated. The embedding model is ineligible and no extractive fallback exists.
