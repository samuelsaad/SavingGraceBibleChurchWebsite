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
import {
  bibleBookBySlug,
  bibleBookCategories,
  bibleBooks,
  passageQueryLabel,
  type BibleBookCategory
} from "../../domain/bible-passage";
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

const archiveEnhancementScript = `(function(){const form=document.querySelector('[data-sermon-search-form]');const advanced=document.querySelector('[data-advanced-search]');const broadBook=document.querySelector('#book-filter');const picker=document.querySelector('[data-bible-picker]');const bookInput=document.querySelector('#passage-book');const chapterInput=document.querySelector('#passage-chapter');const verseInput=document.querySelector('#passage-verse');const scopeInput=document.querySelector('#passage-scope');const booksPanel=document.querySelector('[data-books-panel]');const chaptersPanel=document.querySelector('[data-chapters-panel]');const versesPanel=document.querySelector('[data-verses-panel]');const chapterGrid=document.querySelector('[data-tile-grid="chapter"]');const verseGrid=document.querySelector('[data-tile-grid="verse"]');const bookSelection=document.querySelector('[data-book-selection]');const chapterSelection=document.querySelector('[data-chapter-selection]');const bookSearch=document.querySelector('[data-search-whole-book]');const chapterSearch=document.querySelector('[data-search-whole-chapter]');const live=document.querySelector('[data-passage-announcement]');let bookOrigin=form?.getAttribute('data-book-origin')||'none';if(bookOrigin==='both')bookOrigin='exact';const applied={book:bookInput?.value||'',chapter:Number(chapterInput?.value)||0,verse:Number(verseInput?.value)||0,scope:scopeInput?.value||''};const reopenAdvanced=()=>{if(advanced?.getAttribute('data-active')==='true')advanced.open=true;};const announce=message=>{if(live){live.textContent='';requestAnimationFrame(()=>{live.textContent=message;});}};const bookButtons=()=>Array.from(document.querySelectorAll('[data-book-tile]'));const selectedBook=()=>bookButtons().find(button=>button.getAttribute('aria-pressed')==='true');const markPressed=(selector,attribute,value)=>{for(const button of document.querySelectorAll(selector))button.setAttribute('aria-pressed',button.getAttribute(attribute)===String(value)?'true':'false');};const setMobilePanel=panel=>{if(picker)picker.dataset.mobilePanel=panel;};const numberButton=(kind,number,prefix,isApplied)=>{const button=document.createElement('button');button.type='button';button.className='bible-tile bible-number-tile';button.dataset[kind+'Tile']='';button.dataset[kind]=String(number);button.setAttribute('aria-label',prefix+' '+number+(isApplied?', current search':''));button.setAttribute('aria-pressed','false');button.dataset.applied=String(isApplied);const label=document.createElement('span');label.textContent=String(number);const marker=document.createElement('span');marker.className='tile-applied-marker';marker.setAttribute('aria-hidden','true');marker.textContent='•';button.append(label,marker);return button;};const hideVerses=()=>{if(versesPanel)versesPanel.hidden=true;if(verseGrid)verseGrid.replaceChildren();if(verseInput){verseInput.value='';verseInput.disabled=true;}if(chapterSearch)chapterSearch.disabled=true;if(picker)picker.dataset.depth='chapter';};const renderChapters=focusNext=>{const chosen=selectedBook();if(!chosen||!chaptersPanel||!chapterGrid)return;const name=chosen.dataset.bookName||'';const count=Number(chosen.dataset.chapters||0);chaptersPanel.hidden=false;chapterGrid.replaceChildren(...Array.from({length:count},(_,index)=>numberButton('chapter',index+1,name+' chapter',chosen.dataset.book===applied.book&&(applied.scope==='chapter'||applied.scope==='verse')&&index+1===applied.chapter)));if(bookSelection)bookSelection.textContent=name+' selected';if(bookSearch){bookSearch.disabled=false;bookSearch.textContent='Search all of '+name;}hideVerses();if(picker)picker.dataset.depth='chapter';setMobilePanel('chapter');announce(name+' selected. '+count+' chapters available.');if(focusNext)chapterGrid.querySelector('button')?.focus();};const renderVerses=focusNext=>{const chosen=selectedBook();const chapter=Number(chapterInput?.value||0);if(!chosen||!chapter||!versesPanel||!verseGrid)return;const name=chosen.dataset.bookName||'';const counts=(chosen.dataset.verseCounts||'').split(',').map(Number);const count=counts[chapter-1]||0;versesPanel.hidden=false;verseGrid.replaceChildren(...Array.from({length:count},(_,index)=>numberButton('verse',index+1,name+' '+chapter+' verse',chosen.dataset.book===applied.book&&applied.scope==='verse'&&chapter===applied.chapter&&index+1===applied.verse)));if(chapterSelection)chapterSelection.textContent=name+' '+chapter+' selected';if(chapterSearch){chapterSearch.disabled=false;chapterSearch.textContent='Search all of '+name+' '+chapter;}if(picker)picker.dataset.depth='verse';setMobilePanel('verse');announce(name+' '+chapter+' selected. '+count+' verses available.');if(focusNext)verseGrid.querySelector('button')?.focus();};const syncBroadFromExact=()=>{if(!broadBook||!bookInput)return;broadBook.value=Array.from(broadBook.options).some(option=>option.value===bookInput.value)?bookInput.value:'';};const selectBook=(button,focusNext,origin)=>{bookOrigin=origin;markPressed('[data-book-tile]','data-book',button.dataset.book||'');if(bookInput){bookInput.value=button.dataset.book||'';bookInput.disabled=false;}if(chapterInput){chapterInput.value='';chapterInput.disabled=true;}if(verseInput){verseInput.value='';verseInput.disabled=true;}if(scopeInput){scopeInput.value='book';scopeInput.disabled=false;}if(origin==='exact')syncBroadFromExact();renderChapters(focusNext);};const clearPicker=()=>{markPressed('[data-book-tile]','data-book','');if(bookInput){bookInput.value='';bookInput.disabled=true;}if(chapterInput){chapterInput.value='';chapterInput.disabled=true;}if(verseInput){verseInput.value='';verseInput.disabled=true;}if(scopeInput){scopeInput.value='';scopeInput.disabled=true;}if(chaptersPanel)chaptersPanel.hidden=true;if(versesPanel)versesPanel.hidden=true;if(picker)picker.dataset.depth='book';setMobilePanel('book');};const syncExactFromBroad=()=>{const match=bookButtons().find(button=>button.dataset.book===broadBook?.value);if(match)selectBook(match,false,'broad');else clearPicker();bookOrigin='broad';};const selectChapter=(button,focusNext)=>{bookOrigin='exact';markPressed('[data-chapter-tile]','data-chapter',button.dataset.chapter||'');if(chapterInput){chapterInput.value=button.dataset.chapter||'';chapterInput.disabled=false;}if(verseInput){verseInput.value='';verseInput.disabled=true;}if(scopeInput){scopeInput.value='chapter';scopeInput.disabled=false;}syncBroadFromExact();renderVerses(focusNext);};const submitExact=scope=>{bookOrigin='exact';if(scope==='book'){if(chapterInput){chapterInput.value='';chapterInput.disabled=true;}if(verseInput){verseInput.value='';verseInput.disabled=true;}}else if(scope==='chapter'&&verseInput){verseInput.value='';verseInput.disabled=true;}if(scopeInput){scopeInput.value=scope;scopeInput.disabled=false;}form?.requestSubmit();};if(form&&picker&&bookInput&&chapterInput&&verseInput&&scopeInput){if(bookOrigin==='broad')syncExactFromBroad();else if(bookOrigin==='exact')syncBroadFromExact();broadBook?.addEventListener('change',()=>{bookOrigin='broad';syncExactFromBroad();});picker.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;if(target.matches('[data-book-tile]'))selectBook(target,event.detail===0,'exact');else if(target.matches('[data-chapter-tile]'))selectChapter(target,event.detail===0);else if(target.matches('[data-verse-tile]')){bookOrigin='exact';markPressed('[data-verse-tile]','data-verse',target.dataset.verse||'');verseInput.value=target.dataset.verse||'';verseInput.disabled=false;scopeInput.value='verse';scopeInput.disabled=false;syncBroadFromExact();announce((selectedBook()?.dataset.bookName||'Selected passage')+' '+chapterInput.value+':'+verseInput.value+' selected. Searching exact verse.');submitExact('verse');}else if(target.matches('[data-search-whole-book]'))submitExact('book');else if(target.matches('[data-search-whole-chapter]'))submitExact('chapter');else if(target.matches('[data-back-to-books]')){setMobilePanel('book');booksPanel?.querySelector('[aria-pressed="true"]')?.focus();announce('Returned to Bible books.');}else if(target.matches('[data-back-to-chapters]')){setMobilePanel('chapter');chaptersPanel?.querySelector('[aria-pressed="true"]')?.focus();announce('Returned to chapters.');}});picker.addEventListener('dblclick',event=>{const target=event.target.closest('button');if(target?.matches('[data-book-tile]')){event.preventDefault();selectBook(target,false,'exact');submitExact('book');}else if(target?.matches('[data-chapter-tile]')){event.preventDefault();selectChapter(target,false);submitExact('chapter');}});picker.addEventListener('keydown',event=>{const target=event.target.closest('.bible-tile');if(!target)return;if(event.key==='Escape'||event.key==='Backspace'){event.preventDefault();if(target.matches('[data-verse-tile]')){setMobilePanel('chapter');chaptersPanel?.querySelector('[aria-pressed="true"]')?.focus();}else if(target.matches('[data-chapter-tile]')){setMobilePanel('book');booksPanel?.querySelector('[aria-pressed="true"]')?.focus();}return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;const grid=target.closest('[data-tile-grid]');const tiles=Array.from(grid.querySelectorAll('.bible-tile'));const index=tiles.indexOf(target);const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length||1;let next=index;if(event.key==='ArrowLeft')next=index-1;if(event.key==='ArrowRight')next=index+1;if(event.key==='ArrowUp')next=index-columns;if(event.key==='ArrowDown')next=index+columns;if(event.key==='Home')next=0;if(event.key==='End')next=tiles.length-1;if(next>=0&&next<tiles.length){event.preventDefault();tiles[next].focus();}});form.addEventListener('submit',()=>{if(broadBook)broadBook.disabled=false;if(bookOrigin==='exact'&&bookInput.value){if(broadBook)broadBook.disabled=true;bookInput.disabled=false;chapterInput.disabled=!chapterInput.value;verseInput.disabled=!verseInput.value;scopeInput.disabled=!scopeInput.value;}else{bookInput.disabled=true;chapterInput.disabled=true;verseInput.disabled=true;scopeInput.disabled=true;}});window.addEventListener('pageshow',()=>{if(broadBook)broadBook.disabled=false;reopenAdvanced();});}for(const carousel of document.querySelectorAll('[data-carousel]')){const track=carousel.querySelector('[data-carousel-track]');const previous=carousel.querySelector('[data-carousel-previous]');const next=carousel.querySelector('[data-carousel-next]');if(!track||!previous||!next)continue;previous.hidden=false;next.hidden=false;const update=()=>{previous.disabled=track.scrollLeft<=1;next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-1;};const move=direction=>track.scrollBy({left:direction*track.clientWidth*.82,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));track.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);update();}reopenAdvanced();})();`;
const videoEnhancementScript = `(function(){for(const button of document.querySelectorAll('[data-load-youtube]'))button.addEventListener('click',()=>{const frame=button.closest('[data-video-frame]');const id=button.getAttribute('data-video-id');const title=button.getAttribute('data-video-title')||'Sermon video';if(!frame||!/^[A-Za-z0-9_-]{11}$/.test(id||''))return;const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+id;iframe.title=title;iframe.loading='lazy';iframe.allow='accelerometer; encrypted-media; gyroscope; picture-in-picture';iframe.allowFullscreen=true;frame.replaceChildren(iframe);});})();`;
const navigationEnhancementScript = `(function(){const setExpanded=(button,panel,expanded)=>{button.setAttribute('aria-expanded',String(expanded));panel.hidden=!expanded;};const close=(root,restoreFocus)=>{const button=root.querySelector('[data-nav-disclosure-toggle]');const panel=root.querySelector('[data-nav-disclosure-panel]');if(!button||!panel)return;setExpanded(button,panel,false);if(restoreFocus)button.focus();};for(const root of document.querySelectorAll('[data-nav-disclosure]')){const button=root.querySelector('[data-nav-disclosure-toggle]');const panel=root.querySelector('[data-nav-disclosure-panel]');if(!button||!panel)continue;button.addEventListener('click',()=>setExpanded(button,panel,button.getAttribute('aria-expanded')!=='true'));root.addEventListener('keydown',event=>{if(event.key==='Tab'&&button.getAttribute('aria-expanded')==='true'){const stops=[button,...panel.querySelectorAll('a')];const index=stops.indexOf(event.target);const next=index+(event.shiftKey?-1:1);if(index>=0&&next>=0&&next<stops.length){event.preventDefault();stops[next].focus();}else close(root,false);return;}if((event.key==='Enter'||event.key===' '||event.key==='Space')&&event.target===button){event.preventDefault();setExpanded(button,panel,button.getAttribute('aria-expanded')!=='true');return;}if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();close(root,true);});root.addEventListener('focusout',()=>queueMicrotask(()=>{if(!root.contains(document.activeElement))close(root,false);}));panel.addEventListener('click',event=>{if(event.target.closest?.('a'))close(root,false);});for(const eventName of ['pointerdown','click'])document.addEventListener(eventName,event=>{if(!root.contains(event.target))close(root,false);});}const mobile=document.querySelector('[data-mobile-nav]');const mobileToggle=mobile?.querySelector('[data-mobile-menu-toggle]');if(mobile&&mobileToggle){mobile.addEventListener('toggle',()=>{if(!mobile.open){const child=mobile.querySelector('[data-nav-disclosure]');if(child)close(child,false);}});mobile.addEventListener('keydown',event=>{if(event.key!=='Escape'||event.defaultPrevented)return;event.preventDefault();mobile.open=false;mobileToggle.focus();});mobile.addEventListener('focusout',()=>queueMicrotask(()=>{if(!mobile.contains(document.activeElement))mobile.open=false;}));mobile.querySelector('nav')?.addEventListener('click',event=>{if(event.target.closest?.('a'))mobile.open=false;});for(const eventName of ['pointerdown','click'])document.addEventListener(eventName,event=>{if(mobile.open&&!mobile.contains(event.target))mobile.open=false;});}})();`;
const passageKeyboardActivationScript = `(function(){const picker=document.querySelector('[data-bible-picker]');picker?.addEventListener('keydown',event=>{const tile=event.target.closest('.bible-tile');if(!tile||(event.key!=='Enter'&&event.key!==' '))return;event.preventDefault();tile.click();});})();`;
const completeArchiveEnhancementScript = `${archiveEnhancementScript}${passageKeyboardActivationScript}`;
const navigationScriptHash = createHash("sha256").update(navigationEnhancementScript).digest("base64");
const passageScriptHash = createHash("sha256").update(completeArchiveEnhancementScript).digest("base64");
const videoScriptHash = createHash("sha256").update(videoEnhancementScript).digest("base64");

export function frontendResponseHeaders(
  options: { passageScript?: boolean; videoScript?: boolean } = {},
  privatePreview = false
): Record<string, string> {
  const scriptHashes = [
    privatePreview ? `'sha256-${navigationScriptHash}'` : "",
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
      .preview-banner{margin:0;padding:.65rem 1rem;background:#7b4b15;color:#fff;text-align:center;font-size:.88rem;font-weight:750;letter-spacing:.02em}.site-header-wrap{position:relative;z-index:10;background:rgba(255,253,248,.96);border-bottom:1px solid var(--line)}.site-header{width:var(--page);margin:auto;min-height:5.25rem;display:flex;align-items:center;justify-content:space-between;gap:1.5rem}.brand{display:flex;align-items:center;gap:.75rem;color:var(--forest);font-family:Georgia,"Times New Roman",serif;font-size:clamp(1rem,2.3vw,1.28rem);font-weight:700;line-height:1.15;text-decoration:none}.brand-mark{display:grid;place-items:center;width:2.55rem;height:2.55rem;border:1px solid var(--bronze);border-radius:50%;font-size:.72rem;letter-spacing:.06em}.desktop-nav{display:flex;align-items:center;gap:1.15rem}.desktop-nav>a,.sermon-nav-toggle{display:inline-flex;min-height:2.75rem;align-items:center;justify-content:center;color:var(--ink);font:inherit;font-size:.93rem;font-weight:700;text-decoration:none}.desktop-nav>a:hover{color:var(--forest-2)}.desktop-nav>a[aria-current="page"]{color:var(--forest);text-decoration:underline;text-decoration-color:var(--bronze);text-decoration-thickness:.12rem}.sermon-nav{position:relative}.sermon-nav-toggle{gap:.42rem;padding:.45rem .62rem;border:1px solid transparent;border-radius:.45rem;background:transparent;cursor:pointer}.sermon-nav-toggle:hover,.sermon-nav-toggle[aria-expanded="true"]{border-color:#b8c1ba;background:var(--paper);color:var(--forest)}.sermon-nav-toggle.is-active-section{color:var(--forest);box-shadow:inset 0 -.16rem var(--bronze)}.nav-chevron{display:inline-block;font-size:.78rem;line-height:1;transition:transform .16s ease}.sermon-nav-toggle[aria-expanded="true"] .nav-chevron,.mobile-sermon-toggle[aria-expanded="true"] .nav-chevron{transform:rotate(180deg)}.sermon-nav-submenu{position:absolute;z-index:30;top:calc(100% + .12rem);right:0;display:grid;min-width:10.5rem;padding:.35rem;border:1px solid #c4cbc5;border-radius:.5rem;background:var(--paper);box-shadow:0 .75rem 1.8rem rgba(35,48,40,.13)}.sermon-nav-submenu[hidden],.mobile-sermon-submenu[hidden]{display:none}.sermon-nav-submenu a{display:flex;min-height:2.75rem;align-items:center;padding:.48rem .68rem;border-radius:.32rem;color:var(--ink);font-size:.9rem;font-weight:700;text-decoration:none;white-space:nowrap}.sermon-nav-submenu a:hover,.sermon-nav-submenu a:focus-visible{background:var(--linen);color:var(--forest)}.sermon-nav-submenu a[aria-current="page"]{background:#e4ece6;color:var(--forest);box-shadow:inset .16rem 0 var(--bronze)}.mobile-nav{display:none;position:relative}.mobile-nav>summary{display:flex;min-height:2.75rem;align-items:center;list-style:none;cursor:pointer;border:1px solid var(--line);border-radius:var(--radius-sm);padding:.55rem .8rem;font-weight:800}.mobile-nav>summary::-webkit-details-marker{display:none}.mobile-nav>nav{position:absolute;z-index:30;right:0;top:calc(100% + .5rem);width:min(18rem,calc(100vw - 2rem));display:grid;padding:.6rem;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--paper);box-shadow:var(--shadow)}.mobile-nav>nav>a,.mobile-sermon-toggle,.mobile-sermon-submenu a{display:flex;min-height:2.75rem;align-items:center;border-radius:.38rem;color:var(--ink);font:inherit;font-weight:700;text-decoration:none}.mobile-nav>nav>a{padding:.6rem .7rem}.mobile-nav>nav>a:hover,.mobile-sermon-toggle:hover,.mobile-sermon-submenu a:hover{background:var(--linen)}.mobile-nav>nav>a[aria-current="page"],.mobile-sermon-submenu a[aria-current="page"]{background:#e4ece6;color:var(--forest);box-shadow:inset .16rem 0 var(--bronze)}.mobile-sermon-section{display:grid}.mobile-sermon-toggle{width:100%;justify-content:space-between;padding:.6rem .7rem;border:0;background:transparent;cursor:pointer}.mobile-sermon-toggle.is-active-section{color:var(--forest);box-shadow:inset .16rem 0 var(--bronze)}.mobile-sermon-submenu{display:grid;margin:.08rem 0 .3rem .58rem;padding-left:.42rem;border-left:1px solid #c4cbc5}.mobile-sermon-submenu a{padding:.52rem .72rem}
      main{width:var(--page);margin:auto;padding:clamp(2.2rem,6vw,5rem) 0 6rem}h1,h2,h3{font-family:Georgia,"Times New Roman",serif;line-height:1.12;color:var(--forest);text-wrap:balance}h1{max-width:18ch;margin:.45rem 0 1rem;font-size:clamp(2.45rem,7.5vw,5.6rem);font-weight:500;letter-spacing:-.035em}h2{margin:0 0 1rem;font-size:clamp(1.65rem,4vw,2.65rem);font-weight:500;letter-spacing:-.02em}h3{font-size:1.3rem}p{max-width:72ch}.eyebrow{margin:0;color:var(--bronze);font-size:.74rem;font-weight:850;letter-spacing:.15em;text-transform:uppercase}.lede{font-family:Georgia,"Times New Roman",serif;font-size:clamp(1.1rem,2.4vw,1.42rem);line-height:1.55;color:#3c4941}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:0 0 1.3rem}.section-heading p{margin:0;color:var(--muted)}
      .hero{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(17rem,.8fr);gap:clamp(2rem,6vw,5rem);align-items:center;padding:clamp(2rem,6vw,5rem);margin:-1rem 0 4rem;border:1px solid #cfc4b1;border-radius:var(--radius-lg);background:linear-gradient(135deg,#fffdf8 0 59%,#e7ddca 59%);box-shadow:var(--shadow)}.hero::after{content:"";position:absolute;right:-5rem;bottom:-8rem;width:21rem;height:21rem;border:1px solid rgba(165,108,42,.32);border-radius:50%;box-shadow:0 0 0 2rem rgba(255,255,255,.16),0 0 0 4rem rgba(165,108,42,.07)}.hero-copy{position:relative;z-index:1}.hero-actions,.filter-actions{display:flex;align-items:center;flex-wrap:wrap;gap:.75rem;margin-top:1.35rem}.hero-note{position:relative;z-index:1;padding:1.4rem;border-left:.22rem solid var(--bronze);background:rgba(255,253,248,.83)}.hero-note strong{display:block;font-family:Georgia,"Times New Roman",serif;font-size:1.25rem;color:var(--forest)}
      .button{display:inline-flex;align-items:center;justify-content:center;min-height:2.9rem;padding:.68rem 1.05rem;border:1px solid var(--forest);border-radius:var(--radius-sm);background:var(--forest);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}.button:hover{background:#0e3024}.button:disabled{cursor:not-allowed;opacity:.48}.button-secondary{border-color:#9aaa9f;background:transparent;color:var(--forest)}.button-secondary:hover{background:var(--paper)}
      .panel,.sermon-card,.landscape-card,.content-section,.related-card,.taxonomy-card{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius-md);box-shadow:0 .45rem 1.4rem rgba(35,48,40,.045)}.panel{padding:clamp(1.15rem,3vw,1.75rem)}.filter-primary{display:grid;grid-template-columns:minmax(13rem,1.45fr) repeat(3,minmax(9rem,1fr));gap:.85rem;align-items:end}.filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem}.filter-grid>.wide{grid-column:1/-1}.filter-field{display:grid;gap:.35rem;min-width:0}.filter-field label{font-size:.86rem;font-weight:800}.filter-field input,.filter-field select{width:100%;min-height:2.9rem;border:1px solid #96a198;border-radius:var(--radius-sm);background:#fff;color:var(--ink);padding:.62rem .72rem;font:inherit}.filter-field select:disabled{background:#eceeea;color:#6c746f}.advanced-search{margin-top:1rem;border-top:1px solid var(--line)}.advanced-search summary{width:max-content;max-width:100%;cursor:pointer;padding:1rem .15rem .35rem;color:var(--forest);font-weight:850}.advanced-search[open] summary{margin-bottom:.8rem}.advanced-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.passage-search{grid-column:1/-1;border:1px solid #c1c9c2;border-radius:.8rem;padding:.6rem;margin:.25rem 0 0}.passage-search legend{padding:0 .4rem;color:var(--forest);font-weight:850}.field-hint{color:var(--muted);margin:.1rem 0 .65rem}.picker-current-search{padding:.55rem .7rem;border-left:.22rem solid var(--bronze);background:#f6efe2}.bible-picker{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;align-items:start;padding:.25rem;border:1px solid #c7d0c9;border-radius:.35rem;background:#f1f3ef}.bible-picker[data-depth="book"]{grid-template-columns:minmax(0,1fr);max-width:24rem}.bible-picker[data-depth="chapter"]{grid-template-columns:repeat(2,minmax(0,1fr));max-width:calc(100% * 2 / 3)}.bible-picker-panel{min-width:0;padding:0;background:transparent}.bible-picker-panel+.bible-picker-panel{padding-left:.5rem;border-left:1px solid #c7d0c9}.bible-picker-panel[hidden]{display:none}.picker-panel-heading{display:flex;min-height:2.35rem;align-items:baseline;justify-content:space-between;gap:.4rem;padding:.05rem .18rem .35rem}.bible-picker-panel h3{margin:0;font-size:1.06rem}.picker-selection{overflow:hidden;margin:0;color:var(--muted);font-size:.76rem;line-height:1.2;text-align:right;text-overflow:ellipsis;white-space:nowrap}.picker-search-all{width:100%;min-height:2.75rem;margin-top:.55rem;padding:.45rem .55rem}.picker-back{display:none;width:100%;min-height:2.75rem;margin:0 0 .45rem;border:1px solid #8f9b92;border-radius:var(--radius-sm);background:#fff;color:var(--forest);font:inherit;font-weight:800;cursor:pointer}.bible-category-key{margin-top:.45rem}.bible-category-key summary{cursor:pointer;color:var(--forest);font-size:.76rem;font-weight:800}.bible-category-legend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.16rem .4rem;margin:.38rem 0 0;padding:0;list-style:none;font-size:.66rem;line-height:1.25}.bible-category-legend li{display:flex;align-items:center;gap:.26rem;min-width:0}.bible-category-legend span{flex:0 0 .68rem;width:.68rem;height:.68rem;border:1px solid #59665e;border-radius:.08rem}.bible-category-legend [data-category="law"] span,.bible-book-tile[data-category="law"]{background:#eadcc9}.bible-category-legend [data-category="history"] span,.bible-book-tile[data-category="history"]{background:#dbe7e7}.bible-category-legend [data-category="wisdom"] span,.bible-book-tile[data-category="wisdom"]{background:#ecdfd4}.bible-category-legend [data-category="major-prophets"] span,.bible-book-tile[data-category="major-prophets"]{background:#dce7d8}.bible-category-legend [data-category="minor-prophets"] span,.bible-book-tile[data-category="minor-prophets"]{background:#ead6d8}.bible-category-legend [data-category="gospels-acts"] span,.bible-book-tile[data-category="gospels-acts"]{background:#eeeacb}.bible-category-legend [data-category="pauline"] span,.bible-book-tile[data-category="pauline"]{background:#e8dbd2}.bible-category-legend [data-category="general"] span,.bible-book-tile[data-category="general"]{background:#dce7d8}.bible-category-legend [data-category="revelation"] span,.bible-book-tile[data-category="revelation"]{background:#ead6d8}.bible-tile-grid{display:grid;width:100%;grid-template-columns:repeat(5,minmax(0,1fr));gap:.125rem}.bible-tile{position:relative;display:grid;place-items:center;min-width:0;min-height:2.75rem;aspect-ratio:1;border:1px solid rgba(44,58,49,.24);border-radius:.12rem;color:var(--ink);font:inherit;font-size:clamp(.78rem,1.15vw,1rem);font-weight:650;line-height:1;cursor:pointer}.bible-number-tile{background:#d7e0e6}.bible-tile:hover{border-color:#173f31;filter:brightness(.96)}.bible-tile[aria-pressed="true"]{border-color:#173f31;background:#173f31;color:#fff;box-shadow:inset 0 0 0 .12rem #fff}.bible-tile[aria-pressed="true"]::after{content:"✓";position:absolute;right:.18rem;bottom:.08rem;font-size:.64rem;font-weight:900}.bible-tile[data-applied="true"]{border-width:.18rem;border-color:#8b561d}.bible-tile .tile-applied-marker{display:none;position:absolute;right:.16rem;top:.02rem;color:#6d3f10;font-size:.8rem}.bible-tile[data-applied="true"] .tile-applied-marker{display:block}.bible-tile[aria-pressed="true"] .tile-applied-marker{color:#fff}.active-filters{display:flex;flex-wrap:wrap;gap:.5rem;padding:0;list-style:none}.active-filters li,.tag{display:inline-block;border:1px solid #ccd4cd;border-radius:999px;background:#eef2ed;padding:.28rem .62rem;font-size:.88rem}.result-status{margin:1.7rem 0;font-weight:750}
      .sermon-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.15rem}.sermon-card{min-width:0;display:flex;flex-direction:column;gap:.75rem;padding:1.35rem;transition:transform .18s ease,box-shadow .18s ease}.sermon-card:hover,.landscape-card:hover{transform:translateY(-.2rem);box-shadow:var(--shadow)}.sermon-card h2,.sermon-card h3{margin:0;font-size:clamp(1.3rem,2.7vw,1.65rem)}.sermon-card h2 a,.sermon-card h3 a{color:var(--forest);text-decoration:none}.sermon-card p{margin:0}.card-meta{color:var(--muted);font-size:.91rem}.card-description{display:-webkit-box;overflow:hidden;color:#34423a;-webkit-box-orient:vertical;-webkit-line-clamp:4}.card-link{margin-top:auto;font-weight:800}.tag-list{display:flex;flex-wrap:wrap;gap:.38rem;margin:.1rem 0;padding:0;list-style:none}.tag-list a{display:inline-block;border-radius:999px;background:#edf0eb;padding:.26rem .58rem;color:#3a5043;font-size:.84rem;text-decoration:none}.discovery-section{margin-top:3.4rem}.landscape-list{display:grid;gap:1.15rem}.landscape-card{min-width:0;display:grid;grid-template-columns:minmax(11rem,15rem) minmax(0,1fr);gap:clamp(1rem,3vw,2rem);padding:clamp(1.1rem,3vw,1.75rem);transition:transform .18s ease,box-shadow .18s ease}.landscape-card h2,.landscape-card h3{margin:.15rem 0 .75rem;font-size:clamp(1.5rem,3vw,2.15rem)}.landscape-card h2 a,.landscape-card h3 a{color:var(--forest);text-decoration:none}.landscape-meta{display:grid;align-content:start;gap:.65rem;padding-right:1rem;border-right:1px solid var(--line);color:var(--muted);font-size:.92rem}.landscape-meta p,.landscape-description p{margin:0}.landscape-content{min-width:0;display:flex;flex-direction:column;align-items:flex-start}.landscape-description{width:100%;margin-bottom:1rem;color:#34423a}.landscape-description p+p{margin-top:.75rem}.landscape-card--compact{grid-template-columns:minmax(9rem,12rem) minmax(0,1fr);gap:clamp(.85rem,2vw,1.35rem);padding:clamp(.9rem,2vw,1.15rem)}.landscape-card--compact h3{margin:0 0 .45rem;font-size:clamp(1.35rem,2.25vw,1.72rem)}.landscape-card--compact .landscape-meta{gap:.32rem;padding-right:.8rem;font-size:.82rem;line-height:1.42}.landscape-description--clamped{display:-webkit-box;width:100%;margin:.15rem 0 .65rem;overflow:hidden;color:#34423a;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:5;line-clamp:5}.recent-mode-control{margin:1.25rem 0 0}.carousel-shell{position:relative}.carousel-heading{display:flex;align-items:center;justify-content:space-between;gap:1rem}.carousel-controls{display:flex;gap:.5rem}.carousel-controls .button{min-width:2.9rem;padding:.55rem}.carousel-track{display:flex;gap:1rem;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;scrollbar-width:thin;padding:.25rem .15rem 1rem}.carousel-track>.sermon-card{flex:0 0 clamp(16rem,30vw,21rem);scroll-snap-align:start}.series-name{margin:0;color:var(--bronze);font-size:.86rem;font-weight:850;letter-spacing:.08em;text-transform:uppercase}.series-name a{color:inherit}.carousel-empty{padding:1.25rem;border:1px dashed #8d9a91;border-radius:var(--radius-md);background:rgba(255,253,248,.72)}
      .picker-search-all:disabled{border-color:#8f9992;background:#e5e7e5;color:#4f5a53;opacity:1}
      .landscape-card--compact{min-height:18rem}
      .pagination{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:.48rem;margin-top:2.2rem}.pagination a,.pagination span{display:inline-flex;align-items:center;justify-content:center;min-width:2.8rem;min-height:2.8rem;border:1px solid #a9b1ab;border-radius:var(--radius-sm);padding:.4rem .72rem}.pagination [aria-current="page"]{background:var(--forest);color:#fff;border-color:var(--forest);font-weight:800}
      .sermon-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(16rem,20rem);gap:clamp(1.5rem,5vw,4rem);align-items:start}.sermon-main{min-width:0}.sermon-title{font-size:clamp(2.4rem,7vw,5rem)}.sermon-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem 1rem;margin:1.7rem 0 2rem;padding:1rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);color:var(--muted)}.sermon-meta p{margin:0}.sermon-meta strong{color:var(--ink)}.content-section{padding:clamp(1.2rem,3vw,2rem);margin:1.35rem 0}.sermon-description{font-family:Georgia,"Times New Roman",serif;font-size:1.08rem;line-height:1.82;border-left:.32rem solid var(--bronze)}.video-frame{position:relative;overflow:hidden;aspect-ratio:16/9;border-radius:.8rem;background:linear-gradient(145deg,#173f31,#0e271e);color:#fff}.video-consent{position:absolute;inset:0;display:grid;place-items:center;padding:1.5rem;text-align:center}.video-consent p{margin:.8rem auto;color:#dce7df}.video-consent .button{border-color:#fff;background:#fff;color:var(--forest)}.video-frame iframe{width:100%;height:100%;border:0}.media-links{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1rem}.transcript-disclosure,.qa-item{border:1px solid #c9d1ca;border-radius:.75rem;background:#fbfcf8}.transcript-disclosure summary,.qa-item summary{cursor:pointer;padding:1rem;font-weight:800;color:var(--forest)}.transcript-body,.qa-answer{padding:0 1rem 1rem;line-height:1.82;overflow-wrap:anywhere}.question-list{display:grid;gap:.85rem;margin:0;padding:0;list-style:none}.question-number{color:var(--bronze);font-size:.75rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}.related-list{display:grid;gap:1rem}.related-card{padding:1rem}.related-card h3{margin:.2rem 0}.related-reason{color:var(--muted);font-size:.88rem}.sticky-aside{position:sticky;top:1rem}.empty-state{padding:clamp(2rem,6vw,4rem);text-align:center;background:var(--paper);border:1px dashed #8d9a91;border-radius:var(--radius-md)}
      .taxonomy-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.taxonomy-card{padding:1.2rem}.taxonomy-card h2,.taxonomy-card h3{margin:.15rem 0}.private-state{padding:1rem;border:1px solid #c89f68;border-radius:.75rem;background:#fff5e4;color:#5c3a12}.skip-link{position:fixed;left:.75rem;top:-6rem;z-index:100;background:#fff;color:var(--forest);padding:.75rem 1rem;border-radius:.5rem;box-shadow:var(--shadow)}.skip-link:focus{top:.75rem}
      .site-footer{border-top:1px solid #263e32;background:var(--forest);color:#e9eee9}.footer-inner{width:var(--page);margin:auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2rem;padding:2.5rem 0}.footer-inner strong{font-family:Georgia,"Times New Roman",serif;font-size:1.2rem}.footer-inner p{margin:.35rem 0 0;color:#bdccc2}.footer-inner nav{display:flex;flex-wrap:wrap;gap:1rem}.footer-inner a{color:#fff}
      @media (max-width:60rem){.filter-primary,.filter-grid,.advanced-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sermon-grid,.taxonomy-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sermon-layout{grid-template-columns:1fr}.sticky-aside{position:static}.related-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:60rem) and (min-width:44.01rem){.landscape-card--compact{min-height:23rem}}
      @media (max-width:44rem){.desktop-nav{display:none}.mobile-nav{display:block}.hero{grid-template-columns:1fr;background:linear-gradient(150deg,#fffdf8,#e7ddca)}.hero-note{display:none}.sermon-meta{grid-template-columns:1fr}.footer-inner{grid-template-columns:1fr}.footer-inner nav{display:grid}.section-heading{display:block}.section-heading p{margin-top:.5rem}.landscape-card{grid-template-columns:1fr}.landscape-card--compact{padding:1rem}.landscape-card--compact .landscape-meta{padding:0 0 .75rem;border-right:0;border-bottom:1px solid var(--line)}.landscape-description--clamped{-webkit-line-clamp:6;line-clamp:6}.carousel-heading{align-items:flex-start}.bible-picker,.bible-picker[data-depth="book"],.bible-picker[data-depth="chapter"]{grid-template-columns:1fr;max-width:none}.bible-picker-panel+.bible-picker-panel{padding-left:0;border-left:0}.picker-back{display:block}.bible-picker[data-mobile-panel="book"] .bible-chapters-panel,.bible-picker[data-mobile-panel="book"] .bible-verses-panel,.bible-picker[data-mobile-panel="chapter"] .bible-books-panel,.bible-picker[data-mobile-panel="chapter"] .bible-verses-panel,.bible-picker[data-mobile-panel="verse"] .bible-books-panel,.bible-picker[data-mobile-panel="verse"] .bible-chapters-panel{display:none}}
      @media (max-width:44rem){.landscape-card--compact{min-height:0}}
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
  const sermonSections = [
    ["sermons", "Sermons"],
    ["speakers", "Speakers"],
    ["series", "Series"],
    ["books", "Bible books"]
  ] as const;
  const activeSermonSection = sermonSections.find(([section]) => (
    input.canonicalPath === `/${section}/` || input.canonicalPath.startsWith(`/${section}/`)
  ))?.[0] ?? null;
  const homeLink = `<a href="${homePath}"${input.canonicalPath === "/" ? ' aria-current="page"' : ""}>Home</a>`;
  const sermonSectionLinks = sermonSections.map(([section, label]) => (
    `<a href="${contextualPath(context, `/${section}/`)}"${activeSermonSection === section ? ' aria-current="page"' : ""}>${label}</a>`
  )).join("");
  const currentSectionMarker = activeSermonSection ? '<span class="sr-only">, current section</span>' : "";
  const desktopNavigation = context.mode === "preview"
    ? `${homeLink}<div class="sermon-nav" data-nav-disclosure><button id="sermon-nav-toggle" class="sermon-nav-toggle${activeSermonSection ? " is-active-section" : ""}" type="button" aria-expanded="false" aria-controls="sermon-nav-submenu" data-nav-disclosure-toggle>Sermons${currentSectionMarker}<span class="nav-chevron" aria-hidden="true">⌄</span></button><div id="sermon-nav-submenu" class="sermon-nav-submenu" data-nav-disclosure-panel hidden>${sermonSectionLinks}</div></div>`
    : `${homeLink}<a href="${sermonPath}"${activeSermonSection === "sermons" ? ' aria-current="page"' : ""}>Sermons</a>`;
  const mobileNavigation = context.mode === "preview"
    ? `${homeLink}<div class="mobile-sermon-section" data-nav-disclosure><button id="mobile-sermon-nav-toggle" class="mobile-sermon-toggle${activeSermonSection ? " is-active-section" : ""}" type="button" aria-expanded="false" aria-controls="mobile-sermon-nav-submenu" data-nav-disclosure-toggle>Sermons${currentSectionMarker}<span class="nav-chevron" aria-hidden="true">⌄</span></button><div id="mobile-sermon-nav-submenu" class="mobile-sermon-submenu" data-nav-disclosure-panel hidden>${sermonSectionLinks}</div></div>`
    : `${homeLink}<a href="${sermonPath}"${activeSermonSection === "sermons" ? ' aria-current="page"' : ""}>Sermons</a>`;
  const footerNavigation = context.mode === "preview"
    ? `<a href="${homePath}">Home</a>${sermonSections.map(([section, label]) => `<a href="${contextualPath(context, `/${section}/`)}">${label}</a>`).join("")}`
    : `<a href="${homePath}">Home</a><a href="${sermonPath}">Sermons</a>`;
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
    <header class="site-header-wrap"><div class="site-header"><a class="brand" href="${homePath}"><span class="brand-mark" aria-hidden="true">SG</span><span>Saving Grace<br />Bible Church</span></a><nav class="desktop-nav" aria-label="Primary">${desktopNavigation}</nav><details class="mobile-nav" data-mobile-nav><summary data-mobile-menu-toggle>Menu</summary><nav aria-label="Mobile primary">${mobileNavigation}</nav></details></div></header>
    <main id="main-content">${input.body}</main>
    <footer class="site-footer"><div class="footer-inner"><div><strong>Saving Grace Bible Church</strong></div><nav aria-label="Footer">${footerNavigation}</nav></div></footer>${context.mode === "preview" ? `<script data-navigation-enhancement>${navigationEnhancementScript}</script>` : ""}${input.inlineScript ? `<script>${input.inlineScript}</script>` : ""}
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
  if (query.passageScope) parameters.set("passageScope", query.passageScope);
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
  for (const name of ["passageBook", "passageChapter", "passageVerse", "passageEndVerse", "passageScope"]) {
    parameters.delete(name);
  }
  return `${contextualPath(context, archivePath)}${parameters.size ? `?${parameters.toString()}` : ""}`;
}

type PassageSearchScope = NonNullable<PublicSermonListQuery["passageScope"]>;

function effectivePassageScope(query: PublicSermonListQuery): PassageSearchScope | null {
  if (query.passageScope) return query.passageScope;
  if (query.passageVerse !== undefined) return "verse";
  if (query.passageChapter !== undefined) return "chapter";
  return query.passageBook ? "book" : null;
}

function categoryLabel(category: BibleBookCategory): string {
  return bibleBookCategories.find((item) => item.key === category)?.label ?? category;
}

function bibleBookTiles(selectedBook: string | undefined, appliedBook: string | undefined): string {
  return bibleBooks.map((book) => {
    const selectedBookState = book.slug === selectedBook;
    const applied = book.slug === appliedBook;
    return `<button class="bible-tile bible-book-tile" type="button" data-book-tile data-book="${book.slug}" data-book-name="${escapeHtml(book.canonicalName)}" data-category="${book.category}" data-chapters="${book.chapterCount}" data-verse-counts="${book.verseCounts.join(",")}" aria-label="${escapeHtml(`${book.canonicalName}, ${categoryLabel(book.category)}${applied ? ", current search" : ""}`)}" aria-pressed="${selectedBookState}" data-applied="${applied}"><span aria-hidden="true">${escapeHtml(book.abbreviation)}</span><span class="tile-applied-marker" aria-hidden="true">•</span></button>`;
  }).join("");
}

function numberedTiles(
  kind: "chapter" | "verse",
  maximum: number,
  selectedValue: number | undefined,
  appliedValue: number | undefined,
  accessiblePrefix: string
): string {
  return Array.from({ length: maximum }, (_, index) => index + 1).map((number) => {
    const selectedNumber = number === selectedValue;
    const applied = number === appliedValue;
    return `<button class="bible-tile bible-number-tile" type="button" data-${kind}-tile data-${kind}="${number}" aria-label="${escapeHtml(`${accessiblePrefix} ${number}${applied ? ", current search" : ""}`)}" aria-pressed="${selectedNumber}" data-applied="${applied}"><span>${number}</span><span class="tile-applied-marker" aria-hidden="true">•</span></button>`;
  }).join("");
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
  context = publicRenderContext,
  compact = false
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
  const description = sermon.summary
    ? compact
      ? `<p class="landscape-description--clamped">${escapeHtml(sermon.summary.replace(/\s+/gu, " ").trim())}</p>`
      : `<div class="landscape-description">${plainTextMarkup(sermon.summary)}</div>`
    : "";
  return `<article class="landscape-card${compact ? " landscape-card--compact" : ""}">
    <div class="landscape-meta"><p><strong>Service date</strong><br /><time datetime="${escapeHtml(sermon.serviceDate)}">${escapeHtml(formattedDate(sermon.serviceDate))}</time></p>${speaker}${series}${passage}</div>
    <div class="landscape-content"><${heading}><a href="${sermonPath}">${escapeHtml(sermon.title)}</a></${heading}>${description}<a class="card-link" href="${sermonPath}">Read the sermon <span aria-hidden="true">→</span></a></div>
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
  const passageScope = effectivePassageScope(input.query);
  const passageLabel = passageQueryLabel(input.query);
  const verseCount = passageBook && input.query.passageChapter !== undefined
    ? passageBook.verseCounts[input.query.passageChapter - 1] ?? 0
    : 0;
  const pickerDepth = input.query.passageChapter !== undefined ? "verse" : passageBook ? "chapter" : "book";
  const bookOrigin = input.query.book && input.query.passageBook
    ? "both"
    : input.query.passageBook
      ? "exact"
      : input.query.book
        ? "broad"
        : "none";
  const passageScopeLabel = passageScope === "book"
    ? "Whole book"
    : passageScope === "chapter"
      ? "Whole chapter"
      : passageScope === "verse"
        ? "Exact verse"
        : null;
  const passageSearch = `<fieldset class="passage-search"><legend>Browse by Bible passage</legend>
      <p class="field-hint">Select a book once to browse its chapters; double-click it or use the explicit button to search the whole book. Select a chapter once to browse its verses; double-click it or use the explicit button to search the whole chapter. Select a verse once to search that exact verse.</p>
      ${passageScopeLabel && passageLabel ? `<p class="picker-current-search"><strong>Current passage search:</strong> ${escapeHtml(passageScopeLabel)} — ${escapeHtml(passageLabel)}</p>` : ""}
      <input id="passage-book" name="passageBook" type="hidden" value="${escapeHtml(input.query.passageBook ?? "")}"${input.query.passageBook ? "" : " disabled"} />
      <input id="passage-chapter" name="passageChapter" type="hidden" value="${input.query.passageChapter ?? ""}"${input.query.passageChapter === undefined ? " disabled" : ""} />
      <input id="passage-verse" name="passageVerse" type="hidden" value="${input.query.passageVerse ?? ""}"${input.query.passageVerse === undefined ? " disabled" : ""} />
      <input id="passage-scope" name="passageScope" type="hidden" value="${passageScope ?? ""}"${passageScope ? "" : " disabled"} />
      <div class="bible-picker" data-bible-picker data-depth="${pickerDepth}" data-mobile-panel="${pickerDepth}">
        <section class="bible-picker-panel bible-books-panel" aria-labelledby="bible-books-heading" data-books-panel>
          <div class="picker-panel-heading"><h3 id="bible-books-heading" tabindex="-1">Books</h3></div>
          <div class="bible-tile-grid bible-book-grid" data-tile-grid="book" role="group" aria-label="Bible books">${bibleBookTiles(input.query.passageBook, passageScope ? input.query.passageBook : undefined)}</div>
          <details class="bible-category-key"><summary>Book colour key</summary><ul class="bible-category-legend" aria-label="Bible book colour categories">${bibleBookCategories.map((category) => `<li data-category="${category.key}"><span aria-hidden="true"></span>${escapeHtml(category.label)}</li>`).join("")}</ul></details>
        </section>
        <section class="bible-picker-panel bible-chapters-panel" aria-labelledby="bible-chapters-heading" data-chapters-panel${passageBook ? "" : " hidden"}>
          <button class="picker-back" type="button" data-back-to-books><span aria-hidden="true">←</span> Back to books</button>
          <div class="picker-panel-heading"><h3 id="bible-chapters-heading" tabindex="-1">Chapters</h3><p class="picker-selection" data-book-selection>${passageBook ? `${escapeHtml(passageBook.canonicalName)} selected` : ""}</p></div>
          <div class="bible-tile-grid bible-number-grid" data-tile-grid="chapter" role="group" aria-label="Chapters">${passageBook ? numberedTiles("chapter", passageBook.chapterCount, input.query.passageChapter, passageScope === "chapter" || passageScope === "verse" ? input.query.passageChapter : undefined, `${passageBook.canonicalName} chapter`) : ""}</div>
          <button class="button button-secondary picker-search-all" type="button" data-search-whole-book${passageBook ? "" : " disabled"}>${passageBook ? `Search all of ${escapeHtml(passageBook.canonicalName)}` : "Search the whole book"}</button>
        </section>
        <section class="bible-picker-panel bible-verses-panel" aria-labelledby="bible-verses-heading" data-verses-panel${input.query.passageChapter === undefined ? " hidden" : ""}>
          <button class="picker-back" type="button" data-back-to-chapters><span aria-hidden="true">←</span> Back to chapters</button>
          <div class="picker-panel-heading"><h3 id="bible-verses-heading" tabindex="-1">Verses</h3><p class="picker-selection" data-chapter-selection>${passageBook && input.query.passageChapter !== undefined ? `${escapeHtml(passageBook.canonicalName)} ${input.query.passageChapter} selected` : ""}</p></div>
          <div class="bible-tile-grid bible-number-grid" data-tile-grid="verse" role="group" aria-label="Verses">${passageBook && input.query.passageChapter !== undefined ? numberedTiles("verse", verseCount, input.query.passageVerse, passageScope === "verse" ? input.query.passageVerse : undefined, `${passageBook.canonicalName} ${input.query.passageChapter} verse`) : ""}</div>
          <button class="button button-secondary picker-search-all" type="button" data-search-whole-chapter${input.query.passageChapter === undefined ? " disabled" : ""}>${passageBook && input.query.passageChapter !== undefined ? `Search all of ${escapeHtml(passageBook.canonicalName)} ${input.query.passageChapter}` : "Search the whole chapter"}</button>
        </section>
      </div>
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-passage-announcement></p>
      <noscript><p>The passage tile picker needs JavaScript. Keyword search and the Bible book filter above remain available without it.</p></noscript>
      <div class="filter-actions"><a class="button button-secondary" href="${escapeHtml(passageClearUrl(input.query, context))}">Clear passage</a></div>
    </fieldset>`;
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
    ? `<section class="discovery-section" aria-labelledby="most-recent-sermons"><div class="section-heading"><div><h2 id="most-recent-sermons">Most Recent Sermons</h2></div></div>${input.sermons.length ? `<div class="landscape-list">${input.sermons.slice(0, 3).map((sermon) => landscapeSermonCard(sermon, 3, context, true)).join("")}</div>` : resultCards}<p class="recent-mode-control"><a class="button button-secondary" href="${contextualPath(context, archivePath)}?view=recent#sermon-results">Show more recent sermons</a></p></section>${sermonCarousel({ id: "topical-sermons", heading: "Topical sermons", cards: input.topicalSermons.map((sermon) => sermonCard(sermon, 3, context)), emptyMessage: "No sermons have an approved topical classification yet." })}${sermonCarousel({ id: "series-sermons", heading: "Series", cards: input.seriesRepresentatives.map((item) => seriesRepresentativeCard(item, context)), emptyMessage: "No eligible sermon series are available yet." })}`
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
    inlineScript: completeArchiveEnhancementScript
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
