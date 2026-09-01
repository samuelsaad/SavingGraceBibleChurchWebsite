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

## Authenticated local frontend preview

The local loopback harness also provides `/frontend-preview/`, archive/detail pages and preview-only speaker, series and Bible-book taxonomy pages. These pages reuse the same rendering components as the public experience, but the selector is limited to the exact completed three-pilot/12-Wave-1 source scope and independently requires private draft lifecycle, completed guided review, approved current description/transcript/Q&A, controlled media, a reviewed primary-passage outcome, and non-superseded provenance. In accordance with D-141, an explicit no-primary outcome is complete without inventing a Bible-book classification.

The dashboard obtains a short-lived in-memory preview session through the existing local administrator identity. The session cookie is `HttpOnly` and `SameSite=Strict`; a copied URL, preview query parameter or identity header is insufficient. Every preview response is private/no-store and `noindex, nofollow, noarchive`, omits canonical/Open Graph metadata, and has no sitemap, feed or structured-data endpoint. The dashboard link is injected only by the loopback runtime, so neither it nor private preview wiring enters the static production build.

The authenticated preview's primary header keeps Home at the top level and groups the four existing sermon-discovery destinations under one **Sermons** disclosure in this order: Sermons, Speakers, Series and Bible books. The desktop disclosure uses a real button with `aria-expanded` and `aria-controls`, a compact absolutely positioned panel and ordinary links. Click, repeated click, Enter, Space, Tab, Shift+Tab, Escape, focus departure, link selection and click-away all have explicit close/focus behavior. The parent has a non-colour current-section marker whenever one of the four sections is active, while the corresponding child link separately uses `aria-current="page"`. Its CSP-hashed enhancement is emitted only by authenticated preview responses, so public pages gain no navigation script.

At narrow widths the existing **Menu** disclosure remains the outer navigation. Its Sermons section expands in normal document flow inside that mobile panel, retains the same four links and active states, and closes independently without using the floating desktop submenu. The four direct destinations remain in the footer, and public-mode routes retain their previous Home/Sermons header because preview-only taxonomy routes have not been made public.

## Search and filters

Search uses the existing generated PostgreSQL search vector and GIN index. An explicit match-priority tier orders whole-query matches as title first, Scripture reference or approved Bible book second, series or speaker third, approved description fourth, and body/approved transcript/approved Q&A fallback last. Within that tier, PostgreSQL’s vector weights are:

1. Title — weight A.
2. Speaker, series, Scripture, and Bible-book search terms — weight B.
3. Approved sermon description — weight C.
4. Published body plus approved transcript and approved Q&A text — weight D.

Vector rank is descending within the match-priority tier, followed by requested service-date order and stable sermon ID. The title also has a parameterized escaped partial-match fallback. Search input is trimmed, bounded to 120 characters, and punctuation-only input becomes an ordinary browse rather than a database search.

The archive's primary row is deliberately compact: Search, Speaker, Bible book and Series. A native **Advanced search** disclosure contains Scripture metadata, order, date and precise-passage controls. It is collapsed by default, opens server-side whenever an advanced filter is active, preserves submitted values, and is reinforced by a small CSP-hashed pageshow handler for browser back/forward restoration. The public archive retains the legacy-compatible query names for speaker, series, passage, Bible book, keyword, and order, plus inclusive service-date bounds. Dimensions combine with `AND`. Filter options are derived only from relationships attached to eligible sermons; pending-only and private relationships cannot become public options.

The separately labelled **Browse by Bible passage** fieldset is a three-panel Books → Chapters → Verses picker backed by `passageBook`, `passageChapter`, `passageVerse` and an explicit `passageScope`; the server contract still accepts the legacy optional `passageEndVerse`. The panels form one flat navigation surface: their five-column grids align at the top on desktop/tablet, use near-square tiles with two-pixel gaps, centre short book abbreviations or chapter/verse numbers, and keep whole-book/chapter controls below rather than ahead of the grids. The initial view exposes all 66 canonical books, grouped into nine restrained colour categories; their compact key is collapsed by default. A single book or chapter activation reveals its next panel without searching; a double activation or an explicit **Search all** control submits the whole book or chapter; a verse activation submits that exact verse. The same actions are available to keyboard and touch users, with arrow-key movement, managed focus, live announcements, Back controls and Escape/Backspace navigation on compact layouts. Selected and applied states use text, symbols and borders as well as colour.

Book-only, whole-chapter, exact-verse and legacy verse-range requests use inclusive interval overlap against only administrator-confirmed `primary` relationships. Supporting, unclassified, pending, rejected and private relationships never satisfy this filter. A keyword and primary-passage request combines with `AND`; the active-filter summary names both dimensions. Broad Bible-book and precise-passage state is synchronized so the form cannot submit contradictory books, while unrelated filters and pagination/history state are preserved. Canonical book order, abbreviations, chapter counts and per-chapter verse counts come from the checked-in 66-book Protestant/KJV versification revision, whose invariants are 66 books, 1,189 chapters and 31,102 verses. Scripture-shaped keyword input such as `Romans 8` remains ordinary PostgreSQL keyword/structured Scripture search; the picker neither runs semantic search nor changes metadata-related recommendations.

## Archive discovery modes

The unfiltered first archive page renders exactly the three most recent eligible sermons as compact landscape cards in deterministic service-date/ID order. Each retains title, date, speaker, series, reviewed passage and detail link while showing five description lines on desktop/tablet and up to six on mobile. The card uses adaptive minimum sizing rather than a fixed height, so longer metadata and narrow layouts expand naturally without clipping or overflow. **Show more recent sermons** enters a URL-addressable nine-item list with numbered pages, Previous/Next and **Show fewer recent sermons**. Those expanded cards and ordinary search/filter results remain full result cards. Search or filter state immediately switches to result mode, and expanded/result modes hide both discovery carousels.

The **Series** carousel selects one most recent eligible sermon per series with service-date/ID tie-breaking and stable series ordering. It uses native buttons, horizontal scrolling and CSS scroll snapping, never autoplay. **Topical sermons** is stricter: the current schema has no explicit administrator-approved topical-classification lifecycle, so it renders an honest empty state. A missing primary passage is never inferred to mean topical.

Matching cards and detail pages label reviewed coordinates as **Preached from**. Other historic Scripture metadata remains separately labelled and continues to power the existing keyword/structured Scripture path where already approved. This passage filter does not query title text, run an embedding model, read semantic relationships or alter metadata-related sermon scoring.

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

- Public list, detail, filter-option, sitemap, related-sermon, and redirect-target queries share one strict selector requiring `status = 'published'`, no deletion, complete readiness, a reviewed primary-passage outcome, approved current description/transcript/Q&A, controlled media and no superseded generation provenance.
- A published lifecycle flag alone is therefore insufficient to expose a sermon.
- Heavy transcript and Q&A bodies remain absent from archive/list responses.
- Missing enrichment omits its heading and section; it does not render a misleading placeholder.
- Search refresh documents include only approved description, transcript, and Q&A text.
- Filter options derive from published relationships, not stored legacy term counts.
- Sitemap entries derive from published sermons only.
- Redirects are served only from stored internal mappings: a direct `301` must target a currently published canonical sermon, while an authenticated gone disposition returns `410`. Unknown/private slugs return the same controlled `404`.
- Public routes never expose administrator preview functionality, migration provenance, legacy metrics, raw embeds, credentials, or raw database errors.

## Rendering, SEO, and accessibility

Archive and detail content is present in initial server HTML and does not require JavaScript. The approved description is visible before media, transcript, and Q&A. The transcript and each Q&A pair use accessible closed native `<details>` disclosures while their complete approved text remains in the initial HTML; no FAQ structured data is emitted. A valid controlled YouTube player is click-to-load, uses the privacy-enhanced host, never autoplays and makes no provider request until the visitor explicitly chooses to load it. The public website does not render a separate outbound YouTube link; controlled audio links remain available without JavaScript, and the administrator-only source link is unchanged.

Pages provide stable canonicals, controlled title/description and Open Graph metadata, correct `404`/`410` behavior, a published-only sermon sitemap, labelled filters, keyboard-visible focus, a skip link, semantic headings and landmarks, live result-count status, useful empty/error states, responsive grids, long-transcript wrapping, readable Q&A, and reduced-motion handling.

This sermon-only implementation does not satisfy the permanent whole-site SEO launch gate. Production still requires the authenticated whole-site URL manifest, canonical-host decision, crawl/parity evidence, approved performance thresholds, production runtime, protected identity, and explicit deployment authorization.
