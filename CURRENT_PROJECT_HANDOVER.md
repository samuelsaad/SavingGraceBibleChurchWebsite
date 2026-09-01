# Saving Grace Bible Church Website — Current Project Handover

**Handover date:** 1 September 2026
**Purpose:** Public-safe orientation for continuing work from this repository. This file contains no sermon body, credential, token, session, raw caption export or private local path.

## Authority and current checkpoint

Treat current repository bytes and Git history as authoritative, followed by this handover, approved project documentation and clearly labelled prior-run evidence. Read `AGENTS.md` before state-dependent or repository-changing work.

At the start of the governance milestone that added this handover:

- Branch: `master`
- HEAD before the governance commit: `d9d194108daa9bbc5f148a174a5de85c20732f7a`
- Worktree and index: clean
- Git remotes: zero

Use `git status`, `git log` and `git remote` to verify current facts; do not treat the checkpoint above as a permanent invariant.

## Current application position

- The repository implements the Astro/TypeScript/PostgreSQL sermon foundation, protected administration workflow, authenticated loopback frontend preview, keyword/structured Scripture search, metadata-based related sermons and a publicly disabled description-only Related themes foundation.
- The authenticated preview uses exactly 15 completed pilot/Wave-1 sermon records from the protected local PostgreSQL test database.
- Those sermons remain application-level drafts. Git or future GitHub visibility does not make them public in the website.
- Ordinary public routes, public search, feeds, sitemaps, semantic processing and production builds must continue excluding them unless a separate administrator/publication decision changes their application state.
- No deployment, production cutover, Phase 3C or public Related themes integration is authorised by this handover.

## Exact 15-sermon public development-dataset decision

The authorised public development seed is now implemented at `development-data/preview-sermons-v1/`. It contains exactly the three accepted pilots and 12 Wave 1 sermons used by the authenticated preview, and only the church-owned frontend display fields permitted by D-148 and `AGENTS.md`.

- `manifest.json` is the exact ordered 15-slug scope and integrity manifest.
- `sermons.json` is the curated JSON seed, not a PostgreSQL dump.
- The content SHA-256 is `26a85b7e600c21941450b3b1671953586e79154c2fba50e6a40d7ccf11fc9aba`.
- The manifest SHA-256 is `132b7be1ee8e0f544acc2677d86d0c14830de24bbb84d9589bbb2ddb6dab2903`.
- The importer creates deterministic local identities, refuses partial/conflicting scope, creates no audit or guided-review rows and is unchanged on an identical rerun.
- Imported sermons are `draft` with no publication timestamp. A dedicated seed marker permits only the authenticated preview scope; ordinary public selectors, search, sitemap and semantic eligibility still require `published` state.

The seed carries current descriptions, cleaned transcripts and 103 ordered Q&A pairs plus the permitted display metadata and relationships. Where lifecycle constraints require attribution, the importer uses the explicit synthetic local subject `public-development-dataset-seed`; it does not copy or impersonate an administrator identity and is not production approval evidence.

Raw caption exports, credentials, secret-bearing environment files, OAuth material, cookies/sessions, administrator audit evidence, private keys, account credentials, unrelated records, production content, proprietary source and model files remain excluded.

## Portable Windows setup and preview

Install PostgreSQL 16 and Node.js 24 or newer. Create an empty local database named exactly `savinggrace_sermons_test` using pgAdmin or an equivalent local PostgreSQL tool. Configure a local role through the normal `pgpass.conf`, `PGPASSWORD` or interactive PostgreSQL mechanism; never place its password in this repository. Then run from PowerShell:

```powershell
npm install
$env:DATABASE_URL="postgresql://YOUR_LOCAL_ROLE@127.0.0.1:5432/savinggrace_sermons_test"
$env:ALLOW_LOCAL_DB_WRITE="1"
npm run db:apply-local
npm run reference:apply-local
npm run development-data:verify-current15
npm run development-data:import-current15-local
npm run development-data:import-current15-local
npm run frontend-preview:local
```

The first import must report `imported`; the identical second import must report `unchanged`. Open `http://127.0.0.1:4322/admin`, use the local **Frontend preview** action, and stop the server with `Ctrl+C`. GitHub visibility of the seed is separate from application publication: no seeded record is available through an ordinary public route or included in production static output.

## Handover maintenance and privacy

This repository-root file is the canonical tracked handover. Keep it concise and safe for a public GitHub repository. It may identify commits, decisions, safe aggregate results, dataset paths/formats and verified setup commands. Do not place sermon transcripts, descriptions, Q&A bodies, raw captions, credentials, authentication/session material, administrator audit detail, private local filesystem paths or unrelated private evidence here.

Update this file after a completed milestone materially changes the current checkpoint or operating boundary. Historical external handovers may be retained as prior-run evidence, but they do not supersede current repository bytes, Git history or this tracked handover.

## Immediate next bounded task

The next bounded task may perform final public-repository publication readiness and, only with fresh explicit authority, configure the intended Git remote and push this history. It must not export another sermon, change application publication state, access production or external providers, deploy, enable Related themes, process another wave or begin Phase 3C.
