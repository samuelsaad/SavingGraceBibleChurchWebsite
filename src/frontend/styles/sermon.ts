/**
 * Sermon detail stylesheet: the title block, description, controlled media,
 * transcript disclosure, questions and related sermons.
 */
export const sermonStyles = `
.sermon__head { max-width: 46rem; margin-bottom: var(--space-6); }
.sermon__kicker { margin-bottom: var(--space-2); font-size: var(--size-sm); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--colour-ember); }
.sermon__series a { font-style: italic; }
.on-page { margin: calc(var(--space-4) * -1) 0 var(--space-6); }
.on-page__list { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); list-style: none; margin: 0; padding: 0; font-size: var(--size-sm); }
.on-page__list a { display: inline-flex; align-items: center; min-height: var(--target-size); }
.sermon__title { font-size: var(--size-3xl); }
.sermon__meta { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--colour-rule); font-size: var(--size-sm); color: var(--colour-ink-soft); }
.sermon__meta a { color: var(--colour-ink-soft); }
.sermon__meta a:hover { color: var(--colour-accent); }
.sermon__label { color: var(--colour-ink-muted); }
.sermon-section { margin-top: var(--space-7); padding-top: var(--space-4); border-top: 1px solid var(--colour-rule); }
.sermon-section h2 { margin-bottom: var(--space-4); }
.sermon-section--description { margin-top: 0; padding-top: 0; border-top: 0; }
.video-frame { position: relative; max-width: 56rem; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--radius-frame); background: var(--colour-ink-surface); color: var(--colour-on-ink); box-shadow: var(--shadow-frame); }
.video-frame__consent { position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; gap: var(--space-2); padding: var(--space-5); text-align: center; }
.video-frame__title { font-family: var(--font-serif); font-size: var(--size-lg); }
.video-frame__note { max-width: 40ch; font-size: var(--size-sm); color: var(--colour-on-ink-soft); }
.video-frame__consent .button { margin-top: var(--space-2); }
.video-frame iframe { display: block; width: 100%; height: 100%; border: 0; }
.media-links { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
.transcript { max-width: var(--measure-transcript); }
.transcript__summary { display: inline-flex; align-items: center; gap: var(--space-2); min-height: var(--target-size); padding: 0 var(--space-4); border: 1px solid var(--colour-rule-strong); border-radius: var(--radius-control); list-style: none; cursor: pointer; color: var(--colour-accent); font-size: var(--size-sm); font-weight: 600; }
.transcript__summary::-webkit-details-marker { display: none; }
.transcript__summary::before { content: ""; flex: none; width: 0.45em; height: 0.45em; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-duration) var(--motion-easing); }
.transcript[open] > .transcript__summary::before { transform: rotate(45deg); }
.transcript[open] > .transcript__summary { margin-bottom: var(--space-5); }
.transcript__body { max-width: var(--measure-transcript); }
.transcript__back { margin-top: var(--space-5); font-size: var(--size-sm); }
.sermon__note { color: var(--colour-ink-muted); font-style: italic; }
.video-frame__status { position: absolute; inset: 0; display: grid; place-content: center; margin: 0; font-size: var(--size-sm); color: var(--colour-on-ink-soft); }
.video-frame[data-video-loaded="true"] .video-frame__status { display: none; }
.qa-list { max-width: var(--measure-prose); list-style: none; margin: 0; padding: 0; }
.qa-item { padding: var(--space-4) 0; border-top: 1px solid var(--colour-rule); }
.qa-item:first-child { padding-top: 0; border-top: 0; }
.qa-item__question { display: flex; gap: var(--space-3); margin-bottom: var(--space-2); font-size: var(--size-lg); }
.qa-item__number { flex: none; padding-top: 0.3em; font-family: var(--font-sans); font-size: var(--size-sm); font-weight: 600; color: var(--colour-ember); }
@media (max-width: 44rem) {
  .sermon__title { font-size: var(--size-2xl); }
  .sermon-section { margin-top: var(--space-6); }
}
`;
