# Read-only source SEO baseline

The current whole-site SEO task authorizes a fresh public WordPress baseline and
relevant read-only account/source evidence. D-110 remains the production launch
gate. A captured source response is evidence of the old public website, not a new
content review, approval, production deployment or claim of SEO parity.

## Current acceptance checkpoint - 10 October 2026

The final frozen union supersedes the smaller historical checkpoints below; their
original evidence remains retained. The public REST root at 05:59:35 UTC explicitly
reported `home` and `url` as `https://www.savinggrace.org.au` and the WordPress timezone
as Australia/Melbourne. Live apex HTTPS nevertheless served a self-canonical copy.
The replacement uses HTTPS www consistently and corrects this duplicate with a
permanent host redirect. These public configuration facts do not bypass the rejected
SQL privilege guard or prove every stored permalink/SEO plugin field.

The dated union combines the 9 October 13:18-14:52 UTC fixed-frontier crawl, the
10 October public REST metadata inventory and its exact 1,240-URL HTML continuation,
verified resource responses, retained 4 October sermon metadata and a separately
captured original search page. Each retained response keeps its original capture
time; adding provenance does not make an older body a fresh inspection.

The union has 7,376 captured responses and 14,818 discovered URLs. The preceding
API frontier retained 7,263 deferred URLs; additional inventory resource references
remain explicit. A completed bounded request queue is not complete source coverage.
The frozen union SHA-256 is
`dd355c3d210e9d5ba13abe9f5a1b54d0945a993e94660729204b7ae0d30eec39`.
Its parent expanded ledger SHA-256 is
`6e9d19c5311bbc4ee199b1754a98af73ac12785d495e55c1b9d1b224e04b7db0`.

Public REST revealed 30 pages, three posts, 1,084 published event identities, three
venues, one organizer and 420 readable media records. Headers report 437 media
records; 17 were not exposed and were neither guessed nor queried privately.
The API does not expose the sermon type. The known sermon reconciliation is 454
retained public identities plus three freshly discovered identities, all with
successful original-path source evidence; 457 is not a proven complete current
stored sermon count. GUIDs were not used as permalinks.

The media metadata includes 117 MP3 recordings and one MP4. Recording bodies are
outside this task. Two ZIP files and one OTF were not copied by the document/image
allowlist. The resource phase verified 1,120 source responses: 513 RSS, 245 ICS,
88 PNG, 262 JPEG, two GIF, seven PDF, one DOCX, one WEBP and one PPTX. It completed
at 07:13:46 UTC. Its immutable parent manifest SHA-256 is
`89ecea2b1c23759873722de68eac989ed5079f4944a7c81377d87d8fea505027`.
There are 408 external dependencies, including transformed assets whose bytes were
not verified. Source-derived church originals do not establish CDN-byte equivalence.

The migration bundle holds 3,422 routes: 30 pages, three posts, 665 archive/query
projections, 457 sermons, 1,197 event projections (including the 1,084 stored public
identities and 113 previously captured virtual/date projections), and 1,070 resource
routes backed by 1,049 unique files. Source metadata, capture variants and intended
canonical projections have different counts and must not be conflated.

The SQL account failed the unchanged SELECT/USAGE-only guard before any table read.
Search Console/Analytics/Tag Manager account reports, access logs, the complete WXR
and supplied asset archive, and a current complete WordPress recovery backup remain
unavailable. Public DNS TXT inspection observed one Google-verification record;
its token is kept private. No DNS/account change was made. Repeated browser-tool
startup failures prevented account inspection; they are not evidence that an
account has no property, no history or no errors.

Frozen private ledger and resource paths used by the repeatable checks are shown
in the acceptance/runbook documents. The safe CSV ledger records every discovered
row with preserved, redirected, intentionally removed or unresolved disposition.
Missing account/source evidence and uncaptured URLs remain launch blockers.

## Verified access and origin findings

On 9 October 2026 both `https://www.savinggrace.org.au/` and
`https://savinggrace.org.au/` returned HTTP 200 with their own host in the canonical
link. Both identified WordPress 6.4.13. Thus the old site currently exposes two
self-canonical homepages; the already-recorded replacement origin is the HTTPS
`www` host. A target host redirect is a deliberate duplicate correction, not
proof that the legacy site already redirects.

The current protected MySQL Shell identity/grant probe matched the configured
MariaDB destination. It failed the unchanged SELECT/USAGE-only guard: the two
grant rows exposed `PROCESS` and `SELECT, SHOW VIEW, EVENT, TRIGGER`. No WordPress
table was queried. Do not weaken the guard or describe the public crawl and old
export as a fresh database inventory. The guarded SQL options remain unread. A later fresh public REST inspection
verified both `home` and `url` as HTTPS www; see the current checkpoint above.

The retained WordPress metadata capture is dated 4 October 2026; its separate
media export has 462 records including 454 published rows. Those explicit stored
slugs, interpreted through the previously confirmed `/sermons/{slug}/` rewrite,
seed candidate URLs alongside retained church source links. A seed does not prove
current publication, indexability or a successful current response.

No Search Console, Analytics or Tag Manager connector is exposed in this task.
No authenticated account configuration or retained report export was located
in the scoped project checks. Public measurement IDs or script references do not
prove account access. Account reports and field performance remain separate gaps
until actual church-owned evidence is supplied or a working connection is found.

## Repeatable capture

`python scripts/seo-source-capture.py --output private/seo-baseline/2026-10-09 --seed-file private/seo-baseline/2026-10-09/seeds.private.json --max-urls 10000`

The tool uses Python's standard library, GET requests only, exact church hosts,
no credential forwarding, no cookies, no script execution and no provider/media
requests. It respects captured robots directives, uses one worker with at least
one second between request starts, caps responses at four million bytes and makes
at most two retries. The HTML phase inventories images, documents, scripts and styles as
references; recordings are never retrieved. Account APIs are not called.

Raw response bodies, metadata/content extraction, source identifiers, URLs and
inlink provenance remain in ignored private storage. Resume skips completed
responses. The ledger records eligible pending URLs, explicit exclusions and deferred unresolved URLs. Reaching the
10,000-URL cap sets `capReached` and leaves `completed` false. Failures, unsupported
content types, oversized bodies and missing content regions remain visible; none
is silently promoted to a complete page.

Discovery policy version 2 expands canonical primary-host responses only. It
retains every observed same-church URL and provenance even when expansion is
suppressed. Duplicate-host aliases and source-declared WordPress shortlinks remain
unverified dependencies. Noncanonical responses enqueue their canonical
counterpart without recursively growing the queue from their other links.

The event calendar exposes an unbounded date-navigation space. The finite phase
preserves sitemap/retained authored events and root/list/month/today
representatives; navigation-generated dated instances and export/query variants
remain explicitly deferred. This is a documented sampling boundary, not evidence
that all possible calendar URLs are migrated or equivalent. Finishing eligible
work sets `htmlPhaseComplete`; unresolved deferred URLs keep overall `completed`
false. Secondary RSS/Atom variants are retained as unverified dependencies, while
root feed representatives are captured. `--freeze` can checkpoint a stopped finite phase without claiming completion.
An OS-backed lease prevents HTML and asset workers using the same evidence
directory from overlapping.

The separate `--reextract` option verifies each saved response SHA-256 and derives
updated extraction without further requests or changing response bytes.

## Separate asset phase

After the HTML worker stops, `python scripts/seo-source-capture.py --output private/seo-baseline/2026-10-09 --assets` captures referenced images (including responsive, social and icon references) and documents from the two verified church hosts only. It requires an explicitly frozen HTML checkpoint and the exclusive worker lease, respects retained robots rules, maintains the one-request-per-second rate, permits at most two retries, caps each file at 50 MB and checks response status, MIME, magic bytes and SHA-256. Office packages require the appropriate document structure. Active SVG or macro-bearing document candidates remain unresolved. Recordings, theme scripts, styles and generic ZIP archives are not downloaded.

For Jetpack URLs that explicitly embed an approved church upload hostname/path,
`sourceDerivedOriginals` records the corresponding HTTPS church original. Only
that original is requested. The external transformed URL remains an unverified
dependency; the tool never claims that original and resized CDN bytes are equal.
Other CDN, theme-demo and staging hosts are not contacted.

The separate `assets-capture.private.json` preserves each source URL, status, hash, MIME, byte count, source-page dependencies, private file path and validation outcome. Every external, unsupported, failed, mismatched or oversized dependency is recorded explicitly. Captured root RSS/Atom responses also enter the asset manifest from their exact
hash-verified response bytes, with a feed MIME type and the original content-type
retained separately. They are neither requested again nor reserialized.
The phase does not mutate the HTML ledger or publish assets. Asset validation checks identity/type; it is not a full malware or document-accessibility audit.

## Evidence contract

- `ledger.private.json` indexes each requested URL by status, response hash,
  timestamp, source identity, template and private record path. It retains all
  discovered URLs, referrers, asset references, exclusions and pending work.
- `pages/<url-sha256>.json` records HTTP/redirect/robots/canonical metadata, title,
  description/social metadata, headings, structured data, dates, images and alt
  text, link relationships, resources and provider references.
- `mainSelector`, `mainFound`, `mainHtml`, `mainTextSha256`, `semanticBlocks` and
  `contentTree` distinguish the identified primary region from global navigation.
  Listing templates select the outer content region so all source post cards
  survive; single posts retain their own article region. The tree allows only the replacement's safe content-node tags and attributes.
- Sermons use the explicit `.sermon-main-content` region. An empty region is a
  legitimate empty source body. Missing regions are unresolved; no generated
  description, transcript or question-and-answer content is substituted.
- Event `eventMetadataTree` separately preserves the actual Vamtam schedule and
  event metadata regions (with a standard Tribe Events fallback),
  including original displayed date, time and venue labels. It is appended to the
  source description without deriving dates from publication metadata.
- `serviceDate` comes only from the explicit displayed sermon-header date and is
  separate from source publication/modified timestamps. Ambiguity stays null.
- `primaryMediaReferences` is restricted to the sermon detail container. The
  full-page media inventory may contain global channel links and must not be
  interpreted as a sermon recording assignment.
- `measurementSignals` records script references and GA/GTM/verification presence
  from returned HTML only. It does not execute tags or establish account ownership.

## Historical initial finite baseline (superseded by the current checkpoint)

The finite phase finished with 2,537 responses across 6,313 observed church URLs:
2,483 HTTP 200, 36 HTTP 404 and 18 HTTP 301 responses. There are no eligible
scheduled URLs, no unclassified observed URLs and no cap hit. The 467 sermon
responses represent 457 distinct rendered source identities; ten responses are
feed tracking variants. Response counts must not be described as unique content
counts.

There are 3,598 explicit unresolved deferrals: 995 duplicate-host aliases, 1,090
generated calendar/export URLs, 751 declared shortlinks, 159 URLs observed only on
nonexpanding responses, and 603 secondary feed variants. Thus the HTML phase is
frozen and its finite queue complete, while overall source coverage remains
incomplete. Fresh WordPress table facts and authenticated account reports are also
still unavailable; this baseline does not establish whole-site SEO parity.

The asset manifest contains 92 verified entries: 87 images, two PDFs and three
unchanged RSS responses. These represent 67 unique SHA-256 values and 12,995,909
bytes across URL entries. All stored files were independently reread for matching
hash and byte count. The 382 remaining dependencies comprise 370 unrequested
external transforms with an explicit church-original candidate and 12 other
external origins. Original bytes are not claimed equivalent to their transformed
CDN representations.

A concrete identity correction cleared eight archive IDs that had been inferred
from the first listed post. Only explicit singular templates may use an article-ID
fallback; explicit body-level page/post IDs remain intact. The ledger records the
correction and previous ledger hash, and the asset manifest binds the corrected
ledger while retaining its prior binding. No HTTP response bytes were altered.

The final ledger SHA-256 is
`574b2a7ca1578bc75447d2e2a12ca6904ab1f1ac4d044a1aab7bdad116c5037c`.
The corresponding asset-manifest SHA-256 is
`cbc39dc69bf98bc68a90decc987f47bedbf52bf7957fb0b45dea700ee98ff1a4`.

A separate final `--verify-hosts` probe confirms that HTTP redirects with 301 to
HTTPS on the same host, while HTTPS `www` and apex both return 200 with their own
host in the canonical. The probe does not follow redirects or modify the frozen
ledger. One response-save attempt encountered the Windows path-length limit;
the corrected bounded retry is retained in that probe's private receipt. All
primary capture workers stopped at that freeze. No recording, external asset, analytics tag or
account API was requested.

## Offline checks

`python tests/seo_source_capture_test.py` checks anonymous empty-body preservation,
service-date ambiguity, scoped recording identity, content-node sanitization,
passive measurement evidence, URL/recording/admin exclusions, event metadata,
noncanonical expansion, generated-calendar deferral, exclusive worker leases and
explicit caps, archive identity, exact feed bytes and isolated host probes.
The current focused suite has 24 passing anonymous offline tests.

## Retained sermon reconciliation

The retained export contains 454 published source records. Each of their actual
WordPress IDs and stored sermon permalink paths matches a fresh HTTP 200 capture:
454 matched, zero missing, zero moved and zero identity mismatches. The fresh
baseline has 457 unique sermon identities, adding source IDs 30130, 30131 and
30132. All 457 have primary source media references and occur in the candidate
source bundle. GUIDs were not used as permalink or identity evidence. This is a
reconciliation against the retained export, not a claim of a fresh database
inventory after the WordPress privilege guard rejected access.

The 36 source HTTP 404 responses comprise 28 calendar paths, one `/pages/` alias
and seven other paths; none is a retained published sermon permalink.

## Fixed known-frontier extension

A separate, parent-hash-bound snapshot now captures the exact 3,598 deferred
URLs above. It preserves the frozen primary snapshot and requests secondary links
and feed variants first, followed by aliases, shortlinks and calendar/export
URLs. Two workers share a request-start limit of at least one second; every URL
has at most two retries. Redirect destinations and newly observed links are
retained without expanding the request set. HTML, XML, plain text and calendar
responses are bounded to 4 MB; recording and external-origin bytes remain
excluded. Completion and actual outcomes will be reported separately after the
worker finishes. Finishing this fixed set does not establish that an unbounded
generated calendar space, unavailable database facts or account evidence has
been exhausted.

Public markup establishes that a GA4 configuration was present on the captured
homepage. This passive source observation is separate from ownership, account
access, traffic and backlink reports, which remain unavailable. No analytics tag
or account request was made by the capture.

## Supplementary fixed-frontier capture (10 October 2026 Sydney)

The linked second snapshot requested every one of the 3,598 previously deferred URLs, with two workers sharing the one-second request-start limiter and the same two-retry ceiling. Its interval was 9 October 2026 13:18:45–14:52:48 UTC (10 October 00:18:45–01:52:48 in Sydney). The original freeze remains unchanged. The combined ledger contains 11,300 observed URLs and 6,135 captured responses: 4,981 HTTP200, 136 HTTP404, 828 HTTP301, 28 HTTP302 and 162 HTTP429. The 429 responses remained unresolved after the permitted attempts; no additional retry was made.

Responses exposed 4,987 further URLs, predominantly host/tracking aliases, recurring-event/calendar navigation, feeds and implementation assets. These are retained explicitly without recursive expansion. The finite fixed frontier finished, but the whole-site baseline remains incomplete. No fresh WordPress tables, Search Console landing/indexing/backlink reports, analytics history or access logs establish coverage beyond the captured union.

All 454 published sermons in the retained export returned freshHTTP200 with their exact explicit source IDs at the recorded slug paths. The fresh inventory contains 457 unique sermon IDs; additions are30130,30131 and30132. All457 have a captured primary recording relationship:328 YouTube and427 SermonAudio relationships, including129 sermons with audio and no YouTube mapping. No recording bytes or caption source were requested.

The extended asset manifest validates850 responses:90 images, two PDFs,513 RSS responses and245 calendar exports. There are822 distinct hashes and18,727,487 bytes across entries. The canonical-host rehearsal installs819 unique resource routes/files. Three dynamic feed/calendar host variants have different captured bytes and remain explicit review items; selection of the verified www response does not certify the alternate as byte-identical. Of408 remaining external dependencies, church-origin replacements are used only where their originals were independently verified. Transformed CDN bytes remain unverified.

The public homepage contains one actual GA4 config call; a second G-pattern match is not a second config call. No GTM container or verification meta name was observed. The configuration receipt is private and binds the source response hash. Account ownership, reporting receipt, organic history and field Core Web Vitals remain unverified. No measurement tag was executed.

Final source ledger SHA256: `e6480d8fafe7b7d1e6c47f49f3456b2e1f4b167af86a0c49f5e8b38089399f9c`.
Extended asset manifest SHA256: `44a0f513cf0b9acea55e17a08ea5cb477fd56724bbef86fbf6ad7fabfad3f4c7`.
The final prepared projection contains30 pages, three posts,665 archive/query pages,457 sermons,377 events and819 resource routes. This is a captured-source projection, not a claim that the current source database contains no additional public records.

## Additional search observation

One separately frozen readonly source probe on 10 October 2026 at 00:00:50 UTC (11:00:50 Sydney) inspected `/?s=church`. It returned 200, a search-results heading, noindex and no canonical. Its response SHA-256 is `f2494b7dc8ad9d08f5cb618ce19f237030a5335f9a1ccab116e6e3363a82de1a`. This later observation is not retroactively inserted into the linked frozen crawl. Its separate response/result comparison is included through the safe acceptance-report union; exact result ordering/text differences remain explicit. No account access or provider recording was involved.

The original retained raw WXR export and complete asset archive were not located/reconciled through available repository/protected evidence. The verified 462-record retained sermon projection remains available. Browser account inspection could not start because its Windows sandbox helper rejected deny-read ACL setup; no Search Console, Analytics or Tag Manager account report was inspected. No fresh stored WordPress home/siteurl/permalink or plugin metadata was read after the strict grant guard rejected the configured account. These limits cannot be represented as complete source coverage.

## Supplementary public ownership evidence

A read-only public DNS TXT inspection on 10 October 2026 at 05:06:25 UTC found one Google site-verification record at the apex. The protected receipt SHA-256 is `f750697a7b8beb3cbd41ec72c13c2958a6c846a5b19e199dbc87d2c05ad0fe0d`. No token is included here and no DNS record was changed. This supports retaining the existing DNS verification mechanism; it does not prove the accessible Search Console property, ownership state or indexing reports.

Two further attempts to open Search Console through the existing in-app browser automation failed with `trusted Node process exited unexpectedly; kernel reset`. No account page or report was returned. Account evidence remains unavailable through this environment; the report does not claim that the church lacks accounts or access. Public tagging inspection and DNS evidence are separate from account/report access.

## Fresh public WordPress configuration and publication metadata

On 10 October at 05:59:35 UTC, the public REST index returned configured `url` and `home` as `https://www.savinggrace.org.au`, timezone `Australia/Melbourne` and GMT offset 11. Its response SHA-256 is `7cea2d7a356eab15f771508fc9d135106baab74a4b5f85391e7196a6a249e055`. This independently verifies the selected hostname through live public configuration; direct SQL settings/permalink options remain unavailable. The earlier HTTPS apex/www self-canonical conflict remains a recorded source defect.

A bounded read-only API inventory captured all 30 public pages, 3 posts, 1084 published event records, 3 venues and 1 organizer. The media collection reported 437 records but returned only 420 readable entries across its five pages; the 17 omitted entries are not guessed or retrieved through privileged routes. The readable entries include 117 audio files and one video file, which are not downloaded under this task, plus public images/documents and unsupported font/archive objects. Private feedback, payment-order, template and navigation records were not queried.

Page/post coverage matches the existing projection. The API revealed 820 event URLs not captured in the main frozen ledger, plus 420 attachment URLs requiring explicit reconciliation. Their exact bounded public HTML capture is retained separately and must supersede any claim that the older event inventory was complete. API `link` fields are current permalink evidence; GUIDs were not requested or used. Source metadata records and bodies remain in protected storage.

The public post-type index does not expose the sermon type. Its absence does not establish the authoritative total of published sermons. The known 457 sermon identities remain reconciled through HTML, sitemaps and the retained export; fresh authoritative complete sermon publication evidence is still required.
