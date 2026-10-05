# D-171 completed collection handoff

This bounded update adds 131 already-completed records to the existing 148-member
frontend population. It does not review, regenerate or approve another sermon.
The exact 279-member set has sorted-ID SHA-256
`4e3455c92d604f4e44999e56922e15359dc7bfa8a6d912c6d36e2a39a9f048c3`.
The other 32 local records stay held. D-171 and AGENTS.md record Samuel's separate
public-staging and curated-export authorization.

## Display and export boundaries

The `d171_completed` repository scope requires both frozen membership and current
existing acceptance dependencies, versions and withdrawal checks. D-169 receipts
retain their truthful original local review provenance when mirrored; D-171 is
separate display authority. Ordinary production/public and semantic selectors
are unchanged. The staging visitor handler still denies administrator,
draft-preview and mutation routes and emits no-store/noindex responses. Existing
church and sermon designs are preserved; unrelated V5 work is not included.

The curated `development-data/project-sermon-snapshot-v1/` export contains exactly
279 descriptions/transcripts, 1,952 ordered Q&A pairs, allowlisted metadata/media
and warnings. No raw captions, credentials, administrator subjects, operational
reviews, audit events or acceptance records are included. Historical snapshots
remain in Git history. Its disposable development import creates unapproved
drafts and unreviewed rather than fabricated passage confirmations. It does not
restore frontend acceptance or change actual local/staging decisions. Exact
25-migration checksum compatibility is supported; unknown journals are refused.

## Local preview

Set `D171_COHORT_FILE` to the absolute private verified cohort file, optionally
set `D171_LOCAL_PORT=4407`, and run `npx tsx deployment/completed-local.ts`.
It binds only loopback, reads the existing protected local PostgreSQL test
database with read-only connections, and uses no development identity. No local
application import, migration or review write is performed. Visitor routes are
`/`, `/sermons-v4/`, `/sermons-v1/` and `/sermons/`.

## Staging execution and rollback

`completed-export.ts` freezes the ignored packet with canonical SHA-256
`744b1c1f7fa5e8640e93fb31799b2a3f928f250743f8cde826e41735150a9db1`.
It contains only cohort dependencies and necessary immutable system media-audit
evidence, never account/session tables. This private transfer is not a Git export
or image input. Only the cohort-ID file is mounted in the visitor container.

Use pinned SSH and `completed-remote.py` against the named existing staging
applications and isolated protected completed-sermon store. `prepare` retains
both previous application configurations, immutable image and a hash-verified
custom-format logical backup. The original public database remains untouched and
fingerprinted. The package is built from a clean exact commit and immutable Node
base; uncommitted frontend alternatives and private artifacts are excluded.

Maintenance operations: `baseline`, `upgrade`, `plan`, `import`, `verify`.
Upgrade only the exact protected 22-migration ledger to the already established
25-migration lineage. The source packet and exact 148-member baseline are
mandatory. Preflight rejects unequal existing rows; only 131 new members are
appended transactionally. Preserve all original rows, sequences and review
history. Verify all 279 current acceptances before committing. An identical
second import must change no data, version, timestamp, review or audit record.

Verify the exact new image in an isolated read-only canary with no published
ports first. An older protected image expecting 22 migrations becomes unhealthy
after the 25-migration upgrade; this is not permission to bypass readiness.
Diagnose its exact schema mismatch and replace only that protected visitor app
through execution review. Require healthy readiness, all 279 eligible members,
admin denial and no-store behavior before the public switch. The operator now
enforces that compatible protected-image readiness as a public-activation gate.

`activate` selects only the verified visitor applications. The public app keeps its
existing listener and uses the completed database over a private network. No
new listener, exposed database port, AWS change or production action is required.
`rollback-public` restores the earlier public image/config/database pair;
`reactivate-public` restores D-171. Both preserve the newly appended private
history. Never down-migrate the protected database after immutable receipts are
added; use the compatible image with its existing fail-closed setting if needed.

## Implementation verification

Focused cohort/privacy tests passed. All 130 PostgreSQL cases passed with zero
database skips. On the clean release, standard suite: 829 passed; full PostgreSQL
runner: 959 passed.
Both reported the same pre-existing admin-layout newline assertion failure.
Type/Astro checks and production/staging builds passed; offline audit reported
zero vulnerabilities. Exact-scope outgoing scans found no prohibited material.
The actual curated 279-record import and identical rerun passed in a guarded
disposable database, with zero public, completed-preview or semantic eligibility.
The disposable database was removed; the application database was not written.
Record deployment/idempotency/rollback results separately after execution.
