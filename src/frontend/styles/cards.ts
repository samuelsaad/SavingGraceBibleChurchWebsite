/**
 * The V4 card system: equal-size cards on a responsive grid. A cloth-hued
 * plate stands in for the image slot (nothing is fetched); the title is the
 * single link with a hit area over the whole card; series, speaker and book
 * links are lifted above it. Shared by SermonsV4 and the homepage.
 */
export const cardStyles = `
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-5); list-style: none; margin: 0; padding: 0; }
.cards > li { display: grid; min-width: 0; }
.card { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-width: 0; background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); overflow: hidden; transition: box-shadow var(--motion-duration) var(--motion-easing), transform var(--motion-duration) var(--motion-easing), border-color var(--motion-duration) var(--motion-easing); }
.card:hover { border-color: var(--colour-rule-strong); }
.card:focus-within { border-color: var(--colour-ink); }
@supports selector(:has(a)) {
  .card:has(.card__title a:focus-visible) { outline: 3px solid var(--colour-ink); outline-offset: 3px; box-shadow: 0 0 0 3px var(--colour-ground); }
  .card__title a:focus-visible { outline: none; box-shadow: none; }
}
.card--latest { border-color: var(--colour-gilt); }

/* ---- the plate: the book's cover where a photograph would sit ---- */
.card__plate { position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: 0.2rem; min-height: 8rem; padding: var(--space-7) var(--space-5) var(--space-4); background: var(--hue, var(--colour-ink)); color: var(--colour-on-ink); }
.card__group { position: absolute; top: var(--space-3); left: var(--space-4); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.9; }
.card__ordinal { position: absolute; top: var(--space-3); right: var(--space-4); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; opacity: 0.9; }
.card__bookname { position: relative; font-family: var(--font-signage); font-stretch: 87.5%; font-size: clamp(1.5rem, 1rem + 1.6vw, 2.25rem); font-weight: 700; letter-spacing: 0.05em; line-height: 0.95; text-transform: uppercase; text-wrap: balance; overflow-wrap: anywhere; }
.card__ref { position: relative; font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.1; font-variant-numeric: tabular-nums; }
.card__device { position: relative; display: block; }
.card__mark { display: block; width: 2.5rem; height: 2.5rem; }
.card__strip { position: absolute; left: 0; right: 0; bottom: 0; display: block; width: 100%; height: 0.375rem; transition: height var(--motion-duration) var(--motion-easing); }
.card:hover .card__strip { height: 0.5rem; }
.card__strip rect { fill: var(--colour-on-ink); opacity: 0.35; }
.card__strip .card__strip-here { fill: var(--colour-gilt-bright); opacity: 1; }
.card__strip--plain rect { fill: var(--colour-rule); opacity: 1; }
.card--plain .card__plate { background: var(--colour-tile); background-image: none; color: var(--colour-ink-muted); }

/* Latest stays in normal flow so it cannot cover a series or date. */
.card__flag { display: inline-flex; justify-self: start; padding: 0.4rem 0.6rem; background: var(--colour-gilt); color: var(--colour-on-ink); font-family: var(--font-signage); font-size: var(--size-small); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1; }
.card--plain .card__flag { background: var(--colour-ink); }

/* ---- the body ---- */
.card__body { position: relative; display: grid; align-content: start; gap: var(--space-3); padding: var(--space-5); min-width: 0; }
.card__top { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.card__top a, .card__meta a, .card__booklink { position: relative; z-index: 1; color: inherit; }
.card__top a, .card__meta a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.card__top a:hover, .card__meta a:hover, a.card__booklink:hover { color: var(--colour-gilt); }
.card__series { color: var(--colour-gilt); }
.card__series a { color: var(--colour-gilt); }
.card__pill { display: inline-flex; align-items: center; min-height: 1.5rem; margin-left: auto; padding: 0 0.5rem; border: 1px dashed var(--colour-rule-strong); border-radius: var(--radius-cell); background: var(--colour-recessed); color: var(--colour-ink-soft); font-size: var(--size-small); letter-spacing: 0.06em; text-transform: none; }
.card__title { font-family: var(--font-display); font-size: var(--size-card-heading); line-height: 1.12; letter-spacing: -0.01em; text-wrap: pretty; overflow-wrap: anywhere; }
.card__title.is-long { font-size: var(--size-h3); line-height: 1.15; }
.card__title.is-longest { font-size: var(--size-lede); line-height: 1.2; }
.card__title a { color: var(--colour-ink); text-decoration: none; }
.card__title a::after { content: ""; position: absolute; inset: 0; }
.card:hover .card__title a { color: var(--colour-gilt); text-decoration: underline; text-decoration-color: var(--colour-gilt); text-decoration-thickness: 0.06em; text-underline-offset: 0.16em; }
.card__meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-2); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.card__dot { color: var(--colour-rule-strong); }
.card__desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; line-clamp: 4; overflow: hidden; margin-top: var(--space-1); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.5; color: var(--colour-ink-soft); }

/* ---- the footer ---- */
.card__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 2.75rem; padding: 0 var(--space-4); border-top: 1px solid var(--colour-rule); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }
.card__cta { color: var(--colour-gilt); }
.card__cta::after { content: " →"; }
.card__booklink { display: inline-flex; align-items: center; min-height: 2.75rem; text-decoration: none; }
.card__booklink::before { content: ""; display: inline-block; width: 0.45rem; height: 1rem; margin-right: 0.45rem; border-radius: var(--radius-cell); background: var(--hue, var(--colour-ink-muted)); }
.card__booklink--plain::before { background: var(--hue); }

@media (max-width: 60rem) {
  .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
}
@media (max-width: 44rem) {
  .cards { grid-template-columns: minmax(0, 1fr); }
  .card__plate { min-height: 7.5rem; padding: var(--space-7) var(--space-4) var(--space-4); }
  .card__group { left: var(--space-3); }
  .card__ordinal { right: var(--space-3); left: auto; }
  .card__body { padding: var(--space-3) var(--space-3) var(--space-2); }
  .card__foot { padding: 0 var(--space-3); }
  .card__desc { -webkit-line-clamp: 5; line-clamp: 5; }
}
@media (prefers-reduced-motion: reduce) {
  .card:hover { transform: none; }
  .card:hover .card__strip { height: 0.375rem; }
}
@media (forced-colors: active) {
  .card { border: 1px solid CanvasText; }
  .card--latest { border: 2px solid CanvasText; }
  .card__plate { border-bottom: 1px solid CanvasText; }
  .card__flag, .card__pill { border: 1px solid CanvasText; }
  .card__title a::after { display: none; }
}
@media print {
  .card { break-inside: avoid; box-shadow: none; }
  .card__plate { background: none; background-image: none; color: var(--colour-ink-print); border-bottom: 1px solid var(--colour-ink-print); }
  .card__plate::before, .card__strip { display: none; }
  .card__flag { background: none; color: var(--colour-ink-print); clip-path: none; border: 1px solid var(--colour-ink-print); }
  .card__title a::after { display: none; }
}
`;
