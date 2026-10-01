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

Live rendering, preservation, package/image hashes and GitHub outcome are to be
recorded after execution. Builds alone do not prove live layout correctness.
GitHub publication remains blocked at this checkpoint: execution review did not
accept the question-prompt response as a trusted protected-file amendment.
No AGENTS amendment or alternative publication route has been applied.
