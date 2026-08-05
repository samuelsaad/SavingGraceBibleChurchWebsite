# Search Parity Matrix

**Status:** Current-behaviour baseline complete; replacement API contract approved for local implementation  
**Current archive:** `https://www.savinggrace.org.au/sermons/`

The exact installed source snapshot is Advanced Sermons 3.7 plus Pro 2.2. Database/public observations remain authoritative for actual behavior and content.

This matrix is the sermon-search subset of the permanent whole-site SEO launch gate in `seo-migration-validation-plan.md`. The archive, detail pages, approved taxonomy/filter landing pages, and all 50 verified pagination pages must remain discoverable through server-rendered links and primary HTML without JavaScript. Query/search/filter combinations are not automatically indexable: the canonical/indexability allowlist must be approved from the future whole-site baseline so duplicate crawl spaces are not created. Functional parity here does not establish whole-site SEO parity by itself.

## Behaviour matrix

| Requirement | Current behaviour | Required replacement behaviour | Acceptance tests | Evidence |
| --- | --- | --- | --- | --- |
| Published scope | Archive exposes exactly the 448 database rows with `post_status=publish`; pending/draft are absent | Query only published/non-deleted content for anonymous users | Reconcile IDs/count; attempt pending/draft slugs; permission tests | `source-and-database-confirmed` |
| Keyword parameter | Text input and query parameter `s`; live direct query URLs work; setting leaves the search control enabled | Retain `s` at the web compatibility boundary or translate deterministically | Exact/partial title, punctuation, Unicode, empty, no match | `source-and-database-confirmed` |
| Keyword fields | Native WordPress `s` searches title/content/excerpt; the parent additionally matches exact taxonomy names (including speaker), without partial taxonomy-name matching | Target search covers title (A), sole speaker/series/scripture/book (B), summary (C), body plus approved transcript/Q&A (D); unapproved enrichment is excluded | Title-only, exact taxonomy-name, punctuation, Unicode, body/transcript/Q&A-only, unapproved leak test | `source-and-database-confirmed-and-local-test-confirmed` |
| Ranking | Parent adds no relevance weights/tokenization override and orders prepared results by date; live results appear date-descending | Target deliberately improves relevance: rank descending then service date/ID; without query, requested date order then ID | Multi-field match; equal date/rank; exact versus partial | `source-and-database-confirmed` |
| Series | Single-select `sermon_series`; 29 registered/current terms; source shortcodes/query links use this dimension | Preserve exact source-slug single-select compatibility initially | Representative term, missing series, multi-series sermon, invalid slug | `source-and-database-confirmed` |
| Speaker | Single-select labelled Preacher; parameter `sermon_speaker`; 7 published terms/448 assignments; no observed included record has multiple speakers | Preserve exact source-slug compatibility with one runtime speaker; refuse/warn rather than choose on anomaly | Each public speaker; pending-only speaker; invalid/misclassified term; multi-speaker anomaly | `source-and-database-confirmed-and-approved-decision` |
| Passage | Single-select labelled Passage; parameter/taxonomy `sermon_topics`; 372 published-visible terms/428 published assignments | Preserve legacy source-term filtering while modelling scripture provenance explicitly | Exact term, abbreviation variant, `Selected Text`, meta/tax mismatch | `source-and-database-confirmed` |
| Bible book | Single-select `sermon_book`; 22 public-visible terms/438 published assignments | Preserve canonical and approved noncanonical source classifications | Canonical book, `Selected Text`, missing book, non-public-only book | `source-and-database-confirmed` |
| Date range | `sermon_dates=YYYY-MM-DD - YYYY-MM-DD`; parent uses inclusive `after`/`before` against local WordPress `post_date` | Target API uses ISO `dateFrom`/`dateTo`, inclusive against exact `service_date`; compatibility translator accepts the legacy pair | Same day, inclusive endpoints, DST transition, year boundary, invalid/reversed range | `source-confirmed` |
| Sort | `order=DESC` newest and `order=ASC` oldest; source queries use WordPress date; archive setting leaves sort visible | Sort by approved `service_date` with stable secondary key/ID | Oldest/newest, equal dates, null/non-public rows | `source-and-database-confirmed` |
| Cross-filter combination | Public/direct main query is AND across dimensions. Installed source also contains an inconsistent AJAX-prepared OR branch | Keep observed/approved AND; do not reproduce AJAX OR | Matching/disjoint pairs; keyword+taxonomy; three dimensions; SQL regression asserting independent EXISTS/AND clauses | `source-and-database-confirmed` |
| Pagination | Numeric server-rendered pages; 9 per full page, 50 pages, 7 on last; query params persist; option selects default/numeric mode and count 9 | Stable server-side pagination with maximum page size and deterministic order | First/middle/last/out-of-range; filtered traversal; content changes | `source-and-database-confirmed` |
| Result count/facets | No total result count shown; filter choices show per-term counts | Do not add total/facets unless approved; compute only from published query when added | Empty/filter counts; stored-versus-actual term count discrepancy | `database-observed` |
| Empty state | Disjoint filters show a no-results message and preserve chosen filters | Accessible empty state with reset action and no draft leakage | No match, invalid term, out-of-range page | `source-and-database-confirmed` |
| Clear filters | Clear link returns to `/sermons/` | Preserve predictable reset URL and keyboard accessibility | One/multiple filters; keyword/date reset | `source-and-database-confirmed` |
| AJAX/live refresh | Parent registers public/authenticated generation endpoints; JS submits FormData on filter/change/reload events and updates history. Chromium interaction did not refresh while equivalent direct URLs worked | Server-rendered URLs/no-JS path is mandatory; dynamic enhancement is optional and must use AND semantics, history, cancellation, and announcements | Enter, blur, select change, no-JS, back/forward, screen reader status | `source-and-database-confirmed` |
| Result fields | Cards show date, series, title, preacher, passage, book, and detail link | Null-safe rendering using target relationships/provenance | Missing series/passage/book; multi-series; Unicode | `source-and-database-confirmed` |
| Related sermons | Pro intends published, same-series, current-excluded, date-desc results; live option count is 3 | Define union/ranking for sermons in multiple series and stable tie-break | Zero/one/two series; current exclusion; non-public exclusion | `source-and-database-confirmed` |
| Detail URL | `/sermons/{slug}/`; Pro delegates to core permalink | Preserve path where possible and use redirect manifest for changes | Every published slug; case/encoding/trailing slash; collision | `source-and-database-confirmed` |
| Transcript/Q&A detail | No populated legacy transcript/Q&A fields were established in Phase 0 | Approved full transcript and ordered Q&A render in initial canonical detail HTML; transcript closed by default with native `<details>`; no client fetch or automatic FAQ schema | Initial-source HTML, no-JS, unsafe text escaping, approved/unapproved visibility | `approved-decision-and-local-test-confirmed` |
| List payload size | Legacy archive cards do not contain full transcript/Q&A bodies | Public list API/HTML omits heavy bodies while search can match approved lower-weight documents | Payload shape/size and search-only match | `approved-decision-and-local-test-confirmed` |

## Reconciled current baselines

| Metric | Public observation | Database observation | Result | Evidence |
| --- | ---: | ---: | --- | --- |
| Published sermons | 448 | 448 | Exact match | `source-and-database-confirmed` |
| Pages/page size | 50; 9 except 7 last | Option count 9; default pagination | Exact functional match | `source-and-database-confirmed` |
| Series assignments | 436 | 436 published | Exact match | `source-and-database-confirmed` |
| Speaker assignments | 448 | 448 published | Exact match | `source-and-database-confirmed` |
| Passage assignments | 428 | 428 published | Exact match | `source-and-database-confirmed` |
| Book assignments | 438 | 438 published | Exact match | `source-and-database-confirmed` |

The database contains additional non-public terms/relationships: 440 registered terms total, including 379 passage, 23 book, 9 speaker, and 29 series terms. Search migration must build public facets from actual published relationships, not stored WordPress term counts. (`database-observed`)

## Compatibility URL contract

| Purpose | Legacy shape | Recommended treatment |
| --- | --- | --- |
| Archive | `/sermons/` | Preserve |
| Numeric page | `/sermons/page/{n}/` | Preserve or one-hop map to equivalent pagination |
| Keyword | `/sermons/?s={query}` | Preserve/translate internally |
| Date | `/sermons/?sermon_dates=YYYY-MM-DD%20-%20YYYY-MM-DD` | Translate to inclusive `dateFrom`/`dateTo`; reject malformed/reversed ranges safely |
| Sort | `/sermons/?order=ASC|DESC` | Preserve mapping |
| Series | `/sermons/?sermon_series={slug}` | Preserve mapping through source term slug |
| Speaker | `/sermons/?sermon_speaker={slug}` | Preserve mapping through source term slug |
| Passage | `/sermons/?sermon_topics={slug}` | Preserve even if target calls it scripture/passage |
| Book | `/sermons/?sermon_book={slug}` | Preserve source classification mapping |
| Combined | Multiple parameters | Preserve AND across dimensions |

## Exact-source reconciliation and parity decision

The installed parent source resolves keyword scope, exact taxonomy-name matching, legacy date syntax, inclusive local-date semantics, AJAX triggers, and template override hooks. It does not establish that the legacy live-refresh branch works reliably; public interaction evidence says it did not. The target contract therefore prioritizes stable server-rendered/direct URLs and preserves `AND` across dimensions.

Recommended acceptance approach:

1. Freeze representative current result sets before migration: title, speaker-only, series-only, passage-only, book-only, date, and combined queries.
2. Implement the approved PostgreSQL target contract without claiming byte-for-byte parent ranking parity.
3. Compare ordered source/target ID sets, pagination, empty states, and anonymous visibility before launch.
4. Treat PostgreSQL relevance weighting as an intentional improvement and record any acceptance-set ordering differences.
