# Saving Grace Bible Church Website

Local Phase 3B.1a single-administrator approved sermon-description and content/readiness correction for the Astro/TypeScript/PostgreSQL replacement described in `church-website-architecture-plan.md`.

## Current scope

- Final local PostgreSQL schema migration plus explicit rollback SQL
- Typed public/admin sermon API contracts
- Runtime input validation
- Parameterized PostgreSQL public sermon repository
- Framework-independent `/api/v1/sermons` list/detail HTTP router
- Provider-independent protected admin handlers with allowlisted local test identities
- Final default-deny single-`admin` policy with no editor/contributor or ownership-based behaviour
- Transactional create/update/relationship operations, explicit lifecycle transitions, audit, and row-version concurrency
- Exactly one nullable-while-incomplete speaker relationship; schedule/publish requires one and migration refuses multi-speaker anomalies
- Reused `sermons.summary` as the reviewed public **Sermon description**, with explicit lifecycle/provenance, approved-only weight-C search and controlled `seo_description` fallback
- First-class reviewed plain-text transcripts and 5–10 ordered reviewed Q&A pairs with approved-only lower-weight search
- Derived readiness, exact 453/453 historical launch gate, deterministic enrichment queue, and idempotent draft-only import contract
- Legacy query/date compatibility translation
- Deterministic Advanced Sermons dry-run importer
- Loopback-only anonymised fixture loader with an explicit write opt-in
- Date, status, slug, taxonomy, scripture, and media transformations
- Structured migration audit/warning output
- Permanent whole-site SEO non-regression, one-to-one URL mapping, and launch-gate planning
- Responsive accessible six-step local `/admin` workflow with description editor/status/actions/counts, anonymised-data notice, progress, issue filters, checklist, transcript/Q&A editing, slug redirects, and safeguarded deletion dispositions
- Server-rendered uncollapsed approved description before media/transcript/Q&A; collapsed transcript remains in initial markup and list payloads omit heavy bodies
- Automated migration, security, lifecycle, configuration, and schema-contract tests

This milestone does not include deployment, cloud infrastructure, Cognito configuration, production data loading, real historical description/transcript/Q&A production, external providers, or any WordPress mutation. The AWS runtime and Astro production adapter remain intentionally undecided. Yang's final single-admin, deletion, one-speaker, approved-description, and content-readiness decisions are recorded in `decision-log.md` and `admin-api-contract.md`.

The disposable PostgreSQL 16.14 integration has been verified against only `savinggrace_sermons_test` on `127.0.0.1:5432`: ordered migration apply, importer load/rerun, public/admin repository and API tests, live loopback HTTP requests, rollback, clean reapply, and final anonymised reload passed. The local database is left in the applied fixture-backed development state with the API harness stopped.

The implemented admin routes, authorization, transition, deletion, and dashboard contracts are documented in `admin-api-contract.md`. There is one non-secret local admin identity, disabled by default, limited to loopback/development, and never a substitute for the future verified identity adapter.

## Permanent SEO launch gate

The current website performs well in organic search. The rebuild must preserve its established search signals at minimum across the entire website and should improve technical SEO only when safely validated. Production launch is blocked unless complete URL mapping, metadata/canonical parity, direct redirects, crawlability/indexability, sitemap/robots/structured data, internal-link, mobile/accessibility/performance, pre-launch crawl, and rollback evidence pass the requirements in `seo-migration-validation-plan.md`.

Ranking improvements are not guaranteed. Primary indexable content must be server-rendered and visible without client-side JavaScript; non-public/admin/search/preview/staging routes must remain non-indexable. The known staging-origin social-image defect must be corrected before launch. A fresh production crawl or Search Console/analytics access requires a later explicitly approved read-only task and has not been performed in this local milestone.

## Local commands

```text
npm install
npm run check
npm test
npm run build
npm run migration:dry-run -- --input tests/fixtures/dry-run.json
npm run enrichment:export-queue-local -- anonymised-local-fixture
npm run enrichment:import-draft-local -- path/to/strict-local-draft-bundle.json
npm run launch-readiness:local
```

The dry-run command accepts an approved local JSON input and prints only the safe migration report. It does not connect to MariaDB or PostgreSQL and never writes records. Original media/embed values remain internal migration provenance and are deliberately omitted from stdout.

The enrichment queue is deterministic by safe source WordPress ID and missing requirement across description, transcript and Q&A. Draft import requires the same loopback/write gate as fixture loading, validates target/source identity and row version, rejects HTML-like content, records only a checksum receipt, remains idempotent, never marks content reviewed/approved, and refuses to replace a different approved description. The launch command is expected to exit unsuccessfully for the local three-record fixture and for production until all 453 included historical rows have approved descriptions and every other requirement.

When a disposable loopback PostgreSQL database is available, apply the schema and load the anonymised fixture only with both `DATABASE_URL` and `ALLOW_LOCAL_DB_WRITE=1`:

```text
npm run db:apply-local
npm run migration:load-local -- --input tests/fixtures/dry-run.json
npm run api:local
npm run db:rollback-local
```

After `npm run build`, the reviewed Phase 3B dashboard can be started with the existing password-free libpq credential mechanism:

```powershell
$env:DATABASE_URL="postgresql://127.0.0.1:5432/savinggrace_sermons_test"
$env:ALLOW_LOCAL_DB_WRITE="1"
npm run dashboard:local
```

Open `http://127.0.0.1:4322/admin`. The harness refuses non-loopback database and listener targets. Stop it with `Ctrl+C` after local review.

The loader and integration suite refuse every target except `savinggrace_sermons_test` on loopback port 5432. Real PostgreSQL integration tests additionally require `TEST_DATABASE_URL` and `RUN_POSTGRES_INTEGRATION=1`.

## Project boundaries

- `src/domain`: framework-independent types and deterministic transformations
- `src/api/contracts`: stable `/api/v1` public/admin validation contracts
- `src/application`: lifecycle and permission rules
- `src/server/auth`: provider-independent identity boundary and local-only allowlisted adapter
- `src/server`: server-only PostgreSQL repository, query, and portable HTTP boundaries
- `src/migration`: importer, audit output, identity, and CLI
- `src/enrichment`: strict queue/draft contracts, provider interfaces, and local idempotent PostgreSQL draft workflow
- `src/readiness`: derived exact-count historical launch gate and safe CLI report
- `historical-enrichment-plan.md`: three-output Phase 3B.2 contract, review boundary and exact launch gate
- `db/migrations`: ordered PostgreSQL SQL migrations
- `tests`: anonymised fixtures and automated contract tests

## Configuration

Copy `.env.example` to a local ignored `.env` only when a local PostgreSQL service is available. Never place legacy or production credentials in repository files. A production Astro/AWS adapter has not been selected; `api:local` is a local-only Node harness around the portable request handlers.

## Source safety

The proprietary `advanced-sermons*.zip` pattern and extracted plugin directories are excluded by `.gitignore`. Plugin implementation code must never be copied into this application. The exact installed source was inspected read-only outside the workspace and is identified only by aggregate fingerprints in the discovery artifacts.

## Next milestone

Phase 3C remains paused. The exact recommended next milestone is **Phase 3B.2 - controlled historical description, transcript and Q&A production/review rehearsal**. It requires separate approval of source/provider access, cost ceiling, privacy/retention terms, deterministic batches/retries, reviewer/approver assignments, distinct quality rubrics for all three outputs, correction/audit process, and rollback. Begin with anonymised/non-production rehearsal evidence; none of the 453 real descriptions/transcripts/Q&A sets is complete, and launch remains blocked until all receive explicit human approval and the separate whole-site SEO gate passes.
