# Public Sermon Experience

**Status:** Local implementation only; not deployed or production-authorized

**Data boundary:** Published sermons and independently approved enrichment projections from PostgreSQL

## Public route contract

The local loopback application serves:

- `/sermons/` — published sermon archive, search, filters, and page one.
- `/sermons/page/{n}/` — stable server-rendered archive pagination.
- `/sermons/{slug}/` — published sermon detail with independently gated enrichment and metadata-related sermons.
- `/sitemap-sermons.xml` — sermon-only sitemap containing the archive and published detail URLs.
- `/api/v1/sermons` and `/api/v1/sermons/{slug}` — the existing bounded public JSON contract.

Requests without the canonical trailing slash receive one direct `301`. Search and arbitrary filter combinations are functional but `noindex, follow`; unfiltered archive pages use self-canonicals. Dedicated indexable speaker, series, book, and passage landing pages are deliberately not invented while the production canonical/indexability allowlist remains unresolved. Their current stable public interface is the archive query contract.

The static Astro production adapter remains undecided. These local routes are framework-independent server handlers exercised through the existing loopback Node/PostgreSQL harness; they do not select a production runtime.

## Search and filters

Search uses the existing generated PostgreSQL search vector and GIN index. An explicit match-priority tier orders whole-query matches as title first, Scripture reference or approved Bible book second, series or speaker third, approved description fourth, and body/approved transcript/approved Q&A fallback last. Within that tier, PostgreSQL’s vector weights are:

1. Title — weight A.
2. Speaker, series, Scripture, and Bible-book search terms — weight B.
3. Approved sermon description — weight C.
4. Published body plus approved transcript and approved Q&A text — weight D.

Vector rank is descending within the match-priority tier, followed by requested service-date order and stable sermon ID. The title also has a parameterized escaped partial-match fallback. Search input is trimmed, bounded to 120 characters, and punctuation-only input becomes an ordinary browse rather than a database search.

The public archive supports the legacy-compatible query names for speaker, series, passage, Bible book, keyword, and order, plus inclusive service-date bounds. Dimensions combine with `AND`. Pagination is fixed at nine results per page in the public HTML route. Filter options are derived only from relationships attached to published, non-deleted sermons; pending-only and private relationships cannot become public options.

## Interim metadata-related sermon scoring

Related results are deterministic and explainable. Each published candidate receives:

- 100 points when it shares at least one series.
- 70 points when it has an exact normalized Scripture display match or an overlapping structured chapter range in the same canonical Bible book.
- 35 points when both sermons have an approved classification for the same canonical Bible book.
- 15 points when it has the same speaker.

Candidates are ordered by total score descending, service date descending, then stable sermon ID. The current sermon is excluded, each candidate is selected once, unpublished/deleted candidates are excluded, zero-score candidates are omitted, and the result is limited to three sermons. The page shows the matching reason categories without exposing internal numeric scores.

The current schema has no manually curated related-sermon override and no approved-topic lifecycle suitable for recommendations. This implementation does not invent either one and does not use unreviewed source topic terms as theological classifications. A future curated override would require a separately approved schema and review contract.

This interim baseline is metadata-based; it is not description-based semantic similarity and must not be labelled **Related themes**. A future **Related themes** feature is explicitly deferred. If separately authorised, that score must use approved public sermon descriptions only: Scripture, title, series, speaker, topics and every other metadata field must not influence it. Scripture-based recommendations may remain separate and clearly labelled, for example **More on this passage**.

The offline description-semantic foundation now has a verified external local model and locked server-only adapter alongside the separate persistence contract, exact float32 mechanics, shared approval/publication eligibility and stale-data removal. Only synthetic inference has run: no real description has been embedded, no build has passed human quality review, and semantic results are not wired to this public page or API. Missing or pending semantic data therefore produces no **Related themes** heading. See `description-related-themes-foundation.md`.

## Publication and privacy enforcement

- Public list, detail, filter-option, sitemap, related-sermon, and redirect-target queries all require `status = 'published'` and `deleted_at IS NULL` where applicable.
- Description text appears only when `summary_status = 'approved'`.
- Transcript text appears only when the transcript row is `approved`.
- Q&A returns only individually approved rows.
- Heavy transcript and Q&A bodies remain absent from archive/list responses.
- Missing enrichment omits its heading and section; it does not render a misleading placeholder.
- Search refresh documents include only approved description, transcript, and Q&A text.
- Filter options derive from published relationships, not stored legacy term counts.
- Sitemap entries derive from published sermons only.
- Redirects are served only from stored internal mappings: a direct `301` must target a currently published canonical sermon, while an authenticated gone disposition returns `410`. Unknown/private slugs return the same controlled `404`.
- Public routes never expose administrator preview functionality, migration provenance, legacy metrics, raw embeds, credentials, or raw database errors.

## Rendering, SEO, and accessibility

Archive and detail content is present in initial server HTML and does not require JavaScript. The approved description is visible before media, transcript, and Q&A. The transcript alone uses a closed native `<details>` disclosure; Q&A remains ordinary initial HTML and does not automatically emit FAQ structured data.

Pages provide stable canonicals, controlled title/description and Open Graph metadata, correct `404`/`410` behavior, a published-only sermon sitemap, labelled filters, keyboard-visible focus, a skip link, semantic headings and landmarks, live result-count status, useful empty/error states, responsive grids, long-transcript wrapping, readable Q&A, and reduced-motion handling.

This sermon-only implementation does not satisfy the permanent whole-site SEO launch gate. Production still requires the authenticated whole-site URL manifest, canonical-host decision, crawl/parity evidence, approved performance thresholds, production runtime, protected identity, and explicit deployment authorization.
