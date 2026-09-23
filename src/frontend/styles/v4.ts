/**
 * SermonsV4 stylesheet: the bookshelf folded behind a labelled native
 * disclosure that is collapsed on first load, and the results grid spacing.
 * The V2 opening section keeps its own styles from the core and shelf blocks.
 */
export const v4Styles = `
.fold-section { margin-top: var(--space-6); }
.fold { border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-card); background: var(--colour-raised); box-shadow: var(--shadow-card); }
.fold__summary { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(8rem, 22rem); align-items: center; gap: var(--space-4); min-height: 3.5rem; padding: var(--space-3) var(--space-4); list-style: none; cursor: pointer; }
.fold__summary::-webkit-details-marker { display: none; }
.fold__summary:hover .fold__title { color: var(--colour-gilt); }
.fold__summary:focus-visible { outline-offset: -3px; border-radius: var(--radius-card); }
.fold__chevron { flex: none; width: 0.6rem; height: 0.6rem; margin-right: var(--space-1); border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.fold[open] > .fold__summary .fold__chevron { transform: rotate(45deg); }
.fold__label { display: grid; gap: 0.15rem; min-width: 0; }
.fold__title { font-family: var(--font-signage); font-stretch: 87.5%; font-size: 1.0625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink); }
.fold__hint { font-size: var(--size-ui); color: var(--colour-ink-soft); }
.fold__strip { display: block; min-width: 0; }
.fold__strip .strip { height: 0.75rem; }
.fold__body { padding: 0 var(--space-4) var(--space-4); border-top: 1px solid var(--colour-rule); }
.fold__body .shelf { margin-top: var(--space-4); }
.fold[open] > .fold__body { animation: fold-open var(--motion-settle) var(--motion-easing) both; }
@keyframes fold-open { from { opacity: 0; transform: translateY(-0.25rem); } to { opacity: 1; transform: none; } }
.v4 .results { margin-top: var(--space-7); }
.v4 .results__cards { max-width: none; }
.v4 .section__aside { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); }
@media (max-width: 60rem) {
  .fold__summary { grid-template-columns: auto minmax(0, 1fr); }
  .fold__strip { grid-column: 1 / -1; }
}
@media (max-width: 44rem) {
  .fold__summary { padding: var(--space-3); }
  .fold__body { padding: 0 var(--space-3) var(--space-3); }
}
@media (forced-colors: active) {
  .fold { border: 1px solid CanvasText; }
  .fold__summary { outline: 1px solid transparent; }
}
@media print {
  .fold { display: none !important; }
}
`;
