# Private local backup and restore proof

`scripts/seo-local-recovery.ts` implements the explicitly authorized D-182 recovery demonstration.
It is not a production or staging restore command. Execution requires an approved
explicit D-182 governance paragraph plus both `ALLOW_LOCAL_DB_WRITE=1` and
`ALLOW_LOCAL_SEO_RESTORE=1`. Without them it stops before opening a database.

The fixed source is PostgreSQL 16 `savinggrace_sermons_test` on `127.0.0.1:5432`.
The script uses the existing protected local authentication and installed version-16
backup tools. Passwords never appear in arguments or logs. It holds one read-only,
repeatable-read transaction, exports its snapshot, and supplies that snapshot to
`pg_dump --format=custom`. Per-table row counts and sorted row SHA-256 fingerprints
come from the same snapshot, so concurrent ordinary CMS/source updates do not
produce a misleading comparison or require a write lock on application rows.

After the dump and source fingerprints are retained privately, the script creates
the absent `savinggrace_test_run_seo_restore_20261011` database using the exact
current-task target guard. It restores only into that new database, in one transaction,
and compares every public table, including sermon, CMS, migration and source-public
tables when present. An incomplete source-public table set is rejected. The source
database is never a restore destination and receives no writes.

The private archive retains ownership and ACL metadata. The isolated restore uses
`--no-owner --no-acl`, mapping restored objects to the established local account
without creating or changing global roles. Therefore this proof tests schema/data
recovery; recreation of production/staging identities and grants is not claimed.

Cleanup verifies the exact random target name, loopback server identity and the
database OID captured after this run's successful creation. Only that database may
be dropped. A replaced or unknown target is refused. The retained ignored private
receipt records archive integrity, table fingerprints, comparison and confirmed
cleanup. No real source rows or secret-bearing errors are printed or tracked.

Under the recorded D-182 authorization, run locally:

```powershell
$env:ALLOW_LOCAL_DB_WRITE='1'
$env:ALLOW_LOCAL_SEO_RESTORE='1'
npx --offline tsx scripts/seo-local-recovery.ts --prove
Remove-Item Env:ALLOW_LOCAL_SEO_RESTORE
Remove-Item Env:ALLOW_LOCAL_DB_WRITE
```

Record the actual result in the validation plan. Unit tests validate the refusal
and comparison contracts but are not evidence that restoration was executed.

The corrected 4,081-route candidate's executed restoration matched all 65 table
fingerprints and schema/constraint/index/trigger/sequence checks. It verified 1,499
files (89,777,359 bytes), 1,224 resource routes and eight application HTTP checks,
then removed the exact created target after OID validation. The actual custom
archive SHA-256 is `335200de4af39bf55ccfdf98441a459771e35cd0a9582b622d05558c227a685b`.
This does not prove original WordPress recovery or recreation of staging/production
roles and grants; those remain separate evidence requirements.

The specific actual staging backup before application `b6b3d79` was also restored
independently in the same authorized absent-target/OID-guarded local database.
All 65 complete table hashes and schema/constraints/indexes/triggers/sequences
matched; 1,496 files, 1,224 resource routes and eight isolated HTTP checks passed.
The exact created target was removed. Its archive SHA-256 is
`2ddb50ed9e7ed51f4158c78c20aa59bd106ba952c7a1a467fe38c22102517939`
(15,983,693 bytes). This is recovery proof for that dated backup, not a claim
that later staging CMS history or WordPress was restored. Global role/ACL recreation
remains unproven. No original WordPress database/uploads/configuration backup was
available, so no task-owned WordPress Docker environment was created.


## Final 5,748-route proof and stopped attempts

The final candidate proof is recorded separately from the earlier local and staging
backups. Its first invocation without `--prove` refused before work. Later isolated
attempts restored all schema definitions but stopped in runtime initialization: the
single-connection restored reader queued the concurrent source/CMS/asset snapshot
reads beyond its five-second connection wait. Safe diagnostics matched the standard
pool timeout by hash and code location. Each created target was removed only after
its recorded OID matched; no source database was restored over.

The recovery harness now permits four connections only for the isolated restored
reader, matching the application's bound. Source/admin snapshot pools stay at one;
write opt-ins, absent-target checks, identity, consistent snapshot, hash comparisons,
no-owner/no-acl scope, loopback HTTP, disabled outbound integrations and OID cleanup
are unchanged. The final actual backup proof completed after the correction: all 65 table hashes
and schema objects matched,2,221 files (100,464,423 bytes) were restored, all 1,946
resource routes matched bytes/MIME/length, and eight isolated HTTP checks passed.
The exact created database was removed after OID verification. See
`seo-final-recovery.summary.json` for hashes and separate unproven boundaries. WordPress and role/ACL recovery
remain separate missing evidence.
