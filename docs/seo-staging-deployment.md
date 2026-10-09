# D-181 source-public staging rehearsal

This procedure adds the verified original-public source projection to the existing
sealed staging applications. It does not connect a production administrator,
change public DNS or traffic, mutate WordPress, or publish generated enrichment.
The existing CMS operator-key session and restricted access remain unchanged.

The freshly inventoried incumbent is release
`e8892c08eb1ea26e9675c8af87ebefef9866699d`, immutable image
`sha256:2760ce944f9393cde4388a2fe6e1ed5aba108a4f8ac48ad3dbcb41558c2462cc`,
and schema ledger 27. A mismatch stops this operator. This document describes the
procedure; successful deployment must be recorded separately in the validation plan.

## Preparation and release binding

Use `deployment/seo-remote.py` through the retained SSH transport with its existing
address, ED25519 host-key and instance/database checks. The new operator verifies
the exact canonical committed bytes of the D-180 and D-179 helpers. Their old
installation/upgrade entry points are not invoked as independent procedures.

Complete the applicable test, build, source comparison, private-content scan and
dependency gates before dispatch. Freeze the source commit, produce the exact
source archive with `deployment/package-release.mjs`, then produce its bound
runtime archive with `deployment/package-cms-runtime.mjs`. Runtime packaging
rebuilds and scans the fixed server, admin, maintenance and migration closure;
`source-public-sync.cjs` is the only additional runtime entry. The remote build
uses the retained cached immutable Node base with no network, package install or
image pull.

The fresh private inventory, verified source JSON bundle and referenced asset
archive travel separately from Git and release code. Every file is hash-verified.
Asset archive members must be regular files named exactly
`source-public/<sha256>.<approved-extension>`, with no directory entries, links,
duplicates or extra files. Metadata, length and digest must match the source
bundle. Existing files can only be reused byte-for-byte. The original CMS asset
root retains its prior filename rules; the one explicit `source-public` subdirectory
does not allow arbitrary paths. Recordings are outside this transfer.

`prepare` takes the commit and five SHA-256 arguments in order: source archive,
inventory, runtime archive, source JSON and asset archive. It verifies the current
applications/data/credentials and all 27 existing migration checksums, captures
private CMS/upload/configuration recovery and a full custom-format `pg_dump` of the
verified existing staging database. The dump stays mode 0600 in the protected
recovery directory; its header and `pg_restore --list` output are checked and its
size/hash are frozen with the recovery inputs. This archive check does not itself
prove restoration; the separately authorized disposable restore rehearsal must
also pass. Preparation validates the exact migration-28 files,
and creates frozen bridge, candidate and maintenance configurations. It does not
apply SQL or replace running applications. Preparation and every later operation
must stop on drift; never replace the frozen receipts to bypass a failed check.

## Bridge, import and verification

1. Run `bridge-canary`, then `activate-bridge`, then `verify`. The bridge is the
   new image with `SOURCE_PUBLIC_ENABLED=0`; it understands both schema 27 and 28.
   Both canaries use existing networks with no published host ports. Both existing
   applications must be healthy on the bridge before migration is allowed.
2. Run `migrate`. The non-HTTP maintenance command verifies the existing staging
   PostgreSQL 16 identity, owner-secret mount and explicit D-181 flags. It applies
   migration 28 transactionally and verifies an unchanged repeat. Only the three
   new source-public tables receive SELECT grants for the existing reader. The CMS
   writer, sessions, credentials, enrichment rows, reviews and publication states
   receive no new privileges or mutations.
3. Verified assets are added without overwriting prior bytes. The source bundle
   import is atomic and dependency-checked; an exact replay must add or update
   nothing. Immutable versions and import receipts remain available. A failure
   leaves the compatible bridge running; do not return to the schema-27-only image.
4. Run `canary`, `activate` and `verify`. The candidate differs from the bridge
   only by `SOURCE_PUBLIC_ENABLED=1`. Existing listeners, environment settings,
   networks, CMS mounts and secrets remain bound to their inventoried values.
   Verify actual HTTP source content, metadata, assets, original-public/enrichment
   separation, admin denial, protected editing, non-indexable staging and the URL
   comparison results through the approved existing tunnel.
5. Run `rollback`, `verify`, `reactivate`, and `verify`, with HTTP checks after each
   switch. Rollback selects the compatible feature-off bridge. It does not delete
   source versions, revert publication pointers, erase audit history, remove added
   assets or overwrite subsequent CMS edits. Failed application switches restore
   the observed compatible configuration and verify data preservation.

After schema 28, the old D-180 image is not a supported rollback target. Restore of
a source import is a separate audited pointer operation with later-change checks;
it is not part of ordinary application rollback. No schema down migration or data
deletion is part of this staging procedure. Keep private recovery/evidence out of
Git and release archives, and close verification-only tunnels/listeners afterward.
