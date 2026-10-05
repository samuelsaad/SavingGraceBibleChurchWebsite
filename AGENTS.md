# Repository Operating Rules

## Bounded SermonAudio follow-through (5 October 2026)

Samuel separately authorized this protected-file amendment after the earlier
media-freshness and Git-publication boundary. The private reconciliation is bound
to SHA-256 `778d7935819f395936eeabf142da2defdc32e59fc45f7162de5676c89bfa7927`.
Revalidate each source/version and independently review recording identity and
church evidence before media-only writes. Preserve immutable prior decisions;
only current prior acceptance plus a separately supported media review may create
an audited replacement restricted receipt in the same transaction. Unrelated holds
stay held. This does not authorize content regeneration or human approval.
The versioned, application-allowlisted SermonAudio review/acceptance extensions
are bound to immutable audit payload hashes and full current dependencies; no
schema change or ordinary public-selector change is required. D-166's exact
148-member staging set and existing access boundaries remain mandatory; the
explicit current task permits verified media dependency refresh for those same
members, not population expansion or stale display.

For this task only, `frontend/astra-impeccable-staging` may publish its reviewed
existing dataset-bearing history and safe integration changes to Samuel's named
SavingGraceBibleChurchWebsite GitHub repository through a normal push. This
includes its already tracked development datasets/snapshot, not additional
private material. Visibility stays unchanged. Raw captions, credentials, OAuth,
keys, accounts/sessions, dumps and private reconciliation remain prohibited.
All permanent rules outside this bounded exception remain unchanged. See the
SermonAudio follow-through entry in the decision log and integration contract.

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

The sole current real-sermon-content Git exception is bound to branch `codex/project-sync-for-sermons-v4`. On that branch only, the complete current local sermon collection may be exported, committed and pushed at the user's explicit request through `development-data/project-sermon-snapshot-v1/`; the existing `development-data/preview-sermons-v1/` subset may remain. The collection snapshot must be a deliberate, hash-bound, idempotently importable projection, never an unrestricted database dump. It may contain church-owned sermon identities, metadata, complete transcripts, descriptions, ordered Q&A, relationships, lifecycle labels, non-secret provenance, warnings, findings and sanitised review or restricted-acceptance evidence. Repository availability does not alter application review, approval, publication, public-route, search, feed, sitemap, build or semantic eligibility.

This exception never includes raw YouTube Studio/API caption exports, OAuth/client/token material, cookies, administrator accounts or sessions, administrator subject identifiers, unrestricted audit events, database credentials, secret-bearing environment files, private keys, AWS/Google/YouTube account credentials, proprietary source, or model payloads. No other branch, dataset, later sermon, provider operation, deployment, publication, or production access is implied. Outside the exact authorised paths and branch, keep real captions/transcripts/descriptions/Q&A/manifests/reports in approved ignored/private storage and use anonymised fixtures plus safe aggregates, non-sensitive identifiers, hashes, statuses and warnings.

`CURRENT_PROJECT_HANDOVER.md` at the repository root is the canonical tracked handover. It is public-safe orientation: it may record decisions, safe repository facts, aggregate verification, the designated dataset location/format and setup commands, but it must not duplicate sermon bodies, credentials, authentication material, private local paths, administrator-session data, raw caption exports or unrelated private evidence. Update it when a completed milestone materially changes current state; historical external handovers are non-authoritative once superseded by repository bytes and the tracked handover.

## 8. Git and user changes

Preserve every user state/change. Exact current-task authority is required to mutate files, index, branches, or history, including destructive operations, switching, staging, unstaging, or committing.

Before commit, review names/diffs and scan credentials, keys, proprietary source, private content, and symlinks; stage only intended files; invent no identity. On `codex/project-sync-for-sermons-v4`, authorised sermon-content matching is allowed only inside `development-data/preview-sermons-v1/` and `development-data/project-sermon-snapshot-v1/`; the same material elsewhere, any out-of-scope identity, or any excluded secret/authentication/source artifact remains a blocking finding. Remote configuration/use/publication needs separate authority. Remote inspection stays local and redacted.

## 9. Verification and evidence

For task-authorised material implementation, run applicable gated checks: `npm test`, `npm run check`, `npm run build`, anonymised importer dry run, offline dependency audit, and secret/key/cloud/proprietary/private-content scans. Dataset scans must prove exact manifest scope, allowed-field/path confinement, private projection import behavior, public/search/feed/sitemap/build exclusion and absence of every excluded credential/authentication/raw-source class.

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

### D-166 — bounded public raw-IP staging preview

Samuel separately authorised internet access to the already deployed church-site
visitor frontend on staging instance `i-0f7abc9421733e79c` at
`http://54.253.237.138:8080/`. He explicitly chose plain HTTP for this temporary
raw-IP preview. This exception overrides the loopback/SSH-only transport boundary
in D-158 and D-161 for the exact 148 currently restricted-accepted staging records:
the 144-record D-158 manifest plus four D-161 restricted acceptances. The sorted
148-sermon identity set, one ID per line with a final newline, has SHA-256
`4bf7dbdb97d7ef98e9dd1aa9153f0e04c977776f08e0ba0a420fb266304f1731`.
Four of these records remain application drafts; this is an explicit public
staging-display decision, not administrator approval or production publication.

Expose only the existing read-only visitor runtime on TCP 8080. Keep the database,
draft-preview, administrator routes and administrator APIs unavailable externally.
Retain no-store/noindex, current content selectors, provenance, review states and
publication flags. Do not expose any newly accepted record under this exception:
if the accepted identity-set hash or eligibility changes, close the public listener
until separately authorised. Do not change Claude's application code, add a new
content batch, publish in production, open another port, push, merge or deploy to
another host. The SSH/loopback access path must continue working and the public
listener must have a tested reversible removal procedure. This bounded staging
exception does not relax normal public-launch readiness or any other cohort's
privacy and approval rules.

### D-162 — seventh fixed private enrichment and review batch

Samuel separately authorises only manifest SHA-256
`e47da706e8b458bed6f8198570cc4a51e4b9604049e394d71a02cc84f79ea17f`.
Its 36 identities are the first 36 clean records in the preserved ascending
authoritative source-ID order after 231 earlier attempts, leaving 51. No
substitution or thirty-seventh record is permitted. For this manifest only, the
current primary Codex session may retrieve eligible official English captions,
prepare word-preserving private transcripts, and use complete but unapproved
transcripts to generate private descriptions and ordered Q&A. Samuel selected
`gpt-5.6-sol`; store that selection separately from runtime-reported identity,
using `not_exposed_by_runtime` rather than inventing unavailable metadata.

Preserve complete grounding, uncertainty, source/output hashes, every original
candidate and at most one focused correction round. The established bounded
unknown-audio warning and false primary-audio confirmation apply only to this
manifest. After atomic local import, D-162 may perform separately attributed
substantive AI review of every current description and Q&A plus evidence-supported
identity, speaker, passage, finding, retained-caption and media checks. Restricted
acceptance is allowed only when all exact current dependencies pass; unresolved or
redacted evidence remains pending. Necessary private prose may enter only the
primary Codex tool/session context and ignored persistence, never ordinary logs,
reports, Git, tests, screenshots, another provider or agent.

The same task may reconcile existing current review evidence and synchronize only
qualifying restricted acceptances to the established loopback local and sealed
staging frontends through scoped, recoverable, idempotent transfer. This creates no
human approval, production/public eligibility, semantic eligibility or publication
authority. Normal approved-transcript, human-administrator, privacy and publication
rules remain unchanged everywhere else. Read `seventh-private-batch-plan.md`.

### D-167 — eighth fixed private enrichment, review and protected-preview batch

Samuel separately authorises only the integrity-frozen 36-position manifest
SHA-256 `0218989d1c09224ed301caecb915cefc787a5017f28f6253aee3020a7c3b3ae5`.
It takes the first 36 clean source/video pairs in preserved ascending mapping
order after 267 previous attempts, leaving 15; no substitution, retry of a
terminal failure or thirty-seventh record is authorised. For these records only,
eligible official captions may be retrieved, complete word-preserving private
transcripts may remain unapproved, and the current primary Codex session may use
those transcripts to generate grounded private description and ordered Q&A drafts.
Samuel's selected Sol label is not proof of runtime identity; record selection
and actually exposed runtime metadata separately, with unavailable markers rather
than invented model, revision, session or privacy details. No separately billed
generative API or other provider is authorised.

Preserve original candidates and at most one focused correction per artifact;
retain exact source, transcript, support and output hashes, uncertainty and the
bounded unknown-audio warning with `primary_audio_confirmed: false`. Only
validated private, unapproved drafts may be atomically imported to the guarded
local test database. Substantive AI review must examine every current description
and ordered Q&A against its complete transcript; automated validation alone is
insufficient. Record truthful AI attribution, exact dependencies and exceptions.
Evidence-supported identity, speaker, passage, finding, retained-caption and media
decisions may support private completion and a separate restricted-frontend
acceptance only when every applicable requirement genuinely passes. Preserve
unresolved or redacted cases for review; never fabricate human approval.

Necessary private prose may enter only this primary Codex task's tool inputs,
results and retained session history and ignored private storage, never ordinary
assistant messages, logs, Git, documentation, tests, screenshots, another agent
or provider. This exception expires when all 36 fixed positions have terminal
processing and review outcomes. The normal approved-transcript, primary-audio,
human authority, privacy and publication gates remain unchanged elsewhere.

Newly eligible sermons may enter the authenticated local restricted preview and
a separate protected staging runtime backed by an isolated staging database,
through scoped, recoverable and idempotent synchronization. Preserve Claude's
current church frontend. The existing public raw-IP listener, its database and
its exact 148 accepted sermons under D-166 must remain unchanged. No new public
listener, public selector change, production publication, semantic processing,
Git push or additional batch is authorised. Read `eighth-private-batch-plan.md`.

### D-160 — sixth fixed private draft batch

Samuel separately authorises the protected instruction amendments for only manifest
SHA-256 `0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`.
Its 36 identities are fixed in the verified inventory's ascending source-ID order
after excluding all 195 prior attempts; no substitute or thirty-seventh record is
permitted. For this manifest only, the complete prepared but unapproved transcript
may ground private unapproved descriptions and Q&A in the current primary Codex
session. Samuel selected the label `gpt-5.6-sol`; store that label separately from
verified runtime identity. Runtime model, immutable revision, session and privacy
details that are not exposed must remain unavailable and must never be invented.
Do not copy Astra attribution from D-151 through D-159 or rewrite their provenance.

Apply the complete whole-transcript grounding, source-word preservation, uncertainty,
editorial, stale-result, private-draft and administrator-review rules. Preserve every
original candidate and permit at most one recorded pre-import correction. Official
YouTube selection uses standard-primary, standard-unknown, ASR-primary, ASR-unknown
priority. Unknown association remains explicitly unconfirmed and retains
`CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, the D-160/manifest
binding, `primary_audio_confirmed: false` and `accepted_under_bounded_exception: true`.
Private source/transcript/candidate prose may pass only through necessary primary
session context and ignored persistence, never ordinary logs, reports, Git, tests,
screenshots, another provider or agent. External generative API cost is AUD 0.
Atomic guarded local imports and identical reruns create no approval, acceptance,
public/search/build/semantic eligibility or administrator decision. A failure consumes
its fixed position; systemic access/quota failure pauses untouched positions. D-160
expires after 36 terminal outcomes. All permanent safeguards and the ordinary approved-
transcript rule remain unchanged outside this manifest. Read
`sixth-private-batch-plan.md` before using this mode.

### D-159 — fifth fixed private draft batch

Samuel separately authorises the protected instruction amendments for only manifest
SHA-256 `49c7eac788ce5564678cc3ff0c8aa72ec09f3e4e8f746044c1c6e4ed00ea5297`.
Its 36 new identities are fixed in the verified inventory's ascending source-ID order;
all 159 earlier attempts and the 11 separately unresolved existing sermons are excluded.
For this manifest only, current interactive Codex Astra may prepare word-preserving
transcripts and generate private unapproved descriptions/Q&A before transcript approval.
Use the existing whole-transcript grounding/validation contract, one preserved pre-import
correction at most, atomic guarded local imports and byte-identical idempotency reruns.
Private source/transcript/candidate prose may pass through only the necessary primary
Codex session context and ignored persistence, never ordinary logs, reports, Git, tests,
screenshots, another provider or agent context. No separately billed generative API is
permitted; its cost ceiling is AUD 0. Record exposed runtime identity truthfully and
retain unavailable-revision/privacy warnings without inventing guarantees.
Official YouTube captions use standard-primary, standard-unknown, ASR-primary,
ASR-unknown priority. Unknown association remains explicitly unconfirmed and retains
`CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`, the D-159/manifest
binding, `primary_audio_confirmed: false` and `accepted_under_bounded_exception: true`.
Systemic quota/access errors pause without consuming untouched positions; no automatic
retry loop is allowed. A record failure consumes its position, without substitution.
The exception expires after 36 terminal outcomes. All ordinary approval, grounding,
uncertainty, authentication and publication rules remain in force elsewhere. Preserve
existing content, acceptances, historical decisions, frontend and staging. No schema,
approval, Topical assignment, publication, semantic processing, deployment or push is
authorised. Read `fifth-private-batch-plan.md` before this exact mode.

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

### D-161 — D-160 manifest-bound delegated private review and restricted acceptance

Samuel separately authorises private AI review only for the 36 records in the
existing D-160 identity manifest SHA-256
`0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`.
This is not a new enrichment batch and does not reopen D-160 generation. The
current interactive Codex runtime may read the retained caption, complete
transcript, description and ordered Q&A for one member at a time; record only
runtime metadata that is actually exposed and use the approved unavailable
markers otherwise. Never relabel earlier Sol generation provenance.

For each exact current artifact, D-161 may record truthful AI acceptance,
`needs_human`, or one preserved focused correction followed by revalidation.
Identity, explicit-source speaker, supported passage, each finding/set,
retained-caption fidelity and existing media identity may be accepted only from
hash-bound evidence. Transcript review is fidelity to the retained caption, not
audio verification. Redacted, conflicting, stale or insufficient evidence stays
pending with the required information stated; it is never guessed or cleared.
Human approvals and every D-156/D-157/D-158 decision remain unchanged.

Private completion is valid only when every current substantive and component
requirement is satisfied, the record is still private, dependencies are current,
and no genuine exception remains. A separate immutable D-161 restricted-frontend
receipt may then expose only that accepted subset in the authorised loopback and
sealed-staging visitor runtime. It is AI-attributed restricted acceptance, not a
human approval or internet-publication decision. Ordinary public selectors,
authentication, anti-indexing, no-public-database-port, stale-result, audit,
concurrency, tombstone and publication protections remain unchanged. D-161 is
bound to the exact D-160 manifest, permits no additional sermon or provider, and
grants no production, public-network, semantic, embedding, push or deployment
authority beyond synchronising the accepted subset to the already authorised
sealed staging environment.

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
