# Private local backup and restore proof

`scripts/seo-local-recovery.ts` implements a bounded D-181 recovery demonstration.
It is not a production or staging restore command. Execution requires an approved
explicit D-181 governance paragraph plus both `ALLOW_LOCAL_DB_WRITE=1` and
`ALLOW_LOCAL_SEO_RESTORE=1`. Without them it stops before opening a database.

The fixed source is PostgreSQL 16 `savinggrace_sermons_test` on `127.0.0.1:5432`.
The script uses the existing protected local authentication and installed version-16
backup tools. Passwords never appear in arguments or logs. It holds one read-only,
repeatable-read transaction, exports its snapshot, and supplies that snapshot to
`pg_dump --format=custom`. Per-table row counts and sorted row SHA-256 fingerprints
come from the same snapshot, so concurrent ordinary CMS/source updates do not
produce a misleading comparison or require a write lock on application rows.

After the dump and source fingerprints are retained privately, the script creates
one absent `savinggrace_test_run_<random-run-token>` database using the existing
disposable target guard. It restores only into that new database, in one transaction,
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

When the narrow governance amendment has been explicitly approved, run locally:

```powershell
$env:ALLOW_LOCAL_DB_WRITE='1'
$env:ALLOW_LOCAL_SEO_RESTORE='1'
npx --offline tsx scripts/seo-local-recovery.ts --prove
Remove-Item Env:ALLOW_LOCAL_SEO_RESTORE
Remove-Item Env:ALLOW_LOCAL_DB_WRITE
```

Record the actual result in the validation plan. Unit tests validate the refusal
and comparison contracts but are not evidence that restoration was executed.
