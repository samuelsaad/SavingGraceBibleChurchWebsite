# Selected frontend staging validation — 1 October 2026

## Subsequent selective sermon integration

The next frontend-only milestone serves Claude's final V4/detail presentation
inside Astra's unchanged church website and shared shell. Deployed implementation:
`2245fa7f11f3b342d11d81258182c6c20854ef0e`. Full sources, package/image hashes,
86 focused tests, seven network tests, 811 standard passes/known failures,
64 live browser cases, 16 unchanged-page comparisons and preservation evidence
are in `claude-sermon-integration.md` alongside this record.
The previous selected release below is now its retained application rollback
target, not the current served implementation. Both databases and the exact
148-record eligible inventory remain unchanged. GitHub publication is still
pending the explicitly required dataset-branch governance amendment.

## Preserved earlier handoff evidence

Source: `codex/impeccable-church-redesign`,
`5d737e2f3522efd02e0c96d5cc31b8b37912e3b3`, clean.
Handoff branch: `frontend/astra-impeccable-staging`.
Deployed implementation: `ba52ae3c96a5f0cc093c50b0117b1a702635c84f`.
Subsequent handoff evidence is documentation only; no frontend design files differ
from the selected source. Claude's church-site commit
`6a51443d117cc9cb20e82f8d50046f77e7a4aa08` and creative/frontend branches remain
unchanged. The original checkout's untracked work remains untouched.

## Checks actually run

- Locked `npm ci --ignore-scripts --no-audit --no-fund` succeeded with existing
  package deprecation notices; no dependency or lockfile changed.
- Nine focused frontend/asset/staging/selector/schema test files: 69 passed.
- Final `npm test`: 806 passed, one existing admin-layout newline assertion
  failed, 126 gated PostgreSQL tests skipped. No PostgreSQL-write test is claimed.
- Serial `npm run check`: only the pre-existing exact-optional-properties error
  at `src/development-data/project-sermon-snapshot-cli.ts:38`; zero new errors.
  An initial parallel check/build run hit a Vite-cache rename race, so the check
  was rerun serially. The affected unrelated source remains unchanged.
- `npm run build`: 44 public church pages built successfully.
- `npm run staging:bundle`: all six existing sealed entry points built.
- `npm audit --offline`: zero cached vulnerabilities; this is not a fresh online audit.
- Both supported tracked dataset verification commands and the project-snapshot
  dry run passed, without database writes or operational acceptance restoration.
- Correct anonymized `migration:dry-run -- --input tests/fixtures/dry-run.json`:
  five inputs, three included, two excluded, zero rejected. An earlier invocation
  without `--input` refused without side effects.
- Reachable-history audit: 1,701 unique blobs; zero prohibited private paths,
  detected private keys/AWS access keys/Google client-secret values, or symlinks.
  Scanning 60 static/staging output text files against 7,419 protected content
  shingles found zero sermon-content leakage. Safe staged paths were reviewed
  and scanned separately; private utilities/evidence stayed ignored and unstaged.
- Browser-control initialization failed because its Windows sandbox helper could
  not apply ACLs. The already bundled Playwright library and installed Chrome
  completed the actual rendered checks instead, without screenshots/content logs.
- Two runtimes × 32 rendered cases: homepage, V1/V2/V4, About, Lord's Day,
  ministries, events, contact, giving and eligible detail, at 1440/390/320 widths
  as applicable. One h1, no horizontal overflow, no broken loaded images,
  no canonical/structured metadata, zero console errors, failed requests or
  erroneous responses. Desktop/mobile navigation, V4 keyword search and speaker
  filtering passed; the Bible shelf starts collapsed and media is not autoplayed.
- Five representative asset endpoints per runtime passed, including both fonts.
  The deployed official logo SHA-256 matches the frozen source bytes exactly.
- Live private admin/frontend/draft/config routes remain 401/404, unpublished
  church pages remain 404, and every checked response retains no-store/noindex.
  Robots disallows crawling. No sign-in or development identity was fabricated.

## Release and preservation

Archive: 206 approved dependency-closure paths, SHA-256
`32eb91413463ee3d04cfb04aebd5905ffc295a6f56f3d8eb0d6617d4385a81bd`,
independently verified after pinned SSH transfer. It contains no development
dataset, OAuth, local identity, raw caption, private evidence or database dump.

Image: `savinggrace-impeccable:ba52ae3c96a5f0cc093c50b0117b1a702635c84f`, ID
`sha256:143af5e00890347a8a953e01de2017205ae1d24e421e049991262989e92802f8`.
Built with the existing immutable Node image digest; both apps run this image.

Public staging: 191 stored, 148 eligible, 21 migrations, 144 published rows and
144 prior publication timestamps. Its complete 47-table/sequence fingerprint is
`7a6a1e2022e7971ab5401d2b21d27c826f9f06e535fb93b58021c48a64349ecf`.
Protected staging: 148 stored/eligible, 22 migrations, the same existing 144
publication markers. Its complete 49-table/sequence fingerprint is
`88723be3b21d75e0efd0affff285e702cbd5c46d7fdb3d107af3fae0dc36fce9`.
Both fingerprints match before, after, during rollback and after restoration.
The exact eligible set hash on both is
`4bf7dbdb97d7ef98e9dd1aa9153f0e04c977776f08e0ba0a420fb266304f1731`.
Database container identities and original configuration-file hashes also match.

Only application containers were recreated using protected application-only
Compose configurations and `up -d --no-deps app`. Existing host sockets/proxies,
public HTTP 8080, protected loopback 8082, PostgreSQL volumes, the separate draft
runtime and other services stayed unchanged. No migrations/data synchronization
or publication-state changes occurred. No production WordPress or database,
DNS, AWS configuration or unrelated service was accessed or modified.

## Rollback and access

Actual application-only rollback succeeded on both runtimes, with readiness and
unchanged fingerprints/membership, followed by restoration of the selected image.
Retained rollback targets:

- Public: `savinggrace-staging:6a51443d117cc9cb20e82f8d50046f77e7a4aa08`,
  image `sha256:9b054808f0a7f2e249f667388f02b1e60a4815be9eb6148e93a23d3187357ec6`.
- Protected: `savinggrace-d167-protected:1f3dc7c72f8fab971c2a358a4e71ce9e4c23999f`,
  image `sha256:94ce98be0fddd26f953ae8f09b5c986ced66bcfaba6420314ebeda985f4d0729`.

Root-only rollback configuration/evidence and its guarded helper are retained on
staging under `/opt/savinggrace-frontend-handoff/<deployed-commit>/`. An authorized
operator can invoke `frontend-rollout.py rollback <deployed-commit>` there through
strictly pinned SSH. It restores only apps, never databases or data. The same
helper's `deploy` operation restores this selected image.

Public: `http://54.253.237.138:8080/` and `/sermons-v4/`.
Protected: EC2 loopback 8082 via the existing strict-host-key SSH tunnel to an
available local loopback port (4398 was used for verification). Administration
remains denied; the protected visitor runtime uses SSH access, not personal login.
Both applications are left running. Temporary verification browser contexts closed.

## Outstanding GitHub control

Execution review rejected the first push before Git ran, stating that trusted
user messages did not explicitly authorize the full dataset-bearing history and
destination. No GitHub push occurred; read-only remote verification found no
dedicated branch. The requested existing dataset history is preserved and no
alternative upload or replacement history was attempted. Staging completion is
separate from the blocked GitHub handoff. The exact final local hash must be
reaffirmed through that control before claiming remote publication.
