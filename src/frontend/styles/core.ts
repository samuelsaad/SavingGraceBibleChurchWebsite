/**
 * Core stylesheet for the Canon: tokens, base typography, the masthead and
 * footer, signage, buttons and controls, catalogue entries, indexes, chips,
 * pagination, states, reduced motion, forced colours and print.
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
  margin: 0; min-width: 320px; min-height: 100vh;
  background: var(--colour-ground); color: var(--colour-ink);
  font-family: var(--font-ui); font-size: var(--size-ui); line-height: var(--size-line-ui);
  overflow-wrap: break-word;
}
h1, h2, h3 { margin: 0; font-weight: 400; color: var(--colour-ink); text-wrap: balance; }
h1 { font-family: var(--font-display); font-size: var(--size-title); line-height: var(--size-line-title); letter-spacing: -0.01em; }
h3 { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
p { margin: 0; }
a { color: var(--colour-ink); text-decoration-color: var(--colour-gilt); text-decoration-thickness: 0.09em; text-underline-offset: 0.18em; }
a:hover { color: var(--colour-gilt); }
button, input, select { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--colour-ink); outline-offset: 3px; box-shadow: 0 0 0 3px var(--colour-ground); }
.sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.skip-link { position: absolute; left: var(--space-4); top: -100%; z-index: 100; padding: var(--space-3) var(--space-4); background: var(--colour-ink); color: var(--colour-on-ink); font-family: var(--font-signage); text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; }
.skip-link:focus { top: var(--space-4); }
.signage { font-family: var(--font-signage); font-stretch: 87.5%; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.eyebrow { display: inline-flex; align-items: center; gap: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-gilt); }
.tabular { font-variant-numeric: tabular-nums; }

/* ---- literary-group hues ---- */
.hue--law{--hue:var(--colour-spine-law)}
.hue--history{--hue:var(--colour-spine-history)}
.hue--wisdom{--hue:var(--colour-spine-wisdom)}
.hue--major-prophets{--hue:var(--colour-spine-major-prophets)}
.hue--minor-prophets{--hue:var(--colour-spine-minor-prophets)}
.hue--gospels-acts{--hue:var(--colour-spine-gospels-acts)}
.hue--pauline{--hue:var(--colour-spine-pauline)}
.hue--general{--hue:var(--colour-spine-general)}
.hue--revelation{--hue:var(--colour-spine-revelation)}
.hue--topical{--hue:var(--colour-spine-topical)}
.strip .strip__seg { fill: var(--colour-rule); }
.strip .strip__seg--preached { fill: var(--hue); }
.strip .strip__seg--current { fill: var(--colour-gilt); }

/* ---- masthead ---- */
.masthead { border-bottom: 1px solid var(--colour-ink); background: var(--colour-ground); }
.masthead__inner, .site-main, .site-footer__inner, .hero__inner { width: min(var(--measure-page), 100% - 3rem); margin-inline: auto; }
.masthead__inner { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--space-3) var(--space-6); min-height: 4.5rem; padding: var(--space-3) 0; }
.masthead__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); }
.masthead__give { min-height: var(--target-size); padding: 0.45rem 1.1rem; }
.brand { display: inline-flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); color: var(--colour-ink); text-decoration: none; border-radius: var(--radius-control); }
.brand:hover { color: var(--colour-ink); }
.brand:hover .brand__logo { opacity: 0.82; }
.brand__logo { display: block; width: 8.5rem; height: auto; transition: opacity var(--motion-duration) var(--motion-easing); }
.mark { flex: none; width: 1.75rem; height: 1.75rem; }
.masthead__links { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-1) var(--space-2); list-style: none; margin: 0; padding: 0; }
.masthead__links a { display: inline-flex; align-items: center; min-height: var(--target-size); padding: 0 var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none; color: var(--colour-ink); white-space: nowrap; }
.masthead__links a:hover { color: var(--colour-gilt); }
.masthead__links a[aria-current="page"] { box-shadow: inset 0 -2px 0 var(--colour-gilt); color: var(--colour-gilt); }
.masthead__menu { position: relative; width: max-content; }
.masthead__menu-toggle { display: flex; align-items: center; gap: var(--space-2); min-height: var(--target-size); padding: 0 var(--space-2); list-style: none; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
.masthead__menu-toggle::-webkit-details-marker { display: none; }
.masthead__menu-toggle:hover, .masthead__menu-toggle.is-active { color: var(--colour-gilt); }
.masthead__menu-toggle.is-active { box-shadow: inset 0 -2px 0 var(--colour-gilt); }
.masthead__chevron { width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); }
.masthead__menu[open] .masthead__chevron { transform: rotate(225deg); }
.masthead__dropdown { position: absolute; z-index: 20; top: 100%; left: 0; min-width: 12rem; margin: 0; padding: var(--space-2); list-style: none; background: var(--colour-raised); border: 1px solid var(--colour-rule-strong); border-top: 2px solid var(--colour-gilt); box-shadow: var(--shadow-card); }
.masthead__dropdown a { display: flex; align-items: center; min-height: var(--target-size); padding: var(--space-2) var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; }
.masthead__dropdown a:hover { background: var(--colour-recessed); }
.masthead__dropdown a[aria-current="page"] { color: var(--colour-gilt); box-shadow: inset 2px 0 0 var(--colour-gilt); }
.masthead__dropdown--wide { min-width: 17rem; }
.masthead__dropdown--wide li:first-child { margin-bottom: var(--space-1); padding-bottom: var(--space-1); border-bottom: 1px solid var(--colour-rule); }
.masthead__dropdown-sub a { padding-left: calc(var(--space-3) + 1rem); font-weight: 400; text-transform: none; letter-spacing: 0.02em; font-family: var(--font-ui); }
.masthead__search { display: flex; gap: var(--space-2); }
.masthead__search .control { width: 11rem; min-height: var(--target-size); }
.masthead__search .button { min-height: var(--target-size); padding: 0.45rem 0.9rem; }
.masthead__search-link { display: none; }
.pending { display: inline-flex; align-items: center; min-height: 2rem; padding: 0 0.6rem; border: 1px dashed var(--colour-rule-strong); border-radius: var(--radius-control); color: var(--colour-ink-muted); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.glyph { display: block; width: 1.25rem; height: 1.25rem; }

/* ---- footer ---- */
.site-footer { margin-top: var(--space-9); }
.site-footer .strip { display: block; width: 100%; height: 0.5rem; }
.site-footer__band { background: var(--colour-ink); color: var(--colour-on-ink); }
.site-footer__inner { padding: var(--space-7) 0 var(--space-6); }
.site-footer a { color: var(--colour-on-ink); text-decoration-color: var(--colour-gilt-bright); }
.site-footer a:hover { color: var(--colour-gilt-bright); }
.site-footer .brand { color: var(--colour-on-ink); }
.site-footer .brand__logo { width: 7.5rem; }
.footer-columns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-6); }
.footer-col { min-width: 0; }
.footer-col__title { position: relative; padding-bottom: var(--space-2); margin-bottom: var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-gilt-bright); }
.footer-col__title::after { content: ""; position: absolute; left: 0; bottom: 0; width: 2rem; height: 2px; background: var(--colour-gilt-bright); }
.footer-col__address { display: grid; gap: 0.15rem; font-style: normal; font-size: var(--size-ui); line-height: var(--size-line-ui); color: var(--colour-on-ink); overflow-wrap: anywhere; }
.footer-col__list { display: grid; gap: 0.15rem; margin: 0; padding: 0; list-style: none; font-size: var(--size-ui); line-height: var(--size-line-ui); }
.footer-col__list a { display: inline-flex; align-items: center; min-height: 2rem; }
.footer-col__pending { margin-top: var(--space-2); }
.footer-col__directions, .footer-col__more { margin-top: var(--space-3); font-size: var(--size-ui); }
.footer-col__directions a, .footer-col__more a { display: inline-flex; align-items: center; min-height: 2rem; }
.site-footer .pending { color: var(--colour-on-ink-soft); border-color: var(--colour-on-ink-soft); }
.footer-col--sermon .card { max-width: 22rem; }
.footer-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3) var(--space-5); margin-top: var(--space-7); padding-top: var(--space-4); border-top: 1px solid var(--colour-rule-strong); font-size: var(--size-small); color: var(--colour-on-ink-soft); }
.footer-bar__top { display: inline-flex; align-items: center; justify-content: center; width: var(--target-size); height: var(--target-size); border: 1px solid var(--colour-on-ink-soft); border-radius: var(--radius-control); color: var(--colour-on-ink); text-decoration: none; }
.footer-bar__top:hover { border-color: var(--colour-gilt-bright); color: var(--colour-gilt-bright); }
.footer-bar__follow { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.footer-bar__label { margin-right: var(--space-1); }
.footer-bar__glyph { display: inline-flex; align-items: center; justify-content: center; width: var(--target-size); height: var(--target-size); border-radius: var(--radius-control); color: var(--colour-on-ink-soft); }
.footer-bar__glyph.pending { min-height: 0; padding: 0; font-size: 0; border-style: dashed; }
.footer-bar__glyph--link { color: var(--colour-on-ink); border: 1px solid var(--colour-on-ink-soft); text-decoration: none; }
.footer-bar__glyph--link:hover { border-color: var(--colour-gilt-bright); color: var(--colour-gilt-bright); }
.site-footer__imprint { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4); margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--colour-rule-strong); }
.site-footer__links { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.site-footer__links a { display: inline-flex; align-items: center; min-height: var(--target-size); padding: 0 var(--space-2); color: var(--colour-on-ink); font-family: var(--font-signage); font-stretch: 87.5%; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; font-weight: 600; }
.site-footer__links a:hover { color: var(--colour-gilt-bright); }
.site-footer__note { width: 100%; font-size: var(--size-small); color: var(--colour-on-ink-soft); }
.site-footer__note--column { margin: 0; width: auto; }

/* ---- page furniture ---- */
.site-main { flex: 1 0 auto; padding: var(--space-6) 0 0; }
.section { margin-top: var(--space-8); }
.section__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-5); }
.section__title { position: relative; padding-bottom: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: 1.0625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink); }
.section__title::after { content: ""; position: absolute; left: 0; bottom: 0; width: 3rem; height: 2px; background: var(--colour-gilt); }
.section__aside { font-size: var(--size-ui); color: var(--colour-ink-soft); }
.section__aside a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.note { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.55; color: var(--colour-ink-soft); }
.lede { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-lede); line-height: 1.55; color: var(--colour-ink-soft); }
.stats { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin: 0; padding: 0; list-style: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.stats strong { color: var(--colour-ink); font-weight: 700; }

/* ---- title page (results, taxonomy detail, boundary) ---- */
.title-page { max-width: var(--measure-page); margin-bottom: var(--space-6); }
.title-page__title { font-size: var(--size-display); line-height: var(--size-line-tight); }
.title-page__title.is-long { font-size: var(--size-title); }
.title-page__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin-top: var(--space-4); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.trail { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); margin: 0 0 var(--space-3); padding: 0; list-style: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-muted); }
.trail a { display: inline-flex; align-items: center; min-height: var(--target-size); color: var(--colour-ink-soft); text-decoration: none; }
.trail a:hover { color: var(--colour-gilt); text-decoration: underline; }
.trail li + li::before { content: "›"; margin-right: var(--space-2); color: var(--colour-rule-strong); }

/* ---- controls ---- */
.button, .icon-button, .control, .chip, .token, .spine__link, .ruler__cell, .tab { touch-action: manipulation; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5em; min-height: var(--target-size); padding: 0.55rem 1.1rem; border: 2px solid var(--colour-ink); border-radius: var(--radius-control); background: var(--colour-ink); color: var(--colour-on-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: background-color var(--motion-duration) var(--motion-easing), color var(--motion-duration) var(--motion-easing), border-color var(--motion-duration) var(--motion-easing); }
.button:hover { background: var(--colour-gilt); border-color: var(--colour-gilt); color: var(--colour-on-ink); }
.button--outline { background: transparent; color: var(--colour-ink); }
.button--outline:hover { background: var(--colour-ink); color: var(--colour-on-ink); border-color: var(--colour-ink); }
.button--onink { background: transparent; border-color: var(--colour-on-ink); color: var(--colour-on-ink); }
.button--onink:hover { background: var(--colour-on-ink); color: var(--colour-ink); border-color: var(--colour-on-ink); }
.button[aria-disabled="true"], .button:disabled { background: var(--colour-tile); border-color: var(--colour-tile); color: var(--colour-ink-muted); cursor: not-allowed; }
.control { width: 100%; min-height: var(--target-size); padding: 0.5rem 0.75rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); background: var(--colour-raised); color: var(--colour-ink); font-size: 1rem; appearance: none; -webkit-appearance: none; }
select.control { background-image: linear-gradient(45deg, transparent 50%, var(--colour-ink) 50%), linear-gradient(135deg, var(--colour-ink) 50%, transparent 50%); background-position: calc(100% - 1.1rem) 50%, calc(100% - 0.75rem) 50%; background-size: 0.35rem 0.35rem; background-repeat: no-repeat; padding-right: 2rem; }
.control:disabled { background: var(--colour-tile); color: var(--colour-ink-muted); }
.field { display: grid; gap: var(--space-1); min-width: 0; }
.field__label { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-soft); }
.refine { margin-top: var(--space-3); border-top: 1px solid var(--colour-rule); }
.refine__summary { display: flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); padding: var(--space-2) 0; list-style: none; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink); }
.refine__summary::-webkit-details-marker { display: none; }
.refine__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.refine[open] > .refine__summary::before { transform: rotate(45deg); }
.refine__badge { display: inline-flex; align-items: center; min-height: 1.5rem; padding: 0 0.5rem; border-radius: var(--radius-pill); background: var(--colour-gilt-soft); color: var(--colour-gilt); font-size: var(--size-small); letter-spacing: 0.06em; }
.refine__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); align-items: end; padding: var(--space-2) 0 var(--space-4); }
.refine__actions { grid-column: 1 / -1; }
.tokens { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); margin: var(--space-4) 0 0; }
.tokens__list { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.token { display: inline-flex; align-items: center; gap: 0.5em; min-height: var(--target-size); padding: 0 0.85rem; border: 1px solid var(--colour-gilt); border-radius: var(--radius-pill); background: var(--colour-gilt-soft); color: var(--colour-ink); font-size: var(--size-ui); text-decoration: none; }
.token:hover { background: var(--colour-gilt); color: var(--colour-on-ink); }
.token__remove { font-size: 1.15em; line-height: 1; }
.tokens__clear { display: inline-flex; align-items: center; min-height: var(--target-size); font-family: var(--font-signage); font-stretch: 87.5%; letter-spacing: 0.08em; text-transform: uppercase; font-size: var(--size-small); font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.chip { display: inline-flex; align-items: center; gap: 0.5em; min-height: var(--target-size); padding: 0 0.9rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-pill); background: var(--colour-raised); color: var(--colour-ink); font-size: var(--size-ui); text-decoration: none; }
.chip:hover { border-color: var(--colour-ink); color: var(--colour-ink); background: var(--colour-recessed); }
.chip__count { font-family: var(--font-signage); font-variant-numeric: tabular-nums; color: var(--colour-ink-muted); }

/* ---- catalogue entries ---- */
.catalogue { list-style: none; margin: 0; padding: 0; }
.catalogue > li { border-top: 1px solid var(--colour-rule); }
.catalogue > li:last-child { border-bottom: 1px solid var(--colour-rule); }
.entry { position: relative; display: grid; grid-template-columns: 2.75rem minmax(0, 1fr); grid-template-areas: "ordinal stamp" "ordinal title" "ordinal meta" "ordinal desc" "ordinal reason"; column-gap: var(--space-4); row-gap: var(--space-1); padding: var(--space-4) 0; }
.entry__stamp { grid-area: stamp; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-gilt); }
.entry__title { grid-area: title; font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.entry__title a { color: var(--colour-ink); text-decoration: none; }
.entry__title a::after { content: ""; position: absolute; inset: 0; }
.entry:hover .entry__title a { color: var(--colour-gilt); text-decoration: underline; }
.entry__meta { grid-area: meta; display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.entry__meta a { position: relative; z-index: 1; color: var(--colour-ink-soft); }
.entry__meta a:hover { color: var(--colour-gilt); }
.entry__desc { grid-area: desc; max-width: var(--measure-prose); margin-top: var(--space-1); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.55; }
.entry__desc--clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.entry__reason { grid-area: reason; font-size: var(--size-small); color: var(--colour-ink-muted); }
.entry--card { column-gap: var(--space-5); padding: var(--space-5); background: var(--colour-raised); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.entry--card .entry__title { font-size: var(--size-card-title); }
.entry--card .entry__desc { margin-top: var(--space-3); }
.entry__tab { grid-area: ordinal; align-self: stretch; }
.entry__tab .tab { position: relative; z-index: 1; width: 100%; height: 100%; min-height: 10rem; justify-content: center; }
.catalogue--cards > li { border: 0; }
.catalogue--cards > li + li { margin-top: var(--space-4); }
.catalogue--related { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 var(--space-6); }
.entry--related { padding: var(--space-3) 0; }
.entry--related .entry__title { font-size: var(--size-lede); }

/* ---- indexes ---- */
.index { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: var(--space-7); }
.index li { break-inside: avoid; border-top: 1px solid var(--colour-rule); }
.index a { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); min-height: var(--target-size); padding: var(--space-2) 0; font-family: var(--font-display); font-size: var(--size-h3); color: var(--colour-ink); text-decoration: none; }
.index a:hover { color: var(--colour-gilt); }
.index__count { flex: none; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-muted); font-variant-numeric: tabular-nums; }
.index--single { columns: 1; }

/* ---- results & pagination ---- */
.results { margin-top: var(--space-6); }
.results:focus { outline: none; }
.results__list { max-width: var(--measure-results); }
.results__status { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.results__fewer { display: inline-flex; align-items: center; min-height: var(--target-size); font-size: var(--size-ui); }
.pagination { margin-top: var(--space-6); }
.pagination__list { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
.pagination__page, .pagination__step { display: inline-flex; align-items: center; justify-content: center; min-width: var(--target-size); min-height: var(--target-size); padding: 0 0.75rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); color: var(--colour-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none; font-variant-numeric: tabular-nums; }
.pagination__page:hover, .pagination__step:hover { border-color: var(--colour-ink); background: var(--colour-recessed); }
.pagination__page[aria-current="page"] { background: var(--colour-ink); border-color: var(--colour-ink); color: var(--colour-on-ink); }
.pagination__gap { display: inline-flex; align-items: center; padding: 0 var(--space-1); color: var(--colour-ink-muted); }
.empty { max-width: var(--measure-prose); padding: var(--space-5) 0; }
.empty__title { font-family: var(--font-display); font-size: var(--size-h3); margin-bottom: var(--space-2); }
.empty p + p { margin-top: var(--space-3); }

/* ---- reading ---- */
.prose { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.prose p { margin: 0 0 0.9em; }
.prose p:last-child { margin-bottom: 0; }
.prose--lede { font-size: var(--size-lede); line-height: 1.6; }

/* ---- boundary ---- */
.boundary { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-6); align-items: center; max-width: var(--measure-page); padding: var(--space-6) 0; }
.boundary__message { margin: var(--space-3) 0 var(--space-5); }
.boundary__art { width: min(18rem, 40vw); height: auto; }

/* ---- responsive ---- */
@media (max-width: 76rem) {
  .catalogue--related { grid-template-columns: minmax(0, 1fr); }
  .masthead__inner { grid-template-columns: auto minmax(0, 1fr); }
  .masthead__actions { grid-column: 2; justify-content: flex-end; }
  .masthead__nav { grid-column: 1 / -1; grid-row: 2; }
  .masthead__links { justify-content: flex-start; margin-left: calc(var(--space-2) * -1); }
}
@media (max-width: 60rem) {
  .masthead__inner { grid-template-columns: minmax(0, 1fr) auto; }
  .masthead__dropdown--wide { min-width: 15rem; }
  .masthead__dropdown { left: 0; right: auto; }
  .masthead__search .control { width: 11rem; }
  .refine__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .boundary { grid-template-columns: minmax(0, 1fr); }
  .boundary__art { width: 12rem; }
  .footer-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 44rem) {
  .masthead__inner { row-gap: var(--space-2); }
  .masthead__dropdown { position: static; margin-top: var(--space-1); }
  .masthead__search { display: none; }
  .masthead__search-link { display: inline-flex; align-items: center; min-height: var(--target-size); padding: 0 var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; color: var(--colour-ink); }
  .masthead__search-link:hover { color: var(--colour-gilt); }
  .brand__logo { width: 7rem; }
  .site-main { padding-top: var(--space-5); }
  .footer-columns { grid-template-columns: minmax(0, 1fr); }
  .footer-bar { flex-direction: column; align-items: flex-start; }
  .section { margin-top: var(--space-7); }
  .entry__desc--clamp { -webkit-line-clamp: 4; line-clamp: 4; }
  .entry, .entry--card { grid-template-columns: 2.25rem minmax(0, 1fr); column-gap: var(--space-3); }
  .entry--card { padding: var(--space-4); }
  .entry__tab .tab__name { font-size: var(--size-small); }
  .index { columns: 1; }
  .site-footer__imprint { flex-direction: column; align-items: flex-start; }
}
@media (max-width: 38rem) {
  .masthead__inner, .site-main, .site-footer__inner, .hero__inner { width: min(var(--measure-page), 100% - 2rem); }
  .refine__grid { grid-template-columns: minmax(0, 1fr); }
  .section__head { flex-direction: column; align-items: flex-start; }
  .title-page__title { font-size: var(--size-title); }
}

/* ---- motion, forced colours, print ---- */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; }
}
@media (forced-colors: active) {
  .brand__logo { forced-color-adjust: none; padding: 0.25rem; background: var(--colour-raised); }
  .brand__logo--inverse { background: var(--colour-ink); }
  .masthead__links a[aria-current="page"], .masthead__menu-toggle.is-active, .masthead__dropdown a[aria-current="page"], .token, .chip, .pagination__page[aria-current="page"] { outline: 2px solid CanvasText; }
  .pending { border-color: GrayText; color: GrayText; }
  .footer-bar__top, .footer-bar__glyph--link { border: 1px solid CanvasText; }
  .entry__title a::after { display: none; }
  .section__title::after { background: CanvasText; }
  .button { border: 2px solid ButtonText; }
}
@media print {
  .skip-link, .preview-band, .masthead__links, .masthead__menu, .masthead__actions, .masthead__search, .masthead__search-link, .site-footer, .finder, .pagination, .tokens, .chips, .shelf, .rail, .trail, .pending { display: none !important; }
  body { background: var(--colour-ground-print); color: var(--colour-ink-print); }
  a { color: inherit; text-decoration: none; }
  .masthead__inner, .site-main { width: auto; }
  .site-main { padding: 0; }
  .entry__title a::after { display: none; }
  .entry, .question { break-inside: avoid; }
}
`;
