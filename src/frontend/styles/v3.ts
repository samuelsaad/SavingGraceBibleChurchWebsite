/** Reading-room styles are emitted only on V3; every selector stays in .v3. */
export const v3Styles = `
.v3 { --v3-line: var(--colour-rule); color: var(--colour-ink); padding-top: 1rem; }
.v3 *, .v3 *::before, .v3 *::after { box-sizing: border-box; }
.v3 :is(h1,h2,h3,p,ul,ol) { margin: 0; }
.v3 :is(ul,ol) { padding: 0; list-style: none; }
.v3 a { text-underline-offset: .22em; }
.v3 :is(a,button,input,select,summary):focus-visible { outline: 3px solid var(--colour-ink); outline-offset: 4px; box-shadow: 0 0 0 4px var(--colour-ground); }
.v3 :is(h1,h2,h3) { font-family: var(--font-display); font-weight: 400; text-wrap: balance; overflow-wrap: anywhere; }
.v3 .v3-kicker, .v3 .v3-edition { font-family: var(--font-signage); font-size: .8125rem; letter-spacing: .12em; text-transform: uppercase; }
.v3 .v3-kicker { color: var(--colour-gilt); }
.v3 .v3-intro-top { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--colour-ink); padding-bottom: 1rem; }
.v3 .v3-edition { color: var(--colour-ink-muted); }
.v3 .v3-title-row { display: grid; grid-template-columns: 1.7fr 1fr; align-items: end; gap: 3rem; padding: 3.5rem 0 3rem; }
.v3 h1 { font-size: clamp(3.25rem, 7.8vw, 6.75rem); line-height: .95; letter-spacing: -.04em; max-width: 15ch; }
.v3 h1 em { font-weight: 400; color: var(--colour-gilt); }
.v3 .v3-intro-note { max-width: 30rem; padding-bottom: .25rem; }
.v3 .v3-intro-note p { font: 1.125rem/1.65 var(--font-reading); color: var(--colour-ink-soft); }
.v3 .v3-intro-note a { display: inline-flex; align-items: center; gap: 2rem; min-height: 44px; margin-top: 1rem; font: .875rem var(--font-signage); text-transform: uppercase; letter-spacing: .06em; }
.v3 .v3-rule { display: block; width: 3rem; height: 2px; background: var(--colour-gilt); margin-bottom: 1rem; }
.v3 .v3-jumps { display: flex; flex-wrap: wrap; align-items: center; border-block: 1px solid var(--v3-line); gap: 0 2rem; }
.v3 .v3-jumps a { min-height: 52px; display: inline-flex; align-items: center; gap: .75rem; text-decoration: none; font: .875rem var(--font-signage); text-transform: uppercase; letter-spacing: .07em; }
.v3 .v3-jumps a:last-child { margin-left: auto; }
.v3 .v3-jumps a:hover, .v3 .v3-text-link:hover { color: var(--colour-gilt); text-decoration: underline; }
.v3 .v3-opening { display: grid; grid-template-columns: 1.65fr 1fr; gap: 3rem; padding: 3rem 0 1rem; }
.v3 .v3-feature { position: relative; background: var(--colour-recessed); padding: clamp(1.5rem, 3.3vw, 3rem); border: 1px solid var(--v3-line); border-bottom: 4px solid var(--colour-ink); }
.v3 .v3-feature-label { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
.v3 .v3-tag { display: inline-flex; align-items: center; min-height: 44px; background: var(--hue, var(--colour-ink)); color: var(--colour-on-ink); padding: .35rem .7rem; text-decoration: none; font: .8125rem var(--font-signage); letter-spacing: .04em; }
.v3 .v3-tag:hover { text-decoration: underline; }
.v3 .v3-feature h2 { font-size: clamp(2.1rem, 3.5vw, 3.5rem); line-height: 1.05; margin: 1.7rem 0 .9rem; max-width: 20ch; }
.v3 :is(.v3-feature h2,.v3-card h3,.v3-recent h3) a { text-decoration: none; }
.v3 :is(.v3-feature h2,.v3-card h3,.v3-recent h3) a:hover { text-decoration: underline; text-decoration-thickness: 1px; }
.v3 .v3-passage { font: .875rem/1.5 var(--font-signage); color: var(--colour-ink-soft); margin: .5rem 0; }
.v3 .v3-meta { font: .8125rem/1.7 var(--font-ui); color: var(--colour-ink-soft); }
.v3 .v3-meta a { display: inline-block; padding-block: .3rem; }
.v3 .v3-feature-description { font: 1.0625rem/1.7 var(--font-reading); margin: 1.3rem 0 1.5rem; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5; overflow: hidden; }
.v3 .v3-reading-link { display: inline-flex; align-items: center; justify-content: space-between; gap: 2rem; min-height: 48px; background: var(--colour-ink); color: var(--colour-on-ink); padding: .7rem 1.2rem; text-decoration: none; font: .875rem var(--font-signage); text-transform: uppercase; letter-spacing: .06em; }
.v3 .v3-reading-link:hover { background: var(--colour-gilt); }
.v3 .v3-page-edge { position: absolute; height: 5px; bottom: -10px; left: 8px; right: 8px; border-block: 1px solid var(--colour-rule-strong); }
.v3 .v3-recent { min-width: 0; }
.v3 .v3-recent-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: .5rem; padding: .25rem 0 1rem; border-bottom: 1px solid var(--colour-ink); }
.v3 .v3-recent-head h2 { font-size: 1.65rem; }
.v3 .v3-recent ol li { display: grid; grid-template-columns: 2rem 1fr; gap: 1rem; padding: 1.1rem 0; border-bottom: 1px solid var(--v3-line); }
.v3 .v3-recent-number { font: 1rem var(--font-display); color: var(--colour-gilt); padding-top: .25rem; }
.v3 .v3-recent h3 { font-size: 1.55rem; line-height: 1.2; margin: .5rem 0; }
.v3 .v3-recent .v3-meta { font-size: .8125rem; }
.v3 .v3-text-link { display: inline-flex; min-height: 44px; align-items: center; gap: 1.5rem; margin-top: 1rem; font: .875rem var(--font-signage); }
.v3 .v3-section { padding-block: 4rem 1rem; scroll-margin-top: 2rem; }
.v3 .v3-section-head { display: flex; justify-content: space-between; align-items: end; gap: 2rem; border-bottom: 1px solid var(--colour-ink); padding-bottom: 1.5rem; margin-bottom: 1.5rem; }
.v3 .v3-section-head h2 { font-size: clamp(2rem, 3.2vw, 3rem); line-height: 1.1; margin-top: .6rem; }
.v3 .v3-section-head > p { font: .9375rem/1.6 var(--font-reading); color: var(--colour-ink-soft); max-width: 26rem; }
.v3 .v3-books { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: .8rem; }
.v3 .v3-book { display: grid; grid-template-columns: 1fr auto; position: relative; gap: .4rem .5rem; background: var(--colour-raised); border: 1px solid var(--v3-line); border-left: 5px solid var(--hue, var(--colour-ink)); padding: 1rem 1rem 1rem 1.2rem; min-height: 128px; text-decoration: none; transition: background var(--motion-duration); }
.v3 .v3-book:hover { background: var(--colour-gilt-soft); }
.v3 .v3-book-number { grid-column: 1/-1; color: var(--hue, var(--colour-ink-muted)); font: .8125rem var(--font-signage); }
.v3 .v3-book-name { grid-column: 1/-1; font: 1.5rem/1.2 var(--font-display); }
.v3 .v3-book-count { font: .8125rem var(--font-ui); color: var(--colour-ink-soft); }
.v3 .v3-topical { display: grid; grid-template-columns: 1fr 2fr; gap: 3rem; margin-top: 4rem; padding: clamp(1.5rem, 3vw, 3rem); background: var(--colour-spine-topical); color: var(--colour-on-ink); scroll-margin-top: 2rem; }
.v3 .v3-topical :is(.v3-kicker,h2,a) { color: var(--colour-on-ink); }
.v3 .v3-topical h2 { font-size: clamp(2rem, 3.6vw, 3.5rem); line-height: 1.06; margin: 1.25rem 0; }
.v3 .v3-topical-intro p { font: 1rem/1.6 var(--font-reading); }
.v3 .v3-topical-count { display: inline-block; margin-top: 1.5rem; padding: .5rem .75rem; border: 1px solid var(--colour-on-ink); font: .875rem var(--font-signage); }
.v3 .v3-topical ul { display: grid; grid-template-columns: 1fr 1fr; column-gap: 2rem; align-content: start; }
.v3 .v3-topical li { border-top: 1px solid color-mix(in srgb, var(--colour-on-ink) 45%, transparent); }
.v3 .v3-topical li a { display: grid; grid-template-columns: 1fr auto; gap: .5rem; text-decoration: none; padding: 1rem 0; }
.v3 .v3-topical li a > span:first-child { font: 1.25rem/1.25 var(--font-display); }
.v3 .v3-topical li a:hover > span:first-child { text-decoration: underline; }
.v3 .v3-topical small { grid-column: 1/-1; font: .8125rem var(--font-ui); }
.v3 .v3-directories { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
.v3 .v3-directories h3 { font: .875rem var(--font-signage); text-transform: uppercase; letter-spacing: .08em; margin-bottom: .75rem; color: var(--colour-gilt); }
.v3 .v3-directories li { border-bottom: 1px solid var(--v3-line); }
.v3 .v3-directories li a { display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; align-items: center; padding: .75rem 0; min-height: 48px; text-decoration: none; }
.v3 .v3-directories a > span:first-child { font: 1.4rem/1.3 var(--font-display); }
.v3 .v3-directories a:hover > span:first-child { text-decoration: underline; }
.v3 .v3-directories small { font: .8125rem var(--font-ui); color: var(--colour-ink-soft); }
.v3 .v3-archive { padding-top: 4rem; }
.v3 .v3-finder { background: var(--colour-recessed); padding: 1.5rem; }
.v3 .v3-search-line { display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: end; }
.v3 .v3-finder label { display: grid; gap: .5rem; min-width: 0; }
.v3 .v3-finder label > span { font: .8125rem var(--font-signage); text-transform: uppercase; letter-spacing: .06em; }
.v3 .v3-finder :is(input,select) { width: 100%; min-width: 0; min-height: 48px; padding: .65rem .8rem; border: 1px solid var(--colour-rule-strong); border-radius: 0; background: var(--colour-raised); color: var(--colour-ink); font: .9375rem var(--font-ui); }
.v3 .v3-finder input::placeholder { color: var(--colour-ink-muted); opacity: 1; }
.v3 .v3-finder button { display: inline-flex; justify-content: space-between; gap: 2rem; align-items: center; min-height: 48px; border: 1px solid var(--colour-ink); padding: .7rem 1rem; background: var(--colour-ink); color: var(--colour-on-ink); cursor: pointer; font: .875rem var(--font-signage); }
.v3 .v3-finder button:hover { background: var(--colour-gilt); }
.v3 .v3-refine { margin-top: .75rem; }
.v3 .v3-refine summary { padding-block: .8rem; min-height: 44px; font: .875rem var(--font-ui); cursor: pointer; }
.v3 .v3-filter-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1rem; padding-block: .75rem; }
.v3 .v3-filter-note { font: .875rem/1.5 var(--font-ui); }
.v3 .v3-apply { margin-top: .5rem; }
.v3 .v3-results-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding-block: 1.5rem; font: .875rem var(--font-signage); }
.v3 .v3-results-bar a { display: inline-flex; min-height: 44px; align-items: center; }
.v3 .v3-query-label { font: 1.25rem/1.4 var(--font-reading); padding-bottom: 1.5rem; overflow-wrap: anywhere; }
.v3 .v3-results { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 1.5rem; }
.v3 .v3-results > li { min-width: 0; }
.v3 .v3-card { height: 100%; border-top: 3px solid var(--hue,var(--colour-rule-strong)); padding: 1.25rem 0; display: flex; flex-direction: column; align-items: start; }
.v3 .v3-card-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%; }
.v3 .v3-ordinal { color: var(--colour-ink-muted); font: .875rem var(--font-signage); }
.v3 .v3-card h3 { font-size: 1.65rem; line-height: 1.16; margin: 1rem 0 .5rem; }
.v3 .v3-card .v3-excerpt { font: .9375rem/1.65 var(--font-reading); color: var(--colour-ink-soft); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; margin-block: .65rem 1rem; }
.v3 .v3-card .v3-meta { margin-top: auto; }
.v3 .v3-pagination { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--v3-line); padding: 1.5rem 0; }
.v3 .v3-pagination ol { display: flex; flex-wrap: wrap; gap: .35rem; }
.v3 .v3-pagination :is(a,[aria-current]) { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: .5rem; font: .9375rem var(--font-signage); text-decoration: none; border: 1px solid var(--colour-rule-strong); }
.v3 .v3-pagination [aria-current] { background: var(--colour-ink); color: var(--colour-on-ink); }
.v3 .v3-pagination a:hover { background: var(--colour-gilt-soft); }
.v3 .v3-gap { align-self: center; }
.v3 .v3-empty { padding: 3rem 1rem; text-align: center; }
.v3 .v3-empty h3 { font-size: 2rem; }
.v3 .v3-empty p { margin: 1rem 0 1.5rem; }
.v3 .v3-colophon { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; align-items: center; border-top: 1px solid var(--colour-ink); padding: 1.5rem 0 3rem; margin-top: 2rem; }
.v3 .v3-colophon a { min-height: 44px; display: inline-flex; align-items: center; gap: 1rem; font: .875rem var(--font-signage); }
@media (prefers-reduced-motion: no-preference) {
  .v3 .v3-title-row { animation: v3-arrive 500ms ease-out both; }
  .v3 .v3-opening { animation: v3-arrive 650ms ease-out both; }
}
@keyframes v3-arrive { from { opacity: .6; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 60rem) {
  .v3 .v3-title-row { gap: 2rem; }
  .v3 .v3-opening { grid-template-columns: 1.4fr 1fr; gap: 1.5rem; }
  .v3 .v3-books { grid-template-columns: repeat(3,minmax(0,1fr)); }
  .v3 .v3-topical { grid-template-columns: 1fr; gap: 2rem; }
  .v3 .v3-topical-intro { max-width: 36rem; }
  .v3 .v3-results { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .v3 .v3-directories { gap: 2rem; }
}
@media (max-width: 44rem) {
  .v3 .v3-title-row { grid-template-columns: 1fr; gap: 1.5rem; padding-block: 2rem; }
  .v3 h1 { font-size: clamp(3.25rem,12vw,5rem); }
  .v3 .v3-intro-top { flex-wrap: wrap; }
  .v3 .v3-intro-note { max-width: 36rem; }
  .v3 .v3-rule { display: none; }
  .v3 .v3-jumps { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
  .v3 .v3-jumps a:last-child { margin-left: 0; }
  .v3 .v3-opening { grid-template-columns: 1fr; gap: 2rem; padding-top: 2rem; }
  .v3 .v3-section-head { flex-direction: column; align-items: start; gap: 1rem; }
  .v3 .v3-books { grid-template-columns: repeat(2,minmax(0,1fr)); gap: .65rem; }
  .v3 .v3-book { padding: .85rem; }
  .v3 .v3-book-name { font-size: 1.3rem; }
  .v3 .v3-directories { grid-template-columns: 1fr; }
  .v3 .v3-filter-grid { grid-template-columns: 1fr 1fr; }
  .v3 .v3-search-line { grid-template-columns: 1fr; }
  .v3 .v3-search-line button { justify-content: center; }
  .v3 .v3-results { gap: 1rem; }
  .v3 .v3-card h3 { font-size: 1.4rem; }
  .v3 .v3-tag { min-height: 44px; }
}
@media (max-width: 28rem) {
  .v3 .v3-results, .v3 .v3-filter-grid, .v3 .v3-topical ul { grid-template-columns: 1fr; }
  .v3 .v3-finder { padding: 1rem; }
  .v3 .v3-jumps a { font-size: .8125rem; }
  .v3 .v3-directories li a { gap: .65rem; }
  .v3 .v3-directories a > span:first-child { font-size: 1.2rem; }
}
@media (prefers-reduced-motion: reduce) { .v3 *, .v3 *::before, .v3 *::after { animation: none; transition: none; scroll-behavior: auto; } }
@media (forced-colors: active) { .v3 :is(.v3-tag,.v3-book,.v3-topical,.v3-card) { border: 1px solid CanvasText; } }
@media print { .v3 :is(.v3-jumps,.v3-finder,.v3-pagination) { display: none; } .v3 :is(.v3-feature-description,.v3-excerpt) { display: block; overflow: visible; } }
`;
