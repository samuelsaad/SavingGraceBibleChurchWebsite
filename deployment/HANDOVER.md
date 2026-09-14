# Current sealed staging handover

## Working state

- Release branch: `staging-release-candidate`; application commit
  `60b31a1e18611191f9c751e382a7c2942538db56`.
- Image: `sha256:e0598c4cfb0760933c0a2cd018aa9b2cbc3ce457e8b977816cbefc07feda101f`.
- Local frontend: <http://127.0.0.1:4381/>.
- Staging frontend through the existing SSH tunnel: <http://127.0.0.1:4380/>.
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

The existing app and PostgreSQL containers use an internal Docker network and
publish no host ports. The app proxy binds only host `127.0.0.1:8080`. The only
non-loopback TCP listener found is SSH. The app runs as `node`, with a read-only
filesystem, dropped capabilities, SELECT-only database credentials and restart
policy `unless-stopped`. Secrets, backups and manifests are outside Git/images.
Private responses retain no-store, noindex and CSP; no indexing/SEO exposure was enabled.

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

Then open <http://127.0.0.1:4380/>. Keep the tunnel terminal open. No DNS, HTTPS,
AWS networking or public access change is needed to view sealed staging.

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
Production/internet publication, real sign-in, domain/HTTPS, off-instance backup
policy, AWS snapshots and cutover all require separate scope and readiness checks.
Do not resume completed enrichment batches or modify preserved frontend/backend
worktrees. Completion documentation may advance Git HEAD without changing the
running application image; check `/health/ready` for its exact release commit.

Detailed automated and real-browser verification is recorded in `STATUS.md` and
the current entry of `migration-validation-plan.md`.
