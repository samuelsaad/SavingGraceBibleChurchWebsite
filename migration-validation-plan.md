# Migration Validation Plan

**Status:** Local PostgreSQL integration executed and verified on 5 August 2026  
**No production extraction, migration, database write, deployment, or infrastructure change has run. The only database writes were to the authorised disposable local `savinggrace_sermons_test` database.**

## Permanent whole-site SEO launch gate

The existing website's organic-search performance must be preserved at minimum across the entire site. SEO regression is unacceptable and blocks launch. `seo-migration-validation-plan.md` is the detailed acceptance contract for the complete indexable URL baseline, one-to-one mapping, metadata/canonical parity, redirect quality, sitemaps/robots/structured data, internal links/orphans/errors, crawlability/indexability, server rendering, social metadata, accessibility/performance, pre-launch comparison, post-launch monitoring, and rollback.

The Phase 3B.1a content gate is additive: all 453 included historical sermons must have exactly one speaker, one approved sermon description, an approved complete transcript, 5–10 ordered all-approved Q&A pairs, required metadata, and valid controlled media. The five pending rows remain non-public but still count. Failure of either the content gate or whole-site SEO gate blocks launch.

Current discovery contains verified sermon URL/search/canonical/social-image evidence but not a complete whole-site crawl or Search Console/analytics baseline. Those are later explicitly approved read-only tasks; this milestone made no new production contact.

## Safety gates for a future migration run

1. Re-run identity, database, grants, table-prefix, and core-table access checks.
2. Record the approved temporary grant exception; use no `PROCESS`, event, trigger, or unrelated-activity inspection.
3. Use a consistent read-only snapshot/transaction and an approved secure destination outside the repository for any controlled extract.
4. Do not extract credentials, user password hashes, auth/session data, tokens, licence values, or unrelated personal data.
5. Hash/version migration code and configuration; separate dry run from production writes.
6. Require target backup, rollback plan, reconciliation report, and explicit write approval before any migration execution.
7. Stop on changed source identity/prefix, new grants, inconsistent counts, unexpected status, duplicate source identity, unsafe media, or schema drift.

The current connection is readable but not least-privilege: it has `PROCESS`, `EVENT`, and `TRIGGER` beyond the needed database read permissions. The owner has accepted this as a temporary Phase 0 exception. (`database-observed`)

## Authoritative baselines

### Sermons and visibility

| Metric | Baseline | Evidence |
| --- | ---: | --- |
| All Advanced Sermons `sermons` rows | 456 | `database-observed` |
| Published | 448 | `source-and-database-confirmed` |
| Pending | 5 | `database-observed` |
| Draft | 3 | `database-observed` |
| Titled pending included | 5 | `database observed` |
| Blank-title pending excluded | 0 | `database observed` |
| Included non-Sunday dates | 4 | `database observed` |
| Missing published titles/slugs | 0 / 0 | `database-observed` |
| Duplicate published slug groups | 0 | `database-observed` |
| `_wp_old_slug` rows | 0 | `database-observed` |
| Published date range | 5 Feb 2017 through 2 Aug 2026 local time | `source-and-database-confirmed` |
| Public archive pages | 50 at 9/page except 7 on last | `source-and-database-confirmed` |

All 456 sermon bodies and excerpts are empty. All three drafts have empty slugs and zero `post_date_gmt`. There are no future-dated sermon rows. (`database-observed`)

### Taxonomy baseline

| Taxonomy | Registered terms | All-status relationships | Published relationships | Published missing | Published multi-assigned | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Book | 23 | 444 | 438 | 10 | 0 | `database-observed` |
| Series | 29 | 441 | 436 | 21 | 9 | `database-observed` |
| Speaker | 9 | 453 | 448 | 0 | 0 | `database-observed` |
| Passage (`sermon_topics`) | 379 | 432 | 428 | 20 | 0 | `database-observed` |
| Campus | 0 | 0 | 0 | 448 | 0 | `database-observed` |
| Service type | 0 | 0 | 0 | 448 | 0 | `database-observed` |

All terms are flat and all relationship order values are zero. Stored WordPress term counts can differ from counted relationships, so validation must recompute assignments. (`database-observed`)

### Metadata/media baseline

| Metric | Baseline | Evidence |
| --- | ---: | --- |
| Sermons with meta field rows | 453 (published + pending) | `database-observed` |
| Populated YouTube | 324; all `youtu.be` URL shape | `source-and-database-confirmed` |
| Populated SermonAudio embed | 424 | `source-and-database-confirmed` |
| Published both YouTube+audio | 290 | `database-observed` |
| Published neither | 0 | `database-observed` |
| YouTube duplicate value groups | 0 | `database-observed` |
| Audio duplicate value groups/rows | 5 / 11 | `database-observed` |
| Populated passage meta | 436 | `source-and-database-confirmed` |
| Populated PDF/bulletin/other provider fields | 0 | `database-observed` |
| Sermon featured images | 0 | `database-observed` |
| Numeric legacy view counters | 453; total 290,487 | `database-observed` |

### Passage reconciliation baseline

For published sermons: 387 exact meta/taxonomy matches, 36 mismatches, 8 meta-only, 5 taxonomy-only, and 12 neither. Pending has four exact-both and one meta-only; drafts have neither. (`database-observed`)

### Residual-system baseline

Other post types contain 12 sermon-like records: one `ctc_sermon`, three `wpfc_sermon`, and eight `wpv_sermon`. Custom tables contain one `wp_sb_sermons`, two `wp_sb_books_sermons`, and one `wp_sb_sermons_tags` row; the custom sermon’s `page_id` is orphaned. (`database-observed`)

Yang confirmed that every residual-system row is excluded from migration and from the replacement sermon collections. Source rows remain untouched. (`database observed`)

## Validation layers

### 1. Source snapshot and extraction

- Assert selected database and `wp_` prefix before querying.
- Record extraction time, source server version, safe schema fingerprint, and snapshot boundary without connection details.
- Count every extracted entity by type/status before transformation.
- Ensure source IDs are unique within source type.
- Hash source records/relationship sets in a deterministic, non-secret representation.
- Confirm the source database is unchanged by the extraction session.
- Compare plugin/source assumptions with the field map; version-specific claims remain warnings unless production version is proven.
- Identify the installed source snapshot by the recorded parent 3.7 and Pro 2.2 aggregate hashes; source files remain outside the repository.

### 2. Core sermon transformation

- Reconcile all 456 Advanced Sermons rows to deterministic included/excluded results.
- Import 448 published plus 5 titled pending records; preserve pending as unpublished.
- Exclude all 3 drafts and any blank-title pending record with source ID/status/reason in audit output.
- Preserve Unicode titles and existing public slugs; no silent slug fallback for drafts.
- Preserve local/GMT/modified source timestamps and explicitly flag zero draft GMT.
- Map the exact local `post_date` calendar date to `service_date`; preserve four included non-Sundays unchanged and emit warnings.
- Keep body null/empty according to source. Preserve any nonblank summary as an imported draft; do not generate or auto-approve a sermon description during migration.
- Assert anonymous queries cannot see pending/draft records.

### 3. Relationship and term transformation

- Recompute source term/relationship counts rather than trusting `wp_term_taxonomy.count`.
- Preserve all nine multi-series sermon cases and the one non-public multi-book case.
- Preserve unused/misclassified and near-duplicate terms in source audit even if curated entities exclude them.
- Validate term image references: two valid speaker assets; one broken speaker and one zero/broken series reference become warnings.
- Do not interpret `asp_term_order` as an attachment ID.

### 4. Scripture transformation

- Retain meta and taxonomy provenance independently.
- For exact matches, prove any coalescing is lossless and auditable.
- Route all 36 published mismatches to parser/reconciliation reporting.
- Preserve abbreviations, pluralisation, multiple-reference strings, `Selected Text`, and unparseable free text.
- Never reject a sermon solely because structured scripture parsing fails.
- Assert parse status and original value are present for every attempted parse.

### 5. Media and resource transformation

- Parse every nonempty YouTube URL to an approved canonical ID/URL and test provider availability separately.
- Parse SermonAudio iframe attributes without executing markup; store controlled provider data only.
- Never place source iframe HTML in a renderable public column or log.
- Review the 11 rows in duplicate audio groups before merging media identities.
- Create no empty PDF/bulletin/provider resource records and no synthetic featured images.
- Verify all migrated media output has safe iframe origins, titles/accessible labels, and no arbitrary attributes/scripts.
- Store `post_views_count` only in private `sermon_legacy_metrics`; assert it is absent from public DTOs and repository projections.

### 6. Search parity

- Compare ordered source/target results for title, speaker, series, passage, book, combined filters, sort, and pagination.
- Reconcile unfiltered 448 and the four published relationship totals: series 436, speaker 448, passage 428, book 438.
- Build facets from published relationships, not stored term counts.
- Test missing relationships and nine multi-series cases.
- Test `sermon_dates=YYYY-MM-DD - YYYY-MM-DD` translation, inclusive endpoints, malformed/reversed pairs, and WordPress-local calendar-date preservation.
- Prove no target query leaks non-public rows.
- Test server-rendered/no-JS requests, keyboard interaction, URL history, and empty states even if dynamic refresh is added.
- Assert cross-dimension taxonomy filters produce independent `AND` predicates and do not reproduce the parent AJAX-prepared `OR` branch.

### 7. URL, redirect, and SEO validation

- Reconcile one complete whole-site indexable URL baseline from an explicitly approved crawl, sitemaps, database, internal links, Search Console, and approved analytics evidence.
- Require one reviewed target disposition for every baseline URL and block launch on any unexplained omission.
- Generate and verify all 448 published `/sermons/{slug}/` paths.
- Confirm no slug collision after normalisation and encoding.
- Preserve/filter-map legacy query parameters.
- Test each redirect for one hop, target 200, correct canonical, and no loop/open redirect.
- Do not generate redirects for pending/draft rows without evidence of former publication.
- Normalize the approved canonical host; remove staging/unknown-origin image defaults.
- Import SEO data only when materially populated; do not import empty AIOSEO arrays/placeholders.
- Compare titles, descriptions, headings, visible content, dates, internal links, image alt text, canonicals, social metadata/images, and structured-data types for every template/high-value landing page.
- Prove indexable primary content and important internal links exist in server-rendered/no-JavaScript HTML.
- Assert correct status, one self-canonical, sitemap/robots consistency, and duplicate control across filters, query parameters, tracking parameters, pagination, host/scheme/slash variants, and alternate forms.
- Assert pending/draft/scheduled/unpublished/archived/admin/search/preview/staging routes are absent from public sitemaps and non-indexable even when the URL is known.
- Validate internal broken links, orphan pages, soft 404s, XML sitemaps, robots directives, breadcrumbs, accurate structured data, and the known staging-origin social-image correction.
- Compare mobile accessibility, semantic HTML, Core Web Vitals, and approved template performance budgets with the measured legacy baseline.
- For every previously published slug change, verify a transactional one-hop `301` from every former alias to the new canonical path.
- For every permanent deletion, prove archived-state/confirmation/version/reason safeguards, dependent cleanup, a minimal non-content tombstone, and either a validated equivalent redirect or explicit future `410` outcome. A previously indexed URL must never silently become an unmanaged `404`.
- Confirm deleted URLs and archived/non-public records are absent from public sitemaps and internal links while redirect/gone history remains in the reviewed URL manifest.

### 8. Security and privacy validation

- Scan extracts, logs, artifacts, and migration errors for credential/auth/token/licence/password patterns.
- Confirm no WordPress password hashes or unrelated user/account records were extracted.
- Sanitize public HTML and reject arbitrary embed rendering.
- Verify target role/permission checks and draft separation independently of UI controls.
- Retain only the minimum controlled raw source needed for reconciliation and delete it on the approved schedule.

## Required edge-case fixture set

Include representative fixtures for: oldest/newest records; titled pending, blank-title pending, and slugless draft; Sunday and non-Sunday dates; missing series/passage/book; two-series sermon; exact and mismatched passage sources; `Selected Text`; near-duplicate/misclassified term; YouTube-only, audio-only, both; duplicate audio value; Unicode title; broken term image; empty body/summary; and residual legacy-system row.

## Acceptance report

A future migration run is not acceptable until its report contains:

- source/extracted/transformed/imported/skipped/rejected counts by entity/status;
- relationship counts and multiplicity distribution;
- passage parse/reconciliation results;
- media/provider/duplicate/availability results;
- slug and redirect manifest results;
- complete whole-site baseline coverage and one-to-one URL disposition results;
- metadata/content/heading/date/internal-link/image-alt/canonical/social parity results;
- sitemap/robots/structured-data/duplicate/indexability/no-JavaScript crawl results;
- broken-link, orphan-page, 404/soft-404, accessibility, and performance-budget results;
- search result-set/pagination comparisons;
- security/privacy scan outcome;
- every warning tied to source and target identities;
- rerun/idempotency result; and
- explicit owner approval of all unexplained differences; and
- pre-launch old/new crawl sign-off plus post-launch Search Console/approved analytics monitoring and SEO rollback thresholds/authority.

Installed parent 3.7 and Pro 2.2 source resolves the core registration, date-range, keyword, AJAX, view-count, rewrite, and admin behavior gaps. Byte identity with the no-longer-present earlier ZIP remains unresolved, and site-theme/snippet customisations remain outside this source snapshot. Residual content scope and migration date/status rules are approved in `decision-log.md` and `migration-contract.md`.

## Local milestone 1 verification — 5 August 2026

- `npm test`: 7 files, 19 tests passed.
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: Astro static foundation and health route built successfully.
- Dry-run CLI: anonymised fixture included deterministically and emitted safe audit JSON only.
- Dependency audit during installation: 0 reported vulnerabilities.
- No local `psql`, Docker, or PostgreSQL service was available, so `0001_initial.sql` was not applied. Its required schema objects are covered by a static contract test; execution against a disposable PostgreSQL database is the first task of the next milestone.
- Compliance audit: no legacy connection identifier in repository artifacts, no `.env`, no extracted plugin directory, unchanged source archive hash, and only `SELECT`/read-only CTE, `SHOW`, `DESCRIBE`, `SET`, and `START` statement starters in the MariaDB log.

## Local milestone 2 integration verification — 5 August 2026

- Exact installed source snapshot reconciled: Advanced Sermons 3.7 and Advanced Sermons Pro 2.2, with deterministic aggregate hashes recorded in the inventory and decision log.
- `sermons.legacy_view_count` removed; `sermon_legacy_metrics` added as private audit-only storage and excluded from repository/API projections.
- Legacy `sermon_dates` compatibility parser added for inclusive `YYYY-MM-DD - YYYY-MM-DD`; invalid and reversed dates fail validation.
- Public PostgreSQL repository and portable HTTP router implemented for list/detail, keyword search, pagination, speaker/series/passage/book/date filters, deterministic ordering, published-only visibility, and controlled media projection.
- Anonymised fixture loading is transaction-backed, importer-driven, idempotent by source identities, and refuses every target except `savinggrace_sermons_test` on loopback port 5432 or a missing write opt-in.
- `0001_initial.down.sql` and an opt-in real-PostgreSQL suite cover apply, constraints/indexes/generated search, load/rerun, visibility/filter behavior, rollback, clean reapply, and teardown.
- Credential preflight passed without revealing identity or secret values: configured `PGUSER`; existing `PGPASSFILE`; inheritance-disabled ACL; current-user read access; no broad write access; authenticated connection successful.
- Authenticated target identity passed: PostgreSQL 16.14, `127.0.0.1`, port 5432, exact database `savinggrace_sermons_test`, PostgreSQL server signature, and target ownership. The database did not pre-exist and was created expressly for this milestone.
- Initial migration apply succeeded. All 23 expected tables, validated foreign keys/checks, critical indexes, generated `tsvector`, GIN search index, `pgcrypto`, and sermon status rules were verified.
- Fixture load and identical rerun each reported 3 candidates. Counts remained 3 sermons (2 published, 1 pending), 1 migration run, 5 migration records, 3 private legacy metrics, 3 media rows, and the expected relationship/scripture counts with no duplication.
- Real PostgreSQL test run: all 12 test files and all 35 tests passed; no PostgreSQL test was skipped. Tests cover apply/load/rerun, constraints, indexes, generated search, public visibility, every filter, pagination, ordering, slug lookup, safe media, all non-public states, rollback, reapply, and teardown.
- Live loopback API harness bound to `127.0.0.1:4322`. List/detail/search/speaker/series/passage/book/inclusive-date/pagination requests succeeded; disjoint filters returned zero; pending/draft/archived/unpublished/scheduled/missing slugs returned 404; no raw iframe or legacy view field appeared. The verified process was stopped and the port has no listener.
- Explicit rollback removed every intended project table/relation and intentionally retained `pgcrypto`. Clean reapply and fixture reload succeeded.
- Final database state is applied and clean: 3 anonymised sermons, 1 migration run, 5 migration records, valid search vectors/GIN index, no temporary test rows, and no API listener.
- `npm test`: 12 files and 35 tests passed; 0 skipped.
- `npm run check`: 0 errors, 0 warnings, 0 hints across 44 files.
- `npm run build`: static Astro foundation/health route built successfully; no production server adapter was selected.
- Anonymised dry run: 5 inputs produced 3 included candidates (2 published, 1 pending), 2 expected exclusions (draft and legacy post type), and 0 rejections; stdout contained safe report fields only.
- `npm audit --offline --audit-level=low`: 0 vulnerabilities, with no remote connection.
- Credential/source scan: 0 unexpected `.env` files, 0 private-key/high-risk-token files, 0 proprietary plugin archives/directories in the workspace, and the credential file is outside the workspace. Temporary API logs were removed.
- Installed parent/Pro source aggregate hashes remained unchanged after the integration milestone.
- Non-blocking maintenance note: `pg` 8.22 emits a deprecation warning for automatic `pgpass` support ahead of pg 9. Replace it with an approved async password provider/secret-store integration before upgrading to pg 9; no credential was displayed or logged.

## Phase 3 local administration foundation verification — 5 August 2026

- Credential/safety preflight passed without revealing values: configured `PGUSER`/`PGPASSFILE`, existing protected credential file, ACL inheritance disabled, no broad allow rule, authenticated PostgreSQL 16.14, loopback address, port 5432, and exact `savinggrace_sermons_test` database.
- `0002_admin_foundation.sql` added nullable provider-independent ownership attribution, taxonomy row versions, provisional audit roles, and constrained outcomes. Its independent rollback removed the delta; the full `0001`-`0002` set rolled back and reapplied cleanly.
- Fixture load/rerun remained deterministic: 3 anonymised sermons (2 published, 1 pending), all 3 imported records unowned, 1 migration run, and 5 migration records.
- Service and handler tests prove default-deny `admin`/`editor`/`contributor` RBAC, contributor ownership, unowned imported-record protection, explicit transitions, future schedule validation, publication timestamp preservation, archive/restore, stale-write rejection, transactional multi-table rollback, safe audit events, controlled media, and unchanged published-only public routes.
- Final real PostgreSQL suite: 16 test files, 47 tests passed, 0 skipped. Static check: 0 errors, warnings, or hints across 59 files.
- Live API bound only to `127.0.0.1:4322`: unauthenticated admin list 401; authorised list/create/update/submit/withdraw/schedule/publish/unpublish/archive/restore 200/201; spoofed role publish 403; scheduled/unpublished public detail 404; published detail 200; admin audit 200 with 10 safe events; editor audit 403; permanent-delete route 405.
- Live controlled YouTube output contained no iframe, private migration provenance, legacy metric, or embed configuration. The verified harness stopped, the port had zero listeners, and only its temporary local sermon/audit rows were removed.
- Defect corrected: the local Node harness initially omitted HTTP mutation bodies while adapting Node requests to portable Web Requests, causing controlled `invalid_json` responses. `node-request-adapter.ts` now forwards bounded bodies and returns 413 over the limit; two regression tests cover both paths.
- Safety gap corrected: the harness now rejects non-loopback `API_HOST` values; a regression test covers accepted loopback values and externally reachable bind attempts.

## Phase 3B local administration acceptance verification — 5 August 2026

- Credential and target safety gates passed without revealing values: PostgreSQL 16.14 on `127.0.0.1:5432`, exact disposable database `savinggrace_sermons_test`, `_test` suffix, PostgreSQL server signature, and explicit local write opt-in.
- `0003_single_admin_deletion_seo.sql` and its down migration were exercised independently and as part of the complete `0001`–`0003` rollback/clean-reapply sequence. The final clean apply reported migrations `0001-0003` applied.
- The target now enforces only `admin`/`system` audit actors, supports one-hop sermon redirects and explicit `410` dispositions, and contains a minimal non-content deletion tombstone table with deletion/SEO shape constraints and supporting indexes.
- The final real PostgreSQL suite passed all 18 test files and all 54 tests with zero skipped. It covers schema apply/down/reapply, importer idempotency, single-admin default-deny authorization, forged-role rejection, every lifecycle transition, optimistic concurrency, archived-only permanent deletion, exact typed confirmation, reason/version validation, transactional cascade cleanup, safe audit/tombstone retention, redirect/gone requirements, public-state isolation, search/filter/pagination, controlled media, and local-dashboard serving safeguards.
- Clean resting state after the suite: migrations `0001`–`0003` applied; two identical importer runs each reported 3 anonymised candidates; 3 sermons, 1 migration run, 5 migration records, 0 audit events, 0 tombstones, 0 redirects, and all 3 imported sermons intentionally unowned. The expected search, deletion, and redirect indexes and the single-admin audit-role constraint are present.
- Live dashboard acceptance passed at desktop, 768×1024, and 390×844. The accessible navigation, sermon list/detail/new workflows, inclusive date-range controls, taxonomy management, audit view, SEO URL preview, controlled provider fields, no-role-selector design, noindex metadata, internal table scrolling, and zero page-level horizontal panning were verified with no browser warnings or errors.
- Live loopback responses: `/admin` returned `200` with CSP and `X-Robots-Tag: noindex, nofollow, noarchive`; unauthenticated admin API returned `401`; public list returned 2 published fixtures; title, speaker, series, and inclusive-date filters each returned the expected single fixture; published slug detail returned `200`; the pending slug returned `404`; controlled YouTube/SermonAudio output contained no iframe, imported embed HTML, or raw HTML field. The harness was stopped and port 4322 has no listener.
- Final static verification: `npm run check` reported 0 errors, 0 warnings, and 0 hints across 65 files; `npm run build` generated the static `/admin` shell and health route successfully; the anonymised dry run produced 3 included, 2 expected exclusions, and 0 rejections; the offline dependency audit reported 0 vulnerabilities.
- Corrected acceptance defects: the sermon list now exposes both inclusive service-date bounds, and narrow-screen table content is contained in its horizontal scroller without widening the page. Source-level regression assertions plus the browser acceptance pass cover both corrections.
- Local Git was initialised and ignore rules were strengthened. All 89 intended files passed the staged filename/content scan with zero private keys, embedded database credentials, assigned secrets, cloud keys, password hashes/JWTs, PHP/ZIP/plugin-source files, risky filenames, or symlinks. No baseline commit was created because neither local Git author name nor email is configured; no identity was invented and no remote was configured.
- Permanent whole-site SEO non-regression remains a launch-blocking architecture acceptance criterion. The architecture plan, decision log, README, redirect plan, migration contract, this validation plan, dedicated SEO plan, administration contract, and target schema cross-reference slug-change and permanent-deletion redirect/gone handling. No production crawl, Search Console, analytics, or remote system was contacted.

## Phase 3B.1 content-model correction verification — 5 August 2026

### Safety and target

- Non-secret preflight confirmed configured user/password-file variables, existing ACL-protected libpq file, successful authentication, PostgreSQL 16.14, server address `127.0.0.1`, port `5432`, exact database `savinggrace_sermons_test`, `_test` suffix, PostgreSQL rather than MariaDB, read-only inspection, and explicit `ALLOW_LOCAL_DB_WRITE=1` before mutation.
- No WordPress, MariaDB, AWS, Cognito, media/transcription/AI provider, remote host, production data, or proprietary plugin source was contacted or changed.

### Ordered migration and rollback evidence

- `0004_sermon_enrichment_readiness.sql` replaced the local speaker join with nullable sole `sermons.speaker_id`, added transcripts, ordered Q&A, draft-import receipts, approved-only search documents, GIN rebuild, refresh functions/triggers, historical-backfill marker, and derived readiness view.
- `0005_approved_sermon_descriptions.sql` reused `summary`, added constrained description review/provenance/concurrency fields and controlled `seo_description`, rebuilt the GIN-backed vector with approved-only summary weight C, extended refresh/readiness/backfill, and preserved existing nonblank summaries as drafts.
- Real integration deliberately rolled `0004` back, inserted a second local relationship, and proved forward migration aborted transactionally with the affected sermon UUID while leaving the join table intact. After removing only the test anomaly, clean reapplication succeeded.
- Independent `0004` rollback restored speaker joins and the prior search vector. Independent `0005` rollback removed its lifecycle/SEO columns and constraints and restored the `0004` search/readiness view; clean `0005` reapplication succeeded. The complete `0001`-`0005` set then cleanly reapplied. Final schema reapply and two fixture loads each reported three candidates and left exactly three sermons, not six.

### Behaviour and search evidence

- The service accepts incomplete drafts/imports but rejects future schedule/publish with `content_incomplete` and field issues until speaker, approved description, approved transcript, 5–10 approved consecutive Q&As, and controlled media pass.
- Unit boundaries prove four/eleven Q&A fail; five/ten pass; blanks/order fail; speaker arrays and unsafe HTML-like input are rejected.
- Real PostgreSQL search matched unique terms present only in an approved description, approved transcript and approved Q&A, while a draft-description-only term did not match. Public detail/list returned only approved descriptions; pending/unapproved content stayed non-public. List responses omitted heavy bodies.
- Server-rendered detail tests prove the complete transcript is present in initial escaped HTML inside closed native `<details>` with “Read full transcript”; Q&A is also server-rendered, with no client fetch, script execution, or automatic FAQ JSON-LD.
- The deterministic queue was byte-equivalent across repeats. A strict three-output anonymised bundle imported as draft, identical rerun returned `unchanged`, one safe audit event remained, and no description/transcript/Q&A became approved. A later differing draft was refused after the description was explicitly approved.

### Test and local completion evidence

- Real PostgreSQL suite: 22 files, 72 tests passed, zero skipped. It covered migration abort/rollback/reapply, importer rerun, repository/filter/search/public visibility, enrichment idempotency, publication rules, deletion/redirect safeguards, authorization, and API boundaries.
- Final anonymised dry run: five inputs; three included (two published, one pending), two expected exclusions, zero rejected.
- Final local readiness: included 3/453; sole speaker 2; approved description 0; approved transcript 0; approved 5–10 Q&A 0; valid controlled media 2; complete 0; incomplete 3; expected exit code 1. Safe missing requirements are reported only by anonymised source IDs.
- This is correct demonstration state, not historical completion. The real 453 description/transcript/Q&A sets have not been retrieved, generated, reviewed, or approved.

### Phase 3B.1a verified local evidence - 5 August 2026

- Credential-safe safety checks confirmed PostgreSQL 16.14, loopback `127.0.0.1`, port 5432, exact `_test` database `savinggrace_sermons_test`, and explicit write opt-in. No remote service was contacted.
- The real suite passed 22/22 files and 80/80 tests with zero PostgreSQL skips. The standard suite passed 73 tests with the seven PostgreSQL cases intentionally omitted there; `test:postgres` is the authoritative zero-skip result.
- Migration `0005` applied, independently rolled back while retaining three sermon rows, removed its lifecycle/SEO columns and every added constraint, restored the `0004` readiness view, and reapplied. The complete `0001`-`0005` set then rolled back cleanly, removed intended project objects while retaining `pgcrypto`, and reapplied.
- Two real importer fixture loads each reported three candidates and left exactly three sermons/three included migration records. Final local readiness is approved descriptions 0, approved transcripts 0, valid Q&A sets 0, valid controlled media 2, complete 0 and incomplete 3.
- Real defects corrected: rollback now explicitly removes the summary plain-text constraint; same-request approval metadata is computed from resulting rather than old row values; public SEO output is gated with description approval; and the detail projection retains `body`. Regression tests cover each correction.
- Browser acceptance verified the rebuilt desktop editor, character feedback, review/approval actions and live announcements; public initial HTML verified uncollapsed description ordering, no scripts, canonical URL, explicit SEO override precedence and description fallback. The 390px contract retains the single-column form, non-wide fields, off-canvas navigation and flexible action buttons under the 800/480px rules.
- The importer dry run reported total 5, included 3, excluded 2 and rejected 0. Offline dependency audit reported zero vulnerabilities. Credential/private-key/proprietary-source scans reported no secret pattern, private key, PHP or tracked ZIP.

### Phase 3B.2 acceptance prerequisite

Before any real historical enrichment, separately approve a controlled provider/source and cost ceiling, secure source access, privacy/retention terms, deterministic batch manifest, retry/resume limits, separate description/transcript/Q&A quality rubrics, named human reviewers/approvers, correction/audit evidence, and failure rollback. Description drafting may use the approved transcript and scripture context but can never self-approve. Rehearse all three outputs on an approved non-production batch first; do not contact providers or claim progress under Phase 3B.1a.
- Non-blocking maintenance note remains: `pg` 8.22 warns that automatic `pgpass` support will be removed in pg 9. An approved asynchronous password provider/secret-store adapter is required before that major upgrade; no credential was read, displayed, or logged in this milestone.
