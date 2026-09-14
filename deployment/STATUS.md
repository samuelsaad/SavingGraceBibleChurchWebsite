# Sealed staging release: deployed and recovery verified

## Current completion — 14 September 2026

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
