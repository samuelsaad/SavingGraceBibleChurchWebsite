# Sealed staging release: deployed and recovery verified

## Frontend discovery and menu correction — 14 September 2026

This application-only release supersedes the running-code entry in the historical
D-158 report below. It does not change D-158 acceptance, data or migration state.

- Starting checkpoint: `ac11d2f3a8374b2ac778f0034731d238bf27f2c0`.
- Running local and staging code: `903e386f10f34001a04f3355ec096518c68e0ab8`.
- Immutable image: `sha256:87cbe1e092f68cc5713935fb8bb51744fb1d196f92bd53aa362623939cdb60ac`.
- Image size: 231,926,940 bytes; preserved image archive: 237,325,824 bytes.
- Image archive SHA-256: `2d33ca8772151e12cd577709918d83340c91e17f09f5844bb977ad544d473b39`.
- Independently transferred/verified package: 119 safe paths;
  SHA-256 `f8635349355c28385857cb4d942ccea4a0ec83b81ad96af7676225ae0d18f443`.
- Server bundle SHA-256: `d5f6e031ead1a8e9a172c990b898e84e93da85a487f0eb50d85b4a465c46265c`.
- Database bundle SHA-256: `18fea25c9d28ba10835c04db863c142538e034effc65e7e861d0bc393fa44542`.

Reviewed primary-book evidence now reaches all shared card/detail projections,
broad book filtering and matching-collection counts. The previous legacy-only
join accounted for just 14 sermons/nine books. The current 144 eligible records
reconcile to 135 distinct book-associated sermons across 16 books and nine reviewed
no-single-primary outcomes. There are 135 associations (no duplicate inflation).
All 11 unresolved records remain absent from rendered pages and the restricted API.

The sealed renderer now delivers the existing SermonsV1/SermonsV2/Speakers/Series/
Books menu and its existing CSP-hashed enhancement. Taxonomy indexes link to the
complete paginated archive. The ordinary public context remains unchanged.
An explicit topical display classification has a distinct accessible plum tab;
the real cohort has zero authoritative topical assignments. Neither missing
metadata, the nine no-primary decisions nor two series memberships named Topical
are treated as topical classifications. See `frontend-discovery-corrections.md`.

The complete standard suite passed 629 tests; its 114 database-gated skips are
covered by the separate complete PostgreSQL run: 743 passed, zero skips, disposable
database removed. Type/Astro checks reported zero errors/warnings and one existing
private-helper hint. Production and staging builds, the fixture importer dry run
(five input, three included, two excluded), and cached offline dependency audit
(zero known cached vulnerabilities) passed. This is not a live advisory audit.
Credential, key, token, AWS, prohibited-path, symlink and private-content scans
passed against all 155 records and 1,092,303 protected eight-word sequences.
Staged bytes matched the scanned working files; no private artifacts were staged.

Real read-only browser verification passed separately on local port 4381 and the
staging tunnel on port 4380. Each checked all 144 identities across 16 archive
pages, all 16 books through their complete pagination, shared colours/labels and
vertical geometry, direct links and reload, speaker/series combinations, taxonomy
indexes, and all 11 exclusions. The exact existing menu passed mouse, double-click,
Enter/Space, ArrowDown/Tab, Escape/focus restoration, click-away dismissal and touch
checks at desktop, tablet and mobile widths. Minimum book-tab contrast was 6.15:1;
the invented topical fixture was 9.43:1. There were zero browser errors, external
requests, mutation requests or screenshots. No real topical specimen exists to
inspect; the fixture check is not represented as a real classification decision.

Additional real browser/API parity checks passed on both environments: the same
keyword query returned 138 results, a combined keyword/book/chapter/speaker/series
filter returned two, and an invented unmatched query returned zero. Full pagination,
filtered book counts and reload agreed throughout. A real numbered-book detail
strip was verified with no canonical, Open Graph, structured-data or autoplay iframe
output. Both extra browser runs reported zero errors.

The corrected image's two bundles match the scanned local build exactly. All 38
migration files remain byte-identical to the previous image and match Git after
line-ending normalization. An initial strict blob comparison flagged the existing
packaged CRLF representation; no migration bytes or meaning were changed to pass
that check. All six unchanged image layers retain the previously verified base;
all three changed layers contain only the 40 expected runtime files.

Only the application container was replaced. PostgreSQL's container identity,
start time, mounts and complete fingerprint remained unchanged. Both databases
still have 19 applied migrations with none pending; no migration, dump, restore,
acceptance operation or data transfer occurred. The full local fingerprint remains
`384c17e7c787391ffd6ef2d45c31d56df9db68d40d4de8c4fe4832e219044601`;
the staging fingerprint remains
`9a6bd12d804fde25e4597c6b9dc64d4b52f68b61a94e1f1be91178271934226f`.

The app and database are healthy. The app is non-root/read-only, has only its
read-only database-reader secret mount and retains its restart policy. Docker's
network remains internal, neither container publishes a host port, and the host
proxy still binds only loopback. No non-loopback TCP listener other than SSH was
found. Private routes return 401; noindex/no-store/CSP and disabled development
authentication remain enforced. Previous images, configuration, database volumes
and verified backups are preserved for app-only recovery. The temporary local
verification server was stopped; the working frontends and tunnel remain running.

Working URLs: `http://127.0.0.1:4381/` (local) and `http://127.0.0.1:4380/`
(sealed staging through the existing SSH tunnel). No sign-in implementation,
public-internet exposure, AWS change, Git push or merge was performed.

## D-158 restricted acceptance — 14 September 2026

The following supersedes the initial deployment's zero-publication totals below.
Samuel separately authorized migration 0019 and bulk acceptance/publication-state
changes for 144 completed sermons in local loopback and sealed staging only.
Eleven unresolved sermons remain unchanged and unavailable. This is not production
publication, public-internet exposure or implementation of administrator sign-in.

### Running release and protected artifacts

- Safe implementation: `e2b13990042ec5808b3265e825f1b6f6069daa6f`.
- Packaging correction/running code: `c08b044b1f1ba14344ad05a068c4ed32ca8b99ca`.
- Image ID: `sha256:21d2f747dd2f382a2b4cd157361cecf9f79ef9e695317c18d64fc07545ac47f8`.
- Image size: 231,922,055 bytes.
- Preserved image archive: 237,320,192 bytes;
  SHA-256 `b2b0acaaa862f17a3007d27e8e314bd214182c58429969b51115d8c3959ba0ca`.
- Verified release package: 119 safe paths;
  SHA-256 `dbe3d5c959bcdec8b27eb376a62c0a5a7552c11e74d7a55e5ec4a2ef03ba0089`.
- Server bundle SHA-256: `67c0ee84517f1242a32c98d2c55e9cceb826e4b90a1ee79172ad06374f808a7e`.
- Database bundle SHA-256: `3bf8d2e547626dde0a9fc5dba9e75446d598c75862573dc67930d51a6da1cdce`.
- Exact manifest SHA-256: `4759449bbbaed97238968d2fd4621d4137b8b4e41b73a20aeda319dc1212617c`.
- Fresh local logical backup: 3,631,563 bytes;
  SHA-256 `35a3c8f8a3afad1b0076ea633b7257343d97b905e8a2d63bcb60b927a9cfa8ff`.
- Fresh staging logical backup: 3,631,321 bytes;
  SHA-256 `d950f4b6e184fae281ee0a49033ab201359e9cda0d065dd47e47d7fac39c642c`.

Both protected custom-format backups were created and independently list/hash
verified before mutation. Existing dumps, volumes, images, failed-build package
and verification history were retained. Neither database was replaced wholesale.
The two previously excluded pure validator modules were the only Docker-context
change needed after the first build failed; the corrected package built successfully.
The running application does not mount a backup, manifest or verification directory.

### Independent database reconciliation

Both databases applied only `0019_restricted_bulk_acceptance`, accepted exactly
144 records and returned 144 unchanged on the identical second operation. Both
contain 155 sermons/transcripts/descriptions, 1,084 Q&A, 1,121 D-156 decisions,
847 D-157 components, 132 AI completions, 12 human completions, 144 publication
timestamps and 11 unchanged draft/unpublished records. Historical human approvals
were not manufactured or replaced. Separate bulk authority and system execution
are recorded with `manual_review_claimed=false`.

| Integrity check | Local | Sealed staging |
|---|---|---|
| Post-acceptance full fingerprint | `384c17e7c787391ffd6ef2d45c31d56df9db68d40d4de8c4fe4832e219044601` | `9a6bd12d804fde25e4597c6b9dc64d4b52f68b61a94e1f1be91178271934226f` |
| Unchanged-content/history projection | `e1c2a7b46dcc4caa87e50af14ed19a80482c12691ea1b3b7575a05e95f387475` | `1b66cab838f4557558327c68c1ab520d618ebe8ca2772ff2493d27152c714754` |

Each preservation projection exactly matches its own pre-change evidence, including
all 11 excluded rows. The pre-existing local navigation-only difference remains;
these two databases are deliberately not claimed to be byte-identical.

### Recovery, security and verification

Actual app-only recovery temporarily enabled the fail-closed switch: ordinary
routes returned 503 and private routes stayed 401. Restoring the same compatible
image/configuration returned ordinary routes to 200. The complete staging database
fingerprint stayed identical throughout. No real acceptance was withdrawn and no
history, trigger or current volume was removed. Disposable tests separately prove
audited withdrawal/replay and intentional refusal of destructive schema down after
receipts. A refused down migration is not described as a successful rollback.

Standard tests passed 623 with 113 database-gated skips. The complete guarded real
PostgreSQL suite passed all 736 tests with zero skips; its disposable database was
removed. Production build, type/Astro checks (zero errors/warnings), anonymized dry
run, offline dependency audit and seven network tests passed. Actual browser
verification passed independently in both environments: all 144 detail pages with
rendered descriptions, complete transcripts and Q&A order matched the database;
all 16 archive pages reconciled to the exact manifest. Landing/recent discovery,
keyword search, speaker/series/book filters, structured passage search, refresh,
three responsive widths and all 11 direct/API/search exclusions passed. There
were zero page errors, external requests, mutations or screenshots. Browser
processes were closed after verification; the requested servers/tunnel remain up.
Feed routes remain 404, robots disallows indexing, and the existing restricted
sitemap policy returns only the archive entry and no sermon entries. It was not
weakened to advertise restricted records. Both exposed local listeners are exactly
loopback; external probes could reach neither staging application nor PostgreSQL.

Two healthy containers retain `unless-stopped` restart policies. The network is
internal, Docker publishes zero ports, and the only app proxy listens on host
loopback. PostgreSQL has no host listener. The application remains non-root with
read-only filesystem and exactly one protected reader-secret bind mount; the
allowed temporary filesystem is separate. The database reader has zero table-write
privileges, is not superuser and cannot create schema objects. Forged development
identity requests remain denied on all three private route families. No AWS,
firewall, domain, HTTPS or public-network configuration was changed.

Image scanning traversed nine layers, 5,809 regular files and 40 application files.
No project credential or prohibited application artifact was found. Nine known
GnuTLS fixture patterns retain the previously verified official-base hash. Six
additional broad-pattern matches were individually reconciled to byte-identical
pinned official Node base files: two binary string-pattern collisions and four npm
documentation/definition placeholder headers with no complete key. No matched bytes
were exposed. The read-only comparison container had no network and was removed.
Source/build scanning found zero new private identities/prose/credential findings
against all 155 records and 1,092,303 protected eight-word shingles.

Ordinary accepted frontend URLs: `http://127.0.0.1:4381/` locally and
`http://127.0.0.1:4380/` through the pinned SSH tunnel. No administrator sign-in is
needed for these restricted visitor routes. Remote admin and private-preview
routes intentionally remain disabled. Existing local review/creative servers and
their original worktree diffs are preserved. Sign-in remains the next separate task.

## Prior initial deployment completion — 14 September 2026

Samuel's direct post-rejection authorization permitted the deployment. The remote
blocks recorded below are historical, not outstanding. The sealed application and
PostgreSQL are running; administrator/private-preview access is deliberately
disabled pending real authentication. SSH is transport security, not application
sign-in. No production access, public exposure, publication, push or protected
branch merge occurred.

### Exact release and artifacts

- Integrated source: `c36202ddbf14eb5376edc97472c22e0d396dc941`.
- Safe execution checkpoint: `83e1b6fe5e533e135f0c9edbd092b83e711f3178`.
- Packaging/network/restore commits: `d828df8622f08a4298fbbbb296bf0600a0f23e01`,
  `d86e4d41c1eaba7590713ae884c1e56fea1cc7ce`,
  `0d2f63269839b02ee3d63760b4cb52eeb7276f12`.
- Deployed application/build commit: `f9615104e80b03f46bfff758e9669003a3a0c5cf`.
- Image ID: `sha256:557c21dd006bb485d351e5bdc2678ede602b18db60bd2eb0e4e5c37e39297dea`.
- Image archive SHA-256: `c54c61f4f14f86cad1aa922d3696845491f093f4711629db276381503c960363`.
- Release package SHA-256: `145a38d7553014f6891f5507693be69426601f0d6de6348c7ed448c5a0b3817a`
  (95 files; 839,680 bytes).
- Logical dump SHA-256: `d403f69bb9f16807227a2b3de3a9826d7730cb5a4fe8c8d291be2808b73f06ee`
  (custom format; 3,631,551 bytes; no owner or ACL export).
- Snapshot file SHA-256: `9d223da36fca358177619a614b1e486545be7804b57ebf174dae64babe95766a`.
- Application image size: 231,212,184 bytes.
- Server bundle SHA-256: `16b8cf776d01ac2bf0c65465ec9023698f5970a2f429b4423cf4c82673f6b206`.
- Database bundle SHA-256: `b5e467b1f4c5f069f5eeffb2acbfb3b9ad0f69d96781fa6935c35ee3412ef19c`.

Installed Docker 25.0.14 (build `0bab007`) and official Compose 5.5.0. The Compose
binary matched SHA-256 `c57ab918abd5b05ca7e7d0f275875dd1330a695074f309dc9eab1b49efafcd4b`.
The image runs Node 24.21.0; staging PostgreSQL is 16.15. Local PostgreSQL 16.14's
logical snapshot restored identically across that minor-version difference.
Official base images were pinned to Node digest
`sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553`
and PostgreSQL digest
`sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825`.

### Restore, preservation and source drift

The initial empty-target, single-transaction restore and a second independent
empty-volume recovery both matched the same 41-table/sequence fingerprint:
`aea69e30be3c8072ef00a1fac901cc73800db04667a248df413492b4eee53908`.
All 18 migration ledger entries/checksums matched; zero migrations were pending
and none were replayed on the restored real database.

Both restores retained 155 sermons, transcripts and descriptions; 1,084 Q&A;
1,121 D-156 decisions; 847 D-157 component records; 132 AI private completions;
12 human completions; and 118 human description/Q&A approvals. There are 144
current private completions, 11 genuine exceptions and zero published sermons or
publication timestamps. No content, decision or provenance was rewritten.

The active service now uses the verified recovery volume. The first verified
volume, exact image archive, dump and fingerprint snapshot remain protected and
preserved. Restarting the recovered database/application pair passed readiness,
anonymous denial and the identical full fingerprint again. Docker and the
loopback socket are enabled for restart; an actual host reboot was not performed.

The snapshot was created at 2026-09-14 01:24:35.997 UTC. A final read-only local
comparison found one review-navigation update at 01:38:52.124 UTC, attributed to
the existing local development administrator. Only `current_stage`, `row_version`,
`updated_at` and `updated_by_subject` in `sermon_enrichment_reviews` changed.
All other 40 tables and sequence state, content, approvals, AI decisions,
completion markers, finding acknowledgement and audit fingerprints match. The
current local aggregate fingerprint is
`e528f0b50c7947f5635e40ff70cea60562b510a740dc358fcce0ff73f2f76e31`.
That later progress was neither overwritten nor synchronized to staging. Staging
is an exact verified snapshot, not a claim of continuous replication or current
whole-database equality. The unchanged local completed-frontend selector returns 12.

### Final verification results

| Verification | Actual result |
|---|---|
| Standard suite | 613 passed; 101 database-gated skips |
| Separate real PostgreSQL suite | 714 passed; zero skips; disposable database removed |
| Astro/type check | 256 files; zero errors, warnings or hints |
| Production and sealed builds | Passed; Windows/Linux runtime bytes identical |
| Focused staging contracts | Eight JavaScript tests and seven Python tests passed |
| Anonymized importer dry run | Five inputs, three included, two excluded, zero rejected |
| Offline dependency audit | Zero vulnerabilities in cached data; not a live registry audit |
| Staging HTTP/privacy | 363 checks; all 155 private HTML and API records excluded |
| Actual browser through SSH | Desktop/mobile home/archive, refresh, no overflow, private 401, zero page errors; no screenshots or external requests |
| Private-content scan | 1,092,303 protected eight-word shingles; no new code/output/response/log disclosure |
| Database authorization | Reader not superuser; zero table-write privileges; no schema CREATE |
| Remote resource checks | Two healthy containers; internal-only network; zero Docker-published ports |
| External port probes | App 8080 and database 5432 unreachable from the local external client |
| Recovery and restart | Separate empty-volume restore and recovered-pair restart passed full hashes |
| Source worktrees | Original seven backend and thirteen creative changes, commits, diff hashes and empty indexes preserved |

Final image inspection traversed all nine layers and 5,807 regular files, including
38 application files. No private application paths, application symlinks or project
secrets were found. Nine private-key PEM patterns belong to public upstream crypto
fixtures in the base image's GnuTLS binary. That entire binary was proven
byte-identical to the pinned official Node base, SHA-256
`779b25d20249988bea2c1aa6bbeb218f5ae7ea8a9d30ce4f54ea37372965cc4b`.
These were classified explicitly, not suppressed as an unrestricted scan exemption;
no project key or staging credential was present. No key bytes were emitted.

### Sealed runtime and remaining requirements

Both containers have `unless-stopped` restart policies and rotated logs. Application:
non-root, read-only filesystem, dropped capabilities, one CPU and 768 MiB. Database:
one CPU, 1,536 MiB and persistent named storage. Configuration/backups remain
outside releases/images with protected directories and file permissions. The
application mounts only its read-only-role password, never the owner credential.

Docker internal-only containers do not publish host ports. The corrected design
keeps both containers internal and uses the existing OS socket proxy on host
`127.0.0.1:8080`. It introduces no publicly bound listener or external container
network. The user's loopback SSH tunnel exposes `http://127.0.0.1:4380/` locally.
`/health/ready` reports the deployed `release` and `private_routes_disabled`.
Private administrator and preview routes return 401 even for forged development
identity headers/cookies. The public selector remains empty. No private sermon
content appears in routes, search, feeds, sitemap or SEO output.

The PEM remains outside Git/build contexts; only its explicitly authorized
sandbox ACL entry was removed when it reappeared. Strict pinned ED25519 checking
remained enabled. No PEM contents were read, printed or packaged. Existing local
review and creative-preview servers were left running.

The packaging corrections were confined to safe migration-path validation,
internal-network/loopback-proxy enforcement, profile-aware maintenance inspection
and explicit strict compiler semantics. No authentication or publication gate,
source sermon, database migration meaning or frontend design was weakened.

Real application sign-in, domain/HTTPS, off-instance backup retention and any AWS
snapshot/security-group changes remain separately authorized work. No AWS account
inventory or snapshot claim is made. The application/database remain inaccessible
from the public internet; the existing SSH entry point is still required.

## Historical pre-authorization checkpoint

The following records the earlier blocked state and initial local results. It is
retained as execution history and superseded by the completion evidence above.

## Checkpoint

- Integration branch: `staging-release-candidate`.
- Integration commit: `c36202ddbf14eb5376edc97472c22e0d396dc941`.
- Parents: backend `ae8755ab93e446fa8c6da1f7ad32a39218a0fd45` and creative frontend `eae2954a1d749d2fde0341c173866c8adcf0776e`.
- Original backend worktree still has its seven preserved changes and empty index.
- Original creative worktree still has its thirteen preserved changes and empty index.
- No protected branch was merged into, switched, reset, rebased or pushed.
- The existing local review and creative-preview servers remain running. The temporary integrated verification server was stopped.

## Actual local results

| Verification | Result |
|---|---|
| Standard suite | 611 passed; 101 database-gated skips |
| Separate real PostgreSQL suite | 712 passed; zero skips; exact disposable database removed |
| Astro/type check | Zero errors, warnings or hints |
| Production build and sealed runtime bundles | Passed |
| Anonymized importer dry run | Five inputs, three included, two excluded, zero rejected |
| Offline dependency audit | Zero vulnerabilities in cached advisory data |
| Anonymous browser regression | Five widths, five routes, six stages, keyboard/filter/zoom checks passed |
| Actual read-only integrated browser | 155 records, 144 private completions, 11 exceptions, both creative preview routes, refresh and anonymous denial passed |
| Privacy and security scan | 80 changed/new paths and ten outputs; 1,092,303 protected eight-word shingles; zero new findings |
| Index verification | All staged text matched scanned worktree content; no staged symlinks |
| Database preservation | Before/after whole-table and sequence fingerprint identical |

The database remains PostgreSQL 16 with 18 matching migrations and none pending:
155 sermons, transcripts and descriptions; 1,084 Q&A; 1,121 D-156 decisions; 847
D-157 component records; 132 AI private completions; 12 preserved human completions;
zero published sermons and zero publication timestamps. Current D-157 projection
has 144 completed reviews and 11 genuine exceptions. The unchanged stricter frontend
selector returns 12, not 144; private completion does not manufacture publication
or ordinary human artifact approvals.

Metadata-only integrity fingerprint across all 41 public tables and sequences:
`aea69e30be3c8072ef00a1fac901cc73800db04667a248df413492b4eee53908`.

No real content, approval, review progress or audit record was changed by this task.

## Execution-review outcomes

An initial proposed verification startup requiring a write opt-in and a root
maintenance-container setting was rejected and never applied. The accepted
alternative has no write opt-in, uses the existing read-only target guard, and
denies review mutations before routing. Its direct handler tests and actual browser
checks passed. Maintenance remains unprivileged.

A documentation check initially disputed the separation between standard gated
tests and a real PostgreSQL run. The final captured results above were independently
read and recorded separately before commitment.

The remote Docker installation was rejected before process creation. After the
latest user-designated attachment's explicit deployment authorization was read
again, the same operation was submitted through the same review control and rejected
again. The reviewer treated the attachment as insufficient trusted authority for
remote mutation and required a direct user authorization. No alternate execution
route was attempted after that rejection.

## Server remains unchanged

The final strictly pinned read-only EC2 inventory found Amazon Linux 2023, no
Docker/Compose/PostgreSQL installation or prior staging deployment, and only TCP
22 listening. Approximately 30 GiB free storage and 3.37 GiB available memory were
observed. The narrowly authorized PEM ACL correction removed only the reappeared
sandbox grant; other authorized entries were preserved and the key contents were
not read or copied.

No Docker package was installed, service enabled, deployment directory created,
image built on EC2, release transferred, dump created/transferred, restore performed,
migration applied or container started. No AWS account, firewall, DNS, HTTPS or
production setting changed. No application was made publicly reachable.

Therefore there are **no image identifiers, dump hashes, restore results, container
health results, rollback results or verified staging URL yet**. Do not represent
the deployment as complete.

## Remaining execution after direct authorization

1. Reconcile this exact branch, commit, current application database and protected
   source worktrees; preserve any intervening user edits.
2. Install official Docker and a checksum-verified pinned Compose plugin only on
   the established staging EC2, using the already pinned ED25519 SSH identity.
3. Package only the exact committed runtime dependency closure outside all Git and
   Docker contexts; build and inspect an immutable image.
4. Rehearse fresh PostgreSQL 16, migrations through 0018, anonymous denial, container
   restart and empty-target restore using anonymized data before real data transfer.
5. Create a protected consistent logical dump from the authorized local database;
   independently hash transferred dump and exact release package.
6. Restore into a new named staging volume and compare every table/sequence
   fingerprint plus migration checksums and review counts. Do not replay restored
   migrations. Grant a separate SELECT-only application role.
7. Verify loopback-only app port, no public PostgreSQL port, internal network,
   health/readiness, secrets/image-layer/log exclusion and private route denial.
8. Perform an actual restore/start rollback rehearsal into a separate recovery
   volume, retaining the original matching volume, image and dump.
9. Leave sealed containers running only after all checks pass. Do not push, merge
   protected branches, publish or access production.

A real authentication provider, domain/HTTPS, off-instance backup retention and
any AWS snapshot/security-group decisions remain separately scoped readiness work.
Admin/private-preview routes in this sealed release are disabled; SSH transport
does not replace application authentication.

## Integrated paths

The following paths belong to the integration commit (including the preserved
replacement of the older color test with the creative token-contrast coverage):

- `.dockerignore`
- `.gitignore`
- `CURRENT_PROJECT_HANDOVER.md`
- `decision-log.md`
- `deployment/build.mjs`
- `deployment/compose.yaml`
- `deployment/export-local.ts`
- `deployment/inspect-local.ts`
- `deployment/local-verification-server.ts`
- `deployment/package-release.mjs`
- `deployment/read-only-handler.ts`
- `deployment/README.md`
- `deployment/restore.py`
- `deployment/scan-local.ts`
- `deployment/verify-local-ui.mjs`
- `Dockerfile`
- `migration-validation-plan.md`
- `package.json`
- `public-sermon-experience.md`
- `README.md`
- `scripts/verify-admin-dashboard-ui.mjs`
- `src/admin/dashboard.ts`
- `src/development-data/preview-sermon-dataset.ts`
- `src/domain/development-seed-source.ts`
- `src/frontend/canon.ts`
- `src/frontend/components/catalogue.ts`
- `src/frontend/components/marks.ts`
- `src/frontend/components/media.ts`
- `src/frontend/components/search.ts`
- `src/frontend/components/sections.ts`
- `src/frontend/components/shelf.ts`
- `src/frontend/html.ts`
- `src/frontend/index.ts`
- `src/frontend/pages/archive.ts`
- `src/frontend/pages/boundary.ts`
- `src/frontend/pages/home.ts`
- `src/frontend/pages/sermon.ts`
- `src/frontend/pages/taxonomy.ts`
- `src/frontend/routes.ts`
- `src/frontend/scripts/canon.ts`
- `src/frontend/scripts/index.ts`
- `src/frontend/scripts/navigation.ts`
- `src/frontend/scripts/sermon.ts`
- `src/frontend/shell.ts`
- `src/frontend/styles/core.ts`
- `src/frontend/styles/index.ts`
- `src/frontend/styles/preview.ts`
- `src/frontend/styles/sermon.ts`
- `src/frontend/styles/shelf.ts`
- `src/frontend/tokens.ts`
- `src/frontend/xml.ts`
- `src/pages/404.astro`
- `src/pages/admin/index.astro`
- `src/pages/index.astro`
- `src/server/http/frontend-archive-loader.ts`
- `src/server/http/frontend-response.ts`
- `src/server/http/local-frontend-preview.ts`
- `src/server/http/public-sermon-page.ts`
- `src/server/queries/public-sermons.ts`
- `src/server/repositories/postgres-sermon-repository.ts`
- `src/server/repositories/sermon-repository.ts`
- `src/staging/database-cli.ts`
- `src/staging/database-verification.ts`
- `src/staging/guard.ts`
- `src/staging/handler.ts`
- `src/staging/server.ts`
- `tests/admin-dashboard-layout.test.ts`
- `tests/admin-dashboard.test.ts`
- `tests/frontend-accessibility-colors.test.ts`
- `tests/frontend-canon.test.ts`
- `tests/frontend-catalogue-tabs.test.ts`
- `tests/frontend-design-tokens.test.ts`
- `tests/frontend-navigation.test.ts`
- `tests/frontend-selector.test.ts`
- `tests/frontend-shell.test.ts`
- `tests/local-frontend-preview.test.ts`
- `tests/public-sermon-page.test.ts`
- `tests/public-sermon-site.test.ts`
- `tests/schema-contract.test.ts`
- `tests/staging.test.ts`
- `tsconfig.json`
