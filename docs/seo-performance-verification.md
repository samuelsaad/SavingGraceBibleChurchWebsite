# SEO browser and performance evidence — 10 October 2026

These are executed laboratory checks, not production field Core Web Vitals or proof of ranking preservation. Private receipts bind the browser, URL, capture time, conditions and actual response. No provider recordings or analytics were loaded.

## Frozen candidate browser matrix

The V8 production rehearsal at literal loopback passed 42 checks in headless Edge, across widths 1440, 390 and 320, with JavaScript enabled and disabled. Templates included home, sermon archive/pagination, a normal page, long sermon, Arabic sermon and audio-only sermon. Each had HTTP 200, one main and H1, useful real links and no horizontal overflow. There were zero uncaught browser errors and zero external requests. Maximum observed LCP was 412 ms and CLS 0.001575. These checks were unthrottled; INP was not measured. Existing transcript disclosure and independent animated answer controls remain, with indexable text in initial HTML.

Five separate read-only local CMS browser checks verified page/home search previews, optional SEO controls, canonical guidance, navigation and the mobile inspector. Revision pointers did not change. Synthetic authenticated PostgreSQL/HTTP integration tests separately exercised draft isolation, publish, metadata, module hiding, repeated slug changes, restore, unpublish/gone and sitemap/cache responses. This is not a claim of personally authenticated production publishing.

## Comparable bounded source/candidate mobile experiment

| Page type | Original LCP | Candidate LCP | Original CLS | Candidate CLS | Original / candidate HTML bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 3280 ms | 1752 ms | 0 | 0 | 130439 / 101582 |
| Sermon archive | 3284 ms | 1576 ms | 0 | 0.000511 | 128010 / 217515 |
| Sermon detail | 3148 ms | 2164 ms | 0 | 0.044646 | 91856 / 163337 |

Both sides used headless Edge, 390×900 viewport, JavaScript disabled, 4× CPU slowdown, 150 ms network latency, 1.6 Mbps download and 750 kbps upload. A conservative one-second request-start interval and maximum two concurrent requests applied equally. Third-party resources, media and analytics were blocked. There were ten original-site requests, 31 blocked external requests, zero rate-limit responses, and six successful page results. Native CDP performance events supplied LCP/CLS. HTML byte figures are uncompressed response bodies, not transfer sizes.

The corrected experiment completed and closed its browser. A first attempt failed because a page timer could not run with JavaScript disabled; that failure remains recorded and was not reported as a pass. This small SSR experiment showed faster candidate LCP under its stated conditions, with larger archive/detail HTML. It does not establish field performance, INP, full third-party cost, statistical stability or a general production speed claim.

The implementation retains the selected design while correcting font fallback/preload behavior, early mobile navigation layout, responsive source images and keyboard-accessible table overflow. Complete field acceptance and ongoing mobile monitoring remain open. Target the 75th percentile of real visits: LCP ≤2.5 seconds, INP ≤200 ms and CLS ≤0.1. [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals).

## Final V10 verification and staging startup diagnosis

The final V10 browser matrix passed 42 checks with zero browser errors or external requests. Under unthrottled loopback conditions its maximum measured LCP was 552 ms and CLS 0.001591. No INP or field result is claimed.

The first staging source canary remained running but unhealthy during a bounded additional 180-second diagnostic wait, without an OOM kill or startup error output. Readonly phase timing found 2351 source projections loaded in approximately four seconds, while one native detail query took 71 ms and its related lookup 1977 ms. Startup was repeating recommendations across 398 records. A snapshot lookup using identical content visibility took 84 ms in the subsequent readonly diagnostic; normal detail plus unchanged related results took 1826 ms. The implementation now defers those recommendations to detail requests and caches them per versioned snapshot. This avoids introducing a new metadata store or weakening publication/review eligibility.

The full V10 regression run passed 1232 unit tests; 145 database-gated skips were covered by 1377/1377 PostgreSQL tests, zero skips, with exact test-database cleanup. Astro reported zero errors/warnings; its 16 hints include ignored private diagnostic sources. Build, offline runtime build and outgoing scans passed. Actual protected staging canary/rollback results are recorded in the final acceptance report rather than inferred from these timings.

## Deployed V10 browser evidence and video limitation

The deployed protected candidate also passed 42 browser checks across the same templates, widths and JavaScript modes, with zero uncaught errors and zero external requests. Its maximum observed CLS was 0.000352 and LCP 5788 ms. These measurements used the SSH loopback path while the full URL crawl was running. They are not comparable production field measurements and do not establish good Core Web Vitals; no INP result is available.

Existing YouTube and SermonAudio frames load only after deliberate playback. The verified relationships and accessible controls are preserved, but a crawler cannot be assumed to perform that click. Video indexing remains unverified; structured data alone would not establish that a discoverable, prominent playable video and its required metadata are available to Google. No recordings were downloaded and no fabricated video dates/durations were added. See [Google video requirements](https://developers.google.com/search/docs/appearance/video).

## Streamed sermon reading-column regression

The V11 deployed matrix found a repeatable CLS of 0.122222 on the audio-only template at 390 pixels (three diagnostic trials). Layout-shift sources showed the reading column moving down by approximately 151 pixels while the masthead remained 89 pixels tall. The sidebar appeared after the long body in the streamed HTML, although mobile CSS placed it before that body.

The fix moves the sidebar earlier in server HTML and preserves desktop visual order with explicit flex/grid item order. No copy, metadata, media identity or disclosure behavior changes. The complete local desktop/mobile and JavaScript-on/off matrix passed 42 checks with CLS 0 and maximum LCP 560 ms. Three additional controlled streaming trials (4096-byte chunks every 25 ms) produced maximum CLS 0.000293. These remain lab measurements; deployed release confirmation and field evidence are separate.

Impeccable's optimize workflow and local context were used for this narrowly scoped fix. Its one mechanical detector pass reported inherited typography advisories; the existing selected design and type ramp were retained. No design reset or new dependency was introduced.

## Final committed candidate browser checks

Release `4f127b5e5f702f639bd2b3ec36cd1fbb36420abb` passed the deployed 42-case
matrix after the streamed-column fix: maximum CLS 0.000351 and LCP 2656 ms.
Three separate deployed audio-template diagnostic trials reported CLS zero.
The final additive-delta application `2bebefb74565ccd44602ee5be0c80d80a52818b9`
passed all 42 local production cases, maximum CLS 0.001590 and LCP 564 ms.
External requests and uncaught errors were zero. SSH/load and unthrottled lab
conditions differ; neither result is field acceptance, and INP remains unmeasured.

## Final dependency-check and canonical-link correction

Three alternating guarded read-only trials returned 1,241,578 bytes of dependency
metadata with the previous query, versus 64 bytes from the same dependency graph
hashed in PostgreSQL. Previous measured times were 617/150/114 ms, versus 91/81/80 ms.
These are small local samples, not production latency or field Core Web Vitals.
Every request still checks current state without a TTL; successful system sermon
acceptance/withdrawal audits also invalidate cached snapshots. PostgreSQL tests
prove ordinary content changes and system authority events change the dependency hash.

The final core `479e6541de9cfa81aac34db4a510767818c2782e` passed 66 local browser cases:
42 main templates plus 12 event and 12 contact/giving cases. Maximum observed CLS was
0.001591; main/event/visitor maximum LCP was 884/484/1064 ms under unthrottled loopback
conditions. JavaScript on/off, three widths, zero uncaught errors and zero external
requests. The exact PDF host redirect is corrected at rendering without changing
stored CMS values. Captured meaningful distinct calendar archives preserve indexing;
only exact duplicate/empty/original-noindex variants are excluded. Final deployed
measurements and field limitations remain recorded separately in acceptance.

The final deployed core also passed all 66 browser cases: main templates max
CLS 0.000351/LCP 7820 ms, event cases CLS zero/LCP 2248 ms, contact/giving cases
CLS 0.010735/LCP 4680 ms. All ran through the SSH loopback path during the bulk
audit with third-party traffic blocked. These are stress/lab observations, not
production field acceptance. Both restarted runtimes passed all 1,070 resource
routes by SHA-256, length and MIME (2,140 checks, zero failures).

## Final download-button release

Application `52dca271bef9e80c15ee76b9b46e2d85ae15de08` passed all 66 local and all
66 deployed browser cases, with JavaScript on/off at 1440/390/320 pixels, zero
uncaught errors and zero external requests. Local main/event/visitor maximum LCP
was 920/672/788 ms; maximum CLS was 0.001591. Deployed main/event/visitor maximum
LCP was 3368/2396/5308 ms, with CLS 0.000350/0.003235/0. These SSH/bulk-load lab
results are not comparable field measurements; some deployed cases exceed the
2.5-second LCP target. INP and production real-user Core Web Vitals remain missing.
The rendering correction changes only canonical download-button destinations.
