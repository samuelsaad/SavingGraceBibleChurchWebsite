---
version: 1
slug: "src-frontend-pages-sermons-v5-ts"
primary_target: "src/frontend/pages/sermons-v5.ts"
related_targets: ["src/frontend/components/sermon-journal.ts","src/frontend/styles/v5.ts","src/frontend/scripts/journal.ts","src/frontend/scripts/journal-pagination.ts"]
---

# SermonsV5

Mode: Read / Operate. A new comparison route inside the existing church site.
Samuel pins V4's search/speaker/series finder and closed Bible-book disclosure,
compact horizontal sermon rows, and Series and Speakers browsing at the bottom.
The 2 October refinement retains the pale-blue heading and featured latest
available recording, expands descriptions through See more/See less, colours
the inactive media icons and redesigns the semantic directories. Existing
pages, content and eligibility remain unchanged.

## Direction contract

THESIS: A browsable teaching journal: compact horizontal entries with enough
human presence and passage hierarchy to invite reading, never a tile grid.

OWN-WORLD: Inherit mineral-blue ink, white and pale sky, the delivered Vera Sans,
semantic Bible-book colours, thin dividers and the church's verified portraits.

STORY: Search or unfold Scripture, find the latest available recording, scan the
passage, stored duration and right-aligned date, then expand the description or
open the sermon. Series and Speakers tables offer the next browsing path.

FIRST VIEWPORT: A pale-blue Sermons heading above the existing full-width finder
and closed shelf. The unfiltered first page features "Last Week’s Sermon"
immediately beneath the shelf, qualified as "Latest available recording" and
showing its stored date. The label does not assert calendar-week recency.
Recent sermons retain narrow book tabs, wide title/excerpt columns and quiet
portrait/byline rails. Open sermon is a separate action below the speaker on
the wide layout. No false portrait, invented duration or visible numbering.

FORM: User-specified refinement within the existing visual world. The feature
uses the same row structure, a mineral-blue heading band and pale-blue reading
surface. Fine-pointer hover lifts only its semantic book tab by 4px, shifts the
opening arrow and strengthens the panel/title colours. The reading surface stays
steady. Keyboard focus gets the same colour emphasis; reduced-motion and touch
keep the tab still. Ordinary row hover/focus uses a
quiet tone change; a progressively enabled native button controls the full
description with See more/See less and `aria-expanded`. YouTube, audio and
transcript shortcut icons remain inert, using existing burgundy, green and blue
tokens. The redesigned directories use dark-ink heading bands, semantic table
captions and headers, linked names, verified portraits or decorative symbols,
and right-aligned counts. They stack at 60rem.

CONTENT: Complete escaped description paragraphs appear once in initial HTML.
V5 uses eligible archive summaries only, without detail or transcript reads.
The registered `journal` enhancement clamps overflowing descriptions to three
lines; expansion makes no request. Full descriptions remain visible without
JavaScript and when printed. Duration comes only from stored recording metadata,
with an explicit unavailable state.
Only the exact tracked Wesam Saad and Ralph Gambardella associations receive
existing portraits; no new raster or inferred speaker image is introduced.

FINISH: Fresh review disposition is ship, with no UI defects. Two anonymous
visual rounds covered 1440/768/390/320 with no overflow or console errors,
working keyboard description toggles and full descriptions without JS. Live
verification confirmed nine description rows, no inline transcripts, preserved
description content and the existing privacy boundary. The detector reports
zero antipatterns and twelve scoped type-size advisories. Completed evidence,
known repository limitations and existing raster provenance are recorded in
`docs/design/sermons-v5.md`.
Preserve the global `DESIGN.md`, `.impeccable/design.json` and `PRODUCT.md`;
this scoped extension does not establish a new design system.

LOCAL REFINEMENT (7 October): Verified duration labels use a clock, semantic
book hue and pale tint; unknown durations retain honest text. Above the unchanged
directories, More sermons appends one eligible page at a time, followed by
numbered navigation. Progress, loading, failure fallback and end states are
explicit. Server-rendered links work without JS. Same-origin authenticated
continuation changes no eligibility or content. Anonymous responsive inspection
and fresh independent finish review pass. Evidence is in the design note.

MOBILE ADAPTATION (7 October): Retain the same journal, with 16px phone reading
text and flexible dates/actions/directories at enlarged text. The thin visible
book tab has a 44px touch hit area; More sermons is contained, phone search spans
the form, and nested-menu Escape returns focus one level at a time. Anonymous
desktop/mobile/landscape and 200% text checks pass; physical-device certification
is not claimed. The design note records the exact scope and remaining advisories.
