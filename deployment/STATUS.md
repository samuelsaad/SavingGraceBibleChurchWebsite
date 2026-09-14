# Sealed staging release: local verification complete, remote execution blocked

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
