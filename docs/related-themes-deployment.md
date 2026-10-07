# Description-only Related themes: guarded staging delivery

This is D-178 evaluation deployment, not visitor release. The ordinary feature is
disabled on both staging runtimes until the recorded two-reviewer calibration,
locked policy and independent holdout requirements pass. No machine score or
completed index grants that approval.

## Existing destination and privacy boundary

Use the previously pinned SSH host identity for the established staging instance.
Before every transfer session, verify the hostname resolves to the authorized
address, the ED25519 host fingerprint matches its retained pin and the instance
identity matches the established staging instance. Use strict host verification,
no agent forwarding and the existing protected private key outside the repository.
Do not print key, secret or environment values.

The public and protected applications share the existing private PostgreSQL 16
database. They have separate semantic environment/active pointers despite equal
current corpus membership. Discovery observed 398 stored and eligible records;
this is an observation, not a selector constant. The ordinary application selector
and current hash-verified acceptance receipts remain authoritative.

The public raw-IP listener and existing protected SSH tunnel remain unchanged.
No new listener, account, session, development identity, database port or public
evaluation route is created. Reader connections retain read-only, UTC,
statement-timeout and JIT-disabled protections.

Only four additive semantic tables may be written:

- `accepted_description_semantic_vectors`
- `accepted_description_semantic_builds`
- `accepted_description_semantic_members`
- `accepted_description_semantic_active`

The migration ledger records migration 0026. No sermon, transcript, Q&A, media,
review, acceptance, account, audit-history or publication row is modified. Existing
table and sequence fingerprints are compared before and after the operation.

## Export and transfer

Capture the destination's current eligible inventory as private identity, language
and description-hash evidence. Restrict each local export to that exact inventory
*before* transfer; the nine local-only records must not appear in either packet.
Packets contain structured index plans and vectors, not prose or credentials.
The target also verifies exact source identity, language, hash and complete member
set, remaps UUIDs by preserved identity and recomputes rankings within its own
corpus. Missing, extra or changed members fail before vector writes.

Build the immutable release with the existing locked dependency/build workflow.
Keep model weights, local configuration and private artifacts outside the release
archive. Prepare only:

1. `release.tar`
2. `public-index.private.json`
3. `protected-index.private.json`

Hash each file, transfer through the pinned connection and independently compare
its SHA-256 at the destination. Do not transfer a locally generated evaluation
pack: staging produces its own pack after reconciliation, preventing local-only
content or candidate leakage.

## Schema compatibility and order

The previous reader required exactly 25 migrations. It must not be restarted
against schema 26. The new code therefore first runs as a feature-disabled bridge
that verifies either the exact known 25-entry ledger or exact 26-entry ledger.
This is not a minimum-version or unknown-checksum bypass.

The following commands run on the verified staging host as the existing scoped
operator. Replace placeholders with independently verified hashes; they are not
credentials. Keep all input files and output receipts in protected directories.

```sh
sudo -n python3 related-themes-remote.py prepare <release-commit> <package-sha256> <public-packet-sha256> <protected-packet-sha256>
sudo -n python3 related-themes-remote.py bridge-canary <release-commit>
sudo -n python3 related-themes-remote.py activate-bridge <release-commit>
sudo -n python3 related-themes-remote.py apply-0026 <release-commit>
sudo -n python3 related-themes-remote.py baseline <release-commit>
sudo -n python3 related-themes-remote.py plan <release-commit>
sudo -n python3 related-themes-remote.py import <release-commit>
sudo -n python3 related-themes-remote.py import <release-commit>
sudo -n python3 related-themes-remote.py verify <release-commit>
sudo -n python3 related-themes-remote.py evaluate <release-commit>
sudo -n python3 related-themes-remote.py canary <release-commit>
sudo -n python3 related-themes-remote.py activate <release-commit>
```

`prepare` refuses unexpected existing paths, changed incumbent images/configs,
unverified packets and unsafe archives. It saves previous configurations, exact
immutable image identities, all incumbent fingerprints and a scoped logical
backup of existing semantic tables if present. It never replaces the database.

Canaries have no host port or fixed private address. They run sequentially and
are removed afterwards. Only the two existing app services are replaced at
activation; the database and unrelated services remain untouched.

The first index import writes immutable cache/build/member history and atomically
updates its environment pointer after another corpus check. An identical rerun
must report `unchanged` with an identical full database fingerprint. No review
acceptance or eligibility is inferred from an embedding.

`evaluate` reads current destination descriptions privately. It compares semantic
candidates with the existing metadata Related sermons query for the same indexed
cohort, using the frozen D-178 seed and two separately assigned reviewers. It
creates no ratings and authorizes no release. Only the protected application's
evaluation file is mounted read-only; the public pack remains private operator
evidence.

The maintenance entry point `related-themes-sync.cjs` requires all of:

- `ALLOW_STAGING_RELATED_THEMES_SYNC=1`
- `RELATED_THEMES_TARGET=existing-protected`
- `RELATED_THEMES_ENVIRONMENT=staging_public` or `staging_protected`
- exact PostgreSQL 16 target/database marker and protected owner secret
- current verified cohort and exact migration ledger

It is not a public HTTP endpoint. Output is sanitized aggregate counts, hashes
and status codes only. Evaluation descriptions and raw database errors are never
printed.

## Verification and access

Check both health endpoints against the exact release commit and image. Verify
existing inventory counts and detail routes, unchanged public/protected access,
`no-store`/`noindex`, and denial of admin/draft-preview routes. Confirm ordinary
Related themes remains absent on public pages and no evaluation route is exposed
there.

Through the existing protected tunnel only, open:

- `/related-themes-evaluation/`
- `/related-themes-evaluation/reviewer-a/calibration/`
- `/related-themes-evaluation/reviewer-b/calibration/`

Holdout packs remain gated until policy locking. Browser checks must not capture
private descriptions in screenshots or ordinary logs. Human reviewers download
their own ratings privately; software must not fabricate completed ratings.

## Rollback and rehearsal

After migration 0026, use the verified feature-disabled **schema-compatible
bridge**, not the previous 25-only image:

```sh
sudo -n python3 related-themes-remote.py rollback <release-commit>
sudo -n python3 related-themes-remote.py rollback-index <release-commit>
sudo -n python3 related-themes-remote.py rollback-index <release-commit>
```

The first command disables protected evaluation and restores the bridge app
configuration without deleting data. The second restores only the exact previous
active pointers using guarded concurrency checks, retaining immutable vectors,
builds, members and all historical evidence. The repeated rollback must be
unchanged. A concurrent pointer change blocks compensation rather than being
overwritten.

To return to the tested candidate after rehearsal, import the same frozen packets,
verify them, regenerate the identical private evaluation packs if necessary, and
reactivate:

```sh
sudo -n python3 related-themes-remote.py import <release-commit>
sudo -n python3 related-themes-remote.py import <release-commit>
sudo -n python3 related-themes-remote.py verify <release-commit>
sudo -n python3 related-themes-remote.py evaluate <release-commit>
sudo -n python3 related-themes-remote.py reactivate <release-commit>
```

Keep recovery artifacts and previous images. Do not drop the additive schema or
erase receipts as routine rollback. Any failure preserves the last verified state
and safe sanitized failure code; do not claim deployment or human evaluation
success from an unexecuted plan.
