import { ZodError } from "zod";
import { createHash } from "node:crypto";
import {
  publicSermonListQuerySchema,
  type PublicSermonListQuery
} from "../../api/contracts/public-sermons";
import {
  InvalidLegacySermonQueryError,
  translateLegacySermonQuery
} from "../../api/legacy-sermon-query";
import type { RelatedSermonSummary, SermonDetail, SermonSummary } from "../../domain/sermon";
import { bibleBookBySlug, bibleBooks, passageQueryLabel } from "../../domain/bible-passage";
import { resolveYouTubeIdentity } from "../../domain/youtube";
import type {
  PublicSermonFilterOption,
  PublicSermonFilterOptions,
  PublicSermonRepository,
  PublicSeriesRepresentative
} from "../repositories/sermon-repository";

const canonicalOrigin = "https://www.savinggrace.org.au";
const archivePath = "/sermons/";
const archivePageSize = 9;

export interface FrontendRenderContext {
  mode: "public" | "preview";
  basePath: "" | "/frontend-preview";
}

export const publicRenderContext: FrontendRenderContext = Object.freeze({ mode: "public", basePath: "" });
export const previewRenderContext: FrontendRenderContext = Object.freeze({ mode: "preview", basePath: "/frontend-preview" });

function contextualPath(context: FrontendRenderContext, path: string): string {
  if (context.mode === "public") return path;
  return path === "/" ? `${context.basePath}/` : `${context.basePath}${path}`;
}

const baseResponseHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff"
};

const archiveEnhancementScript = `(function(){const form=document.querySelector('[data-sermon-search-form]');const advanced=document.querySelector('[data-advanced-search]');const broadBook=document.querySelector('#book-filter');const book=document.querySelector('#passage-book');const chapter=document.querySelector('#passage-chapter');const verse=document.querySelector('#passage-verse');const chapterField=document.querySelector('[data-passage-chapter-field]');const verseField=document.querySelector('[data-passage-verse-field]');let bookOrigin=form?.getAttribute('data-book-origin')||'none';const reopenAdvanced=()=>{if(advanced?.getAttribute('data-active')==='true')advanced.open=true;};const fill=(select,values,label)=>{select.replaceChildren(new Option(label,''));for(const value of values)select.add(new Option(String(value),String(value)));};const chapters=()=>Array.from({length:Number(book?.selectedOptions[0]?.dataset.chapters||0)},(_,index)=>index+1);const verifiedVerses=()=>{const item=Array.from(document.querySelectorAll('[data-passage-availability]')).find(candidate=>candidate.getAttribute('data-book')===book?.value&&candidate.getAttribute('data-chapter')===chapter?.value);return (item?.getAttribute('data-verses')||'').split(',').map(Number).filter(Number.isInteger);};const resetChapterAndVerse=()=>{if(chapter)fill(chapter,chapters(),'Choose a chapter');if(verse)fill(verse,[],'Choose a verse');if(chapterField)chapterField.hidden=!book?.value;if(verseField)verseField.hidden=true;if(chapter)chapter.disabled=!book?.value;if(verse)verse.disabled=true;};const resetVerse=()=>{if(!verse)return;const values=verifiedVerses();fill(verse,values,values.length?'Choose a verse':'Verse data unavailable');verse.disabled=values.length===0;if(verseField)verseField.hidden=!chapter?.value;};const syncBroadFromExact=()=>{if(!broadBook||!book)return;broadBook.value=Array.from(broadBook.options).some(option=>option.value===book.value)?book.value:'';};const syncExactFromBroad=()=>{if(!broadBook||!book)return;book.value=Array.from(book.options).some(option=>option.value===broadBook.value)?broadBook.value:'';resetChapterAndVerse();};if(form&&book&&chapter&&verse){if(bookOrigin==='broad'){syncExactFromBroad();}else if(bookOrigin==='exact'){syncBroadFromExact();}broadBook?.addEventListener('change',()=>{bookOrigin='broad';syncExactFromBroad();});book.addEventListener('change',()=>{bookOrigin='exact';syncBroadFromExact();resetChapterAndVerse();});chapter.addEventListener('change',()=>{bookOrigin='exact';syncBroadFromExact();resetVerse();});verse.addEventListener('change',()=>{bookOrigin='exact';syncBroadFromExact();});form.addEventListener('submit',()=>{if(broadBook)broadBook.disabled=false;book.disabled=false;if(bookOrigin==='exact'&&book.value&&broadBook)broadBook.disabled=true;if(bookOrigin==='broad'&&broadBook?.value)book.disabled=true;});window.addEventListener('pageshow',()=>{if(broadBook)broadBook.disabled=false;book.disabled=false;chapter.disabled=!book.value;verse.disabled=!chapter.value||verifiedVerses().length===0;reopenAdvanced();});}for(const carousel of document.querySelectorAll('[data-carousel]')){const track=carousel.querySelector('[data-carousel-track]');const previous=carousel.querySelector('[data-carousel-previous]');const next=carousel.querySelector('[data-carousel-next]');if(!track||!previous||!next)continue;previous.hidden=false;next.hidden=false;const update=()=>{previous.disabled=track.scrollLeft<=1;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-1;};const move=direction=>track.scrollBy({left:direction*track.clientWidth*.82,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));track.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);update();}reopenAdvanced();})();`;
const videoEnhancementScript = `(function(){for(const button of document.querySelectorAll('[data-load-youtube]'))button.addEventListener('click',()=>{const frame=button.closest('[data-video-frame]');const id=button.getAttribute('data-video-id');const title=button.getAttribute('data-video-title')||'Sermon video';if(!frame||!/^[A-Za-z0-9_-]{11}$/.test(id||''))return;const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+id;iframe.title=title;iframe.loading='lazy';iframe.allow='accelerometer; encrypted-media; gyroscope; picture-in-picture';iframe.allowFullscreen=true;frame.replaceChildren(iframe);});})();`;
const passageScriptHash = createHash("sha256").update(archiveEnhancementScript).digest("base64");
const videoScriptHash = createHash("sha256").update(videoEnhancementScript).digest("base64");

export function frontendResponseHeaders(
  options: { passageScript?: boolean; videoScript?: boolean } = {},
  privatePreview = false
): Record<string, string> {
  const scriptHashes = [
    options.passageScript ? `'sha256-${passageScriptHash}'` : "",
    options.videoScript ? `'sha256-${videoScriptHash}'` : ""
  ].filter(Boolean);
  return {
    ...baseResponseHeaders,
    ...(privatePreview ? {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    } : {}),
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline';${scriptHashes.length ? ` script-src ${scriptHashes.join(" ")};` : ""} img-src 'self' data:; frame-src https://www.youtube-nocookie.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function plainTextMarkup(value: string): string {
  return value
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T12:00:00Z`));
}

function archivePagePath(page: number, context = publicRenderContext): string {
  return contextualPath(context, page <= 1 ? archivePath : `/sermons/page/${page}/`);
}

function filterUrl(name: string, value: string, context = publicRenderContext): string {
  const parameters = new URLSearchParams({ [name]: value });
  return `${contextualPath(context, archivePath)}?${parameters.toString()}`;
}

function commonStyles(): string {
  return `
      :root{--ink:#1d2721;--muted:#5f6b64;--forest:#173f31;--forest-2:#245a44;--moss:#71826f;--linen:#f6f1e7;--paper:#fffdf8;--cream:#ece3d2;--bronze:#945d20;--line:#d9d1c3;--focus:#155f9e;--shadow:0 1.1rem 3.2rem rgba(35,48,40,.09);--radius-sm:.55rem;--radius-md:1rem;--radius-lg:1.6rem;--page:min(76rem,calc(100% - 2rem));font-family:"Segoe UI",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:var(--ink);background:var(--linen);line-height:1.62;color-scheme:light}
      *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-width:320px;overflow-x:hidden;background:radial-gradient(circle at 8% 4%,rgba(165,108,42,.08),transparent 24rem),var(--linen)}a{color:var(--forest-2);text-decoration-thickness:.08em;text-underline-offset:.18em}a:hover{text-decoration-thickness:.14em}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:.2rem solid var(--focus);outline-offset:.22rem}.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      .preview-banner{margin:0;padding:.65rem 1rem;background:#7b4b15;color:#fff;text-align:center;font-size:.88rem;font-weight:750;letter-spacing:.02em}.site-header-wrap{position:relative;z-index:10;background:rgba(255,253,248,.96);border-bottom:1px solid var(--line)}.site-header{width:var(--page);margin:auto;min-height:5.25rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem}.brand{display:flex;align-items:center;gap:.75rem;color:var(--forest);font-family:Georgia,"Times New Roman",serif;font-size:clamp(1rem,2.3vw,1.28rem);font-weight:700;line-height:1.15;text-decoration:none}.brand-mark{display:grid;place-items:center;width:2.55rem;height:2.55rem;border:1px solid var(--bronze);border-radius:50%;font-size:.72rem;letter-spacing:.06em}.desktop-nav{display:flex;align-items:center;gap:1.15rem}.desktop-nav a{color:var(--ink);font-size:.93rem;font-weight:700;text-decoration:none}.desktop-nav a:hover{color:var(--forest-2)}.mobile-nav{display:none;position:relative}.mobile-nav summary{list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:var(--radius-sm);padding:.6rem .8rem;font-weight:800}.mobile-nav summary::-webkit-details-marker{display:none}.mobile-nav nav{position:absolute;right:0;top:calc(100% + .5rem);width:min(18rem,calc(100vw - 2rem));display:grid;padding:.6rem;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--paper);box-shadow:var(--shadow)}.mobile-nav a{padding:.75rem;border-radius:.45rem;color:var(--ink);font-weight:700;text-decoration:none}.mobile-nav a:hover{background:var(--linen)}
      main{width:var(--page);margin:auto;padding:clamp(2.2rem,6vw,5rem) 0 6rem}h1,h2,h3{font-family:Georgia,"Times New Roman",serif;line-height:1.12;color:var(--forest);text-wrap:balance}h1{max-width:18ch;margin:.45rem 0 1rem;font-size:clamp(2.45rem,7.5vw,5.6rem);font-weight:500;letter-spacing:-.035em}h2{margin:0 0 1rem;font-size:clamp(1.65rem,4vw,2.65rem);font-weight:500;letter-spacing:-.02em}h3{font-size:1.3rem}p{max-width:72ch}.eyebrow{margin:0;color:var(--bronze);font-size:.74rem;font-weight:850;letter-spacing:.15em;text-transform:uppercase}.lede{font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.1rem,2.4vw,1.42rem);line-height:1.55;color:#3c4941}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:0 0 1.3rem}.section-heading p{margin:0;color:var(--muted)}
      .hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(17rem,.8fr);gap:clamp(2rem,6vw,5rem);align-items:center;padding:clamp(2rem,6vw,5rem);margin:-1rem 0 4rem;border:1px solid #cfc4b1;border-radius:var(--radius-lg);background:linear-gradient(135deg,#fffdf8 0 59%,#e7ddca 59%);box-shadow:var(--shadow)}.hero::after{content:"";position:absolute;right:-5rem;bottom:-8rem;width:21rem;height:21rem;border:1px solid rgba(165,108,42,.32);border-radius:50%;box-shadow:0 0 0 2rem rgba(255,255,255,.16),0 0 0 4rem rgba(165,108,42,.07)}.hero-copy{position:relative;z-index:1}.hero-actions,.filter-actions{display:flex;align-items:center;flex-wrap:wrap;gap:.75rem;margin-top:1.35rem}.hero-note{position:relative;z-index:1;padding:1.4rem;border-left:.22rem solid var(--bronze);background:rgba(255,253,248,.83)}.hero-note strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:1.25rem;color:var(--forest)}
      .button{display:inline-flex;align-items:center;justify-content:center;min-height:2.9rem;padding:.68rem 1.05rem;border:1px solid var(--forest);border-radius:var(--radius-sm);background:var(--forest);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}.button:hover{background:#0e3024}.button:disabled{cursor:not-allowed;opacity:.48}.button-secondary{border-color:#9aaa9f;background:transparent;color:var(--forest)}.button-secondary:hover{background:var(--paper)}
      .panel,.sermon-card,.landscape-card,.content-section,.related-card,.taxonomy-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 .45rem 1.4rem rgba(35,48,40,.045)}.panel{padding:clamp(1.15rem,3vw,1.75rem)}.filter-primary{display:grid;grid-template-columns:minmax(13rem,1.45fr) repeat(3,minmax(9rem,1fr));gap:.85rem;align-items:end}.filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem}.filter-grid>.wide{grid-column:1/-1}.filter-field{display:grid;gap:.35rem;min-width:0}.filter-field label{font-size:.86rem;font-weight:800}.filter-field input,.filter-field select{width:100%;min-height:2.9rem;border:1px solid #96a198;border-radius:var(--radius-sm);background:#fff;color:var(--ink);padding:.62rem .72rem;font:inherit}.filter-field select:disabled{background:#eceeea;color:#6c746f}.advanced-search{margin-top:1rem;border-top:1px solid var(--line)}.advanced-search summary{width:max-content;max-width:100%;cursor:pointer;padding:1rem .15rem .35rem;color:var(--forest);font-weight:850}.advanced-search[open] summary{margin-bottom:.8rem}.advanced-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.passage-search{grid-column:1/-1;border:1px solid #c1c9c2;border-radius:.8rem;padding:1rem;margin:.25rem 0 0}.passage-search legend{padding:0 .4rem;color:var(--forest);font-weight:850}.passage-cascade{display:flex;align-items:end;gap:1rem}.passage-cascade>.filter-field{flex:1}.field-hint{color:var(--muted);margin:.1rem 0 .75rem}.active-filters{display:flex;flex-wrap:wrap;gap:.5rem;padding:0;list-style:none}.active-filters li,.tag{display:inline-block;border:1px solid #ccd4cd;border-radius:999px;background:#eef2ed;padding:.28rem .62rem;font-size:.88rem}.result-status{margin:1.7rem 0;font-weight:750}
      .sermon-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.15rem}.sermon-card{min-width:0;display:flex;flex-direction:column;gap:.75rem;padding:1.35rem;transition:transform .18s ease,box-shadow .18s ease}.sermon-card:hover,.landscape-card:hover{transform:translateY(-.2rem);box-shadow:var(--shadow)}.sermon-card h2,.sermon-card h3{margin:0;font-size:clamp(1.3rem,2.7vw,1.65rem)}.sermon-card h2 a,.sermon-card h3 a{color:var(--forest);text-decoration:none}.sermon-card p{margin:0}.card-meta{color:var(--muted);font-size:.91rem}.card-description{display:-webkit-box;overflow:hidden;color:#34423a;-webkit-box-orient:vertical;-webkit-line-clamp:4}.card-link{margin-top:auto;font-weight:800}.tag-list{display:flex;flex-wrap:wrap;gap:.38rem;margin:.1rem 0;padding:0;list-style:none}.tag-list a{display:inline-block;border-radius:999px;background:#edf0eb;padding:.26rem .58rem;color:#3a5043;font-size:.84rem;text-decoration:none}.discovery-section{margin-top:3.4rem}.landscape-list{display:grid;gap:1.15rem}.landscape-card{min-width:0;display:grid;grid-template-columns:minmax(11rem,15rem) minmax(0,1fr);gap:clamp(1rem,3vw,2rem);padding:clamp(1.1rem,3vw,1.75rem);transition:transform .18s ease,box-shadow .18s ease}.landscape-card h2,.landscape-card h3{margin:.15rem 0 .75rem;font-size:clamp(1.5rem,3vw,2.15rem)}.landscape-card h2 a,.landscape-card h3 a{color:var(--forest);text-decoration:none}.landscape-meta{display:grid;align-content:start;gap:.65rem;padding-right:1rem;border-right:1px solid var(--line);color:var(--muted);font-size:.92rem}.landscape-meta p,.landscape-description p{margin:0}.landscape-content{min-width:0;display:flex;flex-direction:column;align-items:flex-start}.landscape-description{width:100%;margin-bottom:1rem;color:#34423a}.landscape-description p+p{margin-top:.75rem}.recent-mode-control{margin:1.25rem 0 0}.carousel-shell{position:relative}.carousel-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem}.carousel-controls{display:flex;gap:.5rem}.carousel-controls .button{min-width:2.9rem;padding:.55rem}.carousel-track{display:flex;gap:1rem;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:thin;padding:.25rem .15rem 1rem}.carousel-track>.sermon-card{flex:0 0 clamp(16rem,30vw,21rem);scroll-snap-align:start}.series-name{margin:0;color:var(--bronze);font-size:.86rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.series-name a{color:inherit}.carousel-empty{padding:1.25rem;border:1px dashed #8d9a91;border-radius:var(--radius-md);background:rgba(255,253,248,.72)}
      .pagination{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:.48rem;margin-top:2.2rem}.pagination a,.pagination span{display:inline-flex;align-items:center;justify-content:center;min-width:2.8rem;min-height:2.8rem;border:1px solid #a9b1ab;border-radius:var(--radius-sm);padding:.4rem .72rem}.pagination [aria-current="page"]{background:var(--forest);color:#fff;border-color:var(--forest);font-weight:800}
      .sermon-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(16rem,20rem);gap:clamp(1.5rem,5vw,4rem);align-items:start}.sermon-main{min-width:0}.sermon-title{font-size:clamp(2.4rem,7vw,5rem)}.sermon-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem 1rem;margin:1.7rem 0 2rem;padding:1rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);color:var(--muted)}.sermon-meta p{margin:0}.sermon-meta strong{color:var(--ink)}.content-section{padding:clamp(1.2rem,3vw,2rem);margin:1.35rem 0}.sermon-description{font-family:Georgia,"Times New Roman",serif;font-size:1.08rem;line-height:1.82;border-left:.32rem solid var(--bronze)}.video-frame{position:relative;overflow:hidden;aspect-ratio:16/9;border-radius:.8rem;background:linear-gradient(145deg,#173f31,#0e271e);color:#fff}.video-consent{position:absolute;inset:0;display:grid;place-items:center;padding:1.5rem;text-align:center}.video-consent p{margin:.8rem auto;color:#dce7df}.video-consent .button{border-color:#fff;background:#fff;color:var(--forest)}.video-frame iframe{width:100%;height:100%;border:0}.media-links{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1rem}.transcript-disclosure,.qa-item{border:1px solid #c9d1ca;border-radius:.75rem;background:#fbfcf8}.transcript-disclosure summary,.qa-item summary{cursor:pointer;padding:1rem;font-weight:800;color:var(--forest)}.transcript-body,.qa-answer{padding:0 1rem 1rem;line-height:1.82;overflow-wrap:anywhere}.question-list{display:grid;gap:.85rem;margin:0;padding:0;list-style:none}.question-number{color:var(--bronze);font-size:.75rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.related-list{display:grid;gap:1rem}.related-card{padding:1rem}.related-card h3{margin:.2rem 0}.related-reason{color:var(--muted);font-size:.88rem}.sticky-aside{position:sticky;top:1rem}.empty-state{padding:clamp(2rem,6vw,4rem);text-align:center;background:var(--paper);border:1px dashed #8d9a91;border-radius:var(--radius-md)}
      .taxonomy-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.taxonomy-card{padding:1.2rem}.taxonomy-card h2,.taxonomy-card h3{margin:.15rem 0}.private-state{padding:1rem;border:1px solid #c89f68;border-radius:.75rem;background:#fff5e4;color:#5c3a12}.skip-link{position:fixed;left:.75rem;top:-6rem;z-index:100;background:#fff;color:var(--forest);padding:.75rem 1rem;border-radius:.5rem;box-shadow:var(--shadow)}.skip-link:focus{top:.75rem}
      .site-footer{border-top:1px solid #263e32;background:var(--forest);color:#e9eee9}.footer-inner{width:var(--page);margin:auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2rem;padding:2.5rem 0}.footer-inner strong{font-family:Georgia,"Times New Roman",serif;font-size:1.2rem}.footer-inner p{margin:.35rem 0 0;color:#bdccc2}.footer-inner nav{display:flex;flex-wrap:wrap;gap:1rem}.footer-inner a{color:#fff}
      @media (max-width:60rem){.filter-primary,.filter-grid,.advanced-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sermon-grid,.taxonomy-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sermon-layout{grid-template-columns:1fr}.sticky-aside{position:static}.related-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:44rem){.desktop-nav{display:none}.mobile-nav{display:block}.hero{grid-template-columns:1fr;background:linear-gradient(150deg,#fffdf8,#e7ddca)}.hero-note{display:none}.sermon-meta{grid-template-columns:1fr}.footer-inner{grid-template-columns:1fr}.footer-inner nav{display:grid}.section-heading{display:block}.section-heading p{margin-top:.5rem}.passage-cascade{align-items:stretch;flex-direction:column}.passage-cascade>.filter-field{width:100%}.landscape-card{grid-template-columns:1fr}.landscape-meta{padding:0 0 .9rem;border-right:0;border-bottom:1px solid var(--line)}.carousel-heading{align-items:flex-start}}
      @media (max-width:38rem){:root{--page:min(100% - 1.25rem,76rem)}main{padding-top:2rem}.filter-primary,.filter-grid,.advanced-grid,.sermon-grid,.taxonomy-grid,.related-list{grid-template-columns:1fr}.filter-actions{align-items:stretch}.filter-actions .button{width:100%}.sermon-card{padding:1rem}.hero{padding:1.5rem;margin-top:0}.content-section{padding:1rem}.carousel-heading{display:block}.carousel-controls{margin:.75rem 0}.carousel-track>.sermon-card{flex-basis:min(88vw,20rem)}}
      @media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.sermon-card,.landscape-card{transition:none}.sermon-card:hover,.landscape-card:hover{transform:none}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
    `;
}

export function publicSiteStyles(): string {
  return commonStyles();
}

interface PageShellInput {
  title: string;
  description?: string;
  canonicalPath: string;
  robots: "index, follow" | "noindex, follow" | "noindex, nofollow";
  body: string;
  openGraphType?: "website" | "article";
  inlineScript?: string;
}

function pageShell(
  input: PageShellInput,
  context: FrontendRenderContext = publicRenderContext
): string {
  const canonicalUrl = `${canonicalOrigin}${input.canonicalPath}`;
  const homePath = contextualPath(context, "/");
  const sermonPath = contextualPath(context, "/sermons/");
  const navigation = context.mode === "preview"
    ? [
        [homePath, "Home"],
        [sermonPath, "Sermons"],
        [contextualPath(context, "/speakers/"), "Speakers"],
        [contextualPath(context, "/series/"), "Series"],
        [contextualPath(context, "/books/"), "Bible books"]
      ]
    : [[homePath, "Home"], [sermonPath, "Sermons"]];
  const navMarkup = navigation.map(([href, label]) => `<a href="${href}">${label}</a>`).join("");
  const metadata = context.mode === "public"
    ? `${input.description ? `<meta name="description" content="${escapeHtml(input.description)}" />` : ""}
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${input.openGraphType ?? "website"}" />
    <meta property="og:title" content="${escapeHtml(input.title)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${input.description ? `<meta property="og:description" content="${escapeHtml(input.description)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(input.title)}" />
    <meta name="twitter:description" content="${escapeHtml(input.description)}" />` : ""}`
    : "";
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${context.mode === "preview" ? "noindex, nofollow, noarchive" : input.robots}" />
    <title>${escapeHtml(input.title)}</title>
    ${metadata}
    <style>${commonStyles()}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    ${context.mode === "preview" ? '<p class="preview-banner">Private local frontend preview · Draft content · Not public or indexable</p>' : ""}
    <header class="site-header-wrap"><div class="site-header"><a class="brand" href="${homePath}"><span class="brand-mark" aria-hidden="true">SG</span><span>Saving Grace<br />Bible Church</span></a><nav class="desktop-nav" aria-label="Primary">${navMarkup}</nav><details class="mobile-nav"><summary>Menu</summary><nav aria-label="Mobile primary">${navMarkup}</nav></details></div></header>
    <main id="main-content">${input.body}</main>
    <footer class="site-footer"><div class="footer-inner"><div><strong>Saving Grace Bible Church</strong></div><nav aria-label="Footer">${navMarkup}</nav></div></footer>${input.inlineScript ? `<script>${input.inlineScript}</script>` : ""}
  </body>
</html>`;
}

function selected(value: string | undefined, option: string): string {
  return value === option ? " selected" : "";
}

function optionsMarkup(
  options: PublicSermonFilterOption[],
  value: string | undefined,
  emptyLabel: string
): string {
  return `<option value="">${escapeHtml(emptyLabel)}</option>${options
    .map(
      (option) => `<option value="${escapeHtml(option.slug)}"${selected(value, option.slug)}>${escapeHtml(option.name)}</option>`
    )
    .join("")}`;
}

function optionName(options: PublicSermonFilterOption[], slug: string): string {
  return options.find((option) => option.slug === slug)?.name ?? slug;
}

function standardizedFilterParameters(query: PublicSermonListQuery): URLSearchParams {
  const parameters = new URLSearchParams();
  if (query.query) parameters.set("s", query.query);
  if (query.speaker) parameters.set("sermon_speaker", query.speaker);
  if (query.series) parameters.set("sermon_series", query.series);
  if (query.passage) parameters.set("sermon_topics", query.passage);
  if (query.book) parameters.set("sermon_book", query.book);
  if (query.passageBook) parameters.set("passageBook", query.passageBook);
  if (query.passageChapter !== undefined) parameters.set("passageChapter", String(query.passageChapter));
  if (query.passageVerse !== undefined) parameters.set("passageVerse", String(query.passageVerse));
  if (query.passageEndVerse !== undefined) parameters.set("passageEndVerse", String(query.passageEndVerse));
  if (query.dateFrom) parameters.set("dateFrom", query.dateFrom);
  if (query.dateTo) parameters.set("dateTo", query.dateTo);
  if (query.order !== "DESC") parameters.set("order", query.order);
  if (query.view === "recent") parameters.set("view", "recent");
  return parameters;
}

export function hasActiveSermonFilters(query: PublicSermonListQuery): boolean {
  return Boolean(
    query.query || query.speaker || query.series || query.passage || query.book
    || query.passageBook || query.passageChapter !== undefined
    || query.passageVerse !== undefined || query.passageEndVerse !== undefined
    || query.dateFrom || query.dateTo || query.order === "ASC"
  );
}

function hasActiveAdvancedFilters(query: PublicSermonListQuery): boolean {
  return Boolean(
    query.passage || query.passageBook || query.passageChapter !== undefined
    || query.passageVerse !== undefined || query.passageEndVerse !== undefined
    || query.dateFrom || query.dateTo || query.order === "ASC"
  );
}

export function isExpandedRecentView(query: PublicSermonListQuery): boolean {
  return query.view === "recent" || (!hasActiveSermonFilters(query) && query.page > 1);
}

function passageClearUrl(query: PublicSermonListQuery, context = publicRenderContext): string {
  const parameters = standardizedFilterParameters(query);
  for (const name of ["passageBook", "passageChapter", "passageVerse", "passageEndVerse"]) {
    parameters.delete(name);
  }
  return `${contextualPath(context, archivePath)}${parameters.size ? `?${parameters.toString()}` : ""}`;
}

function numberedOptions(maximum: number, value: number | undefined, emptyLabel: string): string {
  return `<option value="">${escapeHtml(emptyLabel)}</option>${Array.from({ length: maximum }, (_, index) => index + 1)
    .map((number) => `<option value="${number}"${value === number ? " selected" : ""}>${number}</option>`)
    .join("")}`;
}

function bibleBookOptions(value: string | undefined): string {
  return (["old", "new"] as const).map((testament) => {
    const label = testament === "old" ? "Old Testament" : "New Testament";
    const options = bibleBooks.filter((book) => book.testament === testament).map((book) =>
      `<option value="${book.slug}" data-chapters="${book.chapterCount}"${selected(value, book.slug)}>${escapeHtml(book.canonicalName)}</option>`
    ).join("");
    return `<optgroup label="${label}">${options}</optgroup>`;
  }).join("");
}

function availableVerses(
  options: PublicSermonFilterOptions,
  bookSlug: string | undefined,
  chapter: number | undefined,
  selectedVerse: number | undefined
): number[] {
  const verified = bookSlug && chapter !== undefined
    ? options.passageVerseAvailability.find(
        (item) => item.bookSlug === bookSlug && item.chapter === chapter
      )?.verses ?? []
    : [];
  return selectedVerse !== undefined && !verified.includes(selectedVerse)
    ? [...verified, selectedVerse].sort((left, right) => left - right)
    : verified;
}

function verseOptions(values: number[], selectedVerse: number | undefined): string {
  const label = values.length ? "Choose a verse" : "Verse data unavailable";
  return `<option value="">${label}</option>${values.map(
    (verse) => `<option value="${verse}"${selectedVerse === verse ? " selected" : ""}>${verse}</option>`
  ).join("")}`;
}

function passageAvailabilityMarkup(options: PublicSermonFilterOptions): string {
  return `<div id="passage-verse-data" hidden>${options.passageVerseAvailability.map(
    (item) => `<span data-passage-availability data-book="${escapeHtml(item.bookSlug)}" data-chapter="${item.chapter}" data-verses="${item.verses.join(",")}"></span>`
  ).join("")}</div>`;
}

function paginationUrl(
  page: number,
  query: PublicSermonListQuery,
  context = publicRenderContext,
  expandedRecent = false
): string {
  const parameters = standardizedFilterParameters(query);
  if (expandedRecent && !hasActiveSermonFilters(query)) {
    if (page <= 1) parameters.set("view", "recent");
    else parameters.delete("view");
  }
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return `${archivePagePath(page, context)}${suffix}#sermon-results`;
}

function sermonCard(
  sermon: SermonSummary,
  headingLevel: 2 | 3 = 2,
  context = publicRenderContext
): string {
  const heading = `h${headingLevel}`;
  const relationships = [
    sermon.speaker
      ? `<li><a href="${filterUrl("sermon_speaker", sermon.speaker.slug, context)}">${escapeHtml(sermon.speaker.name)}</a></li>`
      : "",
    ...sermon.series.map(
      (item) => `<li><a href="${filterUrl("sermon_series", item.slug, context)}">${escapeHtml(item.name)}</a></li>`
    ),
    ...sermon.books.map(
      (item) => `<li><a href="${filterUrl("sermon_book", item.slug, context)}">${escapeHtml(item.name)}</a></li>`
    )
  ].filter(Boolean);
  return `<article class="sermon-card">
    <p class="card-meta"><time datetime="${escapeHtml(sermon.serviceDate)}">${escapeHtml(formattedDate(sermon.serviceDate))}</time></p>
    <${heading}><a href="${contextualPath(context, `/sermons/${encodeURIComponent(sermon.slug)}/`)}">${escapeHtml(sermon.title)}</a></${heading}>
    ${sermon.primaryPassages.length ? `<p class="card-meta"><strong>Preached from:</strong> ${sermon.primaryPassages.map((item) => escapeHtml(item.displayText)).join(", ")}</p>` : ""}
    ${sermon.scriptureReferences.length ? `<p class="card-meta">Other Scripture metadata: ${sermon.scriptureReferences.map((item) => escapeHtml(item.displayText)).join(", ")}</p>` : ""}
    ${relationships.length ? `<ul class="tag-list" aria-label="Sermon classifications">${relationships.join("")}</ul>` : ""}
    ${sermon.summary ? `<p class="card-description">${escapeHtml(sermon.summary)}</p>` : ""}
    <a class="card-link" href="${contextualPath(context, `/sermons/${encodeURIComponent(sermon.slug)}/`)}">View sermon <span aria-hidden="true">→</span></a>
  </article>`;
}

function landscapeSermonCard(
  sermon: SermonSummary,
  headingLevel: 2 | 3 = 2,
  context = publicRenderContext
): string {
  const heading = `h${headingLevel}`;
  const sermonPath = contextualPath(context, `/sermons/${encodeURIComponent(sermon.slug)}/`);
  const speaker = sermon.speaker
    ? `<p><strong>Speaker</strong><br /><a href="${filterUrl("sermon_speaker", sermon.speaker.slug, context)}">${escapeHtml(sermon.speaker.name)}</a></p>`
    : "";
  const series = sermon.series.length
    ? `<p><strong>Series</strong><br />${sermon.series.map(
        (item) => `<a href="${filterUrl("sermon_series", item.slug, context)}">${escapeHtml(item.name)}</a>`
      ).join(", ")}</p>`
    : "";
  const passage = sermon.primaryPassages.length
    ? `<p><strong>Preached from</strong><br />${sermon.primaryPassages.map(
        (item) => escapeHtml(item.displayText)
      ).join(", ")}</p>`
    : "";
  return `<article class="landscape-card">
    <div class="landscape-meta"><p><strong>Service date</strong><br /><time datetime="${escapeHtml(sermon.serviceDate)}">${escapeHtml(formattedDate(sermon.serviceDate))}</time></p>${speaker}${series}${passage}</div>
    <div class="landscape-content"><${heading}><a href="${sermonPath}">${escapeHtml(sermon.title)}</a></${heading}>${sermon.summary ? `<div class="landscape-description">${plainTextMarkup(sermon.summary)}</div>` : ""}<a class="card-link" href="${sermonPath}">Read the sermon <span aria-hidden="true">→</span></a></div>
  </article>`;
}

function seriesRepresentativeCard(
  representative: PublicSeriesRepresentative,
  context = publicRenderContext
): string {
  const { sermon, series } = representative;
  const seriesPath = context.mode === "preview"
    ? contextualPath(context, `/series/${encodeURIComponent(series.slug)}/`)
    : filterUrl("sermon_series", series.slug, context);
  return `<article class="sermon-card">
    <p class="series-name"><a href="${seriesPath}">${escapeHtml(series.name)}</a></p>
    <h3><a href="${contextualPath(context, `/sermons/${encodeURIComponent(sermon.slug)}/`)}">${escapeHtml(sermon.title)}</a></h3>
    <p class="card-meta"><time datetime="${escapeHtml(sermon.serviceDate)}">${escapeHtml(formattedDate(sermon.serviceDate))}</time>${sermon.speaker ? ` · ${escapeHtml(sermon.speaker.name)}` : ""}</p>
    ${sermon.primaryPassages.length ? `<p class="card-meta"><strong>Preached from:</strong> ${sermon.primaryPassages.map((item) => escapeHtml(item.displayText)).join(", ")}</p>` : ""}
    ${sermon.summary ? `<p class="card-description">${escapeHtml(sermon.summary)}</p>` : ""}
    <a class="card-link" href="${contextualPath(context, `/sermons/${encodeURIComponent(sermon.slug)}/`)}">View sermon <span aria-hidden="true">→</span></a>
  </article>`;
}

function sermonCarousel(input: {
  id: string;
  heading: string;
  cards: string[];
  emptyMessage: string;
}): string {
  if (!input.cards.length) {
    return `<section class="discovery-section" aria-labelledby="${input.id}-heading"><div class="section-heading"><h2 id="${input.id}-heading">${escapeHtml(input.heading)}</h2></div><div class="carousel-empty"><p>${escapeHtml(input.emptyMessage)}</p></div></section>`;
  }
  return `<section class="discovery-section carousel-shell" aria-labelledby="${input.id}-heading" data-carousel>
    <div class="carousel-heading"><h2 id="${input.id}-heading">${escapeHtml(input.heading)}</h2><div class="carousel-controls"><button class="button button-secondary" type="button" data-carousel-previous aria-controls="${input.id}-track" aria-label="Previous ${escapeHtml(input.heading)}" hidden>←</button><button class="button button-secondary" type="button" data-carousel-next aria-controls="${input.id}-track" aria-label="Next ${escapeHtml(input.heading)}" hidden>→</button></div></div>
    <div class="carousel-track" id="${input.id}-track" data-carousel-track>${input.cards.join("")}</div>
  </section>`;
}

function activeFiltersMarkup(
  query: PublicSermonListQuery,
  options: PublicSermonFilterOptions,
  context = publicRenderContext
): string {
  const active = [
    query.query ? `Search: ${query.query}` : "",
    query.speaker ? `Speaker: ${optionName(options.speakers, query.speaker)}` : "",
    query.series ? `Series: ${optionName(options.series, query.series)}` : "",
    query.passage ? `Scripture: ${optionName(options.passages, query.passage)}` : "",
    query.book ? `Bible book: ${optionName(options.books, query.book)}` : "",
    passageQueryLabel(query) ? `Primary passage: ${passageQueryLabel(query)}` : "",
    query.dateFrom ? `From: ${query.dateFrom}` : "",
    query.dateTo ? `To: ${query.dateTo}` : "",
    query.order === "ASC" ? "Oldest first" : ""
  ].filter(Boolean);
  if (!active.length) return "";
  return `<section aria-labelledby="active-filters-heading">
    <h2 id="active-filters-heading">Active filters</h2>
    <ul class="active-filters">${active.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p><a href="${contextualPath(context, archivePath)}">Clear all filters</a></p>
  </section>`;
}

export function renderPublicSermonArchivePage(input: {
  sermons: SermonSummary[];
  totalItems: number;
  query: PublicSermonListQuery;
  options: PublicSermonFilterOptions;
  topicalSermons: SermonSummary[];
  seriesRepresentatives: PublicSeriesRepresentative[];
  hasQueryParameters: boolean;
}, context: FrontendRenderContext = publicRenderContext): string {
  const totalPages = Math.ceil(input.totalItems / input.query.pageSize);
  const description = "Browse published sermons from Saving Grace Bible Church by speaker, series, Scripture, Bible book, or service date.";
  const resultLabel = input.totalItems === 1 ? "1 sermon" : `${input.totalItems} sermons`;
  const filtered = hasActiveSermonFilters(input.query);
  const expandedRecent = isExpandedRecentView(input.query);
  const discovery = !filtered && !expandedRecent && input.query.page === 1;
  const advancedActive = hasActiveAdvancedFilters(input.query);
  const passageBook = input.query.passageBook ? bibleBookBySlug(input.query.passageBook) : null;
  const verifiedVerses = availableVerses(
    input.options,
    input.query.passageBook,
    input.query.passageChapter,
    input.query.passageVerse
  );
  const bookOrigin = input.query.book && input.query.passageBook
    ? "both"
    : input.query.passageBook
      ? "exact"
      : input.query.book
        ? "broad"
        : "none";
  const passageSearch = `<fieldset class="passage-search"><legend>Browse by Bible passage</legend><p class="field-hint">This searches only administrator-confirmed primary preaching passages. Verse choices use verified single-chapter passage ranges because complete canonical verse counts are not stored in this repository.</p><div class="passage-cascade">
      <div class="filter-field"><label for="passage-book">Book</label><select id="passage-book" name="passageBook"><option value="">Choose a book</option>${bibleBookOptions(input.query.passageBook)}</select></div>
      <div class="filter-field" data-passage-chapter-field${passageBook ? "" : " hidden"}><label for="passage-chapter">Chapter</label><select id="passage-chapter" name="passageChapter"${passageBook ? "" : " disabled"}>${numberedOptions(passageBook?.chapterCount ?? 0, input.query.passageChapter, "Choose a chapter")}</select></div>
      <div class="filter-field" data-passage-verse-field${input.query.passageChapter === undefined ? " hidden" : ""}><label for="passage-verse">Verse</label><select id="passage-verse" name="passageVerse"${input.query.passageChapter === undefined || verifiedVerses.length === 0 ? " disabled" : ""}>${verseOptions(verifiedVerses, input.query.passageVerse)}</select></div>
    </div>${passageAvailabilityMarkup(input.options)}<div class="filter-actions"><a class="button button-secondary" href="${escapeHtml(passageClearUrl(input.query, context))}">Clear passage</a></div></fieldset>`;
  const filters = `<section class="panel" aria-labelledby="find-sermons-heading">
    <h2 id="find-sermons-heading">Find sermons</h2>
    <form method="get" action="${contextualPath(context, archivePath)}" role="search" data-sermon-search-form data-book-origin="${bookOrigin}">
      <div class="filter-primary">
        <div class="filter-field"><label for="sermon-search">Search</label><input id="sermon-search" name="s" type="search" maxlength="120" value="${escapeHtml(input.query.query ?? "")}" autocomplete="off" /></div>
        <div class="filter-field"><label for="speaker-filter">Speaker</label><select id="speaker-filter" name="sermon_speaker">${optionsMarkup(input.options.speakers, input.query.speaker, "All speakers")}</select></div>
        <div class="filter-field"><label for="book-filter">Bible book</label><select id="book-filter" name="sermon_book">${optionsMarkup(input.options.books, input.query.book, "All books")}</select></div>
        <div class="filter-field"><label for="series-filter">Series</label><select id="series-filter" name="sermon_series">${optionsMarkup(input.options.series, input.query.series, "All series")}</select></div>
      </div>
      <details class="advanced-search" data-advanced-search data-active="${advancedActive}"${advancedActive ? " open" : ""}><summary>Advanced search</summary><div class="advanced-grid">
          <div class="filter-field"><label for="passage-filter">Scripture passage</label><select id="passage-filter" name="sermon_topics">${optionsMarkup(input.options.passages, input.query.passage, "All passages")}</select></div>
          <div class="filter-field"><label for="sort-order">Order</label><select id="sort-order" name="order"><option value="DESC"${selected(input.query.order, "DESC")}>Newest first</option><option value="ASC"${selected(input.query.order, "ASC")}>Oldest first</option></select></div>
          <div class="filter-field"><label for="date-from">Service date from</label><input id="date-from" name="dateFrom" type="date" value="${escapeHtml(input.query.dateFrom ?? "")}" /></div>
          <div class="filter-field"><label for="date-to">Service date to</label><input id="date-to" name="dateTo" type="date" value="${escapeHtml(input.query.dateTo ?? "")}" /></div>
          ${passageSearch}
        </div></details>
      <div class="filter-actions"><button class="button" type="submit">Apply filters</button><a class="button button-secondary" href="${contextualPath(context, archivePath)}">Clear filters</a></div>
    </form>
  </section>`;
  const resultCards = input.sermons.length
    ? `<div class="landscape-list">${input.sermons.map((sermon) => landscapeSermonCard(sermon, 3, context)).join("")}</div>`
    : `<div class="empty-state"><h2>${context.mode === "public" ? "No published sermons matched" : "No sermons matched"}</h2><p>Try removing a filter or using a different search.</p><p><a class="button" href="${contextualPath(context, archivePath)}">Show all sermons</a></p></div>`;
  const pagination = !discovery && totalPages > 1
    ? `<nav class="pagination" aria-label="Sermon result pages">
        ${input.query.page > 1 ? `<a href="${escapeHtml(paginationUrl(input.query.page - 1, input.query, context, expandedRecent))}" rel="prev">Previous</a>` : ""}
        ${Array.from({ length: totalPages }, (_, index) => index + 1)
          .filter((page) => page === 1 || page === totalPages || Math.abs(page - input.query.page) <= 2)
          .map((page, index, pages) => `${index > 0 && page - pages[index - 1]! > 1 ? `<span aria-hidden="true">…</span>` : ""}${page === input.query.page ? `<span aria-current="page"><span class="sr-only">Page </span>${page}</span>` : `<a href="${escapeHtml(paginationUrl(page, input.query, context, expandedRecent))}"><span class="sr-only">Page </span>${page}</a>`}`)
          .join("")}
        ${input.query.page < totalPages ? `<a href="${escapeHtml(paginationUrl(input.query.page + 1, input.query, context, expandedRecent))}" rel="next">Next</a>` : ""}
      </nav>`
    : "";
  const discoveryMarkup = discovery
    ? `<section class="discovery-section" aria-labelledby="most-recent-sermons"><div class="section-heading"><div><h2 id="most-recent-sermons">Most Recent Sermons</h2></div></div>${input.sermons.length ? `<div class="landscape-list">${input.sermons.slice(0, 3).map((sermon) => landscapeSermonCard(sermon, 3, context)).join("")}</div>` : resultCards}<p class="recent-mode-control"><a class="button button-secondary" href="${contextualPath(context, archivePath)}?view=recent#sermon-results">Show more recent sermons</a></p></section>${sermonCarousel({ id: "topical-sermons", heading: "Topical sermons", cards: input.topicalSermons.map((sermon) => sermonCard(sermon, 3, context)), emptyMessage: "No sermons have an approved topical classification yet." })}${sermonCarousel({ id: "series-sermons", heading: "Series", cards: input.seriesRepresentatives.map((item) => seriesRepresentativeCard(item, context)), emptyMessage: "No eligible sermon series are available yet." })}`
    : "";
  const resultMarkup = discovery
    ? discoveryMarkup
    : `<section class="discovery-section" id="sermon-results" tabindex="-1" aria-labelledby="sermon-results-heading"><div class="section-heading"><div><h2 id="sermon-results-heading">${filtered ? "Filtered sermons" : "Recent sermons"}</h2><p class="result-status" role="status" aria-live="polite">${escapeHtml(resultLabel)}${totalPages ? ` · Page ${input.query.page} of ${totalPages}` : ""}</p></div>${expandedRecent && !filtered ? `<a href="${contextualPath(context, archivePath)}#most-recent-sermons">Show fewer recent sermons</a>` : ""}</div>${resultCards}${pagination}</section>`;

  return pageShell({
    title: input.query.query ? "Search sermons — Saving Grace Bible Church" : "Sermons — Saving Grace Bible Church",
    description,
    canonicalPath: archivePagePath(input.query.page, publicRenderContext),
    robots: input.hasQueryParameters ? "noindex, follow" : "index, follow",
    body: `<p class="eyebrow">Sermon library</p><h1>Sermons</h1><p class="lede">${description}</p>${filters}${activeFiltersMarkup(input.query, input.options, context)}${resultMarkup}`,
    inlineScript: archiveEnhancementScript
  }, context);
}

function relatedReasonLabel(sermon: RelatedSermonSummary): string {
  const labels: Record<RelatedSermonSummary["relationshipReasons"][number], string> = {
    same_series: "same series",
    overlapping_scripture: "overlapping Scripture",
    same_bible_book: "same Bible book",
    same_speaker: "same speaker"
  };
  return sermon.relationshipReasons.map((reason) => labels[reason]).join(", ");
}

function taxonomyLink(
  context: FrontendRenderContext,
  kind: "speakers" | "series" | "books",
  slug: string,
  publicFilter: string
): string {
  return context.mode === "preview"
    ? contextualPath(context, `/${kind}/${encodeURIComponent(slug)}/`)
    : filterUrl(publicFilter, slug, context);
}

export function renderPublicSermonPage(
  sermon: SermonDetail,
  context: FrontendRenderContext = publicRenderContext
): string {
  const canonicalPath = `/sermons/${sermon.slug}/`;
  const metadataDescription = sermon.seoDescription ?? sermon.summary ?? undefined;
  const transcript = sermon.transcript
    ? `<section class="content-section" aria-labelledby="transcript-heading">
        <h2 id="transcript-heading">Full transcript</h2>
        <details class="transcript-disclosure">
          <summary>Read full transcript</summary>
          <div class="transcript-body">${plainTextMarkup(sermon.transcript.bodyText)}</div>
        </details>
      </section>`
    : "";
  const questions = sermon.questionAnswers.length
    ? `<section class="content-section" aria-labelledby="questions-heading">
        <h2 id="questions-heading">Questions for reflection</h2>
        <ol class="question-list">${sermon.questionAnswers
          .map(
            (item, index) => `<li class="qa-item"><details><summary><span class="question-number">Question ${index + 1}</span><br />${escapeHtml(item.question)}</summary><div class="qa-answer">${plainTextMarkup(item.answer)}</div></details></li>`
          )
          .join("")}</ol>
      </section>`
    : "";
  const scripture = sermon.scriptureReferences.length
    ? `<p><strong>Other Scripture metadata:</strong> ${sermon.scriptureReferences.map((item) => escapeHtml(item.displayText)).join(", ")}</p>`
    : "";
  const primaryPassages = sermon.primaryPassages.length
    ? `<p><strong>Preached from:</strong> ${sermon.primaryPassages.map((item) => escapeHtml(item.displayText)).join(", ")}</p>`
    : sermon.primaryPassageState === "none"
      ? `<p><strong>Primary passage:</strong> Topical or multi-passage sermon</p>`
      : "";
  const speaker = sermon.speaker
    ? `<p><strong>Speaker:</strong> <a href="${taxonomyLink(context, "speakers", sermon.speaker.slug, "sermon_speaker")}">${escapeHtml(sermon.speaker.name)}</a></p>`
    : "";
  const series = sermon.series.length
    ? `<p><strong>Series:</strong> ${sermon.series.map((item) => `<a href="${taxonomyLink(context, "series", item.slug, "sermon_series")}">${escapeHtml(item.name)}</a>`).join(", ")}</p>`
    : "";
  const books = sermon.books.length
    ? `<p><strong>Bible book:</strong> ${sermon.books.map((item) => `<a href="${taxonomyLink(context, "books", item.slug, "sermon_book")}">${escapeHtml(item.name)}</a>`).join(", ")}</p>`
    : "";
  const youtube = sermon.media
    .filter((item) => item.provider === "youtube")
    .map((item) => ({ item, identity: resolveYouTubeIdentity([{ videoId: item.externalId, canonicalUrl: item.canonicalUrl }]) }))
    .find((candidate) => candidate.identity.status === "available");
  const video = youtube && youtube.identity.status === "available"
    ? `<div class="video-frame" data-video-frame><div class="video-consent"><div><strong>${escapeHtml(youtube.item.title)}</strong><p>The player loads only when you choose to watch.</p><button class="button" type="button" data-load-youtube data-video-id="${escapeHtml(youtube.identity.videoId)}" data-video-title="${escapeHtml(`Video: ${sermon.title}`)}">Load video</button></div></div></div>`
    : "";
  const audioLinks = sermon.media
    .filter((item) => item.provider !== "youtube")
    .map((item) => `<a class="button button-secondary" href="${escapeHtml(item.canonicalUrl)}" target="_blank" rel="noopener noreferrer">Open audio <span aria-hidden="true">↗</span></a>`)
    .join("");
  const media = sermon.media.length
    ? `<section class="content-section" aria-labelledby="media-heading"><h2 id="media-heading">Watch or listen</h2>${video || audioLinks ? video : '<p class="private-state">The sermon media is currently unavailable.</p>'}${audioLinks ? `<div class="media-links">${audioLinks}</div>` : ""}</section>`
    : "";
  const related = sermon.relatedSermons.length
    ? `<aside class="sticky-aside" aria-labelledby="related-heading"><h2 id="related-heading">Related sermons</h2><div class="related-list">${sermon.relatedSermons.map((item) => `<article class="related-card"><p class="eyebrow">${escapeHtml(formattedDate(item.serviceDate))}</p><h3><a href="${contextualPath(context, `/sermons/${encodeURIComponent(item.slug)}/`)}">${escapeHtml(item.title)}</a></h3><p class="related-reason">Related by ${escapeHtml(relatedReasonLabel(item))}</p></article>`).join("")}</div></aside>`
    : "";

  return pageShell({
    title: `${sermon.title} — Saving Grace Bible Church`,
    ...(metadataDescription ? { description: metadataDescription } : {}),
    canonicalPath,
    robots: "index, follow",
    openGraphType: "article",
    body: `<p><a href="${contextualPath(context, archivePath)}">← All sermons</a></p><div class="sermon-layout"><article class="sermon-main"><p class="eyebrow">Sermon</p><h1 class="sermon-title">${escapeHtml(sermon.title)}</h1><div class="sermon-meta"><p><strong>Service date:</strong><br /><time datetime="${escapeHtml(sermon.serviceDate)}">${escapeHtml(formattedDate(sermon.serviceDate))}</time></p>${speaker}${series}${primaryPassages}${scripture}${books}</div>${sermon.summary ? `<section class="content-section sermon-description" aria-labelledby="description-heading"><h2 id="description-heading">About this sermon</h2>${plainTextMarkup(sermon.summary)}</section>` : ""}${media}${transcript}${questions}</article>${related}</div>`,
    ...(video ? { inlineScript: videoEnhancementScript } : {})
  }, context);
}

export function renderFrontendHomePage(input: {
  sermons: SermonSummary[];
  series: PublicSermonFilterOption[];
}, context: FrontendRenderContext = publicRenderContext): string {
  const [latest, ...recent] = input.sermons;
  const sermonArchive = contextualPath(context, archivePath);
  const latestMarkup = latest
    ? `<section aria-labelledby="latest-heading"><div class="section-heading"><div><p class="eyebrow">Latest sermon</p><h2 id="latest-heading">Listen and reflect</h2></div><a href="${sermonArchive}">Browse every sermon</a></div><div class="sermon-grid">${sermonCard(latest, 3, context)}${recent.slice(0, 2).map((sermon) => sermonCard(sermon, 3, context)).join("")}</div></section>`
    : `<section class="empty-state" aria-labelledby="latest-heading"><h2 id="latest-heading">Sermons are being prepared</h2><p>No sermon is publicly eligible yet.</p></section>`;
  const recentMarkup = recent.length > 2
    ? `<section aria-labelledby="recent-heading" style="margin-top:4rem"><div class="section-heading"><div><p class="eyebrow">From the archive</p><h2 id="recent-heading">Recent sermons</h2></div></div><div class="sermon-grid">${recent.slice(2, 8).map((sermon) => sermonCard(sermon, 3, context)).join("")}</div></section>`
    : "";
  const seriesMarkup = input.series.length
    ? `<section aria-labelledby="series-heading" style="margin-top:4rem"><div class="section-heading"><div><p class="eyebrow">Continue exploring</p><h2 id="series-heading">Sermon series</h2></div>${context.mode === "preview" ? `<a href="${contextualPath(context, "/series/")}">View all series</a>` : ""}</div><div class="taxonomy-grid">${input.series.slice(0, 6).map((item) => `<article class="taxonomy-card"><p class="eyebrow">Series</p><h3><a href="${context.mode === "preview" ? contextualPath(context, `/series/${encodeURIComponent(item.slug)}/`) : filterUrl("sermon_series", item.slug, context)}">${escapeHtml(item.name)}</a></h3></article>`).join("")}</div></section>`
    : "";
  return pageShell({
    title: "Saving Grace Bible Church",
    description: "Sermons from Saving Grace Bible Church.",
    canonicalPath: "/",
    robots: "index, follow",
    body: `<section class="hero"><div class="hero-copy"><p class="eyebrow">Saving Grace Bible Church</p><h1>Scripture for faith and life.</h1><p class="lede">Explore sermon teaching through a clear, readable library designed for listening, reflection and careful study.</p><div class="hero-actions"><a class="button" href="${sermonArchive}">Browse sermons</a></div></div><aside class="hero-note"><strong>Built around the sermon</strong><p>Search by keyword, speaker, series, Bible book or reviewed preaching passage.</p></aside></section>${latestMarkup}${recentMarkup}${seriesMarkup}`
  }, context);
}

const taxonomyLabels = {
  speakers: { singular: "Speaker", plural: "Speakers" },
  series: { singular: "Series", plural: "Series" },
  books: { singular: "Bible book", plural: "Bible books" }
} as const;

export type FrontendTaxonomyKind = keyof typeof taxonomyLabels;

export function renderFrontendTaxonomyIndex(
  kind: FrontendTaxonomyKind,
  options: PublicSermonFilterOption[],
  context: FrontendRenderContext = previewRenderContext
): string {
  const label = taxonomyLabels[kind];
  const cards = options.length
    ? `<div class="taxonomy-grid">${options.map((item) => `<article class="taxonomy-card"><p class="eyebrow">${label.singular}</p><h2><a href="${contextualPath(context, `/${kind}/${encodeURIComponent(item.slug)}/`)}">${escapeHtml(item.name)}</a></h2></article>`).join("")}</div>`
    : `<div class="empty-state"><h2>No ${label.plural.toLowerCase()} available</h2><p>No eligible sermon currently uses this classification.</p></div>`;
  return pageShell({
    title: `${label.plural} — Saving Grace Bible Church`,
    canonicalPath: `/${kind}/`,
    robots: "noindex, nofollow",
    body: `<p class="eyebrow">Sermon library</p><h1>${label.plural}</h1><p class="lede">Browse eligible sermons by ${label.singular.toLowerCase()}.</p>${cards}`
  }, context);
}

export function renderFrontendTaxonomyDetail(input: {
  kind: FrontendTaxonomyKind;
  option: PublicSermonFilterOption;
  sermons: SermonSummary[];
}, context: FrontendRenderContext = previewRenderContext): string {
  const label = taxonomyLabels[input.kind];
  return pageShell({
    title: `${input.option.name} — Saving Grace Bible Church`,
    canonicalPath: `/${input.kind}/${input.option.slug}/`,
    robots: "noindex, nofollow",
    body: `<p><a href="${contextualPath(context, `/${input.kind}/`)}">← All ${label.plural.toLowerCase()}</a></p><p class="eyebrow">${label.singular}</p><h1>${escapeHtml(input.option.name)}</h1><p class="result-status" role="status">${input.sermons.length} ${input.sermons.length === 1 ? "sermon" : "sermons"}</p>${input.sermons.length ? `<div class="sermon-grid">${input.sermons.map((sermon) => sermonCard(sermon, 2, context)).join("")}</div>` : `<div class="empty-state"><h2>No eligible sermons</h2><p>This classification has no eligible sermons in the current preview.</p></div>`}`
  }, context);
}

export function renderFrontendBoundaryPage(input: {
  title: string;
  message: string;
  kind?: "not-found" | "private" | "error";
}, context: FrontendRenderContext = publicRenderContext): string {
  return pageShell({
    title: `${input.title} — Saving Grace Bible Church`,
    canonicalPath: "/sermons/",
    robots: "noindex, nofollow",
    body: `<div class="empty-state"><p class="eyebrow">${input.kind === "private" ? "Private content" : input.kind === "error" ? "Something went wrong" : "Not found"}</p><h1>${escapeHtml(input.title)}</h1><p>${escapeHtml(input.message)}</p><p><a class="button" href="${contextualPath(context, archivePath)}">Browse sermons</a></p></div>`
  }, context);
}

function renderErrorPage(status: 400 | 404 | 410 | 500, heading: string, message: string): Response {
  const body = renderFrontendBoundaryPage({ title: heading, message });
  return new Response(body, { status, headers: frontendResponseHeaders() });
}

function methodNotAllowed(): Response {
  return new Response("Method not allowed", {
    status: 405,
    headers: { ...frontendResponseHeaders(), Allow: "GET" }
  });
}

function renderSermonSitemap(entries: Array<{ slug: string; lastModified: string }>): string {
  const urls = [
    `<url><loc>${escapeXml(`${canonicalOrigin}${archivePath}`)}</loc></url>`,
    ...entries.map((entry) => `<url><loc>${escapeXml(`${canonicalOrigin}/sermons/${entry.slug}/`)}</loc><lastmod>${escapeXml(entry.lastModified)}</lastmod></url>`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}

export function createPublicSermonSiteHandler(repository: PublicSermonRepository) {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const isArchiveRoot = url.pathname === archivePath;
    const archivePageMatch = /^\/sermons\/page\/(\d+)\/$/.exec(url.pathname);
    const detailMatch = /^\/sermons\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/.exec(url.pathname);
    const isSitemap = url.pathname === "/sitemap-sermons.xml";
    const needsTrailingSlash = url.pathname === "/sermons"
      || /^\/sermons\/(?:page\/\d+|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(url.pathname);
    const isSermonRoute = isArchiveRoot || Boolean(archivePageMatch || detailMatch || isSitemap || needsTrailingSlash || url.pathname.startsWith("/sermons/"));
    if (!isSermonRoute) return null;
    if (request.method !== "GET") return methodNotAllowed();

    try {
      if (needsTrailingSlash) {
        return new Response(null, {
          status: 301,
          headers: {
            Location: `${url.pathname}/${url.search}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      if (isSitemap) {
        const entries = await repository.listPublishedSitemapEntries();
        return new Response(renderSermonSitemap(entries), {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }

      if (isArchiveRoot || archivePageMatch) {
        const pathPage = archivePageMatch ? Number(archivePageMatch[1]) : 1;
        if (!Number.isSafeInteger(pathPage) || pathPage < 1) {
          return renderErrorPage(404, "Page not found", "That sermon archive page does not exist.");
        }
        if (archivePageMatch && pathPage === 1) {
          return new Response(null, {
            status: 301,
            headers: {
              Location: `${archivePath}${url.search}`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff"
            }
          });
        }
        const translated = translateLegacySermonQuery(url.searchParams);
        const query = publicSermonListQuerySchema.parse({
          ...translated,
          page: archivePageMatch ? pathPage : translated.page ?? pathPage,
          pageSize: archivePageSize
        });
        const discoveryRequested = query.page === 1
          && query.view !== "recent"
          && !hasActiveSermonFilters(query);
        const [result, options, topicalSermons, seriesRepresentatives] = await Promise.all([
          repository.listPublished(query),
          repository.listPublishedFilterOptions(),
          discoveryRequested ? repository.listPublishedTopicalSermons() : Promise.resolve([]),
          discoveryRequested ? repository.listPublishedSeriesRepresentatives() : Promise.resolve([])
        ]);
        const totalPages = Math.ceil(result.totalItems / query.pageSize);
        if (query.page > 1 && (totalPages === 0 || query.page > totalPages)) {
          return renderErrorPage(404, "Page not found", "That sermon archive page does not exist.");
        }
        return new Response(renderPublicSermonArchivePage({
          sermons: result.data,
          totalItems: result.totalItems,
          query,
          options,
          topicalSermons,
          seriesRepresentatives,
          hasQueryParameters: url.searchParams.size > 0
        }), { status: 200, headers: frontendResponseHeaders({ passageScript: true }) });
      }

      if (detailMatch) {
        const sermon = await repository.findPublishedBySlug(detailMatch[1]!);
        if (sermon) {
          return new Response(renderPublicSermonPage(sermon), {
            status: 200,
            headers: frontendResponseHeaders({ videoScript: sermon.media.some((item) => item.provider === "youtube") })
          });
        }
        const disposition = await repository.findPublicPathDisposition(url.pathname);
        if (disposition?.kind === "redirect") {
          return new Response(null, {
            status: 301,
            headers: {
              Location: disposition.location,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff"
            }
          });
        }
        if (disposition?.kind === "gone") {
          return renderErrorPage(410, "Sermon no longer available", "This sermon has been permanently removed.");
        }
        return renderErrorPage(404, "Sermon not found", "The requested sermon is not publicly available.");
      }

      return renderErrorPage(404, "Page not found", "The requested sermon page does not exist.");
    } catch (error) {
      if (error instanceof ZodError || error instanceof InvalidLegacySermonQueryError) {
        return renderErrorPage(400, "Check the sermon filters", "One or more filter values are invalid.");
      }
      return renderErrorPage(500, "Sermons temporarily unavailable", "Please try again later.");
    }
  };
}

export const createPublicSermonPageHandler = createPublicSermonSiteHandler;
