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
