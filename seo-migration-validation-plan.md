> D-183 20 October: PostgreSQL 1,531/zero skips, standard 1,384/147 gated skips,
> Python 222, types/build/importer/offline audit pass for the integrated candidate.
> The frozen union is 23,129 URLs; full-release HTTP/cohort and protected staging
> acceptance must remain separately evidenced. See CURRENT_PROJECT_HANDOVER.md.

> D-181 (9 October 2026) supersedes historical fixed-count and universal new-enrichment
> prerequisites for preserving already-public originals. Use the fresh union inventory
> and `seo-migration-plan.md`; source-backed original pages and independently approved
> new enrichment are separate. Historical counts below remain dated evidence only.

# Whole-Site SEO Migration and Validation Plan

**Status:** Permanent architecture and launch-gate requirement; baseline discovery is partially complete.  
**Scope:** The entire public website, including sermons, ordinary pages, ministries, events, media, archives, taxonomies, pagination, and every other indexable template.  
**Current safety boundary:** This plan uses existing repository discovery only. No fresh production crawl, analytics access, Search Console access, or remote request is authorised by this document.

## 1. Permanent non-regression decision

The current Saving Grace Bible Church website performs well in organic search. The replacement must preserve that performance at minimum and should safely improve technical SEO. Ranking improvement cannot be guaranteed, but loss of established crawlability, indexability, URLs, content, metadata, link equity, or performance signals is unacceptable.

SEO parity is a production launch gate. Launch must be blocked when the complete baseline/mapping/validation report is missing, material differences are unexplained, or parity cannot be demonstrated. Visual redesign is never sufficient reason to discard established content or metadata.

## 2. Evidence available without new production contact

| Finding | Current evidence | Classification |
| --- | --- | --- |
| Published sermon detail paths | 448 unique populated slugs at `/sermons/{slug}/` | `source-and-database-confirmed` |
| Sermon archive | `/sermons/`, list view, 9 results per page | `source-and-database-confirmed` |
| Pagination | `/sermons/page/{n}/`; 50 pages, with 7 results on the last page | `source-and-database-confirmed` |
| Sermon discoverability | Speaker, series, passage, book, keyword, date, ordering, and pagination behaviours documented | `source-and-database-confirmed` |
| Detail canonical | Representative public sermon detail self-canonicalised to its public `/sermons/{slug}/` URL | `database-observed` |
| Per-sermon SEO overrides | AIOSEO rows exist, but effective title/description/social overrides are empty/null. Target `seo_description` is a controlled optional override; otherwise the approved visible sermon description is used. | `database-observed-and-approved-target-decision` |
| Social-image defect | A representative public detail page used a staging-origin Open Graph image | `database-observed` |
| Stored host mismatch | WordPress `home`/`siteurl` do not match the observed canonical public origin; values were deliberately not retrieved | `database-observed` |
| Historic sermon slug redirects | No sermon `_wp_old_slug` rows | `database-observed` |
| Whole-site crawl/index baseline | Not present in current artifacts | `unresolved` |
| Search Console/analytics landing-page baseline | Not accessed | `unresolved` |

The sermon-specific evidence must seed the manifest; it must not be mistaken for a whole-site inventory.

## 3. Later explicitly approved read-only discovery

Before production launch planning, obtain separate approval for a read-only SEO baseline task. It should:

1. Crawl the current public site as a search-engine-capable user agent, respecting agreed rate limits.
2. Export every discovered internal URL, status, redirect target, canonical, robots directive, title, description, primary heading, word/content fingerprint, dates, structured-data types, image/alt data, social metadata, internal inlinks/outlinks, pagination relationships, and rendered/non-rendered content status.
3. Capture current `robots.txt`, XML sitemap indexes/sitemaps, representative response headers, error templates, and canonical host/trailing-slash behaviour.
4. With separately authorised church-owned access, export Search Console pages/queries, indexing/canonical reports, sitemap status, Core Web Vitals, mobile usability where available, and high-value landing pages. Export equivalent analytics landing-page evidence only if approved.
5. Record crawl time, tool/version, scope, exclusions, authentication state, and safe hashes without collecting user data or credentials.

Until that task is authorised, whole-site counts, traffic thresholds, rankings, and template coverage remain unresolved—not assumed.

## 4. One-to-one URL inventory

Create a versioned machine-readable manifest with exactly one row per observed or otherwise proven indexable legacy URL. Required fields:

- Normalised legacy absolute URL and path/query form
- Discovery source: crawl, sitemap, database, internal link, Search Console, analytics, or manual evidence
- Current status and redirect chain
- Template/entity type and stable source identity where available
- Current indexability, canonical, robots directive, sitemap membership, and internal inlink count
- Title, description, H1, content/date fingerprint, social image, and structured-data types
- Proposed target URL and disposition: unchanged `200`, one-hop `301`, deliberate `404`, or deliberate `410`
- Redirect reason, target entity identity, approval state, and validation outcome
- Risk/value indicators such as Search Console/analytics evidence when later authorised

Every baseline URL must have exactly one reviewed disposition. Target routes absent from the legacy manifest must be classified as intentional additions, not silently treated as migrated pages.

## 5. Signal-preservation migration rules

- Preserve existing indexable paths and slugs wherever practical, including trailing-slash and canonical-host policy.
- Preserve valuable titles, descriptions, H1/headings, visible content, dates, internal links, image alt text, image associations, social metadata, and structured data unless a reviewed change is demonstrably safer.
- Never remove content/metadata merely because the new design does not display it by default.
- Generate a direct permanent `301` for every unavoidable public URL change; never use broad homepage redirects as a substitute for mapping.
- Preserve sermon archive, detail, speaker, series, book, passage, filter landing page, and pagination discoverability according to the approved search/URL contracts.
- Exclude unpublished, pending, draft, scheduled, archived, admin, search-result, preview, and migration-only records from public canonicals and sitemaps.
- Correct the known staging/unknown-origin social-image configuration before launch and verify every public social image uses the approved production origin or approved external asset origin.

## 6. Crawlable rendering and HTTP behaviour

- Every indexable page must return meaningful server-rendered HTML containing its primary title, headings, content, navigation, and important internal links without requiring client-side JavaScript.
- Return accurate `200`, `301`, `302/307/308` only when deliberately temporary, `404`, `410`, and `5xx` statuses. A styled error page must not return `200`.
- Public search/filter enhancements may use JavaScript, but the canonical crawl path and primary content must work without it.
- Staging/preview environments require both access controls where practical and explicit `noindex`; their sitemaps must not be submitted or linked from production. Production public pages must not inherit staging `noindex` or disallow rules.

## 7. Canonicals and duplicate control

- Every indexable page must emit one absolute self-referencing canonical using the approved HTTPS host and normalised path.
- Redirect noncanonical host, scheme, slash, case, and alternate legacy forms in one hop when safe.
- Define an allowlist for query parameters that represent intentional crawlable landing pages. Search terms, arbitrary filter combinations, tracking parameters, sort variants, previews, and duplicate pagination forms must not create competing indexable pages.
- Pagination must have unique crawlable URLs, unique primary content, correct self-canonicals, reachable internal links, and deterministic ordering. Do not canonicalise every paginated page to page one.
- Remove tracking parameters from canonical URLs and prevent infinite crawl spaces.

## 8. Redirect quality gates

For every redirect manifest row verify:

- One hop from old URL to final canonical target
- Permanent `301` status for permanent moves
- Final target returns indexable `200` and represents the same intent/content
- No chain, loop, open redirect, host-header-derived target, unsafe decoding, or case/encoding ambiguity
- No soft 404, blanket homepage mapping, or redirect from never-public content without evidence
- Query/path behaviour is preserved only when semantically required
- Internal links and sitemap entries point directly to final target URLs, not redirects

### Slug changes, archives, and permanent deletion

- Archiving or otherwise unpublishing a sermon removes it from public routes and sitemaps but does not by itself discard its URL history or first-publication evidence.
- Changing the slug of a previously published sermon must transactionally create or update a direct `301` from the former path to the new canonical path and collapse earlier aliases to the final target. It must never silently strand the former URL.
- Permanent deletion is allowed only from the archived state through the separately approved admin safeguards. A previously published path requires either a reviewed direct `301` to equivalent currently published content or an explicit `gone` disposition for a future HTTP `410` response.
- A deletion redirect target must be validated as live, public, canonical, and equivalent before production use. `410` is preferred when no equivalent content exists; unrelated homepage/category redirects and unmanaged `404` outcomes are prohibited.
- Deleted URLs must be removed from sitemaps and internal links. Redirect destinations must be linked directly. Gone paths must return a real `410`, must not self-canonicalise as content, and must not be present in production sitemaps.
- The one-to-one URL manifest records the deletion decision, reason, approval, former identity/slug, final status, and validation result without retaining deleted content or private provenance.

## 9. Sitemaps, robots, breadcrumbs, and structured data

- Generate valid XML sitemap indexes/sitemaps containing final canonical indexable `200` URLs only, with correct production host and trustworthy modification dates.
- Validate `robots.txt` independently for production and every non-production environment. Do not use `robots.txt` as the only protection for private content.
- Emit crawlable breadcrumb links and valid breadcrumb structured data where the hierarchy is meaningful.
- Use appropriate, accurate schema types such as organisation/church, webpage/article where justified, breadcrumb, event, and video objects. Structured data must match visible content and must not invent ratings, dates, people, or media.
- Preserve Open Graph/Twitter metadata and validate absolute titles, descriptions, URLs, and production social images.

## 10. Controlled administration design

Approved administrators need controlled fields, not an arbitrary metadata or `<head>` injection system:

- Canonical slug/path through the normal content model
- Optional `seoTitle` and `seoDescription` overrides; otherwise deterministic template defaults
- Optional controlled social title/description and managed social image relationship
- Image alternative text on managed assets
- Preview of title, description, canonical URL, social image, and indexability derived from status/template

Validation must reject scripts, HTML head fragments, arbitrary meta names, arbitrary JSON-LD, external canonical hosts, staging-origin social images, and WordPress-style postmeta. Indexability is policy-derived: administrators cannot make non-public/admin/preview content indexable. Canonical overrides should be exceptional, internally scoped, and reviewed rather than free-form input.

These fields belong in explicit columns/relationships and versioned API contracts when implemented. Historic metadata remains preserved in migration evidence even when an override is empty or not exposed to administrators.

## 11. Validation stages

### Baseline and mapping

- Reconcile crawl, sitemap, database, Search Console, and approved analytics URL sets.
- Identify orphan pages, sitemap-only pages, internally linked redirects, duplicate URLs, and valuable pages discoverable from only one source.
- Produce reviewed old-to-new mapping and metadata/content fingerprints.

### Automated target crawl

- Crawl with and without JavaScript and compare indexable URL sets, primary content, links, status, canonical, metadata, and structured data.
- Test sitemap/robots consistency, duplicate parameter forms, pagination traversal, broken internal links, orphan pages, 404/soft-404 behaviour, and redirect coverage.
- Validate that every non-public/admin/search/preview route is absent from sitemaps and non-indexable even when its URL is known.

### Pre-launch comparison

- Crawl the final protected staging/rehearsal build using production-equivalent routing and content.
- Compare every legacy manifest row with its target outcome and review every material metadata/content/internal-link difference.
- Compare mobile rendering, accessibility, semantic structure, and performance per template and for high-value landing pages.

## 12. Performance and quality budgets

Record approved mobile and desktop baselines before setting final budgets. At minimum:

- No material regression in field or lab Core Web Vitals relative to the current site
- Aim for the applicable “good” Core Web Vitals range at the 75th percentile
- Define per-template budgets for HTML, CSS, JavaScript, images, fonts, request count, server response time, and layout shift before implementation acceptance
- Primary content and navigation remain usable without JavaScript
- WCAG 2.2 AA, semantic HTML, keyboard access, labelled media/images, and responsive layouts remain acceptance requirements

Exact numeric rollback thresholds must be based on the approved baseline and launch risk tolerance, not invented during implementation.

## 13. Launch-blocking acceptance criteria

Production launch is blocked unless all are true:

- The separate sermon content gate reports exactly 453 included historical records, 453 sole speakers, 453 approved sermon descriptions, 453 approved complete transcripts, 453 records with 5–10 approved ordered Q&A pairs, 453 valid required metadata/media records, 453 complete, and zero incomplete. The five pending rows remain non-indexable/non-public.
- Every approved sermon description is visible and uncollapsed below title/core metadata and before media/transcript/Q&A in initial server HTML at its stable self-canonical detail URL. Every published transcript and Q&A section is also present initially; collapsing uses native disclosure only for transcript. Unapproved description/enrichment is absent from public detail/search/sitemaps and heavy bodies are absent from list responses.
- Metadata uses a controlled explicit `seo_description` when set; otherwise the approved visible description provides deterministic plain-text description/social fallback. Validation confirms precedence without claiming a search engine will reproduce the wording as its snippet.
- No FAQ structured data is emitted from sermon Q&A unless a later explicit evidence-backed SEO decision approves it.

1. One hundred percent of baseline indexable URLs have a reviewed disposition.
2. Every preserved URL returns the intended canonical `200`, and every changed URL reaches its equivalent target through exactly one reviewed `301`.
3. There are zero redirect loops/chains, unintended soft 404s, broken internal links, unexplained orphan pages, staging-origin canonicals/assets, or non-production URLs in production metadata/sitemaps.
4. Titles, descriptions, headings, visible content, dates, internal links, image alt text, social metadata, and structured-data differences are either equivalent or explicitly approved.
5. Every indexable target has one self-canonical and appropriate sitemap/robots treatment; non-public/admin/search/preview/staging routes are non-indexable.
6. Primary content is present in server-rendered HTML without JavaScript.
7. Sermon archive/detail/taxonomy/passage/pagination discovery and the whole-site navigation hierarchy pass crawl comparison.
8. Structured data has no critical errors and accurately reflects visible content.
9. Mobile accessibility, semantic HTML, and approved performance budgets show no material regression.
10. The project owner reviews the complete crawl/parity report and explicitly approves every material exception.

Failure of any criterion blocks launch. “Looks correct” manual review alone is insufficient.

## 14. Post-launch monitoring and rollback

Before cutover, establish owners, observation windows, alert thresholds, and rollback authority. Monitor:

- Search Console indexing, submitted/discovered sitemap URLs, canonical selections, crawl errors, rich results, Core Web Vitals, queries, pages, impressions, clicks, CTR, and average position
- Approved analytics organic landing pages and conversions, with seasonal/context comparison
- Server logs/monitoring for crawler `4xx`/`5xx`, redirect volume, latency, and unexpected URL patterns
- Sitemap, robots, canonical, social-image, and structured-data health after every release

Rollback or immediately remediate when there is a widespread erroneous `noindex`/robots block, canonical-host failure, sitemap contamination, redirect failure, material loss of indexable high-value pages, crawler-facing `5xx`, severe performance regression, or an unexplained organic-search decline beyond the pre-agreed baseline threshold. Preserve the old platform/redirect capability until the agreed observation window closes.

## 15. Required SEO acceptance artifacts

- Whole-site indexable URL baseline and evidence sources
- One-to-one old/new URL and redirect manifest
- Metadata/content/canonical/social parity report
- Sitemap, robots, status, structured-data, and duplicate-control results
- Internal-link, orphan-page, broken-link, and soft-404 reports
- No-JavaScript/server-rendering crawl evidence
- Mobile accessibility and performance-budget report
- Pre-launch old/new crawl comparison with approved exceptions
- Post-launch Search Console/analytics monitoring runbook and rollback thresholds

All artifacts must avoid credentials, personal data, and uncontrolled production exports.


## Historical D-181 execution evidence - before staging

- Frozen source ledger:6,135 responses/11,300 observed URLs; retained454 public sermon IDs reconcile exactly and the current457-record public union is prepared.
- Private source projection:2,351 routes/resources; final local import and identical replay passed without touching existing sermon/CMS publication or review rows.
- `npm run test:postgres`:140 files/1,367 tests passed,zero skips; the guarded disposable database was removed.
- `npm test`:1,222 passed,145 database-gated skips covered above. `npm run check`:626 files,zero errors/warnings,seven hints. `npm run build` and `npm run staging:bundle`:passed.
- Capture24, fixed-frontier6, comparison14, acceptance-export12 and staging-operator11 anonymous Python checks passed.
- Anonymous importer dry run:five input/three included/two excluded/zero rejected. Offline dependency audit:zero vulnerabilities.
-42 browser cases passed with external resources blocked; max labCLS0.001587/maxLCP588ms. This is not field evidence or a comparable old/new performance certification.
- Full URL/canonical/sitemap/link/resource comparison and outgoing scans are in progress. Final per-URL results, release/deployment identities and staging rollback/reactivation receipts supersede this pre-release checkpoint when recorded.
- Full local backup restoration and production-only GA4 implementation remain blocked by automatic approval review pending explicit user confirmation. Neither was executed. WordPress source grant validation rejected broader privileges before table reads; account reports are unavailable.

## Final D-181 verification checkpoint - 10 October 2026

The final acceptance package supersedes the smaller pre-staging counts above.
See `docs/seo-migration-acceptance.md`, both safe CSV ledgers, machine summaries,
source baseline, staging release procedure, cutover/rollback and monitoring runbooks.

Executed gates: `npm test` 1,240 pass/145 database-gated skips;
`npm run test:postgres` 1,384 pass/zero skips and exact temporary database cleanup;
`npm run check` zero errors/warnings, 16 hints; `npm run build` and
`npm run staging:bundle` pass; Python SEO suites 82 pass. Anonymous migration
`npm run migration:dry-run -- --input tests/fixtures/dry-run.json` retains five input,
three included, two excluded and zero rejected. Offline dependency audit reports
zero known vulnerabilities. Runtime/source privacy scans retain unchanged authorized
datasets and zero secret/private-body/proprietary/symlink findings.

The public REST expansion verifies 1,084 event identities and 420 readable media
records, adding 1,071 source routes with strict old-version/content preservation.
Both local and sealed staging imports/replays pass; schema remains 28. Staging
canaries, activation, rollback/reactivation and preservation checks pass. Final
3,424 immutable versions/3,422 active routes/two receipts remain independent of
native 398 sermons/144 publications and CMS 52 entities/68 revisions/97 routes.
The full mapping comparator, strict runtime labels, independent source reparse,
resource hash/MIME checks and browser results are detailed in the acceptance record;
nonzero comparison results are recorded unresolved rather than converted to passes.

Full backup restoration, GA4 continuity, complete source/account baselines and
unexplained content/URL differences remain open launch gates. No production traffic,
DNS or WordPress mutation was performed. Prepared monitoring is future work, not
observed search-performance validation or a ranking guarantee.

The completed final comparisons each cover 15,252 rows: local production rehearsal
15,960 HTTP requests and 2,111 sitemap URLs; deployed proxy 17,482 HTTP requests,
no staging sitemap, exact release labels. Source integrity is verified; parity is
failed. Ledger outcomes: 2,711 preserved/1,279 redirected/238 intentional removals/
11,024 unresolved. Production internal targets include 975 non-200 responses and
zero redirects after the final download-button fix. Both restarted runtimes passed
2,140 combined byte/length/MIME resource checks with zero failures. Both 66-case
browser matrices passed; field performance remains unverified. Independent CSV
checks agree on identities, dispositions, counts, hashes and unavailable metrics.
Failed harness attempts (missing source witnesses, relative-path portability,
Windows output path length and an export wait timeout) remain separately retained.
No failed or missing requirement is converted into launch acceptance.


## D-182 final available verification — 12 October 2026 Sydney

This checkpoint supersedes earlier implementation/gate counts without deleting their
historical findings. Application `6a654e18e62d6823e21e33753a6f30859e5376c7` has frozen code
SHA-256 `e9789e586edfeb16303c0b8f240e90915b54bd493f8fb30ddbae4686d9bbfff2`.
The independently computed production-policy code/database label matched actual
HTTP: `c2f72bfd1ab685c6775daa628d097416425b995ec16ae0d98c5ef90c00449a7b`.
The complete frozen 21,134-URL comparison is in progress; no parity pass is claimed.
All 15,252 original URL hashes are retained.

Executed final gates: `npm test` 1,274 pass/145 PostgreSQL-gated skips;
`npm run test:postgres` 1,419 pass across 153 files, zero skips and exact disposable
target cleanup; `npm run check` 647 files, zero errors/warnings, seven hints;
`npm run build` 45 static pages and `npm run staging:bundle` pass. Anonymous
importer dry run retains three included/two excluded/zero rejected, offline audit
zero cached known vulnerabilities, and 115 offline Python SEO checks passed on
unchanged Python code. Final outgoing 405-file scan found zero secrets/private
bodies/proprietary material; designated dataset scope remained unchanged.

Actual local source sermon/page/event CMS body and SEO save, draft isolation, reload,
publish and exact audited restoration passed, three types/zero errors. No private
editorial draft, native approval or production publication was manufactured. Final
browser structural checks passed 90 cases across 15 paths, 1440/390/320 widths and
JavaScript on/off, with no errors/overflow/external requests. All original 975
failed internal targets were fetched directly: 552 final 200, 423 final 404 and zero
redirect issues; status success alone is not content equivalence.

The exact authorized local recovery target restored all 65 table hashes and schema
objects, 2,221 files, 1,946 byte/MIME/length-checked resource routes and eight HTTP
checks. All four restored reader connections were verified read-only; outbound
integrations were disabled and the created target removed by OID guard. WordPress
and production/staging role/ACL recovery remain unproven.

Profiling fixed repeated full-tree visitor presentation scans and redundant source
payload/non-sermon copies, preserving schema/hash checks. The full dataset starts
under the unchanged 384 MiB heap. Earlier OOMs, duplicate-private-test discovery,
concurrent timeouts and the corrected anonymous idempotent-concurrency assertion
remain recorded separately. No production service/review decision was weakened.
Cold controlled lab LCP outliers and two invalid zero observations remain failed/
unaccepted; field INP/CWV and comparable live-source measurements are unavailable.

Final staging verification refused pinned DNS drift before mutation. Current normal
GitHub operations could not connect. Historical F043 staging proof cannot substitute
for final-candidate deployment. Source/measurement/account/WordPress recovery gaps
and unexplained per-URL differences continue to block launch. Production traffic,
DNS and WordPress have not changed. Final ledgers/counts are recorded separately
after the complete comparison and safe-export integrity checks finish.


Final D-182 evidence completed: 21,134/21,134 rows, 22,082 requests, 2,984 sitemap
URLs and 10,592 internal targets; source hashes verified before/after/per read.
Reviewed outcomes 3,729 preserved/2,817 redirected/389 pre-existing source404
removals/14,199 unresolved. Complete original cohort accounting, both ledgers and
the12-part acceptance report are published in `docs`; all original15,252 URL hashes
remain. All457 known original sermon identities return200; four metadata-only
outcomes remain unresolved. Parity failed and no cutover is authorized. Final
421-file documentation privacy scan passed zero findings; explanatory additions
are rescanned before the safe Git commit. External staging/Git/account/source/
WordPress restoration/performance gates remain unresolved.


### 13 October 2026 — source archive reference preservation

The journal previously omitted explicit original Scripture references when the
separate primary-passage review was unresolved. A source-only summary projection
now preserves those labels, with reviewed passages retaining priority. Imported
source versions and native approval decisions are unchanged. Anonymous tests prove
actual archive HTTP rendering, source/native separation, escaped multi-reference
labels, title deduplication, audited editorial precedence and immutable source hashes.
Focused tests: 63 passed. Standard suite: 1,283 passed with the expected 145 PG-gated
skips; the separate guarded PostgreSQL suite: 1,428 passed, zero skips, exact target
cleanup. Type: 648 files, zero errors/warnings, seven existing hints. Build: 45 pages;
protected runtime bundle passed. Anonymised importer: 3 included/2 excluded/0 rejected.
The initial incorrect importer invocation was rejected before reading source input;
the documented JSON invocation passed. Offline audit: zero vulnerabilities.
Impeccable detector: no findings. Initial full 442-file privacy scan passed; safe
explanatory documentation is rescanned before commit. No schema/data migration is
needed. Final candidate checks and staging identifiers follow in the acceptance log.

A finite 21-request public source refresh completed on 13 October; all 16 existing
sitemap endpoints returned 200. One new original public sermon was identified as
WordPress ID 30133 with service date 11 October, one explicit source passage, one
speaker and a verified YouTube relationship. Six exact added/modified sitemap
landing pages were captured, without recursive expansion or recording bodies.
The new projection was prepared using the existing importer and remains separate
from AI approvals. The first bundle command rejected relative paths before output;
the required absolute private paths passed. Public REST still exposes 30 pages,
3 posts and 437 media records; its guessed sermon endpoint is a genuine source404,
which proves no stored-CPT total. The frozen 21,134-row evidence is unchanged.

The new original page was imported with 1 insert/0 updates/5,748 unchanged;
its rerun changed zero across 5,749 routes. CMS adoption inserted exactly one
source-sermon document, replay planned zero, and preserved 2,581 existing source
documents and all ownership exclusions. Its two observed new aliases were captured
without recursive expansion: a real WordPress shortlink301 and a 1,074-byte original
RSS resource200. The feed was preserved by SHA-256/MIME/length and imported with
one additional asset route. Future feed maintenance remains unproved; byte parity
must not be described as that acceptance. A local URL-helper error was repaired by
resuming the already captured alias response without repeating the request.

The source fallback retains WordPress's exact Passage label in its accessible
stamp, preserving the original paragraph text instead of renaming the label. It
still conveys source metadata only and does not approve primary passages.


13 October staging preparation stopped twice before replacing an application at
its unchanged 2 GiB memory gate. A read-only profile proved that inventory JSON
left about 150 MiB in the operator allocator and that completed Docker/psql buffers
settled shortly afterward; source hashes remained unchanged. Both incumbents were
restarted sequentially with the same verified image/configuration/mount set and
retained recovery backup, and returned healthy. An interrupted verification import
and Docker mount-list ordering false difference were retained and verified safely
without repeating the protected restart. The operator now releases only its own
unused allocator pages and waits at most 30 seconds for real reported capacity.
It retains the same 2 GiB threshold and rejects insufficient capacity at timeout;
no host-cache flush, unrelated process change, VM resize or memory-limit increase
is used. Anonymous tests cover recovery at the exact threshold, refusal below it
and own-process-only allocator release. Final application/source/asset identity
and complete HTTP comparisons are recorded after this operator release.

The revised memory gate passed in the third preparation attempt, which then
correctly rejected the new feed's archive member outside the required source-public
prefix. The archive was retained and regenerated with all 1,926 files independently
verified by scope/size/hash. An operator-only transfer then exposed the old CLI's
hardcoded incoming directory; preparation rejected its mismatched asset hash before
application replacement. The CLI now derives its verified incoming directory from
the operator file, accepting only the frozen application hash or that hash plus a
seven-character operator suffix in the existing private namespace. Tests reject
other application identities, malformed suffixes and outside directories. This
keeps application 25f4b33 byte-identical while independently pinning the operator
release; all runtime source/build inputs were compared and found unchanged.

The final staging original-content import passed, preserving history and
credentials and making no native review/publication changes. CMS adoption then
correctly rejected its historical zero-addition plan guard. A separate read-only
plan verified exactly one source-backed document, with 1,221 held ownership/query
exclusions and plan SHA-256 a4bd2b7310915f036e1177094910fd719812e147a1ec3080670ba96d3bbdc348.
The operator now pins that exact one-record plan for the verified original
WordPress sermon 30133; reruns remain zero-change and all prior rows must be
preserved. No general plan wildcard or eligibility/approval relaxation is used.

### 13 October retained-export completion and source response corrections

A scoped relevant-file search found the supplied 24 September WXR (SHA-256
`fd15e0553349f40fa74264b0cb1ab70560cf48ae7ef18101cccb7b0514876e0e`),
1,357 items including 454 published sermons and 437 attachments. Every historical
published sermon is in the current known 458-member set. All 420 stable-ID public
REST attachments match historical IDs; the other 17 historical image identities
now have fresh verified public file bytes, while their current stored metadata
remains unproved. Repository/upload archive candidates are not a WordPress full
recovery backup. Earlier missing-export findings are retained as historical limits.

Finite read-only queues captured 328 public-export/redirect responses and 440
attachment-page responses, then checked all 437 attachment file URLs. All files
responded 200; 317 image/document/font bodies passed MIME/signature/hash checks,
300 existing bytes matched exactly, 17 missing resource routes use 16 unique new
files. 118 recordings and two uninspected ZIPs received metadata-only requests,
zero recording bodies. API-index inspection confirms both current home/siteurl
as the verified www HTTPS origin and exposes no sermon REST endpoint.

The expanded immutable source union has 23,017 observations, 15,433 responses and
27,863 file witnesses; every prior/original URL hash remains. New discoveries stay
explicit and finite. WXR is retained historical evidence, not fresh stored facts.

The guarded local source importer inserted 20 source-only routes (one event,
two observed archive queries, 17 resources), replay 20 unchanged/zero updates.
It also preserved 371 previously unmapped, genuinely captured empty calendar
responses as exact zero-byte/noindex endpoints; replay changed zero. A narrow
model/deployment exception requires original empty hash, calendar flags, MIME,
zero bytes and noindex. No subscription is retired or replacement content invented;
future calendar/recurrence service semantics remain unproved.

298 exact attachment-to-owned-binary redirects, including 14 observed numeric
attachment queries, were imported with immutable system audit and unchanged replay.
Target hash changes invalidate display. Existing redirects, CMS ownership, withdrawals,
native publication and review evidence remain protected. Server-rendered links reach
final destinations and retain campaign/fragment behavior. No unverified recording
or parent/homepage destination was guessed. Deployment additionally freezes all
prior redirect/non-CMS audit bytes and permits only the exact scoped new rows.

The rejected first additive package retained UTC-offset schema and duplicate-member
failures; no DB import succeeded. A new package normalizes the same UTC instants
and deduplicates archive members. The first expanded union hit Windows path length;
its failed directory remains, and the verified union uses a short confined path.
Two later PostgreSQL runs retained existing 5-second filesystem/concurrency timeouts;
no test timeout or guard was relaxed. Final execution/results follow once the new
application/content release and staging rehearsal finish.


## D-182 final available SEO rehearsal — 14 October 2026 (source baseline: 13 October)

Application `d068c2214e2d53b6c50de4788305acaf7fa052ed`, operator
`eaf5b9bdb2c29d44cd54345d13e6c7462737d9cf`, image
`sha256:cfdcd574a493753c73a349da9710fd44f489a07d4dbde3562c7029132201b2ff`, completed protected staging bridge/canary, activation,
compatible rollback, reactivation, exact history and credential preservation.
Both complete comparisons checked 23,017 observed URLs, preserving all original
15,252 hashes. Final dispositions: {'intentionally_removed': 704, 'preserved': 3731, 'redirected': 3092, 'unresolved': 15490}. This is NOT READY FOR CUTOVER:
complete stored source coverage, remaining content/calendar findings, recording
recovery, WordPress restoration and church account/field evidence remain missing.

All 458 known public sermon identities remain independent of new enrichment.
The retained WXR was located and reconciled, not described as a current backup.
All 2,335 resource paths passed local and both staged runtime byte/MIME checks;
298 exact resource redirects replayed unchanged. CMS source adoption totals 2,583,
with 1,223 held projections. Three staged body/SEO save, reload, draft isolation,
publish and exact revision restoration cycles passed. Final structural browser
matrices cover 108 cases per environment, with zero errors/overflow.

Actual final staging backup 48bd98ed95c9803880687a985b47e2b1f744b81ba4f6a597e2281844eac71dc3 restored all
65 tables and 2252 assets with schema,
fingerprint and isolated application checks; exact created OID target was removed.
This does not prove WordPress or global-role/ACL recovery. Outbound integrations
were disabled. Final controlled lab evidence is separate from missing field INP/CWV.

Checks: 1,287 standard passes, 146 gated skips covered by 1,433 PostgreSQL passes
with zero skips; 182 Python tests, type/build/importer/offline audit/privacy passed.
The original primary checkout retains all 18 unrelated user changes. No DNS,
production traffic, WordPress mutation, recording bodies or new approval occurred.
See docs/seo-migration-acceptance.md and machine-readable evidence for exact hashes,
counts and remaining actions. Final documentation commit is separate from runtime.


### D-183 integrated checkpoint — 19 October 2026

The finite missing-dependency union retains the prior source witnesses and original
finding denominators: 23,053 observed URLs, 15,698 retained responses, 28,380 witnesses.
The 246-row local import (234 archive, four event, eight calendar resources) inserted
246 and updated zero; replay changed zero. Source routes 6,506, known sermons 459.
Sixteen source CMS additions preserved 2,636 earlier documents; replay changed zero.
Integrated PostgreSQL: 1,477 passes / zero skips with exact disposable cleanup.
Standard tests 1,328 passes / 147 gated skips; types 672 files / zero errors/warnings;
45-page build; 149 Python SEO and 83 deployment checks; importer dry run, offline
audit and 540-file source/runtime privacy scan passed. Earlier failed runs are
retained separately. Final deployed/full-inventory acceptance remains required;
see `docs/seo-d183-completion.md`. No production/DNS/WordPress mutation occurred.

### D-183 RSS/source identity release checkpoint — 19 October 2026

Original finding denominators remain unchanged. The finite source union is 23,081
URLs / 15,718 responses / 28,427 hash witnesses. Four live RSS routes preserve
verified GUIDs/publication dates and published-only membership; event occurrences
have stable distinct identifiers and cancellation signals. Three exact pilot
native/source/media bindings remove duplicates while preserving stored rows.

`npm run test:postgres`: 1,506 passes, zero skips; disposable target removed.
`npm test`: 1,359 passes, 147 gated skips covered above. Focused final RSS/cache/
calendar/design-preservation checks: 26 passes. Python SEO checks: 161 passes.
Types/build/importer/offline audit/private-content scan and deployed HTTP evidence
are recorded in the final acceptance package after the remaining release gates.
An initial source-file hash assertion failed after exporting the unchanged existing
DST helper; independent exact-source comparison proved this was the sole change
and updated the preservation hash. No church rendering was rewritten. An incorrect
nonexistent importer fixture path failed; the established `tests/fixtures/dry-run.json`
then succeeded. Failed evidence is retained rather than labelled passed.

The four-feed local source rehearsal changed four active pointers, changed zero on
replay, restored four independently, changed zero on restore replay, then reapplied
four with a distinct assembly envelope and unchanged source-capture dates/content.
Native sermon rows matched before/after. CMS plan remains zero additions / 1,445
held. No migration schema or PostgreSQL restoration behavior changed; retain the
successful 65-table recovery proof rather than repeating it.

### Final finite dependency closure — 19 October 2026

Eleven retained-ICS occurrence URLs already in the inventory were missing HTML
witnesses. Eleven bounded public requests returned 200; all eleven exact original
event pages assembled without held records. The union remains 23,081 URLs, now
15,729 captured responses / 28,449 witnesses, ledger SHA-256
`99e078a8a657657f645c493c7677f3b88abe7b3f96c1722dd00d97f349b884a6`.
Local source/CMS additions each inserted eleven and changed zero on replay;
independent transaction rollback was verified before committing the additive import.
All 2,662 prior CMS entities retained exact row hashes. Total source routes: 6,527.

CMS adoption plan order is now stable by key, independent of database ordering;
an anonymous shuffled-input regression verifies identical payload/plan and no input
mutation. A focused RSS regression verifies a captured occurrence plus a published
exclusion produces one cancellation under the same GUID. This fixes duplicate
cancellation emission without suppressing cancellations or clearing evidence.

Exact committed 7691ef9 local browser checks passed three source templates and
published-response revision restoration; extended module hiding, two slug changes,
direct aliases, calendar edit/cancel/restore and original UID continuity passed.
The subsequent narrow fixes receive final integrated and deployed verification.
A fresh complete local asset backup/restoration verified 2,387 files, 118 recordings,
1,221,900,924 bytes and all four private extraction caches by full hash/length.
The extra local asset count is not assumed to equal staging; staging inventory is
verified separately. Existing successful 65-table PostgreSQL restore is retained.

Final integrated dependency release gates: 1,507 PostgreSQL passes / zero skips,
1,360 standard passes / 147 gated skips covered above, 683 type-checked files /
zero errors or warnings / seven existing hints, 45-page build, 161 Python SEO
passes, and 551-file credential/private-body scan passed. Offline audit has zero
known vulnerabilities and the established anonymized importer fixture passes.
The eleven added original pages each return 200 with zero missing meaningful
blocks or images in direct comparison; remaining raw social-image differences
are retained for the exact original-logo metadata policy, not silently cleared.

### RSS measurement continuity follow-up — 20 October 2026 Sydney

The actual four-feed original/candidate comparison found that canonical item links
had lost WordPress's existing RSS attribution. Every verified original member used
`utm_source=rss`, `utm_medium=rss`, and its public item/series slug as `utm_campaign`.
Preserve that exact publisher pattern for current and newly published entries,
including dated recurring-event links. Canonical page metadata and GUIDs remain
unchanged. This emits no tracking request and activates no production measurement.
Focused tests assert exact escaped post and event URLs after publication/slug edits.
This defect was found by actual feed comparison after the first candidate rehearsal;
its failed intermediate candidate remains identifiable rather than marked accepted.

The 26-entry RSS semantic comparison matched every source member, URL (including
campaign attribution), publication instant, description and body. It identified
one source post represented in two feeds whose RSS title used an en dash while
its existing frontend heading used a hyphen. Preserve the original RSS title as
its own default; body/slug edits retain it, while a deliberate published title edit
uses the new title. This does not change the website layout or original page copy.
An anonymous regression covers both outcomes rather than waiving title differences.

### Frozen native identity withdrawal — 20 October 2026 Sydney

The three accepted historical pilots retained legacy development source IDs. Their
public URL reconciliation must survive approved media edits and apply native
withdrawals to the corresponding original WordPress identity. The read-only source
selector now resolves only those exact native-ID/source-ID pairs, and the public
repository retains the native audited gone/redirect disposition at both paths.
Original source content, stored IDs, native reviews and normal public eligibility
remain unchanged. Source ID aliases flatten to the final eligible replacement.
Anonymous HTTP and PostgreSQL fixtures test original/native 410, archive/search/
sitemap exclusion, direct replacement, and unchanged review-row hashes.

The frozen identity proof is scoped to its exact original WordPress ID and path.
An unrelated original page using the same recording does not change that established
correspondence or collapse either public page. Source-byte/media drift of the bound
record still refuses reconciliation. This preserves distinct source identities.

### Calendar, canonical and new-row recovery continuation — 20 October 2026

The finite eight-destination dependency capture adds seven verified public past
calendar result pages and confirms one original shortcode404. No HTML links were
followed. Frozen union:23,089 URLs,15,737 responses,28,465 witnesses; ledger hash
`bf724f9c9640700e5de9c24cb9937909073ee312975e787665e54480f9079083`.
Original finding denominators remain855/2,114/76/120, four editorial dispositions
and66 broken targets. Raw HTTP findings and distinct identity/function evidence
remain separate; a successful response alone does not close a content finding.

Focused tests cover twelve-item pagination, witnessed monthly pages beyond one
year, accurate page date titles, truthful empty historical views, no past-rule
extrapolation, source facts predating current recurrence rules, Day controls,
explicit CMS ownership/withdrawal and final sitemap serialization. Single-facet
canonicals preserve the actual filter/page while indexability remains allowlisted.
The first integrated run retained one obsolete empty-history404 assertion and
failed1/1,515; that case now asserts the truthful empty view and absence of invented
content. The failure is retained privately, not recorded as a passing run.

The seven-row restore rehearsal exposed the intended tombstone behavior: rolling
back a new source insert retains a withdrawn route, so a normal import cannot
resurrect it. A separate non-HTTP new-row reapplication operation now requires both
immutable receipts, exact bundle identity, original row versions/timestamp and no
editorial withdrawal. It appends history, refuses later changes and leaves ordinary
withdrawal checks intact. Guarded PostgreSQL tests and actual scoped recovery must
pass before the restored seven rows return to the local projection.

The f13b6d2 staging attempt completed prepare, bridge activation, source migration
and resource reconciliation. SSH timed out during CMS adoption; subsequent pinned
read-only SSH checks also timed out. Actual completion and running state are not
assumed. No production, DNS, cloud permissions or network controls were changed.
Final application activation/rollback and remote acceptance remain required.

The corrected integrated run passed1,515 PostgreSQL tests with zero skips,
1,368 standard tests (147 gated skips covered), types/build,164 Python SEO tests,
anonymized importer, offline audit (zero cached advisories) and the release scan
(manifest`ed663e5160af9ed37c5df643fbc77387e61400ad2d0081dbfbedae2d5b54e2f1`,
zero private-body/prohibited-source matches). Actual seven-row reapplication/replay
and ordinary import replay passed, with6,527 incumbent pointers and all CMS/sermon
rows unchanged. Final runtime-bound acceptance and staging delivery remain required.

### Exact header/navigation context and recurrence ownership — continuation

Additional focused checks identify speaker role text omitted from the selected
archive, existing images retained on their canonical article/homepage instead of
long WordPress result excerpts, and numeric pagination controls omitted from the
comparator's primary-text extraction. Exact per-object/context witnesses are now
available; none changes the original cohort denominator or grants blanket passes.
Their fresh final HTTP replay remains required. The diagnostic image replay matched
all three affected source-view rows; it is explicitly not final release acceptance.

A separate recurrence-edit regression let a frozen original future detail page
return200 after its feed occurrence became cancelled. The adapter now returns410
for verified removed dates, preserves the UID, and defers to explicit per-date CMS
edits, hidden source modules and moved routes. Focused checks pass. No historical
recurrence is inferred from a present schedule and no editorial review is fabricated.

The first context/recurrence integrated run retained three failures in unchanged
restricted-acceptance tests:an initial5-second transcript-case timeout followed by
two fixture-cleanup failures. It is not a passing run. Completed temporary local
verifiers were stopped and the same strict suite is being repeated with two workers;
no timeout, assertion or publication gate was weakened. Production identity remains
provider-independent:the architecture's later decision supersedes historical Cognito
selection. No provider/account/MFA/recovery state is invented or connected here.

D-183 integrated context/recurrence checkpoint: PostgreSQL 1,519/0 skips; standard 1,372/147 gated skips; Python 167; type/build and privacy scan passed. Current original homepage/robots confirmation and four no-clobber profile-link settings preservation receipts remain private. Final immutable HTTP comparison and staging activation are not yet accepted.

D-183 immutable source validation reuse: PostgreSQL 1,523/zero skips; standard 1,376/147 gated skips; Python 167; types/build/importer/offline audit/privacy passed. Real-corpus component benchmark 7,873 ms initial / 2,158 ms reuse, exact object and DB-state equality. Final release HTTP/timing and complete cohort reconciliation remain pending. eca90d9 whole-inventory run was interrupted before HTTP after the measured cold-rebuild finding; retain its earlier 120 browser and reversible CMS/feed results separately.


### D-183 subscription, historical archive and resource-origin candidate — 20 October

Integrated application gates passed: `npm run test:postgres` 1,547 passed with
zero skips and exact disposable database cleanup; `npm test -- --maxWorkers=2`
1,400 passed / 147 gated skips covered by PostgreSQL. `npm run check` reports
zero errors/warnings and seven existing hints. `npm run build` builds 45 pages;
`npm run staging:bundle` succeeds. Complete Python discovery
`python -m unittest discover -s tests -p '*test.py'` passes 244 cases.
`npm run migration:dry-run -- --input tests/fixtures/dry-run.json` includes three,
excludes two, rejects zero. Offline audit reports zero cached advisories. The
full release privacy scan covers 578 files, with zero private-body/prohibited
secret/source matches and zero excluded paths; manifest
`36c75a6d209121d2963c43a1ff9bcfebdf8bef6c4104b3cb0ccf457dee3a241b`.

Focused regressions cover exact past-feed aliases and source/hash ownership;
source-backed historical pagination, withdrawals and ambiguity; typed Day links;
original venue country retention and edited-venue precedence; verified future
occurrences beyond the default year; noncanonical Range redirects and stream
cancellation. The church template's existing whole-file guard was updated solely
for the calendar serializer correction; a new independent hash proves every byte
outside that serializer section remains unchanged. Earlier failed hash/fixture
and incomplete discovery runs remain private and are not reported as passes.

The finite extension contains 178 successful exact source responses: 171 old
occurrence pages plus seven already-observed archive targets. Every new event's
start/end facts were checked against visible source content; all 84 image references
resolve to already-verified owned files. No arbitrary HTML link expansion occurred.
Full final-release HTTP, cohort reconciliation and staging acceptance remain separate
requirements. Pinned protected-staging SSH again times out; no completed successor
deployment or current running staging commit/image is claimed.


### 20 October resource/metadata integration checkpoint

The finite historical extension is bound to source ledger SHA-256
`e19f9ec5f90a616fedf995ddd70904333da12cab30ff62ddaef64315fa52c7ae`.
The local 178-row additive rehearsal includes rollback, no-op replay, scoped
withdrawal, refusal of ordinary resurrection and guarded exact reapplication.
An independent 65-table proof preserves all earlier rows, including payloads and
timestamps. No sermon/enrichment approval was introduced.

The exact resource/date rehearsal inserted 489 redirects, left 298 existing exact
manifest matches unchanged, preserved all 534 prior redirect rows, and changed
only two date projections for WordPress 30091. Trial rollback was independently
verified; replay inserted/updated zero. Expected versions and source response
hashes remain in the private receipts and safe date dispositions.

Current integration commands: `npm run test:postgres -- --maxWorkers=2` (1,560
passed, zero skips), `npm test -- --maxWorkers=2` (1,413 passed, 147 gated cases
covered separately), `npm run check` (0 errors/0 warnings/7 existing hints),
`npm run build`, Python unittest discovery (255 passed), anonymous importer dry
run, `npm run staging:bundle`, and offline audit. Final outgoing privacy scan and
release-bound HTTP acceptance remain separate gates. A source-backed, directly
redirected file must still prove its exact MIME, bytes and final file identity;
a successful status does not discharge content verification.

The final distinct resource manifest has 1,141 aliases to 418 verified files.
The second guarded application inserted 118 further aliases, matched 1,023
unchanged dispositions, and replayed with zero inserts. All earlier redirects,
source pointers and unrelated tables were preserved. Two extra apex ZIP witnesses
share already mapped paths; the attempted duplicate manifest was refused before
any write. The reviewed tracked CSV contains each original path exactly once.


### D-183 exact search, discussion-feed and comparison corrections (20 October)

The internal search now indexes visible published homepage modules and current
page copy, excludes hidden/draft modules and SEO-only plugin descriptions, and
admits observed root search metadata only as a non-indexable archive. A separate
source-bound one-row import preserves the original search title while results stay
live; delivery/recovery evidence is pending and must not be inferred from unit tests.
Retained empty event discussion RSS resources follow the parent event withdrawal
and cancellation boundary; these resources are distinct from the four maintained
live event/calendar feeds. Exact discussion-feed comparison requires unchanged
XML semantics, same parent and original/candidate body hashes.

Comparison fixes require the same original duplicate heading/current H1, matching
scoped past iCalendar link for an all-occurrences social correction, and direct
relative recording redirects to an independently verified recording file. External
or wrong-file redirect targets still fail. These rules retain raw findings.
All 371 originally empty calendar URLs returned actual nonempty text/calendar in
the 72ac498 full HTTP rehearsal. The metadata follow-up accounted for 28 of 29
remaining rows; the final search title still awaits the guarded compatible import.


### D-183 preserved ranges and complete public keyword matches

A real source comparison found Mark 10:23–27 rendered only as Mark 10:23 in a
source-backed card, and a second original range was similarly narrowed. The
candidate retains the source-backed range on cards/detail, leaves the independent
reviewed primary passage intact, and keeps explicit editorial reference changes.
Anonymous real-HTTP regressions verify both displayed references and unchanged
input objects. Another regression verifies 51 public transcript-only keyword hits,
including the second repository page and isolation from the next search query.

Exact archive-header and ministry-widget witnesses additionally require rendered
visible ancestors, the same typed scope/event/date, unchanged links and ordered
original text. They address frozen-parser omissions without removing raw findings
or accepting absent copy. All new rules have rejection cases for wrong identities,
missing words, hidden ancestors and changed links. Full integrated verification
and actual delivery are still pending.


The same comparison exposed literal underscore delimiters around a blog
introduction containing a link. The inline renderer now retains whole-phrase
emphasis across that link without changing stored words or hrefs. Escaping,
unsupported protocols, independent emphasis runs and strong text are covered by
focused regressions. The focused source/renderer set passed 75 tests.

The completed 72ac498 original-cohort rehearsal verified all 76 original
image/alternative findings using 58 actual file probes, and all 120 original
indexability findings through actual responses/canonicals/robots. It accounted
for 2,091 of 2,114 original block findings before the newly identified range
and inline-renderer fixes; the remaining 23 URL rows are retained for final
application comparison. Metadata and 37 calendar/feed semantic differences remain
separate reconciliation steps. This is an interim denominator, not final acceptance.


The exact metadata follow-up accounted for 112 of the final 125 original rows.
The remaining 13 exposed one pending source-backed search-title import and twelve
legacy calendar-query pages whose live renderer used the root pathname as its
canonical. The candidate now keeps the full meaningful calendar query in canonical
and social URL, removes only campaign identity and retains noindex. Visitor links
still retain campaign values. A focused real-rendering regression checks page two,
its distinct query canonical, source title, noindex and campaign behavior.
The 75-case source/inline/reference set and focused calendar adapter checks passed;
the next full gate run covers the complete integrated candidate.
