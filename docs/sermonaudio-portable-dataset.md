# D-175 portable SermonAudio data

The delivery branch may contain prepared display data for exactly the frozen
119-source manifest `a4fa3627682043c4b06aa65ddbebdab75f1fc29aec93e2d250bda537d9b0cd2b`.
The approved directory is `development-data/sermonaudio-119-v1/`. Original download
bytes, private review artifacts, operational audit/acceptance records, credentials,
accounts, sessions and local configuration are excluded.

The exporter reads only the authorized loopback PG16 database, in a repeatable-read
read-only transaction. It requires all 119 current audited acceptances and exact
source membership before writing. Existing output is preserved: an identical
export is unchanged; a different projection is refused rather than overwritten.
No export has been performed at the current processing checkpoint.

Commands, from the delivery worktree:

```text
node --import tsx src/development-data/sermonaudio-dataset-cli.ts export
node --import tsx src/development-data/sermonaudio-dataset-cli.ts verify
node --import tsx src/development-data/sermonaudio-dataset-cli.ts dry-run
```

The dataset has prepared transcripts, descriptions, ordered Q&A, metadata,
structured media and hash-bound informational AI-review summaries. It does not
have an operational D-175 receipt namespace or system audit authority. Restored
content is draft, without human approval, public/restricted acceptance or semantic
eligibility. Arabic Unicode and language metadata remain intact; language display
alone grants no content eligibility.

The `import` command uses the existing guarded disposable PostgreSQL mechanism,
its exact connection coordinates, write gate and test-run token. It refuses the
working application database. This development projection must never replace
local or staging operational records; actual delivery uses scoped audited sync.
Anonymized database tests cover atomic import, Unicode/ordering, no restored
acceptance, unchanged replay and preservation/refusal of concurrent edits.

Staging's new `D175_COMPLETED_ENABLED=1` gate additionally requires the existing
`D171_COMPLETED_ENABLED=1` and exact incumbent cohort. Without opt-in, all existing
selectors remain unchanged. Admin denial, private database access, no-store and
noindex protections remain in force. Do not activate before verified scoped data
transfer and recorded recovery/rollback material.
