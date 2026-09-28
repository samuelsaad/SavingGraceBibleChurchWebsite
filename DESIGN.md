---
name: Saving Grace Bible Church
description: Clear church wayfinding, mineral-blue lettering and authentic local photography.
colors:
  ink: "#183d50"
  ink-soft: "#3e5360"
  ink-muted: "#53616a"
  ground: "#ffffff"
  raised: "#ffffff"
  recessed: "#eef3f4"
  tile: "#e0e9ec"
  rule: "#ccd7dc"
  rule-strong: "#6b7b84"
  gilt: "#90411f"
  gilt-soft: "#dbe8ec"
  gilt-bright: "#edc697"
  on-ink: "#ffffff"
  on-ink-soft: "#c5d9e2"
  spine-law: "#7d2a3a"
  spine-history: "#7a4a1c"
  spine-wisdom: "#56611f"
  spine-major-prophets: "#1f5f4e"
  spine-minor-prophets: "#1e5468"
  spine-gospels-acts: "#2f4f8f"
  spine-pauline: "#4d3a8a"
  spine-general: "#7d2f6b"
  spine-revelation: "#1f2430"
  spine-topical: "#563650"
  ground-print: "#ffffff"
  ink-print: "#000000"
typography:
  display:
    fontFamily: '"Bitstream Vera Sans", sans-serif'
    fontSize: "clamp(2.75rem, 1.9rem + 3.6vw, 5rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: '"Bitstream Vera Sans", sans-serif'
    fontSize: "clamp(2rem, 1.5rem + 2.2vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: '"Bitstream Vera Sans", sans-serif'
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  body:
    fontFamily: '"Bitstream Vera Sans", "Segoe UI", sans-serif'
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.72
  lede:
    fontFamily: '"Bitstream Vera Sans", "Segoe UI", sans-serif'
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: '"Bitstream Vera Sans", "Segoe UI", sans-serif'
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: '"Bitstream Vera Sans", "Segoe UI", sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.08em"
rounded:
  cell: "0.125rem"
  control: "0.25rem"
  card: "0.75rem"
  pill: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
  "7": "3rem"
  "8": "4rem"
  "9": "6rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.control}"
    padding: "0.6rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.gilt}"
    textColor: "{colors.on-ink}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.6rem 1.25rem"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  button-on-ink:
    backgroundColor: "transparent"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.control}"
    padding: "0.6rem 1.25rem"
  button-on-ink-hover:
    backgroundColor: "{colors.on-ink}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
    width: "100%"
  navigation-link:
    textColor: "{colors.ink}"
    padding: "0 0.5rem"
  chip:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 0.9rem"
  sermon-card:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  callout:
    backgroundColor: "{colors.recessed}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "clamp(1.5rem, 3vw, 2.5rem)"
  event-row:
    textColor: "{colors.ink}"
    padding: "1.5rem 0"
  transcript-disclosure:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 1rem"
---

# Design System: Saving Grace Bible Church

## Overview

**Creative North Star: "The Sunday Invitation"**

The visual language comes from the church's own service sign, gathered hall and welcome at the door. Mineral-blue lettering, pale sky surfaces and clear white space make the information direct and welcoming. Original congregation photographs and the official logo give the website its local identity.

The system uses large, plain lettering for orientation and quieter, generously spaced text for reading. Content pages use open rows and restrained rules; sermon discovery retains its meaningful Bible-book colors and compact controls. This documents the implemented frontend in `src/frontend/tokens.ts` and `src/frontend/styles/`, with component behavior in `src/frontend/components/`. The homepage composition belongs to `.impeccable/surfaces/church-visitor-site.md`, not to every page.

**Key Characteristics:**

- Mineral-blue text with white and pale sky surfaces.
- One self-hosted sans-serif family for display, reading and controls.
- Authentic church photographs and the unchanged official logo.
- Flat reading surfaces, fine rules and visible interactive boundaries.
- Responsive layouts with native disclosures and readable server-rendered content.

## Colors

Cool mineral colors establish the page; copper marks links and active states, while the sermon library keeps its semantic book palette.

### Primary

`ink` is the mineral-blue primary text, button, footer and media-plate color. `on-ink` and `on-ink-soft` provide the corresponding bright and muted text on dark surfaces.

### Secondary

`gilt` is the inherited token name for the current copper accent. It appears on link underlines, hover states, selected filters and the latest-sermon flag. `gilt-soft` is a pale sky surface for the invitation and active filters; `gilt-bright` is the warm accent used against dark ink. These names retain source compatibility rather than describing a metallic finish.

The ten `spine-*` colors encode Bible literary groups and explicitly topical material. Their mapping stays consistent across the shelf, book tabs, canon strip and sermon cards. They are content navigation, not a general-purpose rainbow palette.

### Neutral

`ground` and `raised` share a white value but retain separate page and control roles. `recessed` provides quiet panels; `tile` marks inactive or empty cells. `ink-soft` and `ink-muted` set secondary and tertiary text. `rule` is a decorative divider; `rule-strong` is used where a control boundary must be apparent. The print pair is dedicated to printed output.

**The Boundary Rule.** Use `rule` for content separation and `rule-strong` for interactive outlines; a pale divider is not a control boundary.

## Typography

Display uses Bitstream Vera Sans with a generic sans-serif fallback. Reading, signage and interface roles use the same self-hosted family, with Segoe UI and generic sans-serif fallbacks. The original regular and bold TrueType files are loaded with `font-display: swap`; the bold file services the implemented 600–900 weight range. There is no separate condensed, serif or italic font file.

The YAML roles capture the archive display, shared section heading, sermon-card title, prose, lede, interface text and field label. Field labels use uppercase; navigation and buttons use sentence case. The retained signage styling requests a condensed stretch, but the supplied fonts are the original normal-width faces. Do not describe that request as a separate condensed font.

The church page title has its own fluid size (`clamp(2.8rem, 4.5vw, 4.5rem)`), tight line height (1.05) and uppercase treatment. Long church titles switch to sentence case and a smaller fluid size. The homepage title is a composition-specific display (`clamp(3.5rem, 6.7vw, 6rem)`), not an additional universal heading tier. Both have explicit smaller-screen adjustments in their source stylesheets.

**The Reading Measure Rule.** Keep ordinary prose within 68ch and transcripts within 64ch; use the interface size for controls and metadata, not for long-form reading.

The complete font license, file hashes and offline provenance are recorded in `src/frontend/assets/fonts/README.md` and its adjacent license file. Preserve those original font and license bytes together.

## Layout

The shared page container is `min(76rem, 100% - 3rem)`, centered. At 38rem and below its side allowance becomes `100% - 2rem`. Main content begins with 2rem top padding, reduced to 1.5rem at 44rem. Major sections use 6rem separation, reduced to 3rem at 44rem. The nine spacing steps in the frontmatter are the existing source scale; local component geometry may use additional established values.

The exact max-width breakpoints are 76rem, 60rem, 44rem and 38rem. At 76rem the enhanced masthead gains its menu toggle and two-column links; at 44rem those links become one column and the logo, Search and Menu controls can wrap. Without the enhancement, the navigation remains available in normal flow. The footer uses four columns, two at 60rem and one at 44rem.

Sermon cards use three equal columns, two at 60rem and one at 44rem. Finder refinements use four columns, two at 60rem and one at 38rem. Church directories use image-and-text rows; images stack above the text at 44rem. Side-by-side church openings stack at 60rem. The homepage invitation and services stack at 44rem, preserving their information order.

Long-form text uses the Reading Measure Rule. Sermon results lists have a 56rem maximum. The wide sermon reading layout uses a book tab, body and contents rail; the rail moves into the body column at 76rem, and the complete layout becomes one column at 60rem. The transcript paragraph numerals disappear at 60rem to preserve the reading width.

Standalone interactive targets use a minimum 2.75rem height. Buttons normally use a 3rem minimum; height is not fixed, so wrapped text can increase it. The body applies `overflow-wrap: anywhere`; constrained grid and flex children also retain zero minimum widths where needed, so larger text and long strings can wrap.

## Elevation & Depth

This is a mostly flat system. White and pale sky bands, rules, natural photography and dark ink panels create separation. The shared card shadow is `none`; sermon cards change their border and title color on hover. Church panels and directory rows do not acquire decorative shadows.

The existing book-tab interaction uses the soft lift shadow (`0 0.5rem 1rem rgba(21, 24, 28, 0.18)`). Focus uses a 3px ink outline, a 3px offset and a 3px white separating ring. Current navigation uses a two-pixel inset accent line; these are state indicators, not general surface elevation.

**The Flat Surface Rule.** Keep content surfaces flat; use border, tone and text state before adding elevation.

## Shapes

Large church page bands, photographs, panels and editorial rows are rectangular. Slightly rounded controls, softer sermon cards and fully rounded taxonomy chips use the distinct radii in the frontmatter. Thin rules connect repeated rows; dashed boundaries distinguish pending or unpublished status. Do not apply the card radius indiscriminately to church photography or prose.

## Components

### Buttons

Compact, clearly bounded actions. Primary buttons use ink with white text; hover switches to copper. Outline buttons start transparent with an ink border and fill with ink on hover. On-ink buttons use a white outline and reverse to white with ink text on hover. All share the control radius, source padding, 600 weight and visible focus treatment. Disabled buttons use `tile` and `ink-muted` with a not-allowed cursor.

### Inputs and filter chips

Inputs use a white surface, strong one-pixel boundary, control radius and 1rem text. A visible label accompanies the control. Disabled inputs use the tile surface. Native selects keep a CSS chevron and room for it. Ordinary chips have a white ground and strong border, moving to the recessed surface on hover; active removable tokens have the sky tint and copper boundary, switching to copper with white text on hover.

### Navigation

The official logo anchors a white masthead. Navigation is medium-weight sentence case; native details elements expose submenus. Active links use a copper underline or inset edge. The compact menu is progressive enhancement, with its actual expanded state exposed to assistive technology. Its narrow layout is documented under Layout. Footer links retain 2.75rem minimum targets; unavailable social destinations remain labeled text rather than functioning links.

### Sermon cards

Equal-size cards combine a book-colored plate, title and metadata with a divided footer. A title link expands its hit area across the positioned content body while specific metadata links remain individually accessible. The latest flag stays in normal flow, so it cannot cover the series or date. The plate hue communicates the book group; a compact canon strip identifies location. Hover strengthens the border and title, and the strip grows from 0.375rem to 0.5rem. Focus can outline the whole card through its title link. Excerpts are capped at four lines, or five at 44rem.

### Reading panels and event rows

Callouts, contact details and giving details use a pale recessed surface with measured padding. Quotations and ordinary panels use horizontal rules. Event rows align a date column with title, time and venue; the date column reduces from 5rem to 3.5rem at 44rem. Event lists may use native disclosure for additional entries, with an explicit count. Photographs retain their natural colors; content images use their source proportions unless a deliberate page crop is implemented.

### Transcript disclosure and motion

The transcript uses a native details/summary control, an ink border and a CSS chevron that rotates with the open state. The summary can wrap and its statistics occupy their own line on small screens. Before a video loads, its consent plate has a growing minimum height and a zero-minimum-width grid column; loaded video uses its 16:9 frame. Approved description, media, transcript and questions retain their established reading order; appearance never grants content eligibility.

State transitions use 160ms and the source easing; existing shelf and folded-library transitions use 480ms. The homepage photograph has one 700ms opening clip animation, from an already visible image, only when reduced motion is not requested. Reduced-motion styles remove transition and animation duration and restore normal scrolling. These timings, focus geometry, breakpoints and ten isolated component examples live in `.impeccable/design.json` because the frontmatter schema cannot represent them. The sidecar's generated tonal ramps are swatch previews, not additional application tokens.

## Do's and Don'ts

### Do:

- **Do** use the existing token roles and preserve the Bible-book color mapping.
- **Do** preserve the official logo and use the church's supplied photographs with accurate alt text.
- **Do** keep strong control boundaries, visible keyboard focus and wrapping interactive labels.
- **Do** retain native disclosures, readable server-rendered content and reduced-motion behavior.
- **Do** keep font and image provenance alongside the assets; the image inventory is `src/frontend/assets/media/README.md` with its manifest.

### Don't:

- **Don't** turn church reading pages into repeated floating card grids.
- **Don't** tint photographs or invent people, testimony, event facts or imagery.
- **Don't** turn the homepage composition into a mandatory template for every page.
- **Don't** use tiny uppercase introductory labels as decorative replacements for a clear heading.
- **Don't** infer content approval, accessibility certification or production readiness from this visual system.
