---
version: 1
slug: "src-admin-dashboard-ts"
primary_target: "src/admin/dashboard.ts"
related_targets: ["src/admin/workbench.ts","src/admin/workbench.css","src/pages/admin/index.astro"]
---

# Administrator review workbench

THESIS: A clear work queue, not another report: Samuel can immediately separate finished sermons from evidence that needs his judgment.

OWN-WORLD: Extend the church's mineral-blue, pale-sky and white palette with its self-hosted Vera type. Use restrained green for current acceptance and warm brown for attention; text always names the state. This is the operational companion to the visitor site, not a new identity.

STORY: Orient with the live collection split, narrow by reason or search, inspect the specific saved concern, then open the existing guarded correction form. Completed work remains visible without demanding another review. Publication is an independent state.

FIRST VIEWPORT: Compact navigation, a readable workspace title and privacy note, one collection-completion band, counted Needs attention/Complete/All sermons controls, and the first actionable rows. Needs attention is the default workspace view. Native row disclosures expand in place to explain the saved evidence and link to the relevant correction form. No decorative hero or metric-card grid.

FORM: Code-led extension in Operate mode. Flat surfaces, fine rules, fixed rem typography, tabular counts, generous keyboard/touch targets. At narrow widths rows become stacked summaries with explicit labels, never a squeezed desktop table.

FINISH: Render anonymized desktop and mobile fixtures; verify keyboard, filtering, empty/error/loading states and direct correction navigation. Confirm real aggregate counts without capturing sermon prose. Preserve all mutation guards and historical decisions. Finish with critique, accessibility/responsive fixes and polish.

## Implemented surface

The workspace in `src/admin/workbench.ts` uses the authenticated admin snapshot to show collection counts and current review status. The completion band remains visible while status, title/speaker search and attention-reason filters narrow the rows. Results paginate in groups of 20. Status, query and reason are reflected in the URL; changing status clears the reason filter. The Complete view disables attention reasons. Advanced library filters remain available through the existing library view.

Each native disclosure presents its saved concern, the information needed, available finding attribution and a direct link to the relevant guarded review stage. Complete rows instead expose the saved review. Opening a stage is view-only; saving a correction or decision remains a deliberate action in the existing form. The review header and banner distinguish current restricted acceptance, human approval and publication. Missing evidence stays unresolved, and a current acceptance does not require a repeated completion click.

## Operational extensions and inherited details

The admin surface uses the shared mineral-blue, pale-sky, white and self-hosted Vera identity. Its scoped stylesheet adapts the existing administrator shell; its local variables and the historical `forest`/`gold` names are compatibility details, not additions to the visitor token system. The existing SG administrator mark remains an interface label rather than a new church logo. The visitor layout and shared design documents remain unchanged.

- **Task layout:** a dark navigation rail (14rem), a white privacy bar and a compact workspace replace visitor-page composition. At 1100px, the next step wraps beneath the identity/status pair and the evidence side note stacks; at 800px, the existing navigation becomes a drawer; at 580px, result summaries stack and review-stage navigation uses two columns. These breakpoints are local to administration.
- **Typography:** the workbench uses rem-sized operational text, a workspace heading (2rem, 1.65rem below 580px), compact controls and tabular counts. Existing transcript and wording editors retain their larger reading text. The visitor display scale does not govern the queue.
- **State:** restrained green denotes current acceptance; warm brown denotes attention. Both states have text and an icon. Publication remains explicitly labeled in expanded evidence and review headers. These colors do not reuse the Bible-book palette.
- **Controls and focus:** primary controls retain mineral blue; workbench buttons and fields have 44px minimum heights and modest corners. Keyboard focus uses a copper outline (3px with 3px offset), with an inset outline on row summaries. Native disclosures and pressed-state filter buttons express their actual interaction states.
- **Depth and motion:** new queue surfaces are flat and divided by rules. Existing review evidence panels retain their rounded forms, semantic tints and decision-bar shadow; the bar becomes static at the existing mobile breakpoint. These inherited editor treatments are not new shared card rules. Queue hover changes use a short 140ms transition; reduced-motion rules remove transitions, and forced-colors rules preserve state boundaries.

## Documentation evidence

Checked against `src/admin/workbench.ts`, `src/admin/workbench.css`, the administrator page and dashboard integration, plus the synthetic overview captures at 1440px and 390px and the synthetic desktop review capture. The captures show the collection band, expanded concern, correction action and readable review form in the intended visual system. This documents implementation and composition only; it does not certify content accuracy, production access or the outcome of runtime verification. Keep actual verification results in the project validation record.
