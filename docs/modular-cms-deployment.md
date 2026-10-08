# Modular CMS: local and configured staging operation

D-179 extends the existing application. It does not create a public administrator
login, replace church-owned production authentication, alter sermon acceptance,
or change production traffic.

## Local operation

Use the existing protected PostgreSQL password lookup. The default target remains
PostgreSQL 16 at `127.0.0.1:5432/savinggrace_sermons_test`; an optional
`DATABASE_URL` must pass the same exact target guard. Credentials never belong in
commands, documents, output or tracked files.

1. Create a protected, Git-ignored recovery directory. Set its absolute path as
   `CMS_RECOVERY_DIRECTORY` and set `ALLOW_LOCAL_DB_WRITE=1`.
2. Run `node --import tsx src/cms/local-initialize.ts initialize` only after the
   database verification gates pass. It freezes private CMS recovery material,
   applies exact migration 0027, registers existing embedded assets and imports
   stable seed identities. A rerun retains every later administrator edit.
3. Run `node deployment/build-cms-admin.mjs` to package the existing dashboard.
4. Set an absolute persistent `CMS_STORAGE_DIRECTORY`, outside build/release
   directories. Set `ENABLE_LOCAL_TEST_IDENTITIES=1` for the explicitly enabled
   loopback development entry, then run
   `node --import tsx src/cms/local-server.ts`.
5. Open `http://127.0.0.1:4430/admin/login` and choose **Open local administration**.
   The session is truthfully attributed to the existing development identity.
   `CMS_PORT` may choose another unused loopback port.

Without the development-entry flag, the local service instead requires a
protected `CMS_SESSION_SECRET_FILE` containing a random 64-character hexadecimal
operator key. This same secret-backed mechanism is mandatory on protected staging;
development identity settings are rejected there.

Local CMS uses the existing sermon administrator service through its session
identity and CSRF boundary. It also keeps a separate read-only eligible sermon
repository for visitor pages and curated selection. Existing other listeners
remain untouched.

## Persistent assets

The existing `media_assets` table records immutable upload keys, MIME, size,
checksum, dimensions, original name and alt text. Existing embedded imagery keeps
its original URL and bytes. Image placement captions and focal points belong to
the corresponding CMS revision.

Accepted uploads: JPEG, PNG, WebP and GIF up to 10 MiB, no larger than 20,000 pixels
on either axis or 40 million pixels in total; PDF up to 20 MiB. Size, MIME, magic
bytes and image dimensions are checked. SVG and HTML are refused. Files use
content-addressed names, exclusive creation, SHA-256 verification and path/symlink
guards. PDFs download with a sandbox policy. There is no destructive asset API.

Only an authenticated administrator or a current published reference permits a
new upload to be retrieved. Draft-only uploads remain private. The upload service
writes to one dedicated persistent directory. Visitor applications mount that
directory read-only; protected CMS alone receives a writable mount.

## Protected staging architecture

The existing sealed staging server keeps its listener, proxy, containers and
networks. `createStagingCmsIntegration` changes request handling only. The
public runtime always denies administration and keeps its read-only database
credential. The protected runtime has a separate secret-backed CMS session and a
dedicated `staging_cms_writer` credential.

The writer receives SELECT/INSERT/UPDATE on CMS entities and routes;
SELECT/INSERT on immutable revisions and assets; and INSERT on audits.
It receives no sermon access, ownership, role membership, schema/database CREATE,
revision/asset/audit UPDATE or DELETE, TRUNCATE, or sequence privileges.
Its full effective privilege set is checked at startup and readiness.
The protected CMS dashboard explains that sermon administration remains local.

CMS session cookies are HttpOnly and SameSite=Strict, have an eight-hour lifetime
and support logout. Login uses an expiring single-use nonce, bounded attempts and
the operator key. Mutations require both exact Origin and a session-bound CSRF
token. Same-origin Referrer-Policy preserves native browser form Origin; null and
cross-origin requests remain rejected. Protected preview selects one revision
over the published snapshot and remains no-store/noindex.

## Guarded deployment sequence

The operator is `deployment/cms-remote.py`. Run it only through the existing
pinned SSH transport, with DNS/address, ED25519 pin and instance identity checks.
The ignored inventory driver reuses retained connection references without
printing them. All operator output is status/count/hash data.

1. `inventory` reads exact existing releases, images, configuration hashes,
   binding scopes, network-name hashes, schema counts, capability/root filesystem
   state and available storage. Preserve this receipt privately.
2. Commit and package the verified source closure with `package-release.mjs`.
   Run `package-cms-runtime.mjs` with the same external `STAGING_PACKAGE_DIRECTORY`
   and a fresh ignored `CMS_RUNTIME_SCAN_MANIFEST` ending in `.private.json`.
   It rebuilds the committed closure, verifies all source inputs, runs the outgoing
   privacy scan and packages only fixed runtime JavaScript/admin files and exact
   committed migrations. The manifest binds the Git commit, source archive and
   every runtime file hash. Private dependency provenance remains outside the tar.
   Independently hash both archives, inventory receipt and operator, transfer them
   into a fresh protected release directory, and verify destination hashes.
   Do not transfer credentials or development datasets.
3. `prepare <commit> <archive-sha256> <inventory-sha256> <runtime-sha256>` refuses drift, binds all
   generated configurations and recovery artifacts, captures unrelated
   table/sequence fingerprints and scoped CMS/upload backups, and builds the
   immutable image from `Dockerfile.cms-runtime`. This copy-only build uses the
   already cached immutable Node digest, `--pull=false` and `--network=none`;
   it performs no dependency installation or registry request. Bundles contain
   all dependencies except Node builtins and unused optional `pg-native`; forced
   native PostgreSQL configuration is refused. Build diagnostics stay private.
   It changes no incumbent application or database.
4. `bridge-canary <commit>`, then `activate-bridge <commit>`, verify the exact
   26/27-compatible reader before schema changes. Canaries have no host ports.
5. `initialize <commit>` runs the gated non-HTTP maintenance bundle, seeds
   idempotently, creates the dedicated least-privilege writer and grants the
   existing reader SELECT on the additive CMS tables. Repeat initialization and
   prove unchanged content/revisions/assets.
6. `canary <commit>`, then `activate <commit>`, verify both existing
   applications. Admin routes must remain denied on public staging. Run actual
   protected-session, edit/publish, draft isolation, concurrency, upload and
   restart-persistence browser checks before declaring delivery.
7. `rollback <commit>` returns only applications to the compatible bridge;
   `reactivate <commit>` returns to the candidate. Both retain all CMS revisions,
   uploads, sermon data and audit history. Verify both directions.

The operator preserves original images/configurations and hashed recovery files.
It never restores a whole database or drops a populated revision history. A role
creation interrupted after the database commit but before its private receipt
stops safely on rerun; independently reconcile exact role grants and secret
identity before recording recovery. Do not drop/recreate that role blindly.

The initial read-only inventory on 8 October 2026 found both applications healthy
at release `e17b5f487eca77bb1e8496be91e0382aca746b47`, ledger 26, 398 stored sermons,
visitor Related themes disabled and approximately 23 GB free. The public
application already had its loopback 8080 mapping and two existing networks;
the protected application had one private network and no Docker host-port mapping.
These incumbent settings were preserved during delivery. Both applications now
serve implementation `7b411d957d6b468f6d9b1bffa8e21efe40d4de2d` with ledger 27.
Actual rollback/reactivation, browser editing, restart persistence, restoration
and no-clobber reruns passed; see the final receipt in
`docs/modular-cms-validation.md` for exact image, hashes and access checks.

## Administrator access

Local administration remains at `http://127.0.0.1:4430/admin/login`, using the
explicit **Open local administration** development entry. Protected staging uses
`http://127.0.0.1:4396/admin/login` through the existing pinned SSH tunnel and
requires the separately protected operator key. Retrieve that key only through
the established operator workflow into owner-restricted private storage; never
place it in documentation, browser screenshots, commands, logs or Git. Public
staging continues to deny administration.

## Verification

- `npm test`, guarded `npm run test:postgres`, type/Astro checks, production and
  staging builds, offline audit and the repository's privacy/security scans.
- `tests/cms-session-assets.test.ts`: session, Origin/CSRF, upload format,
  immutable deduplication, reconstruction persistence and publication gates.
- `tests/helpers/cms-login-browser.mjs`: actual native Edge form behavior using
  anonymous data and a temporary loopback server. Set `PLAYWRIGHT_MODULE_PATH`
  to the installed Playwright module when it is outside normal resolution.
- Staging bundles allow the incumbent dashboard's pure
  `sermon-enrichment-policy.ts` provenance parser, which has no imports,
  filesystem, network or environment access. Other enrichment/provider/private
  implementation remains excluded.

Preparation, compilation and synthetic tests do not establish live deployment.
No production sign-in, production rollout or semantic quality approval is implied.
