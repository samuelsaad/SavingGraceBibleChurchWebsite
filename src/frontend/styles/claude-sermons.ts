/**
 * Claude sermon presentation from 6a51443d117cc9cb20e82f8d50046f77e7a4aa08.
 * Scoped to sermon bodies: Astra retains its shared shell and church styles.
 * No global font/token overrides or new runtime dependency.
 */
import { claudeSermonTokens } from "./claude-sermon-tokens";

export const claudeSermonStyles = `

${claudeSermonTokens}

/* ---- base ---- */
.claude-sermons *, .claude-sermons *::before, .claude-sermons *::after { box-sizing: border-box; }
.claude-sermons { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
.claude-sermons {
  background: var(--colour-ground); color: var(--colour-ink);
  font-family: var(--font-ui); font-size: var(--size-ui); line-height: var(--size-line-ui);
  overflow-wrap: break-word;
}
.claude-sermons h1, .claude-sermons h2, .claude-sermons h3 { margin: 0; font-weight: 400; color: var(--colour-ink); text-wrap: balance; }
.claude-sermons h1 { font-family: var(--font-display); font-size: var(--size-title); line-height: var(--size-line-title); letter-spacing: -0.01em; }
.claude-sermons h3 { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.claude-sermons p { margin: 0; }
.claude-sermons a { color: var(--colour-ink); text-decoration-color: var(--colour-gilt); text-decoration-thickness: 0.09em; text-underline-offset: 0.18em; }
.claude-sermons a:hover { color: var(--colour-gilt); }
.claude-sermons button, .claude-sermons input, .claude-sermons select { font: inherit; color: inherit; }
.claude-sermons :focus-visible { outline: 3px solid var(--colour-ink); outline-offset: 3px; box-shadow: 0 0 0 3px var(--colour-ground); }
.claude-sermons .sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.claude-sermons .signage { font-family: var(--font-signage); font-stretch: 87.5%; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.claude-sermons .eyebrow { display: inline-flex; align-items: center; gap: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-gilt); }
.claude-sermons .tabular { font-variant-numeric: tabular-nums; }

/* ---- literary-group hues ---- */
.claude-sermons .hue--law{--hue:var(--colour-spine-law)}
.claude-sermons .hue--history{--hue:var(--colour-spine-history)}
.claude-sermons .hue--wisdom{--hue:var(--colour-spine-wisdom)}
.claude-sermons .hue--major-prophets{--hue:var(--colour-spine-major-prophets)}
.claude-sermons .hue--minor-prophets{--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .hue--gospels-acts{--hue:var(--colour-spine-gospels-acts)}
.claude-sermons .hue--pauline{--hue:var(--colour-spine-pauline)}
.claude-sermons .hue--general{--hue:var(--colour-spine-general)}
.claude-sermons .hue--revelation{--hue:var(--colour-spine-revelation)}
.claude-sermons .hue--topical{--hue:var(--colour-spine-topical)}
.claude-sermons .strip .strip__seg { fill: var(--colour-rule); }
.claude-sermons .strip .strip__seg--preached { fill: var(--hue); }
.claude-sermons .strip .strip__seg--current { fill: var(--colour-gilt); }

/* ---- masthead ---- */
.claude-sermons .glyph { display: block; width: 1.25rem; height: 1.25rem; }

/* ---- footer ---- */

/* ---- page furniture ---- */
.claude-sermons .section { margin-top: var(--space-8); }
.claude-sermons .section__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-5); }
.claude-sermons .section__title { position: relative; padding-bottom: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: 1.0625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink); }
.claude-sermons .section__title::after { content: ""; position: absolute; left: 0; bottom: 0; width: 3rem; height: 2px; background: var(--colour-gilt); }
.claude-sermons .section__aside { font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .section__aside a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.claude-sermons .note { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.55; color: var(--colour-ink-soft); }
.claude-sermons .lede { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-lede); line-height: 1.55; color: var(--colour-ink-soft); }
.claude-sermons .stats { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin: 0; padding: 0; list-style: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.claude-sermons .stats strong { color: var(--colour-ink); font-weight: 700; }

/* ---- title page (results, taxonomy detail, boundary) ---- */
.claude-sermons .title-page { max-width: var(--measure-page); margin-bottom: var(--space-6); }
.claude-sermons .title-page__title { font-size: var(--size-display); line-height: var(--size-line-tight); }
.claude-sermons .title-page__title.is-long { font-size: var(--size-title); }
.claude-sermons .title-page__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin-top: var(--space-4); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .trail { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); margin: 0 0 var(--space-3); padding: 0; list-style: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-muted); }
.claude-sermons .trail a { display: inline-flex; align-items: center; min-height: var(--target-size); color: var(--colour-ink-soft); text-decoration: none; }
.claude-sermons .trail a:hover { color: var(--colour-gilt); text-decoration: underline; }
.claude-sermons .trail li + li::before { content: "›"; margin-right: var(--space-2); color: var(--colour-rule-strong); }

/* ---- controls ---- */
.claude-sermons .button, .claude-sermons .icon-button, .claude-sermons .control, .claude-sermons .chip, .claude-sermons .token, .claude-sermons .spine__link, .claude-sermons .ruler__cell, .claude-sermons .tab { touch-action: manipulation; }
.claude-sermons .button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5em; min-height: var(--target-size); padding: 0.55rem 1.1rem; border: 2px solid var(--colour-ink); border-radius: var(--radius-control); background: var(--colour-ink); color: var(--colour-on-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: background-color var(--motion-duration) var(--motion-easing), color var(--motion-duration) var(--motion-easing), border-color var(--motion-duration) var(--motion-easing); }
.claude-sermons .button:hover { background: var(--colour-gilt); border-color: var(--colour-gilt); color: var(--colour-on-ink); }
.claude-sermons .button--outline { background: transparent; color: var(--colour-ink); }
.claude-sermons .button--outline:hover { background: var(--colour-ink); color: var(--colour-on-ink); border-color: var(--colour-ink); }
.claude-sermons .button--onink { background: transparent; border-color: var(--colour-on-ink); color: var(--colour-on-ink); }
.claude-sermons .button--onink:hover { background: var(--colour-on-ink); color: var(--colour-ink); border-color: var(--colour-on-ink); }
.claude-sermons .button[aria-disabled="true"], .claude-sermons .button:disabled { background: var(--colour-tile); border-color: var(--colour-tile); color: var(--colour-ink-muted); cursor: not-allowed; }
.claude-sermons .control { width: 100%; min-height: var(--target-size); padding: 0.5rem 0.75rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); background: var(--colour-raised); color: var(--colour-ink); font-size: 1rem; appearance: none; -webkit-appearance: none; }
.claude-sermons select.control { background-image: linear-gradient(45deg, transparent 50%, var(--colour-ink) 50%), linear-gradient(135deg, var(--colour-ink) 50%, transparent 50%); background-position: calc(100% - 1.1rem) 50%, calc(100% - 0.75rem) 50%; background-size: 0.35rem 0.35rem; background-repeat: no-repeat; padding-right: 2rem; }
.claude-sermons .control:disabled { background: var(--colour-tile); color: var(--colour-ink-muted); }
.claude-sermons .field { display: grid; gap: var(--space-1); min-width: 0; }
.claude-sermons .field__label { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-soft); }
.claude-sermons .refine { margin-top: var(--space-3); border-top: 1px solid var(--colour-rule); }
.claude-sermons .refine__summary { display: flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); padding: var(--space-2) 0; list-style: none; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink); }
.claude-sermons .refine__summary::-webkit-details-marker { display: none; }
.claude-sermons .refine__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.claude-sermons .refine[open] > .refine__summary::before { transform: rotate(45deg); }
.claude-sermons .refine__badge { display: inline-flex; align-items: center; min-height: 1.5rem; padding: 0 0.5rem; border-radius: var(--radius-pill); background: var(--colour-gilt-soft); color: var(--colour-gilt); font-size: var(--size-small); letter-spacing: 0.06em; }
.claude-sermons .refine__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); align-items: end; padding: var(--space-2) 0 var(--space-4); }
.claude-sermons .refine__actions { grid-column: 1 / -1; }
.claude-sermons .tokens { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin: var(--space-4) 0 0; }
.claude-sermons .tokens__list { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.claude-sermons .token { display: inline-flex; align-items: center; gap: 0.5em; min-height: var(--target-size); padding: 0 0.85rem; border: 1px solid var(--colour-gilt); border-radius: var(--radius-pill); background: var(--colour-gilt-soft); color: var(--colour-ink); font-size: var(--size-ui); text-decoration: none; }
.claude-sermons .token:hover { background: var(--colour-gilt); color: var(--colour-on-ink); }
.claude-sermons .token__remove { font-size: 1.15em; line-height: 1; }
.claude-sermons .tokens__clear { display: inline-flex; align-items: center; min-height: var(--target-size); font-family: var(--font-signage); font-stretch: 87.5%; letter-spacing: 0.08em; text-transform: uppercase; font-size: var(--size-small); font-weight: 600; }
.claude-sermons .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.claude-sermons .chip { display: inline-flex; align-items: center; gap: 0.5em; min-height: var(--target-size); padding: 0 0.9rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-pill); background: var(--colour-raised); color: var(--colour-ink); font-size: var(--size-ui); text-decoration: none; }
.claude-sermons .chip:hover { border-color: var(--colour-ink); color: var(--colour-ink); background: var(--colour-recessed); }
.claude-sermons .chip__count { font-family: var(--font-signage); font-variant-numeric: tabular-nums; color: var(--colour-ink-muted); }

/* ---- catalogue entries ---- */
.claude-sermons .catalogue { list-style: none; margin: 0; padding: 0; }
.claude-sermons .catalogue > li { border-top: 1px solid var(--colour-rule); }
.claude-sermons .catalogue > li:last-child { border-bottom: 1px solid var(--colour-rule); }
.claude-sermons .entry { position: relative; display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); grid-template-areas: "ordinal stamp" "ordinal title" "ordinal meta" "ordinal desc" "ordinal reason"; column-gap: var(--space-4); row-gap: var(--space-1); padding: var(--space-4) 0; }
.claude-sermons .entry__stamp { grid-area: stamp; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-gilt); }
.claude-sermons .entry__title { grid-area: title; font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.claude-sermons .entry__title a { color: var(--colour-ink); text-decoration: none; }
.claude-sermons .entry__title a::after { content: ""; position: absolute; inset: 0; }
.claude-sermons .entry:hover .entry__title a { color: var(--colour-gilt); text-decoration: underline; }
.claude-sermons .entry__meta { grid-area: meta; display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .entry__meta a { position: relative; z-index: 1; color: var(--colour-ink-soft); }
.claude-sermons .entry__meta a:hover { color: var(--colour-gilt); }
.claude-sermons .entry__desc { grid-area: desc; max-width: var(--measure-prose); margin-top: var(--space-1); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.55; }
.claude-sermons .entry__desc--clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.claude-sermons .entry__reason { grid-area: reason; font-size: var(--size-small); color: var(--colour-ink-muted); }
.claude-sermons .entry--card { column-gap: var(--space-5); padding: var(--space-5); background: var(--colour-raised); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.claude-sermons .entry--card .entry__title { font-size: var(--size-card-title); }
.claude-sermons .entry--card .entry__desc { margin-top: var(--space-3); }
.claude-sermons .entry__tab { grid-area: ordinal; align-self: stretch; }
.claude-sermons .entry__tab .tab { position: relative; z-index: 1; width: 100%; height: 100%; min-height: 10rem; justify-content: center; }
.claude-sermons .catalogue--cards > li { border: 0; }
.claude-sermons .catalogue--cards > li + li { margin-top: var(--space-4); }
.claude-sermons .catalogue--related { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 var(--space-6); }
.claude-sermons .entry--related { padding: var(--space-3) 0; }
.claude-sermons .entry--related .entry__title { font-size: var(--size-lede); }

/* ---- indexes ---- */
.claude-sermons .index { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: var(--space-7); }
.claude-sermons .index li { break-inside: avoid; border-top: 1px solid var(--colour-rule); }
.claude-sermons .index a { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); min-height: var(--target-size); padding: var(--space-2) 0; font-family: var(--font-display); font-size: var(--size-h3); color: var(--colour-ink); text-decoration: none; }
.claude-sermons .index a:hover { color: var(--colour-gilt); }
.claude-sermons .index__count { flex: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-muted); font-variant-numeric: tabular-nums; }
.claude-sermons .index--single { columns: 1; }

/* ---- results & pagination ---- */
.claude-sermons .results { margin-top: var(--space-6); }
.claude-sermons .results:focus { outline: none; }
.claude-sermons .results__list { max-width: var(--measure-results); }
.claude-sermons .results__status { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.claude-sermons .results__fewer { display: inline-flex; align-items: center; min-height: var(--target-size); font-size: var(--size-ui); }
.claude-sermons .pagination { margin-top: var(--space-6); }
.claude-sermons .pagination__list { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.claude-sermons .pagination__page, .claude-sermons .pagination__step { display: inline-flex; align-items: center; justify-content: center; min-width: var(--target-size); min-height: var(--target-size); padding: 0 0.75rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); color: var(--colour-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none; font-variant-numeric: tabular-nums; }
.claude-sermons .pagination__page:hover, .claude-sermons .pagination__step:hover { border-color: var(--colour-ink); background: var(--colour-recessed); }
.claude-sermons .pagination__page[aria-current="page"] { background: var(--colour-ink); border-color: var(--colour-ink); color: var(--colour-on-ink); }
.claude-sermons .pagination__gap { display: inline-flex; align-items: center; padding: 0 var(--space-1); color: var(--colour-ink-muted); }
.claude-sermons .empty { max-width: var(--measure-prose); padding: var(--space-5) 0; }
.claude-sermons .empty__title { font-family: var(--font-display); font-size: var(--size-h3); margin-bottom: var(--space-2); }
.claude-sermons .empty p + p { margin-top: var(--space-3); }

/* ---- reading ---- */
.claude-sermons .prose { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.claude-sermons .prose p { margin: 0 0 0.9em; }
.claude-sermons .prose p:last-child { margin-bottom: 0; }
.claude-sermons .prose--lede { font-size: var(--size-lede); line-height: 1.6; }

/* ---- boundary ---- */
.claude-sermons .boundary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-6); align-items: center; max-width: var(--measure-page); padding: var(--space-6) 0; }
.claude-sermons .boundary__message { margin: var(--space-3) 0 var(--space-5); }
.claude-sermons .boundary__art { width: min(18rem, 40vw); height: auto; }

/* ---- responsive ---- */
@media (max-width: 76rem) {
  .claude-sermons .catalogue--related { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 60rem) {
  .claude-sermons .refine__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .claude-sermons .boundary { grid-template-columns: minmax(0, 1fr); }
  .claude-sermons .boundary__art { width: 12rem; }
}
@media (max-width: 44rem) {
  .claude-sermons .section { margin-top: var(--space-7); }
  .claude-sermons .entry__desc--clamp { -webkit-line-clamp: 4; line-clamp: 4; }
  .claude-sermons .entry, .claude-sermons .entry--card { grid-template-columns: 2.25rem minmax(0, 1fr); column-gap: var(--space-3); }
  .claude-sermons .entry--card { padding: var(--space-4); }
  .claude-sermons .entry__tab .tab__name { font-size: var(--size-small); }
  .claude-sermons .index { columns: 1; }
}
@media (max-width: 38rem) {
  .claude-sermons .refine__grid { grid-template-columns: minmax(0, 1fr); }
  .claude-sermons .section__head { flex-direction: column; align-items: flex-start; }
  .claude-sermons .title-page__title { font-size: var(--size-title); }
}

/* ---- motion, forced colours, print ---- */
@media (prefers-reduced-motion: reduce) {
  .claude-sermons { scroll-behavior: auto; }
  .claude-sermons *, .claude-sermons *::before, .claude-sermons *::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }
}
@media (forced-colors: active) {
  .claude-sermons .token, .claude-sermons .chip, .claude-sermons .pagination__page[aria-current="page"] { outline: 2px solid CanvasText; }
  .claude-sermons .entry__title a::after { display: none; }
  .claude-sermons .section__title::after { background: CanvasText; }
  .claude-sermons .button { border: 2px solid ButtonText; }
}
@media print {
  .claude-sermons .preview-band, .claude-sermons .finder, .claude-sermons .pagination, .claude-sermons .tokens, .claude-sermons .chips, .claude-sermons .shelf, .claude-sermons .rail, .claude-sermons .trail { display: none !important; }
  .claude-sermons { background: var(--colour-ground-print); color: var(--colour-ink-print); }
  .claude-sermons a { color: inherit; text-decoration: none; }
  .claude-sermons .entry__title a::after { display: none; }
  .claude-sermons .entry, .claude-sermons .question { break-inside: avoid; }
}


/* ---- hero band ---- */
.claude-sermons .legend { display: grid; grid-template-columns: repeat(3, auto); gap: var(--space-1) var(--space-4); margin: 0; padding: 0; list-style: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); }
.claude-sermons .legend li { display: flex; align-items: center; gap: var(--space-2); min-height: 1.5rem; }
.claude-sermons .legend__swatch { flex: none; width: 0.6rem; height: 1.1rem; border-radius: var(--radius-cell); background: var(--hue); }
.claude-sermons .legend summary { min-height: var(--target-size); display: flex; align-items: center; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }

/* ---- the shelf ---- */
.claude-sermons .shelf { --spine-base: 1.5rem; --spine-k: 0.35rem; --spine-height: 6rem; --board: 0.375rem; --row-gap: 1.25rem; position: relative; margin-top: var(--space-6); }
.claude-sermons .shelf__skip:not(:focus), .claude-sermons .ruler-block__skip:not(:focus) { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.claude-sermons .shelf__skip:focus { position: absolute; left: 0; top: 0; z-index: 5; padding: var(--space-2) var(--space-3); background: var(--colour-ink); color: var(--colour-on-ink); font-family: var(--font-signage); text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; }
.claude-sermons .shelf__row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--row-gap) 2px; margin: 0; padding: 0 0 var(--board); list-style: none; background: repeating-linear-gradient(to bottom, transparent 0 var(--spine-height), var(--colour-ink) var(--spine-height) calc(var(--spine-height) + var(--board)), transparent calc(var(--spine-height) + var(--board)) calc(var(--spine-height) + var(--row-gap))); }
.claude-sermons .spine { position: relative; flex: none; display: flex; width: calc(var(--spine-base) + var(--sqrt) * var(--spine-k)); height: var(--spine-height); margin-bottom: 0; }
.claude-sermons .spine__link, .claude-sermons .spine__ghost { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0.35rem 0 0.45rem; border-radius: var(--radius-cell) var(--radius-cell) 0 0; text-decoration: none; }
.claude-sermons .spine__ghost { border: 1px solid var(--colour-rule-strong); border-bottom: 0; color: var(--colour-ink-muted); }
.claude-sermons .spine__link { background: var(--hue); color: var(--colour-on-ink); transform: translateY(-0.375rem); box-shadow: 0 0.375rem 0 var(--hue); transition: transform var(--motion-duration) var(--motion-easing), box-shadow var(--motion-duration) var(--motion-easing); }
.claude-sermons .spine__link:hover { transform: translateY(-0.7rem); box-shadow: 0 0.7rem 0 var(--hue), var(--shadow-lift); color: var(--colour-on-ink); }
.claude-sermons .spine__link:focus-visible { outline-offset: 2px; }
.claude-sermons .spine--revelation .spine__link { color: var(--colour-gilt-bright); }
.claude-sermons .spine__name, .claude-sermons .spine__abbr { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1; white-space: nowrap; }
.claude-sermons .spine__abbr { display: none; }
.claude-sermons .spine[data-len="long"] .spine__name { display: none; }
.claude-sermons .spine[data-len="long"] .spine__abbr { display: block; }
.claude-sermons .spine__count { display: grid; place-items: center; min-width: 1.125rem; height: 1.125rem; padding: 0 0.2rem; border-radius: var(--radius-cell); background: var(--colour-raised); color: var(--colour-ink); font-family: var(--font-signage); font-size: 0.8125rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.claude-sermons .spine[aria-current="true"] .spine__link, .claude-sermons .spine.is-current .spine__link { box-shadow: 0 0.375rem 0 var(--hue), inset 0 0.25rem 0 var(--colour-gilt-bright); }
.claude-sermons .bookend { flex: none; display: flex; align-items: center; justify-content: center; width: 0.875rem; height: var(--spine-height); margin-bottom: 0; overflow: hidden; background: var(--colour-ink); color: var(--colour-on-ink-soft); }
.claude-sermons .bookend span { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); font-family: var(--font-signage); font-size: 0.625rem; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
.claude-sermons .bookend__short { display: none; }
.claude-sermons .shelf__caption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-top: var(--space-3); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .shelf__caption a { display: inline-flex; align-items: center; min-height: var(--target-size); }
@keyframes spine-settle { .claude-sermons from { opacity: 0; transform: translateY(0.75rem); } .claude-sermons to { opacity: 1; transform: none; } }
.claude-sermons .shelf--settle .spine { animation: spine-settle var(--motion-settle) var(--motion-easing) both; animation-delay: calc(var(--i) * 12ms); }
.claude-sermons .spine--genesis{--sqrt:7.07;--i:0;--hue:var(--colour-spine-law)}
.claude-sermons .spine--exodus{--sqrt:6.32;--i:1;--hue:var(--colour-spine-law)}
.claude-sermons .spine--leviticus{--sqrt:5.2;--i:2;--hue:var(--colour-spine-law)}
.claude-sermons .spine--numbers{--sqrt:6;--i:3;--hue:var(--colour-spine-law)}
.claude-sermons .spine--deuteronomy{--sqrt:5.83;--i:4;--hue:var(--colour-spine-law)}
.claude-sermons .spine--joshua{--sqrt:4.9;--i:5;--hue:var(--colour-spine-history)}
.claude-sermons .spine--judges{--sqrt:4.58;--i:6;--hue:var(--colour-spine-history)}
.claude-sermons .spine--ruth{--sqrt:2;--i:7;--hue:var(--colour-spine-history)}
.claude-sermons .spine--1-samuel{--sqrt:5.57;--i:8;--hue:var(--colour-spine-history)}
.claude-sermons .spine--2-samuel{--sqrt:4.9;--i:9;--hue:var(--colour-spine-history)}
.claude-sermons .spine--1-kings{--sqrt:4.69;--i:10;--hue:var(--colour-spine-history)}
.claude-sermons .spine--2-kings{--sqrt:5;--i:11;--hue:var(--colour-spine-history)}
.claude-sermons .spine--1-chronicles{--sqrt:5.39;--i:12;--hue:var(--colour-spine-history)}
.claude-sermons .spine--2-chronicles{--sqrt:6;--i:13;--hue:var(--colour-spine-history)}
.claude-sermons .spine--ezra{--sqrt:3.16;--i:14;--hue:var(--colour-spine-history)}
.claude-sermons .spine--nehemiah{--sqrt:3.61;--i:15;--hue:var(--colour-spine-history)}
.claude-sermons .spine--esther{--sqrt:3.16;--i:16;--hue:var(--colour-spine-history)}
.claude-sermons .spine--job{--sqrt:6.48;--i:17;--hue:var(--colour-spine-wisdom)}
.claude-sermons .spine--psalms{--sqrt:12.25;--i:18;--hue:var(--colour-spine-wisdom)}
.claude-sermons .spine--proverbs{--sqrt:5.57;--i:19;--hue:var(--colour-spine-wisdom)}
.claude-sermons .spine--ecclesiastes{--sqrt:3.46;--i:20;--hue:var(--colour-spine-wisdom)}
.claude-sermons .spine--song-of-solomon{--sqrt:2.83;--i:21;--hue:var(--colour-spine-wisdom)}
.claude-sermons .spine--isaiah{--sqrt:8.12;--i:22;--hue:var(--colour-spine-major-prophets)}
.claude-sermons .spine--jeremiah{--sqrt:7.21;--i:23;--hue:var(--colour-spine-major-prophets)}
.claude-sermons .spine--lamentations{--sqrt:2.24;--i:24;--hue:var(--colour-spine-major-prophets)}
.claude-sermons .spine--ezekiel{--sqrt:6.93;--i:25;--hue:var(--colour-spine-major-prophets)}
.claude-sermons .spine--daniel{--sqrt:3.46;--i:26;--hue:var(--colour-spine-major-prophets)}
.claude-sermons .spine--hosea{--sqrt:3.74;--i:27;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--joel{--sqrt:1.73;--i:28;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--amos{--sqrt:3;--i:29;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--obadiah{--sqrt:1;--i:30;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--jonah{--sqrt:2;--i:31;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--micah{--sqrt:2.65;--i:32;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--nahum{--sqrt:1.73;--i:33;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--habakkuk{--sqrt:1.73;--i:34;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--zephaniah{--sqrt:1.73;--i:35;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--haggai{--sqrt:1.41;--i:36;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--zechariah{--sqrt:3.74;--i:37;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--malachi{--sqrt:2;--i:38;--hue:var(--colour-spine-minor-prophets)}
.claude-sermons .spine--matthew{--sqrt:5.29;--i:39;--hue:var(--colour-spine-gospels-acts)}
.claude-sermons .spine--mark{--sqrt:4;--i:40;--hue:var(--colour-spine-gospels-acts)}
.claude-sermons .spine--luke{--sqrt:4.9;--i:41;--hue:var(--colour-spine-gospels-acts)}
.claude-sermons .spine--john{--sqrt:4.58;--i:42;--hue:var(--colour-spine-gospels-acts)}
.claude-sermons .spine--acts{--sqrt:5.29;--i:43;--hue:var(--colour-spine-gospels-acts)}
.claude-sermons .spine--romans{--sqrt:4;--i:44;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--1-corinthians{--sqrt:4;--i:45;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--2-corinthians{--sqrt:3.61;--i:46;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--galatians{--sqrt:2.45;--i:47;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--ephesians{--sqrt:2.45;--i:48;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--philippians{--sqrt:2;--i:49;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--colossians{--sqrt:2;--i:50;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--1-thessalonians{--sqrt:2.24;--i:51;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--2-thessalonians{--sqrt:1.73;--i:52;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--1-timothy{--sqrt:2.45;--i:53;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--2-timothy{--sqrt:2;--i:54;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--titus{--sqrt:1.73;--i:55;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--philemon{--sqrt:1;--i:56;--hue:var(--colour-spine-pauline)}
.claude-sermons .spine--hebrews{--sqrt:3.61;--i:57;--hue:var(--colour-spine-general)}
.claude-sermons .spine--james{--sqrt:2.24;--i:58;--hue:var(--colour-spine-general)}
.claude-sermons .spine--1-peter{--sqrt:2.24;--i:59;--hue:var(--colour-spine-general)}
.claude-sermons .spine--2-peter{--sqrt:1.73;--i:60;--hue:var(--colour-spine-general)}
.claude-sermons .spine--1-john{--sqrt:2.24;--i:61;--hue:var(--colour-spine-general)}
.claude-sermons .spine--2-john{--sqrt:1;--i:62;--hue:var(--colour-spine-general)}
.claude-sermons .spine--3-john{--sqrt:1;--i:63;--hue:var(--colour-spine-general)}
.claude-sermons .spine--jude{--sqrt:1;--i:64;--hue:var(--colour-spine-general)}
.claude-sermons .spine--revelation{--sqrt:4.69;--i:65;--hue:var(--colour-spine-revelation)}

/* ---- canon strip ---- */
.claude-sermons .strip { display: block; width: 100%; height: 0.625rem; overflow: visible; }
.claude-sermons .strip--marked { height: 0.875rem; }
.claude-sermons .strip__label { margin-top: var(--space-1); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }

/* ---- book tab ---- */
.claude-sermons .tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 3.5rem; min-height: 9rem; padding: 0.5rem 0 0.6rem; border-radius: var(--radius-cell); background: var(--hue); color: var(--colour-on-ink); text-decoration: none; }
.claude-sermons .tab:hover { color: var(--colour-on-ink); box-shadow: var(--shadow-lift); }
.claude-sermons .tab--ghost { border: 1px solid var(--colour-rule-strong); background: transparent; color: var(--colour-ink-muted); }
.claude-sermons .tab__name { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; line-height: 1; white-space: nowrap; }
.claude-sermons .tab__count { display: grid; place-items: center; min-width: 1.5rem; height: 1.5rem; border-radius: var(--radius-cell); background: var(--colour-raised); color: var(--colour-ink); font-family: var(--font-signage); font-weight: 700; font-variant-numeric: tabular-nums; }
.claude-sermons .tab--revelation, .claude-sermons .hue--revelation.tab { color: var(--colour-gilt-bright); }

/* ---- open book ---- */
.claude-sermons .open-book { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-5); align-items: start; padding: var(--space-5); background: var(--colour-raised); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.claude-sermons .open-book__title { font-family: var(--font-display); font-size: var(--size-title); line-height: 1; }
.claude-sermons .open-book__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin-top: var(--space-2); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .open-book__meta a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.claude-sermons .ruler-block { margin-top: var(--space-4); }
.claude-sermons .ruler-block__label { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }
.claude-sermons .ruler-block__label a { display: inline-flex; align-items: center; min-height: 1.75rem; }
.claude-sermons .ruler { position: relative; display: flex; flex-wrap: wrap; gap: 2px; margin: 0; padding: 0; list-style: none; }
.claude-sermons .ruler-block__skip:focus { display: inline-flex; align-items: center; min-height: 1.75rem; padding: 0 var(--space-2); background: var(--colour-ink); color: var(--colour-on-ink); font-size: var(--size-small); text-decoration: none; }
.claude-sermons .ruler__cell { position: relative; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: var(--radius-cell); background: var(--colour-tile); color: var(--colour-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; font-variant-numeric: tabular-nums; text-decoration: none; }
.claude-sermons .ruler__cell:hover { background: var(--colour-ink); color: var(--colour-on-ink); }
.claude-sermons .ruler__cell.is-marked { background: var(--hue); color: var(--colour-on-ink); }
.claude-sermons .ruler__cell[aria-current="true"] { background: var(--colour-ink); color: var(--colour-gilt-bright); box-shadow: inset 0 0 0 2px var(--colour-gilt-bright); }
.claude-sermons .ruler__count { position: absolute; top: 0.1rem; right: 0.15rem; font-size: 0.625rem; line-height: 1; font-weight: 700; }
.claude-sermons .ruler__note { margin-top: var(--space-2); font-size: var(--size-small); color: var(--colour-ink-soft); }
.claude-sermons .open-book__clear { display: inline-flex; align-items: center; min-height: var(--target-size); margin-top: var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; letter-spacing: 0.08em; text-transform: uppercase; font-size: var(--size-small); font-weight: 600; }
.claude-sermons .book-details { margin-top: var(--space-4); border-top: 1px solid var(--colour-rule); }
.claude-sermons .book-details__summary { display: flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); padding: var(--space-2) 0; list-style: none; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.claude-sermons .book-details__summary::-webkit-details-marker { display: none; }
.claude-sermons .book-details__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); }
.claude-sermons .book-details[open] > .book-details__summary::before { transform: rotate(45deg); }

/* ---- finder ---- */
.claude-sermons .finder { margin-top: var(--space-5); }
.claude-sermons .finder__row { display: grid; grid-template-columns: minmax(12rem, 1.6fr) minmax(9rem, 1fr) minmax(9rem, 1fr) auto; gap: var(--space-3); align-items: end; }
.claude-sermons .finder__submit { display: grid; }

/* ---- canon table (books index) ---- */
.claude-sermons .canon-table-wrap { overflow-x: auto; margin-top: var(--space-6); }
.claude-sermons .canon-table { width: 100%; border-collapse: collapse; font-size: var(--size-ui); }
.claude-sermons .canon-table th, .claude-sermons .canon-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--colour-rule); text-align: left; vertical-align: top; }
.claude-sermons .canon-table th { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-soft); }
.claude-sermons .canon-table td.num { text-align: right; font-variant-numeric: tabular-nums; }

/* ---- responsive ---- */
@media (max-width: 60rem) {
  .claude-sermons .shelf { --spine-base: 1.5rem; --spine-k: 0.25rem; --spine-height: 5.5rem; }
  .claude-sermons .bookend__long { display: none; }
  .claude-sermons .bookend__short { display: block; }
  .claude-sermons .open-book { grid-template-columns: minmax(0, 1fr); }
  .claude-sermons .open-book .tab { flex-direction: row; width: 100%; min-height: 2.75rem; padding: 0 var(--space-3); }
  .claude-sermons .open-book .tab__name { writing-mode: horizontal-tb; transform: none; }
  .claude-sermons .finder__row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .claude-sermons .finder__submit { grid-column: 1 / -1; justify-content: start; }
}
@media (max-width: 44rem) {
  .claude-sermons .shelf { --spine-base: 1.5rem; --spine-k: 0.09rem; --spine-height: 4rem; --row-gap: 1rem; }
  .claude-sermons .spine__name { display: none; }
  .claude-sermons .spine__abbr { display: block; }
  .claude-sermons .spine__link, .claude-sermons .spine__ghost { padding: 0.25rem 0 0.3rem; }
  .claude-sermons .bookend { width: 0.75rem; }
  .claude-sermons .legend { grid-template-columns: repeat(2, auto); }
  .claude-sermons .ruler__cell { width: 2.75rem; height: 2.75rem; }
}
@media (max-width: 38rem) {
  .claude-sermons .finder__row { grid-template-columns: minmax(0, 1fr); }
  .claude-sermons .finder__submit .button { width: 100%; }
}
@media (forced-colors: active) {
  .claude-sermons .shelf__row { border-bottom: var(--board) solid CanvasText; }
  .claude-sermons .spine__link { outline: 2px solid LinkText; outline-offset: -2px; }
  .claude-sermons .spine__ghost { border-color: GrayText; color: GrayText; }
  .claude-sermons .spine[aria-current="true"] .spine__link, .claude-sermons .spine.is-current .spine__link { outline: 3px double Highlight; }
  .claude-sermons .ruler__cell.is-marked { outline: 2px solid LinkText; outline-offset: -2px; }
  .claude-sermons .ruler__cell[aria-current="true"] { outline: 3px double Highlight; }
  .claude-sermons .tab { outline: 2px solid CanvasText; outline-offset: -2px; }
}


.claude-sermons .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-5); list-style: none; margin: 0; padding: 0; }
.claude-sermons .cards > li { display: grid; min-width: 0; }
.claude-sermons .card { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-width: 0; background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); overflow: hidden; transition: box-shadow var(--motion-duration) var(--motion-easing), transform var(--motion-duration) var(--motion-easing), border-color var(--motion-duration) var(--motion-easing); }
.claude-sermons .card:hover { border-color: var(--colour-rule-strong); box-shadow: var(--shadow-lift); transform: translateY(-2px); }
.claude-sermons .card:focus-within { border-color: var(--colour-ink); }
@supports selector(:has(a)) {
  .claude-sermons .card:has(.card__title a:focus-visible) { outline: 3px solid var(--colour-ink); outline-offset: 3px; box-shadow: 0 0 0 3px var(--colour-ground); }
  .claude-sermons .card__title a:focus-visible { outline: none; box-shadow: none; }
}
.claude-sermons .card--latest { border-color: var(--colour-gilt); }

/* ---- the plate: the book's cover where a photograph would sit ---- */
.claude-sermons .card__plate { position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: 0.15rem; aspect-ratio: 16 / 7; padding: var(--space-4) var(--space-4) calc(var(--space-4) + 0.375rem); background: var(--hue, var(--colour-ink)); background-image: linear-gradient(to bottom, transparent, var(--colour-ink)); background-blend-mode: soft-light; color: var(--colour-on-ink); }
.claude-sermons .card__plate::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, var(--colour-on-ink) 0 1px, transparent 1px 100%); background-size: 1.5rem 100%; opacity: 0.08; transition: opacity var(--motion-duration) var(--motion-easing); }
.claude-sermons .card:hover .card__plate::before { opacity: 0.12; }
.claude-sermons .card__group { position: absolute; top: var(--space-3); left: var(--space-4); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.9; }
.claude-sermons .card__ordinal { position: absolute; top: var(--space-3); right: var(--space-4); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; opacity: 0.9; }
.claude-sermons .card__bookname { position: relative; font-family: var(--font-signage); font-stretch: 87.5%; font-size: clamp(1.5rem, 1rem + 1.6vw, 2.25rem); font-weight: 700; letter-spacing: 0.05em; line-height: 0.95; text-transform: uppercase; text-wrap: balance; overflow-wrap: anywhere; }
.claude-sermons .card__ref { position: relative; font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.1; font-variant-numeric: tabular-nums; }
.claude-sermons .card__device { position: relative; display: block; }
.claude-sermons .card__mark { display: block; width: 2.5rem; height: 2.5rem; }
.claude-sermons .card__strip { position: absolute; left: 0; right: 0; bottom: 0; display: block; width: 100%; height: 0.375rem; transition: height var(--motion-duration) var(--motion-easing); }
.claude-sermons .card:hover .card__strip { height: 0.5rem; }
.claude-sermons .card__strip rect { fill: var(--colour-on-ink); opacity: 0.35; }
.claude-sermons .card__strip .card__strip-here { fill: var(--colour-gilt-bright); opacity: 1; }
.claude-sermons .card__strip--plain rect { fill: var(--colour-rule); opacity: 1; }
.claude-sermons .card--plain .card__plate { background: var(--colour-tile); background-image: none; color: var(--colour-ink-muted); }
.claude-sermons .card--plain .card__plate::before { background: repeating-linear-gradient(90deg, var(--colour-ink) 0 1px, transparent 1px 100%); background-size: 1.5rem 100%; opacity: 0.06; }

/* ---- the latest ribbon: a bookmark hanging from the plate's top edge ---- */
.claude-sermons .card__flag { position: absolute; z-index: 2; top: 0; right: var(--space-4); padding: 0.4rem 0.6rem 0.65rem; background: var(--colour-gilt); color: var(--colour-on-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; line-height: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 0.35rem), 0 100%); }
.claude-sermons .card--plain .card__flag { background: var(--colour-ink); }

/* ---- the body ---- */
.claude-sermons .card__body { position: relative; display: grid; align-content: start; gap: var(--space-2); padding: var(--space-4) var(--space-4) var(--space-3); min-width: 0; }
.claude-sermons .card__top { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.claude-sermons .card__top a, .claude-sermons .card__meta a, .claude-sermons .card__booklink { position: relative; z-index: 1; color: inherit; }
.claude-sermons .card__top a:hover, .claude-sermons .card__meta a:hover, .claude-sermons a.card__booklink:hover { color: var(--colour-gilt); }
.claude-sermons .card__series { color: var(--colour-gilt); }
.claude-sermons .card__series a { color: var(--colour-gilt); }
.claude-sermons .card__pill { display: inline-flex; align-items: center; min-height: 1.5rem; margin-left: auto; padding: 0 0.5rem; border: 1px dashed var(--colour-rule-strong); border-radius: var(--radius-cell); background: var(--colour-recessed); color: var(--colour-ink-soft); font-size: var(--size-small); letter-spacing: 0.06em; text-transform: none; }
.claude-sermons .card__title { font-family: var(--font-display); font-size: var(--size-card-heading); line-height: 1.12; letter-spacing: -0.01em; text-wrap: pretty; overflow-wrap: anywhere; }
.claude-sermons .card__title.is-long { font-size: var(--size-h3); line-height: 1.15; }
.claude-sermons .card__title.is-longest { font-size: var(--size-lede); line-height: 1.2; }
.claude-sermons .card__title a { color: var(--colour-ink); text-decoration: none; }
.claude-sermons .card__title a::after { content: ""; position: absolute; inset: 0; }
.claude-sermons .card:hover .card__title a { color: var(--colour-gilt); text-decoration: underline; text-decoration-color: var(--colour-gilt); text-decoration-thickness: 0.06em; text-underline-offset: 0.16em; }
.claude-sermons .card__meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-2); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .card__dot { color: var(--colour-rule-strong); }
.claude-sermons .card__desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; line-clamp: 4; overflow: hidden; margin-top: var(--space-1); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.5; color: var(--colour-ink-soft); }

/* ---- the footer ---- */
.claude-sermons .card__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 2.75rem; padding: 0 var(--space-4); border-top: 1px solid var(--colour-rule); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }
.claude-sermons .card__cta { color: var(--colour-gilt); }
.claude-sermons .card__cta::after { content: " →"; }
.claude-sermons .card__booklink { display: inline-flex; align-items: center; min-height: 2.75rem; text-decoration: none; }
.claude-sermons .card__booklink::before { content: ""; display: inline-block; width: 0.45rem; height: 1rem; margin-right: 0.45rem; border-radius: var(--radius-cell); background: var(--hue, var(--colour-ink-muted)); }
.claude-sermons .card__booklink--plain::before { background: var(--hue); }

@media (max-width: 60rem) {
  .claude-sermons .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
}
@media (max-width: 44rem) {
  .claude-sermons .cards { grid-template-columns: minmax(0, 1fr); }
  .claude-sermons .card__plate { aspect-ratio: 16 / 6; padding: var(--space-3) var(--space-3) calc(var(--space-3) + 0.375rem); }
  .claude-sermons .card__group, .claude-sermons .card__flag { left: var(--space-3); }
  .claude-sermons .card__ordinal, .claude-sermons .card__flag { right: var(--space-3); left: auto; }
  .claude-sermons .card__body { padding: var(--space-3) var(--space-3) var(--space-2); }
  .claude-sermons .card__foot { padding: 0 var(--space-3); }
  .claude-sermons .card__desc { -webkit-line-clamp: 5; line-clamp: 5; }
}
@media (prefers-reduced-motion: reduce) {
  .claude-sermons .card:hover { transform: none; }
  .claude-sermons .card:hover .card__strip { height: 0.375rem; }
}
@media (forced-colors: active) {
  .claude-sermons .card { border: 1px solid CanvasText; }
  .claude-sermons .card--latest { border: 2px solid CanvasText; }
  .claude-sermons .card__plate { border-bottom: 1px solid CanvasText; }
  .claude-sermons .card__flag, .claude-sermons .card__pill { border: 1px solid CanvasText; }
  .claude-sermons .card__title a::after { display: none; }
}
@media print {
  .claude-sermons .card { break-inside: avoid; box-shadow: none; }
  .claude-sermons .card__plate { background: none; background-image: none; color: var(--colour-ink-print); border-bottom: 1px solid var(--colour-ink-print); }
  .claude-sermons .card__plate::before, .claude-sermons .card__strip { display: none; }
  .claude-sermons .card__flag { background: none; color: var(--colour-ink-print); clip-path: none; border: 1px solid var(--colour-ink-print); }
  .claude-sermons .card__title a::after { display: none; }
}


.claude-sermons .fold-section { margin-top: var(--space-6); }
.claude-sermons .fold { border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-card); background: var(--colour-raised); box-shadow: var(--shadow-card); }
.claude-sermons .fold__summary { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(8rem, 22rem); align-items: center; gap: var(--space-4); min-height: 3.5rem; padding: var(--space-3) var(--space-4); list-style: none; cursor: pointer; }
.claude-sermons .fold__summary::-webkit-details-marker { display: none; }
.claude-sermons .fold__summary:hover .fold__title { color: var(--colour-gilt); }
.claude-sermons .fold__summary:focus-visible { outline-offset: -3px; border-radius: var(--radius-card); }
.claude-sermons .fold__chevron { flex: none; width: 0.6rem; height: 0.6rem; margin-right: var(--space-1); border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.claude-sermons .fold[open] > .fold__summary .fold__chevron { transform: rotate(45deg); }
.claude-sermons .fold__label { display: grid; gap: 0.15rem; min-width: 0; }
.claude-sermons .fold__title { font-family: var(--font-signage); font-stretch: 87.5%; font-size: 1.0625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink); }
.claude-sermons .fold__hint { font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .fold__strip { display: block; min-width: 0; }
.claude-sermons .fold__strip .strip { height: 0.75rem; }
.claude-sermons .fold__body { padding: 0 var(--space-4) var(--space-4); border-top: 1px solid var(--colour-rule); }
.claude-sermons .fold__body .shelf { margin-top: var(--space-4); }
.claude-sermons .fold[open] > .fold__body { animation: fold-open var(--motion-settle) var(--motion-easing) both; }
@keyframes fold-open { .claude-sermons from { opacity: 0; transform: translateY(-0.25rem); } .claude-sermons to { opacity: 1; transform: none; } }
.claude-sermons .v4 .results { margin-top: var(--space-7); }
.claude-sermons .v4 .results__cards { max-width: none; }
.claude-sermons .v4 .section__aside { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); }
@media (max-width: 60rem) {
  .claude-sermons .fold__summary { grid-template-columns: auto minmax(0, 1fr); }
  .claude-sermons .fold__strip { grid-column: 1 / -1; }
}
@media (max-width: 44rem) {
  .claude-sermons .fold__summary { padding: var(--space-3); }
  .claude-sermons .fold__body { padding: 0 var(--space-3) var(--space-3); }
}
@media (forced-colors: active) {
  .claude-sermons .fold { border: 1px solid CanvasText; }
  .claude-sermons .fold__summary { outline: 1px solid transparent; }
}
@media print {
  .claude-sermons .fold { display: none !important; }
}


.claude-sermons .sermon { display: grid; grid-template-columns: 3.5rem minmax(0, 46rem) 14rem; gap: var(--space-6) var(--space-7); align-items: start; }
.claude-sermons .sermon__tab { position: sticky; top: var(--space-4); }
.claude-sermons .sermon__body { min-width: 0; }
.claude-sermons .sermon__rail { position: sticky; top: var(--space-4); }
.claude-sermons .sermon__head { margin-bottom: var(--space-6); }
.claude-sermons .sermon__stamp { display: inline-block; margin-bottom: var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--hue, var(--colour-gilt)); }
.claude-sermons .sermon__title { max-width: 22ch; font-size: var(--size-title); }
.claude-sermons .sermon__title.is-long { font-size: var(--size-card-title); }
.claude-sermons .sermon__meta { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--colour-rule); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .sermon__meta a { color: var(--colour-ink-soft); }
.claude-sermons .sermon__meta a:hover { color: var(--colour-gilt); }
.claude-sermons .sermon__note { font-style: italic; color: var(--colour-ink-muted); }
.claude-sermons .rail { display: grid; gap: var(--space-4); }
.claude-sermons .rail__title { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }
.claude-sermons .rail__list { display: grid; gap: 2px; list-style: none; margin: 0; padding: 0; }
.claude-sermons .rail__list a { display: flex; align-items: center; min-height: 2.25rem; padding: 0 var(--space-3); border-left: 2px solid var(--colour-rule); color: var(--colour-ink-soft); font-size: var(--size-ui); text-decoration: none; }
.claude-sermons .rail__list a:hover { color: var(--colour-ink); border-left-color: var(--colour-ink); }
.claude-sermons .rail__list a[aria-current="location"] { color: var(--colour-ink); border-left-color: var(--colour-gilt); font-weight: 600; }
.claude-sermons .rail__meta { display: grid; gap: var(--space-1); margin: 0; padding-top: var(--space-3); border-top: 1px solid var(--colour-rule); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.claude-sermons .rail__meta dt { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-muted); }
.claude-sermons .rail__meta dd { margin: 0 0 var(--space-2); }
.claude-sermons .sermon-section { margin-top: var(--space-7); padding-top: var(--space-4); border-top: 1px solid var(--colour-rule); scroll-margin-top: var(--space-4); }
.claude-sermons .sermon-section--description { margin-top: 0; padding-top: 0; border-top: 0; }
.claude-sermons .sermon-section .section__title { margin-bottom: var(--space-4); }
.claude-sermons .plate { position: relative; max-width: 56rem; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--radius-card); background: var(--colour-ink); color: var(--colour-on-ink); color-scheme: dark; }
.claude-sermons .plate__consent { position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; gap: var(--space-3); padding: var(--space-5); text-align: center; }
.claude-sermons .plate__mark { width: 2.5rem; height: 2.5rem; }
.claude-sermons .plate__title { font-family: var(--font-display); font-size: var(--size-lede); }
.claude-sermons .plate__note { max-width: 40ch; font-size: var(--size-ui); color: var(--colour-on-ink-soft); }
.claude-sermons .plate__status { position: absolute; inset: 0; display: grid; place-content: center; margin: 0; font-size: var(--size-ui); color: var(--colour-on-ink-soft); }
.claude-sermons .plate[data-video-loaded="true"] .plate__status { display: none; }
.claude-sermons .plate iframe { display: block; width: 100%; height: 100%; border: 0; }
.claude-sermons .media-links { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
.claude-sermons .transcript { max-width: var(--measure-transcript); }
.claude-sermons .transcript__summary { display: inline-flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); padding: 0 var(--space-4); border: 2px solid var(--colour-ink); border-radius: var(--radius-control); list-style: none; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.claude-sermons .transcript__summary::-webkit-details-marker { display: none; }
.claude-sermons .transcript__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.claude-sermons .transcript[open] > .transcript__summary::before { transform: rotate(45deg); }
.claude-sermons .transcript__label--open, .claude-sermons .transcript[open] .transcript__label--closed { display: none; }
.claude-sermons .transcript[open] .transcript__label--open { display: inline; }
.claude-sermons .transcript__stats { font-weight: 400; letter-spacing: 0.04em; color: var(--colour-ink-soft); }
.claude-sermons .transcript__body { margin-top: var(--space-5); counter-reset: paragraph; }
.claude-sermons .transcript__body p { position: relative; }
.claude-sermons .transcript__body p::before { counter-increment: paragraph; content: counter(paragraph) / ""; position: absolute; left: -3rem; top: 0.35em; width: 2.25rem; text-align: right; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); color: var(--colour-ink-muted); font-variant-numeric: tabular-nums; }
.claude-sermons .transcript__back { margin-top: var(--space-5); font-size: var(--size-ui); }
.claude-sermons .transcript__back a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.claude-sermons .questions { max-width: var(--measure-prose); list-style: none; margin: 0; padding: 0; }
.claude-sermons .question { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr); column-gap: var(--space-3); padding: var(--space-4) 0; border-top: 1px solid var(--colour-rule); }
.claude-sermons .question:first-child { padding-top: 0; border-top: 0; }
.claude-sermons .question__number { font-family: var(--font-signage); font-stretch: 87.5%; font-size: 1.75rem; font-weight: 700; line-height: 1; color: var(--hue, var(--colour-gilt)); font-variant-numeric: tabular-nums; }
.claude-sermons .question__title { font-family: var(--font-display); font-size: var(--size-lede); line-height: 1.25; margin-bottom: var(--space-2); }
.claude-sermons .question__answer { grid-column: 2; }
@media (max-width: 76rem) {
  .claude-sermons .sermon { grid-template-columns: 3.5rem minmax(0, 1fr); }
  .claude-sermons .sermon__rail { position: static; grid-column: 2; order: 2; }
  .claude-sermons .sermon__body { order: 3; }
  .claude-sermons .rail__contents { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
  .claude-sermons .rail__list { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); }
  .claude-sermons .rail__list a { min-height: 2rem; padding: 0 var(--space-2); border-left: 0; border-bottom: 2px solid var(--colour-rule); }
  .claude-sermons .rail__list a:hover { border-bottom-color: var(--colour-ink); }
  .claude-sermons .rail__list a[aria-current="location"] { border-bottom-color: var(--colour-gilt); }
  .claude-sermons .rail__meta { display: none; }
}
@media (max-width: 60rem) {
  .claude-sermons .sermon { grid-template-columns: minmax(0, 1fr); }
  .claude-sermons .sermon__tab { position: static; }
  .claude-sermons .sermon__tab .tab { flex-direction: row; width: 100%; min-height: 2.75rem; padding: 0 var(--space-3); }
  .claude-sermons .sermon__tab .tab__name { writing-mode: horizontal-tb; transform: none; }
  .claude-sermons .sermon__rail { grid-column: auto; }
  .claude-sermons .rail { grid-template-columns: minmax(0, 1fr); }
  .claude-sermons .transcript__body p::before { display: none; }
}
@media (max-width: 44rem) {
  .claude-sermons .sermon__title { font-size: clamp(1.75rem, 1.2rem + 3vw, 2.25rem); }
  .claude-sermons .sermon__title.is-long { font-size: var(--size-h3); }
  .claude-sermons .sermon-section { margin-top: var(--space-6); }
  .claude-sermons .question { grid-template-columns: 2rem minmax(0, 1fr); }
  .claude-sermons .question__number { font-size: 1.375rem; }
}

/* Retained small-screen media and reading safeguards. */
.claude-sermons .sermon__stamp { margin-top: 0; }
.claude-sermons .plate:not([data-video-loaded]) { aspect-ratio: auto; min-height: 18rem; }
.claude-sermons .plate:not([data-video-loaded]) .plate__consent { position: relative; grid-template-columns: minmax(0, 1fr); }
.claude-sermons .plate__consent > * { min-width: 0; max-width: 100%; }
.claude-sermons .transcript__summary { max-width: 100%; flex-wrap: wrap; }
.claude-sermons .transcript__summary span { min-width: 0; overflow-wrap: anywhere; }
.claude-sermons .sermon__meta a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.claude-sermons .rail__list a { min-height: var(--target-size); }
@media (max-width: 76rem) { .claude-sermons .sermon__body { grid-column: 2; } }
@media (max-width: 60rem) { .claude-sermons .sermon__body { grid-column: auto; } }
@media (max-width: 44rem) { .claude-sermons .transcript__stats { flex-basis: 100%; padding-bottom: var(--space-2); } }
`;
