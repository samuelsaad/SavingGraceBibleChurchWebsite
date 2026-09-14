# Repository Operating Rules

## 1. Authority and startup

Before repository-changing or state-dependent work, read this file, `CURRENT_PROJECT_HANDOVER.md`, `README.md`, `church-website-architecture-plan.md`, `decision-log.md`, and relevant plans/contracts; inspect relevant Git state. Do not rely on prior-chat memory. Higher-priority instructions govern; this file cannot expand authority.

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

Never commit proprietary archives, extracted source, or copied implementation.

The sole approved real-sermon-content exception is one public, repository-tracked development dataset for exactly the existing 15 sermons used by the authenticated frontend preview: the three accepted pilots and 12 Wave 1 records. After a separate current-task export/implementation authorisation, that designated dataset may contain their church-owned titles, slugs, service dates, speakers, series, Bible books and passages, current descriptions, cleaned transcripts, ordered Q&A, YouTube video IDs, public media metadata, and frontend-required taxonomy relationships. It must be a curated, idempotently importable development seed with an exact identity/scope manifest, never a raw PostgreSQL dump. It must retain every sermon as application-level draft/unpublished data and must remain absent from ordinary public routes, public search, feeds, sitemaps, semantic processing and production builds unless later publication authority changes those application states.

That exception never includes raw YouTube Studio/API caption exports, OAuth/client/token material, cookies or administrator sessions, administrator audit evidence, database credentials, secret-bearing environment files, private keys, AWS/Google/YouTube account credentials, unrelated records, production database content, proprietary source, or model payloads. Do not infer authority for a sixteenth sermon, another dataset, publication, deployment, production access or provider activity. Outside the designated 15-sermon dataset, keep real captions/transcripts/descriptions/Q&A/manifests/reports in approved ignored/private storage and use anonymised fixtures plus safe aggregates, non-sensitive identifiers, hashes, statuses and warnings.

`CURRENT_PROJECT_HANDOVER.md` at the repository root is the canonical tracked handover. It is public-safe orientation: it may record decisions, safe repository facts, aggregate verification, the designated dataset location/format and setup commands, but it must not duplicate sermon bodies, credentials, authentication material, private local paths, administrator-session data, raw caption exports or unrelated private evidence. Update it when a completed milestone materially changes current state; historical external handovers are non-authoritative once superseded by repository bytes and the tracked handover.

## 8. Git and user changes

Preserve every user state/change. Exact current-task authority is required to mutate files, index, branches, or history, including destructive operations, switching, staging, unstaging, or committing.

Before commit, review names/diffs and scan credentials, keys, proprietary source, private content, and symlinks; stage only intended files; invent no identity. For the designated 15-sermon dataset, content-body matching is allowed only inside its approved dataset path and exact manifest scope; the same material appearing elsewhere, any out-of-scope identity, or any excluded secret/authentication/source artifact remains a blocking finding. Remote configuration/use/publication needs separate authority. Remote inspection stays local and redacted.

## 9. Verification and evidence

For task-authorised material implementation, run applicable gated checks: `npm test`, `npm run check`, `npm run build`, anonymised importer dry run, offline dependency audit, and secret/key/cloud/proprietary/private-content scans. A future designated-dataset scan must separately prove exact 15-record scope, allowed-field/path confinement, draft/unpublished import state, public/search/feed/sitemap/build exclusion and absence of every excluded credential/authentication/raw-source class.

Database changes require `npm run test:postgres` on the authorised disposable database with zero skips; skipped tests are not evidence. Migrations also require apply, independent rollback, clean reapply, idempotent rerun, and object/constraint/index checks.

For milestone evidence, record safe commands/results/defects/regressions in the validation plan. Never claim unrun verification, production behaviour, content accuracy, or SEO parity.

## 10. Sermon and administration invariants

### D-158 — restricted-environment bulk acceptance

Samuel's separate post-rejection authorization permits migration 0019 and a
non-HTTP, audited acceptance command only for the 144 completed records frozen at
manifest SHA-256 `4759449bbbaed97238968d2fd4621d4137b8b4e41b73a20aeda319dc1212617c`.
Read `restricted-acceptance-plan.md`. Record bulk authorization separately from
unchanged human and AI reviews; do not claim individual human review or sign-in.
Only the guarded local test database and verified existing sealed staging database
may receive this acceptance and restricted frontend publication. The 11 unresolved
records stay unchanged and hidden. Preserve original content, metadata, warnings,
review evidence, timestamps, hashes and unrelated navigation differences.
Migration 0019 adds immutable acceptance/withdrawal history and deterministic UTC
dependency hashes; a destructive down operation must refuse when decisions exist.
Support audited withdrawal without deleting history. Changed dependencies must
invalidate display. Legacy D-156/D-157 validation narrowly reproduces the original
Australia/Sydney JSON serialization without rewriting evidence or global settings.
The restricted visitor runtime needs no sign-in, but remains loopback/SSH-only,
non-indexable and read-only; remote admin/private-preview remain disabled.
No production/internet publication, authentication implementation, new sermon,
generation, embeddings, public Related themes, AWS networking or Git push is granted.
All normal approval, publication and privacy rules remain unchanged outside this
exact cohort/environment exception; D-151 through D-155 remain closed.

### D-157 — bounded remaining private review

For Samuel's separately delegated existing 155-record collection only, bound to
private manifest SHA-256 `c46c9125291f2d73d73162d1e0a2be42a7ce7a27c3166579e6b60fd0c7b9fa68`,
interactive Codex Astra may independently assess identity, explicit-source
speaker mappings, each finding and its exact set, transcript fidelity to retained
captions, supported primary-passage granularity and existing media references.
Record immutable, dependency-bound AI decisions under D-157, never human approvals
or personal authentication. Preserve D-156 decisions and their frozen policy,
human decisions, all content/source bytes, uncertainty and correction history.
Private transcript acceptance verifies retained-caption fidelity, not recording
accuracy; record complete deterministic comparison separately from actual
semantic-reading coverage and preserve supported prior evidence without claiming
new reading. Missing, conflicting, stale or insufficient evidence is an exception,
not a guessed assignment, cleared warning or automatic acknowledgement.
Only independently supported components may count as privately reviewed. The
guarded workflow may persist final private completion only when every current
requirement is satisfied, the sermon is draft and no publication timestamp exists.
Publication/scheduling, public/search/feed/sitemap/SEO/build/semantic eligibility
and authentication remain unchanged; D-157 is not a human publication approval.
Use retained local evidence first; the current task permits read-only official
church public pages only when needed for these records, never production databases,
YouTube APIs, new captions, media processing or another generative provider.
Read `.agents/skills/sermon-enrichment/references/remaining-review-contract.md`
before this mode. Normal human-authority and approved-transcript requirements
remain unchanged outside this exact scope.

### D-156 — delegated private AI review

Samuel explicitly authorises the new delegated-review policy for only the existing local collection frozen by the D-156 scope receipt. This is not a reopening of D-151–D-155. Read `.agents/skills/sermon-enrichment/references/delegated-review-contract.md` for this mode. Full-file source-integrity checks plus sufficient contextual transcript reading may ground private description/Q&A review and one focused correction round per artifact without transcript approval. Record semantic-reading coverage honestly; this is neither complete transcript review nor audio verification. Accepted outcomes are explicitly AI decisions under Samuel's delegation, never human approvals or personal authentication. They discharge repeated substantive description/Q&A review only for the exact content/source/policy versions accepted. Preserve human decisions, source limitations, original content, correction lineage, stale-result protection, and unrelated review stages. AI acceptance never changes publication, public-search, feed, sitemap, SEO, build or semantic eligibility. Transcript accuracy, unresolved identity/passages/findings and publication remain independent human responsibilities. Normal approved-transcript and human-authority requirements remain unchanged outside this exact delegated mode. Only current interactive Codex Astra is authorised; no separate generative API or new source retrieval. Private evidence may enter the authorised Codex review context (including bounded Astra workers), never ordinary logs, reports, screenshots, tracked files or another provider.

Every sermon has one speaker; temporary absence is allowed only while incomplete. Never silently choose among multiple source speakers.

Use the repository-scoped `sermon-enrichment` skill for every creation, regeneration, review, or validation of transcript-grounded sermon descriptions or Q&A drafts. Its current approved-transcript, grounding-evidence, private-draft, stale-result, and human-authority gates are mandatory; mechanical excerpt assembly is not an enrichment method.

The approved-transcript gate remains the default. Decision D-151 creates one non-reusable exception only for a Git-ignored, integrity-hashed manifest of exactly the 36 previously inspected, uniquely mapped and unprocessed evaluation records authorised by Samuel on 3 September 2026. For those records only, the authenticated interactive OpenAI Codex runtime may prepare a new transcript and immediately generate private unapproved description and Q&A drafts from it before transcript approval. The manifest must bind exact source/video identities, fixed order and SHA-256; failed records consume their place and cannot be replaced. Every dependent draft must record the unapproved source-transcript state and hash, D-151, manifest hash, generator/runtime provenance, generation and output hashes, mandatory administrator review, and the limited-reproducibility warning when immutable runtime identity is unavailable. A later transcript-byte or source-identity change makes the dependent drafts stale. The exception expires after all 36 manifest records have been attempted and grants no authority for another record, batch, provider, retry beyond its stated limit, approval, publication, semantic processing or production work.

Decision D-152 preserves D-151's completed failure history and authorises one retry of only that same 36-record manifest, whose canonical SHA-256 is `7e513f03cab908f30223753832211d2593ce4ffab15706ee851760385d9acb30`. The retry may reopen only positions whose D-151 terminal result was `caption_primary_audio_unconfirmed`. For this retry only, a serving, non-draft English standard or ASR caption with `audioTrackType: unknown` may be selected when channel, video, caption identity and ambiguity checks pass. It must record `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `primary_audio_confirmed: false` and `accepted_under_bounded_exception: true`; it must never claim primary-audio confirmation. Commentary, descriptive, forced, wrong-language, draft, failed, unexpected-kind and equal-priority ambiguous tracks remain rejected. D-152 reauthorises D-151's private pre-approval generation boundary only for this exact retry; the normal approved-transcript rule remains unchanged, prior attempts stay immutable, failures retain their original positions, no substitute or thirty-seventh record is allowed, and authority expires after all 36 retry positions are attempted.

Decision D-153 creates a second, separately frozen one-time exception only for the private manifest whose canonical SHA-256 is `f25979b57aae574dcd4616509d7678f7f0b8e08b28ef6911ab322762c6fd69ab`. It authorises one checkpoint-resumable attempt for each of those 36 exact ordered source/video identities and no substitute or thirty-seventh record. A serving, non-draft English standard or ASR caption may use `audioTrackType: primary` or, under this decision only, `unknown`, with priority standard-primary, standard-unknown, ASR-primary, ASR-unknown. Accepted unknown audio retains `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, `primary_audio_confirmed: false` and `accepted_under_bounded_exception: true`; it is never represented as confirmed primary audio. A complete newly prepared transcript may remain unapproved while grounding private unapproved description and Q&A drafts for later administrator review. Every dependent draft must bind D-153, the manifest and governance hashes, source transcript hash and unapproved state, generator/runtime provenance, output hash, mandatory administrator review and limited-reproducibility warning when required. Transcript/source changes make dependent drafts stale. D-153 expires after all 36 positions are terminal and grants no later-batch, approval, publication, semantic, production, deployment or provider authority.

Decision D-154 creates a third separately frozen one-time exception only for the private manifest whose canonical SHA-256 is `d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244`. It authorises one checkpoint-resumable attempt for each of those 36 exact ordered source/video identities and no substitute or thirty-seventh record. Its caption selection, truthful unknown-audio warning, private unapproved transcript grounding, current interactive Codex generation, pre-import-only correction, provenance, staleness, atomic-import and public/search/semantic exclusion rules are the same bounded controls as D-153 but bind only D-154 and its own manifest/governance hashes. The normal approved-transcript requirement remains unchanged outside this exact manifest. D-154 expires after all 36 positions are terminal and grants no later retry, replacement, approval, publication, semantic, production, deployment or other-provider authority.

Decision D-155 creates one fourth fixed-batch exception bound only to canonical manifest SHA-256 `eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a`. The exact 36 new source/video pairs were deterministically frozen in ascending authoritative source-ID order after excluding all 123 prior attempts, including provider failures; 195 clean candidates became 36 fixed positions plus 159 remaining. Only the current interactive OpenAI Codex `gpt-6-astra` runtime may sequentially prepare private word-preserving transcripts and generate private unapproved 180–220-word descriptions and five to ten grounded ordered Q&A pairs from them before transcript approval. Complete transcript and candidate prose may pass only through the minimum primary Codex tool inputs/results and session context needed for this manifest, never another agent/provider or ordinary logs, progress, reports, Git, documentation, tests, screenshots, build or public output. Official captions use standard-primary, standard-unknown, ASR-primary, ASR-unknown priority; accepted unknown audio remains explicitly unconfirmed and retains the bounded-decision warning and D-155/manifest provenance. Preserve each original candidate before validation; allow at most one pre-import correction, retain rejected bytes and lineage, and do not reset that allowance on resumption. Every result binds the governance commit, exact manifest and transcript hashes, original/corrected output hashes, truthful Astra/runtime provenance, AUD 0 separately billed API cost, mandatory administrator review and all private/unapproved/public-search-feed-sitemap-SEO-build-semantic exclusions. Unexposed runtime details use `not_exposed_by_runtime`; retain the limited-reproducibility warning. Transcript changes make dependent drafts stale; transcript approval and separate human content decisions remain required. Import only atomically into the guarded local test target, preserve all prior 119 records, and permit only byte-identical idempotency imports after success. Each failure consumes its position; no substitution or thirty-seventh record is authorised. The exception expires after all 36 positions are terminal. Normal approved-transcript and primary-audio rules remain unchanged for every other manifest; D-151 through D-154 stay consumed and immutable. No approval, publication, embeddings, production access, schema change, frontend change, merge, deployment or push is authorised.

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
