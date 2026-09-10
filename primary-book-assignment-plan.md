# Explicit primary-book assignment — applied and awaiting human review

The additional local metadata task follows the completed title repair. It does not
reopen enrichment processing or authorize content approval or publication.

## Confirmed diagnosis

The inspected collection contains 155 sermons. The original 15 retain 14 confirmed
primary passages and one confirmed no-primary decision. The later 140 have no
primary-passage review records: the earlier preparation tool was bounded to the
original 15, and the later batch importer did not prepare those relationships.

The private frozen plan contains 130 unambiguous references from preserved source
titles, 15 preserved human decisions, and 10 unresolved missing-evidence outcomes.
No assignment relies on the now-normalized application title. No sermon prose is
read for this operation.

## Implemented safeguards

- Exact canonical-book aliases, numbered books, book-only references and validated
  ranges share one resolver. Ambiguous, conflicting or invalid evidence remains
  unresolved. Existing human choices, including no-primary decisions, win.
- The collection command freezes an ignored metadata plan, rechecks current
  identity/version/evidence/progress under row locks, records concurrent edits as
  conflicts, and uses the existing guarded local transaction and audit pattern.
- New title-backed passages remain proposed. Missing-evidence records receive a
  pending manual-review entry, not an invented book or human approval.
- Batch insertion prepares this metadata only for a new, already-authorized import;
  an unchanged old import does not replay preparation or reopen a consumed batch.
- Legacy source mapping resolves exact passage fields, retains their original text
  and sources, and refuses replacement of editorially owned passage relationships.
- Normal explicitly primary administrator metadata resolves a missing book without
  inventing coordinates. Pending manual metadata is visible in the existing form;
  confirmation remains a separate attributed administrator action.
- No schema, canonical catalog, source receipt, content body, slug, or frontend
  design change is included.

## Execution boundary and verification

Execution safety initially rejected the application command before process
creation because passage/review writes exceeded the title-only authorization.
Samuel subsequently and explicitly approved the saved 130 assignments and ten
pending unresolved reviews, preserving the 15 human decisions. The rejected
operation was not bypassed; the newly authorized command passed execution safety.

Immediately before application, all 155 saved identity/evidence/version hashes
matched, with zero conflicts and no prior assignment receipt. One guarded
serializable transaction persisted 130 exact title-backed primary proposals,
ten pending `no_reference` review records and 140 system audit events. All 15
existing human decisions were unchanged. No new human reviewer or approval was
recorded. Existing passage text/ranges, title corrections, source evidence,
content and guided-review progress were preserved.

The identical second operation returned 155 unchanged and zero changes. Complete
table and audit hashes matched the first application's receipt without version,
timestamp, relationship or review churn. Independent read-only verification
confirmed all 130 new coordinates, 140 unapproved pending reviews, 15 unchanged
human-decision metadata hashes, 130 preserved title corrections, 22 unchanged
clean titles and three unchanged ambiguous titles. Counts remain 155 sermons,
143 pending Stage-1 reviews and 12 completed private previews.

Pre-application verification: focused book/title tests 38 passed; full standard
suite 377 passed with 31 database tests intentionally skipped; full guarded real
PostgreSQL suite 408 passed with zero skipped; Type/Astro checks 182 files with zero
errors, warnings or hints; production build passed; anonymized dry run 5 inputs,
3 included, 2 excluded, 0 rejected; cached offline dependency audit reported zero
vulnerabilities. Initial SQL/typing and anonymized fixture-setup defects were fixed
before these passing results. The migration rollback safeguard was not weakened:
the fixture now explicitly proves that it refuses removal of primary metadata
before resetting only its anonymized fixture designation for the rollback test.

These automated-suite results apply to the unchanged implementation; the later
authorized database application and idempotency evidence above are separate from
fixture tests. Administrator confirmation remains necessary for every new passage,
and the ten missing-evidence cases remain unresolved. The private comparison and
receipt are ignored and unstaged. Do not rerun `plan` or replay title correction.
Existing administrator forms must not be reloaded over unsaved human edits.

Post-application reruns also passed: 377 standard tests (31 deliberately gated),
408 real PostgreSQL tests with zero skips, Type/Astro checks with zero diagnostics,
production build, anonymized dry run and offline dependency audit. The disposable
test database was removed by its guarded runner. Read-only browser checks in a
separate authenticated tab confirmed populated normal and numbered-book proposals
survive reload, and missing-evidence cases remain blank and pending after reload.
The existing filters show 130 proposed and ten unresolved entries. No review or
approval control was submitted. The optional broad book-classification field is
separate from this Primary preaching passage association and was not backfilled.

All 140 affected public API detail requests returned 404; public listing, keyword,
book and structured passage discovery returned empty 200 responses. Unauthenticated
admin API and preview requests returned 401. The queue remains private/no-store/
noindex; the completed-preview eligibility query returns 12, public eligibility
zero. Feed and sitemap endpoints remain absent (404), not evidence of production
launch readiness. The verified local review queue is `/admin/sermons`; its
`passageReviewState=pending_review` filter exposes the ten unresolved cases privately.

The existing review queue remains running. A separate attempt to start a fresh
updated-backend server was rejected because its local test-identity setting was
considered an authentication bypass. It was not retried or bypassed. Browser
persistence checks used the existing server; updated backend create/edit/import
behavior passed the automated suites. A fresh server launch remains blocked
pending resolution of that authentication objection. No authentication rule was
weakened. Final repository/build/private-content and credential scans passed.
