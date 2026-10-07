# Related themes: design extension and verification

## Scope and disposition — 7 October 2026

The Related themes UI extends the existing sermon page and adds a private
blinded evaluation workflow. Its surface contract is
`.impeccable/surfaces/related-themes.md`; operational authority and the normal
visitor release gate remain in `related-themes-delivery-plan.md`.

The independent agent finish-review handoff is **ship within protected evaluation
scope**. The reviewer received a fresh context and inspected the post-fix
interface evidence, including 12 evaluator controls, comparison, error-focus and
download-state captures across the three viewport widths. This disposition
covers the interface and its documented restrictions. It is not a
claim that real recommendations are useful, that reviewers have completed the
human evaluation, or that normal visitor recommendations may be enabled.

The documentation pass owns only this note and the surface brief, plus a narrow
complete-section screenshot addition to the ignored anonymous detail harness.
It introduces no application UI changes, new assets, dependencies or global
design tokens. `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json` are retained.

## Comparison against the incumbent

The incumbent is the integrated design, not the global sidecar in isolation.
`DESIGN.md` describes Astra's church and shared-shell system; the established
`docs/design/claude-sermon-integration.md` contract and
`src/frontend/styles/claude-sermon-tokens.ts` describe the scoped sermon body.
That body already uses serif display/reading stacks, a neutral reading ground,
dark text, a gold accent and semantic Bible-book colors. This documented local
override is preserved; no global token rewrite is needed for the extension.

| Surface | Incumbent behavior retained | Scoped addition |
| --- | --- | --- |
| Sermon reading page | Astra header/footer; Claude reading body; description, media, transcript, questions and metadata Related sermons order | A separate Related themes section follows Related sermons, with its own contents-rail destination |
| Related entry | Existing book tab, title link, date/speaker metadata, dividers, link/focus treatment and responsive catalogue | Reuses the `related` entry variant; supplies no metadata relationship reason or numeric score |
| Protected evaluation hub | Existing page shell, shared buttons and private-response mechanism | Two assigned reviewer calibration links, independence instructions and an explanation of the holdout lock |
| Blinded rating page | Mineral-blue/copper family and clear native-control boundaries | Standalone Segoe UI form, complete descriptions, numbered anchors/candidates, risk/redundancy fields, list comparison and private JSON download |

The sermon extension introduces no alternate card system or imagery. Its related
catalogue is three columns on wide screens and one at the inherited 76rem
breakpoint. The wide screenshot fixture supplies two candidates, so only two
columns contain entries. Phone entries preserve readable wrapping and normal
vertical flow. The related variant intentionally omits description excerpts;
complete descriptions are available in the evaluator, where they are needed to
judge the connection.

The evaluator is a task surface, with a maximum 72rem main width and measured
description lines. Pale-sky instructions/comparison panels separate the stages;
strong one-pixel fieldset/control borders identify input boundaries. It uses
visible labels, 44px minimum control and jump-link heights, resizable textareas
and a three-pixel focus outline. At 40rem and below, panels reduce padding and
the download button fills the available width. These are scoped implementation
values, not newly established global tokens.

## Reading and review flow

The sermon section explicitly names its description-only basis and, in evaluation
mode, the outstanding independent human review. When no suggestions are present,
it gives a plain empty state and points readers toward the existing archive,
passage, series and speaker paths. Rendering the section depends on a supplied
Related themes result; it does not itself confer eligibility or enable release.

The private reviewer pack presents full anchor/candidate descriptions without
titles, source identities, method names or scores. Reviewers first select 0–3
usefulness and record risk, redundancy and notes for each candidate, then choose
between List A, List B, a tie or neither and report missing relationships.
Candidate links in the comparison move keyboard focus to the matching fieldset;
each fieldset provides a labeled return link to the comparison. This resolves
the finish review's P2 finding about needing to scroll back through candidates.

The final action requires the assigned human reviewer's independence statement.
Native validation prevents an incomplete rating download; a checked risk requires
an explanation. The page exports a JSON file and announces completion through a
status region. It does not submit decisions to the server or autosave them.
The source retains readable descriptions and a clear fallback message without
JavaScript; structured download requires the page script or the private JSON
reviewer pack. This documentation pass did not separately run a no-JavaScript
browser session.

Source inspection confirms that the HTTP handler is designed for invocation only
after the existing local-session or sealed protected-runtime guard. It uses
private responses, rejects non-GET requests and provides explicit stale-index
and locked-holdout states. This note does not independently certify live runtime
authorization or deployment. Normal visitor output remains disabled until the
separate genuine human calibration, locked policy and positive untouched-holdout
gate passes. Synthetic browser ratings and AI review cannot satisfy that gate.

## Browser evidence

All screenshots named here are ignored artifacts under
`private/related-themes/screenshots/`. They contain fictional anonymous fixtures,
not real sermon prose, reviewer evidence, credentials or account/session data.
The harnesses run on an ephemeral `127.0.0.1` listener and block non-origin
requests. They close their own browser and server in `finally`.

The documentation pass reran
`./node_modules/.bin/tsx.cmd private/related-themes/detail-browser.ts` after adding
one complete `#related-themes` capture per existing viewport. The result passed:

- 1440, 390 and 320 pixel viewports without horizontal overflow;
- distinct Related sermons and Related themes sections, two theme entries and
  nonempty section content;
- 200% root text at the final 320 pixel viewport without horizontal overflow;
- a focusable Related themes link, zero iframes, zero external requests and zero
  script errors.

The harness's synthetic detail fixture has no media entries. Its zero-iframe
result is therefore not a test of a real media-consent activation sequence.

| Capture | Evidence inspected |
| --- | --- |
| `detail-related-themes-complete-1440.png` | Full heading, evaluation notice and both entries in the inherited wide catalogue |
| `detail-related-themes-complete-390.png` | Full notice and both stacked phone entries |
| `detail-related-themes-complete-320.png` | Full narrow section, wrapping notice/title/metadata and both entries |
| `evaluation-controls-focus-1440.png` | Complete candidate description, labeled rating/risk/redundancy controls, notes and return link |
| `evaluation-comparison-focus-390.png` | Blinded lists with candidate links, overall preference and missing-relationship fields |
| `evaluation-error-focus-320.png` | Narrow form and focus at the required risk explanation; viewport capture does not show the full native validation message |
| `evaluation-submission-320.png` | Wrapped independence statement, download action and truthful local-download status |

The first three images were created and visually inspected in this documentation
pass. The evaluator images are the existing anonymous finish-verification
captures, inspected alongside `private/related-themes/evaluation-browser.ts`.
That harness encodes keyboard candidate/return navigation, risk validation and
recovery, downloaded-JSON validation, 200% root text, and request/error checks at
1440, 390 and 320 pixels. This documentation pass did not rerun it or treat its
synthetic form input as actual human ratings. Earlier `detail-*.png` context
captures remain available; the new section captures close their partial-section
coverage gap without replacing the context view.

## Review findings and limits

The agent finish-review handoff records the candidate-navigation P2 as resolved.
The detector reported zero primary findings and retains two small-label
advisories for the evaluator's 1.5rem anchor heading and
1.75rem narrow page heading. These deliberate local hierarchy steps remain
advisories; the extension does not promote them into the shared design scale.

The observed checks support this protected, anonymous interface scope. They do
not establish real-sermon thematic quality, human theological approval, screen
reader or physical-device certification, cross-browser parity, SEO parity,
database correctness, live staging access control, or production readiness.
Those claims require their respective task evidence and gates. No shipping raster
is introduced, so there is no new shipping-image provenance obligation; the
anonymous screenshots remain private verification artifacts.
