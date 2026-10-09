# Visual editor validation — D-180

The editor extends the existing CMS without a database migration or new dependency.
Its authenticated, CSRF-protected transient frames use the actual frontend
renderers and current eligible sermon repository. Ordinary visitor output carries
no editor markers. Forty-seven homepage/page/post/event documents were byte-for-byte
identical to the incumbent renderer when new optional presentation fields were absent.

## Local browser evidence

The nine requested workflows passed in Edge: open an existing page, edit actual
text, replace its image, add/duplicate/reorder/hide sections, preview device widths,
save/reopen, publish and verify the website, restore a revision, and keyboard
selection/editing/movement/undo. Saved and previewed drafts left published content
unchanged. A concurrent writer caused a version conflict, retained unsaved edits,
and required explicit reload. Original published demonstration content was restored
through immutable history. No sermon content or review decision was edited.

The runtime was restarted against the same PostgreSQL database and persistent
uploads; saved content remained. Desktop 1600px and mobile 390px captures showed
no horizontal workspace overflow. The mobile inspector is anchored to the work
area and provides focus entry, containment, expanded state and return. Image/link
pickers passed backwards tabbing, Escape isolation and return to their drawer control.

Pointer dragging with a visible insertion cue, nested block keyboard reordering
with focus retention, responsive two-column panels, contextual link destinations,
and section removal/undo also passed. The final type check reports zero errors,
zero warnings and seven existing/deprecation hints; the public build produced 45
pages and the staging bundle completed. “Original spacing” preserves the existing
section CSS rather than imposing a new padding value.

## Design review

The single detector pass returned no findings. A fresh Impeccable reviewer requested
mobile drawer geometry and focus corrections. After correction and recapture, its
final disposition was **ship**, scoped to the two listed fixes. A fresh documenter
updated the surface brief while retaining DESIGN.md and its token sidecar. Existing
website imagery is reused; no raster was generated or replaced.

## Automated and security verification

Focused tests cover exact content paths, hidden sections, nested layouts, normal
output isolation, bounded history, deep duplication, safe paths, session/CSRF/frame
isolation, stale versions, cache limits and request-local eligible query reuse.
Every new render rechecks sermon eligibility; results are not cached across POSTs.
The browser queues preview changes so obsolete requests cannot accumulate.

The standard suite passed 1,135 tests, with 142 database-gated cases covered by the
separate guarded PostgreSQL suite. An earlier complete PostgreSQL run passed 1,273
tests with zero skips. After four request-reuse tests were added, one concurrent
run hit an existing five-second integration timeout and seven cascading fixture
failures. That run was retained, its exact disposable database removed, and an idle
rerun passed all 1,277 tests across 131 files with zero skips. Its exact disposable database was removed. No test timeout or assertion was relaxed.

The deployment operator's 31 offline checks pass, including image drift refusal
before execution, no image pulls, and restoration after post-start failure.
Anonymized importer dry run and offline dependency audit pass (zero cached
vulnerabilities; this is not a fresh online advisory audit). Outgoing scanners
verify source/runtime closure, secrets, excluded paths, symlinks, private sermon
body matches and the unchanged approved 15 + 279 + 119 dataset scopes.

Final release check counts, commit/image identities, protected staging browser
results and rollback/reactivation receipts are appended only after execution.
Private screenshots, source snapshots and detailed logs remain ignored.
