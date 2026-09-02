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

## Presentation layer

The sermon frontend is a framework-independent presentation package under `src/frontend/`. It contains no database or Node-only code, so the server handlers and the static Astro pages consume the same modules:

- `tokens.ts` — the only source of colour, type, spacing, radius, elevation, motion and measure values, emitted once as custom properties. The contrast test computes every text/surface and control pairing from these tokens.
- `html.ts` — an escaping `html` tagged template. Every interpolation is escaped unless it is already-rendered markup, so approved content, slugs and query values never reach a template unescaped.
- `routes.ts` — route paths, legacy-compatible query builders and query-state predicates. Nothing here changes a URL shape.
- `styles/` — readable CSS partials (`core`, `archive`, `sermon`, `preview`) compacted at module load. A page inlines only the blocks it uses; boundary and taxonomy pages carry no picker or player CSS, and the `preview` block never enters the static build.
- `scripts/` — three readable enhancement scripts (`navigation`, `archive`, `sermon`). Each is embedded as a `<script>` body and hashed into the Content-Security-Policy from the rendered document, so the header and the markup cannot disagree.
- `components/` and `pages/` — one sermon list item with density variants, the Find Sermons controls, the Bible passage picker, carousels, pagination, controlled media, and the page composers for the archive, sermon, home, taxonomy and boundary pages.
- `shell.ts` — the document skeleton, header, navigation disclosures, footer and preview banner.

`src/server/http/public-sermon-page.ts` is the public router only (routes, redirects, sitemap, error mapping) and re-exports the render functions for existing callers. `frontend-archive-loader.ts` is the single place that decides when discovery sections load, and `frontend-response.ts` derives every response's policy from the document it sends: hashed `script-src` and `style-src` (no `unsafe-inline`), and `frame-src https://www.youtube-nocookie.com` only when the page contains a click-to-load video frame.

The visual direction is editorial: a warm paper ground, one literary serif for headings and reading text, a system sans for controls and metadata, hairline rules instead of boxed cards, and a single deep green used for links, primary actions and selected states with a restrained ember accent for the Scripture kicker and the applied-search marker. There is no invented logo, slogan, imagery or contact information; the church name is set as a plain text wordmark. The site is light-only and honours reduced-motion and forced-colours preferences, and it prints without navigation chrome.

## Authenticated local frontend preview

The local loopback harness also provides `/frontend-preview/`, archive/detail pages and preview-only speaker, series and Bible-book taxonomy pages. These pages reuse the same rendering components as the public experience, but the selector is limited to the exact completed three-pilot/12-Wave-1 source scope and independently requires private draft lifecycle, completed guided review, approved current description/transcript/Q&A, controlled media, a reviewed primary-passage outcome, and non-superseded provenance. In accordance with D-141, an explicit no-primary outcome is complete without inventing a Bible-book classification; the preview alone labels that outcome as "No single primary passage (reviewed outcome)", and public pages render nothing for it.

The dashboard obtains a short-lived in-memory preview session through the existing local administrator identity. The session cookie is `HttpOnly` and `SameSite=Strict`; a copied URL, preview query parameter or identity header is insufficient. Every preview response is private/no-store and `noindex, nofollow, noarchive`, omits canonical/Open Graph metadata, and has no sitemap, feed or structured-data endpoint. The dashboard link is injected only by the loopback runtime, so neither it nor private preview wiring enters the static production build.

The authenticated preview's primary header keeps Home at the top level and groups the four sermon-discovery destinations under one **Sermons** disclosure in this order: Sermons, Speakers, Series and Bible books. The disclosure is a native `<details>` element, so it opens and closes by pointer, Enter and Space with no script; its summary mirrors `aria-expanded`, shows a visible chevron and carries a non-colour current-section marker whenever one of the four sections is active, while the exact child link separately uses `aria-current="page"`. The preview-only navigation enhancement adds Escape (closing and returning focus to the summary), close on focus departure, link selection and click-away. At narrow widths the **Menu** disclosure remains the outer navigation and the Sermons section expands in normal document flow inside it as an accordion. The four direct destinations remain in the footer, and public-mode routes keep a plain Home/Sermons header because the preview-only taxonomy indexes are not public routes.

## Search and filters

Search uses the existing generated PostgreSQL search vector and GIN index. An explicit match-priority tier orders whole-query matches as title first, Scripture reference or approved Bible book second, series or speaker third, approved description fourth, and body/approved transcript/approved Q&A fallback last. Within that tier, PostgreSQL’s vector weights are:

1. Title — weight A.
2. Speaker, series, Scripture, and Bible-book search terms — weight B.
3. Approved sermon description — weight C.
4. Published body plus approved transcript and approved Q&A text — weight D.

Vector rank is descending within the match-priority tier, followed by requested service-date order and stable sermon ID. The title also has a parameterized escaped partial-match fallback. Search input is trimmed, bounded to 120 characters, and punctuation-only input becomes an ordinary browse rather than a database search.

The **Find sermons** controls are one unboxed line: Search, Speaker, Bible book, Series and a single Search button. Beneath it sit two native disclosures. **Browse by Bible passage** holds the passage picker. **Advanced search** holds the legacy Scripture-reference select, the sort order and the inclusive service-date bounds; it is collapsed by default, opens server-side whenever one of its filters is active, and its summary shows a visible "N filters active" badge so the closed state still reveals that an advanced filter applies. Both disclosures are restored on browser back/forward by a small `pageshow` handler. The form submits to `…/sermons/#sermon-results`, so a completed search lands on the results section without JavaScript; the archive enhancement additionally moves focus to that section, whose accessible name combines the results heading and the count. Every active filter is shown as a removable token that drops only that parameter, beside one Clear all filters link. The public archive retains the legacy-compatible query names for speaker, series, passage, Bible book, keyword, and order, plus inclusive service-date bounds. Dimensions combine with `AND`. Filter options are derived only from relationships attached to eligible sermons; pending-only and private relationships cannot become public options.

The Bible passage picker is a three-panel Books → Chapters → Verses tile index backed by `passageBook`, `passageChapter`, `passageVerse` and an explicit `passageScope`; the server contract still accepts the legacy optional `passageEndVerse`. Every tile and every **Search all of …** control is an ordinary link that performs that search on the server, so without JavaScript a single activation of a book searches the whole book and reveals its chapters. With the enhancement, a single book or chapter activation reveals the next level without searching; a double activation, activating the selected tile again, or the explicit **Search all of Genesis** / **Search all of Genesis 3** control submits the whole book or chapter; a single verse activation submits that exact verse. Each grid is one Tab stop with arrow-key, Home and End movement, Escape/Backspace return to the parent level, live announcements, mobile Back controls and one-panel progressive layout below the tablet breakpoint (including the 200%-zoom-equivalent width). The 66 books appear in canonical order with compact abbreviations at the start of each accessible name, nine distinct restrained literary-group tints with a collapsed colour key, and neutral blue-grey chapter and verse tiles. Selected and applied states use a check mark, a marker and text as well as colour. Canonical book order, abbreviations, chapter counts and per-chapter verse counts come from the checked-in 66-book Protestant/KJV versification revision; no external Bible service is contacted.

Book-only, whole-chapter, exact-verse and legacy verse-range requests use inclusive interval overlap against only administrator-confirmed `primary` relationships. Supporting, unclassified, pending, rejected and private relationships never satisfy this filter. A keyword and primary-passage request combines with `AND`; the results heading and the filter tokens name both dimensions. Broad Bible-book and precise-passage state is synchronized so the form cannot submit contradictory books, while unrelated filters and pagination/history state are preserved. Scripture-shaped keyword input such as `Romans 8` remains ordinary PostgreSQL keyword/structured Scripture search; the picker neither runs semantic search nor changes metadata-related recommendations.

## Archive discovery modes

The unfiltered first archive page renders exactly the three most recent eligible sermons under **Most Recent Sermons** as compact landscape items in deterministic service-date/ID order. Each item leads with the reviewed passage as a Scripture kicker (omitted when the title itself already states that reference), then the title as the single link with a hit area covering the whole item, then date, speaker and series, then the approved description clamped to eight lines on desktop and tablet and nine on mobile with the full text left in the DOM. **Show more recent sermons** enters a URL-addressable nine-item newest-first list with continuous ordinals, numbered pages, Previous/Next and **Show fewer recent sermons**. Search or filter state immediately switches to result mode, whose heading names what was asked for ("Sermons by …", "Sermons preached from …"); expanded and result modes hide both discovery sections.

**Topical Sermons** is a section boundary that renders compact sermon cards only when the repository returns administrator-approved topical sermons. The current schema has no such lifecycle, so it renders a one-sentence note; when the collection also contains a series literally named "Topical", the note says that those sermons are listed under Series, because a series name is not a topic taxonomy. A missing primary passage is never inferred to mean topical.

The **Series** section selects one most recent eligible sermon per series with service-date/ID tie-breaking and stable series ordering, rendered as series cards in which the series name leads and the representative sermon follows. It is a horizontally scrolling list with scroll snapping, Previous/Next controls that appear only when the track overflows and use `aria-disabled` rather than removing focus, and never autoplays.

Matching items and detail pages label reviewed coordinates as "Preached from". Historic unreviewed Scripture metadata is not shown on visitor-facing pages; it continues to power the existing keyword/structured Scripture path where already approved. This passage filter does not query title text, run an embedding model, read semantic relationships or alter metadata-related sermon scoring.

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

Archive and detail content is present in initial server HTML and does not require JavaScript. The sermon page order is fixed: title and metadata, the approved description, the click-to-load player, the transcript, the ordered questions and answers, then metadata-related sermons, with an "On this page" list of the sections present. The approved description is visible before media, transcript, and Q&A. The transcript uses an accessible closed native `<details>` whose complete approved text remains in the initial HTML and which opens automatically for printing; every Q&A pair is rendered open in normal flow, as `AGENTS.md` §11 requires, and no FAQ structured data is emitted. A valid controlled YouTube player is click-to-load, uses the privacy-enhanced host, never autoplays and makes no provider request until the visitor explicitly chooses to load it; the consent copy names youtube-nocookie.com, a loading status is shown while the player paints, and focus moves into the player. The public website does not render a separate outbound YouTube link; controlled audio links remain available without JavaScript, and the administrator-only source link is unchanged.

Pages provide stable canonicals, controlled title/description and Open Graph metadata, correct `404`/`410` behavior, a published-only sermon sitemap, labelled filters, one page-level `h1`, header/navigation/search/main/footer landmarks, keyboard-visible focus (an inset two-tone ring on tiles), 44-pixel targets for standalone controls, list semantics preserved where list styling is removed, a skip link, useful empty/error states, responsive layouts verified at 1440, 768, 375 and a 720-pixel 200%-zoom-equivalent width, long-transcript reading measure and paragraph rhythm, and reduced-motion, forced-colours and print handling. Automated checks are structural; no formal WCAG conformance is claimed.

This sermon-only implementation does not satisfy the permanent whole-site SEO launch gate. Production still requires the authenticated whole-site URL manifest, canonical-host decision, crawl/parity evidence, approved performance thresholds, production runtime, protected identity, and explicit deployment authorization.
