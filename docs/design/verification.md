# Isolated church redesign verification — 28 September 2026

## Scope and direction

Branch `codex/impeccable-church-redesign` starts at
`0e7299d52fd221b8723284aebc5f147285b7086f`. It is a separate presentation
alternative, not a replacement of Claude's branch or a staging release.
No database, migration, sermon processing, review, acceptance, publication,
administrator implementation, dependency or deployment change was made.

Three complete homepage concepts were rendered at desktop and mobile sizes
before selection. The chosen **Sunday invitation** makes the real church,
Sunday time, Westmeadows address and visit action legible first, then introduces
the congregation, beliefs, teaching and calendar. Original church photography
and the official logo supply the identity. See
[the comparison](homepage-exploration.md), `PRODUCT.md` and `DESIGN.md`.
Questions were skipped because Samuel explicitly delegated aesthetic selection.
HeartCry, Grace to You and Ligonier were inspiration, not content or asset sources.

All original public church routes and content remain server-rendered. The
homepage inventory, church content registry, logo and 45 original image assets
are preserved. Long-form pages use a readable measure; ministry directories
use ruled rows; the calendar retains every occurrence while disclosing later
dates. SermonsV1, SermonsV2 and SermonsV4 retain their routes and functionality.
The catalogue's Bible-book colours remain meaningful metadata.

## Rendered critique, audit and applied corrections

- Initial concept comparison: three distinct compositions, navigation treatments,
  photographic layouts and typographic characters, at 1440 and 390 pixels.
- Independent visual review identified an overlapping Latest badge, delayed
  mobile contact actions, excessive repeated calendar dates, oversized long
  headings, misleading social placeholders and a misplaced passage label.
  All were corrected and confirmed by the same reviewer. Final disposition:
  **ship for the scored fixes**, not a production-readiness certification.
- Technical critique ran the installed detector once over eight page-renderer
  files: no detector findings. The strict script-hash CSP correctly blocked
  overlay execution, so no overlay was used and no protection was weakened.
- Actual browser confirmation used installed Edge with Playwright after the
  computer-use browser surface was unavailable. Four widths (1440, 1024, 390,
  320) across 14 representative routes produced 56 successful page checks:
  no broken images, horizontal document overflow, missing/duplicate main
  headings or JavaScript errors in the checked matrix. Keyboard Menu/Escape,
  no-JavaScript navigation and reduced-motion behavior were checked.
- Technical findings corrected: giving-heading and footer-link contrast,
  secondary link target height, enlarged-text reflow, clipped media consent,
  and the 1024px sermon body's placement in the narrow book-tab grid column.
  Focused confirmation passed all named cases. Measured contrast of the two
  corrected combinations: 11.52:1 and 8.04:1. Named target heights were at
  least 44px. Root text doubled from 16px to 32px at 320/390px; this is text
  enlargement evidence, not a claim of native browser zoom or complete WCAG
  certification.
- Long reading was confirmed with an explicitly synthetic 4,860-word transcript
  and seven ordered synthetic Q&A pairs. The media consent control was checked
  without loading audio/video. Only public church material and anonymized
  fixtures were captured; no real sermon screenshots or external media requests.

## Repository checks

| Check | Actual result |
| --- | --- |
| Locked dependency installation | Offline `npm ci` succeeded; dependency manifests unchanged. |
| Focused affected tests | 69 tests passed in eight files in the final focused run. Earlier wider focused coverage passed 137 tests. |
| Complete `npm test` | 803 passed, one existing failure, 126 database-gated skips; 930 total. |
| Existing standard failure | `admin-dashboard-layout.test.ts` LF source-shape assertion; relevant admin/test files unchanged from base. Not hidden or weakened. |
| `npm run build` | Passed: 44 public church pages and static assets. |
| `npm run check` | One existing `exactOptionalPropertyTypes` error in `project-sermon-snapshot-cli.ts:38`; zero warnings/hints across 410 files. That file is unchanged. |
| Anonymized importer dry run | Five inputs, three included, two excluded, zero rejected; no database write. |
| Offline dependency audit | Zero cached advisories; not a fresh online security audit. |
| PostgreSQL write/integration suite | Not run for this presentation-only task; no current authority for disposable database writes. Skipped database tests are not pass evidence. |

Additional regressions cover original home copy and images, canonical paths,
private-route denial, noindex/no-store, navigation fallback and keyboard state,
strict script hashes, font allowlisting and byte-identical licensed font assets.
The only CSP addition is same-origin fonts; no external font origin, inline-script
permission or authentication bypass was added.

Changed/staged files are checked for credential/token/private-key patterns,
prohibited paths, symlinks, private-artifact leakage and unexpected scope.
Build text is checked for synthetic/private artifact markers and secret patterns.
The final scan covers 50 intentional paths and 48 build text files with no new
findings. One historical local-path reference already present in the validation
plan is unchanged from the base commit; it was recorded separately, not erased
or represented as a newly introduced secret.
The original third-party font license retains its own trailing whitespace and
final blank line. Git text conversion is disabled for that one path, and its
staged bytes must match the documented source hash; application diff whitespace
checks exclude only this deliberately unmodified third-party license.
Browser captures, local QA servers/scripts and review working evidence are ignored
and excluded from commits. The complete staged diff is reviewed before commit.

## Real read-only preview

The existing `deployment/accepted-local.ts` runtime binds to `127.0.0.1` and
uses the established `d167_restricted_accepted` selector with a forced read-only
PostgreSQL connection. Read-only target checks verify PostgreSQL 16 at
`127.0.0.1:5432/savinggrace_sermons_test`. The actual observed counts are
**296 stored / 148 restricted eligible / 15 ordinary-public eligible**.
No counts were forced and no eligibility or content was changed.

The isolated preview uses port 4401. Home, all sermon archive variants,
representative church pages, fonts, logo, imagery and an eligible real sermon
detail are checked by local HTTP without printing its identity or prose.
Admin and authenticated-preview routes stay disabled in this visitor-only
runtime. It has no personal sign-in or development-admin identity. Pages retain
private no-store/noindex headers and omit public canonical/Open Graph/structured
metadata; robots disallows all and mutation requests are refused.

## Limits and recovery

This is a local design preview, not a deployable release approval. The two
unrelated repository failures remain. Automated/browser checks are bounded,
not exhaustive accessibility certification. Existing unconfigured newsletter,
contact-submission and social integrations were not invented; direct contact
links remain available and placeholders are honest.

An external font request was blocked by execution review. It was not retried or
routed to another provider. Original licensed Bitstream Vera Sans from the
installed offline runtime is self-hosted with its complete license and byte
hashes in `src/frontend/assets/fonts/README.md`.

Recovery is to stop this isolated loopback preview and return to an existing
alternative worktree. No database restore, migration rollback, branch rewrite
or service deployment is involved. Previous branches and unrelated listeners
remain untouched. The final preview is left running for Samuel; temporary
concept/fixture servers are stopped after verification.
