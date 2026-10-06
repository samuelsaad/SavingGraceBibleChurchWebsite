# D-175 scoped transfer

This transfer is exclusively the existing D-175 frozen 119-record manifest.
It never replaces the incumbent database or changes publication states. Source
identifiers, exact recording associations and current audited acceptances must
match before a private packet can be frozen. Original metadata/downloads remain
private; the curated portable dataset is a separate display-only product.

The local read-only `deployment/sermonaudio-completion-export.ts` uses the protected
loopback PostgreSQL configuration and verified frozen retrieval inventory. It
captures only currently accepted targets, their direct relationships, three D-175
provenance/review/acceptance extensions and four actual system events per target.
It excludes accounts, sessions, unrelated scopes and administrator audits. Each
packet is saved immutably in ignored storage with a hash and database fingerprint.

The release bundles `sermonaudio-completion-sync.cjs`. Its operator requires the
normal sealed staging configuration, exact D-175 gate and target marker, verified
25-migration ledger, protected owner-secret mount and incumbent D-171 cohort.
Source, cohort and output mounts are available only to isolated maintenance, not
the visitor runtime. Do not mount a packet into a public application container.

Run `baseline`, `plan`, `import` and `verify` in that order. Before real writes,
independently verify the pinned SSH destination, existing private database network,
protected configuration and release/package/packet hashes. Capture the previous
application images/configuration and scoped recovery evidence. Baseline creation
is no-clobber and proves the previous 279-member cohort is still fresh.

Every target uses one guarded SERIALIZABLE transaction, advisory/table locks and
full preflight. Stable identity/slug collisions or unequal existing rows are
reported, never overwritten. A conflict rolls back that target and independent
targets continue. Exact rows are inserted in dependency order. Pending guided
rows, where present, are inserted before transcript-trigger seeding; no review
row deletion is used. The current D-175 acceptance dependency must pass after the
copy. All pre-existing rows and sequence values are independently hash-checked.
An identical second import must return unchanged without audit/version churn.

Activation uses the normal D-171 selector plus explicit `D175_COMPLETED_ENABLED=1`
for this completed subset; no ordinary production selector is altered. Keep the
existing public/protected listener boundaries, private database, disabled remote
admin routes, no-store/noindex and genuine draft states. An application rollback
selects the recorded previous image/configuration and old selector, retaining the
valid database and imported source/review history. Never perform an unreviewed
whole-database restore or erase the new history to roll back presentation.

## Explicit primary-coordinate repair

Where a complete reviewed transcript explicitly demonstrates that retained
metadata has a wrong coordinate, an optional D-175 review field may specify one
same-book primary-reference correction before the first import. The exact original
field, unique full-source anchor, corrected coordinate and assessment are required.
Missing/ambiguous support, a changed book, unmatched original metadata or a topic
inference is refused. Original evidence and source bytes remain unchanged; both
coordinates and source-range hash remain in private provenance. No previous sermon
or human passage decision is updated by this path.
The existing reference keeps its legacy origin, stores the actual original field
in `original_reference_text`, and records the explicit D-175 correction parser
version; `review_status` remains unreviewed. This is not human passage approval.

Prepared does not mean deployed. Report actual remote outcomes only after secure
transfer, exact-row verification, identical rerun, release activation, browser/HTTP
inspection and rollback rehearsal have actually succeeded.

## Bounded remote operator

`deployment/sermonaudio-completion-remote.py` checks the exact authorized instance,
existing runtime/image identities, private database network and independently
verified package/packet hashes. It captures previous application configurations
and database integrity before building. `prepare`, `baseline`, `plan`, `import`,
`verify`, an identical `import` and `verify` precede `activate`. `rollback` and
`reactivate` rehearse image/selector recovery while proving the database unchanged.
The source packet is maintenance-only. No credential, account/session data or raw
download enters the image. Errors emit fixed codes, not raw command output.
Five anonymous offline tests cover archive scope, symlinks, secret/error exclusion,
no-clobber recovery, exact cohort validation and instance drift. These do not
replace real staging checks. The incumbent cohort is discovered from its actual
read-only runtime mount, not inferred from the currently running image's directory.

A code-only followup after the verified initial transfer may use `reuse-baseline`
with the exact recorded predecessor. Source-packet and cohort byte hashes must
match, and a completed predecessor verification must exist. This copies only the
preservation baseline, never a verification receipt. Fresh exact-row verification
by the new helper is still mandatory before activation. No data is imported again
merely to deploy a read-query repair. A sixth anonymous operator test covers this
boundary and scope-conflict refusal.
