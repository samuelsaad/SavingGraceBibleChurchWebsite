# Whole-site SEO migration acceptance — 12 October 2026 Sydney

**NOT READY FOR CUTOVER.** Available local implementation, complete candidate
comparison, CMS tests and isolated PostgreSQL/assets restoration are complete.
The failed findings and external/source/recovery/measurement requirements below
block launch. WordPress still serves production; no traffic, DNS or original-system
mutation or retirement occurred.

## 1. Source and dated baseline

The verified source is https://www.savinggrace.org.au, preferred HTTPS www. Live
public REST home/url, TLS and response evidence establish this origin; no raw
staging address or GUID defines production. Captures span 9–11 October UTC and
retain explicitly dated 4 October evidence. WordPress 6.4.13/AIOSEO 4.6.4/Site Kit
1.116 are dated observations. The configured SQL account fails the unchanged
read-only privilege guard before table reads; stored permalink/plugin facts remain
unavailable. See [baseline](seo-source-baseline.md).

The finite 6,852-request continuation completed at 2026-10-11T11:41:46.912378Z.
Its union retains every original 15,252 URL hash, with 21,134 distinct URL rows and
14,228 captured responses. Newly observed 5,882 URLs were recorded without recursive
expansion. Source completeness remains unproven. The final ledger SHA-256 is
`e2d764ce467651cadfe88c0f12cead17066b43171fe1beb5612d42a18200cae1`.
Certified 25,292 file witnesses were checked before/after and per read: 11,225 exact
previously independently parsed records reused, 3,003 additional records parsed.
No final candidate HTTP response was reused from a superseded release.

## 2. Coverage by page, archive and resource type

| Migrated projection | Routes |
| --- | ---: |
| Ordinary pages | 33 (30 known WordPress identities) |
| Posts | 3 |
| Archives, taxonomy, observed pagination/query projections | 2,096 |
| Known originally public sermons | 457 |
| HTML event identities | 1,213 |
| Images/documents/feeds/calendar resources | 1,946 |
| Total | 5,748 |

The fresh public REST snapshot exposes 1,084 events, three venues, one organizer
and 420 readable media records out of 437 reported. Every exposed event identity
has a captured HTML projection. Another 129 HTML IDs are absent from REST; 125 use
date-suffix paths. They are not automatically 129 new authored database records.
The 17 opaque media identities remain unknown. Page/content groups, captures and
aliases are different counts. [Event evidence](seo-event-source-reconciliation.summary.json),
[source release](seo-final-source-release.summary.json).

The local delta inserted 1,667 routes, updated zero and retained 4,081; replay
inserted/updated zero. Bundle file SHA-256:
`cad131cdea84e514135c141a450639114b0ebef5ef7fd29ae965c2bdb48528ce`.
Nine archive source versions remain held; eight differ only by a reconstructed
Jetpack image reference to a verified owned original (identical text), and one
past-event list has material text/link changes. Another 256 resource reconstructions
omitted earlier source IDs while retaining exact asset/content facts; the prior
identities were preserved. No administrator edits were overwritten.

## 3. Explicit outcomes and unresolved classification

| Outcome | Distinct URLs |
| --- | ---: |
| Preserved | 3729 |
| Permanently redirected | 2817 |
| Intentionally removed | 389 |
| Unresolved | 14199 |
| Total | 21,134 |

[Every URL](seo-url-migration-map.csv) retains identity/provenance, statuses,
canonical/indexability, target, raw/reviewed/remaining findings and disposition.
All original rows remain. [Original accounting](seo-original-cohort-final.summary.json)
and [per-finding details](seo-original-cohort-final.csv) preserve the original
unreviewed cohorts exactly. Categories overlap and must not be added.

| Original finding | Original | Fixed | Evidence reclassified | Remaining |
| --- | ---: | ---: | ---: | ---: |
| metadata_change_requires_review | 2709 | 0 | 1854 | 855 |
| source_semantic_blocks_missing | 2767 | 556 | 97 | 2114 |
| source_content_image_or_alt_missing | 76 | 0 | 0 | 76 |
| source_capture_pending_or_missing | 6837 | 6837 | 0 | 0 |
| source_indexability_lost | 1928 | 1808 | 0 | 120 |
| previous_200_not_preserved | 0 | 0 | 0 | 0 |
| non_html_mime_changed | 0 | 0 | 0 | 0 |
| non_html_source_bytes_changed_requires_review | 37 | 0 | 0 | 37 |

All 975 originally failed internal targets were directly retested: 552
now resolve to 200, 2 have accepted removal evidence and
421 remain unresolved. A successful final status alone does not prove
equivalent content. Full target-level witnesses remain private.

The unresolved rows are classified without changing their outcome:

| Category | Rows |
| --- | ---: |
| external_resource | 408 |
| alternate_hostname | 3306 |
| observed_redirect_alias | 893 |
| captured_public_content | 508 |
| owned_resource | 243 |
| uncaptured_page | 218 |
| protected_control | 6 |
| tracking_variant | 1183 |
| query_or_filter | 1774 |
| source_identity_query | 16 |
| calendar_projection | 5543 |
| authored_event_or_taxonomy | 31 |
| pagination | 70 |

There are 978 distinct explicit WordPress IDs
and 11854 observed groups among unresolved rows. A canonical
group is not a proven content identity. [Classification CSV](seo-final-inventory-classification.csv)
records every URL and basis. Useful aliases/projections remain in scope.

The earlier 101 empty calendar-export removal decisions were withdrawn from the
final review: zero bytes do not prove an inactive subscription or future-empty
endpoint. Valid captured ICS/feed bytes are retained, but maintenance after future
CMS changes and subscription behavior still require proof. Missing migration work
is never classified as justified removal. Source 404 decisions remain exact, dated
mechanical evidence dispositions, not editorial or theological approval.

## 4. Original public sermons

All 454 retained known published identities and three verified additions
(30130/30131/30132) are in the source-backed release, independent of optional
transcripts, YouTube mappings or new enrichment. Final original-path outcomes:
`{"preserved": 453, "unresolved": 4}`; statuses:
`{"200": 457}`. Missing ledger entries:
0; identity mismatches: 0. See
[the 457-record check](seo-final-sermon-reconciliation.summary.json).

The current authoritative total remains unproven: the public REST index does not
expose sermons and the SQL guard rejected the configured account. Source wording,
original dates/resources and media relationships remain separate from native
approval/publication and D-158 restricted supplements. Existing reviews, findings,
explicit withdrawals and staleness gates were not erased or automatically approved.
All 457 original-path responses are 200 and identity-matched. The four unresolved
sermon outcomes are metadata-only: Arabic language/social-image corrections and
three pilot title/social-title/modified-date overrides. The latter follow existing
audited original-field edits in the eligible native projection; they were retained
rather than silently reverted. Their SEO consequences remain unreviewed. The Arabic
correction is documented, but its short source text does not satisfy the conservative
automated language witness threshold; the ledger remains unresolved.
The Arabic language/encoding/RTL remains; no translation relationship was invented.

## 5. Content, metadata and differences

[The complete hashed comparison](seo-content-metadata-diff.csv) covers titles,
descriptions, headings, normalized main blocks, lists/links, canonicals/robots,
social metadata, images/alt text, breadcrumbs/schema and original dates. It contains
no source prose. Original body retention, exact source metadata, SSR link handling,
query archive selection and controlled media were fixed through shared importer/
rendering paths. Import/deployment time never becomes a historical date.

Exact evidence policies cover equivalent formatting, source-wide navigation text,
verified broken social-logo/hostname corrections, source H1 and Arabic signals,
and narrowly demonstrated additive archive signals. [Policy](seo-difference-policy.md)
retains reasons. Comparison rules were not globally relaxed. Shared-navigation or
formatting explanations require the exact bound evidence.

Remaining metadata/block/image/indexability findings are grouped by affected type,
recorded identity and changed field in [finding groups](seo-final-finding-groups.summary.json).
Per-URL hashes/issues remain in the ledgers. Held speaker-query image
reconstructions have exact field/text diagnostics; the past-event archive delta
remains unproven. Missing source captures, true omissions and changed dynamic aliases cannot be converted to passes from similarity or a successful status.

Raw complete-comparison findings (before bounded review; categories overlap):

| Issue | Rows/findings |
| --- | ---: |
| asset_bytes_not_captured | 129 |
| external_dependency_not_requested | 408 |
| internal_target_not_200 | 3831 |
| metadata_change_requires_review | 7533 |
| non_html_mime_changed | 17 |
| non_html_source_bytes_changed_requires_review | 922 |
| previous_200_not_preserved | 378 |
| recording_not_requested | 118 |
| source_asset_dependencies_unresolved | 408 |
| source_baseline_incomplete | 1 |
| source_capture_pending_or_missing | 5881 |
| source_content_image_or_alt_missing | 1164 |
| source_deferred_urls_unresolved | 5882 |
| source_excluded_no_comparison_evidence | 6 |
| source_indexability_lost | 451 |
| source_semantic_blocks_missing | 3250 |
| status_mapping_change_requires_review | 1506 |

The raw status-loss finding has 378 non-HTML records: 363 hash-verified empty
calendar responses and 15 JavaScript/CSS bodies deliberately not captured. It
does not demonstrate 378 lost non-empty pages. Empty subscriptions remain
unresolved, and unread implementation bytes are not called verified empty. See
[exact source-body grouping](seo-previous-200-failure-groups.summary.json).

The earlier raw block grouping covered 3,218 archive rows, 28 page rows, four post rows and 126 redirect/non-HTML observations; it is historical and not the current reduced raw count. Current unreviewed groups and affected identities are recomputed in `seo-final-finding-groups.summary.json`. No broad semantic-equivalence waiver is inferred from the allocation fixes.
In 2,082 archive rows, nine exact blocks differ. A bounded diagnostic found repeated
labels, shortened/different date/passage presentation and combined card text; some
values/heading text are present, but full equivalent metadata was not proved. These
findings were not globally cleared. [Diagnostic](seo-archive-nine-block-diagnostic.summary.json).
The raw count is not automatically a count of lost paragraphs or distinct pages.

Structured data uses verified visible facts and dates. No fabricated ratings,
durations, translations or FAQ eligibility was added. Automated consistency checks
do not constitute a Google rich-result or church-listing/account certification.

## 6. Redirects, canonicals, discovery and indexing

The final local production-policy comparator checked **21,134/21,134** rows with **22,082 fresh HTTP requests**, **2,984 sitemap URLs** and **10,592 internal/sitemap targets**. It completed at 2026-10-12T09:37:01.038830Z and failed content parity. Source integrity and runtime provenance passed. No redirect-loop, avoidable-chain, self-canonical, sitemap-destination or robots-control issue was recorded. The full target report retains non-200 destinations and every raw issue. Staging separately checked all 21,134 rows through the actual proxy, deliberately retaining its sealed noindex policy. See [local HTTP results](seo-http-verification-summary.json) and [staging results](seo-final-staging-acceptance.summary.json).

The HTTPS www policy governs server redirects, canonicals, links, sitemap and schema.
Established sermon slugs and /sermons/ are retained; design variants redirect.
Meaningful captured queries precede generic routes; campaign attribution is retained.
Unknown meaningful content returns real errors rather than an unrelated 200. SSR
archive/detail/taxonomy links and useful pagination are discoverable without JS.
Later pages keep appropriate individual canonicals; valuable archives are not
blanket-noindexed. Indexable content is in initial HTML, including disclosure text.

Production policy was rehearsed only on loopback. Final deployed staging is sealed/noindex with denied public sitemaps. Both source-enabled runtime labels and actual proxy boundaries passed; full parity remains unresolved.
Admin/private previews retain denial. Robots disallow alone does not establish
non-indexing. Retain legacy redirects at least one year, preferably indefinitely.
[Google migration guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes),
[robots limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

## 7. Assets, media and restart persistence

The final resource package contains 1,946 routes/1,925 unique files/60,316,208 bytes,
SHA-256 `51ecda12026719eb366c1516fc2979528833419b3ff205ed0c3d7a707cb7ed37`.
A fresh application process independently matched the frozen code/database/policy
and passed all 1,946 byte/length/MIME/status checks with zero failures.
[Fresh-process proof](seo-final-resource-restart.summary.json). Both final staging runtimes passed all 1,946 resource checks each; older smaller proofs remain historical.

Of 408 external references, 396 have verified owned originals (transformed byte
equivalence is not claimed); 12 remain unresolved. All are classified in
[dependency evidence](seo-external-dependencies.summary.json). The 17 opaque REST
media identities remain unexposed. The 117 MP3/one MP4 WordPress URLs require verified
durable hosting/backup/restart proof before retirement; no recording bodies were
downloaded. Do not configure a fallback origin that loops into the cutover hostname.

The known 457 sermons retain 328 YouTube and 427 SermonAudio relationships, including
129 audio-only records. Existing deliberate players/labels remain. Stub/browser
checks do not prove live recording accuracy, every provider stream or autoplay.
Click-to-load video limits crawler discovery; schema alone does not establish video
indexing. [Google video requirements](https://developers.google.com/search/docs/appearance/video).

## 8. CMS SEO workflow

Source-backed CMS adoption added 453 documents (439 page/archive projections and
14 events), replay zero; 46 existing ownership routes were held and 1,175 runtime
query/archive projections excluded from ordinary-document adoption. Existing edits,
identities and source history remain. Compact directory records load selected full
documents separately, avoiding bulk editor-load failures.

Actual local source sermon/page/event body and SEO save, draft isolation, reload,
publish and exact audited restoration passed, three types/zero errors/external
requests. The source sermon was first published only after exact unchanged-source
payload validation; no pre-existing private editorial draft was published. Synthetic
PostgreSQL/HTTP tests cover repeated slug redirects, restoration, module hiding,
unpublish/gone, sitemap/cache and concurrency. These are local development identity
tests, not personal production authentication.

Final protected-staging sermon/page/event body and SEO draft-save, reload, publish, exact revision restore and actual HTTP verification passed. Interrupted selector/wait tests and exact audited restoration remain retained separately. Contact/form delivery and maintainable recurring-event/feed
service behavior remain unproven.

## 9. Performance, browser and automated verification

Final gates passed 1,280 standard tests plus 145 PostgreSQL-gated cases covered by 1,425 PostgreSQL tests across 154 files with zero skips and exact target cleanup. Type checks covered 648 files with zero errors/warnings and seven hints. The 45-page build, runtime bundle, anonymized importer and offline audit passed; all 173 Python operator/SEO checks passed. The 438-file source/build/docs scan found zero secret/private-body/proprietary issues. Final documentation is scanned separately before publication.

The final local and staging structural browser matrices each cover 90 cases at 1440/390/320 pixels with JavaScript on/off. Local errors/overflow are 0/0; staging errors/overflow are 0/0. Their timings are unthrottled, concurrent lab observations. Earlier OOMs, interrupted comparisons and browser-selector/wait failures remain retained. The current empty-text-query allocation fix preserves actual transcript/Q&A search and metadata filters.

Final controlled mobile lab covered 24 local and 24 staging trials at 4x CPU slowdown, 150 ms latency and 200,000/75,000 bytes per second down/up. Valid maximum LCP was 4248 ms locally and 3896 ms through staging; 6 local and 8 staging observations exceeded 2,500 ms. All 48 final LCP samples were positive and valid. Earlier invalid/zero samples and cold outliers remain retained. SSH transport and unverified warm-cache conditions limit interpretation. Field INP/CWV and comparable live-source acceptance remain unproved. See [performance](seo-performance-verification.md) and [machine results](seo-performance-final.summary.json).

## 10. Missing evidence and genuine blockers

- Complete current WordPress publication/permalink/plugin/recurrence inventory and
  all observed uncaptured URLs; known 457 sermons do not prove authoritative total.
- Remaining per-URL content/metadata/indexability/status/internal-link findings and
  the material past-event archive delta and remaining resource equivalence. Useful
  empty subscriptions cannot be retired on zero bytes.
- Current WordPress database/uploads/configuration backup and isolated WordPress
  restore; production/staging role/ACL recovery and reviewed production routing/
  individual attributable administrator authentication remain unproven.
- Church-owned Search Console landing/query/link/indexing/sitemap reports, comparable
  Analytics/access logs and field CWV; browser account inspection failed before access.
- Verified GA4 property/stream/consent/enhanced-measurement settings and test stream.
  Synthetic local collector checks passed; no live stream test/production activation
  occurred. Existing sanitized integration remains off. Suppressed referrer limits
  attribution and requires reconciliation before claiming measurement continuity.
- Durable original recording origin, 17 opaque media IDs, 12 unresolved external
  references, maintainable feed/calendar subscriptions and contact delivery.
- Failed/unaccepted final LCP observations and missing comparable live-source and field performance. Normal Git publication and remote identity verification now passed.

One public Google DNS verification marker was observed at
2026-10-11T16:06:15.4769305Z without exposing its value or proving account ownership.
No account/property absence is inferred from unavailable access.

## 11. GitHub branch and release identifiers

Branch: [codex/whole-site-seo-migration](https://github.com/samuelsaad/SavingGraceBibleChurchWebsite/tree/codex/whole-site-seo-migration). Application `a257de54b54c29ce3fc5a8fcdce73e954dcafa31` was normally pushed and independently matched against the remote. Both sealed staging runtimes run immutable image `sha256:93e7c5949adf60d97d7506892a4200986830bf9ec614bd749c0f8ceb58bac4cd`. Final acceptance documentation is a subsequent branch commit and does not change deployed application bytes.

Bridge/source canaries (12 actual homepage renders each), activation, compatible feature-off rollback, reactivation and four 18-response proxy matrices passed. Migration replay changed zero across 5,748 routes; CMS replay added zero. Source/native/CMS history, credentials and assets remained preserved. Independent code/image/database/policy runtime labels, all resources and full 21,134-row proxy verification are recorded in [staging evidence](seo-final-staging-acceptance.summary.json). Raw staging indexing differences reflect deliberate sealed noindex policy; neither environment passed overall content parity.

## 12. Recovery, monitoring and exact remaining cutover actions

The final actual staging backup SHA-256 is `803495e9231365bde80cd4b33364e397c775b647f506dbfe5df6fe478ad15e62` (18,084,021 bytes). The explicitly authorized absent-target/OID-guarded restore matched all 65 table/schema fingerprints, constraints/indexes/triggers/sequences and 2218 files. The isolated restored application passed 1946 resource routes and 8 HTTP checks with outbound integrations disabled; the created target was removed. The separate earlier local backup also matched 65 tables, 2,221 files, 1,946 resources and eight HTTP checks. Neither proof establishes WordPress recovery or global role/ACL recreation. [Recovery evidence](seo-final-recovery.summary.json).

[Rerunnable checks](seo-remediation-checks.md), [cutover/rollback runbook](seo-cutover-rollback-runbook.md)
and [monitoring](seo-post-launch-monitoring.md) are prepared. Samuel or an explicitly
named delegate must be recorded as release/incident operator before cutover; the
church account owner supplies reporting baselines. No future monitoring has occurred.

Resolve the listed source/content/resource/measurement/performance/recovery gates;
retain the verified staging release, complete the safe evidence push, and rerun affected checks if any blocker resolution changes the candidate. Record a church content freeze or verified change capture,
perform a fresh identity-bound final delta (additions/edits/removals/publication/assets),
reconcile and take demonstrated old/new backups. Obtain separate production cutover
authority and review the real hostname/TLS/proxy/authentication configuration.

Only then activate the verified production release and exact redirects, immediately
verify real DNS/TLS/statuses/canonicals/robots/sitemap/assets/measurement and visitor
journeys, and start the dated monitoring checklist. Preserve post-launch editorial
deltas before rollback; retain WordPress/assets and legacy redirects. A same-domain
CMS replacement does not use Change of Address. Technical readiness cannot guarantee
identical rankings during recrawl. No production cutover is authorized by this report.
