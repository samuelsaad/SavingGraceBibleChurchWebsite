/** The Sunday invitation: confident wayfinding, then the actual gathered church. */
export const homeStyles = `
.notice { background: var(--colour-recessed); border-bottom: 1px solid var(--colour-rule); }
.notice__inner { width: min(var(--measure-page), 100% - 3rem); margin-inline: auto; padding: var(--space-2) 0; font-size: var(--size-small); color: var(--colour-ink-soft); }
.notice__pin { display: none; }
.arrive { margin-top: calc(var(--space-6) * -1); background: var(--colour-gilt-soft); }
.arrive__inner { width: min(var(--measure-page), 100% - 3rem); margin-inline: auto; display: grid; grid-template-columns: 1.4fr 1fr; align-items: center; gap: var(--space-8); padding: var(--space-7) 0; }
.arrive__title { font-size: clamp(3.5rem, 6.7vw, 6rem); line-height: 0.99; letter-spacing: -0.02em; }
.arrive__name { display: block; }
.arrive__welcome, .welcome-card { min-width: 0; }
.arrive__name { overflow-wrap: anywhere; }
.arrive__place { margin-top: var(--space-4); color: var(--colour-ink-soft); font-size: var(--size-reading); }
.welcome-card { border-top: 1px solid var(--colour-rule-strong); padding-top: var(--space-4); }
.welcome-card__body { display: grid; gap: var(--space-3); justify-items: start; }
.welcome-card__time { font-family: var(--font-display); font-size: 2rem; line-height: 1.1; font-weight: 600; }
.welcome-card__where { max-width: 32ch; color: var(--colour-ink-soft); }
.welcome-card__cta { margin-top: var(--space-2); }
.welcome-card__more { display: inline-flex; align-items: center; min-height: var(--target-size); font-size: var(--size-ui); }
.arrive__photograph { margin: 0; overflow: hidden; }
.arrive__image { display: block; width: 100%; height: clamp(20rem, 30vw, 30rem); object-fit: cover; object-position: center 53%; }
.arrive__inner--services { display: block; padding: var(--space-7) 0 var(--space-8); background: var(--colour-gilt-soft); }
.services { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-8); margin: 0; padding: 0; list-style: none; }
.service { padding-top: var(--space-4); border-top: 1px solid var(--colour-rule-strong); }
.service__title { font-family: var(--font-display); font-size: var(--size-card-title); line-height: 1.2; }
.service__title a { color: var(--colour-ink); text-decoration-thickness: 1px; }
.service__text { margin-top: var(--space-3); max-width: 60ch; color: var(--colour-ink-soft); }
.welcome { display: grid; grid-template-columns: 1.4fr 0.8fr; gap: var(--space-7) var(--space-8); align-items: start; }
.welcome__spread { grid-column: 1; }
.welcome__title { max-width: 19ch; font-size: var(--size-title); line-height: 1.1; }
.welcome__lede { margin-top: var(--space-5); max-width: 64ch; }
.pillars { grid-column: 1; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); margin: 0; padding: 0; list-style: none; }
.pillar { padding-top: var(--space-4); border-top: 1px solid var(--colour-rule); }
.pillar__title { font-size: var(--size-h3); margin-bottom: var(--space-2); }
.pillar__text { font-size: var(--size-ui); color: var(--colour-ink-soft); }
.pillar__more { display: inline-flex; align-items: center; min-height: var(--target-size); color: var(--colour-ink); font-size: var(--size-ui); font-weight: 600; text-decoration-thickness: 1px; }
.home__photo { grid-column: 2; grid-row: 1 / 3; margin: 0; height: 100%; }
.home__photo-image { display: block; width: 100%; height: 100%; max-height: 44rem; object-fit: cover; object-position: 47% center; }
.about-row { display: grid; grid-template-columns: 1.3fr 1fr; gap: var(--space-8); align-items: start; padding-top: var(--space-7); border-top: 1px solid var(--colour-rule); }
.about__title { font-size: var(--size-title); }
.about__text { margin-top: var(--space-5); }
.about__more { margin-top: var(--space-3); }
.offering { padding: var(--space-7); background: var(--colour-ink); color: var(--colour-on-ink); }
.offering__title { font-size: var(--size-card-title); color: var(--colour-on-ink); }
.offering__quote { margin: var(--space-5) 0; }
.offering__quote p { font-family: var(--font-reading); font-size: var(--size-lede); line-height: 1.55; }
.offering__cite { margin-top: var(--space-4); font-size: var(--size-ui); color: var(--colour-on-ink-soft); }
@media (prefers-reduced-motion: no-preference) {
  @keyframes invitation-open { from { clip-path: inset(0 0 5% 0); } to { clip-path: inset(0); } }
  .arrive__photograph { animation: invitation-open 700ms cubic-bezier(.16, 1, .3, 1); }
}
@media (max-width: 60rem) {
  .arrive__inner { gap: var(--space-6); }
  .arrive__title { font-size: clamp(3.25rem, 7vw, 5rem); }
  .welcome { grid-template-columns: 1.35fr 1fr; gap: var(--space-6); }
  .home__photo { grid-row: 1; }
  .pillars { grid-column: 1 / -1; grid-template-columns: repeat(4, 1fr); }
  .about-row { gap: var(--space-6); }
}
@media (max-width: 44rem) {
  .arrive { margin-top: calc(var(--space-5) * -1); }
  .arrive__inner { grid-template-columns: minmax(0, 1fr); padding: var(--space-6) 0; gap: var(--space-5); }
  .arrive__title { font-size: clamp(3rem, 12vw, 4.75rem); }
  .arrive__image { height: 18rem; object-position: 50% 60%; }
  .services, .welcome, .about-row { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); }
  .arrive__inner--services { padding-bottom: var(--space-7); }
  .welcome__spread, .home__photo, .pillars { grid-column: 1; grid-row: auto; }
  .home__photo { height: 24rem; }
  .home__photo-image { object-position: center 45%; }
  .pillars { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .offering { padding: var(--space-6); }
}
@media (max-width: 38rem) {
  .notice__inner, .arrive__inner { width: min(var(--measure-page), 100% - 2rem); }
}
@media print {
  .notice, .welcome-card__cta, .events__calendar { display: none; }
  .arrive, .offering { background: none; color: var(--colour-ink-print); }
}
`;
