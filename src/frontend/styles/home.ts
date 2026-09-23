/**
 * Church homepage stylesheet: the notice band, the arrival band with the
 * welcome card and the two services standing on the shelf board, the
 * welcome spread and its four pillars, the about row with the offering
 * panel, and the events ledger. Recent sermons reuse the cards block.
 */
export const homeStyles = `
/* ---- notice band ---- */
.notice { background: var(--colour-gilt-soft); border-bottom: 1px solid var(--colour-gilt); }
.notice__inner { display: flex; align-items: center; gap: var(--space-3); width: min(var(--measure-page), 100% - 3rem); min-height: var(--target-size); margin-inline: auto; padding: var(--space-2) 0; font-size: var(--size-ui); color: var(--colour-ink); }
.notice__pin { flex: none; width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--colour-gilt); box-shadow: 0 0 0 2px var(--colour-gilt-soft), 0 0 0 3px var(--colour-gilt); }

/* ---- arrival band ---- */
.arrive { position: relative; margin-top: calc(var(--space-6) * -1); background: var(--colour-recessed); border-bottom: 0.375rem solid var(--colour-ink); }
.arrive::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0.25rem; border-top: 1px solid var(--colour-rule-strong); }
.arrive__inner { width: min(var(--measure-page), 100% - 3rem); margin-inline: auto; display: grid; grid-template-columns: minmax(0, 7fr) minmax(20rem, 5fr); gap: var(--space-6) var(--space-8); align-items: center; padding: var(--space-8) 0 var(--space-7); }
.arrive__inner--services { display: block; padding: 0; }
.arrive__eyebrow { font-size: var(--size-ui); letter-spacing: 0.16em; }
.arrive__title { margin-top: var(--space-3); font-size: var(--size-display); line-height: var(--size-line-tight); letter-spacing: 0.005em; max-width: 12ch; }
.arrive__name { display: block; }
.arrive__rule { display: block; width: 3rem; height: 2px; margin-top: var(--space-5); background: var(--colour-gilt); }
.welcome-card { display: grid; gap: var(--space-3); padding: var(--space-6); background: var(--colour-raised); border-top: 4px solid var(--colour-gilt); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.welcome-card__time { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-card-title); font-weight: 700; letter-spacing: 0.04em; line-height: 1.05; font-variant-numeric: tabular-nums; color: var(--colour-ink); }
.welcome-card__where { font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.5; color: var(--colour-ink-soft); }
.welcome-card__cta { margin-top: var(--space-2); width: 100%; }
.services { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); margin: 0; padding: 0; list-style: none; }
.service { padding: var(--space-5) var(--space-5) var(--space-6); background: var(--colour-raised); border-radius: var(--radius-card) var(--radius-card) 0 0; }
.service--morning { border-top: 4px solid var(--colour-gilt); box-shadow: var(--shadow-card); }
.service--evening { border: 1px solid var(--colour-rule-strong); border-bottom: 0; }
.service__title { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.service__text { margin-top: var(--space-3); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.55; color: var(--colour-ink-soft); }

/* ---- welcome spread and pillars ---- */
.welcome__spread { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--space-6) var(--space-7); align-items: start; }
.welcome__title { font-family: var(--font-display); font-size: var(--size-title); line-height: var(--size-line-title); max-width: 14ch; }
.welcome__lede { max-width: none; padding-left: var(--space-6); border-left: 1px solid var(--colour-rule); }
.pillars { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); margin: var(--space-7) 0 0; padding: 0; list-style: none; }
.pillar { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); overflow: hidden; }
.pillar__spine { display: flex; justify-content: center; padding-top: var(--space-4); background: var(--colour-ink); color: var(--colour-gilt-bright); }
.pillar__glyph { width: 1.5rem; height: 1.5rem; }
.pillar__body { display: grid; align-content: start; gap: var(--space-2); padding: var(--space-4) var(--space-4) var(--space-3); }
.pillar__title { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.pillar__text { font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.5; color: var(--colour-ink-soft); }
.pillar__more { display: inline-flex; align-items: center; justify-self: start; min-height: var(--target-size); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
a.pillar__more { color: var(--colour-gilt); text-decoration: none; }
a.pillar__more::after { content: " →"; }
a.pillar__more:hover { text-decoration: underline; }

/* ---- about and the offering panel ---- */
.about-row { display: grid; grid-template-columns: minmax(0, 7fr) minmax(18rem, 5fr); gap: var(--space-6) var(--space-8); align-items: start; }
.about__title { font-family: var(--font-display); font-size: var(--size-title); line-height: var(--size-line-title); }
.about__text { margin-top: var(--space-4); }
.about__more { margin-top: var(--space-4); }
.offering { padding: var(--space-6); background: var(--colour-ink); color: var(--colour-on-ink); border-top: 0.25rem solid var(--colour-gilt-bright); border-radius: var(--radius-card); }
.offering__title { position: relative; padding-bottom: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: 1.0625rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-gilt-bright); }
.offering__title::after { content: ""; position: absolute; left: 0; bottom: 0; width: 3rem; height: 2px; background: var(--colour-gilt-bright); }
.offering__quote { margin: var(--space-5) 0 0; }
.offering__quote p { font-family: var(--font-display); font-style: italic; font-size: var(--size-card-title); line-height: 1.25; text-wrap: pretty; }
.offering__cite { margin-top: var(--space-4); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-gilt-bright); }

/* ---- events ledger ---- */
.events { max-width: var(--measure-results); margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--colour-rule); }
.event { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr); gap: var(--space-4); padding: var(--space-4) 0; border-bottom: 1px solid var(--colour-rule); }
.event__date { display: grid; align-content: start; justify-items: start; padding-left: var(--space-3); border-left: 2px solid var(--colour-gilt); font-family: var(--font-signage); font-stretch: 87.5%; }
.event__month { font-size: var(--size-small); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-ink-soft); }
.event__day { font-size: var(--size-card-title); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--colour-ink); }
.event__body { display: grid; gap: var(--space-1); }
.event__time { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--size-ui); color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.glyph--recurring { width: 1rem; height: 1rem; color: var(--colour-gilt); }
.event__title { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; color: var(--colour-ink); }
.events__calendar { align-self: center; }

/* ---- motion ---- */
@media (prefers-reduced-motion: no-preference) {
  @keyframes home-settle { from { opacity: 0; transform: translateY(0.75rem); } to { opacity: 1; transform: none; } }
  .welcome-card, .service { animation: home-settle var(--motion-settle) var(--motion-easing) both; }
  .service--morning { animation-delay: 60ms; }
  .service--evening { animation-delay: 120ms; }
}

/* ---- responsive ---- */
@media (max-width: 60rem) {
  .arrive__inner { grid-template-columns: minmax(0, 1fr); padding: var(--space-7) 0 var(--space-6); }
  .welcome-card { max-width: 32rem; }
  .welcome__spread { grid-template-columns: minmax(0, 1fr); }
  .welcome__lede { padding-left: 0; padding-top: var(--space-4); border-left: 0; border-top: 1px solid var(--colour-rule); }
  .pillars { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .about-row { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 44rem) {
  .arrive__title { max-width: none; }
  .services { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
  .service--evening { border-bottom: 0; }
  .pillars { grid-template-columns: minmax(0, 1fr); }
  .event { grid-template-columns: 4rem minmax(0, 1fr); }
  .notice__inner { width: min(var(--measure-page), 100% - 2rem); }
  .arrive__inner { width: min(var(--measure-page), 100% - 2rem); }
}
@media (forced-colors: active) {
  .welcome-card, .service, .pillar, .offering { border: 1px solid CanvasText; }
  .pillar__spine { border-right: 1px solid CanvasText; }
  .arrive { border-bottom: 0.375rem solid CanvasText; }
}
@media print {
  .notice, .welcome-card__cta, .events__calendar { display: none !important; }
  .arrive, .offering { background: none; color: var(--colour-ink-print); border-color: var(--colour-ink-print); }
  .offering__title, .offering__cite { color: var(--colour-ink-print); }
}
`;
