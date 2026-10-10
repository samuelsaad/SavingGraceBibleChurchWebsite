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
