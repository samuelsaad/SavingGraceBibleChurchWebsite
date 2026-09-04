# Saving Grace Bible Church Website — Current Project Handover

**Handover date:** 4 September 2026
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

## One-time private 36-sermon evaluation exception

Decision D-151 retains the approved-transcript gate as the normal rule and adds one non-reusable exception for the 36 previously inspected, uniquely mapped and unprocessed evaluation records. After this governance commit, those identities must be frozen in one exact Git-ignored manifest with a fixed order and SHA-256. The authenticated interactive OpenAI Codex run may prepare each official caption as a still-unapproved transcript and immediately use it to create private unapproved description and Q&A drafts. Failed attempts count and cannot be replaced; the exception expires after all 36 manifest positions are attempted.

Every dependent draft must retain the source transcript hash and unapproved state, D-151 and manifest binding, generator/runtime provenance, generation and output hashes, mandatory human review and the limited-reproducibility warning when the runtime does not expose immutable identity. Transcript approval is still required before dependent drafts may be approved. Any later transcript-body or source-identity change makes those drafts stale or requires explicit re-review. This narrow exception creates no content approval, public eligibility, semantic work, provider use outside the authorised official-caption and interactive-Codex paths, production access, deployment, remote use or Phase 3C authority.

The exact 36-record manifest was frozen privately with SHA-256 `7e513f03cab908f30223753832211d2593ce4ffab15706ee851760385d9acb30`. After a fresh owner OAuth flow verified the church channel and the three accepted pilot ownership anchors, every manifest position was attempted independently. The initial run stopped all 36 as `caption_primary_audio_unconfirmed` before download. That checkpoint remains preserved as historical evidence.

Decision D-152 preserved that completed checkpoint and authorised one retry of only the same integrity-bound manifest. The manifest hash—not a malformed redundant identity block—was the sole identity scope. For this retry, an otherwise eligible unambiguous English standard or ASR caption could have `audioTrackType: unknown`, with explicit provenance that primary-audio association was not confirmed.

That retry is complete. All 36 fixed positions were attempted exactly once without substitution: 32 exact ASR VTT sources were retrieved under the bounded unknown-audio rule, while four positions ended as per-record provider failures and produced no content. The 32 usable sources produced word-sequence-preserving private transcript drafts, 32 transcript-grounded 180–220 word descriptions and 224 ordered Q&A drafts. Every result records the unapproved source-transcript hash and grounding identity, D-151/D-152 and manifest binding, limited runtime reproducibility, output integrity and mandatory administrator review.

Final validation found seven generic question openings across six otherwise-valid private records and one associated grounding-evidence alignment defect. Samuel authorised one bounded correction. It changed only those seven question wordings and the required private support metadata, preserved every answer plus every transcript and description body byte-for-byte, retained the rejected artifacts privately, and synchronised the affected output hashes, grounded references and import receipts. The correction pass repaired six records while 26 were already unchanged; the identical second import returned `unchanged` for all 32.

All 32 records remain application-level drafts in the local test database. Their transcripts, descriptions and Q&A remain unapproved; guided review remains at its initial pending stage; public/search documents, public eligibility, semantic eligibility and semantic relationships remain zero for this scope. The existing authenticated completed-sermon preview remains exactly 15 records. No real caption, transcript, description, Q&A or private manifest entered Git. D-151/D-152 are now consumed and do not authorise another retry, replacement, additional sermon, approval, publication, semantic processing, deployment, push or Phase 3C.

## Second fixed private evaluation batch

Decision D-153 authorises one separately frozen private batch bound only to manifest SHA-256 `f25979b57aae574dcd4616509d7678f7f0b8e08b28ef6911ab322762c6fd69ab`. It contains 36 fixed, unique, previously unattempted source/video identities in canonical inventory order. Each position may be attempted once and a failure consumes its place; there is no substitution or thirty-seventh record.

For D-153 only, a serving, non-draft English standard or ASR caption may have primary or unknown audio association under the recorded four-level priority. Unknown remains explicitly unconfirmed. A usable exact VTT may become a private unapproved transcript and immediately ground private unapproved description and Q&A drafts through the current interactive Codex runtime. Every result remains subject to automated validation and later real administrator review, binds the exact transcript and manifest provenance, and stays outside public/search/feed/sitemap/metadata/build/semantic eligibility. D-153 expires after all 36 positions are terminal and creates no authority for approval, publication, production, deployment, a later batch, public Related themes or Phase 3C.

## Immediate bounded task

Execute only the D-153 manifest under its checkpoint, then stop. The existing 32 D-151/D-152 records remain untouched and still require real administrator review. No review decision, approval, publication, semantic operation, production access, deployment, merge or push is authorised.
