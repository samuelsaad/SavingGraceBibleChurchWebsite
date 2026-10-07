/**
 * Visitor pages share the Sunday invitation's clear lettering, natural images
 * and open reading space. Content and eligibility stay in their renderers.
 */
export const churchStyles = `
/* ---- opening invitation ---- */
.page { max-width: var(--measure-page); }
.page__head { display: grid; gap: var(--space-6); margin-bottom: clamp(2.5rem, 5vw, 4.5rem); padding: clamp(1.5rem, 3.5vw, 3rem); background: var(--colour-recessed); }
.page__head--aside { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: center; gap: clamp(2rem, 4vw, 4rem); }
.page__head-text, .page__head-picture { min-width: 0; }
.page__head .trail { margin: 0 0 var(--space-5); }
.page__head .trail a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.page__title { max-width: 24ch; font-family: var(--font-display); font-size: clamp(2.8rem, 4.5vw, 4.5rem); font-weight: 700; line-height: 1.05; letter-spacing: -0.025em; text-transform: uppercase; text-wrap: balance; }
.page__title--long { font-size: clamp(2.25rem, 3.1vw, 3.25rem); line-height: 1.1; text-transform: none; }
.page__category { margin: var(--space-4) 0 0; font-size: var(--size-ui); font-weight: 600; color: var(--colour-ink-soft); }
.page__lede { max-width: var(--measure-prose); margin-top: var(--space-5); font-family: var(--font-reading); font-size: var(--size-lede); line-height: 1.5; }
.page__status { display: block; max-width: var(--measure-prose); margin-top: var(--space-5); padding: var(--space-3) var(--space-4); border: 1px dashed var(--colour-rule-strong); color: var(--colour-ink); font-size: var(--size-ui); font-weight: 600; line-height: 1.5; }
.page__head-picture { display: flex; align-items: center; justify-content: center; }
.page__head-image { display: block; width: 100%; height: auto; max-height: 25rem; object-fit: contain; }
.page__badge { display: inline-flex; align-items: center; margin-left: var(--space-2); padding: 0.1rem 0.5rem; border: 1px dashed var(--colour-rule-strong); font-size: var(--size-small); font-weight: 600; color: var(--colour-ink-soft); }

/* ---- readable, unboxed long form ---- */
.page__body { display: flow-root; }
.page__body > p, .page__body > .page__list, .page__body > .verse, .page__body > .book, .page__body .panel > p { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.page__body > p { margin: 0 0 1.15em; }
.page__body > p.lede { font-size: var(--size-lede); margin-bottom: var(--space-6); }
.page__h2, .page__h3, .page__h4 { max-width: 34ch; margin: var(--space-8) 0 var(--space-4); font-family: var(--font-display); font-weight: 700; color: var(--colour-ink); text-wrap: balance; scroll-margin-top: var(--space-6); }
.page__h2 { font-size: clamp(2rem, 2.6vw, 2.8rem); line-height: 1.15; letter-spacing: -0.01em; }
.page__h3 { margin-top: var(--space-7); font-size: clamp(1.65rem, 2vw, 2rem); line-height: 1.15; }
.page__h4 { margin-top: var(--space-6); font-family: var(--font-ui); font-size: var(--size-reading); line-height: 1.35; }
.page__body > .page__h2:first-child, .page__body > .page__h3:first-child { margin-top: 0; }
.page__list { margin: 0 0 1.2em; padding-left: 1.35em; }
.page__list li { margin-bottom: 0.55em; padding-left: 0.25em; }
.page__list li::marker { color: var(--colour-ink); font-weight: 600; }
.page__body a.external::after { content: " ↗"; font-size: 0.8em; }
.page__body a.external.button::after { content: none; }
.verse { clear: both; margin: var(--space-7) 0; padding: var(--space-5) 0; border-top: 1px solid var(--colour-rule-strong); border-bottom: 1px solid var(--colour-rule-strong); }
.verse p { margin: 0; font-family: var(--font-reading); font-size: var(--size-lede); line-height: 1.6; text-wrap: pretty; }
.verse__cite { margin-top: var(--space-3); font-size: var(--size-ui); font-weight: 600; color: var(--colour-ink-soft); }
.figure { margin: var(--space-7) 0; }
.figure__image { display: block; max-width: 100%; height: auto; }
.figure--full .figure__image, .figure--inset .figure__image, .figure--portrait .figure__image { width: 100%; }
.figure--inset { max-width: 36rem; }
.figure--portrait { float: right; width: min(17rem, 28%); margin: 0 0 var(--space-5) var(--space-7); }
.figure__caption { max-width: var(--measure-prose); margin-top: var(--space-3); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.callout { clear: both; max-width: var(--measure-prose); margin: var(--space-7) 0; padding: clamp(1.5rem, 3vw, 2.5rem); background: var(--colour-recessed); font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.callout__title { margin-bottom: var(--space-3); font-family: var(--font-display); font-size: 2rem; font-weight: 700; line-height: 1.1; text-transform: uppercase; }
.panel { max-width: var(--measure-prose); margin: var(--space-5) 0 var(--space-7); padding: var(--space-6) 0; border-top: 1px solid var(--colour-rule-strong); border-bottom: 1px solid var(--colour-rule-strong); }
.panel p { margin: 0 0 1em; }
.panel p:last-child { margin-bottom: 0; }
.panel__title { margin-bottom: var(--space-4); font-family: var(--font-display); font-size: 2rem; font-weight: 700; }

/* ---- directories: images and full descriptions in editorial rows ---- */
.tiles { display: grid; grid-template-columns: minmax(0, 1fr); clear: both; margin: var(--space-6) 0 var(--space-8); padding: 0; list-style: none; }
.tile { min-width: 0; padding: var(--space-6) 0; border-top: 1px solid var(--colour-rule); }
.tile:last-child { border-bottom: 1px solid var(--colour-rule); }
.tile--pictured { display: grid; grid-template-columns: minmax(0, 12rem) minmax(0, 1fr); gap: clamp(1.5rem, 3vw, 3rem); align-items: start; }
.tile__picture { min-width: 0; }
.tile__image { display: block; width: 100%; height: auto; }
.tile__body { display: grid; align-content: start; justify-items: start; gap: var(--space-2); min-width: 0; }
.tile__title { min-width: 0; max-width: min(35ch, 100%); overflow-wrap: anywhere; font-family: var(--font-display); font-size: clamp(1.85rem, 2.4vw, 2.5rem); font-weight: 700; line-height: 1.1; text-transform: uppercase; }
.tile__title a { display: inline-block; max-width: 100%; min-height: var(--target-size); color: var(--colour-ink); text-decoration: none; }
.tile__title a:hover { text-decoration: underline; text-decoration-thickness: 1px; }
.tile__metadata { font-size: var(--size-ui); font-weight: 600; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.tile__text { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.6; color: var(--colour-ink-soft); }
.tile__more { display: inline-flex; align-items: center; justify-self: start; min-height: var(--target-size); margin-top: var(--space-2); font-size: var(--size-ui); font-weight: 600; }
a.tile__more { color: var(--colour-ink); }
.tile__body .pending { font-family: var(--font-ui); letter-spacing: normal; text-transform: none; }
.tiles--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--space-7); }
.tiles--4 .tile:last-child { border-bottom: 0; }
.tiles--4 .tile--pictured { grid-template-columns: minmax(0, 1fr); }

/* ---- leaders and church history ---- */
.people { display: grid; gap: var(--space-8); clear: both; margin: var(--space-7) 0; padding: 0; list-style: none; }
.person { display: grid; grid-template-columns: minmax(0, 15rem) minmax(0, 1fr); align-items: start; gap: var(--space-6) var(--space-8); padding-top: var(--space-6); border-top: 1px solid var(--colour-rule); }
.person:not(:has(.person__picture)) { grid-template-columns: minmax(0, 1fr); }
.person__image { display: block; width: 100%; height: auto; }
.person__body { min-width: 0; }
.person__name { font-family: var(--font-display); font-size: clamp(2.15rem, 3vw, 3rem); font-weight: 700; line-height: 1.1; text-transform: uppercase; }
.person__role { margin: var(--space-2) 0 var(--space-4); font-size: var(--size-ui); font-weight: 600; color: var(--colour-ink-soft); }
.person__text { max-width: var(--measure-prose); margin: 0 0 1em; font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.person__contact { margin-top: var(--space-3); font-size: var(--size-ui); overflow-wrap: anywhere; }
.person__contact a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.timeline { clear: both; max-width: 65rem; margin: var(--space-6) 0 var(--space-8); padding: 0; list-style: none; }
.timeline__item { display: grid; grid-template-columns: 8rem minmax(0, 1fr); gap: var(--space-6); padding: var(--space-6) 0; border-top: 1px solid var(--colour-rule); }
.timeline__when { font-family: var(--font-display); font-size: 2rem; font-weight: 700; line-height: 1.1; color: var(--colour-ink); font-variant-numeric: tabular-nums; }
.timeline__title { margin-bottom: var(--space-3); font-family: var(--font-display); font-size: 1.9rem; font-weight: 700; line-height: 1.15; }
.timeline__text { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.6; color: var(--colour-ink-soft); }

/* ---- gatherings and click-to-load media ---- */
.events-jumps { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); margin: calc(var(--space-5) * -1) 0 var(--space-6); }
.events-jumps a { display: inline-flex; align-items: center; min-height: var(--target-size); font-size: var(--size-reading); font-weight: 600; }
.events-more { margin-top: var(--space-4); }
.events-more__summary { min-height: var(--target-size); padding: var(--space-3) 0; font-size: var(--size-reading); font-weight: 600; cursor: pointer; }
.events-more__summary:hover { text-decoration: underline; text-underline-offset: 0.18em; }
.events-more__count { font-weight: 400; color: var(--colour-ink-soft); font-variant-numeric: tabular-nums; }
.page--events .section__title { scroll-margin-top: var(--space-6); }
.events { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--colour-rule); }
.event { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: var(--space-5); padding: var(--space-5) 0; border-bottom: 1px solid var(--colour-rule); }
.event__date { display: grid; align-content: start; font-family: var(--font-ui); }
.event__month { font-size: var(--size-small); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
.event__day { font-family: var(--font-display); font-size: 2.5rem; font-weight: 600; line-height: 1.05; font-variant-numeric: tabular-nums; }
.event__body { display: grid; min-width: 0; gap: var(--space-1); }
.event__time { display: inline-flex; flex-wrap: wrap; align-items: center; min-width: 0; gap: var(--space-2); color: var(--colour-ink-soft); font-size: var(--size-ui); }
.event__time time { min-width: 0; overflow-wrap: anywhere; }
.event__time > * { min-width: 0; }
.glyph--recurring { flex: none; width: 1rem; height: 1rem; }
.event__title { display: flex; align-items: center; min-height: var(--target-size); font-family: var(--font-display); font-size: var(--size-h3); }
.events__calendar { align-self: center; }
.next-event { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-4); max-width: var(--measure-prose); margin: 0 0 var(--space-6); padding: var(--space-4) var(--space-5); background: var(--colour-recessed); font-size: var(--size-reading); }
.next-event__label { font-size: var(--size-ui); font-weight: 600; }
.next-event__link { display: inline-flex; align-items: center; min-height: var(--target-size); color: var(--colour-ink); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.6; }
.plate--church { max-width: var(--measure-prose); margin: var(--space-6) 0 var(--space-7); }
.plate--external { aspect-ratio: auto; min-height: 12rem; }
.plate--external .plate__consent { position: static; }
.plate__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-3); margin: 0; }
.plate__external { display: inline-flex; align-items: center; min-height: var(--target-size); color: var(--colour-on-ink); text-decoration-color: var(--colour-on-ink); }
.plate__external:hover { color: var(--colour-on-ink-soft); }
.page .event__venue { font-size: var(--size-ui); color: var(--colour-ink-soft); }
.event__title a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.page .event__title a { color: var(--colour-ink); text-decoration: none; }
.page .event__title a:hover { text-decoration: underline; }
.event-detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-7); margin-bottom: var(--space-8); padding: var(--space-6) 0; border-top: 1px solid var(--colour-rule-strong); border-bottom: 1px solid var(--colour-rule-strong); }
.event-detail__dates, .event-detail__venue { min-width: 0; font-size: var(--size-reading); line-height: 1.6; }
.event-detail .page__h2 { margin-top: 0; }
.event-detail .page__list { margin-bottom: 0; font-variant-numeric: tabular-nums; }
.event-detail__venue p { margin-top: var(--space-4); }
.event-detail__ministry { margin: var(--space-5) 0; }
.past-events { max-width: var(--measure-prose); margin: 0; padding: 0; list-style: none; }
.past-events li { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-4); padding: var(--space-3) 0; border-top: 1px solid var(--colour-rule); }
.past-events a { display: inline-flex; align-items: center; min-height: var(--target-size); font-weight: 600; }
.past-events__when { color: var(--colour-ink-soft); font-size: var(--size-ui); }

/* ---- resources and doctrine ---- */
.downloads, .hymns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6) var(--space-7); clear: both; margin: var(--space-6) 0 var(--space-8); padding: 0; list-style: none; }
.download, .hymn { display: grid; align-content: start; justify-items: start; gap: var(--space-3); padding-top: var(--space-5); border-top: 1px solid var(--colour-rule); }
.download__title, .hymn__title { font-family: var(--font-display); font-size: 2rem; font-weight: 700; line-height: 1.1; }
.download__text, .hymn__text { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.6; color: var(--colour-ink-soft); }
.download__link { margin-top: var(--space-2); }
.download__link .button { text-align: left; }
.hymn__link { display: inline-flex; align-items: center; min-height: var(--target-size); font-size: var(--size-ui); font-weight: 600; color: var(--colour-ink); }
.index-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--space-7); margin: var(--space-5) 0 var(--space-8); padding: 0; list-style: none; }
.index-grid__link { display: grid; gap: var(--space-2); height: 100%; min-height: var(--target-size); padding: var(--space-5) 0; border-top: 1px solid var(--colour-rule); color: var(--colour-ink); text-decoration: none; }
.index-grid__link:hover .index-grid__title { text-decoration: underline; text-decoration-thickness: 1px; }
.index-grid__title { font-family: var(--font-display); font-size: 1.9rem; font-weight: 700; line-height: 1.1; text-transform: uppercase; }
.index-grid__text { font-size: var(--size-reading); line-height: 1.5; color: var(--colour-ink-soft); }
.book { display: grid; grid-template-columns: minmax(0, 11rem) minmax(0, 1fr); gap: var(--space-6); align-items: start; margin: var(--space-6) 0 var(--space-8); }
.book__cover { display: block; width: 100%; height: auto; }
.book__text p { margin: 0 0 1em; font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }

/* ---- offering and contact details ---- */
.giving { clear: both; margin-bottom: var(--space-8); }
.giving > .page__h2 { margin-top: 0; }
.giving__intro { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.6; }
.giving__cta { margin: var(--space-5) 0 var(--space-7); }
.giving__methods { display: grid; margin: 0 0 var(--space-7); padding: 0; list-style: none; }
.giving__method { display: grid; grid-template-columns: minmax(0, 15rem) minmax(0, 1fr); gap: var(--space-5); padding: var(--space-5) 0; border-top: 1px solid var(--colour-rule); font-size: var(--size-reading); line-height: 1.6; }
.giving__method p { max-width: var(--measure-prose); }
.giving__method-title { margin-bottom: var(--space-3); font-family: var(--font-display); font-size: 1.85rem; font-weight: 700; line-height: 1.15; color: var(--colour-ink); }
.giving__method .giving__method-title { margin-bottom: 0; }
.giving__details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-7); padding: clamp(1.5rem, 3vw, 2.5rem); background: var(--colour-recessed); }
.giving__bank, .giving__online { min-width: 0; font-size: var(--size-reading); line-height: 1.65; }
.giving__bank p + p { margin-top: var(--space-2); }
.giving__online .page__list { margin: 0; padding: 0; list-style: none; }
.giving__online a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.contact-panel { display: grid; gap: var(--space-6); max-width: var(--measure-prose); margin: 0 0 var(--space-7); padding: clamp(1.5rem, 3vw, 2.5rem); background: var(--colour-recessed); }
.contact-panel__address { display: grid; gap: var(--space-1); font-style: normal; font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.6; }
.contact-panel__address a { display: inline-flex; align-items: center; min-height: var(--target-size); overflow-wrap: anywhere; }
.contact-panel__name { margin-bottom: var(--space-2); font-family: var(--font-display); font-size: 2rem; font-weight: 700; line-height: 1.15; }
.contact-panel__actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
.contact-panel__actions .button { white-space: normal; }

/* ---- onward navigation ---- */
.page__related { clear: both; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--space-6); margin-top: var(--space-9); padding-top: var(--space-6); border-top: 1px solid var(--colour-rule-strong); }
.page__related .section__title { font-family: var(--font-display); font-size: 2rem; font-weight: 700; text-transform: uppercase; }
.related-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--space-6); margin: 0; padding: 0; list-style: none; }
.related-list a { display: flex; align-items: center; min-height: var(--target-size); padding: var(--space-3) 0; border-bottom: 1px solid var(--colour-rule); color: var(--colour-ink); font-size: var(--size-reading); text-decoration: none; }
.related-list a:hover { text-decoration: underline; }
.page__sermons { clear: both; margin: var(--space-8) 0; }
.page__sermons > p { max-width: var(--measure-prose); margin: 0 0 var(--space-5); font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.page__sermons .cards { margin-bottom: var(--space-6); }
.page__back { margin-top: var(--space-7); }
.page__back a { display: inline-flex; align-items: center; min-height: var(--target-size); font-weight: 600; }
.sitemap { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-8) var(--space-7); }
.sitemap__group .page__h2 { margin-top: 0; font-size: 2rem; }
.sitemap .page__list { list-style: none; padding: 0; }
.sitemap .page__list a { display: inline-flex; align-items: center; min-height: var(--target-size); }

/* ---- responsive reading and navigation ---- */
@media (max-width: 60rem) {
  .page__head--aside { grid-template-columns: minmax(0, 1fr); }
  .page__head-image { max-height: 25rem; object-position: left center; }
  .page__title { max-width: 22ch; }
  .person { grid-template-columns: minmax(0, 11rem) minmax(0, 1fr); gap: var(--space-6); }
  .giving__method { grid-template-columns: minmax(0, 11rem) minmax(0, 1fr); }
  .page__related { grid-template-columns: minmax(0, 1fr); }
  .sitemap { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 44rem) {
  .page__head { padding: var(--space-5); }
  .page__title { font-size: clamp(2.6rem, 10vw, 4rem); }
  .page__title--long { font-size: clamp(2rem, 7.5vw, 3rem); }
  .page__head-image { max-height: 21rem; }
  .page__h2, .page__h3, .page__h4 { margin-top: var(--space-7); }
  .page__h2 { font-size: 1.85rem; }
  .page__h3 { font-size: 1.6rem; }
  .page--contact .page__head { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); margin-bottom: var(--space-5); padding: min(1rem, 4vw); }
  .page--contact .page__head .trail { margin-bottom: var(--space-2); }
  .page--contact .page__title { font-size: 2rem; text-transform: none; }
  .page--contact .page__head-image { max-height: 7rem; max-width: 7rem; }
  .page--contact .contact-panel { padding: min(1.5rem, 5vw); gap: var(--space-5); }
  .page--contact .contact-panel__name { font-size: 1.65rem; }
  .tile--pictured { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
  .tile__picture { max-width: 26rem; }
  .tiles--4, .downloads, .hymns, .index-grid, .giving__details, .event-detail, .sitemap { grid-template-columns: minmax(0, 1fr); }
  .figure--portrait { float: none; width: min(17rem, 100%); margin: var(--space-5) 0; }
  .person { grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }
  .person__image { max-width: 14rem; }
  .timeline__item { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
  .book { grid-template-columns: minmax(0, 1fr); }
  .book__cover { max-width: 10rem; }
  .giving__method { grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
  .related-list { grid-template-columns: minmax(0, 1fr); }
  .event { grid-template-columns: 3.5rem minmax(0, 1fr); gap: var(--space-3); }
  .contact-panel__actions { flex-direction: column; align-items: stretch; }
  .contact-panel__actions .button { justify-content: flex-start; text-align: left; }
}
@media (forced-colors: active) {
  .page__head, .callout, .contact-panel, .giving__details, .next-event { border: 1px solid CanvasText; }
  .tile, .person, .download, .hymn, .panel, .verse, .timeline__item, .event-detail, .related-list a { border-color: CanvasText; }
}
@media print {
  .page__related, .plate--church, .page__sermons .cards { display: none !important; }
  .page__head { padding: 0; background: none; }
  .page__head-image { max-height: 12rem; }
  .figure--portrait { float: none; }
}
`;
