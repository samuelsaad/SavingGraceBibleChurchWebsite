# Legacy URL and Redirect Plan

**Status:** Sermon redirect contract finalised; whole-site manifest generation and baseline crawl have not run  
**No redirects or production changes have been created.**

The exact installed source snapshot is Advanced Sermons 3.7 plus Pro 2.2.

## Permanent whole-site scope and launch gate

This redirect plan now covers every proven or later discovered indexable page on the existing website, not only sermons. The 448 sermon paths below are a verified subset and must seed the complete manifest. A later explicitly approved read-only crawl plus church-owned Search Console/analytics evidence is required to inventory ordinary pages, ministries, events, media, archives, taxonomy/author/date pages, attachments, pagination, and other search-visible routes.

Every baseline URL requires exactly one reviewed target disposition: unchanged canonical `200`, one direct permanent `301` to equivalent content, deliberate `404`, or deliberate `410`. Missing mappings or unexplained differences block launch under `seo-migration-validation-plan.md`.

## Confirmed URL inventory

| URL behaviour | Finding | Recommended treatment | Evidence |
| --- | --- | --- | --- |
| Sermon archive | Public path is `/sermons/`; archive slug override is empty | Preserve `/sermons/` | `source-and-database-confirmed` |
| Sermon detail | Public path is `/sermons/{post_name}/`; 448 published slugs are populated and unique | Preserve all current paths; generate redirect only for an approved rename/collision | `source-and-database-confirmed` |
| Pagination | `/sermons/page/{n}/`; 50 pages at current baseline | Preserve or one-hop map to equivalent target pagination | `source-and-database-confirmed` |
| Search/sort | `?s=...`, `?sermon_dates=...`, `?order=ASC|DESC` | Translate at route boundary while retaining intent and navigable state | `source-and-database-confirmed` |
| Taxonomy filters | `sermon_series`, `sermon_speaker`, `sermon_topics`, `sermon_book` query parameters | Resolve through imported source term slugs; preserve combined AND behaviour | `source-and-database-confirmed` |
| Parent/Pro permalink handling | Parent defaults the archive slug to `sermons`, enables an archive/query var, and uses `with_front=false`; Pro delegates detail links to core permalinks | Preserve the observed `/sermons/` and `/sermons/{slug}/` paths | `source-and-database-confirmed` |
| WordPress global permalink | Global structure is `/%year%/%monthnum%/%postname%/`, while live sermon URLs remain `/sermons/{slug}/` | Do not derive sermon URLs from the global structure | `database-observed` |
| Historic slug metadata | No sermon `_wp_old_slug` rows | No database-provided old-slug redirects are available | `database-observed` |
| Slug collisions | No duplicate sermon slug group; all 448 published slugs unique | Preserve directly; recheck at extraction time | `database-observed` |

The parent rewrite registration is now source-confirmed. Custom theme filters/snippets, historical rewrite-flush state, and paths predating available database metadata are still not represented by the supplied plugin directories. (`unresolved`)

## Host and canonical findings

The stored `home` and `siteurl` values do not match the observed canonical public `https://www.savinggrace.org.au` origin. Their actual values were deliberately not retrieved or recorded. (`database-observed`)

A representative public detail page self-canonicalises to its `/sermons/{slug}/` public URL. Its Open Graph image used a staging-origin asset during public inspection. Separately, the configured default sermon-image option is a URL on neither the known staging nor the public `www` origin; its actual value was not selected. (`database-observed`)

Before launch, choose one canonical HTTPS `www`/apex policy, normalise all internal targets, and eliminate staging/unknown-origin defaults. These are configuration/asset tasks, not reasons to expose stored option values.

## Whole-site redirect manifest inputs

The versioned machine-readable manifest must record, for every baseline URL:

- normalised legacy absolute URL/path/query and discovery source;
- current status/redirect chain, indexability, canonical, robots directive, sitemap membership, and internal inlink count;
- page/template/entity identity plus title, description, H1, content/date fingerprint, social image, and structured-data types;
- target URL and disposition (`200`, `301`, `404`, or `410`), reason, approval, and verification state;
- later-approved Search Console/analytics risk evidence without credentials or user data.

### Verified sermon manifest inputs

The eventual read-only extraction should generate one candidate row per public sermon using:

- source system and `wp_posts.ID`;
- source post type/status;
- exact `post_name` and `/sermons/{post_name}/` path;
- source modified timestamp/checksum;
- target UUID/slug after import;
- old path, new internal path, reason, and verification state.

Only the 448 published Advanced Sermons rows are presumed to have public detail paths. The five pending and three draft rows must not receive public redirects unless separate evidence proves an old public URL. (`database-observed`)

Phase 3B.1/3B.1a enrichment does not create description, transcript or Q&A URLs. Approved content belongs in the existing canonical `/sermons/{slug}/` server-rendered detail response, so it preserves and strengthens the same page rather than creating duplicate crawl paths. Pending/unapproved enrichment remains non-public. Any later slug change continues to require the existing direct one-hop redirect safeguard and reviewed one-to-one manifest update.

Yang confirmed that the 12 `ctc_sermon`/`wpfc_sermon`/`wpv_sermon` rows and every `wp_sb_*` row are excluded. No replacement sermon or redirect is generated for them, and WordPress remains untouched. (`database observed`)

## Church page dispositions (D-165)

The whole-site rebuild from the WordPress export of 24 September 2026 gives every published church page, post and event a destination and every discovered legacy address exactly one disposition: unchanged `200` where the clean WordPress address is kept, one direct `301` where the address changed (`/pages/…`, `/contact-us-2/`, Events Calendar event, series and venue addresses, `/church-events/`, `/pages/sitemap/`), `404` for legacy addresses of unpublished drafts and the private Constitution, and `410` for the three theme sample testimonials. The dispositions are data in `src/frontend/content/` (see `website-content-inventory.md`) and are asserted by `tests/church-site.test.ts`; the sermon rules below are unchanged.

## Compatibility rules

| Legacy request | Compatibility rule |
| --- | --- |
| `/sermons/` | Serve target archive directly; avoid a redirect if path is unchanged |
| `/sermons/{slug}/` | Serve imported published sermon directly when slug is retained |
| `/sermons/page/{n}/` | Serve compatible page or issue one 301 to an equivalent stable page URL |
| `?s={query}` | Translate to target keyword input without redirect hop where practical |
| `?order=ASC|DESC` | Translate to approved oldest/newest sort |
| `?sermon_series={slug}` | Resolve by imported source series slug |
| `?sermon_speaker={slug}` | Resolve by imported source speaker slug |
| `?sermon_topics={slug}` | Resolve by source passage-term slug even if target terminology differs |
| `?sermon_book={slug}` | Resolve by source book classification, including approved noncanonical values |
| `?sermon_dates=YYYY-MM-DD - YYYY-MM-DD` | Parse the exact legacy pair and translate to inclusive ISO `dateFrom`/`dateTo`; reject malformed or reversed input without broad redirect |
| Unknown/retired published path | 404/410 or explicit reviewed redirect; never broad redirect to homepage |
| Previously published sermon slug change | Transactionally upsert one direct 301 from old path to the new canonical path and collapse prior aliases |
| Permanently deleted previously published sermon | Require a validated equivalent redirect target or an explicit gone disposition for future HTTP 410; never silently fall through to 404 |

## Redirect constraints

- Unique normalised old path and optional approved query signature.
- Internal destination by default; external destinations explicitly approved.
- No loop, chain, open redirect, host-header-derived target, or unsafe decoding.
- Preserve case/encoding/trailing-slash behaviour deliberately.
- Never redirect a non-public source row to public content solely because titles look similar.
- Keep source ID and migration record on every generated redirect.
- Verify target response, canonical, and final hop after deployment.
- Use a direct permanent `301` for every permanent move and require the final equivalent target to return canonical indexable `200`.
- Do not use soft 404s, blanket homepage/category redirects, or unrelated “closest match” targets to hide missing content.
- Update internal links and sitemaps to the final target so they do not traverse redirects.
- Prevent duplicate indexable host/scheme/slash/case/encoding, filter, search, tracking, pagination, and alternate URL forms.
- Preserve crawlable paginated pages with self-canonicals; do not canonicalise all pages to page one.
- Archive alone does not erase URL history. Remove non-public records from sitemaps/indexability while retaining their manifest disposition for restoration or later deletion review.
- Permanent deletion must update the current public path and every prior alias to the final direct redirect or `410` outcome in the same transaction as the minimal deletion tombstone and content cleanup.
- A deletion redirect may target only validated public canonical equivalent content. A gone path returns real `410`, has no `new_path`, is absent from sitemaps/internal links, and is monitored after launch.

## Required checks before finalising the plan

1. Crawl/export all 448 published detail paths immediately before migration and compare with the database slug manifest.
2. Keep other sermon CPT/custom-table records excluded without deleting source data.
3. Test valid, malformed, reversed, and single-ended legacy date values at the compatibility boundary.
4. Confirm canonical host and remove unknown/staging media origins.
5. Test every redirect candidate for one hop, status, target visibility, canonical, and query preservation.
6. Inspect any site-theme/snippet sources supplied later for custom rewrite filters without changing the plugin-backed default plan.
7. After explicit approval, crawl/export the complete current site and reconcile crawl, sitemap, database, internal-link, Search Console, and approved analytics URL sets.
8. Verify every baseline indexable URL has one disposition and every redirect is one hop to equivalent canonical content.
9. Run chain, loop, soft-404, broken-link, orphan-page, status, canonical, duplicate-parameter, sitemap, robots, structured-data, and no-JavaScript crawl tests.
10. Confirm no staging/preview/admin/non-public URL or staging-origin social asset appears in production redirects, canonicals, metadata, or sitemaps.
11. Exercise published slug changes, archive/restore, redirect deletion, and gone deletion; verify direct final dispositions, no chains, no silent 404, and no deleted URL in the sitemap.
