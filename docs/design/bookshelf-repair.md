# Bookshelf containment repair — 1 October 2026

Starting branch: `frontend/astra-impeccable-staging` at
`a3422186082da0e67ea73ebdf1f8c78d424fd240`.
The user's screenshot matches the shared Astra V1 shelf, not a database error.
Fixed spine heights and a flex column allowed longer names to consume the count
space. Three-digit badges could also wrap while retaining a one-line box height.
The scoped V4 body used platform-dependent condensed signage fonts, different
from the delivered Astra font and potentially different across computers.

One shared stylesheet now supplies both archive families with separate grid
label/count rows, an explicit centered column, measured responsive heights and
non-wrapping badges. Medium/long names use existing canonical abbreviations when
space is limited; full accessible names and server-rendered destinations remain.
Coarse-pointer spines retain 44px touch widths. Shelf names, badges and bookends
use the existing self-hosted Bitstream Vera Sans, without a new dependency or
global typography change. Claude's page composition and serif reading/display
roles are preserved. No label is clipped to conceal an overflow defect.

No content, route, selector, review, acceptance, schema or database write is part
of this repair. Homepage/church design, shared shell and original source branches
remain preserved. The intended rollout replaces only the two existing staging
application containers, retaining their current release
`2245fa7f11f3b342d11d81258182c6c20854ef0e` as application-only rollback.
Existing ports, configuration, database containers and exact 148-record eligible
membership must match before and after. No new public cohort is authorised.

## Verification before rollout

- An anonymous 66-book fixture reproduced 25 containment defects at 1440px and
  37 at 960/768px in V1. V4 showed two defects at smaller widths.
- The repaired fixture passed containment/font checks on both archive families
  at 1440, 960, 768, 390 and 320px, with zero label/count overlap or page overflow.
  Fixture-only desktop/mobile images were inspected; no sermon screenshot was taken.
- Focused checks: 90 passed across 12 files. Four new tests protect shared
  geometry/font delivery, responsive count space, all canonical names/order,
  accessible links and noninteractive empty books.
- Standard suite: 815 passed, one unchanged admin-layout source-newline assertion
  failed, 126 database cases remained gated. No database-write test is claimed.
- Astro/type check: the existing snapshot-importer optional-property error only;
  zero new warnings/hints. Static build: 44 pages. Sealed bundle: six entries.
- Offline production-dependency audit: zero cached vulnerabilities. Anonymous
  importer dry run: five inputs, three included, two excluded, zero rejected.
- Impeccable layout scan found no layout findings; type advisories concerned
  existing condensed bookend/ruler and Claude-specific sizes. The repaired shelf
  uses the existing 13px label floor, preserves meaningful colour contrast and
  keyboard focus, and does not introduce another font.

## Actual staging rollout

Both visitor apps serve repair commit
`a992448f0dfcc96c32b795efb89ea2ba5f4af74f` and image
`sha256:46b1cdfd7e00fd39ca8917ecc0553b4addcd7d84df1f5fa1484644192c0fc349`.
The 210-path application-only archive was independently hash-verified after
pinned SSH transfer:
`ce4d86e65359044bd5a4972448ac7c9432ff3f0756e3bb5c70b19ac7fb8a4afb`.
No dataset, credential, local configuration or private artifact is packaged.

Both health checks are healthy. The public 191-sermon database fingerprint
remains `7a6a1e2022e7971ab5401d2b21d27c826f9f06e535fb93b58021c48a64349ecf`;
the protected 148-sermon database fingerprint remains
`88723be3b21d75e0efd0affff285e702cbd5c46d7fdb3d107af3fae0dc36fce9`.
Container identities, migration ledgers, configuration hashes, publication states
and exact 148-identity eligible membership are unchanged. Admin, private API,
draft/frontend-preview and private-file routes remain denied with no-store/noindex.
Only application containers were replaced; original ports/proxies remain.
The retained rollback is the previous `2245fa7` release with root-only resolved
configurations and baseline evidence under the existing handoff convention.

All 16 live homepage/church/shell DOM/style/geometry preservation comparisons
passed. Live bookshelf diagnostics checked 820 visible labels/counts over both
archive families at five widths: zero glyphs or boxes outside their spines,
miscentered labels, font mismatches or overlapping labels/badges. An initial
browser assertion incorrectly compared rotated glyphs with their narrow CSS line
boxes. It was corrected to measure ink against the actual containing spine; the
demonstrated geometry is not concealed by clipping or a relaxed page-bound test.
The comprehensive live Chrome rerun passed: 32 rendered page cases per runtime
at 1440/390/320px, with 492 spine label/count checks each, zero console errors,
failed requests or erroneous responses. Navigation, keyword search, speaker
filtering, book/chapter links, pagination, eligible detail, ordered Q&A and
transcript toggles passed. The V4 shelf still starts collapsed. Five representative
assets passed per runtime. Media interaction used an inert locally fulfilled
iframe, without audio/video playback or any provider request. Real-content
checks returned only aggregate status/geometry, never screenshots or prose.

History/build audit: 1,730 existing blobs, 60 build text files, zero prohibited
paths, detected key/cloud/Google secrets, symlinks or protected-content matches
against 7,419 shingles. The five-file repair delta separately passed staged
secret/token/key/private-content scans. Source alternatives remain clean at their
original commits. No database write or production access occurred.

GitHub publication remains blocked: the scoped AGENTS amendment was rejected,
then rejected separately because execution review treated the question-prompt
approval as an untrusted tool record instead of a trusted user message.
No AGENTS amendment, push or alternative publication route has been applied.
The exact dedicated branch remains absent remotely. A directly typed protected-
file amendment approval is needed before this dataset-bearing history is pushed.
Only this task's anonymous fixture server, headless browser contexts and temporary
verification tunnel were closed. Both updated staging applications remain running.
