# D-181 source-public staging rehearsal

This procedure adds the verified original-public source projection to the existing
sealed staging applications. It does not connect a production administrator,
change public DNS or traffic, mutate WordPress, or publish generated enrichment.
The existing CMS operator-key session and restricted access remain unchanged.

The historical first schema-27 preparation inventoried incumbent release
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

## Historical verified schema-28 application retry

The first D-181 attempt migrated and replayed the exact source bundle successfully, then stopped at the source canary. Its healthy compatible bridge is release `50711cf3858fe86bd69de8c3f153a0de7dc05927`, image `sha256:8ca2549af5b5e34dbc3be0cfbfcbfe6ba306ae8ca63d36c91ebab48b14aaf824`. No source candidate was activated by that attempt. The exact source-history fingerprint is `2cbe0faa1dfab33eab8c4c3e2817957f7d2b16537abbcb6fb0fc331e557de831`: 2351 immutable versions/routes and one import receipt.

That historical retry operator accepted only that bridge, all 28 existing migration checksums, that source-history fingerprint and the byte-identical original bundle. It captures fresh full recovery material and preserves the earlier attempt. Migration/import replay must change no source/CMS/editorial rows. Its prior image already supports schema 28; it is a safe application rollback target. No schema down or source-history reset is authorized.

Readonly timing isolated startup cost: the sampled native detail SQL took 71 ms and the related-sermon SQL 1977 ms. Startup formerly repeated related lookup across 398 records. The corrected snapshot method uses identical content eligibility and defers only related/semantic recommendation lookup until a detail request. Related metadata is cached per versioned source snapshot, with identity checks and retry after a failed lookup. Actual canary, activation, rollback and HTTP results still require final receipts; these measurements alone do not certify deployment.

## Expanded source delta - 10 October 2026

The expanded-data checkpoint application is `2bebefb74565ccd44602ee5be0c80d80a52818b9`, built offline as
`sha256:975d2a00a59b1cd38acd5d32e1a806d3a11f3b5fe9ee530db6fa0365d8963471`.
Its predecessor was the verified `4f127b5e5f702f639bd2b3ec36cd1fbb36420abb` release.
This operator is frozen to that incumbent, its 28-row schema ledger, the exact
2,351-route source fingerprint and the reviewed additive delta file hash. It is
not a reusable deployment authorization for arbitrary future bundles.

The import added 1,071 routes, updated two resource source-identity records and
retained 2,349 unchanged. All original content/metadata/media/asset bytes were
independently verified before transfer. Exact replay inserted/updated zero.
230 new unique files were added without replacing earlier asset bytes. Current
source history is 3,424 immutable versions, 3,422 active routes and two receipts;
its fingerprint is `7a1a5ffca195eb99c587eec12bb8a0903269c94c49794034d38525967c1f6845`.
Native sermons/publications (398/144) and CMS entities/revisions/routes/assets/audit
(52/68/97/47/81) remain unchanged. Full backup archive validation, bridge/candidate
canaries and activation preservation checks passed. Full restoration remains
blocked and unexecuted. Final rollback/reactivation and exhaustive HTTP/resource
results are recorded in the acceptance report when their receipts are complete.

Both deployed roots remain read-only, semantic visitor eligibility disabled,
public listener loopback-only and protected listener unpublished. Actual HTTP
checks return nonindexable content, no staging sitemap, public admin 401 and
protected admin redirect to login. No production host, DNS or WordPress was changed.

## Final application and verifier release

Application core `479e6541de9cfa81aac34db4a510767818c2782e` uses immutable image
`sha256:bda02f346c7b1228c32217f15df2757388896288e99c105c4c88e084076601c3`.
It adds direct canonical document links, meaningful captured calendar indexing and
server-side dependency hashing without a TTL or publication shortcut. Its exact
incumbent is the expanded-data release above; all source/CMS rows remain frozen.
The source archive SHA-256 is
`f24795bc2c16c5fadea420f45d17dea50c24071b7b8f40423bc1c9eb90f33298`,
runtime archive `353f5691c32601760d4c735cfca76b3f432152330f0717e66a717a6c7bf54ffd`,
and runtime scan manifest `ace9bd355a4dfbdaf1fade51f01f0f515d4ecd82d68c2455ca0a9397f0da5b0a`.

Committed verification utility `162b584ccf23d71338ca62a033815a5914170d79` normalizes
Windows relative evidence separators on Linux while rejecting absolute/UNC and
traversal paths. The first server-side whole-inventory attempt omitted source asset
witnesses and had one path-related source integrity failure; those are retained as
harness failures. The corrected final attempt includes all verified asset witnesses,
exact source/body hashes and confined path aliases. Neither attempt changes the
application, source content, public listeners, authentication or measurement settings.
Final HTTP, rollback and resource results belong to the bound acceptance record.

The final application completed bridge canary, exact import replay, candidate
canary, activation, compatible feature-off rollback and reactivation. Independent
HTTP checks recorded ten responses after each final switch. The retained rollback
HTTP witness SHA-256 is
`2c18fde4ad28f5b43be6683626aad85c4bf118fbaeeff207b556cb3d619941a1`;
it reports feature-off labels rather than claiming source content remained active.
The reactivated public/protected runtime labels are respectively
`84efbb9df1ced3eb6b1672b0747d21d31bd0c55d676bd2acba2035fc52bc10e5` and
`ff64543d99fc5688a187d912033b390a3b756844115a6e3b14ed072b1e7b29e4`.
Home, readiness and robots returned 200; sitemap returned 404 intentionally for
staging; public admin returned 401 and protected admin redirected to login.
Indexing exclusions, read-only roots, listener boundaries and the exact source/CMS
history were preserved. After reactivation, all 1,070 resource routes on each
runtime passed SHA-256, length and MIME checks: 2,140 checks, zero failures.
These are executed application rollback and durable-resource results. Full backup
restoration remains unexecuted and blocks cutover.

## Final download-button correction

The current application is `52dca271bef9e80c15ee76b9b46e2d85ae15de08`, image
`sha256:b11affa6ee5f919fea6796512d50f2cd43d0ca53a97133470b8658a172cce38f`.
The full preceding crawl found that download buttons bypassed the canonical link
resolver. This correction passes those buttons through the existing resolver;
stored CMS/source values, layout, media and database state remain unchanged.
Four actual deployed HTTP checks verified the forms/covenant pages on both runtimes.

The operator is pinned to the preceding `479e6541de9cfa81aac34db4a510767818c2782e`
incumbent and its image/history. The source archive SHA-256 is
`c085e7611c240249d0cc55181053c1967a3116647412427421c2e8ce72f8331e`, runtime archive
`2a11c42762b6d987debe3c667d229099b0b9ec6476eb9fb30b908e13962db1a0`, runtime
manifest `ec0c8e68c4249eee82d8b1300fba7bce5d2ac344a5302db4e95ba0b26e7eec4d`, and
scan-manifest file `308ef368c65546d23054522c5258ef593dbf370debaf860ae8d37eb4435335fb`.

Bridge/candidate canaries, exact replay, activation, compatible rollback and
reactivation passed with unchanged source/CMS/editorial state and credentials.
Ten actual HTTP checks after each switch passed. The rollback receipt SHA-256 is
`6094bb325565542dcb6927e8d3726df03682fd6f2c178b587108452a6d732cc4`.
Reactivated runtime labels are public
`e5740ae593aba55f241c5b3ee890f6d6f747a0a7aeb4ce3db673060f649ff74f` and protected
`bf224e0b926aeaba96b4da836c70946104475fbaf897dec6f4e5563f1b6b431c`.
The exact final full-inventory and resource results are bound in the acceptance
record. All earlier releases and failed harness attempts remain historical evidence.

After the final reactivation, both runtimes passed all 1,070 resource routes by
SHA-256, length and MIME: 2,140 checks, zero failures. The fresh checker initially
failed writing a 271-character Windows temporary-file path. Short-path output
resolved that harness failure; the failed attempts are retained and are not
reported as application or asset failures. The production comparison reused an
independently reparsed, hash-certified frozen source cache, verifying every source
file before/after the run and each source body on read. All candidate HTTP responses
were fresh. Its full inventory and internal-target checks completed with zero
internal redirects; no source-data or eligibility bypass was introduced.
