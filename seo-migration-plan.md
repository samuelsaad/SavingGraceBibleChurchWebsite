# Whole-site SEO migration execution contract

D-181 implements D-110 on `codex/whole-site-seo-migration`, starting from integrated
commit `6a5239b136e5c68211d85bd34380db9992c29ef9` plus the preserved, byte-identical
local sermon media, Q&A/transcript and directory-count refinements. Their source
worktree is untouched. Current CMS and selected visitor designs are retained.

The task permits read-only original public website/WordPress and church-owned
Search Console, Analytics and Tag Manager evidence through existing access; no
new paid service, recording download, model generation or source mutation.
Capture robots, sitemaps, host/HTTPS behavior, public links and retained inventories
with source/capture times. Verify the public domain independently of staging.
Crawl only verified church hosts, at most two concurrent requests with a global
one-second start interval, two retries, finite body/time limits and an initial
10,000-URL limit. A reached limit is an unresolved coverage issue, never completion.
Download only referenced public non-recording assets for identity and rehearsal.
Retain excluded recording URLs and failures in the ledger without fetching them.

Fresh WordPress inspection must pass SELECT/USAGE-only grants and MariaDB/database
identity before any table reads. A rejection does not authorize another credential
or weaker guard. Continue live public capture and retained-source reconciliation.
Account exports and private source bodies remain ignored; tracked evidence contains
safe URLs, identifiers, hashes, counts, dates, checks and unresolved issues only.

A separate original-public projection binds source response/body hashes, capture,
identity, canonical path, original dates, media/resources and withdrawal checks.
Imports are atomic, idempotent and compare expected prior dependencies; delta
updates cannot overwrite current editorial changes. No approval/status rewrite in
the enrichment tables is permitted. Original public content can render without
optional enrichment; only independently eligible generated material can augment it.
An absent source item requires an explicit removal/withdrawal review, never automatic
delete. All original-source application data remain in PostgreSQL and durable
protected assets; release source contains no new real-content dataset.

Use the approved local PostgreSQL 16 test target and guarded write flag. Anonymous
migration tests run in the existing guarded disposable harness with zero skips.
Stage only after source/diff/private-content/dependency scans, all relevant tests,
actual loopback HTTP comparison and a frozen release. Staging operator must verify
actual incumbent images/configuration/migration ledger, take recovery snapshots,
apply the additive migration and content bundle transactionally, canary, activate,
and verify. Demonstrate restoration without erasing changes after the snapshot.
No live WordPress or production-domain configuration is changed.

Acceptance requires a disposition for every discovered URL, correct content and
metadata or explained differences, direct equivalent redirects, crawlable discovery,
correct sitemap/canonical/robots/environment behavior, durable assets, CMS lifecycle
HTTP checks and complete source-public sermon reconciliation. Historical counts and
new-enrichment completeness are not substitutes for the current source inventory.
Missing account access, stale evidence, unmatched URLs and unresolved regressions
remain visible and can require a NOT READY verdict. Post-launch field/search evidence
cannot be claimed during staging. Final traffic/DNS actions remain for review.
