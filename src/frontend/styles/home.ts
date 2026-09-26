/** Astra: a photographic welcome, followed by the church's unchanged words. */
export const homeStyles = `
.site-main:has(.home) { padding-top: 0; }
.notice { background: var(--colour-ink); color: var(--colour-on-ink); font-size: var(--size-small); }
.notice__inner { width: min(var(--measure-page), 100% - 3rem); margin: auto; padding: .7rem 0; display: flex; justify-content: center; align-items: center; gap: .7rem; text-align: center; }
.notice__pin { width: .4rem; height: .4rem; border-radius: 50%; background: var(--colour-gilt-bright); flex: none; }
.arrival { position: relative; display: grid; grid-template-columns: 1fr 1.1fr; margin-top: 2.5rem; min-height: 35rem; }
.arrival__text { position: relative; z-index: 1; padding: 3.2rem 2rem 4rem 0; align-self: center; }
.arrival__title { font-size: clamp(3rem, 4.9vw, 5.2rem); line-height: 1.06; letter-spacing: -.055em; margin: 1.5rem -4rem 1.75rem 0; }
.arrival__title span { display: block; }
.arrival__title span:last-child { font-style: italic; font-size: .87em; }
.arrival__time { font-size: 1.1rem; margin-bottom: 1.1rem; }
.arrival__cta { gap: 2rem; padding: 1rem 1.4rem; }
.arrival__address { margin-top: 1.4rem; max-width: 28ch; color: var(--colour-ink-soft); line-height: 1.65; font-size: .875rem; }
.arrival__picture { margin: 0; min-width: 0; overflow: hidden; }
.arrival__image { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 58% center; }
.arrival__visit { position: absolute; right: 0; bottom: 0; padding: 1.2rem 1.7rem; display: flex; align-items: center; justify-content: space-between; gap: 3rem; background: var(--colour-ground); color: var(--colour-ink); text-decoration: none; font-size: 1rem; }
.home > .section { margin-top: clamp(4rem, 8vw, 7rem); }
.welcome__spread { display: grid; grid-template-columns: 1fr 1.15fr; gap: 5rem; align-items: start; }
.welcome__title, .visit__title, .about__title, .home-events__title { font-family: var(--font-display); font-size: clamp(2rem, 3.5vw, 3.2rem); line-height: 1.16; letter-spacing: -.035em; }
.welcome__title { max-width: 13ch; }
.welcome__lede { font-size: 1.2rem; line-height: 1.8; }
.pillars { list-style: none; margin: 3.5rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 2rem; }
.pillar { border-top: 1px solid var(--colour-rule-strong); padding-top: 1.25rem; display: flex; flex-direction: column; align-items: flex-start; }
.pillar__number { color: var(--colour-gilt); font-size: .8rem; margin-bottom: 1.5rem; font-variant-numeric: tabular-nums; }
.pillar__title { font-size: 1.8rem; margin-bottom: 1rem; }
.pillar__text { font-size: .9375rem; line-height: 1.7; color: var(--colour-ink-soft); margin-bottom: 1.1rem; }
.pillar__more { margin-top: auto; display: inline-flex; gap: 1rem; align-items: center; min-height: var(--target-size); font-size: .875rem; text-decoration: none; border-bottom: 1px solid var(--colour-gilt); }
.visit { display: grid; grid-template-columns: .9fr 1fr; gap: 5rem; align-items: center; padding: 3rem; background: var(--colour-recessed); }
.visit__picture { height: 100%; min-height: 29rem; }
.visit__image { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; border-radius: 50% 50% 0 0; }
.visit__title { margin: 1rem 0 2rem; }
.services { list-style: none; padding: 0; margin: 0; }
.service { padding: 1.3rem 0; border-top: 1px solid var(--colour-rule-strong); }
.service__title { font-size: 1.3rem; line-height: 1.4; }
.service__title a { text-decoration: none; }
.service__text { margin-top: .7rem; color: var(--colour-ink-soft); line-height: 1.75; }
.visit__directions { margin-top: 1rem; }
.visit__directions a { display: inline-flex; min-height: var(--target-size); align-items: center; font-size: .9rem; }
.text-link { display: inline-flex; align-items: center; min-height: var(--target-size); gap: 2rem; border-bottom: 1px solid var(--colour-gilt); text-decoration: none; font-size: .9rem; }
.home-events { display: grid; grid-template-columns: .65fr 1.35fr; gap: 5rem; border-top: 1px solid var(--colour-rule); padding-top: 3rem; }
.home-events__title { max-width: 10ch; margin-bottom: 1.8rem; }
.home-events .events { margin-top: 0; }
.about-row { display: grid; grid-template-columns: 1fr .9fr; gap: 5rem; align-items: center; border-top: 1px solid var(--colour-rule); padding-top: 4rem; }
.about__title { margin: 1rem 0 1.8rem; max-width: 14ch; }
.about__text { font-size: 1.05rem; line-height: 1.8; margin-bottom: 1.5rem; }
.about__picture { margin: 0; min-width: 0; }
.about__image { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; }
.offering { display: grid; grid-template-columns: auto 1fr auto; gap: 3rem; align-items: center; background: var(--colour-ink); color: var(--colour-on-ink); margin: 6rem 0 0; padding: 3rem; }
.offering__title { color: var(--colour-on-ink); font-family: var(--font-display); font-size: 2.2rem; }
.offering__quote { margin: 0; font-family: var(--font-reading); font-size: 1.3rem; line-height: 1.65; }
.offering__quote footer { color: var(--colour-on-ink-soft); font-family: var(--font-ui); font-size: .8rem; margin-top: 1rem; }
@media (max-width: 64rem) {
 .arrival { min-height: 29rem; }
 .arrival__title { font-size: clamp(2.7rem, 6vw, 4.2rem); }
 .welcome__spread, .visit, .about-row, .home-events { gap: 2.5rem; }
 .visit { padding: 2rem; } .pillars { gap: 1.5rem; }
 .offering { grid-template-columns: auto 1fr; padding: 2rem; }
 .offering > .button { grid-column: 2; justify-self: start; }
}
@media (max-width: 44rem) {
 .arrival { margin-top: 1.5rem; grid-template-columns: 1fr; }
 .arrival__text { padding: 1.5rem 0 2rem; }
 .arrival__title { font-size: clamp(2.8rem, 10.8vw, 4.5rem); margin: 1rem 0 1.4rem; }
 .arrival__picture { height: 20rem; }
 .arrival__address { max-width: 34ch; }
 .arrival__visit { padding: 1rem 1.4rem; }
 .welcome__spread, .visit, .about-row, .home-events { grid-template-columns: 1fr; }
 .welcome__title { max-width: 18ch; } .welcome__lede { font-size: 1.1rem; }
 .pillars { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 2rem 1.2rem; }
 .pillar__title { font-size: 1.45rem; } .pillar__number { margin-bottom: 1rem; }
 .visit { padding: 1.5rem; }
 .visit__picture { min-height: 0; height: 21rem; } .visit__image { object-position: center 50%; }
 .home-events__title { max-width: none; }
 .about__picture { grid-row: 1; } .about__image { aspect-ratio: 4 / 3; }
 .offering { grid-template-columns: 1fr; gap: 1.5rem; margin-top: 4rem; padding: 2rem 1.5rem; }
 .offering > .button { grid-column: auto; justify-self: start; }
}
@media print { .arrival__picture, .visit__picture, .about__picture { display: none; } .arrival, .welcome__spread, .visit, .about-row, .home-events, .offering { display: block; } }
`;
