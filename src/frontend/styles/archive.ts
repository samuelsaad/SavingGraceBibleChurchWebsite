/**
 * Archive stylesheet: the Find Sermons controls, filter tokens, results,
 * pagination, discovery carousels and the Bible passage picker.
 */
export const archiveStyles = `
/* ---- find sermons ---- */
.find-sermons { margin-bottom: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--colour-rule); }
.find-sermons__heading { margin-bottom: var(--space-3); font-family: var(--font-sans); font-size: var(--size-sm); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); }
.find-sermons__row { display: grid; grid-template-columns: minmax(12rem, 1.6fr) repeat(3, minmax(8rem, 1fr)) auto; gap: var(--space-3); align-items: end; }
.find-sermons__submit { display: grid; }
.find-sermons__submit .button { min-width: 6.5rem; }
.find-sermons__disclosures { margin-top: var(--space-4); }
.find-sermons__advanced { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); align-items: end; }
.find-sermons__advanced-actions { grid-column: 1 / -1; }
.filter-tokens { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin-top: var(--space-4); }
.filter-tokens__list { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.filter-token { display: inline-flex; align-items: center; gap: 0.5em; min-height: var(--target-size); padding: 0 0.75rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-pill); background: var(--colour-paper-raised); color: var(--colour-ink); font-size: var(--size-sm); text-decoration: none; }
.filter-token:hover { border-color: var(--colour-accent); color: var(--colour-accent); }
.filter-token__remove { font-size: 1.15em; line-height: 1; color: var(--colour-ink-soft); }
.filter-tokens__clear { font-size: var(--size-sm); }

/* ---- results ---- */
.results:focus { outline: none; }
.results__status { font-size: var(--size-sm); color: var(--colour-ink-soft); }
.results__fewer { font-size: var(--size-sm); }
.pagination { margin-top: var(--space-6); }
.pagination__list { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.pagination__page, .pagination__step { display: inline-flex; align-items: center; justify-content: center; min-width: var(--target-size); min-height: var(--target-size); padding: 0 0.75rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); color: var(--colour-accent); font-size: var(--size-sm); text-decoration: none; }
.pagination__page:hover, .pagination__step:hover { background: var(--colour-paper-deep); }
.pagination__page[aria-current="page"] { background: var(--colour-accent); border-color: var(--colour-accent); color: var(--colour-on-ink); font-weight: 600; }
.pagination__gap { display: inline-flex; align-items: center; padding: 0 var(--space-1); color: var(--colour-ink-muted); }

/* ---- carousels ---- */
.carousel__controls { display: flex; gap: var(--space-2); }
.carousel__all { font-size: var(--size-sm); }
.carousel__track { display: flex; gap: var(--space-4); list-style: none; margin: 0; padding: var(--space-1) 0 var(--space-4); overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: x proximity; scroll-padding-inline: var(--space-1); scrollbar-width: thin; }
.carousel__item { display: flex; flex: 0 0 min(18rem, 80vw); scroll-snap-align: start; }
.series-card { display: flex; flex-direction: column; gap: var(--space-1); width: 100%; padding: var(--space-4); border: 1px solid var(--colour-rule); border-radius: var(--radius-frame); background: var(--colour-paper-raised); }
.series-card__name { font-size: var(--size-xl); }
.series-card__name a { color: var(--colour-ink); text-decoration: none; }
.series-card__name a:hover { color: var(--colour-accent); text-decoration: underline; }
.series-card__label { margin-top: var(--space-3); font-size: var(--size-xs); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-muted); }
.series-card__sermon { font-family: var(--font-serif); font-size: var(--size-base); line-height: 1.35; }
.series-card__sermon a { color: var(--colour-ink); }
.series-card__meta { font-size: var(--size-sm); color: var(--colour-ink-soft); }

/* ---- passage picker ---- */
.passage-picker { padding: var(--space-4); border-radius: var(--radius-frame); background: var(--colour-paper-deep); }
.passage-picker__hint { max-width: var(--measure-prose); margin-bottom: var(--space-4); font-size: var(--size-sm); color: var(--colour-ink-soft); }
.passage-picker__panels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-5); }
.passage-panel { min-width: 0; }
.passage-panel[hidden] { display: none; }
.passage-panel__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); min-height: 1.75rem; margin-bottom: var(--space-2); }
.passage-panel__head h3 { font-family: var(--font-sans); font-size: var(--size-sm); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); }
.passage-panel__selection { min-width: 0; overflow: hidden; font-size: var(--size-sm); font-weight: 600; color: var(--colour-ink); text-overflow: ellipsis; white-space: nowrap; }
.passage-panel__back { display: none; align-items: center; gap: var(--space-2); min-height: var(--target-size); margin-bottom: var(--space-2); padding: 0 var(--space-3); border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); background: var(--colour-paper-raised); color: var(--colour-accent); font-size: var(--size-sm); font-weight: 600; cursor: pointer; }
.passage-panel__action { margin-top: var(--space-3); }
.passage-panel__action .button { width: 100%; }
.passage-panel__note { margin-top: var(--space-3); font-size: var(--size-sm); color: var(--colour-ink-soft); }
.tile-grid { display: grid; gap: 2px; }
.tile-grid--books { grid-template-columns: repeat(auto-fill, minmax(4rem, 1fr)); }
.tile-grid--numbers { grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr)); max-height: 22rem; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.bible-tile {
  position: relative; display: grid; place-items: center; min-width: 0; min-height: var(--target-size); aspect-ratio: 1;
  border: 1px solid var(--colour-tile-border); border-radius: var(--radius-tile);
  background: var(--colour-paper-raised); color: var(--colour-ink);
  font-family: var(--font-numeric); font-size: var(--size-sm); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; text-decoration: none;
}
.bible-tile--number { aspect-ratio: auto; background: var(--colour-tile-number); }
.bible-tile--law { background: var(--colour-tile-law); }
.bible-tile--history { background: var(--colour-tile-history); }
.bible-tile--wisdom { background: var(--colour-tile-wisdom); }
.bible-tile--major-prophets { background: var(--colour-tile-major-prophets); }
.bible-tile--minor-prophets { background: var(--colour-tile-minor-prophets); }
.bible-tile--gospels-acts { background: var(--colour-tile-gospels-acts); }
.bible-tile--pauline { background: var(--colour-tile-pauline); }
.bible-tile--general { background: var(--colour-tile-general); }
.bible-tile--revelation { background: var(--colour-tile-revelation); }
.bible-tile:hover { border-color: var(--colour-accent); color: var(--colour-accent-strong); }
.bible-tile:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--colour-paper-raised), inset 0 0 0 4px var(--colour-focus); }
.bible-tile[aria-current="true"] { background: var(--colour-accent); border-color: var(--colour-accent); color: var(--colour-on-ink); }
.bible-tile[aria-current="true"]:hover { color: var(--colour-on-ink); }
.bible-tile[aria-current="true"]::after { content: "✓" / ""; position: absolute; right: 0.2rem; bottom: 0.1rem; font-size: 0.6rem; }
.bible-tile[data-applied="true"] { box-shadow: inset 0 0 0 2px var(--colour-ember); }
.bible-tile[data-applied="true"]::before { content: "•" / ""; position: absolute; left: 0.2rem; top: 0; color: var(--colour-ember); font-size: 0.9rem; line-height: 1.2; }
.bible-tile[aria-current="true"][data-applied="true"]::before { color: var(--colour-on-ink); }
.bible-tile[data-applied="true"]:focus-visible { box-shadow: inset 0 0 0 2px var(--colour-paper-raised), inset 0 0 0 4px var(--colour-focus); }
.passage-key { margin-top: var(--space-3); }
.passage-key summary { display: flex; align-items: center; min-height: var(--target-size); cursor: pointer; font-size: var(--size-sm); font-weight: 600; color: var(--colour-accent); }
.passage-key__list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-1) var(--space-3); margin-top: var(--space-2); padding: 0; list-style: none; font-size: var(--size-sm); color: var(--colour-ink-soft); }
.passage-key__item { display: flex; align-items: center; gap: var(--space-2); }
.passage-key__swatch { flex: none; width: 0.9rem; height: 0.9rem; border: 1px solid var(--colour-tile-border); border-radius: var(--radius-tile); }
.passage-key__item--law .passage-key__swatch { background: var(--colour-tile-law); }
.passage-key__item--history .passage-key__swatch { background: var(--colour-tile-history); }
.passage-key__item--wisdom .passage-key__swatch { background: var(--colour-tile-wisdom); }
.passage-key__item--major-prophets .passage-key__swatch { background: var(--colour-tile-major-prophets); }
.passage-key__item--minor-prophets .passage-key__swatch { background: var(--colour-tile-minor-prophets); }
.passage-key__item--gospels-acts .passage-key__swatch { background: var(--colour-tile-gospels-acts); }
.passage-key__item--pauline .passage-key__swatch { background: var(--colour-tile-pauline); }
.passage-key__item--general .passage-key__swatch { background: var(--colour-tile-general); }
.passage-key__item--revelation .passage-key__swatch { background: var(--colour-tile-revelation); }
.passage-picker__current { margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--colour-rule); font-size: var(--size-sm); color: var(--colour-ink-soft); }

/* ---- responsive ---- */
@media (max-width: 60rem) {
  .find-sermons__row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .find-sermons__submit { grid-column: 1 / -1; justify-content: start; }
  .find-sermons__advanced { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .passage-picker__panels { grid-template-columns: minmax(0, 1fr); }
  .passage-panel__back { display: inline-flex; }
  .passage-picker[data-mobile-panel="book"] .passage-panel--chapters,
  .passage-picker[data-mobile-panel="book"] .passage-panel--verses,
  .passage-picker[data-mobile-panel="chapter"] .passage-panel--books,
  .passage-picker[data-mobile-panel="chapter"] .passage-panel--verses,
  .passage-picker[data-mobile-panel="verse"] .passage-panel--books,
  .passage-picker[data-mobile-panel="verse"] .passage-panel--chapters { display: none; }
}
@media (max-width: 38rem) {
  .find-sermons__row, .find-sermons__advanced { grid-template-columns: minmax(0, 1fr); }
  .find-sermons__submit .button { width: 100%; }
  .passage-picker { padding: var(--space-3); }
  .carousel__item { flex-basis: min(17rem, 84vw); }
}
`;
