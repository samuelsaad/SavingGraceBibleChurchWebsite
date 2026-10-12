# Repeatable D-182 SEO evidence checks

Run from the SEO worktree with its locked runtime and protected existing configuration.
Commands below are prepared verification commands; the acceptance record identifies
which executions completed. All source/account bodies, credentials and private
responses stay in ignored storage. Repeating a comparator requires a fresh output
directory. Never loosen its literal-loopback guard to point it at production.

```powershell
npm test
npm run check
npm run build
npm run staging:bundle
npm run migration:dry-run -- --input tests/fixtures/dry-run.json
npm audit --offline
# Requires the exact guarded PostgreSQL 16 target and protected authentication:
$env:ALLOW_LOCAL_DB_WRITE = '1'
npm run test:postgres
python -m unittest discover -s tests -p 'seo*_test.py'
```

The source continuation is finite: reuse only the existing frozen 6,852-URL queue,
with its immutable parent/queue hashes, completed-request receipts and retry limits.
Do not start another queue to improve the acceptance denominator. New discoveries
remain explicit evidence gaps. `seo-frontier-delta.py` refuses incomplete queues,
copies hash-checked later response witnesses and preserves the earlier baseline.

```powershell
python scripts/seo-frontier-delta.py `
  --previous-baseline private/seo-baseline/d182-final-release-frozen/ledger.private.json `
  --continuation private/seo-baseline/d182-fixed-observed-frontier/ledger.private.json `
  --assets private/seo-baseline/d182-final-release-frozen/assets-final-d182.private.json `
  --bundle private/seo/source-d182-facets-local.private.json `
  --output private/seo-baseline/NEW-immutable-continuation
```

For each frozen input, run the unchanged whole-inventory comparator against the
production-policy loopback rehearsal and actual staging proxy separately. Obtain
the expected `X-SEO-Candidate` from the independently verified release/configuration
receipt; reading any header without that release binding is insufficient identity
verification. Use production mode only for the isolated production-policy runtime;
staging mode expects staging noindex and denied public sitemaps.

```powershell
python scripts/seo-verify-candidate.py `
  --baseline PRIVATE_FROZEN_LEDGER --assets PRIVATE_FROZEN_ASSETS `
  --candidate http://127.0.0.1:4447 --output private/seo-verification/NEW-production `
  --environment production --candidate-id VERIFIED_APP_COMMIT `
  --expected-runtime-label VERIFIED_RUNTIME_LABEL `
  --request-limit 50000 --concurrency 4 --timeout 30
```

An exit code of 1 means failed acceptance with recorded findings, not success.
Configuration/integrity errors and missing response witnesses also fail acceptance.
The final certified-cache wrapper verifies the parser, source ledger, parsed cache and
25,292 source file witnesses before/after; it never reuses candidate HTTP responses.
Private paths for the completed executions are retained in the acceptance record.

```powershell
python scripts/seo-export-acceptance.py `
  --baseline PRIVATE_FROZEN_LEDGER --assets PRIVATE_FROZEN_ASSETS `
  --candidate PRIVATE_HTTP_RESULTS --bundle PRIVATE_SOURCE_BUNDLE `
  --output private/seo-acceptance-NEW
python scripts/seo-reconcile-continuation.py `
  --previous PRIVATE_EARLIER_SAFE_EXPORT --continuation PRIVATE_LATER_SAFE_EXPORT `
  --proof PRIVATE_FRONTIER_PROOF --output private/seo-acceptance-NEW-reconciled
python scripts/seo-original-cohort-accounting.py `
  --original docs/seo-history/d181-seo-url-migration-map.csv `
  --candidate docs/seo-url-migration-map.csv `
  --output private/seo-verification/NEW-original-cohort.json `
  --details private/seo-verification/NEW-original-cohort.csv
python scripts/seo-recheck-original-targets.py `
  --original private/seo-candidate/download-links-final-production/internal-targets.csv `
  --candidate http://127.0.0.1:4447 `
  --expected-runtime-label VERIFIED_RUNTIME_LABEL `
  --output private/seo-verification/NEW-original-targets
```

The original-cohort command refuses a denominator other than 15,252 or a missing
original URL hash. Its metadata/block cohorts use the original **unreviewed** issue
sets (2,709/2,767); raw original findings are retained separately. Categories overlap.
The original-target command independently checks every one of the 975 targets,
including targets absent from current navigation. Successful HTTP does not prove
content equivalence. The continuation reconciler retains every earlier row and
records the exact later-evidence update, including any worse outcome.

Protected browser programs use the existing staging operator session, block external
providers and telemetry, and verify actual published body/SEO responses. Select an
entity whose initial draft and published pointers match; never publish a pre-existing
private draft. Restore the exact initial revision through audited history after each
cycle. Inspect and restore any interrupted test before whole-site comparison.

The guarded deployment operator uses only committed, checksum-pinned helpers. Its
sequence is inventory/recovery, finished-package scan, transfer, prepare, bridge
canary/activation, migration and exact replay, source canary/activation, verify,
compatible feature-off rollback, reactivation and verify. Wait for the completed
package receipt before transfer. Reuse neither an older schema-incompatible image
nor a mutable uncommitted operator. See the staging and recovery runbooks.

Do not replace missing account evidence with lab measurements, stub telemetry or a
successful backup listing. Record Search Console/Analytics captures, final WordPress
coverage and WordPress restoration separately. Production activation remains a later,
explicitly authorized operation.


The final visitor allocation check uses the existing 384 MiB heap limit, real frozen
source data and explicit loopback. A working-code diagnostic uses a placeholder
identity and cannot establish release acceptance. Freeze the code, independently
compute the release/database/policy label, and rerun the complete comparison after
any render change. Never reuse a superseded candidate's HTTP response witnesses.
Schema/hash validation still covers every source input; temporary wire strings and
non-sermon parse copies are released rather than retained as duplicate inventories.

Private evidence/release archives are excluded from test/type discovery. Application
tests use four workers with unchanged assertions and timeouts. All tracked 153 test
files remain included; PostgreSQL execution requires zero skips. Preserve any failed
concurrent-run logs and disclose the exact final successful commands.

## ECA release and fresh comparison requirements

The final application is `eca390a021a979eab404ff6dd787e1f9b2160461`. Production-policy local verification uses explicit loopback port 4448; sealed staging verification uses the task SSH loopback path on 4450/4451. The ordinary dashboard on 4430 belongs to the user's existing work and must remain untouched. The final expected labels must be independently calculated from the exact code/image, database dependency state and environment policy.

Use a fresh private output for every comparator run. Require exactly 21,134 checked rows, a complete internal-target report, every original 15,252 URL hash, and before/after plus per-read source/candidate witness verification. A partially populated report that includes placeholder rows does not count as complete. A matching runtime label proves release provenance, not equivalent content or source completeness. Retain all unresolved findings and prior failures.

The immutable-source allocation change keeps editor/default content trees independent and visitor event metadata separate. It must not remove source validation, change review/publication states or replace source-backed content with generated enrichment. The ECA test suite has 154 files and 1,422 PostgreSQL cases with zero skips; three anonymous tests cover immutable visitor rendering and editable-tree isolation.


## Final A257 verification supersedes earlier pending checkpoints

Application `a257de54b54c29ce3fc5a8fcdce73e954dcafa31` and image `sha256:93e7c5949adf60d97d7506892a4200986830bf9ec614bd749c0f8ceb58bac4cd` are the verified source-enabled staging candidate. Both canaries require 12 actual homepage renders at explicit 512 MiB V8 heap within unchanged 768 MiB containers. Four 18-response proxy matrices, compatible rollback/reactivation, three exact CMS body/SEO revision cycles, 1,946 resources on each runtime and the complete 21,134-row proxy crawl completed. The verdict remains NOT READY; consult `seo-final-staging-acceptance.summary.json` and `seo-migration-acceptance.md`. Earlier failures and smaller releases above remain historical evidence. Exact Git blob packaging and all 56 SQL migration bytes match. No production traffic/DNS or WordPress mutation occurred.


Current completed private runs: local `private/seo-verification/ph`, staging `private/seo-verification/sg`; local resource/browser/target outputs `rpg/bpg/tpg`, staging `rg4450/rg4451/bg/tg`. CMS proof is the three-type `d182-final-a257de5-staging-cms-browser-v3.private.json`; final recovery is `private/seo-recovery/staging-a257de5-final`. These names identify private evidence and carry no source bodies into Git. Repeating must choose fresh outputs and rederive labels from actual current state.

```powershell
python private/seo/compare-cached-frontier-sharing-retry.private.py --baseline private/seo-baseline/d182-final-frontier-frozen/ledger.private.json --assets private/seo-baseline/d182-final-frontier-frozen/assets-frontier-final.private.json --candidate http://127.0.0.1:4447 --environment production --candidate-id a257de54b54c29ce3fc5a8fcdce73e954dcafa31 --expected-runtime-label VERIFIED_CURRENT_LABEL --request-limit 50000 --concurrency 4 --timeout 30 --output private/seo-verification/NEW-a257-production
python private/seo/compare-cached-frontier-sharing-retry.private.py --baseline private/seo-baseline/d182-final-frontier-frozen/ledger.private.json --assets private/seo-baseline/d182-final-frontier-frozen/assets-frontier-final.private.json --candidate http://127.0.0.1:4450 --environment staging --candidate-id a257de54b54c29ce3fc5a8fcdce73e954dcafa31 --expected-runtime-label VERIFIED_CURRENT_LABEL --request-limit 50000 --concurrency 4 --timeout 30 --output private/seo-verification/NEW-a257-staging
python scripts/seo-classify-inventory.py --input docs/seo-url-migration-map.csv --output private/seo-verification/NEW-classification.csv
```

The certified cache wrapper delegates to the tracked comparator unchanged and checks every frozen source witness before/after and each candidate response. Its Windows retry is restricted to transient sharing errors; it never accepts a missing or changed witness. The tracked `scripts/seo-verify-candidate.py` command above remains the portable uncached rerun.
