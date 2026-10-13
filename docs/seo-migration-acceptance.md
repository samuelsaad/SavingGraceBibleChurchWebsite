# Whole-site SEO migration acceptance — 14 October 2026 Sydney

Source baseline captured 13 October; final verification completed 14 October.

**NOT READY FOR CUTOVER.** The available implementation and final local/protected-staging
rehearsal completed. The original WordPress site still serves production. No DNS,
production traffic, WordPress content or recording bodies were changed/downloaded.
Safe earlier reports remain in `seo-history/d182-pre-20261013/`.

## 1. Source and baseline

Verified production origin: https://www.savinggrace.org.au. The dated public refresh
found one new sermon, WordPress ID 30133, service date 11 October, and five changed
archive landing pages. Retained 24 September WXR SHA-256
`fd15e0553349f40fa74264b0cb1ab70560cf48ae7ef18101cccb7b0514876e0e`
was located and reconciled: 454 then-public sermons all occur in the current known
458, with 437 historical attachments. Bounded fresh captures include one previously
missing public event projection, two archive queries, all 437 original file URLs
and exact attachment redirects. This older export is not a final backup. Sitemaps expose 458 sermons; authoritative stored publication
coverage is still unproved. Stable-ID media inspection returned 420 unique readable
records against 437 reported, with zero duplicates and 17 historical identities absent from the current readable REST set. Their
original 17 image resources have now been validated and migrated; current stored
publication/metadata of those records remain unproved.

The immutable union contains 23,017 distinct observed URLs, 15,433 captured responses,
all original 15,252 hashes, and 27,863 source-file witnesses. The fixed frontier retains
6,725 deferred URLs without new arbitrary calendar/filter expansion. Ledger SHA-256:
`e8bb39b5d44b4e8594321dec480f3a0f1aa929b88e1db753d0c9b6ac1b0516a7`.
[Source baseline](seo-source-baseline.md).

## 2. Coverage

| Migrated route type | Count |
| --- | ---: |
| Pages | 33, representing 30 known WordPress identities |
| Posts | 3 |
| Archives, taxonomy, observed queries and pagination | 2,098 |
| Known originally public sermons | 458 |
| HTML event routes | 1,214 |
| Assets, documents, feeds and calendar resources | 2,335 |
| Total source projection | 6,141 |

These route counts do not prove distinct stored-event/recurrence completeness.
Current source-only CMS adoption totals 2,583 documents; 46 existing ownership routes
and 1,175 runtime-query plus two unrepresentable observed ACF archive queries
remain deliberately held from ordinary adoption (1,223 held).

## 3. URL outcomes and unresolved groups

| Outcome | Distinct observed URLs |
| --- | ---: |
| intentionally removed | 704 |
| preserved | 3,731 |
| redirected | 3,092 |
| unresolved | 15,490 |

[Complete URL ledger](seo-url-migration-map.csv), [classification](seo-current-inventory-classification.summary.json).
Every original hash remains. Grouping does not establish content equivalence or
remove rows from acceptance. Source-backed 404 removals have exact witnesses;
371 previously missing empty calendar endpoints now return their exact witnessed
zero-byte content with explicit noindex. Their future subscription/recurrence
semantics remain unresolved; successful current responses do not prove future behavior.

| Unresolved URL class | Rows |
| --- | ---: |
| external_resource | 408 |
| alternate_hostname | 4,149 |
| observed_redirect_alias | 902 |
| source_error | 17 |
| captured_public_content | 522 |
| uncaptured_page | 505 |
| owned_resource | 363 |
| protected_control | 6 |
| tracking_variant | 1,184 |
| query_or_filter | 1,774 |
| source_identity_query | 16 |
| calendar_projection | 5,543 |
| authored_event_or_taxonomy | 31 |
| pagination | 70 |

There are 978 recorded explicit WordPress
identities and 12,762 observed groups in unresolved rows.
Aliases/canonicals are grouping evidence, not proof they are interchangeable.

## 4. Original sermon reconciliation

The 458 known public identities retain source-backed pages independently of AI
transcripts, descriptions, Q&A, optional media mapping or private review completion.
The new source sermon and exact observed RSS were inserted additively; replay changed
zero. Source service dates, speaker/reference relationships, Arabic encoding and
existing editorial withdrawals remain. No human review/approval was fabricated. All in One SEO is active in captured
public HTML and the fresh REST namespace; retained older Yoast keys do not prove
current activation. [Stored/rendered metadata comparison](seo-retained-stored-rendered-metadata.summary.json)
publishes hashes only and does not override current rendered values.

Four previously unresolved sermon metadata dispositions remain: Arabic signal/social
image corrections and three pilots with existing audited title/social-title/date
edits. These were preserved instead of silently overwriting administrator work.
The conservative Arabic witness threshold remains explicit. No translation was invented.
Source-only Scripture labels now render with the original accessible `Passage:` label,
without approving primary passages or exposing native unreviewed references.

## 5. Content and metadata accounting

[Per-URL hashed differences](seo-content-metadata-diff.csv) retain wording/block,
metadata, language/date, image/media and tree evidence without source prose.
[Exact original-cohort accounting](seo-original-cohort-final.summary.json):

| Finding | Original | Fixed | Evidence reclassified | Remaining |
| --- | ---: | ---: | ---: | ---: |
| metadata_change_requires_review | 2,709 | 0 | 1,854 | 855 |
| source_semantic_blocks_missing | 2,767 | 556 | 97 | 2,114 |
| source_content_image_or_alt_missing | 76 | 0 | 0 | 76 |
| source_capture_pending_or_missing | 6,837 | 6,837 | 0 | 0 |
| source_indexability_lost | 1,928 | 1,808 | 0 | 120 |
| previous_200_not_preserved | 0 | 0 | 0 | 0 |
| non_html_mime_changed | 0 | 0 | 0 | 0 |
| non_html_source_bytes_changed_requires_review | 37 | 0 | 0 | 37 |

Categories overlap; do not add them. Existing exact policies explain formatting,
shared navigation, proved original social-logo/hostname defects and additive archive
signals. No blanket equivalence waiver was introduced. Remaining archive/card/date/
heading differences, past-event projections, image/alt findings and audited editorial
metadata consequences require actual evidence before acceptance.

Raw final production-policy comparison, before bounded review:

| Issue | URL rows/findings |
| --- | ---: |
| asset_bytes_not_captured | 129 |
| external_dependency_not_requested | 408 |
| indexable_canonical_not_self_or_missing | 1 |
| internal_target_not_200 | 3,471 |
| metadata_change_requires_review | 7,540 |
| non_html_mime_changed | 17 |
| non_html_source_bytes_changed_requires_review | 549 |
| previous_200_not_preserved | 15 |
| recording_not_requested | 236 |
| source_asset_dependencies_unresolved | 408 |
| source_baseline_incomplete | 1 |
| source_capture_pending_or_missing | 6,605 |
| source_content_image_or_alt_missing | 1,164 |
| source_deferred_urls_unresolved | 6,725 |
| source_excluded_no_comparison_evidence | 6 |
| source_indexability_lost | 451 |
| source_semantic_blocks_missing | 3,253 |
| status_mapping_change_requires_review | 1,349 |

[Remaining affected identity hashes](seo-final-finding-groups.summary.json).

Final raw local inspection narrows the 15 previously successful response losses to
legacy `/_jb_static/` bundled-script URLs. They remain unavailable, with source MIME/
byte evidence retained; this is not 15 missing sermon pages. One canonical finding
concerns a historical Elementor default-kit query. Current empty-calendar route
preservation does not establish subscription behavior or clear the remaining
`events/today` feed MIME/byte differences. No removal/equivalence waiver was invented.


## 6. HTTP, redirects, canonicals, sitemaps and indexing

Local production-policy verification checked **23,017/23,017** inventory rows with
**24,023** fresh HTTP requests, **2,988** sitemap
URLs and **10,597** internal/sitemap targets. Independent runtime
identity and source before/after/per-read hashes passed; no candidate response was reused.
The final staged proxy independently checked all 23,017 rows with
**27,378** requests. Both complete comparisons retain their actual parity verdict and unresolved findings. The staged raw result records
47 prior-success response differences: the same 15 legacy scripts plus 32 original
sitemap URLs across observed hostnames, intentionally denied in sealed staging.
This environment explanation does not clear any production-policy issue or change
the raw comparison. Staged discovery includes 16,159 internal targets; local has
10,597. Both full target sets were actually checked and retained.


The raw issue table and complete reports below govern redirect-loop, avoidable-chain,
self-canonical, sitemap-destination and robots-control findings; none is marked passed
merely from successful proxy activation. Useful query/pagination URLs retain deliberate policies, genuine
404/410 responses remain, and design variants do not create competing archive canonicals.
Staging retains intentional sealed noindex/access controls and denied public sitemaps;
production indexing behavior was rehearsed only on loopback.

All 975 original failing internal targets were directly rechecked locally and on staging,
including those absent from current navigation. Actual final HTTP: 907 return
200 and 68 return 404; disposition accounting below distinguishes removals from
unresolved targets. 298 exact observed attachment/resource 301 mappings were
imported idempotently, with preserved prior redirect/audit rows and verified final
binary identity; 122 non-binary or unavailable destinations remain held. Original accounting: 907
fixed, 2 justified removals and
66 still unresolved. Successful HTTP alone is
not content equivalence. [Local HTTP](seo-http-verification-summary.json),
[complete staging evidence](seo-final-staging-acceptance.summary.json).

## 7. Assets and media

All 2,335 resource paths, including the exact empty calendar responses, passed actual status/MIME/length/hash verification locally and
on both staging runtimes, using 1,943 retained source files. The new RSS is exact source
bytes. Previous integrity checks and persisted uploads remain; final backup restoration
also verifies the associated complete upload set.

Of 408 external dependencies, 396 have verified corresponding owned originals; transformed
CDN-byte identity is not proved. Twelve references remain unresolved: four theme JPEG
responses and eight unavailable resources. The 17 previously opaque original image URLs are now validated and migrated.
Stored current attachment-row metadata for those identities remain unproved.
117 original MP3 and one MP4 resource need deliberate durable hosting/recovery evidence;
no recording bodies were fetched. Keep WordPress files available until resolved.
Existing verified YouTube/SermonAudio identity and deliberate playback controls remain.
Click-to-load discovery limits video indexing; schema alone does not prove eligibility.
[Google video requirements](https://developers.google.com/search/docs/appearance/video).

## 8. CMS acceptance

Earlier staging adoption added the new sermon; the final additive adoption adds
one original event document while preserving all 2,582 prior source documents,
source/native history, revisions, credentials and assets. Replay added zero. Final local
and protected-staging sermon/page/event browser workflows passed body/SEO draft
save, reload, draft isolation, publish, actual HTTP verification and exact revision restore.
External browser requests and errors were zero. Ordinary tests cover repeated slug
changes/flattened redirects, sitemap/cache isolation, restore, hiding, unpublish/gone
and concurrency. This existing staging operator is not personal production authentication.
Maintainable recurring-event/calendar/feed semantics and contact delivery remain unproved.

## 9. Browser, performance and automated checks

Both final structural browser matrices cover 108 cases at desktop/mobile widths with
JavaScript on/off, with zero errors, overflow or external requests. Controlled mobile
trials ran after heavy crawls/recovery at 4x CPU, 150 ms added latency and 200,000/75,000
bytes per second down/up; SSH transport is still a separate staging limitation.

| Environment | Trials | Valid LCP | Maximum LCP ms | LCP >2,500 ms | Maximum CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| local_production_policy | 24 | 24 | 3124 | 4 | 0.006214713516935739 |
| protected_staging_tunnel | 24 | 24 | 2780 | 6 | 0.0002929681069958848 |

These are lab observations, not field acceptance or a comparable live-source baseline.
Field INP and representative Core Web Vitals remain unavailable. Existing cache-disabled/repeat/outlier/
invalid observations are retained. [Performance](seo-performance-final.summary.json).

The frozen application passed 1,287 standard tests with 146 gated skips covered by
1,433 PostgreSQL passes. The later recovery-tool correction passed six focused tests
and the actual final-backup restoration; final type checks passed. PostgreSQL:
zero skips and exact disposable cleanup. Type checks: 650 files, zero errors/warnings,
seven existing hints. The 45-page build/runtime, anonymized importer, offline audit,
182 Python checks and outgoing privacy/dataset checks passed. No new unrelated failure
was hidden. Final privacy manifest is recorded in the release summary.

## 10. Missing evidence and blockers

- Guard-compliant authoritative WordPress publication/permalink/plugin/recurrence data,
  complete current original database/configuration/upload recovery backup/restoration; do not bypass the
  SELECT/USAGE guard or call a public sitemap complete stored coverage.
- Remaining per-URL content, metadata, images, source/indexability/status/links and
  calendar-subscription/event equivalence; deferred URLs and unproved current attachment metadata are explicit.
- Durable original recording/resource hosting after WordPress runtime retirement.
- Authenticated Search Console landing/query/link/indexing/sitemap reports and comparable
  Analytics history. Fresh browser attempts reach sign-in; no account absence is inferred.
- Verified GA4 property/stream/consent/test stream; generic sanitized integration stays
  disabled rather than inventing ownership or contaminating production measurement.
- Comparable original-site performance and field INP/CWV; contact delivery, future feeds/
  recurring events, production authentication/MFA and roles/ACL recovery evidence.

## 11. Branch and deployed release

[GitHub branch](https://github.com/samuelsaad/SavingGraceBibleChurchWebsite/tree/codex/whole-site-seo-migration).
Application: `d068c2214e2d53b6c50de4788305acaf7fa052ed`. Deployment operator: `eaf5b9bdb2c29d44cd54345d13e6c7462737d9cf`.
Image: `sha256:cfdcd574a493753c73a349da9710fd44f489a07d4dbde3562c7029132201b2ff`. Application and operator commits were normally pushed and verified;
final safe documentation is a later branch commit with unchanged runtime inputs.

Bridge/source canaries, activation, compatible feature-off rollback, reactivation and four
18-response actual proxy matrices passed. Independent code/image/database/policy labels,
resource persistence and all original history were verified. Failed memory, packaging,
transfer, plan and two activation attempts remain retained. The operator-only fix
bounds full-row source snapshots and rechecks each batch; no runtime input changed. No readiness gate was lowered.

## 12. Recovery and exact remaining cutover actions

The **actual final staging backup** `48bd98ed95c9803880687a985b47e2b1f744b81ba4f6a597e2281844eac71dc3`
(18,206,823 bytes) was restored into the absent-target/OID-guarded authorized
loopback PostgreSQL 16 database. All 65 table fingerprints, constraints,
indexes, triggers/sequences, 2,252 uploaded assets and isolated application
checks matched; the created target was removed. Outbound integrations were disabled.
The first restore attempt retained a MIME-parameter assertion failure and proved
cleanup; the corrected exact-byte/current-redirect verifier passed six focused
cases and the same actual backup retry, with all files and HTTP checks.
WordPress and global-role/ACL restoration were not tested and remain separate blockers.

Close the evidence/behavior blockers above, name Samuel or a release delegate and church
account owner, freeze/capture the final source delta, reconcile it without clobbering CMS
edits, verify old/new recovery and final exact release/configuration/content hashes, then
obtain separate production cutover authorization. Activate reviewed direct redirects before
changing traffic; verify real hostname/TLS, statuses/canonicals/robots/sitemaps/assets/private
boundaries/measurement and visitor journeys immediately. Retain redirects at least a year
and WordPress recovery until acceptance. Same-domain CMS replacement does not use Change
of Address. Preserve post-launch CMS deltas if rollback becomes necessary.

[Cutover and rollback](seo-cutover-rollback-runbook.md), [prepared monitoring](seo-post-launch-monitoring.md),
[rerunnable checks](seo-remediation-checks.md). Future monitoring has not occurred.
Passing technical checks cannot guarantee unchanged rankings during recrawl.
