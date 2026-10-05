# Saving Grace Bible Church Website — Current Project Handover

## Controlled SermonAudio integration — 4 October 2026

The media section now supports a validated, single-sermon SermonAudio player,
loaded only after explicit activation, with a normal fallback link. YouTube,
church pages, sermon layouts, content selectors and privacy controls are retained.
No new dependency, schema, content generation or publication decision is involved.

Read-only reconciliation checked the actual 311 local sermons and 464 WordPress
source sermons. Outcomes are 271 verified proposed recordings, 25 unmatched in
inspected evidence, one conflicting and 14 unavailable; none is ambiguous.
All 271 verified proposals remain pending: current immutable media-review or
restricted-acceptance dependencies would be invalidated by attachment. No media
link, review, acceptance or content row was changed, and no recording is yet
activated on a real eligible page. The private metadata-only report preserves
record-level evidence and earlier extraction versions. The official public feed
is limited to 100 entries; a full-catalogue coverage claim is not justified.

The 55-table local fingerprint remains unchanged with 311 stored / 279 eligible.
Disposable PostgreSQL tests passed all 127 database cases with zero skips. The
combined suite passed 973 cases and retains only the unchanged admin-layout
newline assertion. Astro check retains only the unchanged snapshot-importer
TS2379. Build, six staging bundles, anonymized dry run and offline audit passed.
Desktop/mobile browser checks confirmed inert initial media, keyboard activation,
correct official recording metadata and no autoplay; no audio was processed.

Both staging visitor apps now serve implementation commit
`78e4b904f6a8bc115e90d46001948912e1d245ee`. Public staging remains 191 stored /
148 eligible; protected staging remains 148 stored / 148 eligible. App-only
rollback and restoration passed with unchanged database fingerprints/listeners.
Six church-page HTML hashes match the prior release; private-route denial,
no-store/noindex and YouTube checks passed. No media mapping was applied.
GitHub publication remains blocked by the branch-specific dataset-history rule;
no AGENTS exception or push was made. See `docs/sermonaudio-integration.md` for
release/image/package hashes, coverage limits and the retained rollback procedure.

## Bookshelf containment repair — 1 October 2026

Both staging visitor applications now serve frontend-only repair commit
`a992448f0dfcc96c32b795efb89ea2ba5f4af74f`. One shared measured shelf layout
reserves label/count rows, prevents badge wrapping and uses the delivered church
font consistently across V1/V2 and scoped V4. Homepage/church presentation,
sermon content, selectors, reviews, databases and eligible membership are unchanged.
Both health checks and whole-database/private-route preservation passed; each
runtime still exposes exactly the same 148 eligible sermons. Public access remains
`http://54.253.237.138:8080/`; protected access remains the pinned loopback tunnel.
Rollback is the retained `2245fa7f11f3b342d11d81258182c6c20854ef0e` app release.

Ninety focused tests, seven network tests, both builds, offline audit and scans
passed. Standard checks retain the existing admin-layout assertion and gated
database cases; Astro check retains only the existing snapshot-importer type error.
All 16 church/shell preservation checks and live five-width spine containment
checks passed. The final live Chrome rerun passed all 64 rendered cases and 984
spine label/count checks with zero console/network errors; navigation, filters,
eligible detail and privacy checks passed on both runtimes.
See `docs/design/bookshelf-repair.md` for exact evidence and limitations.
GitHub publication remains blocked by execution review's rejection of the
question-prompt approval for the required AGENTS dataset-branch amendment.
No governance amendment or bypass publication has occurred.

## Selective Claude sermon presentation integration — 1 October 2026

The existing `frontend/astra-impeccable-staging` worktree has integrated
Claude's final V4 and sermon-detail presentation from
`6a51443d117cc9cb20e82f8d50046f77e7a4aa08` into Astra's selected site.
Astra's homepage, all church pages and shared shell styling remain unchanged.
The main Sermons destination points to V4; stable alternative/detail URLs remain.
No backend, selector, data, review or database changes are part of this task.
Scope, verification, known pre-existing failures and the preserved application
rollback release are recorded in
`docs/design/claude-sermon-integration.md`.

Both staging visitor apps now serve
`2245fa7f11f3b342d11d81258182c6c20854ef0e`,
image ID `sha256:b2c61df39b958774e0c2eaf02d1bf82e4ed4c0ecc267cd46026322608821d308`.
All 64 live rendered cases and 16 church/shell preservation comparisons passed.
Both retain exactly the same 148 eligible identities, whole-database fingerprints,
container identities, publication states, ports and private-route denial.
Focused checks: 86 passed; network checks: seven passed. Standard checks: 811
passed, one unchanged admin-layout failure and 126 gated PostgreSQL cases.
The existing snapshot-importer type error remains; static and staging builds,
offline audit and history/staged/build scans passed.
Rollback is the retained `ba52ae3c96a5f0cc093c50b0117b1a702635c84f` application.
GitHub publication remains pending the explicit AGENTS dataset-branch amendment;
no push or alternate history publication was attempted.

## Selected Impeccable staging handoff — 1 October 2026

Samuel selected the completed Sunday-invitation frontend from
`codex/impeccable-church-redesign` at
`5d737e2f3522efd02e0c96d5cc31b8b37912e3b3` for the dedicated
`frontend/astra-impeccable-staging` handoff. The source worktree was clean.
Claude's alternatives and unrelated work remain on their existing branches.
Developer setup and deployment boundaries are in `docs/design/staging-handoff.md`.

Read-only live staging reconciliation found 191 sermons and 21 migrations in
public staging, and 148 sermons and 22 migrations in protected staging. This
frontend-only task preserves each database, its selectors and access controls;
it does not synchronize sermons or apply migrations. The narrow public-runtime
compatibility opt-in checks the exact existing 21-migration ledger and is not
available with D-162/D-167 selectors. The default remains exact 22.

Focused frontend/staging tests and the sealed bundle passed. The static build
emitted 44 church pages. Standard tests reproduced only the existing admin-layout
newline assertion (803 passed, 126 gated PostgreSQL cases skipped), and Astro
check reproduced the existing snapshot-importer optional-property error. The
initial simultaneous check/build cache race was resolved by running them serially.
No database-write test or production readiness is claimed.

Both visitor apps now run release `ba52ae3c96a5f0cc093c50b0117b1a702635c84f`,
image SHA-256 `143af5e00890347a8a953e01de2017205ae1d24e421e049991262989e92802f8`.
Public staging remains `http://54.253.237.138:8080/`; protected staging remains
EC2 loopback 8082 through the existing pinned SSH mechanism. Both retain exactly
148 eligible identities with set hash
`4bf7dbdb97d7ef98e9dd1aa9153f0e04c977776f08e0ba0a420fb266304f1731`.
Whole-database fingerprints, publication states, database container identities,
original configuration files and listeners are unchanged. No migration, sermon
transfer, content/acceptance edit, production access or proxy change occurred.

Actual Chrome checks passed 64 rendered page cases at 1440, 390 and 320 pixels,
plus navigation/search/filter/detail and asset checks on each runtime, with zero
console errors or failed requests. Private routes and unpublished church pages
remain denied; no-store/noindex and robots exclusion remain. Application-only
rollback to each previous image was rehearsed successfully, then the selected
image was restored. Final standard tests were 806 passed, one unchanged existing
failure and 126 gated PostgreSQL skips. The outgoing history/build audit found
no prohibited paths, symlinks, detected keys or sermon-content build leakage.
Detailed safe evidence is in `docs/design/staging-verification.md`.

GitHub publication remains incomplete: execution review rejected the requested
push because it did not recognize trusted authorization for the full
dataset-bearing history and destination. No push occurred and no alternate
publication route was attempted. The dedicated local branch and reviewed history
are preserved for explicit resolution of that control.

## Isolated visitor redesign alternative — 28 September 2026

`codex/impeccable-church-redesign` contains a fresh Sunday-invitation design,
selected after three rendered homepage concepts. Claude's implementation and
previous alternatives remain on their original branches. This branch changes
visitor presentation, accessible navigation, self-hosted type and safe tests/docs
only; it does not change sermon data, eligibility, review decisions or deployment.

The local read-only restricted preview is `http://127.0.0.1:4401/`, with
SermonsV4 at `http://127.0.0.1:4401/sermons-v4/`. It uses the existing eligible
selector: 148 of 296 stored sermons. Admin routes remain disabled and preview
responses remain private/no-store/noindex. No database writes or migrations ran.

Design context is in `PRODUCT.md`, `DESIGN.md`, and
`docs/design/homepage-exploration.md`; verification and honest limitations are in
`docs/design/verification.md`. Build and rendered checks pass. The standard suite
retains its existing admin-layout assertion failure, and Astro check retains the
existing snapshot-importer type error. Neither unrelated file was modified.
This alternative is not merged, pushed, deployed or approved for production.

## D-167 complete, with evidence holds — 26 September 2026

All 36 fixed positions in manifest SHA-256
`0218989d1c09224ed301caecb915cefc787a5017f28f6253aee3020a7c3b3ae5`
are terminal. D-167 is consumed, not a retry or another batch authority. The
35 usable transcripts produced validated private descriptions and 245 ordered
Q&A, followed by complete-transcript substantive AI review: 280 accepted content
decisions and 210 independently assessed source-component decisions. Nine
pre-import corrections retained their originals and lineage. Sequence 24 failed
word preservation and was not imported or silently repaired.

All 35 imported sermons remain private, unapproved and held: 33 lack explicit
canonical speaker evidence, three lack supported primary-passage classification,
and six retain unresolved source-wording findings (these groups overlap).
No private completion or new restricted acceptance was created. Existing reviews
were reconciled without inventing evidence or repeating valid substantive reviews.
The local database has 296 sermons, 282 pending Stage-1 reviews and 148 currently
restricted-eligible sermons. All 12,357 baseline rows for the earlier 261 sermons
remain unchanged; identical import and speaker-assignment reruns changed nothing.

The separate protected staging database contains only the 148 current eligible
sermons and their scoped dependencies, not the 35 held imports or account/session
data. Its atomic import and post-restart replay both verified 8,076 unchanged rows
and the same full database fingerprint. It uses a distinct volume, internal
network and EC2-loopback listener; administrator routes remain disabled.
The existing public application/database and their exact 148-sermon population
remain unchanged. Claude's church frontend source and pages are byte-preserved.

The authenticated local entry is `http://127.0.0.1:4397/admin`, with preview at
`http://127.0.0.1:4397/frontend-preview/`. The separately protected staging
frontend is reached through the pinned SSH tunnel at `http://127.0.0.1:4398/`.
These are local access coordinates, not new public listeners. The deployed
protected code commit is `1f3dc7c72f8fab971c2a358a4e71ce9e4c23999f`; subsequent
completion-documentation commits do not change that image. See the execution
summary in `eighth-private-batch-plan.md`, verification in
`migration-validation-plan.md`, and isolated rollback in `deployment/README.md`.

Do not retry terminal positions, infer missing speaker/source wording, approve or
publish content, start another batch, modify the public cohort, or push Git.
Private source, candidates, corrections, checkpoints and receipts remain ignored
and unstaged. All normal approval/publication protections remain in force.

## D-167 eighth fixed batch frozen — 25 September 2026

In isolated branch `codex/next-36-after-d162`, the next 36 previously
unattempted source/video pairs were frozen from the preserved authoritative
mapping order. The canonical private manifest SHA-256 is
`0218989d1c09224ed301caecb915cefc787a5017f28f6253aee3020a7c3b3ae5`.
All 267 prior attempts were excluded; 51 clean candidates became 36 fixed
positions and 15 remaining. Its zero-attempt checkpoint, evidence hashes and
read-only database baseline are ignored private artifacts. Local PostgreSQL
contained 261 sermons and migration 0021 at freeze. No caption, transcript,
candidate, review or import operation has occurred under D-167 yet.

The required protected staging environment is a separate runtime and isolated
database reached through loopback/SSH, using the integrated D-165 church frontend.
The existing D-166 public raw-IP runtime/database and its exact 148 accepted
sermons must not change. See D-167 and `eighth-private-batch-plan.md`; do not
infer completion of processing or deployment from this scope-freeze milestone.

## The complete church website — 24 September 2026

Branch `frontend-church-site` (continuation of `frontend-sermons-v4`) carries D-165: the whole church website rebuilt from the supplied WordPress export and media archive on the same Astro/`src/frontend` foundation. Every published WordPress page has a destination with its wording transcribed verbatim (`src/frontend/content/pages/`), the church's main and footer menus drive the masthead and footer, events are computed from the export's recurrence rules with an iCalendar feed, the three posts keep their addresses, legacy addresses redirect in one hop, drafts and the private Constitution render only in the authenticated preview, and 45 reviewed images are embedded and served under `/media/` by every runtime and the static build. `website-content-inventory.md` is the reconciliation record, including the integrations that could not be completed (the Contact Form 7 mail form, the newsletter, the social accounts) and the wording the church may wish to review. The sermon system is unchanged. PostgreSQL was unavailable on the implementing machine, so `npm run test:postgres`, the snapshot import and the database-backed previews are still to be run; the standard suite, check, build, staging bundle and audit passed apart from the two documented pre-existing findings. Nothing is merged, deployed or published. See D-165 and the current entry of `migration-validation-plan.md`.

## SermonsV4 and homepage candidate — 23 September 2026

Branch `frontend-sermons-v4` (from `codex/project-sync-for-sermons-v4` at `2f0fdd1801b9b31a6b59b552689314e398580b43`) carries D-164: **SermonsV4** at `/sermons-v4/` (the SermonsV2 opening section carried over whole, the 66-book shelf folded behind a "Browse by Bible book" disclosure that is closed on first load, and an equal-size card system in which the latest sermon is the first card with a gilt ribbon), the unchanged **SermonsV1** landing page moved to `/sermons-v1/`, and a **redesigned church homepage** at `/` whose text is transcribed verbatim from the six supplied screenshots (`src/frontend/content/home-content.ts`). The Sermons menu lists SermonsV1, SermonsV2, SermonsV4, Speakers, Series and Books. The church's own logo (supplied with the brief) is embedded as bytes and served at `/brand/saving-grace-logo.png` by every runtime and by the static build; it replaces the shelf-mark wordmark in the masthead and footer. Labels without a destination this application owns render as pending labels, the phone and e-mail are plain text, and the two dated "Upcoming Events" rows are page copy as captured and need a calendar source or the church's confirmation. PostgreSQL was unavailable on the implementing machine, so `npm run test:postgres`, the snapshot import and the database-backed previews of the new routes are still to be run; the standard suite passed apart from the documented `admin-dashboard-layout` assertion. Nothing is merged, deployed or published. See D-164 and the current entry of `migration-validation-plan.md`.

## Project-sync-for-sermons-v4 handoff — 23 September 2026

The integration branch is `codex/project-sync-for-sermons-v4`, based on D-162 completion commit `9e95bc57f6267ec8f8646d3a4fa11c99a88714d4`. It contains the completed backend/admin work and the V1/V2 frontend line; the V3-only line is not part of this application tree. D-163 authorises the tracked project handoff snapshot only on this branch.

The tracked snapshot is `development-data/project-sermon-snapshot-v1/`. It is a hash-bound projection of the current local collection containing sermon content, relationships, lifecycle labels and sanitised non-secret evidence. It is not a database dump and excludes accounts, sessions, administrator subject identities, audit events, credentials, OAuth material, tokens, keys, raw caption exports and local filenames. Repository visibility changes no application state. Validate it with `npm run development-data:verify-project-sermons` or `npm run development-data:dry-run-project-sermons`. Its importer is restricted to guarded `savinggrace_test_run_*` databases, imports every sermon as draft, restores no operational acceptance/audit authority, and must be run twice to prove idempotency. See the dataset README and `project-sermon-snapshot-validation.md`.

## D-162 seventh fixed batch completed and held for evidence — 20 September 2026

Work continues only on branch `codex/next-36-after-d161`. The next 36 identities
were deterministically frozen from the verified private inventory after excluding
231 prior attempts. The exact private manifest SHA-256 is
`e47da706e8b458bed6f8198570cc4a51e4b9604049e394d71a02cc84f79ea17f`;
87 clean candidates became 36 fixed positions plus 51 remaining. The private
checkpoints, source material, candidates, decisions and receipts remain Git-ignored.
All 36 positions are terminal: 34 validated records were imported as private,
unapproved drafts and returned `unchanged` on an identical second import; two were
held after their single correction allowance. The local database contains 261
sermons and migration 0021. All 227 earlier sermons were preserved.

Substantive review covered all 34 imported descriptions and 238 ordered Q&A pairs.
Thirty-three descriptions and every Q&A passed; one description remains pending
because a genuine incomplete phrase was found after its correction allowance was
consumed. Seven imported records retain provider-redaction blockers. One missing
speaker was assigned only from an exact canonical full name in retained metadata;
the other 33 imported records lack sufficient speaker evidence, and three also lack
stored primary-passage evidence. Consequently D-162 created no restricted acceptance.
The existing 144 D-158 plus four D-161 accepted records remain the complete current
restricted population on both local and sealed staging frontends. No staging data
write or release change was necessary. Read `seventh-private-batch-plan.md`.

**Handover date:** 14 September 2026
**Purpose:** Public-safe orientation for continuing work from this repository. This file contains no sermon body, credential, token, session, raw caption export or private local path.

## D-160 sixth fixed private batch checkpoint

Samuel authorised one new fixed batch and separately authorised the protected
AGENTS/skill/grounding amendments. The private identity manifest contains 36 unique
previously unprocessed source/video pairs in retained ascending source-ID order and
has canonical SHA-256
`0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`.
It excludes 195 prior attempts and every current PostgreSQL identity; 123 clean
candidates existed before selection and 87 remain. Its service-date range is
10 November 2019 through 18 August 2024. PostgreSQL remains at 191 sermons and
144 restricted acceptance records, and the private D-160 checkpoint has zero attempts.

Samuel selected `gpt-5.6-sol` for this batch. Treat that as the user-selected label,
not verified runtime identity. Store runtime model/revision/session/privacy metadata
only when exposed; otherwise retain the required unavailable markers and warning.
D-159 and earlier Astra provenance is historical and must not be copied or changed.
No caption, transcript, generated content or database write had occurred at this
checkpoint. Continue only after committing and verifying D-160's safe governance,
contracts and anonymised tests. See `sixth-private-batch-plan.md`.

## D-159 isolated private batch checkpoint

**Completed 16 September 2026.** All 36 fixed positions were validated and imported
as private, unapproved Stage-1 drafts, then returned `unchanged` on identical
second import. The database now contains 191 sermons. Every original row across
the 43-table baseline, including 155 earlier sermons, 144 restricted acceptance
receipts and eleven earlier exceptions, is preserved. D-159 is consumed; do not
retrieve, generate, correct or import another record under this decision.

The 36 transcripts, 36 descriptions and 252 ordered Q&A retain Astra provenance,
unknown-audio warnings and administrator-review requirements. Four provider-redacted
words remain unresolved findings (three in sequence 13, one in sequence 27);
fourteen contextual editorial flags also require review. Two bounded corrections
preserved their originals: one short question in sequence 15 and support-purpose
metadata only in sequence 27. No content was approved or accepted for frontend use.

All 36 actual review pages passed isolated read-only browser verification without
changing running servers, sending external requests, taking screenshots or saving
decisions. Public and completed-preview eligibility are zero for the new scope.
Final verification passed 728 real PostgreSQL tests with zero skips, type/Astro
checks, build, dry run, offline audit and privacy/security scans. See the batch
plan's completion evidence for details and qualifications. The historical access
interruptions below are retained as history, not the current resume instruction.

The fifth fixed batch is bound only to manifest SHA-256
`49c7eac788ce5564678cc3ff0c8aa72ec09f3e4e8f746044c1c6e4ed00ea5297`.
Thirty-six new identities were frozen after excluding all 159 prior attempts.
The baseline is 155 sermons, with 144 existing restricted acceptance receipts
and eleven separate unresolved records. Those existing records are out of scope.
See `fifth-private-batch-plan.md` for authority, current execution evidence and
the distinction between new private drafts and accepted frontend records.
The pre-existing administrator UI edits remain separate uncommitted work.

D-159 governance is committed at `e67affe631cdf8542f9aada839a08f574a39dfa3`.
The initial retry-disabled channel check returned HTTP 400 with an unrecognized
structured reason; the cause remains unresolved. No captions were retrieved and
no transcript, candidate or database import was created. All 36 positions remain
pending at sequence 1; D-159 has not expired. The existing 155-record database
baseline remains unchanged. See the batch plan for test evidence and exact resume
boundaries; do not repeat selection or infer that fresh consent is necessarily
the remedy.

The 15 September continuation localized one controlled HTTP 400 response to
Google's OAuth token endpoint before any YouTube channel response. The old
unrecognized label was our classifier fallback. The specific Google error code
remains unavailable; the SDK redacts grant-type metadata. A tested opt-in
diagnostic now preserves only that non-secret operation enum and allowlisted
error/endpoint fields without disabling redaction. Execution review rejected an
additional diagnostic request as exceeding its one-request interpretation; no
further provider call or consent flow occurred. The original checkpoint and
155-record database fingerprints remain unchanged. See the batch plan for the
precise evidence and pending diagnostic authorization.

The subsequently authorised single token diagnostic returned Google's actual
`invalid_grant` code with its expired-or-revoked explanation. This establishes a
rejected refresh grant, not which of those causes occurred. No channel request or
batch processing followed. Samuel then separately authorised guarded owner renewal.
Use `npm run youtube:pilot-auth-local -- --renew` only under that current authority:
fresh system-browser consent, state/PKCE, a newly returned refresh token and exact
authenticated channel-ID verification precede atomic protected-token replacement.
The old token is not retried or deleted as a diagnostic. See the batch plan and
OAuth proof document for preservation, testing and continuation requirements.

## Authority and current checkpoint

On 25 September 2026 Samuel authorised D-166: plain-HTTP raw-IP public access
to the existing read-only church-site visitor staging frontend on TCP 8080 for
only the 148 currently restricted-accepted sermons, including four application
drafts. This is not a human approval or production publication. The exact
identity-set fingerprint and stop-on-drift rule are in `AGENTS.md` and
`decision-log.md`. Administrator, draft-preview and database access remain
private. Claude's deployed application implementation remains the exact
`6a51443d117cc9cb20e82f8d50046f77e7a4aa08` commit; this task changes
staging transport configuration, not application code.

At the earlier Topical classification checkpoint, running code was
`60b31a1e18611191f9c751e382a7c2942538db56` locally and on sealed Docker
staging. Samuel explicitly classified the nine accepted no-primary
sermons as Topical, bound to private manifest
`b1016476118bb3029a42658c78cc38e97897970b6adc553511f7cae06c7f8b56`.
Each database has nine versioned editorial extensions and nine separately attributed
audit events; both identical reruns made zero changes. No migration, content edit,
new review, acceptance supersession or publication-state change was necessary.
All original content, source evidence, human/AI reviews and D-158 receipts remain
unchanged. The 144 eligible sermons now reconcile to **135 Bible-associated sermons
across 16 books plus nine explicit Topical classifications**. All 11 unresolved
sermons stay unchanged and hidden. Missing books are not automatically Topical.
See `topical-classification-plan.md`, `deployment/HANDOVER.md` and
`deployment/STATUS.md` for current verification, recovery artifacts and access.
Local: `http://127.0.0.1:4381/`; sealed SSH-tunnel staging: `http://127.0.0.1:4380/`.

### D-158 acceptance and ordinary frontend delivery complete

Migration `0019_restricted_bulk_acceptance` and the exact manifest-bound operation
have been applied independently to local loopback PostgreSQL and sealed staging.
Both contain 144 separately recorded Samuel bulk acceptances; identical reruns
returned 144 unchanged and made no further writes. Eleven unresolved sermons
remain draft, excluded and byte-for-byte unchanged. Independent preservation
fingerprints passed for original content, metadata, human/AI reviews and audit
history. The known local navigation-only difference was retained, not synchronized.

Implementation commit: `e2b13990042ec5808b3265e825f1b6f6069daa6f`.
Packaging correction and running application: `c08b044b1f1ba14344ad05a068c4ed32ca8b99ca`.
The ordinary accepted frontend is `http://127.0.0.1:4381/` locally and
`http://127.0.0.1:4380/` through the strictly pinned staging SSH tunnel. Neither
requires administrator sign-in; administrator/private-preview routes remain
disabled in these servers. Existing local review/creative servers are preserved.
Staging still has no public application/database port. Sign-in is a separate task.

See `restricted-acceptance-plan.md` and `deployment/STATUS.md` for exact hashes,
protected independent backups, deterministic UTC versus legacy Sydney validation,
append-only withdrawal and the completed history-preserving app recovery rehearsal.
The full PostgreSQL suite passed 736 tests with zero skips. All acceptance and
publication-state changes are confined to D-158's restricted environments; this
does not authorize production or public-internet publication. Actual browsers
verified all 144 detail pages and all 11 exclusions independently in each environment,
including ordered content, discovery/search, pagination, refresh and responsive
layouts. No screenshots, external requests or browser mutations occurred.

### Prior isolated sealed-staging integration (before D-158 acceptance)

**Sealed staging is running:** following Samuel's direct post-rejection
authorization, integrated commit `c36202ddbf14eb5376edc97472c22e0d396dc941` was
packaged with narrowly scoped staging corrections. The deployed application is
`f9615104e80b03f46bfff758e9669003a3a0c5cf`; later completion documentation does
not change that image. Docker PostgreSQL 16 and the read-only application are
healthy on an internal network with no Docker-published ports. An OS socket proxy
listens only on host loopback; access is through strictly pinned SSH tunnelling.
The custom logical dump, 18 migration checksums and all 41 table/sequence hashes
matched after both initial restore and a separate empty-volume recovery rehearsal.
The original verified volume, dump and immutable image remain preserved. See
`deployment/STATUS.md` for exact hashes, final verification and remaining gates.

`staging-release-candidate` integrates the completed D-157 backend, Claude's
creative frontend and both worktrees' preserved administrator/navigation/book-tab
refinements. Original branches and worktrees are not changed. See
`deployment/README.md` for the explicitly authorized sealed EC2 Compose design,
logical restore, target checks and rollback procedure. The remotely hosted entry
point has no development authenticator: admin and private-preview routes remain
disabled until real authentication and HTTPS receive a separate implementation.
Private review completion remains distinct from publication and the unchanged
frontend selector. Current local reconciliation is 155 sermons, 144 private
completions, 11 genuine exceptions, 12 stricter frontend-preview results and zero
public results. Remote admin/private-preview requests remain denied, including
forged development-identity requests. No real authentication provider, public
network access, publication, DNS or HTTPS was enabled.

The transferred snapshot was frozen at 2026-09-14 01:24:35 UTC. Final source
verification found one later local review-navigation update, limited to current
stage, row version and update attribution/time. All content, approval, completion,
AI decision, audit and other table fingerprints remained unchanged. That later
local progress was preserved and was not copied over the verified staging snapshot;
the two databases must not be described as currently byte-identical.

The administrator presentation has been repaired on top of `ae8755a`, without
changing backend review rules or persisted decisions. `/admin` now presents current
private-review totals and evidence exceptions first, with publication readiness in
a separate disclosure. Sermon rows combine identifying metadata, expose remaining
requirements and retain expandable decision attribution. The guided form occupies
the full workspace: the extra status panel no longer displaces it into a narrow
grid column. Mobile navigation supports Escape, contained keyboard focus and an
inert closed sidebar. See the 13 September UI entry in `migration-validation-plan.md`.
The existing loopback review server serves the updated build at `/admin`; this
remains development-identity access, not personal sign-in. No database decision,
governance policy, publication gate or visitor-facing frontend was changed.

**D-157 is applied to the frozen existing 155 records.** The current private
administrator workflow has 144 completed reviews: 132 new separately attributed
Astra completions and 12 preserved human completions. Eleven records have specific
evidence exceptions, not unattempted reviews. See `remaining-private-review-plan.md`
for category totals and the distinction between private completion and publication.

Only additive migration `0018_remaining_private_ai_review` was applied after the
verified 0017 ledger. All 1,121 D-156 decisions, 118 human artifact approvals,
original content, source evidence and historical audit rows remain intact.
Five missing speaker relationships were resolved by exact retained source-term
evidence (one canonical reference added; all seven prior references preserved).
Two pending passage proposals were added and one machine-only pending range was
refined from explicit context, without changing a human passage decision.

The strict marker-aware full-source comparison gives 149 exact matches, three
human-approved transcripts with unavailable retained captions, and three genuine
redaction-loss exceptions missed by the older word-only comparison. Transcript
acceptance means retained-caption fidelity, never audio accuracy. Current reading
and reusable D-156 semantic coverage are recorded separately. No content was
regenerated or rewritten. All 155 review packets and eight metadata packets have
byte-identical idempotency verification across all database tables.

The updated private exceptions route is `/admin/remaining-reviews` on the authorised
loopback review server at `http://127.0.0.1:4360`. It distinguishes AI acceptance,
preserved human approval, source limitations and unresolved evidence. Normal
personal sign-in is not claimed: this uses the existing explicitly authorised
development identity. Private completion does not satisfy publication, scheduling,
public/search/feed/sitemap/SEO/build or semantic eligibility. D-155 stays closed.

## Prior D-156 checkpoint and preserved evidence

The D-156 status-display repair connects current version-bound AI acceptance to
administrator lists, details and guided private previews. The former "Needs work"
label was the human-only publication checklist, not missing AI decisions. All
155 current description/Q&A sets satisfy substantive review. Publication remains
separate and unchanged.

**Private handler follow-up:** Samuel explicitly authorised the scoped amendment
after the recorded execution-safety rejection. The verified draft-only guard is
retained in final completion and now explicit in navigation too; a historical
publication timestamp also blocks both. Current human or D-156 AI acceptance
satisfies only description and individual Q&A substantive review. Identity,
speaker/date, exact finding-set acknowledgement, human transcript approval,
passage and media requirements remain independently enforced. Publication
readiness is unchanged. Identical successful progress/completion requests with
current versions cause no version, timestamp or audit churn; stale writes fail.
No real review or content record was modified. The updated local queue is
`http://127.0.0.1:4359/admin/sermons`, using the existing loopback development
identity, not personal sign-in. See `delegated-ai-review-plan.md` for the preserved
rejection history, handler tests and independent remaining requirements.

D-156 delegated private description/Q&A review is complete. Implementation commit
`4d49d6afb51c44ba4c9b12fdda597a1cc63fa90e` records the separately authorised
policy, additive migration, backend, administrator display and anonymized tests.
All 140 pending descriptions and 981 individual pending Q&A were read and reviewed:
139 descriptions and 980 Q&A accepted unchanged, one description and one answer
corrected once and accepted, zero unresolved content exceptions. Their exact
versions have 1,121 separately attributed Astra decisions and audit events.
The 15 human-approved descriptions and 103 human-approved Q&A remain unchanged.

The current database remains 155 sermons, 142 pending Stage-1 reviews and 12
completed private previews. The earlier 143 Stage-1 snapshot predates intervening
administrator progress. All frozen transcript/source, metadata, finding and guided
review fingerprints match, allowing only the two authorised content/version
corrections. Eight unresolved speakers, ten unresolved passage cases, 90 existing
findings and nine provider-redaction tokens remain; AI acceptance clears none of
them. Nothing is published or semantically eligible.

All 1,121 identical decisions were replayed without change. Whole-table hashes
across eleven content, review and audit tables prove no replay churn. Retained
source hashes, VTT parsing and exact normalized transcript word order verify for
152 records; three human-approved transcripts lack a located matching source.
Semantic reading covered 139 complete pending transcripts and one explicitly
targeted transcript, separately from mechanical checks. Audio was not verified.

The read-only exceptions display is `/admin/ai-reviews`; its all-outcomes control
shows AI decisions separately from existing human approvals. Accepted current
description/Q&A versions require no repeated substantive human review. Other
administrator stages and publication gates remain in force. The verified local
review server uses the explicitly authorised development identity, not personal
sign-in; temporary settings are untracked. Normal personal sign-in is not claimed.

Migration `0017_delegated_private_ai_review` alone was applied after verifying the
ledger through 0016; its identical rerun was a no-op. The explicit post-rejection
authority permits narrowly guarded removal of sermon-linked D-156 private review
records only during a future separately authorised permanent deletion, retaining
the minimal tombstone and audit. No real sermon or review history was deleted.
All 528 guarded PostgreSQL tests passed with zero skips; standard checks, build,
offline audit, browser and private/public exclusion scans passed. Detailed counts,
limitations and historical checkpoints are in
[delegated-ai-review-plan.md](delegated-ai-review-plan.md). D-155 remains closed.

### Prior metadata and server checkpoints

Following explicit post-rejection authorization, the source-backed metadata repair
persisted 132 speaker assignments with zero conflicts; its identical second run
changed nothing. There are now 147 saved speakers and eight unresolved cases among
155 sermons. All 15 human passage decisions, 130 private proposals, ten unresolved
passage cases, completed title corrections and sermon content remain unchanged.
The 155 rendered forms retain their saved speaker/book selections after refresh,
including a preserved legacy classification. At that checkpoint counts were 143 pending
Stage-1 and 12 completed private previews. See
[review-metadata-population-plan.md](review-metadata-population-plan.md) for current
verification and clearly labelled prior rejection evidence. D-155 stays closed.

At that earlier checkpoint an updated loopback backend was available for temporary
development-identity inspection with read-only database sessions. This is not
personal sign-in; no review decision was submitted. Normal personal authentication
remains unimplemented/unconfigured. No authentication implementation or safeguards
were changed, and no temporary configuration is tracked.

The earlier local milestone added explicit primary-book metadata after the completed
title repair at `b40ef6e7f821cf49878d7fb7f7f8b3d9035ea0f6`, not another enrichment
batch. The saved 155-record plan was revalidated without conflicts. Exactly 130
evidence-supported primary passages were stored as unapproved proposals and ten
missing-evidence cases received pending unresolved reviews. All 15 existing human
passage decisions remain unchanged. The identical second application changed
nothing; independent hashes verified preservation of content, titles, source
evidence, guided progress and historical audits. See
[primary-book-assignment-plan.md](primary-book-assignment-plan.md) for the exact
scope and verification. No schema change or provider access occurred.

At the earlier primary-book checkpoint, a fresh server launch was rejected over
the local test identity. That rejection was preserved and was subsequently resolved
by Samuel's explicit temporary-inspection authorization above. Updated backend
and form behaviour are now verified; personal sign-in is not claimed.

The preceding title repair started from D-155 completion at
`f7a9546d68547250776cfcb618b90ad8478c027b`; the isolated
`codex/sermon-title-passage-fix` branch preserves all existing source and generated
content. The frozen comparison was revalidated in one guarded serializable
transaction: exactly 130 corroborated title corrections (three original-preview,
127 later records), zero conflicts, 22 already-clean titles and three ambiguous
titles left unchanged. No schema change or provider access occurred.

The three changed completed identities returned to Stage 1 and lost current
overall completion markers, as explicitly approved by Samuel. Other content
approvals, finding and passage decisions, historical audits, sermon bodies,
slugs/URLs and source/candidate/receipt evidence remain preserved. That checkpoint's counts
were 155 sermons, 143 pending Stage-1 reviews, 12 completed private previews and zero
publicly eligible sermons. Samuel must decide the three ambiguous titles and
personally reconfirm the three reopened identities. No human decision was made
by automation.

The identical second correction returned zero changes and 130 unchanged records;
independent complete-table and audit hashes showed no version, timestamp,
review-state or audit churn. Recurrence prevention covers source and fixed-batch
imports, immutable development-seed verification, and normal administrator title
editing. See [sermon-title-policy.md](sermon-title-policy.md) and the validation
plan for the exact projection, preservation and verification evidence. The private
comparison and receipt remain ignored and unstaged. D-155 remains closed; Claude's
frontend and previous worktrees remain unchanged. Older counts below are
historical checkpoints, not the current administrator queue.

Treat current repository bytes and Git history as authoritative, followed by this handover, approved project documentation and clearly labelled prior-run evidence. Read `AGENTS.md` before state-dependent or repository-changing work.

At the start of the governance milestone that added this handover:

- Branch: `master`
- HEAD before the governance commit: `d9d194108daa9bbc5f148a174a5de85c20732f7a`
- Worktree and index: clean
- Git remotes: zero

Use `git status`, `git log` and `git remote` to verify current facts; do not treat the checkpoint above as a permanent invariant.

## Current application position

- The repository implements the Astro/TypeScript/PostgreSQL sermon foundation, protected administration workflow, authenticated loopback frontend preview, keyword/structured Scripture search, metadata-based related sermons and a publicly disabled description-only Related themes foundation.
- The sermon frontend was redesigned on the `frontend-redesign` branch from baseline `0759302b76eacde250cefa6f50d3cfdcfe1d1f60` (D-149): an editorial, Scripture-first presentation built as the framework-independent `src/frontend` package with typed tokens, an escaping template, page-scoped styles, three readable CSP-hashed enhancement scripts and shared page composers. Routes, query contracts, selectors, privacy headers and the database are unchanged.
- A creative candidate, "the Canon" (D-150), was built on `frontend-redesign-creative-v2` from `fb513b22ed31de874feb78e3084bc76d059d4d65`: every sermon is shelved under the Bible book it was preached from, with a 66-book shelf, a to-scale canon strip, a book tab and an open book of chapter/verse rulers, all ordinary server links. It keeps the `src/frontend` construction, routes, query contracts, selectors and privacy headers, and adds one optional `sermonCount` per filter option to the published filter-options projection. It was committed as `WIP: creative frontend redesign pending PostgreSQL verification` because PostgreSQL was unavailable on the implementing machine; the database gates in `migration-validation-plan.md` must be completed on a PostgreSQL-equipped computer before acceptance, and nothing from either branch is merged, deployed or published.
- The authenticated preview uses exactly 15 completed pilot/Wave-1 sermon records from the protected local PostgreSQL test database.
- Those sermons remain application-level drafts. Git or future GitHub visibility does not make them public in the website.
- Ordinary public routes, public search, feeds, sitemaps, semantic processing and production builds must continue excluding them unless a separate administrator/publication decision changes their application state.
- No deployment, production cutover, Phase 3C or public Related themes integration is authorised by this handover.

## Current creative frontend refinement

The creative frontend's current local refinement uses labelled, category-coloured Bible-book side tabs for latest, recent, archive, taxonomy and related entries, without per-entry count badges. The slimmer catalogue tabs are 2.75rem wide on desktop/tablet and 2.25rem on mobile; unclassified entries retain a neutral placeholder rather than an inferred book. In the authenticated preview masthead, one click opens the Sermons disclosure and double-clicking its heading still opens the sermon archive. The dropdown now offers SermonsV1 (the unchanged landing page), SermonsV2 (the unchanged archive), Speakers, Series and Books, all navigating on one click. These are menu labels, not new routes or replacement page designs. Native disclosure and ordinary links preserve keyboard, touch and no-JavaScript alternatives. Footer links, search contracts, selectors and privacy gates are unchanged. See the 13 September 2026 verification entries in `migration-validation-plan.md`; these local refinements do not imply deployment or database changes.

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

D-153 is complete and expired. All 36 fixed positions retrieved exact English ASR captions under the bounded unknown-audio rule; no substitute was used. Word-preserving preparation produced 36 private unapproved transcripts totalling 224,454 words. Final validation accepted 36 descriptions of 197–220 words and 253 ordered Q&A pairs; 24 initial candidates required the single permitted pre-import correction/regeneration and remain preserved privately as rejected evidence. The guarded importer stored all 36 records as private unapproved drafts and the identical second pass returned `unchanged` for all 36.

The local test database now contains 83 sermon records. Exactly 68 guided-review sets are pending at Stage 1 and the authenticated completed-sermon preview remains 15. Independent before/after hashing confirms that the prior 47 records—including the 32 D-151/D-152 drafts—are unchanged. The D-153 scope has zero administrator decisions, approvals, public/search eligibility, semantic eligibility or semantic relationships. All private sources, generated bodies, receipts, manifests and checkpoints remain ignored and untracked.

## Third fixed private evaluation batch

Decision D-154 authorises one separately frozen private batch bound only to manifest SHA-256 `d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244`. It contains 36 fixed, unique and previously unattempted source/video identities in authoritative source-ID order, covering sermon dates from 24 April 2022 through 15 January 2023. Every position may be attempted once; failures consume their positions and there is no substitution or thirty-seventh record.

For D-154 only, a serving, non-draft English standard or ASR caption may have primary or truthfully unconfirmed unknown audio association under the four-level priority. A usable exact VTT may become a word-preserving private unapproved transcript and immediately ground private unapproved description and Q&A drafts through the current interactive Codex runtime. Every result remains subject to automated validation and later real administrator review, binds the exact D-154 manifest, governance, transcript and output provenance, and stays outside public/search/feed/sitemap/metadata/build/semantic eligibility. The normal approved-transcript gate remains unchanged elsewhere.

### D-154 completion and runtime continuity

D-154 is complete and expired. All 36 previously retrieved captions and prepared transcripts were reused without a second retrieval or preparation. Final validation accepted 36 private descriptions of 203–220 words and 252 ordered Q&A pairs. The transcripts total 1,199,148 characters and 233,051 words. Every record retains unknown-audio and accuracy-review warnings; zero explicit uncertainty markers does not establish transcript accuracy.

Samuel authorised an interactive Codex Sol-to-Astra continuation after an access interruption. Saved generation evidence supports `gpt-5.6-sol` for sequences 1–25; genuinely missing sequences 26–36 were generated by `gpt-6-astra`. Sequence 25 required its remaining pre-import length correction by Astra, with its original Sol candidate and seven answers preserved. Sequence 36 required one question-opening correction by Astra without changing its answer or other prose. Original provenance, rejected versions and checkpoint history remain private and preserved. The runtime-neutral governing exception required no weakening or replacement of the approved-transcript gate.

The guarded importer created 36 private unapproved sermon/transcript/description drafts and 252 private unapproved Q&A pairs. All 36 identical second imports returned `unchanged`, with full-row hashing confirming no content, timestamp, version, audit or review-progress churn. Independent verification confirms the original 83 records are unchanged. The local database now contains 119 sermons, 104 pending Stage-1 reviews and the same 15 completed private-preview sermons. No D-154 administrator decision, approval, public/search eligibility or semantic eligibility was created. Claude's frontend tree remains unchanged.

## Historical D-155 interruption (superseded by completion below)

**Current interruption:** The single authorised sequence-4 diagnostic attempt on 6 September 2026 returned structured `quotaExceeded` / HTTP 403 from `captions.download`, after fresh church-channel, video-ownership and eligible-caption checks passed. The safe diagnostic repair was committed first at `0aeecc86a39bd1738edf223b12136bb4086bc802`. All further provider calls stopped. This proves the current quota blockage, not the precise cause of the original unclassified 403. The next midnight-Pacific reset calculated at that checkpoint is 6 September 2026, 5:00 pm Australia/Melbourne (Pacific PDT UTC−7 to Melbourne AEST UTC+10); project usage and remaining quota were not inspected. No credential/project/scope change or automatic retry was made.

The three earlier downloads and checkpoint history remain unchanged, sequence 4 remains interrupted and sequences 5–36 are untouched. No transcript, candidate or import exists. D-155 remains active; a quota interruption does not consume untouched positions. Resume only from preserved evidence when the provider blockage is cleared, without retrieving sequences 1–3 again. No automatic scheduled retry was created.

D-155 is interrupted, not consumed. Its governance commit is `c9fdffa7910771dae2647bdabbd92e217dba9afb`. Sequences 1–3 have preserved exact caption downloads (1,057,937 bytes / 7,471 cues); sequence 4 stopped during download with HTTP 403. The original Google reason was not retained and must not be inferred from that status. No transcript, candidate or import exists; independent read-only reconciliation still verifies 119 sermons, 104 pending Stage-1 reviews, 15 completed previews and unchanged original-record fingerprints.

Samuel authorised a narrow safe-error-reporting repair and one controlled diagnostic reattempt of sequence 4, after a local safe-code commit and focused verification. Diagnostics retain only sequence, method, timestamp, HTTP status, an allowlisted structured reason and classification; raw provider errors and request/authentication material remain excluded. Decode object, JSON-string and binary JSON error bodies without printing them. Disable both transport retries and OAuth failure reauthentication retries. Preserve all earlier evidence and reuse successful downloads. Quota, access or unresolved errors stop further provider calls without making untouched positions terminal; only a successful sequence 4 permits continuation of the same D-155 batch. No new manifest, branch, decision, project, scope or provider is authorised by this repair.

D-155 is the currently authorised fourth fixed private batch, isolated from the completed D-154 work. Its frozen manifest SHA-256 is `eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a`. Integrity-verified local evidence reconciled 123 prior attempts, 195 clean candidates before selection, 36 new unique pairs in strictly ascending source-ID order, and 159 remaining. Dates span 14 February 2021 through 17 April 2022. The read-only baseline is 119 sermons, 104 pending Stage-1 reviews and 15 completed private previews. The runtime reports `gpt-6-astra`.

Samuel authorised the exact manifest's official caption retrieval, truthful unknown-audio fallback, sequential primary-Codex transcript/candidate context, private pre-approval generation, one preserved pre-import correction, atomic local import and identical rerun. Governance must be committed and focused tests pass before captions are read. All permanent privacy, human-review, public/semantic exclusion and frontend-preservation controls remain. D-155 expires after its 36 terminal positions; no substitution or later batch is authorised. The following older post-D-154 stop remains historical, superseded only by this exact D-155 task.

Await real administrator review and fresh authority for any later processing. Do not resume the consumed D-154 manifest, introduce a replacement or process another batch. No review decision, approval, publication, semantic operation, production access, deployment, merge or push is authorised by this completed milestone.

## Current checkpoint — D-155 complete

D-155 is complete and expired. Its exact manifest remains `eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a`, with governance commit `c9fdffa7910771dae2647bdabbd92e217dba9afb`. The resumption started at `f67dd3009595a55cf2ff4384c859afb21a74c094`. After the quota reset, sequence 4 succeeded through the retry-disabled official API workflow; sequences 1–3 were reused and only the remaining required sources were retrieved. Later success does not establish the original unclassified HTTP 403's cause. All earlier quota, retrieval and checkpoint evidence remains preserved.

All 36 positions produced exact English ASR sources with truthfully unconfirmed unknown-audio association, word-preserving transcripts, validated descriptions of 203–220 words and seven ordered Q&A pairs each (252 total). All original candidates were generated by interactive Codex Astra and remain preserved. Only sequences 17 and 27 used their single permitted pre-import correction: a one-word length reduction and one generic-question-opening rephrase respectively. No valid candidate was regenerated after interruption, and no correction allowance was reset.

Four provider-redacted word markers across three transcripts remain unchanged. Safe backend commit `a491f94f6e3a43dd494eaa05ffd972bc91aa3419` makes these four pending atomic caption findings instead of incorrectly presenting a zero-finding review. It changes no source wording, administrator decision, schema or frontend. Seventeen contextual editorial flags remain for human review; automated validation is not an accuracy or theological approval.

All 36 atomic imports succeeded as private unapproved drafts; all 36 identical second imports returned `unchanged`. Independent stored-byte checks and full-row hashes prove no idempotency churn and preservation of all original 119 records. Current totals are **155 sermons, 140 pending Stage-1 reviews and 15 completed private-preview sermons**. The D-155 records have zero administrator decisions, approvals, public/search eligibility or semantic eligibility. All 36 supported administrator review sets verify correctly with no stage completed automatically.

Final verification passed: 339 standard tests; 365 guarded real-PostgreSQL tests with zero skips; type/Astro checks with zero errors/warnings (two informational private-helper hints); production build; offline audit with zero reported vulnerabilities; anonymised import dry run; browser authentication/15-preview checks; public route/API/search/feed/sitemap and production-output exclusion; credential/key/cloud/private-content/identity/symlink/staged-file scans. Disposable test databases, the temporary verification tab and server were removed or closed. Private artifacts remain ignored and unstaged, and Claude's frontend tree is unchanged. No real sermon content entered Git and nothing was approved, published, pushed, merged or deployed.

Stop for real administrator review. The automatic review estimate is about 38 hours for this batch, not measured human performance; all pending Stage-1 work totals about 144 estimated hours. No later batch, terminal retry, substitution, public integration, staging, deployment, embeddings, Related themes or Phase 3C is authorised.

## D-160 protected draft-preview synchronization

The exact D-160 manifest `0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`
is now synchronized from the unchanged 227-record local test database to the
verified staging database. The private canonical package hash is
`544d76ab8487d1d9f0bcd70e131f12bddc85cbcab65f85d885f07f1bfef47d6a`;
the private package, manifest, sermon content and receipts remain ignored and
untracked. The first staging import inserted exactly 36 sermons, 36 sources, 36
transcripts, 36 media rows, 36 primary-passage review rows, 30 Scripture-reference
rows, 252 ordered Q&A rows, 36 draft-import receipts, 36 pending review rows, five
review findings and 72 audit events. The required identical second import and a
final reconciliation on the deployed image both returned `unchanged` for every
row.

Staging now contains 191 sermons: the 36 D-160 records are drafts with no
publication timestamp and 36 incomplete review sets. They have zero restricted
acceptances, AI reviews or semantic eligibility. The prior 144 restricted
acceptances remain unchanged. Public detail, archive, feed and sitemap checks found
no D-160 identity; anonymous draft-preview requests return 401. Authenticated
loopback checks discovered and opened all 36 draft records locally and on staging,
including transcripts, descriptions, ordered Q&A, warnings and provenance. The
local preview is `http://127.0.0.1:4392/`. The staging preview is reached only through
the established SSH tunnel and opens at `http://127.0.0.1:4393/`.

The deployed release is commit `be83983e9784197ac8a8fd0151448d70a4ddf3d8`,
image `sha256:d720253435e91e2e9bec34762a529ca4835a580786f3e5c89453911ed7bf06af`
and archive SHA-256 `49b16c563d2b8dbf667cc41a926fda9d312019ada6fbfabf9053d31bc7eabad4`.
The visitor-facing frontend design and ordinary route behavior are unchanged. The draft preview listens on EC2 loopback
only at port 8081. A hardened dynamic-user systemd socket proxy exposes the internal
PostgreSQL service only at EC2 loopback port 5433; PostgreSQL has no public binding.
Both the public application and draft preview are healthy after recreation, and the
draft preview passed an explicit restart check.

A protected pre-import custom-format dump was independently hashed and its restore
catalog verified before any write. Partial imports roll back transactionally. The
preserved recovery procedure is to stop the draft preview, restore that dump into a
separate protected recovery volume/database, verify 155 records and migration 0019,
then switch only under separate destructive rollback authority; never overwrite or
delete the verified current volume merely to rehearse rollback. The earlier matching
application image and release remain preserved for application-only rollback.

Focused D-160/staging tests, sealed-network tests, type/Astro checks, the production
build and offline audit pass. The guarded PostgreSQL run completed all database tests
with zero database skips. Both the standard and PostgreSQL-inclusive suites retain
one pre-existing, unrelated `admin-dashboard-layout` source-shape assertion failure;
the affected admin files are unchanged from the integration base. Secret/key,
protected-identity, private-content, build-output, symlink and staged-file scans pass;
no D-160 content or identity entered Git or production output. Nothing was pushed,
merged, approved or published.

## D-161 D-160 delegated review and accepted-subset integration

D-161 is bound only to D-160 manifest SHA-256
`0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`.
It permits truthful private AI review of the 36 current D-160 transcripts,
descriptions and individual Q&A, one preserved focused correction per artifact,
and evidence-supported source-component decisions. Unsupported or provider-
redacted cases remain pending. Earlier Sol generation provenance, all human
decisions, D-156/D-157 evidence and D-158's 144 receipts are immutable.

Only records with current accepted content and every required component may gain
a separate D-161 private completion and restricted-frontend receipt. That receipt
is accepted-subset delivery in loopback and sealed staging only; it is not human
approval or internet publication. Implementation/application results must be
recorded here only after migration, idempotency, preservation, browser, privacy,
security and staging reconciliation checks have actually passed.

D-161 execution is complete for all 36 fixed D-160 records. The current Codex
runtime substantively compared all 36 descriptions and 252 ordered Q&A pairs with
their complete retained-caption transcripts. Every content artifact passed; no
focused correction was used. The records truthfully retain their original Sol
generation provenance, while D-161 reviewer metadata records unavailable runtime
model details as `not_exposed_by_runtime`. The review wrote 288 artifact decisions,
216 component decisions plus four private completions, five evidence-supported
speaker assignments and four restricted-frontend acceptances. Thirty-two records
remain pending: 31 lack an explicit retained full canonical speaker identity, and
five retain provider-redacted wording findings, with overlap between those groups.
No unsupported speaker was inferred and no human approval was created.

Local migration 0020 and the D-161 writes were applied and replayed idempotently.
The application database remains 227 sermons; all 36 D-160 records remain draft,
unpublished and non-semantic. The protected local frontend contains 148 accepted
records at `http://127.0.0.1:4381/` while its private preview session is active.

Sealed staging retains 191 sermons. Migration 0020 was applied after a protected
custom-format backup (SHA-256
`a9514ef7e7c7c320b37fd83d4b10a548fe002562887e6e10bc1b30cf33d58fed`).
The first D-161 synchronization applied 929 scoped rows/updates; the identical
second synchronization returned 929 unchanged and zero changed. Staging has 288
D-161 content decisions, 220 component/private-completion rows, five assignments
and four acceptance receipts. All 36 source sermons remain draft with no publication
timestamp. The running sealed application commit is
`6e1f740b6117be0a8e2550288f1803b7e4ebbb2e`, image SHA-256
`eb538f9b676b0d1ea837e58abebe053156ee4b36778bfa15c1da6e7ebcef0271`,
and release archive SHA-256
`0f0a6b1ca75432a1e2dabca67a657006068fc1963ff02118fbe62d4917202b95`.
It serves 148 accepted records only through EC2 loopback; local ports 8080 and 5432
remain externally unreachable. The current SSH tunnel exposes the sealed view at
`http://127.0.0.1:4394/`. Admin routes remain denied and responses retain
private/no-store/noindex controls.

Focused D-161, selector and staging tests pass; type/Astro checks and the production
build pass; the offline dependency audit reports zero cached vulnerabilities. The
complete standard and real-PostgreSQL suites retain one pre-existing unrelated
`admin-dashboard-layout` source-shape assertion failure. All 764 PostgreSQL-inclusive
tests executed with zero skips, and the disposable test database was removed.
Private artifacts remain ignored and unstaged; no sermon prose, credential, token,
manifest identity or database artifact entered Git. Nothing was pushed, merged,
deployed publicly, approved by a human or published on the internet.

## D-170 SermonAudio attachment and refreshed media evidence — 5 October 2026

This completion supersedes the earlier player-only pending checkpoint. Primary
review of the preserved 271 proposals rejected three copied links to different
sermons. Local outcomes are **268 attached and AI media-reviewed**, **241 audited
replacement restricted acceptances**, and **27 linked records still held** for
unrelated requirements. The 311-record inventory and exact 279-member eligible
set are unchanged. Unresolved mappings: 25 unmatched, 4 conflicting, 14 unavailable,
0 ambiguous. No recording substitution, listening/audio-quality claim, content
regeneration, new sermon or human approval occurred.

The existing versioned extension/audit mechanism retains all original reviews,
acceptances, media, source evidence and content. The media-only transaction
requires exact source identity, canonical prior-media hash, concurrency/version
checks, supported recording evidence and a current original restricted receipt
before writing any replacement acceptance. Held records receive a verified link
without acceptance. Locked JSONB serialization preserves timestamp precision.
There is no schema change or ordinary public-selector change.

Both staging apps serve commit `29f062731ad4020121f9cc1391ce455bb51396e8`, image
`sha256:d2196335e1573d3258e8018af2ac52f7bcc22b609d4bf7e29449a1c47b264c5e`.
Public staging remains **191 stored / 148 eligible**, with 179 audio attachments;
protected staging remains **148 stored / 148 eligible**, with 140 attachments.
Each has 140 eligible audio pages and 140 replacement receipts. Thirty-one older
public-stage versions passed fresh source/title/date/slug/prior-media checks;
no newer edit was overwritten. Public eligible membership remains D-166's exact
hash `4bf7dbdb97d7ef98e9dd1aa9153f0e04c977776f08e0ba0a420fb266304f1731`.
Identical reruns returned 268 local, 179 public and 140 protected unchanged,
with no version, timestamp, audit, review or fingerprint churn.

Public archive: <http://54.253.237.138:8080/sermons-v4/>. Protected access retains
the pinned SSH tunnel to EC2 loopback 8082. Staging admin/private-preview denial,
database isolation, no-store/noindex and publication boundaries remain intact.
App rollback and restoration were rehearsed before media writes with unchanged
databases/listeners. Protected scoped recovery snapshots and prior images are
retained; do not overwrite newer data or expose stale acceptance on rollback.

Real linked pages passed recording identity, deliberate keyboard loading, mobile
fit, fallback, no autoplay and YouTube-control checks. Eighteen church-page route
checks at two widths passed without overflow or script errors. No media was
downloaded or processed. Source trees/design and all pre-existing V5 work remain
preserved; V5 changes are not included in these commits or the staging package.
All 128 guarded database tests passed with zero skips. Standard verification
retains one unchanged admin-dashboard-layout assertion; Astro retains the existing
snapshot-CLI optional-property error. Builds, focused checks, dry run, offline
audit and outgoing/private-content scans passed. Details and rollback limits are
in [the integration contract](docs/sermonaudio-integration.md).

Only safe D-170 implementation and completion documentation are included in the
authorized integrated-branch handoff. Existing dataset-bearing history is covered
by Samuel's explicit push exception; no additional private content, credentials,
reconciliation, dumps, raw captions, accounts or sessions are included.
