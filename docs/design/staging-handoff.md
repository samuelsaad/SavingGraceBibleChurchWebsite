# Astra + Impeccable frontend handoff

This branch preserves the completed **Sunday invitation** design from
`codex/impeccable-church-redesign` at
`5d737e2f3522efd02e0c96d5cc31b8b37912e3b3`. No creative revision is part of
this handoff. Claude's alternatives remain on their own branches. Church pages,
the official logo, embedded imagery, self-hosted licensed fonts, and the existing
SermonsV1, V2 and V4 routes are included. Privileged backend and content selectors
remain server-side.

Delivery status: both staging apps are updated and verified. The dedicated branch
is prepared locally, but its first GitHub push was rejected by execution review.
The checkout commands below become usable remotely once that exact reviewed
history is authorized through the execution control and the push is verified.
See `staging-verification.md` for actual results; do not assume a remote branch
exists from these setup instructions alone.

## Checkout and local church-page preview

Use Node.js 24 or later and npm with the committed lockfile:

```sh
git clone --branch frontend/astra-impeccable-staging https://github.com/samuelsaad/SavingGraceBibleChurchWebsite.git
cd SavingGraceBibleChurchWebsite
git switch -c your-development-branch
npm ci --ignore-scripts --no-audit --no-fund
npm run dev -- --host 127.0.0.1 --port 4401
```

Open `http://127.0.0.1:4401/`. Static church pages require neither Samuel's
credentials nor a database. This is not a populated sermon preview.

For database-backed sermons, use PostgreSQL 16 and the documented protected
local credential mechanism in README. The existing visitor-only launcher is:

```powershell
$env:RESTRICTED_LOCAL_PORT="4402"
$env:D167_RESTRICTED_ACCEPTANCE_ENABLED="1"
npx tsx deployment/accepted-local.ts
```

It reads `127.0.0.1:5432/savinggrace_sermons_test`, checks the exact 22-entry
migration journal, uses read-only connections and actual restricted acceptances,
and denies administration routes. Do not enable development identities or set
`DATABASE_URL` for this launcher. Stop a foreground preview with Ctrl+C.
Paths are `/`, `/sermons-v4/`, `/sermons-v1/`, `/sermons/`, `/about/`,
`/ministries/`, `/events/`, `/contact/` and the existing giving page.

## Supported development data

The existing tracked 15-sermon dataset and D-163 project snapshot remain in
their designated `development-data/` paths. Verify without importing:

```sh
npm run development-data:verify-current15
npm run development-data:verify-project-sermons
npm run development-data:dry-run-project-sermons
```

The README documents the guarded disposable-database importer. It requires
`DATABASE_URL` (a private local value), `ALLOW_LOCAL_DB_WRITE=1`, and its validated
`DISPOSABLE_TEST_DATABASE_TOKEN`; it must not target an existing application
database. It restores drafts, not operational approval, review authority or
frontend acceptance. Sanitized acceptance summaries do not populate the
restricted selector. A developer can inspect the data through the documented
local administrator workflow, but must not fabricate acceptance for a preview.

## Staging runtime and configuration

`npm run staging:bundle` and Dockerfile build the existing sealed, read-only
visitor runtime. Deployment packaging uses a committed dependency closure and
excludes development datasets, local identities, OAuth, models and private files.
Build arguments `NODE_IMAGE` and `RELEASE_COMMIT` identify immutable releases.
Configuration names include `APP_IMAGE`, `POSTGRES_IMAGE`, `RELEASE_COMMIT`,
`SECRET_DIRECTORY`, `DATABASE_VOLUME`, `PRIVATE_SUBNET`, `DB_PRIVATE_ADDRESS`,
`APP_PRIVATE_ADDRESS`, `VERIFICATION_DIRECTORY`, `STAGING_SEALED=1`,
`DB_HOST=db`, `DB_PORT=5432`, `DB_NAME=savinggrace_staging`, and the existing
restricted-selector flags. Secrets stay in protected files outside Git/images.

The public D-166 runtime keeps the D-161 selector and its exact existing
21-migration ledger via `STAGING_SCHEMA_MIGRATIONS=21`; that opt-in is refused
with D-162/D-167 selectors. The protected runtime keeps D-167 and the normal
exact 22 ledger. Both validate all journal checksums. This setting executes no
migrations and changes no data, acceptance or publication rules. Admin and
draft-preview routes remain unavailable in these visitor runtimes.

The public staging address is `http://54.253.237.138:8080/`. Protected staging
remains at EC2 loopback port 8082, reachable only through the established pinned
SSH tunnel. Both retain no-store/noindex behavior. This is not production.

Before replacing an app, retain its image and protected Compose/configuration
references. Use an application-only override and `up -d --no-deps app`; do not
restart a database, run migrations, copy data, or change proxies. A previous
image/config pair is the rollback target. Verify readiness, eligible membership
hashes, publication state and whole-database fingerprints before and after.

## Verification and known limitations

Run focused frontend/staging tests, `npm test`, `npm run check`, `npm run build`,
`npm run staging:bundle`, and `npm audit --offline`. Do not run check/build
simultaneously against the same Vite cache on Windows.

The selected source has two already documented failures: one newline-sensitive
admin-dashboard-layout assertion, and an exact-optional-properties error at
`src/development-data/project-sermon-snapshot-cli.ts:38`. Neither is introduced
by this handoff; neither is in the sealed visitor bundle. Standard tests gate
126 PostgreSQL cases unless the separately authorized guarded runner is used.
No database-write tests are claimed by this frontend-only deployment.
Production launch, public sign-in, contact-form mail delivery, and the pending
social-account destinations remain outside this staging handoff.
