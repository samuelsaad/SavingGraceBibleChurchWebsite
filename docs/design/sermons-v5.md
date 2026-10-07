# SermonsV5 design and verification

## D-176 integration into the current release

The original V5 visual world and interactions are retained. Only additive route,
navigation, stored media duration and scoped Arabic language compatibility are
integrated into the current backend. No detail/transcript loading is added to the
archive. Current optimized eligibility and privacy safeguards remain unchanged.
Original dirty work is preserved; this integration is on the current delivery branch.
The actual candidate passes desktop/tablet/mobile at 1440/768/390/320, keyboard
description toggles with unchanged content hashes, mobile menu access, semantic
tables, no-JavaScript full descriptions and existing detail/older routes. No overflow,
client error, external playback or review write occurred. Detector: zero antipatterns,
twelve existing compact-size advisories. This is bounded browser/code verification,
not complete accessibility certification. GitHub/public activation remain pending.


## Scope — 2 October 2026

V5 is an ordinary extension of the current church design system at
`/sermons-v5/`, with its own pagination and authenticated preview route.
Its direction is recorded in
`.impeccable/surfaces/src-frontend-pages-sermons-v5-ts.md`.
The existing `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` remain
authoritative and unchanged; this note documents only the V5 additions.

The refined composition combines the existing complete finder and closed
Bible-book disclosure with a featured latest available recording, compact
horizontal sermon entries, expandable descriptions, coloured inactive media
icons and redesigned Series and Speakers tables. It inherits mineral-blue ink,
white and pale sky surfaces, self-hosted Vera Sans, semantic Bible-book colours
and fine dividing rules. No new font, raster asset, dependency or global design
token is introduced.

Current refinement finish disposition: **ship**, with no UI defects found in
the fresh review. Automated, anonymous visual and authenticated live checks
are recorded below with the existing repository verification limitations.

## Composition and behaviour

- `src/frontend/pages/sermons-v5.ts` renders a pale-blue heading band, the
  shared finder and the folded shelf or selected-book panel. On the unfiltered
  first page, the first eligible record is featured beneath the shelf under
  "Last Week’s Sermon", explicitly qualified as "Latest available recording".
  Its stored date remains visible; the heading does not establish that the
  recording occurred in the preceding calendar week. The remaining entries
  follow under Recent sermons without repeating the featured record.
- Filtered, expanded and paginated views retain their normal results and
  pagination without the featured section. Series and Speakers follow them.
- The finder uses `sermonsV5Target`; searches, filters, removable tokens,
  expanded recent browsing and pagination retain V5. The shared canon script
  recognizes `#v5-results` for keyboard focus after navigation.
- `shelfFold` accepts an archive target and ID prefix. Its defaults remain
  `sermonsV4Target` and `v4`, preserving existing V4 callers and presentation.
  The native disclosure is closed on first load and retains the shelf's
  keyboard and skip-link behaviour.
- `src/frontend/components/sermon-journal.ts` retains compact journal rows:
  narrow Bible-book tab, passage and recording duration at left, date at right,
  title, existing summary, series links and the verified speaker byline. A
  separate Open sermon link sits beneath the speaker on the wide layout.
- Duration uses only stored `primaryMedia.durationSeconds`, projected from the
  existing media column. Positive safe whole seconds format as `m:ss` or
  `h:mm:ss`; absent, zero or invalid values show "Duration unavailable". No
  transcript-length or cue-timing estimate is made.
- YouTube, audio and transcript shortcut icons are inert spans labelled
  "not yet active". Existing burgundy, green and blue tokens distinguish them
  on pale tinted grounds. They are not links, buttons or media-loading actions.
- See more and See less control the sermon description. Its complete escaped
  paragraphs appear once in initial HTML. The V5-only `journal` enhancement
  collapses overflowing descriptions to three lines and reveals a native
  button with `aria-expanded` and `aria-controls`; short descriptions have no
  visible toggle. It rechecks fit after fonts load and on resize. Expansion
  makes no request and inserts no duplicate content. Without JavaScript, and
  when printing, the complete description remains readable.
- Series and Speakers retain their underlying identities, counts and contextual
  destinations in redesigned semantic tables. Each has a dark section heading,
  caption, column headers, row headers, linked names and a count column. Series
  rows use a decorative book symbol; speaker rows reuse only the two exact
  verified portraits or a non-person audio symbol. An unavailable count is
  labelled explicitly.

Entries use the existing eligible sermon summaries without transforming their
meaning. The description stays in server-rendered HTML; clamping is progressive
enhancement only. Existing private draft warnings remain visible. Missing speakers
and empty results have explicit rendering paths; output uses the shared escaped
HTML composer. Detail and taxonomy links use the existing render context.

V5 now renders the eligible summaries supplied by the existing archive loader,
with no detail lookup or transcript read. Description expansion uses only the
already selected `summary`; transcripts remain on sermon detail pages. Protected
handlers authorize before the archive load. The new `journal` enhancement is
registered alongside the existing scripts and uses the response builder's
Content-Security-Policy hashes of the embedded script. No content or database
write is involved.

V5 is a non-indexable comparison surface whose canonical points to the ordinary
archive. Authenticated preview responses retain no-store and
`noindex, nofollow, noarchive`. Authentication, content eligibility, approval,
publication and public/search/feed/sitemap/build exclusion rules are unchanged.

## Local visual additions

`src/frontend/styles/v5.ts` confines the page adjustments to V5 and the new
journal component. The heading and featured recording use the existing pale
recessed surface; the feature gains a stronger top rule and filled Open sermon
action while retaining the row structure. Desktop entries have a 2rem book
tab, a flexible text column and a 10rem speaker rail. At 60rem the rail becomes
9.5rem; at 44rem the tab becomes 1.6rem and the speaker and separate action move
beneath the text. The dateline spans the text and rail columns, keeping the date
at the right edge, including the narrow layout.

Ordinary titles scale from 1.3rem to 1.875rem; the featured title scales from
1.5rem to 2rem. Descriptions have a 72ch measure, 1.6 line height and 1rem text,
reducing to 0.9375rem at the narrow breakpoint. Their expanded form retains
every paragraph. The coloured shortcut backgrounds use an 8% tint of their
existing token colour; this does not make the icons interactive.

The Series and Speakers tables are framed sections with dark-ink heading bands,
white heading text, pale column headings, fine row rules and prominent
right-aligned tabular counts. They sit in a 1.15:1 two-column layout and stack
at 60rem. Table portraits use the existing verified assets at 3rem by 3.25rem.
Names wrap within their own column, and decorative row arrows disappear at
44rem while the links remain available.

Rows use rules and a pale background on hover or focus within. Book tabs retain
their semantic colours without the shared tab's hover lift. Portraits are
4.75rem by 5rem on desktop and 2.5rem by 2.75rem on narrow screens, with a
2px radius and a deliberate `object-fit: cover` crop. Interactive bylines,
series links, description toggles and Open sermon links retain a 2.75rem
minimum height; directory links use 5.5rem, or 5rem at 44rem. Reduced motion
removes the row transition, and forced colours add a visible tab edge. These
are surface choices, not additions to the global type or component scale.

## Verified raster provenance

Portrait identity comes from the exact name-to-media associations in
`src/frontend/content/pages/elders.ts`, the tracked transcription of WordPress
page 34 supplied in the 24 September 2026 export. Only the exact names below
receive portraits in either the journal or Speakers table. Other names have a
text byline and, in the directory, a decorative audio symbol; there is no
inferred identity or generic person-image substitute.

| Exact speaker name | Existing served asset | Existing dimensions | Supplied archive source |
| --- | --- | --- | --- |
| Wesam Saad | `/media/wesam.jpg` | 640 × 666 | `2021/02/WesProfile.jpg` |
| Ralph Gambardella | `/media/ralph.jpg` | 640 × 663 | `2021/02/Ralph.jpg` |

The files already reside in `src/frontend/assets/media/` and are served through
the existing `siteImage` registry and embedded media bytes. Their inspected
SHA-256 values match `src/frontend/assets/media/manifest.json`:

- `wesam.jpg`: `68ab69b524c194472726cec4bf9db3245dbbc57b85e917fd3ea9275f0e0ef50b`
- `ralph.jpg`: `62205f714108427a2b8edcf8402c860acd2406fb856074311e6172cea2405786`

The archive selection and optimisation history remain documented in
`src/frontend/assets/media/README.md`. V5 creates no new image bytes. Portraits
use empty alt text because the adjacent visible link names the speaker, with
explicit source dimensions, lazy loading and asynchronous decoding.

## Verification and disposition

Fresh finish review for this 2 October refinement returned **ship**, with no
UI defects. Completed checks are:

- Two anonymous visual rounds at 1440, 768, 390 and 320 pixels passed with no
  horizontal overflow or console errors. Keyboard activation expands and
  collapses the complete description; JavaScript-disabled rendering keeps it
  fully visible. The refined tables and coloured inactive icons were inspected.
- All 44 focused tests passed across six suites covering V5 rendering,
  archive data access, routes, Claude integration, the shell and tokens.
- Full standard suite: 842 passed, one unchanged admin-dashboard-layout
  line-ending assertion failed, and 126 PostgreSQL cases were gated/skipped.
  Skips are not database-write verification.
- `npm run check` retained only the existing TS2379 optional-property mismatch
  in `src/development-data/project-sermon-snapshot-cli.ts:38`.
- Static build passed with 45 pages; the staging bundle build also passed.
- The cached offline dependency audit reported zero vulnerabilities. The
  anonymised importer dry run processed five inputs: three included, two
  excluded and none rejected.
- The scan covered 25 changed and 85 total files with no credential,
  private/prohibited-content or symlink findings; nothing was staged.
- The design detector reported zero antipatterns and twelve advisories for the
  scoped compact type sizes documented above. Global system files are unchanged.

The authenticated live preview displayed nine description rows and zero inline
transcripts. The sampled first row exposed its full description on expansion;
its normalized content hash stayed unchanged through opening and closing and
matched its detail-page description. Series and speaker links returned 200, and there
were no browser errors. Filters retained V5 and results received keyboard focus;
all four inspected widths had no horizontal overflow.

Unauthenticated preview access returned 401; the unprefixed V5 public route on
the local preview server returned 404. No-store and noindex protections held.
The session remained read-only with 311 stored sermons, 279 eligible sermons
and the original fingerprint unchanged across 55 tables. This is read-only
compatibility evidence, not a migration apply/rollback test.

The local entry is `http://127.0.0.1:4403/admin`, followed by
`http://127.0.0.1:4403/frontend-preview/sermons-v5/`. No private launcher,
authentication material or sermon prose is recorded here. No staging contact,
deployment, content mutation, commit or push occurred in this V5 task. The
existing suite and type-check findings remain limitations of the full
repository verification. The scoped ship disposition does not establish
deployment or production readiness.
