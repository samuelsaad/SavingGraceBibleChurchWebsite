# SEO post-launch monitoring

Prepared under D-181; no future monitoring is claimed and no recurring automation is installed. Baseline: dated source ledger and `seo-source-baseline.md`; release: `seo-migration-acceptance.md`. Responsible operator: Samuel or a named delegate recorded at final approval, with a church account owner for Search Console/Analytics. Store account exports and incident details privately.

| Window | Execute and compare | Response |
| --- | --- | --- |
| Immediately after activation | Exact public hostname/TLS; critical landing pages; redirect inventory; actual404/410/5xx; canonicals, robots, sitemap and private boundaries; image/PDF MIME/hash; mobile navigation and controlled media | Halt acceptance; use runbook rollback for broad failures, leaked drafts or wrong-content routing. Record affected URLs and release. |
| First24hours, several checks | Availability, proxy/application errors, source-ledger redirect/asset samples and all newly reported failures; verify production measurement once and no staging pollution | Fix exact routes/content, retain historical aliases, rerun complete affected checks; escalate widespread errors. |
| Daily in week1 | Search Console sitemap processing/indexing exclusions/canonical selection and crawl errors; analytics organic landing pages; unexpected404/5xx and media/asset errors | Compare exact affected URLs with source baseline. Distinguish old source defects from new regressions. No bulk irrelevant redirects. |
| Several times in weeks2–4 | Organic clicks/impressions/CTR/position and landing-page sessions, using matching weekdays and comparable28-day periods; valuable queries, backlinks and indexed canonical URLs | Investigate sustained changes by page type, query and device; inspect live status/canonical/content/discovery. Do not attribute every fluctuation to migration or promise recovery dates. |
| Weekly through stabilization | Mobile field LCP/INP/CLS, availability, newly orphaned pages, CMS slug/publication changes, sitemap freshness and all remaining WordPress-hosted resources | Resolve regressions, verify CMS redirect chains remain flattened, and keep recovery systems until formal acceptance. |

Executable starting commands for the protected candidate are documented in `seo-migration-acceptance.md` and `seo-staging-deployment.md`: full inventory comparator, browser matrix, deployment verify, and read-only inventory. The comparator refuses external origins; production checks must use a separately approved proxy/tunnel setup and verify public DNS/TLS independently. Freeze each new report with UTC capture time and release identity.

Search account baselines are unavailable unless subsequently provided; do not fabricate zero clicks, complete indexing or historical Core Web Vitals. Candidate browser timing is lab evidence only. Good field targets at the75th percentile are LCP≤2.5seconds, INP≤200milliseconds and CLS≤0.1. No claim of field acceptance can be made before representative real-user data exist.

A successful technical migration cannot guarantee identical rankings during recrawl. Preserve redirects and investigate observed evidence; do not mass-rewrite content in response to short-term noise. [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals), [site-move monitoring](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

## Rerunnable verification commands

Use a fresh ignored output directory for every run. Supply the protected frozen ledger/assets paths and require the runtime label returned by the bound release. Both commands refuse non-loopback destinations; verify actual public DNS/TLS separately after authorized cutover.

```powershell
python scripts/seo-verify-candidate.py --baseline private/seo-baseline/sx13/ledger.private.json --assets private/seo-baseline/sx13/assets.private.json --candidate http://127.0.0.1:4447 --environment production --expected-runtime-label <verified-label> --concurrency 4 --timeout 60 --request-limit 50000 --output private/seo-candidate/<fresh-run>
python scripts/seo-verify-candidate.py --baseline private/seo-baseline/sx13/ledger.private.json --assets private/seo-baseline/sx13/assets.private.json --candidate http://127.0.0.1:4450 --environment staging --expected-runtime-label <verified-label> --concurrency 4 --timeout 60 --request-limit 50000 --output private/seo-candidate/<fresh-staging-run>
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


Final prepared release: `d068c2214e2d53b6c50de4788305acaf7fa052ed`, image `sha256:cfdcd574a493753c73a349da9710fd44f489a07d4dbde3562c7029132201b2ff`. The immutable source baseline remains 23,017 URL observations retaining all original 15,252. Final local/proxy crawl, exact revision restoration and actual staging backup recovery are immediate technical evidence only. Future Search Console, organic-traffic and field-performance monitoring has not occurred. On launch-day approval record Samuel or a named release delegate and a verified church account owner, then execute the full inventory checks and the dated account/device/query comparisons above. Any leaked draft, canonical-origin error, production noindex, critical 5xx or wrong-content redirect triggers immediate operator review and the retained rollback runbook.


Run all checklist commands with UTC timestamps, responsible operator and exact release.
Use `scripts/seo-recheck-original-targets.py` for the original 975-target cohort and
`scripts/seo-original-cohort-accounting.py` for fixed/reclassified/remaining accounting.
A protected candidate's noindex and denied sitemap are expected only in staging;
production-policy acceptance requires the separate loopback rehearsal and real public
DNS/TLS/headers after later authorized activation. The existing whole-inventory
verifier is the executable monitoring check; it reports failures with nonzero status.
For a reported production incident, save the exact public response and compare the
frozen source row before changing disposition. Never run a broader crawler or new
external telemetry provider merely to fill missing Search Console history.
