# SEO migration cutover and rollback

D-183 continues preparation of a CMS replacement at the existing domain. This is not authorization to switch production traffic, change DNS/TLS, modify WordPress or remove recovery systems. Production operator: Samuel or a named delegate must be recorded at the final go/no-go review. A NOT READY acceptance report blocks cutover.

## Release and recovery gates

D-182 adds source-content CMS revisions. After adoption, the D-181 image cannot
render the new module/template contract. Rehearsal rollback must use the new
compatible image with `SOURCE_PUBLIC_ENABLED=0`, retaining the source/CMS history
and asset files. Do not roll back to an older application merely because schema
order remains 28. The guarded operator freezes the actual source-backed CMS plan,
preserves every incumbent CMS row and resource, and verifies idempotent adoption.

Use the separately recorded application commit, documentation commit, image digest, source ledger hash, source bundle hash, asset manifest hash, migration checksums and protected recovery receipt in `seo-migration-acceptance.md`. Never deploy an uncommitted directory. Verify remote Git commit and deployed health/image identity independently. Stage configuration stays loopback/SSH-only, non-indexable and read-only for visitors; protected admin remains protected.

Before production authorization, obtain the missing fresh WordPress SELECT/USAGE-only source account, complete source/destination reconciliation, resolve every unexplained public-content loss, and provide account/indexing evidence or an explicit acceptance of its absence. Obtain a current WordPress database/export, complete uploaded assets and configuration backup through approved read-only access; test restoration in isolation. A retained older export is not a final backup. Retain WordPress and its assets until acceptance and recovery retention expire.

## Freeze and final delta

1. Agree and record the exact content freeze time with the church editor. Freeze is an operational agreement; this task does not change WordPress. If editing must continue, record additions, edits, withdrawals, metadata/media changes and uploaded files through the final source capture.
2. Obtain the current guarded WordPress publication/permalink/metadata/attachment/recurrence inventory. Reuse the frozen 23,129-URL union, and inspect only exact final additions, edits, withdrawals or missing dependencies. Do not restart open-ended calendar/query crawling. Keep the previous snapshot immutable. Compare source identity, status, body/metadata hashes, canonical path and assets. Do not treat absence in an incomplete crawl as removal.
3. Build a new private source bundle. Each changed route must bind the exact currently expected version. New routes expect null. Conflicts stop the transaction. A previously withdrawn route cannot be resurrected automatically. Existing enrichment approvals, uncertainty and CMS edits are independent.
4. Review source publication changes and deletions explicitly. Apply approved withdrawals/redirects using the existing audited workflow. Do not overwrite current CMS revisions or infer a removal from an unavailable optional transcript/video.
5. Import atomically, rerun byte-identical to prove idempotency, and rerun the entire URL ledger, content/metadata comparison, sitemap/link/asset checks and browser matrix. Reconcile source changes occurring during the freeze window before opening traffic.

## Deployment order

The exact production proxy/hosting configuration requires its own authorized review. For the existing staging rehearsal use `seo-staging-deployment.md` and its guarded operator:

1. Verify incumbent release/configuration/schema, full protected database backup, asset snapshot and credentials/permissions bindings.
2. Deploy the compatible bridge with source-public rendering disabled. It supports both schema27 and28. Check existing visitor/CMS boundaries before migrating.
3. Apply additive migration0028, import the immutable source bundle, install only checksum-verified durable assets and grant only required SELECT access. Never roll schema28 back destructively when history exists.
4. Verify a protected canary, enable the source-public projection, check routes and all acceptance gates. Exercise rollback to the compatible bridge and reactivation. The older strict-schema27 image is not a post-migration rollback target.
5. Only after separate production approval, activate the reviewed canonical hostname/HTTPS and exact redirect configuration and candidate release. Preserve existing TLS/domain ownership. A CMS replacement at the same domain does not use Search Console Change of Address.

## Immediate production smoke checks

Run the complete frozen mapping comparator through an approved production-capable harness; the supplied comparator intentionally accepts only literal loopback. Do not relax its guard casually. Use an SSH loopback path to the reviewed production proxy where appropriate, preserving original Host/TLS checks independently.

Check the actual public hostname and TLS certificate/chain, HTTP/apex normalization, homepage, important landing pages, oldest/newest/Arabic/audio-only sermons, archives and pagination, search, taxonomy landings, contact/giving and downloads. Confirm statuses, one-hop redirects, canonical/OG/schema origins and dates, production robots/indexability, sitemap membership, genuine404/410, no preview/admin/draft leakage, and working controlled media requests. Verify resources after restart. Confirm one production measurement implementation, no staging events, and retained verification mechanisms with the account owner. Save timestamped evidence.

## Rollback and post-launch changes

Trigger rollback for unexplained widespread404/5xx, wrong-content redirects, lost originally public content, draft exposure, production noindex/authentication, invalid canonical origin, unavailable critical assets, or serious visitor/CMS regression. The named release operator owns the decision and incident log.

For the protected staging rehearsal, `rollback` selects the compatible feature-off bridge and preserves schema28, immutable source history, all CMS rows and files. `reactivate` returns to the verified candidate. Do not restore an older whole database over intervening editorial work.

For a production rollback, stop new application editing through the agreed operational process; capture a protected post-launch database/assets backup and audit/revision delta first. Record every new sermon/page/edit/slug/redirect/upload and publication state since release. Restore routing to retained WordPress only under separate production authority. Retain the new system read-only for reconciliation and replay later edits through a reviewed import; never silently discard them. The immutable source import restore command only changes pointers if every route still matches that import and records new history; any later edit causes refusal.

Keep legacy redirects at least one year and preferably indefinitely. Continue monitoring after rollback. Never delete the original system as part of this task.

References: [Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes), [canonical consolidation](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Release-bound commands for the final go/no-go review

After resolving the acceptance blockers and obtaining separate production cutover authority, record the exact content-freeze UTC time, fresh final-delta bundle/hash, application/image and migration checksums. A domain-preserving CMS replacement must not initiate Change of Address. Do not activate a source snapshot while the acceptance verdict is NOT READY.

Run the repeatable mapping comparator documented in `seo-post-launch-monitoring.md` through an approved loopback path to the actual proxy. Verify the real DNS/TLS hostname separately; loopback success alone does not certify the external certificate or routing. Example public smoke commands below are prepared, not claimed as executed after a production cutover:

```powershell
curl.exe --head https://www.savinggrace.org.au/
curl.exe --head http://savinggrace.org.au/sermons/
curl.exe --head https://www.savinggrace.org.au/sermons/
curl.exe --head https://www.savinggrace.org.au/robots.txt
curl.exe --head https://www.savinggrace.org.au/sitemap.xml
```

For actual canonical/robots/social/schema verification, fetch complete HTML and compare with the bound ledger; HEAD alone is insufficient. Require final 200, the expected release identity, correct content, canonical/indexing policy and exact image/document bytes. Check important visitor journeys and one verified production measurement implementation. Obtain confirmed Search Console verification and account reports; a missing HTML verification tag does not establish which ownership mechanism is in use.

The staging application rollback retains migration 28 and the exact source/CMS state, and selects its compatible feature-off bridge. Verify actual HTTP boundaries after rollback and after reactivation, and recheck all source resources after restart. Restore a database only through an independently demonstrated, separately approved recovery target; a valid dump listing is not restoration. WordPress and required assets remain retained throughout this task.

## Rehearsed source delta and remaining asset gate

The 10 October expanded source delta expects the exact prior 2,351 route versions.
It adds 1,071 routes and changes only two existing asset identity metadata records;
all prior content, metadata, media and resource hashes were independently compared
and retained. Byte-identical replay changes nothing. Fresh final imports must use
new snapshots and current expected versions; the frozen deployment operator is not
a general authorization to apply another delta.

Before WordPress retirement, decide and verify durable hosting for the 117 original
MP3 and one MP4 URLs without changing recording identity. The bounded unchanged 118-file backup is complete. Keep the existing WordPress
runtime/files available until the operator
has an exact church-owned storage/origin mapping, verified HEAD/Range behavior,
backup and restart proof for every recording URL. Do not point a fallback proxy at
the cutover hostname itself: that can loop after DNS/routing changes. A separately
verified retained origin is required before activating that configuration.

The two ZIP archives and one OTF download are captured, structurally validated and
included in the final source asset archive. All old source resource witnesses stay
retained. The 17 publicly unexposed media identities and 12 unresolved external
references remain evidence gaps; 396 transformed CDN references have verified
owned-original replacements. Earlier logo corrections do not establish that every
remaining staging-host resource has an exact verified replacement. Transformed CDN byte identity is not claimed.

D-182 explicitly authorized the exact isolated restore target. The final actual
local PostgreSQL backup was restored and matched across 65 tables, schema,
constraints/indexes/triggers/sequences, 1,499 asset files and 1,224 resource routes.
The isolated application passed eight HTTP smoke checks with outbound integrations
disabled, and its created database was removed after OID validation. Ownership/ACL
recreation was not tested. This is PostgreSQL/assets/application recovery;
WordPress recovery remains untested because no database/uploads/config backup was
available. The specific staging backup before `b6b3d79` was subsequently restored
in the authorized disposable local target: 65 complete table hashes and
schema/constraints/indexes/triggers/sequences matched, 1,496 files restored,
1,224 resource routes and eight isolated HTTP checks passed, and the exact created
database was removed after OID validation. Its archive SHA-256 is
`2ddb50ed9e7ed51f4158c78c20aa59bd106ba952c7a1a467fe38c22102517939`.
No global roles were changed; production ownership/ACL recreation remains
unproven. This specific staging restoration does not prove WordPress recovery.

The final content release adds 55 verified source feed routes without updating an
existing projection. Its exact replay changes nothing. A final production delta
must cover additions, edits, removals/publication changes and asset references,
compare current expected versions, preserve CMS edits and withdrawals, and rerun
all acceptance checks. Do not infer freshness or completeness from this partial
frozen snapshot. Record the precise freeze UTC time and a church operator's
no-change confirmation; alternatively capture a new delta after the last source
edit. The current task does not enact a production content freeze.


## Final finite-source candidate gate

Use the final 21,134-URL source union, retaining all 15,252 original hashes. The final
5,748-route bundle adds 1,667 missing routes without overwriting any prior route;
exact replay must remain a no-op. The private resource package binds 1,946 routes/
1,925 files by hash. Keep the 265 existing source-version differences held unless
their exact changes are resolved; 256 are source-ID-only omissions in reconstruction
with unchanged asset facts, while nine archive content differences remain unproven.

The staging hostname currently fails its pinned DNS check. Do not bypass the pin,
guess a new instance or transfer credentials/data until the existing target's
instance/host-key/database/mount/configuration identity is verified. Git publication
and the final deployed release must be checked again after connectivity returns.
Earlier F043 deployment/canary/compatible rollback proof is historical; it is not
proof of the expanded candidate. Retest the slim directory, all three CMS body/SEO
cycles, actual source/asset responses after restart and the complete proxy inventory.

Original WordPress remains production. Exact cutover still requires authoritative
source/delta reconciliation, explained content/metadata/URL findings, verified account
reports/measurement configuration, original-system backup/restore and the separately
reviewed production proxy/authentication configuration. Do not retire WordPress while
117 MP3/one MP4 URLs or maintainable feeds/calendar subscriptions remain dependent.
Retain WordPress, uploads, TLS/domain configuration and post-launch edits for recovery.


Final held-delta diagnostics narrowed the nine archive differences: eight speaker
archive trees have identical text sequences and every content leaf unchanged except
one Jetpack image URL reconstructed as its verified owned-original path. Both
owned portrait resources are captured/hash-verified and passed fresh-process HTTP
checks. Transformed-CDN byte equality is not claimed. The retained source versions
were not overwritten and no final comparator issue was cleared by this diagnostic.
The past-event list has actual text/link/title/image/tree differences and remains
unresolved. See `seo-held-source-differences.summary.json` and the hashed tree/text
diagnostics. A source-tree difference alone is not eight missing sermon archives.


## First-render readiness gate

A healthy database readiness endpoint does not prove visitor rendering. The final source canary must fetch two actual homepage HTML responses on each runtime, require 200, the expected release label and staging nonindexability, then remove its own canary and verify complete unchanged source/CMS/assets state. Activation must pass the actual proxy matrix before approval. Retain failed attempts and exact recovery receipts; never increase memory, omit source content or relax publication/hash checks merely to make readiness pass. The ECA first-render failure demonstrated why this separate gate is required.

Git archive output on Windows can apply working-tree newline attributes. Production/staging source packages must bind exact committed blob bytes, and every SQL migration byte must match the runtime archive. A source/runtime mismatch stops preparation before image activation. Retain failed task preparation and recovery evidence; correct packaging in a fresh confined directory and repeat all checks.


## Final A257 verification supersedes earlier pending checkpoints

Application `a257de54b54c29ce3fc5a8fcdce73e954dcafa31` and image `sha256:93e7c5949adf60d97d7506892a4200986830bf9ec614bd749c0f8ceb58bac4cd` are the verified source-enabled staging candidate. Both canaries require 12 actual homepage renders at explicit 512 MiB V8 heap within unchanged 768 MiB containers. Four 18-response proxy matrices, compatible rollback/reactivation, three exact CMS body/SEO revision cycles, 1,946 resources on each runtime and the complete 21,134-row proxy crawl completed. The verdict remains NOT READY; consult `seo-final-staging-acceptance.summary.json` and `seo-migration-acceptance.md`. Earlier failures and smaller releases above remain historical evidence. Exact Git blob packaging and all 56 SQL migration bytes match. No production traffic/DNS or WordPress mutation occurred.

## 13 October source delta and release preparation

The current frozen application is `d068c2214e2d53b6c50de4788305acaf7fa052ed`;
operator implementation is independently pinned at
`eaf5b9bdb2c29d44cd54345d13e6c7462737d9cf`. Its bounded full-row snapshot fix
changes no runtime/migration/dependency bytes and preserves every row twice.
Final receipts govern activation; earlier failed switches returned to the bridge. Prepared image:
`sha256:cfdcd574a493753c73a349da9710fd44f489a07d4dbde3562c7029132201b2ff`.
Final acceptance evidence must confirm activation and recovery, rather than this
preparation record being treated as a passed rehearsal.

The dated source union contains 23,017 observed URLs, 458 known public sermons and
2,335 resource paths. Retain all earlier captures and the original 15,252 URL hashes.
After an authorized content freeze, repeat sitemap/publication/identity comparison
and the guarded authoritative source extraction; apply additions/edits with expected
source hashes and CMS no-clobber checks. Review withdrawals individually. Reconcile
all URL and content differences before go/no-go; do not reuse a stale successful
snapshot as the final delta. CMS adoption of original content does not approve AI
transcripts, descriptions or Q&A.

Staging inventory buffers may be reclaimed only in the operator's own process.
The unchanged readiness guard requires 2 GiB of available host memory and stops
preparation if it cannot settle within the bounded wait. No VM, container or network
resize, unrelated process termination, cache flush or lowered gate is part of this
rehearsal. Every package file and transfer directory must match its frozen app and
operator Git bytes, confined location, owner and helper checksums.

Production actions remain unexecuted. Before any later cutover, a named operator
must close the acceptance blockers, verify WordPress/database/uploads/configuration
backups and restoration, production authentication/MFA and measurement configuration,
record exact final database/content/release hashes, and obtain separate cutover
permission. Keep WordPress and recording/resource dependencies available for recovery.


## D-183 interruption and recovery controls — 20 October 2026

The f13b6d2 staging rehearsal reached source migration/resource reconciliation after
bridge activation, then pinned SSH timed out during CMS adoption. Its actual current
CMS pointers, source receipts, running commit and image are unconfirmed. The last
fully exercised activation/rollback/reactivation was 6fd5417. Never assume that older
image is still running, blindly repeat adoption, or use a historical incumbent guard.

When hosting access returns, first run read-only inventory/health and inspect the
private phase receipts. Preserve current volumes, snapshots, credentials and both
recovery roots. Compare the exact 22-row final source delta, 11-document adoption
plan and four verified profile links with current revisions. Apply only unconsumed,
unchanged expected versions. A pending draft or intervening edit blocks that item.
Archive an unused task release root only after mount/process checks and verified
recoverable per-file archive metadata/hashes; never weaken the free-space gate or
prune images/backups to make a deployment proceed.

Source rollback retains withdrawn tombstones and immutable receipts. A separate
non-HTTP reapplication may restore only new rows withdrawn by that exact operator
restoration: original/import/restore receipts, complete bundle hashes, exact versions
and unchanged timestamps must match, with no editorial withdrawal. Normal imports
still refuse withdrawn content. Existing mixed/update imports require their own
recovery evidence and are not covered by this new-row-only operation.

The new-site PostgreSQL 65-table restoration and composite asset restoration remain
valid retained evidence. The asset set has 2,387 files including the exact 118 copied
recordings and four private RSS extraction caches. Use the original XML, manifest
hashes and frozen cache hashes, never a newly generated replacement as evidence.
A current WordPress database/uploads/configuration recovery is separate and missing.
Its isolated project must start `sgbc-seo-wp-restore-20261019-`; refuse an existing
project, bind loopback, disable email/cron/analytics/integrations, and keep proprietary
plugins inert. Do not weaken the source account's SELECT/USAGE privilege guard.

Production hosting/runtime and the managed identity provider remain undecided. Record
individual administrator membership, MFA, provider recovery and actual successful
login/recovery before production acceptance. Local development login or staging's
shared secret cannot meet that gate. Verify the approved SMTP sender/recipient and
actual church measurement properties/stream/consent. Two original GA4 IDs are observed;
that observation grants no ownership proof or authority to activate either on staging.

## Exact post-switch smoke sequence (prepared, not executed)

Only after separate traffic-switch authorization and an accepted release:

1. Record actual DNS answers and validate TLS for `www.savinggrace.org.au`; verify
   HTTP and apex host variants redirect directly to the same HTTPS www destination.
   Preserve the meaningful query and attribution behavior in the complete URL ledger.
2. Keep a protected loopback proxy to the deployed production application. Independently
   verify its commit/image/configuration and SQL/content fingerprint before using its
   runtime label; a caller-provided commit string alone is not proof.
3. Run the full frozen URL, content, metadata, asset, sitemap and internal-link comparator.
   Inspect real public canonical/robots headers as well as the private proxy response.
4. Verify homepage, sermon archive/pagination/search, the newest sermon and Arabic sermon,
   contact success/failure, future recurrence edits and calendar/RSS subscriptions.
   Verify the 118 recordings' full identities/MIME/ranges through final production routing.
5. Confirm admin/private previews require the intended production identity, drafts remain
   unavailable, production has no staging noindex/authentication, and staging emits no
   production analytics. Submit the retained sitemap through the actual owned property.
6. Capture approved production measurement once without duplicate page views; exclude
   private/query/form data. Preserve original verification files/TXT/meta mechanisms.
   This same-domain CMS replacement does not use Change of Address.

```powershell
Resolve-DnsName www.savinggrace.org.au
curl.exe --silent --show-error --fail --head https://www.savinggrace.org.au/
curl.exe --silent --show-error --head http://savinggrace.org.au/sermons/
curl.exe --silent --show-error --head https://savinggrace.org.au/sermons/
python scripts/seo-verify-candidate.py --baseline private/seo-baseline/d183-final/ledger-calendar-eight-20261020.private.json --assets private/seo-baseline/d183-final/assets-calendar-eight-20261020.private.json --candidate http://127.0.0.1:4446 --environment production --expected-runtime-label <independently-verified-production-label> --concurrency 4 --comparison-workers 4 --timeout 60 --request-limit 50000 --output private/seo-verification/<fresh-production-run>
```

The example loopback port must actually forward to the deployed production candidate;
do not accidentally test the retained local application. All outputs/incident details
stay private. A critical 5xx, wrong-content redirect, private-content exposure, missing
recording, broken canonical target or accidental production indexing exclusion stops
acceptance and triggers operator rollback review. Preserve post-launch CMS/database
changes by timestamped delta export plus current database/assets snapshot before
rollback; reconcile them by identity/version afterward rather than overwriting them.
Samuel or Yang must name the release operator, rollback operator and account owner at
the final go/no-go. Prepared responsibilities are not recorded owner acceptance.
