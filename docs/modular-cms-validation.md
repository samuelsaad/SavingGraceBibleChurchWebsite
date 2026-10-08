# Modular CMS verification — D-179

## Scope and preserved behavior

Isolated branch: `codex/modular-admin-cms`, integrated baseline `b259a16`.
Migration 0027 affects only additive CMS tables. The visitor components, existing
sermon workflows, accepted-content eligibility and closed Related themes quality
gate remain in force. No production, DNS, caption generation or external provider
operation is part of this delivery.

## Local database and browser evidence

- Exact PostgreSQL 16 loopback target verified before writes. Migration 0027
  applied; 51 entities and 46 embedded image references inserted.
- Two initialization reruns, including after administrator editing, inserted zero
  entities/assets and reported all 51 seed identities unchanged.
- Unrelated preservation fingerprint remained
  `dd89ba50cf368863836ad5afe62807cf2b6ab81c28dc31f26aac543522e43870`.
- Actual Edge dashboard demonstrated homepage text and image replacement, section
  addition/reordering/visibility, draft preview, immediate publication, ordinary
  page editing, event creation/editing, navigation/footer changes, PDF upload and
  attachment, and restoring an earlier revision.
- Changes and PDF delivery survived application restart. Three original published
  entities were restored through revision history. The demonstration event was
  unpublished with 410 address behavior; no revision or audit history was deleted.
- Desktop 1440px and mobile 390px were inspected. Fresh mobile document width is
  390px; the closed drawer is offscreen and keyboard open/Escape behavior works.
- No JavaScript errors occurred in the ten-workflow demonstration or restore pass.
- Independent Impeccable review requested explicit pending-publication state,
  immediate visibility labels and focus continuity. Browser assertions passed for
  all three; its verdict pass scored those fixes resolved and returned `ship` at
  that scope. The inherited visual system is retained.

## Gates

The complete PostgreSQL suite passed 1,226 tests with zero skips before the final
edge-case fixes. Later full rerun and release results are appended below; partial
runs do not establish the final gate. Migration tests cover empty apply/down,
clean reapply, idempotent seed behavior, populated rollback refusal and relational
constraints. API tests cover role/CSRF, stale updates, exact revision publication,
route ownership, draft-only assets, MIME/path integrity and persistence.

`npm audit --offline --audit-level=low` reported zero cached vulnerabilities.
`npm run migration:dry-run -- --input tests/fixtures/dry-run.json` passed with
anonymized fixtures. The Astro build produced 45 pages. Live browser authentication
initially failed because no-referrer policy produced Origin:null; same-origin
policy now preserves the native form Origin while null/cross-origin requests are
still refused. A native browser regression covers this.

Other resolved regression findings included optional controls for missing fields,
empty collection item types, old URL redirects/navigation availability, curated
sermon modules on posts, and detail routes whose listing index is unpublished.
One Windows encoding conversion was reversed exactly and the affected 25 church
render/source-preservation checks passed. Original failure logs remain private.

## Reproduction

Use `tests/helpers/cms-dashboard-browser.mjs exercise` and then `restore` across
an application restart. It requires `CMS_BROWSER_WRITE=1`, accepts only the
explicit loopback local/protected staging ports, stores evidence under ignored
`private/cms-verification`, and reads a protected staging key file only when
needed. Set `PLAYWRIGHT_MODULE` to the installed module if normal resolution is
unavailable. Never commit the private baseline or session material.

Publication is scoped to the current local/restricted staging application.
Church-owned production sign-in, production rollout and human Related themes
quality approval remain separate tasks.


## Implementation release gate

The final guarded PostgreSQL run passed **1,241 tests in 126 files, zero skips**;
its generated test database was removed. The final standard run passed 1,101 tests,
with 142 database cases explicitly skipped there and covered by the
zero-skip PostgreSQL run. The additional giving-module heading/unique-ID rendering
checks passed as part of the final database-backed full suite.

Existing sermon administration was also checked in the actual CMS browser:
review workspace, sermon library and speaker management loaded, and visitor
archive, search and Bible-book routes returned successful private/non-indexable
responses with zero API or browser errors. No sermon state was changed.

Both outgoing scanners passed before packaging. The supplemental scan covers
changed source, public build and staging build, exact approved dataset scope,
excluded credential/source/path classes and normalized 16-word matches against
current read-only local transcript/summary/Q&A content. Exact pre-existing church
quotations are allowed only through hashed baseline source/build/route lineage;
this is bounded content matching, not a guarantee against all possible secrets.
Offline dependency audit relies on the locally cached advisory information.

## Configured staging delivery receipt — 8 October 2026

Both existing staging applications are healthy at implementation commit
`7b411d957d6b468f6d9b1bffa8e21efe40d4de2d`, image
`sha256:53bef03bba2c58e5e88c3415c7a41dc584e2336c91bebdb4121e9d4e55f848fd`.
The source archive SHA-256 is
`015fe51a88690ddb4c75ff7a324e1ae20b878bbb1e9413724e602aecb82e0da8`;
the runtime archive SHA-256 is
`8c38a2e29b1729dc3135f94019e9b0e3a0266ee873b0a20a4e720321fcb3d58a`.
The fixed 69-file runtime/admin/migration manifest passed exact hash, source
closure, privacy-scan binding and canonical migration-byte verification.

The offline copy-only image used the already cached pinned Node base with network
and pulls disabled. Initial source-build preparation stopped safely on unavailable
offline package cache before app/database changes. Runtime packaging subsequently
resolved a Windows archive-pipe limit and canonical LF-versus-CRLF mismatch without
relaxing byte/hash checks. Failed attempts and recovery material remain private.

The compatibility bridge and both candidate canaries passed. Migration 0027,
51 stable seed identities and 46 embedded asset references initialized successfully.
An immediate identical rerun and a later rerun after browser editing/restoration
reported migration unchanged, zero entity/asset insertions and all 51 seed records
unchanged. The final CMS state has 52 entities, 66 revisions, 97 route records,
46 published entities and one retained verification upload. The extra event remains
unpublished; no demonstration history was deleted.

Actual Edge demonstrated all ten requested workflows on protected staging, with
zero console errors. The first add-module check exposed a harness timing race:
the dialog had closed before the asynchronous form replacement completed. It was
corrected to await the increased module count, and the complete workflow then
passed. Only a draft had changed during the stopped attempt; original published
revision targets and failed-attempt evidence were retained. The synchronized
helper is now the tracked reproduction helper.

A real rollback to the compatible bridge, health verification, reactivation and
second health verification preserved CMS row SHA-256
`aa2eefb17fc42ca7c7321be6e9d3b6c616bf0536ae6765045b8f8fc6d3dd693a`
and upload-manifest SHA-256
`7d74c35ca096763016a119915ad9cee819d94e7f98a8cf60aebc5e6294fabbf0`.
The subsequent browser pass confirmed edited pages, event and PDF survived restart,
restored the three original published records through history, and unpublished the
verification event with 410 behavior. Final initialization preserved exact CMS rows
at SHA-256 `2534686bedce5f054f82bd44f2e97c1792abfc61270af391079af4696057e820`.

The unrelated table/sequence fingerprint stayed
`838ea680bf2cf43c08aa72941fa56c9da223ec88d1006975c0b61d5e56b7906a`
through migration, editing, rollback/reactivation, restore and the final seed rerun.
Staging retains 398 sermons and 144 ordinary published statuses; existing restricted
acceptance and visitor eligibility remain independent. Networks, bindings,
read-only roots and dropped capabilities are retained. Visitor Related themes is OFF.

Public admin/login/API requests retain their incumbent 401 denial and unpublished
preview returns 404. Protected login returns 200; unauthenticated APIs return 401
and protected pages redirect 303 to login. Session/Origin/CSRF and least-privilege
writer startup checks passed; no development identity is enabled on staging.
Temporary browser credential files were removed. Credentials, private evidence,
recovery files and uploads are absent from Git and release archives.

Final Astro check: 575 files, zero errors/warnings and six deprecation hints.
Two packaging assertions added after the zero-skip PostgreSQL suite passed in the
final 1,101-test standard run. Eight Python operator tests and twelve focused
staging/packaging tests passed. Public build (45 pages), staging build, anonymized
importer dry run, offline audit and both outgoing scanners passed. The corrected
harness was exercised in staging; the final evidence/harness-only commit does not
change the deployed runtime. Local readiness and the preserved sermon administration,
archive, search and taxonomy browser smoke also passed after the final local restart.

No church-owned production sign-in, production deployment, provider synchronization
or human Related themes approval is claimed. The privately prepared staging launcher
requires an explicit user invocation and the existing tunnel; it has been syntax
checked but was not opened interactively during automated verification.
