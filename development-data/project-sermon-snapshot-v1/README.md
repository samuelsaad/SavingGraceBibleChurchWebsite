# Project sermon snapshot v1

This directory is the authorised, branch-scoped project handoff snapshot for
`codex/project-sync-for-sermons-v4`. It contains the current sermon collection
as a deliberate JSON projection rather than a PostgreSQL dump.

`sermons.json` contains stable sermon identities, content, relationships,
lifecycle states, non-secret provenance, warnings, findings, and sanitised
review/acceptance evidence. `manifest.json` binds the byte content, collection
counts, identity list, descriptions, transcripts, and ordered Q&A with SHA-256
hashes.

The projection deliberately excludes accounts, administrator subject
identifiers, sessions, audit events, credentials, OAuth material, tokens,
private keys, raw caption exports, local filenames, and search-vector
derivatives. GitHub availability is a code/data handoff only: it does not
change any review or publication state.

Validate or inspect the import plan without a database write:

```text
npm run development-data:verify-project-sermons
npm run development-data:dry-run-project-sermons
```

Re-export only from the authorised local source database:

```text
npm run development-data:export-project-sermons-local
```

The importer is intentionally restricted to the repository's guarded,
uniquely named `savinggrace_test_run_*` PostgreSQL databases. It imports a
private development projection: content, ordering, metadata and lifecycle
labels are retained, while sermon publication is forced to draft and no
operational administrator, AI-review, audit, restricted-acceptance, semantic,
or public-eligibility record is restored. This prevents a portable handoff
from manufacturing authority.

With the guarded test environment set by the PostgreSQL runner:

```text
npm run development-data:import-project-sermons-local
npm run development-data:import-project-sermons-local
```

The first result is `imported`; the byte-identical second run is `unchanged`.
The importer refuses the application database, partial datasets, incompatible
migration ledgers, public eligibility, semantic eligibility, or content-hash
drift.
