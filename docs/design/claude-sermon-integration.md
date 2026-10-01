# Claude sermon presentation within Astra staging

## Sources and scope — 1 October 2026

Destination: `frontend/astra-impeccable-staging`, initially
`98d406eb3b84f5c85281ae77b58a4443a8449742`.
Claude reference: `frontend-church-site` at
`6a51443d117cc9cb20e82f8d50046f77e7a4aa08`; final V4 originated at
`30396937f78b1bab38399cedbcc0e9a22361a367`.
The original source branches/worktrees are preserved.

Only V4 and the stable sermon-detail composer opt into `.claude-sermons`.
Claude's palette, literary system typography, finder, folded bookshelf, card
plates, reading column, transcript and ordered Q&A presentation are scoped inside
that body. Shared Astra tokens, core, homepage, church pages, home cards, logo,
imagery, header/footer design and enhancement scripts are unchanged.
The only shell adjustment sends the existing main Sermons link/double-click to
V4. No menu item, version alternative, route or redirect was introduced.
Existing alternate URLs remain available without being restored or promoted.

The current repository projections, API contracts, query/canonical rules,
eligibility selectors, CSP hashing, access restrictions and private draft
notices remain authoritative. No older Claude backend file was copied.
Existing small-screen player, transcript-wrapping and rail-grid safeguards were
retained. No sermon, review, acceptance, migration or database write is involved.

## Implementation verification

- Focused frontend/preview/staging checks: 59 passed before final existing V4
  assertions were updated; the full standard rerun then passed 811 tests.
- Final focused rerun including V4 and public routing: 86 passed, zero skipped;
  seven anonymized staging-network tests passed.
- Full standard suite: one unchanged pre-existing admin-dashboard-layout
  assertion failed; 126 PostgreSQL cases remained intentionally gated.
  This frontend-only task does not claim database-write testing.
- Astro/type check: the sole existing optional-property mismatch remains at
  `src/development-data/project-sermon-snapshot-cli.ts:38`; no new error,
  warning or hint remains.
- Static build: 44 pages; all six sealed staging bundle entries built.
- Cached offline production-dependency audit: zero vulnerabilities.
- Anonymized importer dry run: five inputs, three included, two excluded,
  zero rejected; no database connection.
- Anonymous visual inspection at desktop 1440 and mobile 390 pixels:
  restored serif headings, folded shelf, equal-card heights, no overflow.
  Screenshots contain fixtures only, never real sermon prose.
- Thirteen exact source hashes protect unchanged church presentation,
  typography, home cards, routes and sermon enhancement scripts.
- Live pre-deployment rendering captured private hash-only baselines for
  representative church pages and shared shell at two viewport widths.

## Deployment and rollback boundary

Previous working release:
`ba52ae3c96a5f0cc093c50b0117b1a702635c84f`.
Image: `savinggrace-impeccable:ba52ae3c96a5f0cc093c50b0117b1a702635c84f`.
Image ID:
`sha256:143af5e00890347a8a953e01de2017205ae1d24e421e049991262989e92802f8`.

Before application replacement, retain protected resolved Compose rollback
configurations and metadata-only database/inventory fingerprints. Replace only
each `app` via `docker compose ... up -d --no-deps app`; never touch its
database, proxies, volumes, ports, credentials or migrations. Readiness failure
restores the previous application configuration/image immediately.

Public staging stays at `http://54.253.237.138:8080/`; protected staging stays
on EC2 loopback 8082 through the pinned SSH mechanism. Both existing inventories
must remain exactly 148 with membership hash
`4bf7dbdb97d7ef98e9dd1aa9153f0e04c977776f08e0ba0a420fb266304f1731`.
Public/protected whole-database fingerprints and private-route denial must be
identical before/after. Deployment/browser/push outcomes are recorded after
execution, never inferred from the build.

## Actual staging application — 1 October 2026

Both application containers serve integration commit
`2245fa7f11f3b342d11d81258182c6c20854ef0e`, image
`savinggrace-impeccable:2245fa7f11f3b342d11d81258182c6c20854ef0e`,
image ID `sha256:b2c61df39b958774e0c2eaf02d1bf82e4ed4c0ecc267cd46026322608821d308`.
Both Docker health checks and matching release readiness passed.
The 209-path dependency-closure package was independently verified after transfer:
SHA-256 `fb5acf4c9688da850d5d02ba46c92c6e00088f8181754577e6f840460c5f8450`.
The package excludes datasets, private artifacts and local configuration.

Before/after whole-database/table/sequence fingerprints match:

- Public: 191 sermons, 21 migrations, 47 tables;
  `7a6a1e2022e7971ab5401d2b21d27c826f9f06e535fb93b58021c48a64349ecf`.
- Protected: 148 sermons, 22 migrations, 49 tables;
  `88723be3b21d75e0efd0affff285e702cbd5c46d7fdb3d107af3fae0dc36fce9`.

Both retain 144 published records/timestamps and exactly 148 eligible identities.
Database container IDs, original configuration hashes and listening sockets are
unchanged. Admin, private API, frontend/draft preview and private-file routes remain
denied with no-store/noindex. No migration, content/decision edit, data transfer,
production access, listener change or proxy change occurred.

All 16 live DOM/style/geometry preservation comparisons passed for Astra's
homepage, representative church pages and shared shell at 1440/390 pixels.
The permitted main Sermons destination change is normalized in that comparison;
sermon-page footer position is excluded because its content height changes.
The actual book-filter route independently returns the scoped open-book page
with unchanged privacy headers.

Final live Chrome checks passed on both runtimes: 32 rendered cases each at
1440/390/320 pixels as applicable, with one h1, no overflow or broken loaded
images, and retained no-store/noindex and metadata exclusion. Desktop/mobile
navigation, keyword search, speaker filtering, bookshelf disclosure, book/chapter
selection, recent pagination, eligible detail, transcript toggles and ordered Q&A
passed. Media activation was verified against a locally fulfilled inert iframe;
no audio/video or provider request was made. Five representative assets passed
per runtime. Console errors, failed requests and erroneous responses were zero.
An initial book-picker assertion lacked a response/DOM wait; explicit navigation
and visibility waits passed on rerun without changing application behavior.

Only this task's anonymous QA server, browser contexts and temporary test tunnel
were stopped after verification. Both application services remain running.
The recorded rollback pair is retained; no rollback was required by this rollout.

The outgoing audit inspected 1,727 history blobs and 60 build text files:
zero prohibited history paths, detected private/cloud/Google keys, symlinks or
sermon-content build matches against 7,419 protected shingles. The 17-file staged
integration scan found zero prohibited paths, secret/token/key or private-content
findings. No new sermon body, raw source, identity manifest or credential was added.

GitHub publication is still pending: AGENTS section 7 confines the existing
dataset-bearing history to a different named branch. This task has not amended
that permanent boundary or attempted an alternate publication route. An explicit
review/amendment permission for this handoff branch has been requested separately.
