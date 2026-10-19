# SEO post-launch monitoring

Prepared under D-181; no future monitoring is claimed and no recurring automation is installed. Baseline: dated source ledger and `seo-source-baseline.md`; release: `seo-migration-acceptance.md`. Responsible operator: Samuel or a named delegate recorded at final approval, with a church account owner for Search Console/Analytics. Store account exports and incident details privately.

| Window | Execute and compare | Response |
| --- | --- | --- |
| Immediately after activation | Exact public hostname/TLS; critical landing pages; redirect inventory; actual404/410/5xx; canonicals, robots, sitemap and private boundaries; image/PDF MIME/hash; mobile navigation and controlled media | Halt acceptance; use runbook rollback for broad failures, leaked drafts or wrong-content routing. Record affected URLs and release. |
| First 24 hours, several checks | Availability, proxy/application errors, source-ledger redirect/asset samples and all newly reported failures; verify production measurement once and no staging pollution | Fix exact routes/content, retain historical aliases, rerun complete affected checks; escalate widespread errors. |
| Daily in week 1 | Search Console sitemap processing/indexing exclusions/canonical selection and crawl errors; analytics organic landing pages; unexpected404/5xx and media/asset errors | Compare exact affected URLs with source baseline. Distinguish old source defects from new regressions. No bulk irrelevant redirects. |
| Several times in weeks 2–4 | Organic clicks/impressions/CTR/position and landing-page sessions, using matching weekdays and comparable 28-day periods; valuable queries, backlinks and indexed canonical URLs | Investigate sustained changes by page type, query and device; inspect live status/canonical/content/discovery. Do not attribute every fluctuation to migration or promise recovery dates. |
| Weekly through stabilization | Mobile field LCP/INP/CLS, availability, newly orphaned pages, CMS slug/publication changes, sitemap freshness and all remaining WordPress-hosted resources | Resolve regressions, verify CMS redirect chains remain flattened, and keep recovery systems until formal acceptance. |

Executable starting commands for the protected candidate are documented in `seo-migration-acceptance.md` and `seo-staging-deployment.md`: full inventory comparator, browser matrix, deployment verify, and read-only inventory. The comparator refuses external origins; production checks must use a separately approved proxy/tunnel setup and verify public DNS/TLS independently. Freeze each new report with UTC capture time and release identity.

Search account baselines are unavailable unless subsequently provided; do not fabricate zero clicks, complete indexing or historical Core Web Vitals. Candidate browser timing is lab evidence only. Good field targets at the 75th percentile are LCP ≤ 2.5 seconds, INP ≤ 200 milliseconds and CLS ≤ 0.1. No claim of field acceptance can be made before representative real-user data exist.

A successful technical migration cannot guarantee identical rankings during recrawl. Preserve redirects and investigate observed evidence; do not mass-rewrite content in response to short-term noise. [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals), [site-move monitoring](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

## Rerunnable verification commands

Use a fresh ignored output directory for every run. Supply the protected frozen ledger/assets paths and require the runtime label returned by the bound release. Both commands refuse non-loopback destinations; verify actual public DNS/TLS separately after authorized cutover.

```powershell
python scripts/seo-verify-candidate.py --baseline private/seo-baseline/d183-final/ledger-calendar-eight-20261020.private.json --assets private/seo-baseline/d183-final/assets-calendar-eight-20261020.private.json --candidate http://127.0.0.1:4446 --environment production --expected-runtime-label <verified-label> --concurrency 4 --timeout 60 --request-limit 50000 --output private/seo-candidate/<fresh-run>
python scripts/seo-verify-candidate.py --baseline private/seo-baseline/d183-final/ledger-calendar-eight-20261020.private.json --assets private/seo-baseline/d183-final/assets-calendar-eight-20261020.private.json --candidate http://127.0.0.1:4451 --environment staging --expected-runtime-label <verified-label> --concurrency 4 --timeout 60 --request-limit 50000 --output private/seo-candidate/<fresh-staging-run>
```

A nonzero comparator exit is an unresolved finding, not a deployment success. Retain its complete machine-readable issue ledger. The responsible operator must classify original defects, planned private-environment differences and new regressions individually; never clear the report just to reach a pass. On launch day run the full mapping, then repeat critical-page/status/asset checks during the first day, daily through week one and with the account/field comparisons in the table above.

D-182 adds [the repeatable evidence workflow](seo-remediation-checks.md), original
cohort accounting and direct verification of all 975 historically failed internal
targets. Use the reconciled final ledger, preserving the dated original history and
source continuation. Alert immediately on any critical landing-page outage, leaked
draft/admin content, unexpected indexing exclusion or wrong-content redirect.
Compare noncritical failures with the exact baseline before assigning migration
causality. A numerical organic-traffic rollback threshold remains unapproved until
real church-owned comparable-period reports exist; the operator must review actual
page/query/device evidence rather than inventing a zero-traffic baseline. Confirm
Samuel or the named delegate and the church account owner before launch. These are
prepared responsibilities and checks, not executed future monitoring.


The current candidate and deployment status are recorded in the acceptance report.
The frozen union is 23,089 observed URLs; preserve the original 23,017 denominator
and the exact bounded additions. Current staging access is unavailable, so no new
monitoring or deployment success is inferred from a retained release identifier.
Use the exact post-switch hostname/TLS/proxy commands in the rollback runbook after
separate authorization. New source changes require a new immutable delta/reconciliation,
not a silent replacement of this baseline. Account and field measurements remain
unavailable prelaunch evidence; future checks have not occurred.
