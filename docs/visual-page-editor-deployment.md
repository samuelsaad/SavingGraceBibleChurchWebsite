# Visual page editor: deployment and production connection — D-180

The visual editor extends the existing CMS and website renderers. Content remains
in PostgreSQL revisions and published pointers; uploads remain in the existing
durable asset store. Saving, previewing and publishing ordinary content do not
require a build or application restart. Installing a changed editor application
uses the guarded release procedure below.

This document describes the procedure, not an assertion that the visual editor
has been deployed. Record the actual release, image, browser results and rollback
receipt in the final validation evidence after those steps succeed.

## Current supported destinations

| Destination | Administrator entry | Identity and publication scope |
| --- | --- | --- |
| Local development | `http://127.0.0.1:4430/admin/login` | Explicit local development identity; publication changes the guarded local CMS only. |
| Protected staging | `http://127.0.0.1:4396/admin/login` through the existing SSH tunnel | Existing protected operator-key session; publication changes the existing staging CMS. |
| Production | Not configured | No connected replacement-site production administrator or publication target. |

After signing in, open `/admin/cms` and select an existing page. The visual editor
is the default; the advanced form editor remains available. The toolbar labels the
actual local or staging destination. The staging runtime's `NODE_ENV=production`
setting is a Node deployment mode, not evidence of a production website target.

## Application-only staging upgrade

Use `deployment/cms-upgrade-remote.py` for D-180. The older `cms-remote.py` remains
a checksum-pinned verification/build helper; its initial-install commands are not
part of this upgrade. Do not rerun initialization, migrate, recreate writer roles,
rotate operator credentials or replace staging content from local data.

The approved incumbent is the previously delivered CMS implementation
`7b411d957d6b468f6d9b1bffa8e21efe40d4de2d`, with image
`sha256:53bef03bba2c58e5e88c3415c7a41dc584e2336c91bebdb4121e9d4e55f848fd`
and schema ledger 27. A different incumbent, changed inventory, changed secret,
changed migration checksum or unknown application configuration stops the upgrade.
A later release must receive its own reviewed incumbent binding.

1. Finish applicable tests, browser checks, type checks, public/staging builds,
   anonymized importer dry run, offline dependency audit and outgoing privacy scans.
   Review the outgoing diff and commit only authorized source, tests and safe
   documentation on `codex/visual-page-editor`. Existing approved dataset history
   is retained unchanged; no new sermon-content export is part of this task.
2. Run a fresh read-only `inventory` through the established pinned SSH transport.
   Preserve its private receipt. The transport rechecks the expected address,
   ED25519 host key and instance identity without printing connection details.
   Inventory freezes both applications, current CMS and unrelated-data hashes,
   schema, existing upload hashes and protected credential-file hashes.
3. Build the committed closure and run `deployment/package-release.mjs` with an
   absolute `STAGING_PACKAGE_DIRECTORY` outside the checkout. Then run
   `deployment/package-cms-runtime.mjs` with the same directory and a fresh ignored
   `CMS_RUNTIME_SCAN_MANIFEST` ending in `.private.json`. The runtime packager
   rebuilds, validates every committed source input, reruns the privacy scan and
   binds the fixed runtime/admin/migration files to the source archive and commit.
4. Transfer the two archives, inventory receipt and both operators to a fresh
   protected release directory using the pinned transport. Send operators from
   canonical committed Git bytes; Windows working-copy newline conversion must
   not change the helper checksum. Independently verify every transferred hash.
5. Run `prepare <commit> <source-sha256> <inventory-sha256> <runtime-sha256>`.
   Preparation captures protected CMS/upload recovery and incumbent configuration,
   verifies all 27 migration pairs against the existing ledger, and builds the
   copy-only image with the cached pinned Node base, `--network=none` and
   `--pull=false`. No package registry access or SQL mutation is performed.
6. Run `canary <commit>`. Both canaries use existing networks with no published
   host ports. Candidate and rollback configurations use immutable image IDs;
   their locally inspected IDs must match before any start. All Compose starts
   use `--pull never`. Existing public admin denial and protected writer/session
   guards remain part of application readiness.
7. Run `activate <commit>`, then `verify <commit>`. The two application changes
   retain every original environment setting, network, listener, secret and asset
   mount, apart from the selected immutable image and release label. Public assets
   stay read-only. A failed start or post-start image/configuration/content check
   returns both applications to their observed previous configurations.
8. Demonstrate the requested visual editing flows through the real protected
   browser session. Verify draft isolation, exact-revision publication, optimistic
   conflict handling, authenticated frame isolation, mobile/desktop previews,
   uploads, keyboard controls and public-route changes. Public staging must still
   deny administrator APIs and unpublished previews.
9. Run `rollback <commit>`, `verify <commit>`, `reactivate <commit>` and another
   verification. Reopen the browser and prove saved content/uploads survived.
   Rollback switches applications only: current drafts, publication pointers,
   immutable revisions, audit history and upload bytes are not reverted or deleted.
   Restore demonstration content through normal revision history and retain its
   audit evidence.

The operator retains protected recovery and verifies original immutable revisions,
assets and audit records. Each switch also compares the exact current CMS state
and upload manifest before and after the operation, allowing previously saved
administrator edits to survive application rollback. Concurrent drift stops a
success claim. Recovery never restores a whole database or drops populated CMS
history. The protected staging writer retains its existing least-privilege guard;
it gains no sermon/review/acceptance or semantic write capability.

## Exact production connection still required

The existing production website remains the legacy WordPress system. A canonical
church URL in metadata does not configure a replacement application deployment.
The current CMS entry points are deliberately local or sealed staging:
`src/cms/local-server.ts` refuses production mode, and
`src/cms/staging-integration.ts` requires the sealed staging environment.
`CmsSessionProvider` accepts only loopback origins and identifies a local or staging
operator. It is not the individually attributable church administrator sign-in
required by the architecture plan.

Connecting production therefore requires these actual deployment decisions and
integrations, rather than relabeling a staging URL:

- A selected replacement-site production runtime and HTTPS administrator/public
  origins, with its reverse proxy, deployment access and secret-provider wiring.
- The church-selected identity provider with individual administrator accounts
  and MFA, verified through the existing `IdentityProvider` boundary, plus a
  production session/CSRF adapter and truthful administrator audit attribution.
- The guarded production PostgreSQL destination and least-privilege CMS reader/
  writer credentials, tested schema readiness and recovery, and a durable upload
  store mounted with the same private-draft/public-reference rules.
- A production request/rendering adapter that reads the same published CMS
  revisions and serves the real website. If production adds a static build or
  CDN cache, its publication hook and invalidation must be connected and verified
  before successful publication is reported.
- Approved whole-site SEO/cutover and rollback gates before changing live traffic.
  Existing sermon eligibility and the Related themes human release gate remain
  independent of ordinary page publication.

No selected production identity provider, configured replacement CMS runtime,
production database/asset destination or production publishing adapter is supplied
by the present local/staging configuration. Local and staging complete the editor
verification boundary authorized by the brief. Production connection and live
cutover must be reported separately and must never be inferred from those results.
