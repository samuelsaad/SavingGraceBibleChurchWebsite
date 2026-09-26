/** Astra editorial sermon cards; content and taxonomy links remain server rendered. */
export const cardStyles = `
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2rem;list-style:none;margin:0;padding:0}
.cards>li{display:grid;min-width:0}
.card{position:relative;display:grid;grid-template-rows:auto 1fr auto;min-width:0;border-top:2px solid var(--colour-ink);background:var(--colour-raised)}
.card__plate{position:relative;display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem .65rem;min-height:5.5rem;padding:2rem 1.5rem 1.3rem;background:var(--colour-recessed);color:var(--colour-ink)}
.card__group{position:absolute;top:.6rem;left:1.5rem;font:500 .65rem var(--font-signage);letter-spacing:.12em;text-transform:uppercase;color:var(--colour-ink-soft)}
.card__ordinal{position:absolute;top:.6rem;right:1.5rem;font:500 .7rem var(--font-signage)}
.card__bookname{font:1.7rem/1.15 var(--font-display)}
.card__ref{font:1.1rem/1.15 var(--font-display)}
.card__device,.card__mark{width:2rem;height:2rem}
.card__strip{display:none}
.card__flag{position:absolute;top:0;right:1.5rem;padding:.4rem .7rem;background:var(--colour-ink);color:var(--colour-on-ink);font:.7rem var(--font-signage)}
.card__body{display:grid;align-content:start;gap:.8rem;padding:1.5rem;min-width:0}
.card__top,.card__meta{display:flex;flex-wrap:wrap;gap:.4rem .6rem;font:.8rem/1.5 var(--font-signage);color:var(--colour-ink-soft)}
.card__top a,.card__meta a,.card__booklink{position:relative;z-index:1;color:inherit}
.card__series{color:var(--colour-gilt)}
.card__pill{font-size:.7rem;border:1px dashed var(--colour-rule-strong);padding:.1rem .4rem}
.card__title,.card__title.is-long,.card__title.is-longest{font:1.8rem/1.14 var(--font-display);letter-spacing:-.025em;overflow-wrap:anywhere;text-wrap:pretty}
.card__title a{color:var(--colour-ink);text-decoration:none}
.card__title a::after{content:"";position:absolute;inset:0}
.card:hover .card__title a{text-decoration:underline;text-underline-offset:.15em;text-decoration-thickness:1px}
.card__desc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;line-clamp:4;overflow:hidden;font:1rem/1.65 var(--font-reading);color:var(--colour-ink-soft)}
.card__foot{display:flex;align-items:center;justify-content:space-between;gap:.6rem;min-height:3.25rem;margin:0 1.5rem;border-top:1px solid var(--colour-rule);font:.75rem var(--font-signage)}
.card__cta{color:var(--colour-gilt)}.card__cta::after{content:" ↗"}
.card__booklink{display:inline-flex;align-items:center;min-height:2.75rem;text-decoration:none}
@media(max-width:60rem){.cards{gap:1rem;grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:44rem){.cards{grid-template-columns:minmax(0,1fr);gap:2rem}.card__title,.card__title.is-long,.card__title.is-longest{font-size:1.85rem}}
@media(forced-colors:active){.card{border:1px solid CanvasText}.card__title a::after{display:none}}
@media print{.card{break-inside:avoid}.card__title a::after{display:none}}
`;
