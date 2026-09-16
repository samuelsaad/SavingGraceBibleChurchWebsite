# Current public staging handover

## Public access mode - 14 September 2026

Samuel explicitly authorized public visitor access to the existing accepted
staging content. This supersedes the prior SSH-only networking restriction for
this instance only; it is not production cutover or new publication authority.

- Public frontend: <http://54.253.237.138:8080/>. This is HTTP, without TLS.
- Exact Docker mapping: `0.0.0.0:8080:8080/tcp`; the container's verified listener
  is `0.0.0.0:8080`.
- The unchanged deployed image is
  `sha256:e0598c4cfb0760933c0a2cd018aa9b2cbc3ce457e8b977816cbefc07feda101f`.
- Only `app` was recreated. The database container, start time, mounts, secrets
  and internal network were preserved. No database/management port is published.
- `public-staging-compose.yaml` is layered on the deployed release's original
  Compose file. Only the application joins the additional frontend bridge;
  IPv6 and IP masquerading on that bridge are disabled. The original internal
  database network is unchanged.
- The old loopback systemd socket/proxy is disabled/stopped to release host port
  8080. Its original units and original Compose configuration remain intact.
- Local V3 remains uncommitted and available on port 4383; it was NOT included
  in the networking deployment. The staging menu still contains V1 and V2 only.

Strictly pinned SSH, instance metadata (`i-0f7abc9421733e79c`, expected public
IPv4) and the exact deployed image identified the existing staging destination.
The AWS Name tag and security-group rule could not be read: the instance has no
available AWS credentials and instance tags are not exposed through metadata.
No AWS/firewall rule was changed. Direct requests from the Windows client and
the browser, without the SSH tunnel, independently loaded the public frontend.
Do not describe noindex as access control: approved visitor content is now public.

All 43 table fingerprints and sequence state match before and after:
`9f6bbce2a1aedba7b3fbf22b121b068361a0a8d64dd73cc085cfebaaf4d47252`.
The counts remain 155 stored, 144 published/accepted, nine explicit Topical and
11 unresolved. No content, receipt, review, metadata or publication state changed.
See `STATUS.md` for verification results and the parallel-request limitation.

## Working state

- Release branch: `staging-release-candidate`; application commit
  `60b31a1e18611191f9c751e382a7c2942538db56`.
- Image: `sha256:e0598c4cfb0760933c0a2cd018aa9b2cbc3ce457e8b977816cbefc07feda101f`.
- Local frontend: <http://127.0.0.1:4381/>.
- Staging frontend through the existing SSH tunnel: <http://127.0.0.1:4380/>.
- Direct public staging frontend: <http://54.253.237.138:8080/>.
- PostgreSQL 16, 19 migrations through `0019_restricted_bulk_acceptance`, none pending.
- Both databases: 155 stored sermons; 144 valid restricted acceptances; 11 unchanged
  hidden exceptions. Discovery: 135 Bible-associated sermons across 16 books and
  nine explicitly Topical sermons. No new migration or content generation occurred.

The existing Sermons menu exposes SermonsV1, SermonsV2, Speakers, Series and Books.
Single activation opens it; double-clicking its parent opens SermonsV2. Dropdown
links activate once. `/sermons/` contains the Topical sermons discovery section.
The shared plum Topical strip is an actual stored editorial classification, not a
missing-book fallback. Scripture references remain intact elsewhere.

Samuel's written nine-record editorial decision is separate from historical
human/AI review and D-158 acceptance. Nine extensions plus nine system audit events
were inserted independently in each database. Their identical second operations
returned nine unchanged, with zero timestamp/version/audit churn. All original
rows remain unchanged. The unrelated earlier local/staging navigation difference
was preserved; the two databases must not be called byte-identical.

## Access and security

The visitor frontend needs no application sign-in in these restricted environments.
Remote `/admin`, `/frontend-preview/` and administrator API routes intentionally
return 401. Do not enable development identities on staging. Personal administrator
sign-in remains a separate task; SSH transport is not personal application login.

The application alone publishes TCP 8080 through the public-staging override.
PostgreSQL remains internal-only and publishes no host port. The app runs as `node`, with a read-only
filesystem, dropped capabilities, SELECT-only database credentials and restart
policy `unless-stopped`. Secrets, backups and manifests are outside Git/images.
Responses retain no-store, noindex and CSP. These are not access control or TLS.

If the existing tunnel is already running on 4380, reuse it. Otherwise set the
following variables only in the local shell using the existing protected connection
details; they are placeholders, not new hosts or credentials. Keep the PEM outside
every repository/build context. Verify DNS still resolves to the previously pinned
IP and stop on any host-key or target change. The trusted ED25519 association remains
in normal SSH known-hosts; never use `StrictHostKeyChecking=no` or accept a new key.

```powershell
# STAGING_SSH_KEY: established PEM path outside repositories
# STAGING_SSH_HOST / STAGING_PINNED_IP: established verified endpoint
ssh -N -T -i "$env:STAGING_SSH_KEY" `
  -o "HostName=$env:STAGING_PINNED_IP" `
  -o "HostKeyAlias=$env:STAGING_SSH_HOST" `
  -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 `
  -o UpdateHostKeys=no -o IdentitiesOnly=yes -o ForwardAgent=no `
  -o ExitOnForwardFailure=yes `
  -L 127.0.0.1:4380:127.0.0.1:8080 "ec2-user@$env:STAGING_SSH_HOST"
```

The tunnel remains optional and continues forwarding to host port 8080. Direct
public access uses EC2 port 8080, not 4380. HTTPS is not configured.

## Networking rollback

Protected local evidence includes the original configuration, image identity,
before/after fingerprints and exact `rollback.sh`. The staging configuration
directory contains the same app-only rollback script and the public-mode plans.
The original deployed environment and base Compose paths are recorded there.
Do not use an uncommitted local release or restore an older database.

```sh
# Use the exact preserved deployed paths from the private recovery checkpoint.
docker compose --env-file "$DEPLOYED_ENV" -f "$DEPLOYED_COMPOSE" \
  up -d --no-deps --force-recreate --no-build --pull never app
systemctl enable --now savinggrace-staging.socket
curl --fail http://127.0.0.1:8080/health/ready
```

This removes the public mapping by recreating only the original app configuration
and restores SSH-only frontend transport. Never use `down`, `down -v`, a database
restore, acceptance rerun or classification rerun for this networking rollback.
The rollback was actually exercised after the first environment-order guard
rejection, before the tested correction and successful public-mode retry.

## Preservation and recovery

Fresh protected custom-format logical backups preceded both classification writes.
Their exact hashes and current database fingerprints are in `STATUS.md`. The
previous image/configuration, both pre-change backups and all older recovery
volumes remain intact. Do not restore an old whole database over newer decisions.
The existing fail-closed application switch or a verified schema-compatible prior
image can recover the application without deleting classification/audit history.
The older `903e386` image does not display the new extension but retains valid
acceptance checks. No real withdrawal or destructive rollback was performed.

Only individual, byte-verified maintenance inputs are mounted read-only for the
bounded operator command. Their source copies stay root-only. Read-only copies
owned by the existing container user sit behind a root-only host directory so
maintenance can read both its inputs and its owner credential without adding
capabilities, changing credential permissions or running the app as root. The
application receives none of these inputs. Do not rerun classification as startup.

## Remaining work

The 11 evidence exceptions remain unresolved; this task does not clear them.
Production cutover, additional content publication, real sign-in, domain/HTTPS, off-instance backup
policy, AWS snapshots and cutover all require separate scope and readiness checks.
Do not resume completed enrichment batches or modify preserved frontend/backend
worktrees. Completion documentation may advance Git HEAD without changing the
running application image; check `/health/ready` for its exact release commit.

Detailed automated and real-browser verification is recorded in `STATUS.md` and
the current entry of `migration-validation-plan.md`.
