# Repository Operating Rules

## 1. Authority and startup

Before repository-changing or state-dependent work, read this file, `README.md`, `church-website-architecture-plan.md`, `decision-log.md`, and relevant plans/contracts; inspect relevant Git state. Do not rely on prior-chat memory. Higher-priority instructions govern; this file cannot expand authority.

Inspect private ignored contents only when required. Report only remote names and redacted configuration.

The live legacy database is authoritative for stored facts; the approved static plugin snapshot describes intended behaviour only for that snapshot. Stop on conflict.

## 2. Permanent protections and task authority

Task prompts authorise only their stated scope and may invoke only exceptions expressly made subject to current-task authority below. They cannot waive permanent protections; changing one requires a separate explicit request to review and modify `AGENTS.md`.

Production mutation/deployment, destructive operations, external/provider use, paid activity, and Git publication require explicit current-task scope and all approved safety, readiness, change-control, and rollback gates. Read-only authority grants no mutation; earlier authority does not carry forward.

## 3. Production WordPress and MariaDB

Do not contact production without explicit current-task read-only authority. WordPress/MariaDB are read-only migration sources; never mutate their data, schema, files, plugins, or objects. Changing this boundary requires a governance change and direct production-task authority.

Allowed SQL: `SELECT`/read-only CTEs, `SHOW`/`SHOW CREATE`, `DESCRIBE`, and read-only transaction/session guards. Never use `PROCESS`/`EVENT`/`TRIGGER`, inspect unrelated activity, execute routines, load data, or run DML/DDL.

Inspect proprietary plugins statically; never install, activate, execute, edit, or copy them.

## 4. Disposable local PostgreSQL

Writes require explicit current-task authority and `ALLOW_LOCAL_DB_WRITE=1`. Until an approved gate replaces it, the only disposable local application write target is PostgreSQL 16 database `savinggrace_sermons_test` on loopback port `5432`.

Before writing, verify loopback, port, exact `_test` database, PostgreSQL 16 rather than MariaDB, and gate; stop on mismatch. Use protected authentication; never display/embed credentials, secrets, or secret-bearing connection strings. Non-secret loopback test coordinates may be documented.

Administrative create/drop needs explicit authority and a proven target.

## 5. External services and local servers

Local/offline work is default. External authority must name service, purpose, data scope/limits. Provider/paid work must also name batch/retry limits, cost ceiling, privacy/retention, and stop/rollback; one approval authorises no other. Production/cloud/DNS/hosting/remotes/media/Google/analytics/Search Console/AI/transcription work needs explicit current-task authority.

Development servers and test harnesses bind only to explicit loopback such as `127.0.0.1` or `::1`. Reject wildcard, LAN, or externally reachable binds unless separately authorised. Stop temporary listeners and background processes after verification.

## 6. Architecture and dependencies

Follow the recorded stack and boundaries. Do not silently replace it, add a platform/production dependency or uncontrolled metadata store, or move privileged/database logic into client code.

New dependencies or material architecture changes require explicit authority and documented security/maintenance justification.

## 7. Secrets, proprietary material, and private content

Never expose or commit credentials, non-public connection details, tokens, password hashes, private keys, licence/authentication data, or unrelated personal data. `.gitignore` does not replace scanning.

Never commit proprietary archives, extracted source, or copied implementation. Keep real captions/transcripts/descriptions/Q&A/manifests/reports in approved ignored/private storage; exclude bodies from repository artifacts and output. Evidence uses anonymised fixtures plus safe aggregates, non-sensitive identifiers, hashes, statuses, and warnings.

## 8. Git and user changes

Preserve every user state/change. Exact current-task authority is required to mutate files, index, branches, or history, including destructive operations, switching, staging, unstaging, or committing.

Before commit, review names/diffs and scan credentials, keys, proprietary source, private content, and symlinks; stage only intended files; invent no identity. Remote configuration/use/publication needs separate authority. Remote inspection stays local and redacted.

## 9. Verification and evidence

For task-authorised material implementation, run applicable gated checks: `npm test`, `npm run check`, `npm run build`, anonymised importer dry run, offline dependency audit, and secret/key/cloud/proprietary/private-content scans.

Database changes require `npm run test:postgres` on the authorised disposable database with zero skips; skipped tests are not evidence. Migrations also require apply, independent rollback, clean reapply, idempotent rerun, and object/constraint/index checks.

For milestone evidence, record safe commands/results/defects/regressions in the validation plan. Never claim unrun verification, production behaviour, content accuracy, or SEO parity.

## 10. Sermon and administration invariants

Every sermon has one speaker; temporary absence is allowed only while incomplete. Never silently choose among multiple source speakers.

Use the repository-scoped `sermon-enrichment` skill for every creation, regeneration, review, or validation of transcript-grounded sermon descriptions or Q&A drafts. Its current approved-transcript, grounding-evidence, private-draft, stale-result, and human-authority gates are mandatory; mechanical excerpt assembly is not an enrichment method.

Schedule, publish, and historical launch readiness require that speaker, approved `sermons.summary`, approved transcript, five to ten ordered approved Q&A, required metadata, and controlled media. Generated/imported content stays draft; it never self-approves or silently overwrites approved content.

Administration uses one approved `admin` level, default denial, explicit transitions, and optimistic concurrency. Only published sermons with approved content are public/searchable; everything else stays unavailable and non-indexable.

The human administrator owns transcript accuracy, Scripture/theological verification, and publication. Automation retains uncertainty, provenance, and warnings and never impersonates the administrator.

Permanent deletion requires archived state, exact slug/title confirmation, row version, reason, tombstone, audit, and redirect-or-gone safeguards. It never affects WordPress.

## 11. Public rendering and SEO

Whole-site SEO non-regression blocks launch; follow `seo-migration-validation-plan.md`, `legacy-url-redirect-plan.md`, and `search-parity-matrix.md`.

Preserve URLs/signals through one-to-one mapping and direct reviewed `301` redirects. Primary content/links must be server-rendered without JavaScript.

Approved descriptions stay visible before media/transcript/Q&A. Approved transcripts/Q&A stay in initial HTML; only transcripts may use accessible native disclosure. Unapproved content stays private; FAQ structured data is not automatic.

Missing parity blocks launch; do not guarantee rankings.

## 12. Stop conditions

Stop on conflict, missing authority, failed safety checks, overlapping changes, possible exposure/cost, or unauthorised production, destruction, deployment, publication, or external-service work. Before out-of-scope action, report target, risk, and rollback.
