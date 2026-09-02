/**
 * Core stylesheet: tokens, base typography, the document shell, controls,
 * sermon list items, section furniture, states, reduced motion and print.
 * Every colour and rhythm value references a token from tokens.ts.
 */
import { tokensCss } from "../tokens";

export const coreStyles = `
${tokensCss()}

/* ---- base ---- */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  display: flex; flex-direction: column;
  margin: 0;
  min-width: 320px; min-height: 100vh;
  background: var(--colour-paper);
  color: var(--colour-ink);
  font-family: var(--font-sans);
  font-size: var(--size-md);
  line-height: var(--size-line-ui);
  overflow-wrap: break-word;
}
h1, h2, h3 { margin: 0; font-family: var(--font-serif); font-weight: 400; line-height: var(--size-line-tight); color: var(--colour-ink); text-wrap: balance; }
h1, h2 { color: var(--colour-accent-strong); }
h1 { font-size: var(--size-3xl); }
h2 { font-size: var(--size-2xl); }
h3 { font-size: var(--size-xl); }
p { margin: 0; }
a { color: var(--colour-accent); text-decoration-thickness: 0.06em; text-underline-offset: 0.16em; }
a:hover { color: var(--colour-accent-strong); }
button, input, select { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--colour-focus); outline-offset: 2px; }
.sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.skip-link { position: absolute; left: var(--space-4); top: -100%; z-index: 100; padding: var(--space-3) var(--space-4); border-radius: var(--radius-control); background: var(--colour-paper-raised); color: var(--colour-accent); box-shadow: var(--shadow-floating); }
.skip-link:focus { top: var(--space-4); }

/* ---- shell ---- */
.site-header { border-bottom: 1px solid var(--colour-rule); background: var(--colour-paper); }
.site-header__inner, .site-main, .site-footer__inner { width: min(var(--measure-page), 100% - 2.5rem); margin-inline: auto; }
.site-header__inner { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); min-height: 4.25rem; }
.wordmark { display: inline-flex; align-items: center; min-height: var(--target-size); font-family: var(--font-serif); font-size: var(--size-lg); letter-spacing: 0.01em; color: var(--colour-ink); text-decoration: none; }
.breadcrumb a, .section-head__aside a, .section-more a, .page-head__actions a, .filter-tokens__clear, .results__fewer, .carousel__all, .transcript__back a, .passage-picker__current a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.wordmark:hover { color: var(--colour-accent); }
.site-nav__list, .site-menu__nav ul, .nav-disclosure__panel, .site-footer__links { list-style: none; margin: 0; padding: 0; }
.site-nav__list { display: flex; align-items: center; gap: var(--space-1); }
.site-nav a, .nav-disclosure__summary, .site-menu__summary {
  display: inline-flex; align-items: center; gap: var(--space-2);
  min-height: var(--target-size); padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  color: var(--colour-ink); font-size: var(--size-sm); font-weight: 600; text-decoration: none;
}
.site-nav a:hover, .nav-disclosure__summary:hover, .site-menu__summary:hover { background: var(--colour-paper-deep); color: var(--colour-accent); }
.site-nav a[aria-current="page"], .nav-disclosure__summary.is-current { color: var(--colour-accent); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 0.45em; }
details.nav-disclosure { position: relative; }
.nav-disclosure__summary, .site-menu__summary { list-style: none; cursor: pointer; }
.nav-disclosure__summary::-webkit-details-marker, .site-menu__summary::-webkit-details-marker { display: none; }
.nav-disclosure__summary::after, .site-menu__summary::after {
  content: ""; flex: none; width: 0.45em; height: 0.45em; margin-top: -0.2em;
  border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg); transition: transform var(--motion-duration) var(--motion-easing);
}
details[open] > .nav-disclosure__summary::after, details[open] > .site-menu__summary::after { transform: translateY(0.2em) rotate(-135deg); }
.nav-disclosure--desktop .nav-disclosure__panel {
  position: absolute; right: 0; top: calc(100% + var(--space-1)); z-index: 30;
  min-width: 12rem; padding: var(--space-2);
  border: 1px solid var(--colour-rule); border-radius: var(--radius-control);
  background: var(--colour-paper-raised); box-shadow: var(--shadow-floating);
}
.nav-disclosure__panel a {
  display: flex; align-items: center; min-height: var(--target-size); padding: 0 var(--space-3);
  border-radius: var(--radius-control); color: var(--colour-ink); font-size: var(--size-sm); font-weight: 500; text-decoration: none; white-space: nowrap;
}
.nav-disclosure__panel a:hover { background: var(--colour-paper-deep); color: var(--colour-accent); }
.nav-disclosure__panel a[aria-current="page"] { background: var(--colour-accent-soft); color: var(--colour-accent); box-shadow: inset 3px 0 0 var(--colour-accent); }
.site-menu { display: none; position: relative; }
.site-menu__summary { border: 1px solid var(--colour-rule-strong); }
.site-menu__nav {
  position: absolute; right: 0; top: calc(100% + var(--space-2)); z-index: 30;
  width: min(18rem, calc(100vw - 2.5rem)); padding: var(--space-2);
  border: 1px solid var(--colour-rule); border-radius: var(--radius-control);
  background: var(--colour-paper-raised); box-shadow: var(--shadow-floating);
}
.site-menu__nav ul { display: grid; gap: 2px; }
.site-menu__nav > ul > li > a, .nav-disclosure--mobile .nav-disclosure__summary { display: flex; width: 100%; justify-content: space-between; min-height: var(--target-size); align-items: center; padding: 0 var(--space-3); border-radius: var(--radius-control); color: var(--colour-ink); font-size: var(--size-sm); font-weight: 600; text-decoration: none; }
.site-menu__nav > ul > li > a:hover { background: var(--colour-paper-deep); color: var(--colour-accent); }
.site-menu__nav > ul > li > a[aria-current="page"] { background: var(--colour-accent-soft); color: var(--colour-accent); box-shadow: inset 3px 0 0 var(--colour-accent); }
.nav-disclosure--mobile { position: static; }
.nav-disclosure--mobile .nav-disclosure__panel { margin: 2px 0 var(--space-2) var(--space-3); padding-left: var(--space-2); border-left: 2px solid var(--colour-rule); }
.site-main { flex: 1 0 auto; padding: var(--space-6) 0 var(--space-8); }
.site-footer { margin-top: var(--space-8); background: var(--colour-ink-surface); color: var(--colour-on-ink); }
.site-footer__inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-6) 0; }
.site-footer__name { margin: 0; font-family: var(--font-serif); font-size: var(--size-lg); }
.site-footer__links { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.site-footer__links a { display: inline-flex; align-items: center; min-height: var(--target-size); padding: 0 var(--space-2); color: var(--colour-on-ink); }

/* ---- page furniture ---- */
.page-head { max-width: var(--measure-prose); margin-bottom: var(--space-6); }
.page-head__lede { margin-top: var(--space-3); font-family: var(--font-serif); font-size: var(--size-lg); line-height: 1.5; color: var(--colour-ink-soft); }
.page-head__kind { margin-bottom: var(--space-2); font-size: var(--size-sm); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ember); }
.page-head__count { margin-top: var(--space-2); color: var(--colour-ink-soft); }
.page-head__actions { margin-top: var(--space-4); }
.breadcrumb { margin-bottom: var(--space-4); font-size: var(--size-sm); }
.section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--colour-rule); }
.section-head__aside { display: flex; align-items: center; gap: var(--space-3); font-size: var(--size-sm); color: var(--colour-ink-soft); }
.section-note { max-width: var(--measure-prose); font-family: var(--font-serif); font-size: var(--size-base); line-height: 1.55; color: var(--colour-ink-soft); }
.section-more { margin-top: var(--space-4); }
.discovery, .home-section, .results { margin-top: var(--space-7); }
.discovery:first-of-type { margin-top: var(--space-6); }

/* ---- controls ---- */
.button, .icon-button, .bible-tile, .passage-panel__back { touch-action: manipulation; }
.button {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.4em;
  min-height: var(--target-size); padding: 0.55rem 1rem;
  border: 1px solid var(--colour-accent); border-radius: var(--radius-control);
  background: var(--colour-accent); color: var(--colour-on-ink);
  font-size: var(--size-sm); font-weight: 600; text-decoration: none; cursor: pointer;
  transition: background-color var(--motion-duration) var(--motion-easing), border-color var(--motion-duration) var(--motion-easing), color var(--motion-duration) var(--motion-easing);
}
.button:hover { background: var(--colour-accent-strong); border-color: var(--colour-accent-strong); color: var(--colour-on-ink); }
.button--secondary { background: transparent; border-color: var(--colour-rule-strong); color: var(--colour-accent); }
.button--secondary:hover { background: var(--colour-paper-deep); border-color: var(--colour-accent); color: var(--colour-accent-strong); }
.button--light { background: var(--colour-paper-raised); border-color: var(--colour-paper-raised); color: var(--colour-ink); }
.button--light:hover { background: var(--colour-paper); border-color: var(--colour-paper); color: var(--colour-accent); }
.button[aria-disabled="true"], .button:disabled { background: var(--colour-disabled-surface); border-color: var(--colour-disabled-surface); color: var(--colour-disabled-text); cursor: not-allowed; }
.icon-button {
  display: inline-flex; align-items: center; justify-content: center;
  width: var(--target-size); height: var(--target-size);
  border: 1px solid var(--colour-rule-strong); border-radius: 50%;
  background: var(--colour-paper-raised); color: var(--colour-accent); font-size: 1.5rem; line-height: 1; cursor: pointer;
}
.icon-button:hover { background: var(--colour-paper-deep); }
.icon-button[aria-disabled="true"] { border-color: var(--colour-rule); color: var(--colour-ink-muted); cursor: default; }
.control {
  width: 100%; min-height: var(--target-size); padding: 0.5rem 0.7rem;
  border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control);
  background: var(--colour-paper-raised); color: var(--colour-ink); font-size: var(--size-md);
}
.control:disabled { background: var(--colour-disabled-surface); color: var(--colour-disabled-text); }
.field { display: grid; gap: var(--space-1); min-width: 0; }
.field__label { font-size: var(--size-sm); font-weight: 600; color: var(--colour-ink-soft); }
.disclosure { border-top: 1px solid var(--colour-rule); }
.disclosure__summary { display: flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); padding: var(--space-2) 0; list-style: none; cursor: pointer; font-weight: 600; color: var(--colour-accent); }
.disclosure__summary::-webkit-details-marker { display: none; }
.disclosure__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.disclosure[open] > .disclosure__summary::before { transform: rotate(45deg); }
.disclosure__badge { display: inline-flex; align-items: center; min-height: 1.6rem; padding: 0 0.6rem; border-radius: var(--radius-pill); background: var(--colour-accent-soft); color: var(--colour-accent); font-size: var(--size-xs); font-weight: 600; letter-spacing: 0.02em; }
.disclosure__body { padding: var(--space-2) 0 var(--space-4); }

/* ---- sermon list items ---- */
.sermon-list { list-style: none; margin: 0; padding: 0; }
.sermon-list > li { border-top: 1px solid var(--colour-rule); }
.sermon-list > li:last-child { border-bottom: 1px solid var(--colour-rule); }
.sermon-item {
  position: relative; display: grid;
  grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr);
  grid-template-areas: "meta series" "meta title" "meta description" "meta reason";
  column-gap: var(--space-5); row-gap: var(--space-1);
  padding: var(--space-4) 0;
}
.sermon-item__kicker { grid-area: series; font-size: var(--size-xs); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ember); }
.sermon-item__title { grid-area: title; font-size: var(--size-xl); }
.sermon-item__title a { color: var(--colour-ink); text-decoration: none; }
.sermon-item__title a::after { content: ""; position: absolute; inset: 0; }
.sermon-item:hover .sermon-item__title a { color: var(--colour-accent); text-decoration: underline; }
.sermon-item__meta { grid-area: meta; display: flex; flex-direction: column; gap: var(--space-2); padding-top: 0.3rem; font-size: var(--size-sm); line-height: 1.4; color: var(--colour-ink-soft); }
.sermon-item__ordinal { font-family: var(--font-serif); font-size: var(--size-lg); line-height: 1; color: var(--colour-ink-muted); font-variant-numeric: tabular-nums; }
.sermon-item__meta a { position: relative; z-index: 1; color: var(--colour-ink-soft); }
.sermon-item__meta a:hover { color: var(--colour-accent); }
.sermon-item__series a { font-style: italic; }
.sermon-item__description { grid-area: description; max-width: var(--measure-prose); margin-top: var(--space-1); font-family: var(--font-serif); font-size: var(--size-base); line-height: 1.55; }
.sermon-item__description--clamped { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 8; line-clamp: 8; overflow: hidden; }
.sermon-item--row .sermon-item__description--clamped { -webkit-line-clamp: 3; line-clamp: 3; }
.sermon-item__reason { grid-area: reason; font-size: var(--size-sm); color: var(--colour-ink-muted); }
.sermon-item--featured .sermon-item__title { font-size: var(--size-2xl); }
.sermon-item--related, .sermon-item--card { grid-template-columns: minmax(0, 1fr); grid-template-areas: "series" "title" "meta" "description" "reason"; }
.sermon-item--related { padding: var(--space-3) 0; }
.sermon-item--related .sermon-item__title { font-size: var(--size-lg); }
.sermon-item--related .sermon-item__meta, .sermon-item--card .sermon-item__meta { flex-direction: row; flex-wrap: wrap; gap: var(--space-1) var(--space-3); }
.sermon-item--card { height: 100%; padding: var(--space-4); border: 1px solid var(--colour-rule); border-radius: var(--radius-frame); background: var(--colour-paper-raised); }
.sermon-item--card .sermon-item__title { font-size: var(--size-lg); }
.sermon-list--related { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 var(--space-6); }
.sermon-list--related > li:last-child { border-bottom: 0; }
.name-index { list-style: none; margin: 0; padding: 0; columns: 3; column-gap: var(--space-6); }
.name-index li { break-inside: avoid; border-top: 1px solid var(--colour-rule); }
.name-index a { display: flex; align-items: center; min-height: var(--target-size); padding: var(--space-1) 0; font-family: var(--font-serif); font-size: var(--size-lg); color: var(--colour-ink); text-decoration: none; }
.name-index a:hover, .name-index a[aria-current="page"] { color: var(--colour-accent); text-decoration: underline; }
.name-index-wrap { border-bottom: 1px solid var(--colour-rule); }

/* ---- reading ---- */
.prose { max-width: var(--measure-prose); font-family: var(--font-serif); font-size: var(--size-base); line-height: var(--size-line-reading); }
.prose p { margin: 0 0 0.85em; }
.prose p:last-child { margin-bottom: 0; }
.prose--lede { font-size: var(--size-lg); line-height: 1.6; }

/* ---- states ---- */
.empty-state { max-width: var(--measure-prose); padding: var(--space-5) 0; }
.empty-state__title { margin-bottom: var(--space-2); font-family: var(--font-serif); font-size: var(--size-xl); }
.empty-state p + p { margin-top: var(--space-3); }
.boundary { max-width: var(--measure-prose); padding: var(--space-6) 0; }
.boundary__message { margin: var(--space-3) 0 var(--space-5); font-family: var(--font-serif); font-size: var(--size-lg); color: var(--colour-ink-soft); }

/* ---- responsive ---- */
@media (max-width: 60rem) {
  .sermon-list--related { grid-template-columns: minmax(0, 1fr); }
  .sermon-list--related > li:last-child { border-bottom: 1px solid var(--colour-rule); }
  .name-index { columns: 2; }
}
@media (max-width: 44rem) {
  .site-nav { display: none; }
  .site-menu { display: block; }
  .site-main { padding-top: var(--space-5); }
  .sermon-item { grid-template-columns: minmax(0, 1fr); grid-template-areas: "series" "title" "meta" "description" "reason"; }
  .sermon-item__meta { flex-direction: row; flex-wrap: wrap; gap: var(--space-1) var(--space-3); padding-top: 0; }
  .sermon-item__description--clamped { -webkit-line-clamp: 9; line-clamp: 9; }
  .sermon-item--row .sermon-item__description--clamped { -webkit-line-clamp: 4; line-clamp: 4; }
  .site-footer__inner { flex-direction: column; align-items: flex-start; }
  .name-index { columns: 1; }
}
@media (max-width: 38rem) {
  .site-header__inner, .site-main, .site-footer__inner { width: min(var(--measure-page), 100% - 1.5rem); }
  .section-head { flex-direction: column; align-items: flex-start; }
}

@media (forced-colors: active) {
  .bible-tile:focus-visible, .sermon-item__title a:focus-visible { outline: 2px solid CanvasText; }
  .bible-tile[aria-current="true"] { outline: 3px solid Highlight; outline-offset: -3px; }
  .bible-tile[data-applied="true"] { border: 2px dashed CanvasText; }
  .filter-token, .disclosure__badge, .pagination__page[aria-current="page"] { border: 1px solid CanvasText; }
  .sermon-item__title a::after { display: none; }
}

/* ---- motion & print ---- */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }
}
@media print {
  .skip-link, .site-nav, .site-menu, .site-footer, .find-sermons, .carousel__controls, .pagination, .section-more, .breadcrumb, .page-head__actions { display: none !important; }
  body { background: var(--colour-paper-print); color: var(--colour-ink-print); }
  a { color: inherit; text-decoration: none; }
  .site-header__inner, .site-main { width: auto; }
  .site-main { padding: 0; }
  .sermon-item__title a::after { display: none; }
  .qa-item, .sermon-item { break-inside: avoid; }
}
`;
