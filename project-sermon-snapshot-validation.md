# Project sermon snapshot validation

D-163 applies only to `codex/project-sync-for-sermons-v4` and `development-data/project-sermon-snapshot-v1/`.

Required evidence:

- export is repeatable-read and read-only against only the authorised local source database;
- manifest counts and hashes bind identities, descriptions, complete transcripts and ordered Q&A;
- relationships resolve inside the snapshot and Q&A order is contiguous;
- accounts, sessions, administrator subjects, audit events, credentials, OAuth material, tokens, keys, raw caption exports and local filenames are absent;
- V1 and V2 remain and no V3-only application entry is present;
- guarded disposable import succeeds, repeats unchanged, and creates no public, completed-preview or semantic eligibility;
- standard/PostgreSQL tests, checks, builds, audits and outgoing-history scans pass or a verified unchanged baseline defect is recorded;
- outgoing history contains no symlink, credential, key, raw caption export, private checkpoint, database dump, cache or build output.

GitHub availability is not application publication.

## Recorded results — 23 September 2026

- Source snapshot: 261 sermons, 261 complete transcripts, 1,826 ordered Q&A,
  261 provenance rows, 261 guided-review summaries, 3,098 AI-review summaries,
  and 148 sanitised restricted-acceptance summaries.
- Content SHA-256: `c128382b38fcad34ac37b545c2354f8d0a636326029da93820cf2a737f64ed2b`.
- Manifest SHA-256: `9d0f98c18cb080b53e2f402ea2e9d948ae9d9497bfcb04016bf7eef104e3e120`.
- Validation and dry run passed. A fresh guarded disposable import returned
  `imported`; its identical rerun returned `unchanged`, with zero public,
  completed-preview or semantic eligibility and zero audit churn.
- Focused snapshot tests passed (6/6); type/Astro check and production build
  passed; offline production dependency audit reported zero vulnerabilities.
- The standard suite excluding the unchanged baseline admin layout test passed
  729 tests; 125 PostgreSQL-gated tests were skipped in that non-database run.
  The PostgreSQL integration file was run separately with its gate enabled in a
  disposable database. The unchanged `admin-dashboard-layout` assertion remains
  the only reproduced baseline frontend failure; it is outside this integration.
- Snapshot scans found zero private-key headers, credential-bearing keys,
  absolute local paths, private-artifact paths or raw WebVTT headers.
