---
version: 1
slug: "visual-page-editor"
primary_target: "src/admin/cms/visual-editor.ts"
related_targets: ["src/admin/cms/visual-editor.css", "src/admin/cms/visual-inspector.ts"]
---

# Visual website editor

Mode: Operate. Extend the existing administrator system and retain the website itself as visual truth.

## Direction contract

THESIS: Edit the rendered church website directly, with selection and contextual controls framing the content.

OWN-WORLD: Existing self-hosted Vera, mineral blue, white and pale blue-gray surfaces. Copper identifies selection and keyboard focus. Fine rules separate controls from the website canvas.

STORY: Open a page, select its real text or imagery, change the draft, review responsive layouts, then publish to the explicitly named environment.

FIRST VIEWPORT: A compact full-width toolbar holds the page selector, device widths, saved state, undo/redo, preview and publication. The website fills the remaining screen beside a narrow inspector. Small screens use an inspector drawer.

FORM: Code-led extension of the incumbent Operate surface. The exact website renderer supplies the canvas; its design is preserved.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

No new raster assets or shared design tokens are introduced. Existing site imagery retains its source provenance. Runtime and delivery evidence belongs in the validation plan.

## Implemented surface

The visual workspace in `src/admin/cms/visual-editor.ts` fills the administrator viewport. Its persistent toolbar groups the page selector, undo/redo, Desktop/Tablet/Mobile widths, draft state, Save draft, Preview and the named publication destination. A second compact row exposes Sections, Add section, Page settings and History. The canvas footer repeats the environment and saved/unsaved state, including on small screens where the top status is hidden. The advanced form remains reachable from the inspector footer.

The canvas uses the actual website renderer. Click selects an annotated text, image or section; double-click enables supported inline text editing. The inspector follows that selection, including related link destinations, image alternative text and focal-point controls. Shared header/footer/navigation selection opens the settings entity with an explicit shared-change notice and a return action. Supported section appearance is bounded to existing background, spacing, alignment and width options, with a reset to the original design.

Sections have pointer movement, Move up/Move down controls, duplication, visibility and removal. The section list exposes Visible/Hidden text and movement buttons; the insertion line names the drop action. Undo/redo includes content and structural changes. The section library uses CSS layout miniatures and existing asset thumbnails. Images, page/document destinations, eligible sermon references and revision history use native modal dialogs. Saved revisions restore as new drafts; publication remains a separate action.

Save draft and publication expose their progress and errors through status/alert feedback. Publication first saves the current changes and then submits the saved revision with its row version; the action explicitly names local development or protected staging after the render response identifies the environment. Conflict feedback offers Reload saved draft and preserves unsaved changes until the user elects to discard them. Preview removes editing controls from the canvas and allows website interaction; links to non-fragment destinations open in a separate tab.

## Local layout and interaction details

The editor carries forward the administrator's self-hosted Vera, mineral blue, white surfaces, pale blue-gray dividers and copper emphasis. Its full-screen composition, compact text, preview-frame shadow and overlay geometry belong to this surface. They do not introduce shared visitor tokens or replace the incumbent administrator workbench documented in `src-admin-dashboard-ts.md`.

- **Desktop:** the canvas receives the remaining width beside a 312px inspector, reduced to 280px at 1200px. The selected preview viewport is 1440px, 768px or 390px wide and scales to fit the available canvas; the website retains its own scrolling and responsive rules. The inspector content scrolls independently between its heading and advanced-form footer.
- **Narrow screens:** at 900px the inspector becomes a right-side drawer, capped at 340px, within the work area below the toolbars. The canvas occupies the full work-area width while the drawer is closed. At 600px the main toolbar wraps, Save draft shortens visually to Save while retaining its accessible name, command labels can wrap, and image/section choices use two columns. The reviewed phone layout retains the canvas footer and publication destination.
- **Controls and state:** surface text is primarily 0.875rem, with a 1rem inspector heading and compact secondary labels. Controls use modest corners and a copper focus outline (2px, 3px offset). Primary publication uses mineral blue with white text; selected device buttons expose pressed state. Compact editor button dimensions are local to this tool and do not replace the workbench's existing 44px control rule.
- **Focus and dialogs:** opening the mobile inspector focuses its heading, gives it dialog semantics and makes the canvas and surrounding toolbars inert. Tab stays within the drawer; Close or Escape restores the trigger. When a native picker dialog is open, editor shortcuts and the drawer trap yield to it, while the picker handles its own Tab boundary. The underlying admin shell is inert during visual editing and is restored when the editor is disposed.

No new raster assets, fonts or shared design tokens were added. Existing church imagery retains its provenance. The frame, selected-section toolbar, drawer and modal shadows distinguish functional layers; ordinary controls and inspector fields remain flat.

## Documentation evidence and limits

This documentation pass inspected the three editor source files, `visual-state.ts`/`visual-link-fields.ts` integration as used by the editor, incumbent `src/admin/workbench.css` and `src/admin/cms/style.css`, the administrator surface brief, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` and the D-180 plan. It also visually inspected the retained `editor-desktop-reviewed.png` (1600 × 1000), `editor-mobile-reviewed.png` (390 × 844) and `editor-mobile-inspector-reviewed.png` (390 × 844) captures. They show the rendered homepage, toolbar, page-settings inspector, wrapped phone layout and visible copper field focus. The captures remain private verification artifacts.

The finish reviewer gave a **ship** disposition for the scoped drawer geometry and accessibility fixes, finding both resolved and no regression in the refreshed captures. That verdict is limited to those fixes. Source inspection confirms the subsequent native-modal shortcut guard and modal Tab handler; screenshots alone do not demonstrate keyboard behavior, persistence, deployment or full accessibility certification. Record actual browser, automated-suite and delivery outcomes in the validation record.

The shared design files remain unchanged. Their visitor-focused tokens and component specimens remain the incumbent system; the editor's compact dimensions, focus treatment, shadows and breakpoints are documented here rather than promoted to that system. The historical visitor-exploration framing in `PRODUCT.md` is retained; D-180 and this surface contract define this administrator extension. No unrelated context drift was repaired.
