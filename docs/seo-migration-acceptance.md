# Whole-site SEO migration acceptance - 10–11 October 2026

**Verdict: NOT READY FOR CUTOVER.** The implementation and protected staging
rehearsal below are complete to the recorded extent. Unresolved URL/content,
source/account, measurement and restoration requirements block launch. Production
traffic, DNS and WordPress were not changed.

## 1. Source and dated baseline

The verified original site is https://www.savinggrace.org.au. The fresh public REST
root reports both home and url at this HTTPS www origin, timezone Australia/Melbourne.
The apex HTTPS homepage also served a self-canonical copy; the replacement's permanent
www normalization is a documented duplicate correction. Public responses identified
WordPress 6.4.13, AIOSEO 4.6.4 and Site Kit 1.116.0. Stored SQL facts and plugin meta
fields could not be read because the configured account failed the unchanged privilege
guard before table inspection.

The frozen union retains captures from 9 October 13:18-14:52 UTC plus the dated
10 October REST/HTML/resource continuation and search probe. It includes 7,376
responses (5,802 successful, 1,247 permanent redirects, 28 temporary redirects,
137 not found, 162 rate-limited) and 14,818 discovered URLs. It is incomplete.
The union SHA-256 is `dd355c3d210e9d5ba13abe9f5a1b54d0945a993e94660729204b7ae0d30eec39`.
Retained 4 October source evidence remains labeled historical. See
[the detailed baseline](seo-source-baseline.md).

## 2. Coverage and source release

| Projection type | Migrated routes |
| --- | ---: |
| Pages, including home/about/beliefs/ministries/contact/giving | 30 |
| Posts | 3 |
| Archives, taxonomy and observed query/pagination projections | 665 |
| Originally public sermons | 457 |
| Events and captured date projections | 1197 |
| Images/documents/feeds/calendar resource routes | 1070 |
| Total | 3422 |

Public REST independently exposed 1,084 published events, three venues, one
organizer and 420 readable media identities. Seventeen of the header-reported
437 media records were not exposed; their identities are not invented. The
1,197 event projections include 113 previously captured virtual/date pages.
Aliases, captures and projections are different counts.

The deployed import bundle file SHA-256 is
`8499c2c3fd3c983a757fa286614d949e90b1ac10976ce4ebcf7b3b78ed2b30a1`.
The 1,049-file asset archive SHA-256 is
`2eaaf36231cb9c5fbd88175fc1ae55ceb245a6917fed1bcc0a41dc0de7bfd064`.
The final comparison witness binds the union inventory while retaining identical
projection payloads; it is not an additional import or approval. Its SHA-256 is
`f817a19fb2b274b8064916a13883a2f7f1db69e96baae74aab859410b283b659`.
The CAS proof verified all 2,351 old versions and all original content fields.
Local delta inserted 1,071 routes, updated two asset identity metadata records and
retained 2,349 unchanged. Replay inserted/updated zero, retaining all 3,422 routes.

## 3. Explicit URL outcomes

The complete inventory contains 15,252 rows.

| Outcome | URL rows |
| --- | ---: |
| intentionally_removed | 238 |
| preserved | 2711 |
| redirected | 1279 |
| unresolved | 11024 |

The [complete URL ledger](seo-url-migration-map.csv) and
[content/metadata comparison](seo-content-metadata-diff.csv) retain source/candidate
status, identity, capture provenance, canonical/indexability, hashes, issue codes
and reviewed policy references. Traffic/backlink evidence is unavailable. An
unresolved row is a launch issue, even if the candidate returned 200.

Preexisting source 404s and exactly 101 zero-byte calendar-export responses have
narrow removal reasons. Those exports contain no substantive HTML or calendar bytes.
Missing migration work is not classified as intentional removal. Decisions are
mechanical evidence dispositions, never administrator or theological approvals.

## 4. Original public sermon reconciliation

All 454 retained published identities had fresh successful original-path source
responses; three new identities bring the known public set to 457. All 457 are
included independently of missing YouTube mappings or optional new enrichment.
The REST API does not expose sermons, so 457 is not a proven complete current
stored count. No GUID was treated as a permalink.

Reconciliation: `{"available": true, "basis": "explicit_retained_source_id_and_sermon_path_not_guid", "freshDatabaseInventoryAvailable": false, "freshIdsAbsentFromFinalBundle": [], "freshIdsAbsentFromRetainedPublished": [30130, 30131, 30132], "freshPrimaryMediaMissingCount": 0, "freshUniqueSermonIds": 457, "limitation": "retained_export_is_historical_fresh_wordpress_grant_guard_failed", "outcomeCounts": {"fresh_same_identity_same_path": 454}, "retainedIdsAbsentFromFinalBundle": [], "retainedIdsAbsentFromFreshSermons": [], "retainedPublishedCount": 454, "retainedSeedSourceStatuses": {"200": 454}}`.

Imported source versions retain captured wording, service/publication/modification
dates, metadata and verified media relationships. Complete rendered equivalence
remains unresolved where the ledger records missing blocks or metadata changes.
Generated transcript/description/Q&A
review and uncertainty remain separate. Native staging remains 398 sermons with
144 ordinary publications; source migration does not rewrite those publication
states, human reviews, warnings or editorial withdrawals. Stage-only delegated
supplements remain rejected by the production selector.

## 5. Content, metadata and structured data

Remaining issue counts after bounded exact-witness review:

| Outcome | URL rows |
| --- | ---: |
| asset_bytes_not_captured | 145 |
| external_dependency_not_requested | 408 |
| metadata_change_requires_review | 2709 |
| non_html_source_bytes_changed_requires_review | 37 |
| recording_not_requested | 118 |
| source_capture_pending_or_missing | 6837 |
| source_content_image_or_alt_missing | 76 |
| source_excluded_no_comparison_evidence | 6 |
| source_indexability_lost | 1928 |
| source_redirect_target_capture_missing | 438 |
| source_semantic_blocks_missing | 2767 |
| status_mapping_change_requires_review | 629 |

The comparison covers title/description/headings, blocks/lists/links,
canonical/robots/social signals, images/alt text, breadcrumbs/schema and dates.
The [difference policy](seo-difference-policy.md) records exact bounded corrections
including a broken staging-host social logo, actual Arabic language/RTL, missing
source H1 and equivalent formatting. Existing explicit CMS edits take precedence;
retained source copy is included by default until an explicit published replacement.
Import/deployment times do not become historical dates. Translation relationships,
ratings, reviews and recording facts are not invented.

Missing paragraphs/links/alt/schema and unexplained material metadata changes remain
unresolved. Automated JSON/property consistency does not constitute Google rich-result
certification. Current [organization guidance](https://developers.google.com/search/docs/appearance/structured-data/organization)
was reviewed; eligible properties must agree with visible verified church facts.

## 6. Redirects, discovery, canonicals and indexing

Production-mode comparison checked 15,252/15,252 rows with 15,960 actual HTTP requests and 2,111 sitemap URLs. The comparator verdict is failed because unresolved findings/source coverage remain. The current production sitemap contains 2,111 URLs; zero recorded canonical-conflict/redirect-loop/avoidable-chain issues is not full content acceptance. Complete raw results are in the machine summary; zero-valued absence of a particular issue is not overall acceptance.

The production internal-target audit still records 975 non-200 targets. The final
download-button correction removes the preceding single internal redirect, but
does not clear the remaining discovery failures. The deployed private-environment
audit records 1,059 non-200 internal targets, 32 non-HTML MIME differences and 133
previous-success status differences; its raw findings remain in the machine report.
Staging exclusions require individual classification and do not establish production
content equivalence. Neither crawl is represented as an overall pass.

HTTPS www policy governs metadata, links, sitemaps and structured data. Original
sermon slugs replace temporary evaluation identifiers; design variants redirect to
/sermons/. Exact observed query content/exports precede generic routes. Unknown
meaningful legacy queries return genuine errors rather than unrelated homepage
content. Verified shortlinks/attachment identities retain campaign query bytes.
Useful archive/taxonomy links and pagination are server-rendered; valid later pages
retain their own canonical. Search/filter policy is bounded rather than a blanket
noindex for valuable archives.

Production-mode rehearsal is isolated on loopback. Deployed staging remains
loopback/SSH-only and noindex, with no production canonical/sitemap exposure.
Admin/private previews retain their denial/authentication boundaries. Robots blocking
alone is not represented as protection against indexed URLs. Redirects must remain
at least a year, preferably indefinitely, and internal links must use final targets.
See [Google migration guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

## 7. Assets, media and persistence

The source resource capture verified 1,120 responses by status, MIME, file signature,
length and SHA-256. It covers images, seven PDFs, a DOCX, a PPTX, RSS and ICS.
The migrated projection has 1,070 resource routes and 1,049 unique durable files.

After rollback/reactivation, both deployed runtimes served all 1,070 resource routes
with exact expected SHA-256, length and MIME: 2,140 HTTP checks, zero failures.
These checks bind the actual runtime labels and verify durable availability after restart.

All 117 MP3s, one MP4 and two ZIP URLs returned 200 to HEAD-only checks. No recording
body was fetched; no byte identity or durable recording migration is claimed.
One OTF and 17 unexposed media identities remain unresolved. There are 408 external
dependencies; 37 verified church-original rewrites do not prove transformed CDN byte
identity. WordPress cannot be retired while required hosted files remain dependent.

The 755 primary provider relationships (328 YouTube, 427 SermonAudio) and 129
audio-only sermons retain their identities and deliberate playback controls.
Click-to-load frames limit evidence of video discoverability: schema alone does not
prove video indexing. See [Google video requirements](https://developers.google.com/search/docs/appearance/video).

## 8. CMS and future-edit protection

Executed synthetic PostgreSQL/actual HTTP lifecycle tests cover draft metadata and
sitemap exclusion, publishing rendered SEO/content, hiding a module while retaining
page status, repeated slug changes with direct flattened redirects, restore then
publish, final internal links, in-use removal refusal, gone/redirect disposition,
revision retention, noindex/sitemap consistency and deletion denial. All final
PostgreSQL tests passed with zero skips. Five separate read-only browser checks
verified page/home SEO controls, canonical guidance and mobile inspector without
changing revision pointers.

Native CMS state and authentication material were preserved during deployment.
Source-only fallback documents are immutable migration snapshots, not automatically
editable CMS entities. Full editor adoption of every source-only type and externally
verified personally authenticated production publishing remain incomplete; successful
synthetic submission alone is not whole-site workflow acceptance.

## 9. Automated, browser and performance verification

Final unit run: 1,240 passed, 145 DB-gated skips. The PostgreSQL run before the final
download-button-only rendering correction passed 1,384 tests, zero skips; exact
disposable test database removed. That correction changes no database code or data.
Astro: zero errors/warnings,
16 hints. Build and offline runtime build passed. Python SEO suites: 82 passed.
Source/build scans verified unchanged authorized datasets, 16-word private-body
matching, secret/proprietary/binary/symlink controls; zero blocking findings.
Offline dependency audit: zero known vulnerabilities. Anonymous importer dry run:
five input, three included, two excluded, zero rejected.

Independent CSV validation checked 15,252 unique identities in each ledger, matching
map/diff dispositions, summary counts and output hashes. Missing traffic/backlink
evidence stays `unavailable`; unknown response codes are not replaced by zero.
The production comparison's independently parsed source cache verified 7,376 records
and 13,794 source-file witnesses before/after the run, with source-body hashes checked
on each read. All candidate HTTP responses were fresh. Its proof SHA-256 is
`704e157763a4b7f99dd3b63138a72764874f222aead5daaf0907eb0236d6ea77`.
This proves frozen-input integrity, not complete semantic reading or content accuracy.

Final local browser proof: 66 cases, JavaScript on/off at 1440/390/320 pixels, zero errors and external requests. Main/event/visitor maximum LCP 920/672/788 ms, CLS at most 0.001591. Final deployed browser metrics appear in the release result below; neither is field evidence.

A repeatable streamed mobile reading-column shift was fixed without changing selected
design, copy or media identity. Controlled streaming trials reduced CLS from 0.122222
to at most 0.000293; deployed three-trial recheck reported zero. A bounded comparable
390x900, JS-off, 4x CPU/150ms network experiment measured old/new LCP home 3280/1752ms,
archive 3284/1576ms, sermon 3148/2164ms, candidate CLS at most 0.044646. Conditions
blocked third parties and are not field evidence. INP and production real-user
Core Web Vitals are unavailable. See [performance evidence](seo-performance-verification.md).

## 10. Missing evidence and launch blockers

Resolve every unresolved URL/material content or metadata difference; complete
source inventory including meaningful deferred archives/aliases/query/feed/resource
paths; obtain fresh authoritative sermon/permalink/plugin metadata through a least-
privileged account or equivalent verified source; reconcile full WXR/assets and
WordPress recovery backup. Obtain church-owned Search Console/Analytics/Tag Manager,
organic landing/query/backlink/indexing/sitemap/error evidence, comparable periods,
access logs and field performance. Public verification TXT presence is not account
ownership/report evidence. No future monitoring has been claimed.

Production measurement continuity is not implemented: automatic approval review
rejected the GA4 opt-in/minimal CSP egress change because its telemetry payload/egress
authority was not explicit. The separate local full-backup restore target/governance
change was also rejected; no restore database was created and no full restoration
was demonstrated. Guarded restoration code/tests and protected archive-validated
backups do not satisfy that missing execution gate. Continue retaining WordPress.

## 11. Git and protected staging release

Branch: [codex/whole-site-seo-migration](https://github.com/samuelsaad/SavingGraceBibleChurchWebsite/tree/codex/whole-site-seo-migration).
Application core `52dca271bef9e80c15ee76b9b46e2d85ae15de08` was normally pushed and independently matched against
the remote before deployment. Both sealed runtimes run image
`sha256:b11affa6ee5f919fea6796512d50f2cd43d0ca53a97133470b8658a172cce38f`.
Verifier commit `162b584ccf23d71338ca62a033815a5914170d79` changes only evidence-path
portability; subsequent acceptance documentation does not change deployed application
bytes. The final evidence publication commit is the verified branch head reported
at completion.

Executed final bridge/candidate canaries, exact replay, activation, feature-off
rollback and reactivation passed. The retained rollback HTTP witness hash is
`6094bb325565542dcb6927e8d3726df03682fd6f2c178b587108452a6d732cc4`.
Independent reactivated runtime labels are public
`e5740ae593aba55f241c5b3ee890f6d6f747a0a7aeb4ce3db673060f649ff74f` and protected
`bf224e0b926aeaba96b4da836c70946104475fbaf897dec6f4e5563f1b6b431c`.
Ten HTTP responses after each switch verified home/readiness/robots, intentional
staging sitemap 404, public admin 401 and protected admin login redirect.

The corrected deployed comparator checked 15,252/15,252
inventory rows with 17,482 real HTTP requests through the
deployed proxy, requiring the exact release label. It completed at
`2026-10-10T13:23:36.636336Z`. Production-mode local rehearsal completed at
`2026-10-10T12:25:08.604635Z`. Both raw comparisons retain unresolved findings and
return failed verdicts; private-environment exclusions are deliberate and do not
establish production parity. The first deployed harness attempt is retained as
failed evidence (missing asset witnesses and a Windows path error), separately from
these corrected complete results. See [the complete machine results](seo-http-verification-summary.json).

Final deployed browser checks passed 66 cases, JS on/off at 1440/390/320 pixels,
with zero page errors/external requests. Main/event/visitor maximum LCP was
3368/2396/5308 ms and maximum CLS 0.000350/0.003235/0. SSH transport and concurrent
bulk reconciliation affected these lab timings; deployed LCP does not meet the
2.5-second target in every case. Field LCP/INP/CLS remain unavailable.

Source history remains 3,424 immutable versions/3,422 active routes/two receipts
at fingerprint `7a1a5ffca195eb99c587eec12bb8a0903269c94c49794034d38525967c1f6845`.
Native 398 sermons/144 publications and CMS 52 entities/68 revisions/97 routes/
47 assets/81 audit rows remain unchanged. Schema is 28. Both roots are read-only;
semantic visitor eligibility is disabled, public port is loopback-only, protected
port is unpublished, and staging remains non-indexable.


The source import preserves prior immutable history and existing CMS/editorial rows.
Compatible feature-off application rollback differs from full backup restoration.
See [staging procedure](seo-staging-deployment.md). No production traffic/DNS,
WordPress mutation, forced push or old-system removal occurred.

## 12. Exact remaining cutover actions

Close the blockers above and rerun full acceptance. Confirm Samuel or a named delegate
as cutover/rollback operator, agree a UTC content freeze/change-capture window, obtain
verified old/new backups and demonstrate isolated restoration. Capture/import/replay
the final additions/edits/publication changes with current-version conflict guards;
reconcile removals explicitly. Freeze exact code/image/config/schema/content hashes.
Review real-host TLS/proxy/redirect activation and production measurement without
staging reporting pollution; obtain separate production cutover authority. Activate
in reviewed order, run real hostname/TLS/status/canonical/robots/sitemap/assets/media/
analytics and visitor smoke tests, and preserve post-launch edits before rollback.

Use the [cutover/rollback runbook](seo-cutover-rollback-runbook.md) and
[monitoring checklist](seo-post-launch-monitoring.md) for launch day, following days
and weeks. This is a same-domain CMS replacement: no Search Console Change of Address.
Passing technical gates would demonstrate readiness, not guaranteed rankings during
recrawl. No cutover is authorized while this verdict remains NOT READY.

## Rerunnable commands

```powershell
npm test
npm run check
npm run build
npm run test:postgres
python -m unittest discover -s tests -p "seo_*_test.py"
npm run migration:dry-run -- --input tests/fixtures/dry-run.json
python scripts/seo-verify-candidate.py --baseline private/seo-baseline/public-api-frontier-20261010/ledger-final-union.private.json --assets private/seo-baseline/public-api-frontier-20261010/assets-final-union.private.json --candidate http://127.0.0.1:4440 --environment production --expected-runtime-label <verified-label> --timeout 60 --request-limit 30000 --concurrency 4 --output private/seo-candidate/<fresh-run>
python scripts/seo-export-acceptance.py --baseline private/seo-baseline/public-api-frontier-20261010/ledger-final-union.private.json --assets private/seo-baseline/public-api-frontier-20261010/assets-final-union.private.json --candidate private/seo-candidate/<fresh-run> --bundle private/seo/source-expanded-acceptance-bundle.private.json --reviews private/seo/disposition-review-download-links-final.private.json --repo . --output private/seo-acceptance/<fresh-output>
```

Use the protected retained source/review paths, current runtime labels and fresh
output directories. No
placeholder is executable evidence. Public-safe machine summaries bind all inputs;
private source/account material stays excluded from Git and runtime images.
