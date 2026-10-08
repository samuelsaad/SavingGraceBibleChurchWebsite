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
its generated test database was removed. The standard run passed 1,098 tests,
with 142 database cases explicitly skipped there and subsequently covered by the
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
