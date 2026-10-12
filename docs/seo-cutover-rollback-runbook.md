# SEO migration cutover and rollback

D-181 prepares a CMS replacement at the existing domain. This is not authorization to switch production traffic, change DNS/TLS, modify WordPress or remove recovery systems. Production operator: Samuel or a named delegate must be recorded at the final go/no-go review. A NOT READY acceptance report blocks cutover.

## Release and recovery gates

D-182 adds source-content CMS revisions. After adoption, the D-181 image cannot
render the new module/template contract. Rehearsal rollback must use the new
compatible image with `SOURCE_PUBLIC_ENABLED=0`, retaining the source/CMS history
and asset files. Do not roll back to an older application merely because schema
order remains 28. The guarded operator freezes the actual source-backed CMS plan,
preserves every incumbent CMS row and resource, and verifies idempotent adoption.

Use the release commit, image digest, source ledger hash, source bundle hash, asset manifest hash, migration checksums and protected recovery receipt in `seo-migration-acceptance.md`. Never deploy an uncommitted directory. Verify remote Git commit and deployed health/image identity independently. Stage configuration stays loopback/SSH-only, non-indexable and read-only for visitors; protected admin remains protected.

Before production authorization, obtain the missing fresh WordPress SELECT/USAGE-only source account, complete source/destination reconciliation, resolve every unexplained public-content loss, and provide account/indexing evidence or an explicit acceptance of its absence. Obtain a current WordPress database/export, complete uploaded assets and configuration backup through approved read-only access; test restoration in isolation. A retained older export is not a final backup. Retain WordPress and its assets until acceptance and recovery retention expire.

## Freeze and final delta

1. Agree and record the exact content freeze time with the church editor. Freeze is an operational agreement; this task does not change WordPress. If editing must continue, record additions, edits, withdrawals, metadata/media changes and uploaded files through the final source capture.
2. Repeat the guarded fresh source inventory and public crawl. Keep the previous snapshot immutable. Compare source identity, status, body/metadata hashes, canonical path and assets. Do not treat absence in an incomplete crawl as removal.
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
MP3 and one MP4 URLs without changing recording identity. No recording bodies were
downloaded. Keep the existing WordPress runtime/files available until the operator
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
