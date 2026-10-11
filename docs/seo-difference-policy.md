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
