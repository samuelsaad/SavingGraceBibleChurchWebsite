/**
 * Church page stylesheet: the page head (trail, eyebrow, title, lede) with
 * its aside picture or full banner, the reading column of blocks (prose,
 * lists, verses, figures, callouts, panels), the tile grids, person cards,
 * the history timeline, the next-event line, video and external plates,
 * downloads, hymns, the doctrinal index, the giving panel, the contact
 * panel, the events pages, the blog and the sitemap. Every colour and
 * rhythm value is a token.
 */
export const churchStyles = `
/* ---- page head ---- */
.page { max-width: var(--measure-page); }
.page__head { display: grid; gap: var(--space-4); max-width: var(--measure-page); margin-bottom: var(--space-6); }
.page__head--aside { grid-template-columns: minmax(0, 7fr) minmax(16rem, 4fr); gap: var(--space-6) var(--space-8); align-items: center; }
.page__head-text { min-width: 0; }
.page__head .trail { margin-bottom: var(--space-4); }
.page__head .eyebrow { margin-bottom: var(--space-3); }
.page__title { max-width: 22ch; font-size: var(--size-display); line-height: var(--size-line-tight); letter-spacing: -0.01em; }
.page--post .page__title, .page--event .page__title { font-size: var(--size-title); }
.page__lede { max-width: 60ch; margin-top: var(--space-4); }
.page__status { display: inline-flex; align-items: center; min-height: 2rem; margin-top: var(--space-4); padding: 0 0.75rem; border: 1px dashed var(--colour-rule-strong); border-radius: var(--radius-control); background: var(--colour-gilt-soft); color: var(--colour-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.page__head-picture { min-width: 0; }
.page__head-image { display: block; width: 100%; height: auto; max-height: 26rem; object-fit: cover; border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.page__banner { margin: 0 0 var(--space-7); }
.page__banner-image { display: block; width: 100%; height: auto; max-height: 24rem; object-fit: cover; border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.page__badge { display: inline-flex; align-items: center; min-height: 1.5rem; margin-left: var(--space-2); padding: 0 0.5rem; border: 1px dashed var(--colour-rule-strong); border-radius: var(--radius-cell); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-muted); }

/* ---- the reading column ---- */
.page__body { max-width: var(--measure-page); }
.page__body > p, .page__body > .page__list, .page__body > .verse, .page__body > .book, .page__body .panel > p { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.page__body > p { margin: 0 0 1em; }
.page__body > p.lede { max-width: 60ch; margin-bottom: var(--space-5); }
.page__h2, .page__h3, .page__h4 { margin: var(--space-7) 0 var(--space-3); font-family: var(--font-display); color: var(--colour-ink); scroll-margin-top: var(--space-5); }
.page__h2 { position: relative; padding-bottom: var(--space-2); font-size: var(--size-card-title); line-height: 1.15; }
.page__h2::after { content: ""; position: absolute; left: 0; bottom: 0; width: 3rem; height: 2px; background: var(--colour-gilt); }
.page__h3 { font-size: var(--size-h3); line-height: 1.2; margin-top: var(--space-6); }
.page__h4 { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); margin-top: var(--space-5); }
.page__body > .page__h2:first-child, .page__body > .page__h3:first-child { margin-top: 0; }
.page__list { margin: 0 0 1.2em; padding-left: 1.4em; }
.page__list li { margin-bottom: 0.45em; padding-left: 0.2em; }
.page__list li::marker { color: var(--colour-gilt); font-family: var(--font-signage); font-weight: 700; }
.page__body a.external::after { content: " ↗"; font-size: 0.8em; }
.page__body a.external.button::after { content: none; }
.verse { position: relative; margin: var(--space-5) 0; padding: var(--space-4) var(--space-5); border-left: 3px solid var(--colour-gilt); background: var(--colour-raised); border-radius: 0 var(--radius-card) var(--radius-card) 0; }
.verse p { margin: 0; font-family: var(--font-display); font-style: italic; font-size: var(--size-lede); line-height: 1.45; text-wrap: pretty; }
.verse__cite { margin-top: var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-gilt); }
.figure { margin: var(--space-5) 0; }
.figure__image { display: block; max-width: 100%; height: auto; border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.figure--full .figure__image { width: 100%; }
.figure--inset { max-width: 36rem; }
.figure--inset .figure__image { width: 100%; }
.figure--portrait { float: right; width: min(18rem, 40%); margin: 0 0 var(--space-4) var(--space-6); }
.figure--portrait .figure__image { width: 100%; }
.figure__caption { margin-top: var(--space-2); font-size: var(--size-small); color: var(--colour-ink-soft); }
.callout { clear: both; max-width: var(--measure-prose); margin: var(--space-7) 0; padding: var(--space-5); background: var(--colour-recessed); border-radius: var(--radius-card); border-left: 4px solid var(--colour-ink); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.6; }
.callout__title { margin-bottom: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-ink); }
.panel { max-width: var(--measure-prose); margin: var(--space-4) 0 var(--space-6); padding: var(--space-6); background: var(--colour-raised); border: 1px solid var(--colour-rule); border-top: 4px solid var(--colour-gilt); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.panel p { margin: 0 0 1em; }
.panel p:last-child { margin-bottom: 0; }
.panel__title { margin-bottom: var(--space-4); font-family: var(--font-display); font-size: var(--size-h3); }

/* ---- tiles ---- */
.tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-5); clear: both; margin: var(--space-6) 0; padding: 0; list-style: none; }
.tiles--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.tiles--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.tile { position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); overflow: hidden; transition: box-shadow var(--motion-duration) var(--motion-easing), transform var(--motion-duration) var(--motion-easing), border-color var(--motion-duration) var(--motion-easing); }
.tile--linked:hover { border-color: var(--colour-rule-strong); box-shadow: var(--shadow-lift); transform: translateY(-2px); }
.tile--linked:focus-within { border-color: var(--colour-ink); }
.tile__picture { aspect-ratio: 16 / 9; background: var(--colour-recessed); }
.tile__image { display: block; width: 100%; height: 100%; object-fit: cover; }
.tile__body { display: grid; align-content: start; gap: var(--space-2); padding: var(--space-4) var(--space-4) var(--space-4); }
.tile__eyebrow { font-size: var(--size-small); }
.tile__title { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.tile__title a { color: var(--colour-ink); text-decoration: none; }
.tile--linked .tile__title a::after { content: ""; position: absolute; inset: 0; }
.tile--linked:hover .tile__title a { color: var(--colour-gilt); text-decoration: underline; text-decoration-color: var(--colour-gilt); }
.tile__text { font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.5; color: var(--colour-ink-soft); }
.tile__text--clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.tile__more { display: inline-flex; align-items: center; justify-self: start; min-height: var(--target-size); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
a.tile__more { position: relative; z-index: 1; color: var(--colour-gilt); text-decoration: none; }
a.tile__more::after { content: " →"; }
a.tile__more:hover { text-decoration: underline; }
.tile--linked:not(.tile--pictured) { border-top: 4px solid var(--colour-gilt); }

/* ---- people ---- */
.people { display: grid; gap: var(--space-6); clear: both; margin: var(--space-6) 0; padding: 0; list-style: none; }
.person { display: grid; grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr); gap: var(--space-5) var(--space-6); align-items: start; padding: var(--space-5); background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.person__image { display: block; width: 100%; height: auto; border-radius: var(--radius-card); }
.person__body { min-width: 0; }
.person__name { font-family: var(--font-display); font-size: var(--size-card-title); line-height: 1.1; }
.person__role { margin: var(--space-1) 0 var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--colour-gilt); }
.person__text { max-width: var(--measure-prose); margin: 0 0 0.9em; font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.person__contact { margin-top: var(--space-3); font-size: var(--size-ui); overflow-wrap: anywhere; }

/* ---- timeline ---- */
.timeline { position: relative; clear: both; max-width: var(--measure-prose); margin: var(--space-5) 0 var(--space-7); padding: 0 0 0 1.25rem; list-style: none; border-left: 2px solid var(--colour-rule-strong); }
.timeline__item { position: relative; display: grid; gap: var(--space-1); padding: 0 0 var(--space-5) var(--space-5); }
.timeline__item::before { content: ""; position: absolute; left: calc(-1.25rem - 7px); top: 0.55rem; width: 12px; height: 12px; border-radius: 50%; background: var(--colour-gilt); box-shadow: 0 0 0 3px var(--colour-ground); }
.timeline__when { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--colour-gilt); font-variant-numeric: tabular-nums; }
.timeline__title { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.timeline__text { font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.55; color: var(--colour-ink-soft); }

/* ---- next event ---- */
.next-event { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-3); max-width: var(--measure-prose); margin: 0 0 var(--space-5); padding: var(--space-3) var(--space-4); border: 1px solid var(--colour-gilt); border-radius: var(--radius-control); background: var(--colour-gilt-soft); font-size: var(--size-ui); }
.next-event__label { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-gilt); }
.next-event__link { display: inline-flex; align-items: center; min-height: 2rem; font-family: var(--font-display); font-size: var(--size-lede); color: var(--colour-ink); font-variant-numeric: tabular-nums; }

/* ---- plates (video, playlist, external) ---- */
.plate--church { max-width: var(--measure-prose); margin: var(--space-4) 0 var(--space-6); }
.plate--external { aspect-ratio: auto; min-height: 12rem; }
.plate--external .plate__consent { position: static; }
.plate__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-3); margin: 0; }
.plate__external { color: var(--colour-on-ink); text-decoration-color: var(--colour-gilt-bright); }
.plate__external:hover { color: var(--colour-gilt-bright); }

/* ---- downloads, hymns, index, book ---- */
.downloads, .hymns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); clear: both; margin: var(--space-5) 0 var(--space-6); padding: 0; list-style: none; }
.download, .hymn { display: grid; align-content: start; gap: var(--space-2); padding: var(--space-5); background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.download__title, .hymn__title { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.download__text, .hymn__text { font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.5; color: var(--colour-ink-soft); }
.download__link { margin-top: var(--space-2); }
.download__link .button { text-align: left; }
.hymn__link { display: inline-flex; align-items: center; min-height: var(--target-size); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-gilt); text-decoration: none; }
.hymn__link:hover { text-decoration: underline; }
.index-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin: var(--space-4) 0 var(--space-7); padding: 0; list-style: none; }
.index-grid__link { display: grid; gap: var(--space-1); height: 100%; padding: var(--space-4); background: var(--colour-raised); border: 1px solid var(--colour-rule); border-top: 3px solid var(--colour-gilt); border-radius: var(--radius-card); color: var(--colour-ink); text-decoration: none; transition: box-shadow var(--motion-duration) var(--motion-easing), transform var(--motion-duration) var(--motion-easing); }
.index-grid__link:hover { box-shadow: var(--shadow-lift); transform: translateY(-2px); color: var(--colour-ink); }
.index-grid__title { font-family: var(--font-display); font-size: var(--size-h3); line-height: 1.15; }
.index-grid__text { font-family: var(--font-reading); font-style: italic; font-size: var(--size-ui); line-height: 1.45; color: var(--colour-ink-soft); }
.book { display: grid; grid-template-columns: minmax(8rem, 11rem) minmax(0, 1fr); gap: var(--space-5); align-items: start; margin: var(--space-4) 0 var(--space-6); }
.book__cover { display: block; width: 100%; height: auto; border-radius: var(--radius-cell); box-shadow: var(--shadow-card); }
.book__text p { margin: 0 0 0.9em; font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }

/* ---- giving and contact ---- */
.giving { clear: both; margin-bottom: var(--space-6); }
.giving__intro { max-width: var(--measure-prose); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.6; }
.giving__cta { margin: var(--space-4) 0 var(--space-6); }
.giving__methods { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); margin: 0 0 var(--space-5); padding: 0; list-style: none; }
.giving__method, .giving__bank, .giving__online { padding: var(--space-5); background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.55; }
.giving__method-title { margin-bottom: var(--space-2); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-gilt); }
.giving__details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.giving__bank { border-top: 4px solid var(--colour-ink); }
.giving__online .page__list { margin: 0; }
.contact-panel { display: grid; gap: var(--space-4); max-width: var(--measure-prose); margin: 0 0 var(--space-6); padding: var(--space-6); background: var(--colour-raised); border-top: 4px solid var(--colour-gilt); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.contact-panel__address { display: grid; gap: 0.2rem; font-style: normal; font-family: var(--font-reading); font-size: var(--size-reading); line-height: 1.5; }
.contact-panel__name { font-family: var(--font-display); font-size: var(--size-h3); }
.contact-panel__actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }

/* ---- events ---- */
.event__venue { font-size: var(--size-small); color: var(--colour-ink-muted); }
.event__title a { color: var(--colour-ink); text-decoration: none; }
.event__title a:hover { color: var(--colour-gilt); text-decoration: underline; }
.event-detail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); margin-bottom: var(--space-6); }
.event-detail__dates, .event-detail__venue { padding: var(--space-5); background: var(--colour-raised); border: 1px solid var(--colour-rule); border-radius: var(--radius-card); box-shadow: var(--shadow-card); }
.event-detail .page__h2 { margin-top: 0; font-size: var(--size-h3); }
.event-detail .page__list { margin-bottom: 0; font-variant-numeric: tabular-nums; }
.event-detail__ministry { margin: var(--space-5) 0; }
.past-events { max-width: var(--measure-prose); margin: 0; padding: 0; list-style: none; }
.past-events li { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3); padding: var(--space-3) 0; border-top: 1px solid var(--colour-rule); }
.past-events__when { color: var(--colour-ink-muted); font-size: var(--size-ui); }

/* ---- related, sermons, blog, sitemap ---- */
.page__related { clear: both; margin-top: var(--space-8); padding-top: var(--space-5); border-top: 1px solid var(--colour-rule); }
.related-list { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-4) 0 0; padding: 0; list-style: none; }
.related-list a { display: inline-flex; align-items: center; min-height: var(--target-size); padding: 0 0.9rem; border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-pill); background: var(--colour-raised); color: var(--colour-ink); text-decoration: none; }
.related-list a:hover { border-color: var(--colour-ink); background: var(--colour-recessed); }
.page__sermons { clear: both; margin: var(--space-7) 0; }
.page__sermons > p { max-width: var(--measure-prose); margin: 0 0 var(--space-5); font-family: var(--font-reading); font-size: var(--size-reading); line-height: var(--size-line-reading); }
.page__sermons .cards { margin-bottom: var(--space-5); }
.page__back { margin-top: var(--space-6); }
.sitemap { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-5) var(--space-7); }
.sitemap__group .page__h2 { margin-top: 0; font-size: var(--size-h3); }
.sitemap .page__list { list-style: none; padding: 0; }
.sitemap .page__list a { display: inline-flex; align-items: center; min-height: 2.25rem; }

/* ---- responsive ---- */
@media (max-width: 76rem) {
  .index-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tiles--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 60rem) {
  .page__head--aside { grid-template-columns: minmax(0, 1fr); }
  .page__head-image { max-height: 20rem; }
  .tiles, .tiles--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .giving__methods { grid-template-columns: minmax(0, 1fr); }
  .giving__details { grid-template-columns: minmax(0, 1fr); }
  .sitemap { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .event-detail { grid-template-columns: minmax(0, 1fr); }
  .person { grid-template-columns: minmax(8rem, 10rem) minmax(0, 1fr); }
}
@media (max-width: 44rem) {
  .page__title { font-size: var(--size-title); }
  .tiles, .tiles--2, .tiles--4 { grid-template-columns: minmax(0, 1fr); }
  .downloads, .hymns { grid-template-columns: minmax(0, 1fr); }
  .index-grid { grid-template-columns: minmax(0, 1fr); }
  .figure--portrait { float: none; width: min(18rem, 100%); margin: var(--space-4) 0; }
  .person { grid-template-columns: minmax(0, 1fr); }
  .person__image { max-width: 14rem; }
  .book { grid-template-columns: minmax(0, 1fr); }
  .book__cover { max-width: 10rem; }
  .sitemap { grid-template-columns: minmax(0, 1fr); }
  .page__banner { margin-bottom: var(--space-5); }
  .page__banner-image, .page__head-image { max-height: 16rem; }
}
@media (forced-colors: active) {
  .tile, .person, .download, .hymn, .panel, .callout, .contact-panel, .giving__method, .giving__bank, .giving__online, .event-detail__dates, .event-detail__venue, .next-event { border: 1px solid CanvasText; }
  .timeline__item::before { background: CanvasText; }
  .page__h2::after { background: CanvasText; }
}
@media print {
  .page__related, .plate--church, .page__sermons .cards { display: none !important; }
  .page__banner-image, .page__head-image { max-height: 12rem; }
  .figure--portrait { float: none; }
}
`;
