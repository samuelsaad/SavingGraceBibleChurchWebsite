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

The deployment operators' 36 offline checks pass, including image drift refusal
before execution, no image pulls, restoration after post-start failure, and exact
incumbent secret-file identity checks.
Anonymized importer dry run and offline dependency audit pass (zero cached
vulnerabilities; this is not a fresh online advisory audit). Outgoing scanners
verify source/runtime closure, secrets, excluded paths, symlinks, private sermon
body matches and the unchanged approved 15 + 279 + 119 dataset scopes.

## Delivered release and protected staging evidence — 9 October 2026

Branch: `codex/visual-page-editor`. Running implementation:
`e8892c08eb1ea26e9675c8af87ebefef9866699d`. Both staging applications use image
`sha256:2760ce944f9393cde4388a2fe6e1ed5aba108a4f8ac48ad3dbcb41558c2462cc`.
The normal GitHub push was independently verified against that commit. The final
documentation commit follows it and changes no runtime code.

The fresh committed source archive contains 299 paths, SHA-256
`c6af3338fa23386f41a235fc1ead1d5aa71031501e7cf78a8e133b472cbc3a83`.
The runtime archive contains 69 runtime/admin/migration files, SHA-256
`a66bd22eb6cf47c7665e3e144199f19f631c4968f15fda146bc6b177c573932a`;
its manifest SHA-256 is
`0a7f5930e6f7df74e71d8a1fe04d0a65e8f3e4562d516634097a911125eeab94`.
Outgoing CMS scans passed 228 source/build files and retained the 413 existing
approved dataset entries across the 15/279/119 historical scopes unchanged. No new
private body, secret or excluded-path finding was introduced. Packaging and the
remote copy-only build used the existing cached dependencies and pinned image.

Initial staging inventory retained 52 entities, 66 revisions and 47 assets.
A preflight correctly stopped before deployment on an overly strict reader-secret
permission assumption. Read-only inspection established the incumbent reader's
exact 0440/UID1000/GID0 identity beneath a root-owned 0700 parent; CMS credentials
remain exactly 0400/UID1000/GID1000. The narrow correction binds and rechecks file
hashes, owner/group/mode, root-parent identity and symlink-free ancestors at every
phase. Unknown or duplicate secret keys are rejected. Independent review and all
36 operator checks passed; no credential or permission was changed.

Pinned transfer, offline prepare and both canaries without host ports passed.
Both application upgrades passed health, immutable image/configuration and
preservation checks. Browser verification then passed all nine requested flows
on the real staging canvas: inline text, actual selected/rendered image identity,
add/duplicate/exact section ordering, undo/redo and visibility, desktop/mobile
preview, draft save/reopen, exact-revision publication, history restoration and
keyboard editing/undo. The initial editing exercise reported zero console errors.
Draft content remained absent from the published website until publication.
A fresh browser session after rollback/reactivation confirmed persistence.
A stale-version PUT returned 409 with the complete entity unchanged.

The public staging listener independently showed the published demonstration and
then its restoration. Public output had no editor markers; admin/API access stayed
401 and private preview/frame routes stayed 404. Protected anonymous API/frame
requests were denied, the administrator page redirected to sign-in, and the login
page remained available. Session isolation, CSRF rejection and frame headers passed.

The 67-revision post-edit CMS snapshot had SHA-256
`08a36e64dbad45ce9450efc53fc4975370f1486ad2df7a380a324431a5ba33e1`.
It remained identical after application rollback to the prior image and after
reactivation. The upload manifest remained
`7d74c35ca096763016a119915ad9cee819d94e7f98a8cf60aebc5e6294fabbf0`.
Existing immutable revisions, asset/audit rows and unrelated tables were preserved.
The original draft and published homepage content was restored through new
immutable history rather than deleting the demonstration or rewinding the database.

Final staging counts: 52 entities, 68 revisions, 97 routes, 46 published entities,
47 assets, 81 CMS audit events and one existing 413-byte uploaded file whose bytes match its
content-address hash. Schema ledger 27 and the existing 398 sermons/144 ordinary
published sermon statuses remain unchanged. Related themes remains OFF. Existing
credentials, asset mounts, networks and listener bindings were retained.
Local restart verification independently retained 52 entities and 47 assets with
identical before/after hashes on the same e8892c0 release.

The final restored CMS snapshot has SHA-256
`432643a6bef66a096bc17205ec4d417a3a199ceda4cf5cc3454985ad35246b80`;
the snapshot changed through the ordinary demonstration and restoration
operations; two revisions and four CMS audit events were appended.
The unrelated-data hash remained
`838ea680bf2cf43c08aa72941fa56c9da223ec88d1006975c0b61d5e56b7906a`.
Temporary canaries, browser contexts and credential directories were removed.
The owned verification-only loopback 4396 SSH tunnel was identity-checked and
closed. Future protected staging access requires reopening the approved tunnel.
The requested local dashboard remains on loopback 4430.

## Reproducible verification commands

| Command | Recorded outcome |
| --- | --- |
| `npm test` | 1,135 passed; 142 database-gated cases covered by the guarded suite. |
| `npm run test:postgres` with the guarded local write gate | 1,277 passed across 131 files, zero skips; disposable database removed. |
| `npm run check` | 580 files, zero errors/warnings, seven existing/deprecation hints. |
| `npm run build` | 45 public pages built. |
| `npm run staging:bundle` | Runtime/admin bundle built. |
| `npm run migration:dry-run -- --input tests/fixtures/dry-run.json` | Anonymized importer dry run passed. |
| `npm audit --offline --audit-level=low` | Zero cached vulnerabilities; no fresh advisory lookup. |
| `python -m unittest discover -s tests -p "cms*deployment_test.py"` | 36 passed. |
| `node deployment/package-release.mjs` and `node deployment/package-cms-runtime.mjs` with protected output/scan configuration | Exact committed source/runtime closure and privacy scans passed. |

Private screenshots, source snapshots, session material and detailed logs remain
ignored. No production deployment, production authentication or live WordPress
publication is implied; the exact remaining connection is documented separately.
