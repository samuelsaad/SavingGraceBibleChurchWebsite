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

Samuel Saad has authorised a future public, repository-tracked curated development seed for exactly the three accepted pilots and 12 Wave 1 sermons already used by the authenticated preview. The permitted fields are limited to the church-owned frontend display data described in D-148 and `AGENTS.md`.

This governance checkpoint does not contain or export that dataset. A later separately authorised implementation must:

1. Derive the data only from the approved local PostgreSQL test database and approved project sources.
2. Freeze an exact 15-record identity/scope manifest.
3. Export only the fields and relationships needed to reproduce the frontend preview.
4. Provide an idempotent, no-clobber importer rather than a raw database dump.
5. Keep all imported sermons draft/unpublished.
6. Prove public-route, search, feed, sitemap, semantic and production-build exclusion.
7. Add fresh-computer PowerShell setup commands only after those commands have been implemented and verified.

Raw caption exports, credentials, secret-bearing environment files, OAuth material, cookies/sessions, administrator audit evidence, private keys, account credentials, unrelated records, production content, proprietary source and model files remain excluded.

## Handover maintenance and privacy

This repository-root file is the canonical tracked handover. Keep it concise and safe for a public GitHub repository. It may identify commits, decisions, safe aggregate results, dataset paths/formats and verified setup commands. Do not place sermon transcripts, descriptions, Q&A bodies, raw captions, credentials, authentication/session material, administrator audit detail, private local filesystem paths or unrelated private evidence here.

Update this file after a completed milestone materially changes the current checkpoint or operating boundary. Historical external handovers may be retained as prior-run evidence, but they do not supersede current repository bytes, Git history or this tracked handover.

## Immediate next bounded task

The next task may inspect the existing migrations, importer contracts, private preview architecture and exact local 15-record scope, then implement the portable development dataset under D-148. It requires fresh current-task authority for read-only PostgreSQL access and any local test-database writes or disposable PostgreSQL verification. It must not access production or external services, export another sermon, publish content, deploy, push or begin Phase 3C.
