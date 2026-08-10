# Project Decision Log

**Status:** Approved decisions and verified Phase 3B.2b atomic-review preservation through 7 August 2026
**Authority:** `church-website-architecture-plan.md` plus Yang’s confirmed migration decisions

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

Source and cleaned text are normalised to Unicode NFC and tokenised independently on whitespace. Unicode punctuation is removed from within each token and the remaining text is case-folded; the resulting token count, boundaries, order and content must match exactly. Only punctuation, capitalisation and paragraph/line-break formatting may change. Stable non-overlapping chunks carry exact source ranges and source/output hashes, and deterministic whole-sermon reassembly is revalidated before any persistence. No-clobber paths, retained uncertainty/provenance, structured failures, exact-two scope and comprehensive fail-closed verification are mandatory. The authorised exact-two private processing and idempotent import have completed with both records retained as drafts; administrator review, content accuracy and pilot acceptance remain outstanding. (`approved implementation contract; private drafts not approved`)

### D-120 - Fail-closed schema migration journal

Canonical local schema migration uses a runner-owned `schema_migrations` journal that is distinct from source/content migration records and draft-import receipts. Each ordered migration identity is bound to a deterministic SHA-256 checksum of its Unicode/line-ending-normalised paired up/down SQL definitions. The runner holds a PostgreSQL advisory lock around planning and execution, requires the stored receipts to be an exact canonical prefix, applies only the pending suffix, and records DDL plus its receipt in the same transaction. A matching rerun is a no-op. Rollback removes only matching latest receipts transactionally with their down SQL while preserving the standalone rollback files.

Unknown, changed, missing, duplicate or reordered receipts fail before apply or rollback. Existing application objects without the trusted journal also fail; the runner never infers or auto-baselines prior history. The existing exact disposable-database and explicit write-opt-in gates remain mandatory. (`local implementation decision`)

### D-121 - Guided imported-sermon review is distinct from lifecycle editing

Imported enrichment drafts use a dedicated six-stage administrator route: identity/provenance, typed flagged items, complete transcript, sermon description, ordered Q&A and final review summary. Only one stage is shown at a time. Technical provenance is collapsed; unresolved epoch service dates render blank; transcript and Q&A editors remain readable at supported desktop widths and 200% zoom. Every editorial decision has an explicit action, optimistic row version and safe audit event. Viewing, navigation and draft saving never imply approval.

Migration `0007_guided_sermon_review.sql` adds only private structured progress and typed caption/name/Scripture review items. Missing, rejected or deliberately unresolved item decisions block transcript approval; a transcript text change invalidates earlier transcript-bound decisions. Completing the workflow records completion only while the sermon remains draft/private and all content gates pass. The route intentionally has no submit, schedule, publish, archive or deletion controls. D-121 supersedes D-116's all-in-one editor only for imported enrichment review; the general sermon lifecycle editor remains available for other authorised administration. (`approved local implementation decision`)

### D-122 - Every private source finding is an atomic administrator decision

The six aggregate prompts created by migration `0007` do not preserve the 86 detailed private findings and cannot count toward review completion. Migration `0008_atomic_sermon_review_items.sql` adds deterministic collision-checked identities, trusted record/category ordinals, private finding detail and paragraph references, transcript content hash/version expectations, and an exact ordered identity-set commitment. The two authorised records require exactly 42 and 44 pending atomic rows. Their combined category remains `name_or_scripture_reference`; automation must not infer a more specific name-versus-Scripture classification.

Aggregate warning codes remain informational provenance only. Each atomic item requires its own explicit accepted or corrected outcome; resolving one never resolves a sibling. Missing, extra, duplicate, reordered, pending, stale or identity-mismatched rows block the stage and final completion. Direct correction is available only when an exact transcript phrase is truthfully attached. Assembly, restoration and import are no-clobber, deterministic, fail-closed and idempotent, and no review decision or approval is created by them. (`approved local implementation decision; private findings remain pending`)

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

## Decisions still required

- Final AWS runtime/adapter and production networking.
- Whether privately retained legacy view counts should ever be displayed publicly.
- Church approval of any term merge/reclassification and the 49 scripture reconciliation cases.
- Whether the replacement should provide JavaScript live filtering after the server-rendered/no-JS path is accepted; the legacy AJAX branch is inconsistent and was observed not to refresh reliably.
- Approved runtime secret-provider integration before any future upgrade from `pg` 8 to `pg` 9, whose automatic `pgpass` support is deprecated.
- Explicit read-only approval and access method for the fresh whole-site crawl and church-owned Search Console/analytics baseline.
- Production canonical host/slash policy, any intentionally crawlable filter landing pages, and baseline-derived SEO performance/rollback thresholds.
- Samuel's explicit administrator decisions for both private pilot drafts, followed by explicit acceptance of the bounded verified result, workload evidence, the next exact allowlist/batch, reviewer/approver assignments, and confirmed source identities/dates before any of the remaining 450 sermons is processed.
