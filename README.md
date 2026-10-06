# Saving Grace Bible Church Website

The active exact SermonAudio completion/delivery task is governed by
[sermonaudio-119-completion-plan.md](sermonaudio-119-completion-plan.md).
This is not a new download batch or permission to restore review authority from
a development snapshot. Ordinary production/publication gates remain unchanged.

The exact 279-completed-sermon D-171 staging and curated-export update is documented
in [docs/design/completed-collection-staging.md](docs/design/completed-collection-staging.md).
The 32 held records stay excluded; development imports grant no acceptance.
## Existing SermonAudio transcript sources

The source-only retrieval CLI and its exact D-174 scope are documented in
[sermonaudio-transcript-retrieval-plan.md](sermonaudio-transcript-retrieval-plan.md).
It retrieves existing official original-language downloads into ignored storage;
it does not create transcripts, generate content, import sermons or approve them.
Credentials stay in protected owner-local storage outside repositories. Completed
sources are hash-verified and reused without new requests. A fresh/different
inventory or subsequent enrichment needs separate current-task authority.

The selected Astra + Impeccable frontend handoff is documented in
[docs/design/staging-handoff.md](docs/design/staging-handoff.md), including
checkout, locked installation, local previews, development data and staging
compatibility. Existing sermon acceptance and publication protections remain intact.

Verified individual SermonAudio recordings are now attached through the audited
media-only workflow. Players load only after deliberate activation, retain the
YouTube option, and do not change sermon content or publication eligibility.
See [the media integration contract](docs/sermonaudio-integration.md) and the
latest D-170 handover/validation entries for actual totals, holds and recovery.

## Isolated Impeccable visitor redesign

Branch `codex/impeccable-church-redesign` is a separate design exploration,
preserving all earlier alternatives. The selected Sunday-invitation direction
uses original church content, photographs and logo across the complete visitor
site. See [concept comparison](docs/design/homepage-exploration.md),
[design system](DESIGN.md), and [verification and limits](docs/design/verification.md).

To start its existing read-only, loopback-only restricted visitor runtime in
PowerShell after installing locked dependencies and configuring the established
protected local PostgreSQL credentials:

```powershell
$env:RESTRICTED_LOCAL_PORT = '4401'
$env:D167_RESTRICTED_ACCEPTANCE_ENABLED = '1'
node --import tsx deployment/accepted-local.ts
```

Use an available loopback port; do not replace another listener. The database
target is `127.0.0.1:5432/savinggrace_sermons_test`. The runtime enforces read-only
connections and existing restricted acceptance; it neither seeds nor migrates.
Do not set development identity, dashboard or `DATABASE_URL` options for it.
Admin routes are intentionally unavailable, and no sign-in is required for this
computer-local visitor-only preview. Stop this foreground process with Ctrl+C.

Homepage `/`, SermonsV4 `/sermons-v4/`, V1 `/sermons-v1/` and V2 `/sermons/`
retain their existing routes. All preview pages are non-indexable. The 44-page
static build is not a substitute for the database-backed sermon runtime.

## Complete project handoff for SermonsV4

Branch `codex/project-sync-for-sermons-v4` is the complete V4 starting point. It contains SermonsV1 and SermonsV2 and intentionally excludes the V3-only application line. The current sermon collection is tracked at `development-data/project-sermon-snapshot-v1/` under D-163's branch-only authority. This Git handoff does not publish or approve sermon content.

```text
npm run development-data:verify-project-sermons
npm run development-data:dry-run-project-sermons
```

The guarded importer is available as `npm run development-data:import-project-sermons-local` only for a uniquely named disposable local PostgreSQL test database with the normal write gate and test-run token. It forces imported sermons to remain private drafts and restores no operational review, acceptance, audit, public or semantic eligibility.

Branch `frontend-church-site` (D-165, continuing `frontend-sermons-v4`) rebuilds the **whole church website** from the WordPress export: every published page at a clean address with verbatim wording (`src/frontend/content/pages/`), the church's menus in the masthead and footer, computed events with an iCalendar feed, the blog, the sitemap, one-hop redirects for legacy addresses, drafts and the private page confined to the authenticated preview, and 45 embedded church images under `/media/`. `website-content-inventory.md` reconciles the export against the site. The static build (`npm run build`) emits every public church page; PostgreSQL-backed verification remains outstanding.

Branch `frontend-sermons-v4` implements D-164 on top of that handoff: **SermonsV4** at `/sermons-v4/` (the SermonsV2 opening section, the shelf collapsed behind a labelled disclosure, equal-size sermon cards with the latest sermon first), **SermonsV1** kept intact at `/sermons-v1/`, the **redesigned church homepage** at `/` with every word from the supplied screenshots, the church logo served from `/brand/saving-grace-logo.png`, church links and a Give button in the masthead, and contact/get-involved/services columns in the footer. Database-backed verification of the branch is still outstanding.

## D-162 seventh fixed private enrichment and reconciliation

D-162 is bound only to private manifest SHA-256
`e47da706e8b458bed6f8198570cc4a51e4b9604049e394d71a02cc84f79ea17f`.
It fixes 36 positions from 87 clean remaining candidates in authoritative order.
All 36 fixed positions are terminal. Thirty-four validated records were imported as
private unapproved drafts; two remain held after their single correction allowance.
Substantive review accepted 33 descriptions and all 238 ordered Q&A pairs, while one
description and the evidence-limited metadata/source components remain pending. No
D-162 record currently meets every restricted-acceptance requirement, so both
restricted frontends correctly remain at the existing 148 accepted sermons. See
[the D-162 plan](seventh-private-batch-plan.md).

## D-158 restricted acceptance

Both authorized databases now contain 144 D-158 bulk acceptances and 11 unchanged,
excluded drafts. Original human/AI evidence remains separate. Read
`restricted-acceptance-plan.md` for freshness, audited withdrawal and
history-preserving recovery, and the handover/validation plan for delivery checks.
The ordinary frontend is `http://127.0.0.1:4381/` locally and
`http://127.0.0.1:4380/` through the sealed staging SSH tunnel. It does not require
administrator sign-in. Remote admin/private-preview access stays disabled; real
sign-in and production/public-network exposure remain separately scoped work.

Samuel's separately authorized editorial follow-up now records exactly nine
Topical classifications in the existing versioned extension relation, with nine
audit events per environment. The other 135 accepted sermons remain associated
with 16 Bible books; all 11 exceptions stay hidden. No content, review, acceptance
hash or publication state changed. Both idempotency reruns made zero changes.
See [current deployment handover](deployment/HANDOVER.md) for running commit/image,
protected recovery materials, verified counts and SSH-tunnel instructions.

## Sealed staging candidate

The isolated staging integration preserves the D-157 backend and the creative
frontend refinements. See [deployment/README.md](deployment/README.md) for the
container, target-guard, logical-backup and rollback contracts. Until a real
authentication provider and HTTPS are configured, remotely hosted admin and
private-preview routes are disabled; SSH tunneling is not application login.
No publication or production cutover is implied by preparing this release.

## D-160 sixth fixed private draft batch

The separately authorised D-160 sixth private batch is bound only to frozen manifest
SHA-256 `0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94`.
It contains 36 fixed attempts selected after 195 earlier attempts, with 87 clean
candidates left unselected. Samuel selected the Sol label for generation, while
runtime-reported model metadata remains a distinct evidence field and may be recorded
as unavailable. The exception creates private unapproved drafts only and grants no
acceptance, publication, semantic, staging or further-batch authority. See
[the D-160 plan](sixth-private-batch-plan.md).

## D-159 fifth fixed private draft batch

The new, separately authorised D-159 private draft batch is bound to one frozen
36-record manifest. See [its scope and verification plan](fifth-private-batch-plan.md).
It grants no acceptance, publication, semantic or staging authority and preserves
the existing collection and unrelated frontend work.

The current D-157 private exceptions queue is
`http://127.0.0.1:4360/admin/remaining-reviews` when the authorised loopback review
server is running. All 155 existing records were assessed: 144 private reviews
are complete (132 AI, 12 preserved human) and 11 have specific evidence exceptions.
AI acceptance is explicit and version-bound, never a manufactured human approval.
All content remains restricted to the authorized environments. D-158 separately
records bulk acceptance and publication-state changes for the 144 completed records;
it does not rewrite these D-157 review decisions or authorize semantic processing.
Use [the remaining review plan](remaining-private-review-plan.md) for outcomes,
source limitations, preservation and verification. This is the existing authorised
development identity, not personal sign-in. D-155 remains closed.

## Prior D-156 status-display checkpoint

The former private review queue was `http://127.0.0.1:4359/admin/sermons` when the
authorized loopback server is running. Current D-156 acceptance now displays as
"AI reviewed and accepted", separate from human approvals and publication gates.
Following explicit post-rejection authorisation, private navigation/completion
now uses those exact-current substantive decisions. Draft-only status and every
independent human-review prerequisite remain enforced; publishing still uses
its unchanged human-approved checklist. No real review was completed by this
repair. See `CURRENT_PROJECT_HANDOVER.md` for the verified checkpoint.

## Prior delegated description/Q&A review checkpoint

D-156 is complete for the existing 155-sermon collection. Of the pending content,
139 descriptions and 980 individual Q&A were AI accepted unchanged; one
description and one answer received a focused correction and acceptance. There
are no new unresolved content exceptions. All 15 human-approved descriptions and
103 human-approved Q&A were preserved. AI decisions are not human approvals.

Use the existing loopback administrator route `/admin/ai-reviews` for exceptions
and the **Show all AI review outcomes** control for optional inspection of clean
results. Current AI-accepted descriptions/Q&A do not require repeated substantive
human review. Identity, transcript accuracy, remaining findings, passage decisions
and publication stay separate. Development identity mode is not personal sign-in.
The verified review-server configuration is temporary and untracked.

The current counts are 155 sermons, 142 pending Stage-1 reviews and 12 completed
private previews, with zero public or semantic eligibility. Eight unresolved
speakers and ten unresolved passage cases remain. Caption-source fidelity was
verified for 152 records; three human-approved source limitations remain, and no
audio accuracy is claimed. See [the delegated review plan](delegated-ai-review-plan.md)
for coverage, preservation, idempotency and test evidence. D-155 remains closed.

## Prior local title-correction checkpoint

The subsequent [primary-book assignment](primary-book-assignment-plan.md) is now
persisted: 130 unapproved primary-passage proposals, ten pending missing-evidence
reviews, zero conflicts and all 15 human passage decisions preserved. An identical
second application changed nothing. The Primary preaching passage form displays
these stored assignments; it does not automatically confirm them. No title,
content, publication or schema change was made by that operation.

The authorized local correction removed corroborated passage references from
130 application titles (three original-preview records and 127 later records).
There were no conflicts; 22 clean titles and three ambiguous titles were preserved.
The three changed completed identities require Samuel's reconfirmation. The local
database then contained 155 sermons, 143 pending Stage-1 reviews and 12 completed private
previews; none is publicly eligible. Content, source evidence and passage decisions
were preserved. D-155 remains complete and expired.

See [the title policy](sermon-title-policy.md) for the conservative import/edit
projection, human-edit protection and separately authorized local correction
workflow. Existing historical milestone counts below describe earlier checkpoints.

Local Phase 3B.2 caption/enrichment rehearsal, Phase 3B.2b punctuation hardening, and a guided private administrator-review workflow for the Astro/TypeScript/PostgreSQL replacement described in `church-website-architecture-plan.md`.

For current repository status and safe continuation rules, read the tracked public-safe [`CURRENT_PROJECT_HANDOVER.md`](CURRENT_PROJECT_HANDOVER.md) before acting. Repository bytes and Git history remain authoritative when an older external handover differs.

## Current scope

- Fail-closed journalled local PostgreSQL schema runner plus explicit standalone rollback SQL
- Typed public/admin sermon API contracts
- Runtime input validation
- Parameterized PostgreSQL public sermon repository
- Framework-independent `/api/v1/sermons` list/detail HTTP router
- A creative sermon frontend, "the Canon", built as the framework-independent `src/frontend` package: every sermon is shelved under the Bible book it was preached from, on a 66-book shelf whose preached spines are links, with a to-scale canon strip, a book tab and an open book of chapter/verse rulers that are ordinary server links; typed design tokens, an escaping `html` template, page-scoped stylesheet partials, two readable CSP-hashed enhancement scripts, one catalogue entry with card/row/related variants, and page composers for the landing page, archive, detail, taxonomy and empty/error/private states, with stable recent-sermon pagination, metadata-related sermons, controlled media, mapped `301`/`410` handling and a strictly eligible public sermon sitemap
- A church homepage at `/` (D-164) built from the supplied screenshots' text and the church's own logo: a welcome card with the service time, address and one button, the two Lord's Day services on the shelf board, four pillars, the newest sermons as V4 cards, About us with an offering panel, the events ledger and a shared contact footer; labels without a known destination render as pending labels and nothing points off-site
- SermonsV4 at `/sermons-v4/` (the SermonsV2 opening section, the shelf folded behind a closed-by-default disclosure, an equal-size card system with the latest sermon first) alongside the unchanged SermonsV1 landing page at `/sermons-v1/` and SermonsV2 at `/sermons/`, all reached from the Sermons menu
- Authenticated, loopback-only `/frontend-preview/` pages that reuse the real frontend components for the 15 completed private pilot/Wave-1 records while remaining absent from static production output, public routes, sitemaps and structured data
- Public repository-tracked `development-data/preview-sermons-v1/` seed for exactly those 15 records, with a fixed integrity manifest, curated allowed fields and a deterministic no-clobber importer that retains draft/unpublished state
- A server-rendered Bible passage flow (the shelf and the open book) whose spines and chapter/verse cells are ordinary links that work without JavaScript, using the checked-in 66-book Protestant/KJV versification and explicit whole-book, whole-chapter or exact-verse URL scope; results remain backed only by administrator-confirmed structured primary preaching passages, so pending proposals, supporting references and private sermons are excluded
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
- Bounded official YouTube Data API proof for owner-authenticated, read-only inspection and exact-byte VTT retrieval of only the three accepted pilots, with ignored private provenance, deterministic full-sequence alignment and private human-review evidence
- D-152 exact-manifest retry control that reopens only the 36 immutable D-151 `caption_primary_audio_unconfirmed` outcomes, permits `audioTrackType: unknown` only with explicit unconfirmed-audio provenance, and expires without substitutions after those same 36 retry positions
- Completed D-153 second fixed 36-position private batch, bound to its own integrity manifest and terminal checkpoint: 36 exact English ASR captions accepted under the bounded unknown-audio rule produced 36 private unapproved transcripts, 36 validated private descriptions and 253 validated private Q&A pairs, with no substitution, approval or public/semantic eligibility
- D-154 completed and consumed: 36 validated private unapproved transcript/description drafts and 252 Q&A pairs, bound only to manifest SHA-256 `d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244`; all second imports unchanged, truthful Sol/Astra provenance retained, and no substitution or later retry
- Deterministic Phase 3B.2c selection controls for 36 primaries plus 12 predetermined alternates, with caption inspection separated from the exact 12-record Wave 1 retrieval/processing boundary
- One-shot, retry-disabled official YouTube `videos.list(part=snippet)` title provenance for only the fixed 12-record Wave 1 allowlist, with exact UTF-8 titles and integrity hashes confined to ignored private storage
- Exact Wave 1 private import of 12 transcript drafts, 12 description drafts and 84 Q&A drafts, followed by quarantine and replacement of the superseded extractive descriptions/Q&A through transcript-grounded administrator review; all 15 pilot/Wave-1 records are complete but remain private drafts
- Repository-scoped `sermon-enrichment` skill with mandatory approved-transcript binding, paragraph/Q&A support ranges, stale-result rejection, administrator-only quality decisions and a private atomic replacement workflow
- Independent generated-description/Q&A mechanical proofreading with blocking pre-import/pre-approval checks, safe contextual review flags and a bounded idempotent current-15 draft correction command
- Fail-closed description-generation boundary that loads the complete enrichment/grounding policy, requires an identified approved generative model, records model/prompt/source provenance and creates no draft on model or quality failure; no such real model is currently configured
- Legacy query/date compatibility translation
- Deterministic Advanced Sermons dry-run importer
- Loopback-only anonymised fixture loader with an explicit write opt-in
- Date, status, slug, taxonomy, scripture, and media transformations
- Structured migration audit/warning output
- Permanent whole-site SEO non-regression, one-to-one URL mapping, and launch-gate planning
- Responsive accessible local `/admin` foundation plus a dedicated one-stage-at-a-time `/admin/sermons/:id/review` workflow for imported drafts, with one decision per deterministic atomic finding, exact identity-set completion gates, large transcript/Q&A editors, persistent progress, explicit approval, optimistic concurrency and audit
- Administrator sermon-list primary-passage filters for book/chapter/verse/range and review state, plus an explicit Primary passage column that distinguishes pending proposals, administrator-confirmed passages, reviewed legacy passages and unresolved outcomes
- Canonical administrator-only YouTube source links on sermon lists, edit/overview pages and every guided-review stage, resolved fail-closed from controlled media plus private provenance without embeds, thumbnails or provider requests
- Server-rendered uncollapsed approved description before media/transcript/Q&A; collapsed transcript remains in initial markup and list payloads omit heavy bodies
- Automated migration, security, lifecycle, configuration, and schema-contract tests
- Static `/health.json` build metadata explicitly marked `runtimeHealth: false`; a genuine runtime health check remains future work

This milestone does not include deployment, cloud infrastructure, Cognito configuration, production loading, audio/video processing, new transcription, or any WordPress/YouTube mutation. Official YouTube reads have occurred only under completed exact-scope decisions: the three-pilot proof, the Wave 1 inspection/retrieval, and the D-151/D-152, D-153 and D-154 fixed batches. Those decisions create no continuing provider authority. After D-154, the local database contains 119 private draft sermons: 15 completed pilot/Wave-1 guided reviews and 104 records awaiting Stage-1 administrator review. The original 83 records were unchanged by D-154, and the authenticated completed-sermon preview remains exactly 15. D-154's resumed generation preserved 25 Sol-origin candidates and used Astra for 11 missing candidates, with separate correction lineage. This frontend milestone authorises local authenticated preview only; it does not publish a sermon, accept semantic recommendation quality, enable public **Related themes**, access production, deploy, push or begin Phase 3C. The AWS runtime and Astro production adapter remain intentionally undecided.

Samuel has authorised and the repository now contains a public development seed with the real church-owned display content for exactly those 15 preview sermons. It was derived from the approved local records, uses an exact scope/integrity manifest and idempotent no-clobber importer, and excludes raw captions plus credential, authentication and administrator-audit material. Imported records remain draft/unpublished and absent from public routes, search, feeds, sitemaps, semantic processing and production builds. GitHub visibility of the seed is not application publication.

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
npm run youtube:pilot-auth-local
npm run youtube:pilot-inspect-local
npm run youtube:pilot-retrieve-local
npm run youtube:wave1-map-local
npm run youtube:wave1-inspect-local
npm run youtube:wave1-retrieve-local
npm run youtube:wave1-titles-local
npm run enrichment:wave1-metadata-local
npm run enrichment:wave1-verify-local
npm run enrichment:wave1-review-repair-local
npm run enrichment:canary-local -- prepare
npm run enrichment:canary-local -- validate
npm run enrichment:canary-local -- import
npm run enrichment:canary-local -- verify
npm run enrichment:mechanical-qa-current15-local
npm run db:apply-atomic-review-local
npm run db:rollback-atomic-review-local
npm run db:apply-primary-passage-local
npm run scripture:prepare-current15-local
npm run scripture:repair-current15-official-titles-local
npm run scripture:carry-forward-legacy-completed-local
npm run db:rollback-primary-passage-local
npm run reference:apply-local
npm run reference:rollback-local
npm run launch-readiness:local
npm run development-data:verify-current15
npm run development-data:import-current15-local
```

For a fresh Windows development database, create the exact PostgreSQL 16 loopback database `savinggrace_sermons_test`, configure a local role without committing its password, and run:

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

The second import must be `unchanged`. The authenticated preview begins at `http://127.0.0.1:4322/admin`; the static production build does not copy the tracked dataset into `dist` and ordinary public selectors still require published application state.

The dry-run command accepts an approved local JSON input and prints only the safe migration report. It does not connect to MariaDB or PostgreSQL and never writes records. Original media/embed values remain internal migration provenance and are deliberately omitted from stdout.

The enrichment queue is deterministic by safe source WordPress ID and missing requirement across description, transcript and Q&A. Draft import requires the same loopback/write gate as fixture loading, validates target/source identity and row version, rejects HTML-like content, stores private structured provenance, remains idempotent, never marks content reviewed/approved, and refuses to replace different approved descriptions, transcripts, or Q&A. The private enrichment commands read local caption text only and contain no downloader, audio processing, speech-to-text, provider or network implementation. The separate official API proof is documented in `youtube-pilot-caption-proof.md`; it can download exact existing VTT bytes only for an eligible track on one of the three hard-coded accepted pilots and never cleans or imports them. Phase 3B.2b normalises source and cleaned text to Unicode NFC, measures whitespace-delimited lexical-token sequences independently, strips only Unicode punctuation from each token for comparison, and case-folds the remainder. It rejects any token count, boundary, order or content change—including splitting or merging—while allowing punctuation, case and line-break changes. Stable chunks, cryptographic hashes, deterministic reassembly, exact-two trusted scope, no-clobber persistence and fail-closed verification were exercised by the authorised private exact-two run. Import itself created no approval; the later recorded administrator actions completed all three reviews while every sermon remained draft and private.

The bounded official API pilot proof completed on 19 August 2026 after owner authentication verified the common owner channel of all three pilots. Each video exposed one serving, non-draft English ASR track with an `unknown` audio association. The explicit three-pilot-only amendment allowed such a track only when it is the video's sole caption track, retaining `audio_track_type_unverified` and never claiming confirmed primary audio. All three exact VTT responses were retained privately without translation. Deterministic full-sequence alignment produced two normalized exact matches and one `differences_detected_manual_review_required` result: 109 insertions/deletions/substitutions across 87 short regions, 98.499243% normalized similarity. The aligned wording and cue references exist only in an ignored private review artifact; neither source was automatically accepted. Per-video continuation does not authorise another video, content processing, database work, publication or deployment.

The separately authorised Phase 3B.2c run inspected caption metadata for the deterministic 36 primaries and 12 mapped alternates, then retrieved and processed only the 12 resolved Wave 1 primaries. Migration `0013_official_youtube_caption_provenance` accepts both authorised Studio-export and official-API provenance while rejecting other values. The exact local database retains migrations `0011`–`0013`; the semantic migrations created structure only and all semantic eligibility/build/relationship counts remain zero. Wave 1 contains 12 private transcript drafts, 12 private description drafts and 84 private Q&A drafts. All have mandatory review provenance and `audio_track_type_unverified`; none has an approval marker, public-search eligibility or semantic output. The second import was unchanged for every record.

The original Wave 1 import left all six atomic guided-review expectation fields uninitialised. This made every one of the 12 review sets fail source-identity, item-count, item-identity and transcript-version verification even though their stored zero-finding sets and draft bodies were intact. The bounded local repair command synchronises only those expectation fields from the existing private drafts, records a safe system audit event and refuses any unexpected review/content/provenance state. Its identical rerun is a no-op. All 12 review sets are now verified and offer explicit zero-finding acknowledgement; no acknowledgement, content decision, approval or completion was created automatically, and later stages remain locked until genuine administrator action.

The Wave 1 extractive description/Q&A path is retired and its `process` command fails closed. Existing bodies carrying that processing reference remain in their private bundles and database audit history, but the service and dashboard prevent them from entering review or approval. The `sermon-enrichment` skill is required for replacement work. Its canary command prepares a private request from the current approved transcript, validates a structured private result with transcript hash/version and per-output support ranges, atomically replaces only untouched unapproved description/Q&A fields, preserves transcript/provenance/review/audit evidence, and proves a second import is unchanged. Automated validation is structural and grounding evidence only; it is never theological or administrator approval.

Generated descriptions and Q&A additionally pass `generated-text-mechanical-qa-v1`. Incorrect Jesus/Christ casing and obvious mechanical spacing, punctuation, sentence-start and join defects block grounded import and generated-content review/approval. Context-dependent capitalization and possible name/fragment concerns are shown as review flags and are never blindly corrected. The bounded current-15 command requires the exact three-pilot/12-Wave-1 processing-version scope and local write gate; it updates only indisputable defects in unreviewed generated drafts, records safe system audit evidence, preserves privacy/provenance/administrator state and must be unchanged on rerun. The completed current audit corrected 13 capitalization defects across three sermons; one sentence-start finding and 15 contextual flags remain for human review in quarantined material.

The old Wave 1 source file no longer contains its transcript-sentence ranker, fixed description wrappers or fixed Q&A assembler; its retained entry point only reports that generation is retired. The replacement `approved-description-generation-v1` boundary is provider-neutral and has no external-service implementation. It requires the complete current approved transcript, the complete versioned `sermon-enrichment` skill and private grounding policy, a named approved provider/model/revision/approval reference, 180–220 word synthesis, support ranges and deterministic proofreading. Absence or failure of that model, malformed output, wrappers/fragments/repetition/excessive transcript overlap, disconnected grounding, unexplained verse fragments, unsupported detectable claims or mechanical defects produces a structured failure and no candidate. The locked BAAI Related-themes model is embeddings-only and is never eligible for this task. Because no approved text-generation model is configured, the latest authorised single-description replacement was not created and the local database content was not changed.

When a disposable loopback PostgreSQL database is available, apply the schema and load the anonymised fixture only with both `DATABASE_URL` and `ALLOW_LOCAL_DB_WRITE=1`:

```text
npm run db:apply-local
npm run migration:load-local -- --input tests/fixtures/dry-run.json
npm run api:local
npm run db:rollback-local
```

The schema commands keep schema history separate from `migration_records` and `sermon_enrichment_draft_imports`. Apply runs only the pending canonical suffix. Rollback removes only the latest requested receipt, or the full applied suffix for an unscoped rollback, in the same transaction as its down SQL. The SQL files remain independently executable rollback artifacts; the runner normalises CRLF/CR/LF differences before hashing their paired definitions.

Migration `0014_primary_preaching_passages` extends the existing Scripture-reference model with reviewed primary/supporting/unclassified roles, one confirmed lead primary, provenance and concurrency fields plus private proposal-review state. Its bounded preparation command accepts no record argument: it requires the exact one/two/twelve processing-version split for the current three pilots and 12 Wave 1 records, writes exact evidence to ignored private storage, and creates pending proposals or manual-review outcomes without altering sermon content or administrator decisions. The later authorised repair used one retry-disabled official `videos.list(part=snippet)` response for exactly the fixed 12 Wave 1 identities, retained only their exact title provenance privately, preserved the three pilot proposals, and changed the Wave 1 aggregate from 12 no-reference outcomes to 11 pending proposals plus one pending no-reference outcome. Its identical rerun preserved all 12 repaired records. Only an administrator-confirmed primary passage can appear under **Preached from** or satisfy `passageBook`, `passageChapter`, `passageVerse` and `passageEndVerse` public query parameters.

Migration `0015_optional_passage_and_grounding_identity` separates an unreviewed passage from an administrator-confirmed absence of one. A reviewed sermon may have a canonical book only, a book and chapter, a full range, or an explicit `No single primary passage` decision; a bare missing value remains incomplete. Public passage fields remain absent unless a structured primary passage is confirmed. The same migration gives each transcript an immutable grounding revision that changes only when transcript bytes or source identity change. Grounded descriptions and Q&A bind that revision plus the exact transcript SHA-256, so passage/approval metadata and unrelated content saves cannot create false staleness.

Migration `0016_legacy_completed_passage_reviews` prevents Stage 6 from being completed while the primary-passage decision is unresolved and prevents a completed review from later being returned to a pending passage state. Its one-time bounded carry-forward command applies only to the exact current 15-record pilot/Wave-1 scope. It requires proof that a six-stage review was completed before migration `0015`, the prior content decisions are still intact, and the structurally valid proposed passage existed unchanged through completion. Nine records met that proof and are shown as `Reviewed passage`; five later or changed proposals remain pending and require a real administrator decision. The existing explicit no-primary decision is unchanged.

Reference seeding is a separate local data operation because the core schema already provides the required structure. It requires the same exact loopback PostgreSQL 16 test target and write opt-in, inserts only the confirmed seven speakers plus 66 canonical books/classifications, and is idempotent. Its guarded rollback refuses partial, changed, or in-use catalogue state. It never selects a speaker or Bible book for a sermon. Bible-book abbreviations and aliases are normalised only to resolve trusted import terms; ambiguous aliases fail closed. Administrator relationship counts include private drafts, while public counts include only complete published sermons, and neither count is stored as historical source truth.

After `npm run build`, the reviewed Phase 3B dashboard can be started with the existing password-free libpq credential mechanism:

```powershell
$env:DATABASE_URL="postgresql://127.0.0.1:5432/savinggrace_sermons_test"
$env:ALLOW_LOCAL_DB_WRITE="1"
npm run dashboard:local
```

Open `http://127.0.0.1:4322/admin`. The harness refuses non-loopback database and listener targets. Stop it with `Ctrl+C` after local review.

The local dashboard adds a **Frontend preview** action only at runtime. It issues a short-lived `HttpOnly`, `SameSite=Strict` session through the existing local administrator identity and opens `http://127.0.0.1:4322/frontend-preview/`. A copied preview URL, query parameter or identity header alone cannot expose sermon data. Preview responses are private/no-store and `noindex`; they emit no canonical, Open Graph, sitemap, feed or structured-data entry. The preview selector is limited to completed private records with approved current content, a reviewed primary-passage outcome, controlled media and the exact pilot/Wave-1 source scope. A reviewed no-primary outcome remains valid without inventing a Bible-book classification. The authenticated preview header groups the existing Sermons, Speakers, Series and Bible books destinations under one native **Sermons** disclosure on desktop and an in-flow accordion inside the mobile menu; routes and footer links remain unchanged. The archive opens with one compact Find sermons line, a **Browse by Bible passage** disclosure and an **Advanced search** disclosure that shows its active-filter count, then exactly three compact **Most Recent Sermons** items led by their reviewed passage; **Show more recent sermons** enters a URL-addressable, continuously numbered nine-item archive, search results stay separate from discovery, and the **Series** section shows one latest eligible sermon per series. The picker renders the canonical 66 books as nine distinct restrained colour groups in Books, Chapters and Verses grids of ordinary links without conflating passage scope with the broad Bible-book filter. **Topical Sermons** renders an honest note because the current schema has no administrator-approved topical-classification lifecycle. The production `dist` build contains neither preview wiring nor real sermon content.

For a design review that must not expose any write-capable application route, use the dedicated read-only launcher instead. It verifies the exact PostgreSQL 16 loopback database, sets `default_transaction_read_only=on` for every pool connection, and serves only the preview session, preview pages and static dashboard shell:

```powershell
$env:DATABASE_URL="postgresql://127.0.0.1:5432/savinggrace_sermons_test"
npm run frontend-preview:local
```

Imported Phase 3B.2 drafts, including the 12 Wave 1 records, remain available in the dashboard's imported-sermon review queue and dedicated `/admin/sermons/:id/review` route. The completed review evidence is preserved, but completion does not publish a sermon. The guided-review route has no publish, schedule, archive or deletion action, and the general dashboard also hides scheduling until a real publication worker exists.

Administrator sermon responses derive `youtubeSource` from the existing controlled `sermon_media` relationship and, when present, the private `sermon_enrichment_sources` provenance row. A link is returned only when every stored YouTube candidate is valid and all candidates identify the same 11-character video ID; missing, invalid or conflicting evidence fails closed to no link. The dashboard constructs one HTTPS canonical watch URL, strips playlist/tracking/timestamp parameters from identity, never embeds or preloads YouTube, and opens the source in a new tab with `noopener noreferrer`. This field is administrator-only and does not alter public sermon pages.

Operational loaders refuse every target except `savinggrace_sermons_test` on loopback port 5432. The integration runner requires its generated token and exact `savinggrace_test_run_<token>` database, and explicitly rejects the persistent pilot target.

## Project boundaries

- `src/domain`: framework-independent types and deterministic transformations
- `src/api/contracts`: stable `/api/v1` public/admin validation contracts
- `src/application`: lifecycle and permission rules
- `src/server/auth`: provider-independent identity boundary and local-only allowlisted adapter
- `src/frontend`: framework-independent presentation package (tokens, escaping template, styles, enhancement scripts, components, pages) consumed by both the server handlers and the static Astro pages
- `src/server`: server-only PostgreSQL repository, query, and portable HTTP boundaries
- `src/migration`: journalled schema runner, importer, audit output, identity, and CLI
- `src/enrichment`: strict queue/draft contracts, provider interfaces, and local idempotent PostgreSQL draft workflow
- `src/youtube`: bounded server-only official API pilot-caption proof; it has no application or public-site integration
- `src/readiness`: derived inventory/readiness reporting; the approved public-launch gate applies to the 448 published candidates
- `src/development-data`: exact-scope tracked-dataset validation, read-only export and idempotent draft-only PostgreSQL import
- `development-data/preview-sermons-v1`: authorised public 15-sermon content plus scope/integrity manifest
- `historical-enrichment-plan.md`: three-output Phase 3B.2 contract, review boundary and exact launch gate
- `youtube-pilot-caption-proof.md`: owner OAuth, track-selection, private persistence/comparison and stop-boundary contract
- `db/migrations`: ordered PostgreSQL SQL migrations
- `tests`: anonymised fixtures and automated contract tests

## Configuration

Copy `.env.example` to a local ignored `.env` only when a local PostgreSQL service is available. Never place legacy or production credentials in repository files. A production Astro/AWS adapter has not been selected; `api:local` is a local-only Node harness around the portable request handlers.

## Source safety

The proprietary `advanced-sermons*.zip` pattern and extracted plugin directories are excluded by `.gitignore`. Plugin implementation code must never be copied into this application. The exact installed source was inspected read-only outside the workspace and is identified only by aggregate fingerprints in the discovery artifacts.

## Next approval gate

D-155 is complete and expired: the fourth fixed private manifest `eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a` produced 36 private unapproved transcripts, 36 validated descriptions and 252 ordered Q&A pairs using interactive `gpt-6-astra`. All 36 identical second imports were unchanged. Four provider-redacted words remain pending atomic review findings without rewriting the source. The local totals are 155 sermons, 140 pending Stage-1 reviews and the same 15 completed private previews. The original 119 records and frontend remain unchanged. Normal approved-transcript/primary-audio gates remain in force outside consumed exceptions; nothing was approved or made public. See the tracked handover and validation plan for the final evidence. No later processing or terminal retry is authorised.

Human design review of the authenticated 15-record frontend preview is next. Public integration, staging, publication and deployment still require separate authorization and the whole-site SEO, privacy, performance, production-runtime and rollback gates. Wave 2, Wave 3, every other sermon, embeddings, semantic relationships, public **Related themes**, production access and Phase 3C remain unauthorised. The verified live source snapshot contains 449 published and five pending eligible sermons; the three Advanced Sermons drafts remain excluded. Public launch remains blocked until every included published candidate passes the content and whole-site SEO gates.
