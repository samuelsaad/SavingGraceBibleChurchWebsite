# D-181 explained migration differences

These policies explain bounded implementation choices. They do not approve unknown URL targets, missing source evidence or lost content. Each accepted URL must bind its exact source/candidate response hashes, observed issue set and the policy file hash in the private review receipt.

- **Preferred HTTPS www origin:** old HTTPS www and apex both rendered self-canonical pages. The replacement consistently uses HTTPS www, with direct hostname/scheme normalization. Fresh public REST home/url values verify HTTPS www; guarded SQL options remain unread. No production domain change occurred.
- **Broken social-logo reference:** captured HTML refers to a staging-host SGBC logo. The replacement uses the verified official church logo on the canonical origin. This corrects an unsuitable staging dependency; it does not substitute a new photograph or recording.
- **Arabic language:** the Arabic sermon keeps its original UTF8 title/body and uses ar/RTL for that content. The old global en-AU declaration is corrected; no translation or hreflang relationship is invented.
- **Dates:** equivalent ISO instants are normalized during comparison. Original publication/modification/service dates are retained. Imports, deployments, no-op revisions and replayed restores do not create historical lastmod dates. Subsequent substantive CMS publications may update modification time.
- **Headings and original text:** verified original headings replace unchanged seed presentation labels. Later explicit CMS heading/title/SEO edits remain authoritative. Missing original paragraphs, lists, links and images supplement the current layout; an explicit revisioned Replace source content control allows a complete editorial replacement. Source-only fallback pages remain read-only until a CMS entity is deliberately adopted at that address.
- **Existing consolidation redirects:** merged service/contact/event destinations retain all available original body content. Multiple distinct source identities and differing headings/metadata remain individual comparison items; a301 alone never proves equivalence.
- **Archive design and pagination:** the selected V5 archive is served at /sermons/. Its nine-card pages and directory organization deliberately differ from WordPress list layout; every source sermon must remain discoverable. Design variants redirect directly to the selected archive. Distinct pagination uses its own canonical; observed source noindex is retained.
- **Calendar and filters:** calendar exclusions require exact duplicate/empty evidence or original noindex. Meaningful distinct captured archives remain eligible with their own canonicals. Exact noncanonical query duplicates remain controlled; all retained text is server-rendered. Useful canonical taxonomy pages are retained. Unknown or ambiguous meaningful query behavior remains unresolved.
- **Empty calendar exports — prior removal decision withdrawn (D-182):** 101 event/calendar/venue export requests (20 event, 77 calendar and four venue) returned HTTP 200 with zero bytes in one snapshot. That does not prove an inactive subscription or that future events cannot populate the endpoint. Their earlier removal classification is unproven and must remain unresolved until endpoint scope, subscription behavior and a maintainable equivalent are verified. Preserve the previous classification and its witness; do not treat an empty response as retirement authority.
- **Owned image paths:** only verified church originals replace explicit Jetpack transform references. Captions and alt text remain. This is a URL/dependency change, not a claim of identical transformed image bytes.
- **Structured data:** primary Event/BlogPosting facts require exact source identity and visible support; unrelated cards, ambiguous facts, invisible performers/ratings and unsupported claims are omitted. The page/church/breadcrumb graph uses current canonical URLs. Schema changes are reported and do not guarantee a search appearance.
- **Protected staging:** access controls, noindex, disabled measurement and sitemap exclusion intentionally differ from isolated production policy. Existing authorized staging enrichment and its warnings use the incumbent selector; production retains its normal approval gate.

The click-to-load players preserve deliberate visitor controls. Google requires the video to be discoverable in the rendered page without relying on a user click or URL fragment. Recording identity tests and schema do not prove video indexing. See [Google video requirements](https://developers.google.com/search/docs/appearance/video).


## Final captured archive policy

A calendar-shaped path alone does not justify noindex. Meaningful distinct captured
archives retain source eligibility and self-canonical paths. Only empty, originally
excluded or exact nonempty same-heading/content duplicates receive the calendar
derivative exclusion. Captured query exceptions must appear in the frozen explicit
allowlist; unobserved combinations cannot expand the indexing space. Legacy sermon
facet aliases and unresolved page value/canonical differences remain individually
reported rather than treated as passed. Observed covenant document links normalize
to the verified HTTPS www destination without altering query/fragment bytes or CMS
revisions. These implementation corrections do not approve content or waive traffic,
source-coverage or metadata-parity gaps.

Absent optional archive social defaults may be explained only when the document
title is unchanged and the added title exactly equals it, type is `website`, or
Twitter card is `summary`. Existing differing values, images, headings and dates
are never accepted by this rule. A malformed single sermon-facet social URL may
be corrected to the same observed term's self-canonical URL only with matching
original title/heading. Search, campaigns, compound filters and unrelated archive
targets do not qualify. `scripts/seo-metadata-difference-policy.py` implements
these narrow predicates; raw findings remain in the reports and identity/content
verification is still required separately.

## D-183 calendar and social identity corrections

Original event lists use twelve cards. Live lists preserve that size, bound future
schedule navigation to ten years (including witnessed monthly pages), retain exact
historical facts separately from current recurrence start dates, and never infer
past gatherings from a present rule. Empty historical views explicitly identify
missing verified history and remain excluded unless an original indexed page owns
the route. Current list titles/date ranges describe the actual displayed page.
Exact Day/Previous Day/Next Day controls reset inherited list pagination while
preserving their date, scope and campaign bytes. The two witnessed dead shortcode
navigation links point to the corresponding live list; their original source404
URL dispositions remain404. Seven specifically missing original past result pages
were captured independently; this does not establish complete historical recurrence.

The three original maintained `/events/list/`, `/events/month/` and
`/events/today/` views identify themselves in both rendered metadata and sitemaps.
The original seed consolidation aliases cannot exclude a view which HTTP serves
independently. Explicit source replacement, hidden adopted content and current
withdrawals still take precedence.

A single valid sermon facet keeps its facet and page in its canonical URL,
including intentionally excluded result pages. This does not give a new facet
indexability or sitemap membership. Only the frozen valuable original allowlist
can do that. Search, campaigns and compound filters retain their separate policy.

An absent optional social description may copy the unchanged original primary
meta description. Existing social values are never replaced by this rule.
Conflicting original social URLs may identify the same source facet/calendar
scope's self-canonical URL: the original and candidate titles must match, existing
headings must match, and the actual canonical must match the corrected social URL.
An old first-page facet URL can describe that same facet's later page, but a new
unfiltered or unrelated destination cannot. Calendar corrections are confined to
the same original category/tag/calendar base; the original plugin's corresponding
blog taxonomy URL is a documented conflicting signal. Every resolution still
requires its exact response hashes and independent content/identity verification.

A rendered pagination number can be a navigation control rather than missing prose.
Its witness must identify the same source filter/page and a complete connected
candidate pagination pool containing that exact successful page, or the actual
current-page marker. A number in ordinary prose, an unverified target, a different
filter or an incomplete pool cannot receive this explanation.

The original speaker profile's short role and archive label remain visible in the
selected archive header. They come only from its verified leading source portrait
and matching speaker name, before any sermon cards. Card text is excluded; explicit
source replacement still wins. No new role, biography or approval is generated.

Search/empty-taxonomy result excerpts may use a shorter layout while their full
canonical content remains available. A linked-content witness is confined to those
observed view types. It must bind the original WordPress result object and heading
link, a real heading link in the new result list, the same indexable self-canonical
content URL and exact body hashes. Text requires its original paragraph and links
on that page. Images require the same verified owned file, successful image MIME
and preserved meaningful alt text. This never approves unrelated redirects, absent
content, unverified files or a whole URL merely because one witness succeeds.

An original future occurrence removed by a published recurrence edit returns410
and retains its cancellation UID in calendar exports. Unknown dates remain404.
Explicit per-occurrence edits, module hiding and slug dispositions retain their CMS
ownership; a computed series page cannot overwrite them or revive withdrawn content.

Validated source reuse is a runtime performance optimization, never a disposition policy. It requires current pointer selection, exact current wire-byte SHA-256, prior complete schema/version validation and deep immutability. Changed bytes or versions cannot reuse an earlier certificate. Mutable/unknown constructor input remains fully parsed. Bounded in-memory reuse has no disk authority, TTL, eligibility or editorial effect.
