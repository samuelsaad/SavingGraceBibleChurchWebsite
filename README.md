# Saving Grace Bible Church Website

Local Phase 3B.2 caption/enrichment rehearsal, Phase 3B.2b punctuation hardening, and a guided private administrator-review workflow for the Astro/TypeScript/PostgreSQL replacement described in `church-website-architecture-plan.md`.

## Current scope

- Fail-closed journalled local PostgreSQL schema runner plus explicit standalone rollback SQL
- Typed public/admin sermon API contracts
- Runtime input validation
- Parameterized PostgreSQL public sermon repository
- Framework-independent `/api/v1/sermons` list/detail HTTP router
- Server-rendered local public sermon archive/detail routes with legacy-compatible search and filters, stable pagination, metadata-related sermons, mapped `301`/`410` handling, and a published-only sermon sitemap
- Offline description-only semantic foundation with a verified external BAAI ONNX model, locked local-only Transformers.js adapter, exact float32 scoring, shared eligibility/stale-removal guards, pending quality status, no model files in Git and no public **Related themes** output
- Provider-independent protected admin handlers with allowlisted local test identities
- Final default-deny single-`admin` policy with no editor/contributor or ownership-based behaviour
- Transactional create/update/relationship operations, explicit lifecycle transitions, audit, and row-version concurrency
- Exactly one nullable-while-incomplete speaker relationship; schedule/publish requires one and migration refuses multi-speaker anomalies
- Idempotent local reference seeding for the seven confirmed speakers and the exact 66-book Protestant canon, with deterministic identities, canonical order, supported Bible-book aliases, no automatic sermon assignment, and relationship-derived administrator/public counts
- Reused `sermons.summary` as the reviewed public **Sermon description**, with explicit lifecycle/provenance, approved-only weight-C search and controlled `seo_description` fallback
- First-class reviewed plain-text transcripts and 5–10 ordered reviewed Q&A pairs with approved-only lower-weight search
- Derived readiness, a 448-currently-published-candidate public-launch gate, deterministic enrichment queue, and idempotent draft-only import contract
- Private YouTube Studio caption-file processor with trusted exact-scope derivation, deterministic punctuation-only chunks and hashes, whole-sermon lexical-token preservation/rollback, structured source provenance/warnings, and no media/network implementation
- Legacy query/date compatibility translation
- Deterministic Advanced Sermons dry-run importer
- Loopback-only anonymised fixture loader with an explicit write opt-in
- Date, status, slug, taxonomy, scripture, and media transformations
- Structured migration audit/warning output
- Permanent whole-site SEO non-regression, one-to-one URL mapping, and launch-gate planning
- Responsive accessible local `/admin` foundation plus a dedicated one-stage-at-a-time `/admin/sermons/:id/review` workflow for imported drafts, with one decision per deterministic atomic finding, exact identity-set completion gates, large transcript/Q&A editors, persistent progress, explicit approval, optimistic concurrency and audit
- Server-rendered uncollapsed approved description before media/transcript/Q&A; collapsed transcript remains in initial markup and list payloads omit heavy bodies
- Automated migration, security, lifecycle, configuration, and schema-contract tests
- Static `/health.json` build metadata explicitly marked `runtimeHealth: false`; a genuine runtime health check remains future work

This milestone does not include deployment, cloud infrastructure, Cognito configuration, production loading, the remaining 450 sermons, external providers, audio/video processing, new transcription, or any WordPress/YouTube mutation. Phase 3B.2b was limited to the two records identified by the committed Phase 3B.2 outcome as requiring manual punctuation; it did not reprocess the already-successful record. A read-only reconciliation on 17 August 2026 confirmed that all three authorised pilot records remain private draft sermons and have completed guided reviews, approved transcripts, approved descriptions, seven approved Q&A pairs each, confirmed identity metadata and one canonical Bible-book assignment each. The 42/44 atomic sets contain 76 accepted and ten corrected current decisions with none pending, unresolved or rejected; the third record has a separately audited zero-finding acknowledgement. Retained source warnings remain private provenance and do not imply publication or overall pilot acceptance. No explicit whole-pilot acceptance record exists. The AWS runtime and Astro production adapter remain intentionally undecided.

The approved direction is a complete WordPress replacement, with WordPress remaining live until authorised cutover. Continue Astro/API/PostgreSQL, preferably a statically generated public site separated from protected administration/API/PostgreSQL. Production administration will use individually attributable MFA identities for Samuel and Yang or another authorised church administrator. Exact AWS services/pricing are undecided; target ongoing hosting below A$70/month where practical and avoid unnecessary NAT, Fargate, RDS Proxy or Multi-AZ infrastructure. There is no fixed launch month. The five pending sermons remain unpublished and do not block the 448-candidate public launch gate; the three WordPress drafts remain excluded.

Operational local work is restricted to `savinggrace_sermons_test` on `127.0.0.1:5432`. `npm run test:postgres` refuses that persistent pilot database and instead creates a strongly named unique loopback database, runs the complete PostgreSQL suite, and drops only that exact disposable target. The schema runner uses a separate `schema_migrations` journal, stable checksums of each paired up/down definition, an advisory lock, exact-prefix validation and transactional DDL/receipt writes. A matching fully applied schema is a no-op; unknown, changed, missing, duplicate, reordered or unjournalled history fails closed instead of being baselined.

The implemented admin routes, authorization, transition, deletion, and dashboard contracts are documented in `admin-api-contract.md`. There is one non-secret local admin identity, disabled by default, limited to loopback/development, and never a substitute for the future verified identity adapter.

## Permanent SEO launch gate

The current website performs well in organic search. The rebuild must preserve its established search signals at minimum across the entire website and should improve technical SEO only when safely validated. Production launch is blocked unless complete URL mapping, metadata/canonical parity, direct redirects, crawlability/indexability, sitemap/robots/structured data, internal-link, mobile/accessibility/performance, pre-launch crawl, and rollback evidence pass the requirements in `seo-migration-validation-plan.md`.

Ranking improvements are not guaranteed. Primary indexable content must be server-rendered and visible without client-side JavaScript; non-public/admin/search/preview/staging routes must remain non-indexable. The known staging-origin social-image defect must be corrected before launch. A fresh production crawl or Search Console/analytics access requires a later explicitly approved read-only task and has not been performed in this local milestone.

## Local commands

```text
npm install
npm run check
npm test
npm run test:postgres
npm run build
npm run migration:dry-run -- --input tests/fixtures/dry-run.json
npm run enrichment:export-queue-local -- anonymised-local-fixture
npm run enrichment:import-draft-local -- path/to/strict-local-draft-bundle.json
npm run enrichment:pilot-local -- path/to/ignored-private-pilot-manifest.json
npm run enrichment:punctuation-local -- prepare path/to/ignored-private-pilot-manifest.json video-id private-workspace
npm run db:apply-atomic-review-local
npm run db:rollback-atomic-review-local
npm run reference:apply-local
npm run reference:rollback-local
npm run launch-readiness:local
```

The dry-run command accepts an approved local JSON input and prints only the safe migration report. It does not connect to MariaDB or PostgreSQL and never writes records. Original media/embed values remain internal migration provenance and are deliberately omitted from stdout.

The enrichment queue is deterministic by safe source WordPress ID and missing requirement across description, transcript and Q&A. Draft import requires the same loopback/write gate as fixture loading, validates target/source identity and row version, rejects HTML-like content, stores private structured provenance, remains idempotent, never marks content reviewed/approved, and refuses to replace different approved descriptions, transcripts, or Q&A. The private pilot commands read local caption text only and contain no downloader, audio processing, speech-to-text, provider or network implementation. Phase 3B.2b normalises source and cleaned text to Unicode NFC, measures whitespace-delimited lexical-token sequences independently, strips only Unicode punctuation from each token for comparison, and case-folds the remainder. It rejects any token count, boundary, order or content change—including splitting or merging—while allowing punctuation, case and line-break changes. Stable chunks, cryptographic hashes, deterministic reassembly, exact-two trusted scope, no-clobber persistence and fail-closed verification were exercised by the authorised private exact-two run. Import itself created no approval; the later recorded administrator actions completed all three reviews while every sermon remained draft and private.

When a disposable loopback PostgreSQL database is available, apply the schema and load the anonymised fixture only with both `DATABASE_URL` and `ALLOW_LOCAL_DB_WRITE=1`:

```text
npm run db:apply-local
npm run migration:load-local -- --input tests/fixtures/dry-run.json
npm run api:local
npm run db:rollback-local
```

The schema commands keep schema history separate from `migration_records` and `sermon_enrichment_draft_imports`. Apply runs only the pending canonical suffix. Rollback removes only the latest requested receipt, or the full applied suffix for an unscoped rollback, in the same transaction as its down SQL. The SQL files remain independently executable rollback artifacts; the runner normalises CRLF/CR/LF differences before hashing their paired definitions.

Reference seeding is a separate local data operation because migrations `0001` through `0008` already provide the required structure. It requires the same exact loopback PostgreSQL 16 test target and write opt-in, inserts only the confirmed seven speakers plus 66 canonical books/classifications, and is idempotent. Its guarded rollback refuses partial, changed, or in-use catalogue state. It never selects a speaker or Bible book for a sermon. Bible-book abbreviations and aliases are normalised only to resolve trusted import terms; ambiguous aliases fail closed. Administrator relationship counts include private drafts, while public counts include only complete published sermons, and neither count is stored as historical source truth.

After `npm run build`, the reviewed Phase 3B dashboard can be started with the existing password-free libpq credential mechanism:

```powershell
$env:DATABASE_URL="postgresql://127.0.0.1:5432/savinggrace_sermons_test"
$env:ALLOW_LOCAL_DB_WRITE="1"
npm run dashboard:local
```

Open `http://127.0.0.1:4322/admin`. The harness refuses non-loopback database and listener targets. Stop it with `Ctrl+C` after local review.

Imported Phase 3B.2 drafts open in the dedicated `/admin/sermons/:id/review` route. Stage 2 shows only unresolved findings and the exact associated transcript paragraphs in a large editable field; accepting leaves wording unchanged, while correcting atomically stores original/corrected wording and updates only that association without resetting siblings. Resolved items remain in read-only history. The route has no publish, schedule, archive or deletion action, and the general dashboard also hides scheduling until a real publication worker exists.

Operational loaders refuse every target except `savinggrace_sermons_test` on loopback port 5432. The integration runner requires its generated token and exact `savinggrace_test_run_<token>` database, and explicitly rejects the persistent pilot target.

## Project boundaries

- `src/domain`: framework-independent types and deterministic transformations
- `src/api/contracts`: stable `/api/v1` public/admin validation contracts
- `src/application`: lifecycle and permission rules
- `src/server/auth`: provider-independent identity boundary and local-only allowlisted adapter
- `src/server`: server-only PostgreSQL repository, query, and portable HTTP boundaries
- `src/migration`: journalled schema runner, importer, audit output, identity, and CLI
- `src/enrichment`: strict queue/draft contracts, provider interfaces, and local idempotent PostgreSQL draft workflow
- `src/readiness`: derived inventory/readiness reporting; the approved public-launch gate applies to the 448 published candidates
- `historical-enrichment-plan.md`: three-output Phase 3B.2 contract, review boundary and exact launch gate
- `db/migrations`: ordered PostgreSQL SQL migrations
- `tests`: anonymised fixtures and automated contract tests

## Configuration

Copy `.env.example` to a local ignored `.env` only when a local PostgreSQL service is available. Never place legacy or production credentials in repository files. A production Astro/AWS adapter has not been selected; `api:local` is a local-only Node harness around the portable request handlers.

## Source safety

The proprietary `advanced-sermons*.zip` pattern and extracted plugin directories are excluded by `.gitignore`. Plugin implementation code must never be copied into this application. The exact installed source was inspected read-only outside the workspace and is identified only by aggregate fingerprints in the discovery artifacts.

## Next approval gate

Phase 3C remains paused and the remaining 450 sermons are not authorised. The three dashboard reviews are complete, but Samuel or the appropriate decision-maker must still explicitly accept or reject the bounded pilot result; no database field or audit action currently records that whole-pilot decision. Before any larger Phase 3B.2 batch, the church must explicitly accept the verified pilot report, nominate administrator reviewers/approvers, confirm real source identities/service dates, approve the next exact allowlist and batch size, and reconfirm workload, privacy/retention, retry, correction, audit, rollback and human-approval rules. Public launch remains blocked until all 448 currently published sermon candidates pass the content gate and the whole-site SEO gate passes; the five pending rows remain unpublished and non-blocking unless separately approved.
