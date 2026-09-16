# Staging deployment modes

## Current public visitor mode

The 14 September 2026 task explicitly authorized public access to the existing
eligible staging content at <http://54.253.237.138:8080/>. See `HANDOVER.md` and
`STATUS.md` for the current image, verification, limitations and exact recovery
checkpoint. This is public HTTP staging, not production or administrator sign-in.

`public-staging-compose.yaml` adds the sole mapping `0.0.0.0:8080:8080/tcp` to
the verified existing app image. Its `!override` port list prevents duplicate
bindings. Only the app joins the new frontend bridge; the private database
network, database service, volumes and secrets remain unchanged. IPv6 and IP
masquerading on that bridge are disabled. The original loopback proxy is stopped
and disabled while Docker owns port 8080. No 4380 mapping is added.

Validate the merged configuration with `public_staging_network.py` in explicit
`public-staging` mode against the unchanged deployed base configuration. Both
normal and maintenance profiles must be included in inspection. It rejects
additional ports, images, environment values, storage or private-service changes.
The original `restore.py` guard remains sealed-only; public mode is not permission
to bypass an empty-target restore or write data.

```sh
# Use the deployed base, environment and protected public override, not V3 source.
docker compose --env-file "$DEPLOYED_ENV" -f "$DEPLOYED_COMPOSE" \
  -f "$PUBLIC_OVERRIDE" up -d --no-deps --force-recreate --no-build --pull never \
  --wait --wait-timeout 90 app
```

Capture private image/configuration evidence and an exact app-only rollback before
changing a running service. Check the effective configuration for one and only one
TCP mapping, strict SSH target identity, health, external access, private-route
denial, current eligibility and unchanged table/sequence fingerprints afterward.
Keep the SELECT-only production-mode runtime (`STAGING_SEALED=1`) and its private
route denial; that variable controls application safeguards, not host reachability.
Noindex/robots headers discourage indexing but do not restrict access. Do not
enter administrator credentials over this public HTTP endpoint.

Public networking does not authorize future sermons, changed publication states,
development identity, V3 deployment, production changes or unrelated AWS rules.
Run both network suites: `python -B tests/staging_network_test.py` and
`python -B tests/staging_public_network_test.py`.

## Original sealed-only mode and historical deployment procedure

The original sealed deployment was authorized only for the separately identified staging EC2
instance. It is not production, public-internet publication, a replacement
authenticator or permission to change AWS networking. D-158 separately permits
restricted frontend acceptance of exactly 144 completed sermons. Existing local
review servers are unchanged.

## Integrated release and verification

The isolated `staging-release-candidate` branch combines the D-157 backend at
`ae8755ab93e446fa8c6da1f7ad32a39218a0fd45`, the creative frontend at
`eae2954a1d749d2fde0341c173866c8adcf0776e`, and the inspected uncommitted admin-layout,
navigation and Bible-book-tab refinements. Both original worktrees are preserved.
Normal human publication requirements remain separate from D-157 private completion.

The currently deployed application is commit
`60b31a1e18611191f9c751e382a7c2942538db56`, including the completed discovery and
Topical work. The public networking change reuses that image. See `STATUS.md` for exact image/archive/dump hashes,
the initial restore, history-preserving D-158 recovery and final test evidence.
Later documentation-only commits do not change the deployed image. The verified
snapshot does not include one subsequent local review-navigation update; never
overwrite that later local progress or describe this as live replication.

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

The existing OS socket proxy exposes only `127.0.0.1:8080` on EC2. Neither container
has a published host port. Both use only an internal network. Docker does not
publish ports for an internal-only container, so the exact root-owned systemd unit
templates bridge host loopback to a verified fixed internal application address.
The proxy uses a dynamic unprivileged OS identity, not an application authenticator.
This also avoids relying on pre-28 Docker's localhost NAT isolation. No AWS firewall, DNS,
80/443 exposure or authentication-provider configuration is performed here.

The dedicated production-mode entry point rejects development identity settings,
uses a non-superuser read-only database role, and permanently denies admin/private
preview endpoints for this sealed release. An SSH tunnel is transport protection,
not an authenticated administrator session. Those routes remain disabled until
a separately approved real authentication provider and HTTPS design are implemented.
Readiness checks the actual target, read-only role, all 19 migration checksums and
the D-158 manifest-bound publication boundary. The 11 excluded records must remain
unpublished. Responses are no-store/noindex. Local
development authentication is neither packaged nor enabled in this runtime.

Use Amazon Linux's supported Docker package installation, not a third-party shell
installer. Install a pinned official Compose plugin after verifying its published
SHA-256. Do not change user groups or SSH configuration. Generate independent
64-hex-character staging passwords on EC2 without printing them. Keep deployment
configuration and backups outside the release directory, root-owned and restricted.
Secret files are readable only by root and the intended container UID; do not put
passwords into Compose environment values, command arguments or image layers.

The environment file contains only these names: `APP_IMAGE`, `POSTGRES_IMAGE`,
`RELEASE_COMMIT`, `DATABASE_VOLUME`, `SECRET_DIRECTORY`, `VERIFICATION_DIRECTORY`,
`PRIVATE_SUBNET`, `APP_PRIVATE_ADDRESS`. Select the latter two only from the verified
existing Docker-private subnet with a collision-free reserved address; do not log them.
Install the exact `savinggrace-staging.socket` template and the service template
with only `@APP_PRIVATE_ADDRESS@` substituted into `/etc/systemd/system/`. Verify
the proxy binary exists, unit ownership/modes and `systemd-analyze verify` before
enabling the socket. The restore guard compares both units against release bytes.
Pin image digests/IDs and the exact source commit. The reader role receives SELECT
and schema usage only; it has no ownership, DML, DDL, publication or review authority.
App limit: one CPU/768 MiB; DB: one CPU/1536 MiB. Logs rotate, both restart unless
stopped, and app startup depends on DB health. `/health/ready` is database-dependent.
Its JSON uses `release` for the exact deployed commit and `authentication` for
`private_routes_disabled`; do not mistake transport access for administrator login.

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
systemctl enable --now savinggrace-staging.socket
docker compose --env-file "$ENV" -f deployment/compose.yaml ps
curl --fail http://127.0.0.1:8080/health/ready
```

The restore entry point checks empty target, fixed database identity, private
network/ports, secret-file permissions and dump hash before streaming the dump to
`pg_restore --single-transaction --exit-on-error --no-owner --no-acl`. It verifies
all table/sequence fingerprints and migration checksums afterward. Do not replay
migrations already present in the verified dump's schema and ledger. The initial
deployment restored 0001–0018; D-158 then applied only authorized migration 0019
against protected current backups, without replacing the database. The running
release requires 0001–0019 and has no pending migration. Any future mismatch fails
closed for a matching-release plan. After acceptance history exists, use the
history-preserving recovery below rather than restoring an older dump over it.

## Rollback rehearsal and recovery

**D-158 update:** after acceptance receipts exist, do not use the historical
empty-volume restore rehearsal below as an application rollback. Preserve the
current database and append-only review/acceptance history. The compatible D-158
image supports `RESTRICTED_FRONTEND_DISABLED=1`: recreate only its read-only app
container with that protected setting to deny all ordinary content routes while
retaining health and private-route denial. Re-enable the verified compatible
image only after its schema and eligibility checks pass. Keep the older image,
dump and volume as evidence, not as a way to erase newer decisions. Audited
individual withdrawal is a separate non-HTTP operation requiring explicit new
authority. Its identical replay makes no changes. Empty 0019 schema rollback is
tested separately; rollback after recorded acceptance intentionally refuses.

D-158 maintenance uses `deployment/acceptance-compose.yaml` only with the explicit
operation. It mounts exactly the verified dump, backup-integrity receipt and
manifest read-only into the maintenance container, never an entire protected
directory and never into the running application. The original snapshot-file
mount remains unchanged. A rejected broad-directory proposal was not applied.

The separately authorized nine-record editorial classification uses
`deployment/topical-compose.yaml` and the `classify-topical` maintenance command.
It mounts only its own verified pre-change dump, integrity receipt and frozen
manifest. It reuses the existing versioned extension relation (no migration),
preserves all original acceptance receipts and makes an identical rerun a no-op.
See `topical-classification-plan.md`; never reuse the operation for other records.

Preserve the verified original named volume, dump, snapshot, environment and exact
application image. Stop its socket/proxy units, then only this Compose candidate
(`stop app`, then `stop db`).
Create a separate environment file selecting a new, empty versioned recovery
volume; preserve all other release coordinates. Run `up -d db`, the guarded restore,
SELECT-only reader grants and `up -d app` against that recovery volume. Restart the
exact loopback socket unit and reconcile
the same fingerprints/counts, restart both containers and repeat readiness and
anonymous denial tests. Never run `down -v` or delete the only valid backup/volume.
For the first deployment there is no older application release; this rehearses
return to the same verified matching application/database pair after total volume
replacement. Future rollback needs the previous matching image and snapshot.

This recovery procedure was executed successfully against a separate empty volume,
not merely reviewed as a plan. The recovered pair is running, with the first
verified volume and backup artifacts retained. Both containers were restarted and
the identical table/sequence hashes and readiness were rechecked. Host reboot was
not part of the rehearsal.

Only leave the candidate running after all checks pass. Otherwise stop app/db
without deleting volumes or evidence. Operator snapshots, independent off-instance
backup retention, authentication, domain and HTTPS remain separate readiness work.

Sources: [AWS Docker on AL2023](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-container-image.html),
[official Compose installation](https://docs.docker.com/compose/install/linux/),
[PostgreSQL 16 pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html),
[PostgreSQL 16 pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).

The internal-only publishing behavior is documented in the
[Docker Engine project](https://github.com/moby/moby/issues/44986); the historical
localhost NAT limitation is described in [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/).
Run `python -B tests/staging_network_test.py` for the anonymized fail-closed proxy
and private-network contract tests.
