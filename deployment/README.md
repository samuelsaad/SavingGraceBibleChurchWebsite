# Sealed staging release

This deployment is authorized only for the separately identified staging EC2
instance. It is not production, publication, a replacement authenticator or a
permission to change AWS networking. Existing local review servers are unchanged.

## Integrated release and verification

The isolated `staging-release-candidate` branch combines the D-157 backend at
`ae8755ab93e446fa8c6da1f7ad32a39218a0fd45`, the creative frontend at
`eae2954a1d749d2fde0341c173866c8adcf0776e`, and the inspected uncommitted admin-layout,
navigation and Bible-book-tab refinements. Both original worktrees are preserved.
Normal human publication requirements remain separate from D-157 private completion.

Run `npm ci --offline --ignore-scripts`, `npm test`, `npm run test:postgres`,
`npm run check`, `npm run build`, `npm run staging:bundle`, the anonymized browser
regressions, `npm run migration:dry-run -- --input tests/fixtures/dry-run.json` and
`npm audit --offline --audit-level=low`. Real PostgreSQL tests require the existing
explicitly authorized disposable runner; never recreate the application database.
Offline audit is limited to cached advisory data, not a fresh registry audit.

The image contains bundled runtime code and the exact migration files, not static
admin HTML, development seeds, private evidence, model files or local configuration.
`package-release.mjs` packages only the committed dependency closure and migrations;
its external output directory must not be any repository or Docker build context.
Run privacy, secret, key, symlink and production-output scans before committing.
Docker is absent on the current Windows host. Container acceptance must therefore
run on the sealed EC2 before any real dump is restored; do not claim a local Docker test.

## Network, authentication and secrets

Compose exposes only `127.0.0.1:8080` on EC2. PostgreSQL has no host port. Both use an
internal network; nothing is routed to the public internet. No AWS firewall, DNS,
80/443 exposure or authentication-provider configuration is performed here.

The dedicated production-mode entry point rejects development identity settings,
uses a non-superuser read-only database role, and permanently denies admin/private
preview endpoints for this sealed release. An SSH tunnel is transport protection,
not an authenticated administrator session. Those routes remain disabled until
a separately approved real authentication provider and HTTPS design are implemented.
Readiness checks the actual target, read-only role, all 18 migration checksums and
absence of any publication timestamp. Responses are no-store/noindex. Local
development authentication is neither packaged nor enabled in this runtime.

Use Amazon Linux's supported Docker package installation, not a third-party shell
installer. Install a pinned official Compose plugin after verifying its published
SHA-256. Do not change user groups or SSH configuration. Generate independent
64-hex-character staging passwords on EC2 without printing them. Keep deployment
configuration and backups outside the release directory, root-owned and restricted.
Secret files are readable only by root and the intended container UID; do not put
passwords into Compose environment values, command arguments or image layers.

The environment file contains only these names: `APP_IMAGE`, `POSTGRES_IMAGE`,
`RELEASE_COMMIT`, `DATABASE_VOLUME`, `SECRET_DIRECTORY`, `VERIFICATION_DIRECTORY`.
Pin image digests/IDs and the exact source commit. The reader role receives SELECT
and schema usage only; it has no ownership, DML, DDL, publication or review authority.
App limit: one CPU/768 MiB; DB: one CPU/1536 MiB. Logs rotate, both restart unless
stopped, and app startup depends on DB health. `/health/ready` is database-dependent.

## Consistent logical backup and restore

`deployment/export-local.ts` checks only the authorized local PostgreSQL 16 target,
holds one repeatable-read snapshot, fingerprints every public table and sequence,
and passes its exported snapshot to `pg_dump --format=custom --no-owner --no-acl`.
Credentials are used only in memory; errors and output are sanitized. Protect the
external export directory before running. Never copy a raw PostgreSQL data directory.

Transfer the committed release archive, logical dump and fingerprint snapshot over
strictly pinned SSH. Recompute every SHA-256 on EC2. Extract only the safe archive
into a new versioned release directory; backups/secrets must stay outside it.
Before replacing anything, inventory and back up existing staging data. Stop if
unexpected deployment data exists. A new named volume must be empty.

With root-only `ENV`, `DUMP` and `SNAPSHOT` paths (values deliberately omitted):

```sh
docker compose --env-file "$ENV" -f deployment/compose.yaml up -d db
python3 deployment/restore.py --environment "$ENV" --dump "$DUMP" --snapshot "$SNAPSHOT"
# Grant the separately generated staging_reader role SELECT-only privileges.
docker compose --env-file "$ENV" -f deployment/compose.yaml up -d app
docker compose --env-file "$ENV" -f deployment/compose.yaml ps
curl --fail http://127.0.0.1:8080/health/ready
```

The restore entry point checks empty target, fixed database identity, private
network/ports, secret-file permissions and dump hash before streaming the dump to
`pg_restore --single-transaction --exit-on-error --no-owner --no-acl`. It verifies
all table/sequence fingerprints and migration checksums afterward. Do not replay
0001–0018: the dump already contains their schema and ledger. This release has
no pending migration; any future mismatch fails closed for a matching-release plan.

## Rollback rehearsal and recovery

Preserve the verified original named volume, dump, snapshot, environment and exact
application image. Stop only this Compose candidate (`stop app`, then `stop db`).
Create a separate environment file selecting a new, empty versioned recovery
volume; preserve all other release coordinates. Run `up -d db`, the guarded restore,
SELECT-only reader grants and `up -d app` against that recovery volume. Reconcile
the same fingerprints/counts, restart both containers and repeat readiness and
anonymous denial tests. Never run `down -v` or delete the only valid backup/volume.
For the first deployment there is no older application release; this rehearses
return to the same verified matching application/database pair after total volume
replacement. Future rollback needs the previous matching image and snapshot.

Only leave the candidate running after all checks pass. Otherwise stop app/db
without deleting volumes or evidence. Operator snapshots, independent off-instance
backup retention, authentication, domain and HTTPS remain separate readiness work.

Sources: [AWS Docker on AL2023](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-container-image.html),
[official Compose installation](https://docs.docker.com/compose/install/linux/),
[PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html),
[PostgreSQL 16 pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).
