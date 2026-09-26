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


/* ---- Astra: church journal, reading pages and practical information ---- */
.page__head { padding: 1rem 0 3.5rem; margin-bottom: 3.5rem; border-bottom: 1px solid var(--colour-rule); }
.page__head--aside { grid-template-columns: 1.1fr 1fr; gap: 5rem; }
.page__title { max-width: 20ch; letter-spacing: -.045em; font-size: clamp(2.6rem,5.5vw,5rem); line-height: 1.08; }
.page__head .eyebrow { margin-bottom: 1.2rem; }
.page__lede { margin-top: 1.75rem; line-height: 1.8; }
.page__head-image { width: 100%; aspect-ratio: 5 / 4; height: auto; max-height: none; box-shadow: none; border-radius: 0; object-fit: cover; }
.page__banner-image { max-height: 30rem; border-radius: 0; box-shadow: none; }
.page__layout { min-width: 0; }
.page__layout--reading { display: grid; grid-template-columns: 13rem minmax(0,1fr); gap: 5rem; align-items: start; }
.page-contents { position: sticky; top: 2rem; padding: 1.25rem 0; border-top: 1px solid var(--colour-ink); }
.page-contents > p { font-size: .75rem; text-transform: uppercase; letter-spacing: .1em; margin-bottom: .8rem; }
.page-contents ol { list-style: none; padding: 0; margin: 0; }
.page-contents a { display: flex; align-items: center; min-height: var(--target-size); font-size: .85rem; line-height: 1.5; padding: .5rem 0; text-decoration: none; color: var(--colour-ink-soft); }
.page-contents a:hover { color: var(--colour-gilt); text-decoration: underline; }
.page__body { min-width: 0; }
.page__body > p, .page__body > .page__list { font-size: 1.1rem; line-height: 1.85; }
.page__h2 { margin-top: 3.5rem; font-size: clamp(1.8rem,3vw,2.5rem); padding: 0; }
.page__h2::after { display: none; }
.page__h3 { font-size: 1.5rem; margin-top: 2.5rem; }
.page__h4 { letter-spacing: .04em; text-transform: none; }
.verse { background: transparent; border-left: 1px solid var(--colour-gilt); padding: .5rem 0 .5rem 2rem; margin-block: 2.5rem; }
.verse p { font-size: 1.4rem; line-height: 1.65; }
.verse__cite { font-family: var(--font-ui); letter-spacing: .02em; text-transform: none; font-weight: 400; }
.figure__image { box-shadow: none; border-radius: 0; }
.panel, .callout { border-radius: 0; box-shadow: none; padding: 2rem; border: 1px solid var(--colour-rule); border-top: 2px solid var(--colour-ink); }
.panel { background: transparent; }
.callout { margin-block: 3rem; }
.callout__title { font-family: var(--font-display); font-size: 1.5rem; font-weight: 400; letter-spacing: -.02em; text-transform: none; }
.tiles { gap: 3rem 2rem; margin-block: 2.5rem; }
.tile { background: transparent; border: 0; border-radius: 0; box-shadow: none; overflow: visible; }
.tile--linked:hover { transform: none; box-shadow: none; }
.tile--linked:not(.tile--pictured) { border-top: 1px solid var(--colour-rule-strong); padding-top: 1rem; }
.tile__picture { aspect-ratio: 4 / 3; overflow: hidden; }
.tile__image { transition: transform var(--motion-settle) var(--motion-easing); }
.tile--linked:hover .tile__image { transform: scale(1.035); }
.tile__body { padding: 1.5rem 0 0; gap: .8rem; }
.tile__title { font-size: 1.75rem; }
.tile__text { font-family: var(--font-ui); font-size: .95rem; line-height: 1.8; }
.tile__more { font-family: var(--font-ui); letter-spacing: 0; text-transform: none; font-weight: 400; }
.people { gap: 4rem; }
.person { grid-template-columns: minmax(10rem,17rem) minmax(0,1fr); gap: 4rem; padding: 2.5rem 0 0; border: 0; border-top: 1px solid var(--colour-rule); border-radius: 0; background: transparent; box-shadow: none; }
.person__name { font-size: 2.5rem; margin-top: .5rem; }
.person__role { margin: 1rem 0 1.5rem; }
.person__image { border-radius: 50% 50% 0 0; }
.person__text { font-size: 1.05rem; line-height: 1.85; }
.timeline { max-width: 54rem; margin-block: 3rem; border: 0; padding: 0; }
.timeline__item { grid-template-columns: 7rem 1fr; gap: .5rem 2rem; padding: 2rem 0; border-top: 1px solid var(--colour-rule); }
.timeline__item::before { display: none; }
.timeline__when { grid-row: 1 / 3; font-family: var(--font-display); font-size: 1.6rem; letter-spacing: -.02em; }
.timeline__title { font-size: 1.6rem; }
.timeline__text { grid-column: 2; line-height: 1.8; }
.download, .hymn, .giving__method, .giving__bank, .giving__online, .contact-panel, .event-detail__dates, .event-detail__venue { box-shadow: none; border-radius: 0; border-color: var(--colour-rule); }
.download, .hymn { background: transparent; border: 0; border-top: 1px solid var(--colour-rule-strong); padding: 1.5rem 0; }
.index-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 2rem; }
.index-grid__link { padding: 1.25rem 0; border: 0; border-top: 1px solid var(--colour-rule); background: transparent; }
.index-grid__link:hover { box-shadow: none; transform: none; }
.index-grid__text { font-size: .9rem; }
.contact-panel { background: var(--colour-recessed); max-width: 100%; padding: 2.5rem; }
.contact-panel__name { font-size: 2rem; margin-bottom: 1rem; }
.contact-panel__address { line-height: 1.8; }
.giving__method { background: transparent; border-width: 1px 0 0; padding: 1.5rem 0; }
.giving__method-title { text-transform: none; font-family: var(--font-display); letter-spacing: -.02em; font-weight: 400; font-size: 1.6rem; }
.related-list { gap: 0 2rem; }
.related-list a { padding: .75rem 0; border: 0; border-radius: 0; border-bottom: 1px solid var(--colour-rule-strong); background: transparent; }
.related-list a::after { content: "↗"; margin-left: 1.5rem; }
.events { list-style: none; padding: 0; margin: 0; }
.event { display: grid; grid-template-columns: 4.5rem minmax(0,1fr); gap: 1.5rem; padding: 1.5rem 0; border-top: 1px solid var(--colour-rule); }
.event__date { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; color: var(--colour-gilt); }
.event__month { font-size: .7rem; letter-spacing: .12em; }
.event__day { font-family: var(--font-display); font-size: 2.75rem; line-height: 1.2; }
.event__body { display: flex; flex-direction: column; gap: .5rem; }
.event__time { display: flex; gap: .5rem; align-items: center; font-size: .8rem; color: var(--colour-ink-soft); }
.event__title { font-family: var(--font-display); font-size: 1.5rem; line-height: 1.25; }
.event__venue { font-size: .8rem; line-height: 1.6; }
@media (max-width: 60rem) {
 .page__head--aside { grid-template-columns: 1fr 1fr; gap: 2rem; }
 .page__layout--reading { grid-template-columns: 10rem minmax(0,1fr); gap: 2rem; }
 .person { gap: 2rem; grid-template-columns: 12rem minmax(0,1fr); }
 .page__title { font-size: clamp(2.5rem,5.5vw,4rem); }
}
@media (max-width: 44rem) {
 .page__head { padding-top: 0; margin-bottom: 2.5rem; padding-bottom: 2.5rem; }
 .page__head--aside, .page__layout--reading, .person { grid-template-columns: 1fr; }
 .page__head-image { max-height: none; aspect-ratio: 4 / 3; }
 .page-contents { position: static; margin-bottom: 1rem; }
 .page-contents ol { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 1rem; }
 .page__body > p, .page__body > .page__list { font-size: 1rem; line-height: 1.8; }
 .person { gap: 1.5rem; } .person__picture { max-width: 15rem; }
 .timeline__item { grid-template-columns: 4rem minmax(0,1fr); gap: .75rem 1rem; }
 .timeline__when { font-size: 1.2rem; }
 .index-grid { grid-template-columns: 1fr; }
 .event { grid-template-columns: 3rem minmax(0,1fr); gap: 1rem; }
 .event__title { font-size: 1.3rem; }
 .event__time { flex-wrap: wrap; }
 .contact-panel { padding: 1.5rem; }
}
@media print { .page-contents { display: none; } .page__layout--reading { display: block; } }

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
