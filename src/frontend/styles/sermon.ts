/**
 * Sermon page stylesheet: the reading room. A book tab at the left, the
 * reading column in the middle, an "On this page" rail at the right, the
 * video plate, the transcript with margin numerals, the questions and the
 * related sermons.
 */
export const sermonStyles = `
.sermon { display: grid; grid-template-columns: 3.5rem minmax(0, 46rem) 14rem; gap: var(--space-6) var(--space-7); align-items: start; }
.sermon__tab { position: sticky; top: var(--space-4); }
.sermon__body { min-width: 0; }
.sermon__rail { position: sticky; top: var(--space-4); }
.sermon__head { margin-bottom: var(--space-6); }
.sermon__stamp { display: inline-block; margin-bottom: var(--space-3); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--hue, var(--colour-gilt)); }
.sermon__title { max-width: 22ch; font-size: var(--size-title); }
.sermon__title.is-long { font-size: var(--size-card-title); }
.sermon__meta { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--colour-rule); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.sermon__meta a { color: var(--colour-ink-soft); }
.sermon__meta a:hover { color: var(--colour-gilt); }
.sermon__note { font-style: italic; color: var(--colour-ink-muted); }
.rail { display: grid; gap: var(--space-4); }
.rail__title { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--colour-ink-soft); }
.rail__list { display: grid; gap: 2px; list-style: none; margin: 0; padding: 0; }
.rail__list a { display: flex; align-items: center; min-height: 2.25rem; padding: 0 var(--space-3); border-left: 2px solid var(--colour-rule); color: var(--colour-ink-soft); font-size: var(--size-ui); text-decoration: none; }
.rail__list a:hover { color: var(--colour-ink); border-left-color: var(--colour-ink); }
.rail__list a[aria-current="location"] { color: var(--colour-ink); border-left-color: var(--colour-gilt); font-weight: 600; }
.rail__meta { display: grid; gap: var(--space-1); margin: 0; padding-top: var(--space-3); border-top: 1px solid var(--colour-rule); font-size: var(--size-ui); color: var(--colour-ink-soft); }
.rail__meta dt { font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); letter-spacing: 0.08em; text-transform: uppercase; color: var(--colour-ink-muted); }
.rail__meta dd { margin: 0 0 var(--space-2); }
.sermon-section { margin-top: var(--space-7); padding-top: var(--space-4); border-top: 1px solid var(--colour-rule); scroll-margin-top: var(--space-4); }
.sermon-section--description { margin-top: 0; padding-top: 0; border-top: 0; }
.sermon-section .section__title { margin-bottom: var(--space-4); }
.plate { position: relative; max-width: 56rem; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--radius-card); background: var(--colour-ink); color: var(--colour-on-ink); color-scheme: dark; }
.plate__consent { position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; gap: var(--space-3); padding: var(--space-5); text-align: center; }
.plate__mark { width: 2.5rem; height: 2.5rem; }
.plate__title { font-family: var(--font-display); font-size: var(--size-lede); }
.plate__note { max-width: 40ch; font-size: var(--size-ui); color: var(--colour-on-ink-soft); }
.plate__status { position: absolute; inset: 0; display: grid; place-content: center; margin: 0; font-size: var(--size-ui); color: var(--colour-on-ink-soft); }
.plate[data-video-loaded="true"] .plate__status { display: none; }
.plate iframe { display: block; width: 100%; height: 100%; border: 0; }
.media-links { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
.transcript { max-width: var(--measure-transcript); }
.transcript__summary { display: inline-flex; align-items: center; gap: var(--space-3); min-height: var(--target-size); padding: 0 var(--space-4); border: 2px solid var(--colour-ink); border-radius: var(--radius-control); list-style: none; cursor: pointer; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-ui); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.transcript__summary::-webkit-details-marker { display: none; }
.transcript__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.transcript[open] > .transcript__summary::before { transform: rotate(45deg); }
.transcript__label--open, .transcript[open] .transcript__label--closed { display: none; }
.transcript[open] .transcript__label--open { display: inline; }
.transcript__stats { font-weight: 400; letter-spacing: 0.04em; color: var(--colour-ink-soft); }
.transcript__body { margin-top: var(--space-5); counter-reset: paragraph; }
.transcript__body p { position: relative; }
.transcript__body p::before { counter-increment: paragraph; content: counter(paragraph) / ""; position: absolute; left: -3rem; top: 0.35em; width: 2.25rem; text-align: right; font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); color: var(--colour-ink-muted); font-variant-numeric: tabular-nums; }
.transcript__back { margin-top: var(--space-5); font-size: var(--size-ui); }
.transcript__back a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.questions { max-width: var(--measure-prose); list-style: none; margin: 0; padding: 0; }
.question { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr); column-gap: var(--space-3); padding: var(--space-4) 0; border-top: 1px solid var(--colour-rule); }
.question:first-child { padding-top: 0; border-top: 0; }
.question__number { font-family: var(--font-signage); font-stretch: 87.5%; font-size: 1.75rem; font-weight: 700; line-height: 1; color: var(--hue, var(--colour-gilt)); font-variant-numeric: tabular-nums; }
.question__title { font-family: var(--font-display); font-size: var(--size-lede); line-height: 1.25; margin-bottom: var(--space-2); }
.question__answer { grid-column: 2; }
@media (max-width: 76rem) {
  .sermon { grid-template-columns: 3.5rem minmax(0, 1fr); }
  .sermon__rail { position: static; grid-column: 2; order: 2; }
  .sermon__body { order: 3; }
  .rail__contents { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); }
  .rail__list { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-2); }
  .rail__list a { min-height: 2rem; padding: 0 var(--space-2); border-left: 0; border-bottom: 2px solid var(--colour-rule); }
  .rail__list a:hover { border-bottom-color: var(--colour-ink); }
  .rail__list a[aria-current="location"] { border-bottom-color: var(--colour-gilt); }
  .rail__meta { display: none; }
}
@media (max-width: 60rem) {
  .sermon { grid-template-columns: minmax(0, 1fr); }
  .sermon__tab { position: static; }
  .sermon__tab .tab { flex-direction: row; width: 100%; min-height: 2.75rem; padding: 0 var(--space-3); }
  .sermon__tab .tab__name { writing-mode: horizontal-tb; transform: none; }
  .sermon__rail { grid-column: auto; }
  .rail { grid-template-columns: minmax(0, 1fr); }
  .transcript__body p::before { display: none; }
}
@media (max-width: 44rem) {
  .sermon__title { font-size: clamp(1.75rem, 1.2rem + 3vw, 2.25rem); }
  .sermon__title.is-long { font-size: var(--size-h3); }
  .sermon-section { margin-top: var(--space-6); }
  .question { grid-template-columns: 2rem minmax(0, 1fr); }
  .question__number { font-size: 1.375rem; }
}
`;
