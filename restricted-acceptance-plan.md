# D-158 restricted bulk acceptance

## Authority and exact scope

Samuel explicitly accepts the completed cohort based on existing review evidence,
without claiming personal inspection of every sermon. After the execution-safety
rejection of the new schema, he separately authorized migration
`0019_restricted_bulk_acceptance`, its constraints, immutable history, dependency
hashing, guarded command, restricted display, backups and both database applications.

The exact private candidate manifest SHA-256 is
`4759449bbbaed97238968d2fd4621d4137b8b4e41b73a20aeda319dc1212617c`.
It identifies 144 eligible records (132 current AI and 12 preserved human final
completions), with 11 explicit exclusions. No replacement, expansion or guessed
resolution is allowed. Record identities and evidence stay in ignored storage.

Targets are only the guarded PostgreSQL 16 loopback test database and the already
verified sealed PostgreSQL staging container. Staging stays on its private Docker
network, has no database host port, and is accessible only through strictly pinned
SSH and the existing host-loopback socket. No AWS networking, production or sign-in
work is authorized. Existing review servers and source worktrees are preserved.

## Acceptance and freshness

The non-HTTP command must verify target, write gate, exact manifest hash, every
current dependency and final completion. One serializable transaction per database
adds truthful bulk-acceptance receipts and system-attributed audit events, then
changes only the authorized sermon publication fields/version/update attribution.
Original content, metadata, human approvals, D-156/D-157 decisions and provenance
remain unchanged. Acceptance is separately recorded, not fabricated lifecycle
human approval or an administrator click. The two environments are not one atomic
transaction; preserve independent receipts and resumable checkpoints.

An identical rerun verifies receipts, content and published versions without
timestamp, version or audit churn. New changes fail closed. The normal public
selector and human-only publication workflow remain unchanged. Only the explicitly
restricted visitor server may use the D-158 acceptance selector, which requires
published state, the exact manifest, unchanged dependencies/version and no
withdrawal. It renders accepted description/transcript/ordered Q&A directly from
the database, never from packaged private artifacts. The 11 excluded records remain
absent from direct pages, search, related results, feeds, sitemap and metadata.

## Historical timestamp defect

Read-only comparison proved identical instants/source data serialized differently
under UTC and Australia/Sydney: both databases returned 144 current completions
under the original Sydney representation, and 12 under UTC. No review was lost.
Historical D-156/D-157 readers reproduce Australia/Sydney serialization locally
inside their transactions and restore the caller's setting. No global timezone,
timestamp or historical hash is rewritten. New `d158-utc-jsonb-v1` hashes explicitly
serialize in UTC, including daylight-saving boundary instants; they retain content,
source, metadata and review dependencies. Unrelated guided navigation is excluded.

## Withdrawal and recovery

Acceptance is not irrevocable. A separately authorized, version-aware non-HTTP
withdrawal appends an immutable withdrawal and audit event and moves the sermon
to unpublished while retaining its original publication timestamp and acceptance.
It may not silently reaccept changed evidence or reuse the consumed operation.
No real withdrawal is authorized just to demonstrate a test.

Schema down is allowed only while no acceptance exists. Once history exists it
must refuse; this is not a successful rollback. Guarded future permanent deletion
retains the established tombstone/audit lifecycle. Never disable triggers or erase
history to recover. Application recovery uses a verified compatible image, or the
read-only fail-closed display switch, retaining the current database and history.
Protected pre-change logical backups and the previous staging image/volume are
retained, not restored wholesale over newer decisions.

## Required verification contract

Test exact scope, stale/missing evidence, unresolved records, wrong target,
concurrency, append-only history, withdrawal, failed destructive down, clean
apply/down/reapply before decisions, real idempotency and UTC/Sydney equivalence.
Run full standard and guarded disposable PostgreSQL suites, type/Astro/build,
offline dependency audit and private-content/security scans before application.
Create and verify protected current backups independently for both environments.
After application verify content/order/history preservation and scoped visibility,
real local/staging browser discovery/detail/search, disabled remote private routes,
SSH-only reachability and image/package integrity. Completion must report actual
outcomes, not describe these pending checks as passed.

## Actual application and preservation — 14 September 2026

Safe implementation `e2b13990042ec5808b3265e825f1b6f6069daa6f` preceded all real
writes. Packaging-only correction `c08b044b1f1ba14344ad05a068c4ed32ca8b99ca`
admits two required pure validators to the otherwise unchanged Docker exclusions.
Independent protected custom-format backups were verified before either mutation.

Each environment applied only 0019 and accepted exactly 144 records in its guarded
atomic operation. Each identical replay returned 144 unchanged, zero new writes.
Both retain 155 sermons/transcripts/descriptions, 1,084 Q&A, 1,121 D-156 decisions,
847 D-157 components, 132 AI completions and 12 human completions. Both now have
144 publication timestamps and 11 unchanged unpublished drafts. Bulk authority is
`samuel-saad-bulk-authorization`; execution is the separately attributed
`codex-d158-restricted-acceptance` system process, with no manual-review claim.

Independent before/after preservation projections are identical:

- Local: `e1c2a7b46dcc4caa87e50af14ed19a80482c12691ea1b3b7575a05e95f387475`.
- Staging: `1b66cab838f4557558327c68c1ab520d618ebe8ca2772ff2493d27152c714754`.

The projection covers all unchanged tables/sequences, original audit and migration
rows, complete excluded records and every sermon field except the five explicitly
authorized publication/version/update fields. Receipt scope, current dependency
eligibility, exact version increments and all 144 system audit events were checked
independently. Local/staging's earlier navigation difference remains preserved.

The real app-only recovery rehearsal used the existing current database: ordinary
routes returned 503 with the fail-closed switch, private routes stayed 401, then
the same compatible image returned ordinary routes to 200. The whole database
fingerprint was identical before and after. No real withdrawal, schema down,
trigger disabling, volume replacement or restore over acceptance history occurred.
Disposable tests separately proved empty-schema rollback, refusal after receipts,
audited withdrawal, idempotency, timezone equivalence and stale-content exclusion.

Final browser and deployment evidence is recorded in `deployment/STATUS.md`.
Both actual browsers verified 144 visible details and 11 exclusions, exact archive
membership, ordered content, search/discovery, refresh and responsive layouts.
All checks completed without private prose in output, screenshots, external
requests or review mutations. The restricted visitor servers remain running;
administrator sign-in remains separate and unimplemented on sealed staging.
