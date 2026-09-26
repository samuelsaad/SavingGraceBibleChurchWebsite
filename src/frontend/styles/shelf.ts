/**
 * The Canon's signature surfaces: the hero band and legend, the 66-book
 * shelf, the to-scale canon strip, the book tab, and the open-book chapter
 * and verse rulers. Per-book geometry is generated from the checked-in
 * versification at module load so no inline style attribute is ever needed.
 */
import { bibleBooks } from "../../domain/bible-passage";
import { spineWidthFactor } from "../canon";

const categoryTokens: Record<string, string> = {
  law: "spine-law",
  history: "spine-history",
  wisdom: "spine-wisdom",
  "major-prophets": "spine-major-prophets",
  "minor-prophets": "spine-minor-prophets",
  "gospels-acts": "spine-gospels-acts",
  pauline: "spine-pauline",
  general: "spine-general",
  revelation: "spine-revelation"
};

const perBook = bibleBooks
  .map((book, index) => `.spine--${book.slug}{--sqrt:${spineWidthFactor(book)};--i:${index};--hue:var(--colour-${categoryTokens[book.category]})}`)
  .join("\n");

export const shelfStyles = `
/* ---- hero band ---- */
.hero { background: var(--colour-recessed); border-bottom: 1px solid var(--colour-rule); }
.hero__inner { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 0.8fr); gap: var(--space-6) var(--space-8); align-items: end; padding: var(--space-7) 0 var(--space-6); }
.hero__inner--shelf { display: block; padding-top: 0; }
.hero__title { max-width: 14ch; margin-top: var(--space-3); font-size: var(--size-display); line-height: var(--size-line-tight); }
.hero__lede { margin-top: var(--space-4); }
.hero__stats { margin-top: var(--space-4); }
.hero__aside { display: grid; gap: var(--space-4); justify-items: start; }
.legend { display: grid; grid-template-columns: repeat(3, auto); gap: var(--space-1) var(--space-4); margin: 0; padding: 0; list-style: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); }
.legend li { display: flex; align-items: center; gap: var(--space-2); min-height: 1.5rem; }
.legend__swatch { flex: none; width: 0.6rem; height: 1.1rem; border-radius: var(--radius-cell); background: var(--hue); }
.legend summary { min-height: var(--target-size); display: flex; align-items: center; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }

/* ---- the shelf ---- */
.shelf { --spine-base: 1.5rem; --spine-k: 0.35rem; --spine-height: 6rem; --board: 0.375rem; --row-gap: 1.25rem; position: relative; margin-top: var(--space-6); }
.shelf__skip:not(:focus), .ruler-block__skip:not(:focus) { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.shelf__skip:focus { position: absolute; left: 0; top: 0; z-index: 5; padding: var(--space-2) var(--space-3); background: var(--colour-ink); color: var(--colour-on-ink); font-family: var(--font-signage); text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; }
.shelf__row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--row-gap) 2px; margin: 0; padding: 0 0 var(--board); list-style: none; background: repeating-linear-gradient(to bottom, transparent 0 var(--spine-height), var(--colour-ink) var(--spine-height) calc(var(--spine-height) + var(--board)), transparent calc(var(--spine-height) + var(--board)) calc(var(--spine-height) + var(--row-gap))); }
.spine { position: relative; flex: none; display: flex; width: calc(var(--spine-base) + var(--sqrt) * var(--spine-k)); height: var(--spine-height); margin-bottom: 0; }
.spine__link, .spine__ghost { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0.35rem 0 0.45rem; border-radius: var(--radius-cell) var(--radius-cell) 0 0; text-decoration: none; }
.spine__ghost { border: 1px solid var(--colour-rule-strong); border-bottom: 0; color: var(--colour-ink-muted); }
.spine__link { background: var(--hue); color: var(--colour-on-ink); transform: translateY(-0.375rem); box-shadow: 0 0.375rem 0 var(--hue); transition: transform var(--motion-duration) var(--motion-easing), box-shadow var(--motion-duration) var(--motion-easing); }
.spine__link:hover { transform: translateY(-0.7rem); box-shadow: 0 0.7rem 0 var(--hue), var(--shadow-lift); color: var(--colour-on-ink); }
.spine__link:focus-visible { outline-offset: 2px; }
.spine--revelation .spine__link { color: var(--colour-gilt-bright); }
.spine__name, .spine__abbr { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1; white-space: nowrap; }
.spine__abbr { display: none; }
.spine[data-len="long"] .spine__name { display: none; }
.spine[data-len="long"] .spine__abbr { display: block; }
.spine__count { display: grid; place-items: center; min-width: 1.125rem; height: 1.125rem; padding: 0 0.2rem; border-radius: var(--radius-cell); background: var(--colour-raised); color: var(--colour-ink); font-family: var(--font-signage); font-size: 0.8125rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.spine[aria-current="true"] .spine__link, .spine.is-current .spine__link { box-shadow: 0 0.375rem 0 var(--hue), inset 0 0.25rem 0 var(--colour-gilt-bright); }
.bookend { flex: none; display: flex; align-items: center; justify-content: center; width: 0.875rem; height: var(--spine-height); margin-bottom: 0; overflow: hidden; background: var(--colour-ink); color: var(--colour-on-ink-soft); }
.bookend span { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); font-family: var(--font-signage); font-size: 0.625rem; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
.bookend__short { display: none; }
.shelf__caption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-top: var(--space-3); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.shelf__caption a { display: inline-flex; align-items: center; min-height: var(--target-size); }
@keyframes spine-settle { from { opacity: 0; transform: translateY(0.75rem); } to { opacity: 1; transform: none; } }
.shelf--settle .spine { animation: spine-settle var(--motion-settle) var(--motion-easing) both; animation-delay: calc(var(--i) * 12ms); }
${perBook}

/* ---- canon strip ---- */
.strip { display: block; width: 100%; height: 0.625rem; overflow: visible; }
.strip--marked { height: 0.875rem; }
.strip__label { margin-top: var(--space-1); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }

/* ---- book tab ---- */
.tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 3.5rem; min-height: 9rem; padding: 0.5rem 0 0.6rem; border-radius: var(--radius-cell); background: var(--hue); color: var(--colour-on-ink); text-decoration: none; }
.tab:hover { color: var(--colour-on-ink); box-shadow: var(--shadow-lift); }
.tab--ghost { border: 1px solid var(--colour-rule-strong); background: transparent; color: var(--colour-ink-muted); }
.tab__name { writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; line-height: 1; white-space: nowrap; }
.tab__count { display: grid; place-items: center; min-width: 1.5rem; height: 1.5rem; border-radius: var(--radius-cell); background: var(--colour-raised); color: var(--colour-ink); font-family: var(--font-signage); font-weight: 700; font-variant-numeric: tabular-nums; }
.tab--revelation, .hue--revelation.tab { color: var(--colour-gilt-bright); }

/* ---- open book ---- */
.open-book { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-5); align-items: start; padding: var(--space-5); background: var(--colour-raised); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.open-book__title { font-family: var(--font-display); font-size: var(--size-title); line-height: 1; }
.open-book__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin-top: var(--space-2); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.open-book__meta a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.ruler-block { margin-top: var(--space-4); }
.ruler-block__label { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }
.ruler-block__label a { display: inline-flex; align-items: center; min-height: 1.75rem; }
.ruler { position: relative; display: flex; flex-wrap: wrap; gap: 2px; margin: 0; padding: 0; list-style: none; }
.ruler-block__skip:focus { display: inline-flex; align-items: center; min-height: 1.75rem; padding: 0 var(--space-2); background: var(--colour-ink); color: var(--colour-on-ink); font-size: var(--size-small); text-decoration: none; }
.ruler__cell { position: relative; display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: var(--radius-cell); background: var(--colour-tile); color: var(--colour-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; font-variant-numeric: tabular-nums; text-decoration: none; }
.ruler__cell:hover { background: var(--colour-ink); color: var(--colour-on-ink); }
.ruler__cell.is-marked { background: var(--hue); color: var(--colour-on-ink); }
.ruler__cell[aria-current="true"] { background: var(--colour-ink); color: var(--colour-gilt-bright); box-shadow: inset 0 0 0 2px var(--colour-gilt-bright); }
.ruler__count { position: absolute; top: 0.1rem; right: 0.15rem; font-size: 0.625rem; line-height: 1; font-weight: 700; }
.ruler__note { margin-top: var(--space-2); font-size: var(--size-small); color: var(--colour-ink-soft); }
.open-book__clear { display: inline-flex; align-items: center; min-height: var(--target-size); margin-top: var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; letter-spacing: 0.08em; text-transform: uppercase; font-size: var(--size-small); font-weight: 600; }
.book-details { margin-top: var(--space-4); border-top: 1px solid var(--colour-rule); }
.book-details__summary { display: flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); padding: var(--space-2) 0; list-style: none; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.book-details__summary::-webkit-details-marker { display: none; }
.book-details__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); }
.book-details[open] > .book-details__summary::before { transform: rotate(45deg); }

/* ---- finder ---- */
.finder { margin-top: var(--space-5); }
.finder__row { display: grid; grid-template-columns: minmax(12rem, 1.6fr) minmax(9rem, 1fr) minmax(9rem, 1fr) auto; gap: var(--space-3); align-items: end; }
.finder__submit { display: grid; }

/* ---- canon table (books index) ---- */
.canon-table-wrap { overflow-x: auto; margin-top: var(--space-6); }
.canon-table { width: 100%; border-collapse: collapse; font-size: var(--size-ui); }
.canon-table th, .canon-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--colour-rule); text-align: left; vertical-align: top; }
.canon-table th { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-soft); }
.canon-table td.num { text-align: right; font-variant-numeric: tabular-nums; }

/* ---- responsive ---- */
@media (max-width: 60rem) {
  .hero__inner { grid-template-columns: minmax(0, 1fr); align-items: start; padding-block: var(--space-6) var(--space-5); }
  .shelf { --spine-base: 1.5rem; --spine-k: 0.25rem; --spine-height: 5.5rem; }
  .bookend__long { display: none; }
  .bookend__short { display: block; }
  .open-book { grid-template-columns: minmax(0, 1fr); }
  .open-book .tab { flex-direction: row; width: 100%; min-height: 2.75rem; padding: 0 var(--space-3); }
  .open-book .tab__name { writing-mode: horizontal-tb; transform: none; }
  .finder__row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .finder__submit { grid-column: 1 / -1; justify-content: start; }
}
@media (max-width: 44rem) {
  .shelf { --spine-base: 1.5rem; --spine-k: 0.09rem; --spine-height: 4rem; --row-gap: 1rem; }
  .spine__name { display: none; }
  .spine__abbr { display: block; }
  .spine__link, .spine__ghost { padding: 0.25rem 0 0.3rem; }
  .bookend { width: 0.75rem; }
  .legend { grid-template-columns: repeat(2, auto); }
  .ruler__cell { width: 2.75rem; height: 2.75rem; }
  .hero__title { max-width: none; }
}
@media (max-width: 38rem) {
  .finder__row { grid-template-columns: minmax(0, 1fr); }
  .finder__submit .button { width: 100%; }
}
@media (forced-colors: active) {
  .shelf__row { border-bottom: var(--board) solid CanvasText; }
  .spine__link { outline: 2px solid LinkText; outline-offset: -2px; }
  .spine__ghost { border-color: GrayText; color: GrayText; }
  .spine[aria-current="true"] .spine__link, .spine.is-current .spine__link { outline: 3px double Highlight; }
  .ruler__cell.is-marked { outline: 2px solid LinkText; outline-offset: -2px; }
  .ruler__cell[aria-current="true"] { outline: 3px double Highlight; }
  .tab { outline: 2px solid CanvasText; outline-offset: -2px; }
}
/* Astra: a readable Bible index and a compact search desk. */
.library-books{border-block:1px solid var(--colour-rule-strong)}
.library-books>summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.5rem 0;cursor:pointer;list-style:none;font:clamp(1.6rem,3vw,2.5rem)/1.15 var(--font-display)}
.library-books>summary::-webkit-details-marker{display:none}
.library-books__hint{display:flex;align-items:center;gap:1.5rem;font:.8rem var(--font-signage);color:var(--colour-ink-soft)}
.library-books__hint span{font-size:1.4rem;transition:transform .18s ease}
.library-books[open] .library-books__hint span{transform:rotate(45deg)}
.library-books__note{color:var(--colour-ink-soft);font:.9rem var(--font-signage)}
.shelf{margin:1rem 0 1.5rem}
.shelf__row{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.25rem,1fr));gap:.5rem;background:none;padding:0}
.spine{width:100%;height:auto;min-height:3.5rem;animation:none!important}
.spine__link,.spine__ghost{flex-direction:row;align-items:center;gap:.6rem;padding:.8rem;border:1px solid var(--colour-rule);border-radius:0;transform:none;box-shadow:none}
.spine__link{color:var(--colour-ink);background:var(--colour-raised);border-bottom:3px solid var(--colour-ink)}
.spine__link:hover{transform:none;box-shadow:none;background:var(--colour-ink);color:var(--colour-on-ink)}
.spine__ghost{background:transparent;color:var(--colour-ink-muted)}
.spine__name,.spine[data-len="long"] .spine__name{display:block;writing-mode:horizontal-tb;transform:none;white-space:normal;font:.85rem/1.2 var(--font-signage);text-transform:none;letter-spacing:0}
.spine__abbr,.spine[data-len="long"] .spine__abbr{display:none}
.spine--revelation .spine__link{color:var(--colour-ink)}
.spine--revelation .spine__link:hover{color:var(--colour-on-ink)}
.spine.is-current .spine__link,.spine[aria-current="true"] .spine__link{box-shadow:inset 0 0 0 2px var(--colour-ink)}
.bookend{grid-column:1/-1;width:auto;height:auto;justify-content:flex-start;margin-top:1.2rem;padding:.7rem 0;background:none;color:var(--colour-ink)}
.bookend span{writing-mode:horizontal-tb;transform:none;font-size:.8rem;letter-spacing:.1em}
.bookend__long{display:block}.bookend__short{display:none}
.finder{padding:1.5rem;background:var(--colour-recessed);border-top:2px solid var(--colour-ink)}
.open-book{background:var(--colour-recessed);box-shadow:none;border-top:2px solid var(--colour-ink);grid-template-columns:1fr}
.open-book>.tab{display:none}
.open-book__title{font-size:2.75rem}
.ruler__cell{min-width:2.75rem;min-height:2.75rem}
@media(max-width:44rem){.library-books__hint{font-size:.65rem;gap:.6rem}.library-books__hint span{font-size:1.1rem}.library-books>summary{font-size:1.6rem}.finder{padding:1rem}}
@media(prefers-reduced-motion:reduce){.library-books__hint span{transition:none}}

`;
