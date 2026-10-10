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
