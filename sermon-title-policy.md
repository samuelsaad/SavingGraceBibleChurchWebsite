# Conservative application-title policy

Policy: `corroborated-passage-boundary-v1`.

An application title may omit one valid Bible reference at an explicit prefix or
suffix boundary when existing passage metadata or an exact preserved, verified
source title corroborates it. The shared Bible parser determines reference
coordinates. Removal changes only the reference, its separator/brackets and
unnecessary surrounding whitespace; remaining wording and punctuation survive.
Multiple references, uncertain offsets, internal references, plain-space-only
boundaries, missing corroboration and passage-only titles remain unchanged for
manual review. This is not authority to invent a title or confirm a passage.

## Import and editing contracts

- Legacy source mapping normalizes the application title and emits a safe warning
  for ambiguous cases. Original source checksums remain calculated from source
  bytes, not the title projection.
- Fixed-batch imports retain original source titles and receipt/candidate hashes.
  Unchanged-import verification accepts only the original title or its exact
  deterministic projection; all other postconditions remain strict. No consumed
  processing decision is reactivated by this policy.
- The PostgreSQL source loader locks an existing target before related writes and
  refuses a different incoming title if an editor/update subject or successful
  title audit establishes editorial ownership. It does not overwrite a human edit.
- Normal administrator creation/editing uses the same conservative policy when
  supplied or existing passage metadata corroborates it. Existing authorization,
  row-version checks, auditing and review rules still apply.
- The immutable 15-sermon development seed and its hashes are not changed. Its
  importer compares a title-only projection of stored and seed records; every
  other field remains byte-checked. A non-equivalent human title blocks reimport,
  and verification never writes it back.

## Bounded local correction

The correction command has separate `plan`, `apply` and `verify` modes:

```text
node --import tsx src/metadata/sermon-title-correction-cli.ts verify
```

`plan` freezes metadata-only evidence in ignored storage using exclusive file
creation and a SHA-256 sidecar. Do not regenerate a completed plan. `apply`
requires explicit current-task authorization and `ALLOW_LOCAL_DB_WRITE=1`, and
accepts only PostgreSQL 16 at `127.0.0.1:5432/savinggrace_sermons_test`. It rechecks
the exact saved identities, titles, versions, evidence and preservation hashes in
one serializable transaction. A conflict rolls back rather than forcing stale
changes. The original private comparison and the completion receipt survive.

Each change uses the existing metadata/search/review primitives with a separate
system audit event recording Samuel's requested title correction. This is not an
administrator approval. A changed, previously confirmed identity returns to
Stage 1 and loses its current overall completion marker; prior finding decisions,
content approvals, passage decisions and historical audit events remain intact.
Samuel must reconfirm identity and finish the normal workflow personally.

An identical second application requires its original audit correlation and makes
no title, content, version, timestamp, audit or review-state changes. Verification
hashes protected table contents inside PostgreSQL without returning sermon prose.
No slug, URL, passage relationship, transcript, description, Q&A, raw source or
historical generation evidence is rewritten. Publication and semantic eligibility
are not granted.

Private comparisons, receipts and real metadata remain ignored and unstaged.
The command's output contains only counts, hashes and allowlisted status codes.
No production connection, provider request, schema change or content generation
is part of this workflow.
