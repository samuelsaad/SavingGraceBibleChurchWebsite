/** Scoped journal composition. V1, V4, church pages and the shared shell stay intact. */
export const v5Styles = `
.v5 { --journal-tab-width: 2rem; font-family: var(--font-ui); }
.v5 ::selection { background: var(--colour-ink); color: var(--colour-on-ink); }
.v5 .control { caret-color: var(--colour-gilt); }
.v5__heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 1rem 2rem; margin: 0 0 2rem; padding: clamp(1.5rem, 3.5vw, 3rem); background: var(--colour-recessed); }
.v5__heading h1 { font-size: clamp(2.6rem, 4.5vw, 4rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; }
.v5__heading p { max-width: 32ch; font-size: 1rem; color: var(--colour-ink-soft); }
.v5 .fold { border-radius: var(--radius-control); }
.v5 .fold__title { font-family: var(--font-ui); text-transform: none; letter-spacing: 0; }
.v5__recent { margin-top: 3.5rem; scroll-margin-top: 2rem; }
.v5__featured { margin-top: 3rem; }
.v5__featured .section__head { margin-bottom: 0; padding: 1.1rem 1.5rem; background: var(--colour-ink); color: var(--colour-on-ink); }
.v5__featured .section__title { color: inherit; }
.v5__featured .section__aside { color: var(--colour-on-ink-soft); }
.v5__featured .journal { background: var(--colour-recessed); }
.v5__featured .journal > li { border-top: 0; border-bottom: 1px solid var(--colour-rule); }
.v5__featured .journal__entry { padding-inline: 1.5rem; }
.v5__featured .journal__entry:focus-within { background: var(--colour-gilt-soft); }
.v5__featured .journal__title { font-size: clamp(1.5rem, 2.3vw, 2rem); }
.v5__featured .journal__title a { transition: color var(--motion-duration) var(--motion-easing); }
.v5__featured .journal__entry:focus-within .journal__title a { color: var(--colour-gilt); }
.v5__recent:focus { outline: none; }
.v5 .section__title { font-size: clamp(1.5rem, 2.3vw, 2rem); }
.v5 .section__aside { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; }
.journal { list-style: none; padding: 0; margin: 0; }
.journal > li { border-top: 1px solid var(--colour-rule); }
.journal > li:last-child { border-bottom: 1px solid var(--colour-rule); }
.journal__entry { position: relative; display: grid; grid-template-columns: var(--journal-tab-width) minmax(0, 1fr) 10rem; grid-template-areas: "tab dateline dateline" "tab body rail"; align-items: start; gap: 0.5rem 1.5rem; padding: 1.5rem 1rem 1.5rem 0; transition: background-color 160ms ease-out; }
.journal__entry:hover, .journal__entry:focus-within { background: var(--colour-recessed); }
.journal__tab { grid-area: tab; align-self: stretch; min-width: 0; }
.journal__tab .tab { position: relative; width: 100%; min-height: 9rem; height: 100%; padding: 0.65rem 0; justify-content: center; border-radius: 2px; font-family: var(--font-ui); font-size: 0.8rem; letter-spacing: 0.06em; }
.journal__tab .tab:hover { transform: none; box-shadow: none; }
.journal__body { grid-area: body; min-width: 0; }
.journal__dateline { grid-area: dateline; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.3rem 1rem; min-width: 0; }
.journal__recording { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.3rem 1.1rem; }
.journal__duration { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.journal__duration svg { align-self: center; flex: none; }
.journal__passage { font-size: 0.8125rem; line-height: 1.5; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--hue, var(--colour-gilt)); }
.journal__date { font-size: 0.8125rem; line-height: 1.5; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.journal__title { font-size: clamp(1.3rem, 2.15vw, 1.875rem); line-height: 1.2; letter-spacing: -0.025em; font-weight: 700; text-wrap: pretty; }
.journal__title a { text-decoration: none; }
.journal__title a:hover { text-decoration: underline; }
.journal__description { margin-top: 0.65rem; max-width: 72ch; font-size: 1rem; line-height: 1.6; }
.journal__description p + p { margin-top: 1em; }
.journal__description.is-collapsed { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.journal__series { font-size: 0.8125rem; line-height: 1.6; color: var(--colour-ink-soft); }
.journal__series > span { margin-right: 0.5rem; }
.journal__series a { display: inline-flex; align-items: center; min-height: 2.75rem; }
.journal__open { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; min-height: 2.75rem; padding: 0.4rem 0.65rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); font-family: var(--font-ui); font-size: 0.8125rem; font-weight: 700; text-decoration: none; line-height: 1.4; white-space: nowrap; }
.journal__arrow { flex: none; }
.journal__open svg { width: 1rem; height: 1rem; }
.journal__open:hover { color: var(--colour-on-ink); background: var(--colour-ink); border-color: var(--colour-ink); }
.journal__entry--featured .journal__open { color: var(--colour-on-ink); background: var(--colour-ink); border-color: var(--colour-ink); }
.journal__entry--featured .journal__open:hover { background: var(--colour-gilt); border-color: var(--colour-gilt); }
.journal__rail { grid-area: rail; display: flex; flex-direction: column; gap: 0.65rem; align-items: center; padding-left: 1rem; border-left: 1px solid var(--colour-rule); min-width: 0; }
.journal__speaker { min-width: 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.3rem; }
.journal__portrait { width: 4.75rem; height: 5rem; object-fit: cover; object-position: center 22%; border-radius: 2px; }
.journal__speaker a { display: inline-flex; align-items: center; justify-content: center; min-height: 2.75rem; font-size: 0.875rem; font-weight: 700; line-height: 1.45; }
.journal__warning { margin-top: 0.5rem; font-size: 0.875rem; color: var(--colour-ink-soft); }
.journal__tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 0.5rem; margin-top: 0.65rem; }
.journal__formats { grid-column: 1; grid-row: 1; display: flex; align-items: center; gap: 0.55rem; color: var(--colour-ink-soft); min-height: 2.75rem; }
.journal__format { display: inline-flex; align-items: center; justify-content: center; width: 2.125rem; height: 2.125rem; border-radius: var(--radius-control); background: color-mix(in srgb, currentColor 8%, white); }
.journal__format--youtube { color: var(--colour-spine-law); }
.journal__format--audio { color: var(--colour-spine-major-prophets); }
.journal__format--text { color: var(--colour-spine-gospels-acts); }
.journal__formats svg { width: 1.25rem; height: 1.25rem; }
.journal__formats-note { font-size: 0.75rem; }
.journal__toggle { grid-column: 2; grid-row: 1; display: inline-flex; align-items: center; justify-content: flex-end; min-height: 2.75rem; gap: 0.5rem; padding: 0 0.25rem 0 0.75rem; border: 0; background: transparent; cursor: pointer; font-size: 0.875rem; font-weight: 700; text-decoration: underline; text-underline-offset: 0.3em; white-space: nowrap; }
.journal__toggle[hidden] { display: none; }
.journal__toggle:hover { color: var(--colour-gilt); }
.journal__toggle svg { flex: none; }
.journal__toggle[aria-expanded="true"] svg { transform: rotate(180deg); }
.v5__indexes { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); align-items: start; gap: 2rem; margin-top: 5rem; }
.v5-directory-section { min-width: 0; border: 1px solid var(--colour-rule); }
.v5-directory-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 8rem; padding: 1.5rem; background: var(--colour-ink); color: var(--colour-on-ink); }
.v5-directory-heading h2 { font-family: var(--font-display); color: inherit; font-size: clamp(1.75rem, 2.3vw, 2rem); line-height: 1.15; letter-spacing: -0.025em; }
.v5-directory-heading p { margin-top: 0.5rem; color: var(--colour-on-ink-soft); font-size: 0.875rem; line-height: 1.5; }
.v5-directory-heading > a { flex: none; display: inline-flex; align-items: center; gap: 0.5rem; min-height: 2.75rem; color: var(--colour-on-ink); font-size: 0.8125rem; text-decoration-color: var(--colour-gilt-bright); }
.v5-directory-heading > a:hover { color: var(--colour-gilt-bright); }
.v5-directory { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 0.9375rem; }
.v5-directory thead { background: var(--colour-recessed); }
.v5-directory thead th { padding: 0.75rem 1.5rem; text-align: left; font-size: 0.75rem; font-weight: 400; color: var(--colour-ink-soft); }
.v5-directory th:last-child, .v5-directory td { width: 6.5rem; text-align: right; white-space: nowrap; }
.v5-directory tbody th { text-align: left; font-weight: 600; }
.v5-directory tbody tr { border-bottom: 1px solid var(--colour-rule); }
.v5-directory tbody tr:last-child { border-bottom: 0; }
.v5-directory tbody tr:hover, .v5-directory tbody tr:focus-within { background: var(--colour-recessed); }
.v5-directory__link { display: flex; align-items: center; min-height: 5.5rem; gap: 1rem; padding: 1rem 0 1rem 1.5rem; text-decoration: none; }
.v5-directory__link:hover .v5-directory__name { color: var(--colour-gilt); text-decoration: underline; text-underline-offset: 0.25em; }
.v5-directory__name { min-width: 0; flex: 1; font-size: 1rem; line-height: 1.45; }
.v5-directory__arrow { display: flex; flex: none; color: var(--colour-ink-soft); }
.v5-directory__symbol { flex: none; display: flex; align-items: center; justify-content: center; width: 2.25rem; color: var(--colour-gilt); }
.v5-directory__symbol svg { width: 1.75rem; height: 1.75rem; }
.v5-directory-section--speakers .v5-directory__symbol { width: 3rem; color: var(--colour-ink-muted); }
.v5-directory__portrait { flex: none; width: 3rem; height: 3.25rem; object-fit: cover; object-position: center 22%; border-radius: 2px; }
.v5-directory td { padding: 1rem 1.5rem; vertical-align: middle; }
.v5-directory__count { font-size: 1.125rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--colour-ink); }
@media (max-width: 60rem) {
  .journal__entry { grid-template-columns: var(--journal-tab-width) minmax(0, 1fr) 9.5rem; column-gap: 1rem; }
  .journal__rail { padding-left: 0.75rem; }
  .v5__indexes { grid-template-columns: minmax(0, 1fr); gap: 2rem; }
}
@media (max-width: 44rem) {
  .v5 { --journal-tab-width: 1.6rem; }
  .v5__heading { margin-top: 0; gap: 0.65rem; }
  .v5__heading p { max-width: none; }
  .v5__recent { margin-top: 2.5rem; }
  .journal__entry { grid-template-columns: var(--journal-tab-width) minmax(0, 1fr); grid-template-areas: "tab dateline" "tab body" "tab rail"; gap: 0.8rem; padding: 1.25rem 0; }
  .v5__featured .section__head { padding: 1rem; }
  .v5__featured .journal__entry { padding-inline: 0.75rem; }
  .journal__tab { grid-area: tab; }
  .journal__body { grid-area: body; }
  .journal__dateline { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.3rem 0.75rem; }
  .journal__date { text-align: right; white-space: nowrap; }
  .journal__description { font-size: 0.9375rem; }
  .journal__rail { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 0; border: 0; gap: 0.75rem; }
  .journal__speaker { flex-direction: row; text-align: left; gap: 0.25rem 0.65rem; }
  .journal__portrait { width: 2.5rem; height: 2.75rem; }
  .journal__speaker a { max-width: 16ch; }
  .journal__formats { gap: 0.35rem; }
  .journal__format { width: 1.875rem; height: 1.875rem; }
  .journal__formats-note { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .journal__toggle { padding-left: 0.25rem; }
  .v5__indexes { grid-template-columns: minmax(0, 1fr); gap: 3rem; margin-top: 3rem; }
  .v5-directory-heading { flex-direction: row; align-items: center; flex-wrap: wrap; padding: 1.25rem; }
  .v5-directory thead th { padding: 0.75rem 1rem; }
  .v5-directory th:last-child, .v5-directory td { width: 5.5rem; }
  .v5-directory__link { padding: 0.85rem 0 0.85rem 1rem; gap: 0.75rem; min-height: 5rem; }
  .v5-directory__arrow { display: none; }
  .v5-directory__name { font-size: 0.9375rem; }
  .v5-directory td { padding: 0.85rem 1rem; }
}
/* The lead recording picks up the shelf's book-tab gesture. Keep the reading
   surface steady; only its tab and the opening arrow move, without a loop. */
@media (hover: hover) and (pointer: fine) {
  .v5__featured .journal__entry:hover { background: var(--colour-gilt-soft); }
  .v5__featured .journal__entry:hover .journal__title a { color: var(--colour-gilt); }
}
@media (prefers-reduced-motion: no-preference) {
  .v5__featured .journal__tab .tab { transition: transform 240ms var(--motion-easing), box-shadow 240ms var(--motion-easing); }
  .v5__featured .journal__open .journal__arrow { transition: transform var(--motion-duration) var(--motion-easing); }
  .v5__featured .journal__open:focus-visible .journal__arrow { transform: translateX(0.2rem); }
}
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .v5__featured .journal__entry:hover .journal__tab .tab { transform: translateY(-0.25rem); box-shadow: var(--shadow-lift); }
  .v5__featured .journal__entry:hover .journal__open .journal__arrow { transform: translateX(0.2rem); }
}
@media (prefers-reduced-motion: reduce) { .journal__entry { transition: none; } }
@media (forced-colors: active) { .journal__tab .tab { border: 1px solid CanvasText; } }
@media print { .journal__description.is-collapsed { display: block; overflow: visible; -webkit-line-clamp: unset; line-clamp: unset; } .journal__toggle, .journal__formats { display: none; } .v5__featured .section__head { background: var(--colour-ground-print); color: var(--colour-ink-print); } .v5__featured .section__aside { color: inherit; } }
`;
