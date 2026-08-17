import { ZodError } from "zod";
import {
  publicSermonListQuerySchema,
  type PublicSermonListQuery
} from "../../api/contracts/public-sermons";
import {
  InvalidLegacySermonQueryError,
  translateLegacySermonQuery
} from "../../api/legacy-sermon-query";
import type { RelatedSermonSummary, SermonDetail, SermonSummary } from "../../domain/sermon";
import type {
  PublicSermonFilterOption,
  PublicSermonFilterOptions,
  PublicSermonRepository
} from "../repositories/sermon-repository";

const canonicalOrigin = "https://www.savinggrace.org.au";
const archivePath = "/sermons/";
const archivePageSize = 9;

const responseHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' https:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff"
};

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

function archivePagePath(page: number): string {
  return page <= 1 ? archivePath : `/sermons/page/${page}/`;
}

function filterUrl(name: string, value: string): string {
  const parameters = new URLSearchParams({ [name]: value });
  return `${archivePath}?${parameters.toString()}`;
}

function commonStyles(): string {
  return `
      :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17241e;background:#f4f6f3;line-height:1.5;color-scheme:light}
      *{box-sizing:border-box}body{margin:0}a{color:#155b40;text-underline-offset:.18em}a:hover{text-decoration-thickness:.14em}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:.2rem solid #b27613;outline-offset:.2rem}
      header{background:#123f2d;color:#fff}.site-header{width:min(72rem,calc(100% - 2rem));margin:auto;padding:1rem 0;display:flex;align-items:center;justify-content:space-between;gap:1rem}.site-header a{color:#fff}.brand{font-family:Georgia,serif;font-size:1.15rem;font-weight:700;text-decoration:none}
      main{width:min(72rem,calc(100% - 2rem));margin:auto;padding:2.5rem 0 5rem}h1,h2,h3{font-family:Georgia,serif;line-height:1.15;color:#163829}h1{font-size:clamp(2.1rem,7vw,4.4rem);margin:.5rem 0 1rem}h2{font-size:clamp(1.5rem,4vw,2.25rem)}p{max-width:72ch}.eyebrow{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#8f6215}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      .panel,.sermon-card,.content-section,.related-card{background:#fff;border:1px solid #d7e0da;border-radius:1rem;box-shadow:0 .45rem 1.5rem rgba(20,55,40,.06)}.panel{padding:clamp(1rem,3vw,1.5rem)}
      .filter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.filter-field{display:grid;gap:.35rem}.filter-field label{font-weight:750}.filter-field input,.filter-field select{width:100%;min-height:2.75rem;border:1px solid #8fa199;border-radius:.55rem;background:#fff;color:#17241e;padding:.6rem .7rem;font:inherit}.filter-actions{display:flex;align-items:center;flex-wrap:wrap;gap:.75rem;margin-top:1rem}.button{display:inline-flex;align-items:center;justify-content:center;min-height:2.75rem;padding:.65rem 1rem;border:0;border-radius:.55rem;background:#155b40;color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}.button-secondary{background:#fff;color:#155b40;border:1px solid #155b40}
      .active-filters{display:flex;flex-wrap:wrap;gap:.5rem;padding:0;list-style:none}.active-filters li{background:#e7eee9;border-radius:999px;padding:.35rem .7rem}.result-status{margin:1.5rem 0;font-weight:700}.sermon-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.sermon-card{padding:1.25rem;display:flex;flex-direction:column;gap:.65rem}.sermon-card h2,.sermon-card h3{margin:0;font-size:1.35rem}.sermon-card p{margin:0}.card-meta{color:#53675d;font-size:.95rem}.card-description{color:#30463b}.tag-list{display:flex;flex-wrap:wrap;gap:.4rem;padding:0;list-style:none}.tag-list li{font-size:.9rem}.tag-list a,.tag{display:inline-block;background:#edf2ee;border-radius:999px;padding:.25rem .55rem;text-decoration:none}
      .pagination{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:.5rem;margin-top:2rem}.pagination a,.pagination span{display:inline-flex;align-items:center;justify-content:center;min-width:2.75rem;min-height:2.75rem;border:1px solid #a9b8b0;border-radius:.55rem;padding:.4rem .7rem}.pagination [aria-current="page"]{background:#123f2d;color:#fff;border-color:#123f2d;font-weight:800}
      .sermon-layout{display:grid;grid-template-columns:minmax(0,1fr) 18rem;gap:2rem;align-items:start}.sermon-main{min-width:0}.sermon-meta{color:#53675d}.sermon-meta p{margin:.4rem 0}.content-section{padding:clamp(1rem,3vw,1.5rem);margin:1.25rem 0}.sermon-description{font-size:1.08rem;line-height:1.75;border-left:.35rem solid #c78927}.media-list{padding-left:1.25rem}.transcript-disclosure{border:1px solid #cbd8d0;border-radius:.75rem;background:#fbfcfb}.transcript-disclosure summary{cursor:pointer;padding:1rem;font-weight:800}.transcript-body{padding:0 1rem 1rem;line-height:1.8;overflow-wrap:anywhere}.question-list{display:grid;gap:1rem;padding-left:1.5rem}.question-list li{padding:1rem;border-left:.25rem solid #c78927;background:#f8faf8}.question-list h3{font-size:1.1rem}.related-list{display:grid;gap:1rem}.related-card{padding:1rem}.related-card h3{margin:.2rem 0}.related-reason{color:#53675d;font-size:.92rem}.empty-state{padding:2rem;text-align:center;background:#fff;border:1px dashed #8fa199;border-radius:1rem}
      .skip-link{position:absolute;left:.5rem;top:-5rem;background:#fff;color:#123f2d;padding:.75rem;z-index:2}.skip-link:focus{top:.5rem}
      @media (max-width:52rem){.sermon-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sermon-layout{grid-template-columns:1fr}.related-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:38rem){main{width:min(100% - 1.25rem,72rem);padding-top:1.5rem}.site-header{width:min(100% - 1.25rem,72rem)}.filter-grid,.sermon-grid,.related-list{grid-template-columns:1fr}.filter-actions{align-items:stretch}.filter-actions .button{width:100%}.sermon-card{padding:1rem}}
      @media (prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}
    `;
}

interface PageShellInput {
  title: string;
  description?: string;
  canonicalPath: string;
  robots: "index, follow" | "noindex, follow" | "noindex, nofollow";
  body: string;
  openGraphType?: "website" | "article";
}

function pageShell(input: PageShellInput): string {
  const canonicalUrl = `${canonicalOrigin}${input.canonicalPath}`;
  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${input.robots}" />
    <title>${escapeHtml(input.title)}</title>
    ${input.description ? `<meta name="description" content="${escapeHtml(input.description)}" />` : ""}
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${input.openGraphType ?? "website"}" />
    <meta property="og:title" content="${escapeHtml(input.title)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${input.description ? `<meta property="og:description" content="${escapeHtml(input.description)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(input.title)}" />
    <meta name="twitter:description" content="${escapeHtml(input.description)}" />` : ""}
    <style>${commonStyles()}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <header><div class="site-header"><a class="brand" href="/">Saving Grace Bible Church</a><nav aria-label="Primary"><a href="/sermons/">Sermons</a></nav></div></header>
    <main id="main-content">${input.body}</main>
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
  if (query.dateFrom) parameters.set("dateFrom", query.dateFrom);
  if (query.dateTo) parameters.set("dateTo", query.dateTo);
  if (query.order !== "DESC") parameters.set("order", query.order);
  return parameters;
}

function paginationUrl(page: number, query: PublicSermonListQuery): string {
  const parameters = standardizedFilterParameters(query);
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return `${archivePagePath(page)}${suffix}`;
}

function sermonCard(sermon: SermonSummary, headingLevel: 2 | 3 = 2): string {
  const heading = `h${headingLevel}`;
  const relationships = [
    sermon.speaker
      ? `<li><a href="${filterUrl("sermon_speaker", sermon.speaker.slug)}">${escapeHtml(sermon.speaker.name)}</a></li>`
      : "",
    ...sermon.series.map(
      (item) => `<li><a href="${filterUrl("sermon_series", item.slug)}">${escapeHtml(item.name)}</a></li>`
    ),
    ...sermon.books.map(
      (item) => `<li><a href="${filterUrl("sermon_book", item.slug)}">${escapeHtml(item.name)}</a></li>`
    )
  ].filter(Boolean);
  return `<article class="sermon-card">
    <p class="card-meta"><time datetime="${escapeHtml(sermon.serviceDate)}">${escapeHtml(formattedDate(sermon.serviceDate))}</time></p>
    <${heading}><a href="/sermons/${encodeURIComponent(sermon.slug)}/">${escapeHtml(sermon.title)}</a></${heading}>
    ${sermon.scriptureReferences.length ? `<p class="card-meta">${sermon.scriptureReferences.map((item) => escapeHtml(item.displayText)).join(", ")}</p>` : ""}
    ${relationships.length ? `<ul class="tag-list" aria-label="Sermon classifications">${relationships.join("")}</ul>` : ""}
    ${sermon.summary ? `<p class="card-description">${escapeHtml(sermon.summary)}</p>` : ""}
  </article>`;
}

function activeFiltersMarkup(
  query: PublicSermonListQuery,
  options: PublicSermonFilterOptions
): string {
  const active = [
    query.query ? `Search: ${query.query}` : "",
    query.speaker ? `Speaker: ${optionName(options.speakers, query.speaker)}` : "",
    query.series ? `Series: ${optionName(options.series, query.series)}` : "",
    query.passage ? `Scripture: ${optionName(options.passages, query.passage)}` : "",
    query.book ? `Bible book: ${optionName(options.books, query.book)}` : "",
    query.dateFrom ? `From: ${query.dateFrom}` : "",
    query.dateTo ? `To: ${query.dateTo}` : "",
    query.order === "ASC" ? "Oldest first" : ""
  ].filter(Boolean);
  if (!active.length) return "";
  return `<section aria-labelledby="active-filters-heading">
    <h2 id="active-filters-heading">Active filters</h2>
    <ul class="active-filters">${active.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <p><a href="/sermons/">Clear all filters</a></p>
  </section>`;
}

export function renderPublicSermonArchivePage(input: {
  sermons: SermonSummary[];
  totalItems: number;
  query: PublicSermonListQuery;
  options: PublicSermonFilterOptions;
  hasQueryParameters: boolean;
}): string {
  const totalPages = Math.ceil(input.totalItems / input.query.pageSize);
  const description = "Browse published sermons from Saving Grace Bible Church by speaker, series, Scripture, Bible book, or service date.";
  const resultLabel = input.totalItems === 1 ? "1 published sermon" : `${input.totalItems} published sermons`;
  const filters = `<section class="panel" aria-labelledby="find-sermons-heading">
    <h2 id="find-sermons-heading">Find sermons</h2>
    <form method="get" action="/sermons/" role="search">
      <div class="filter-grid">
        <div class="filter-field"><label for="sermon-search">Search</label><input id="sermon-search" name="s" type="search" maxlength="120" value="${escapeHtml(input.query.query ?? "")}" autocomplete="off" /></div>
        <div class="filter-field"><label for="speaker-filter">Speaker</label><select id="speaker-filter" name="sermon_speaker">${optionsMarkup(input.options.speakers, input.query.speaker, "All speakers")}</select></div>
        <div class="filter-field"><label for="series-filter">Series</label><select id="series-filter" name="sermon_series">${optionsMarkup(input.options.series, input.query.series, "All series")}</select></div>
        <div class="filter-field"><label for="passage-filter">Scripture passage</label><select id="passage-filter" name="sermon_topics">${optionsMarkup(input.options.passages, input.query.passage, "All passages")}</select></div>
        <div class="filter-field"><label for="book-filter">Bible book</label><select id="book-filter" name="sermon_book">${optionsMarkup(input.options.books, input.query.book, "All books")}</select></div>
        <div class="filter-field"><label for="sort-order">Order</label><select id="sort-order" name="order"><option value="DESC"${selected(input.query.order, "DESC")}>Newest first</option><option value="ASC"${selected(input.query.order, "ASC")}>Oldest first</option></select></div>
        <div class="filter-field"><label for="date-from">Service date from</label><input id="date-from" name="dateFrom" type="date" value="${escapeHtml(input.query.dateFrom ?? "")}" /></div>
        <div class="filter-field"><label for="date-to">Service date to</label><input id="date-to" name="dateTo" type="date" value="${escapeHtml(input.query.dateTo ?? "")}" /></div>
      </div>
      <div class="filter-actions"><button class="button" type="submit">Apply filters</button><a class="button button-secondary" href="/sermons/">Clear filters</a></div>
    </form>
  </section>`;
  const results = input.sermons.length
    ? `<div class="sermon-grid">${input.sermons.map((sermon) => sermonCard(sermon)).join("")}</div>`
    : `<div class="empty-state"><h2>No published sermons matched</h2><p>Try removing a filter or using a different search.</p><p><a class="button" href="/sermons/">Show all sermons</a></p></div>`;
  const pagination = totalPages > 1
    ? `<nav class="pagination" aria-label="Sermon result pages">
        ${input.query.page > 1 ? `<a href="${paginationUrl(input.query.page - 1, input.query)}" rel="prev">Previous</a>` : ""}
        ${Array.from({ length: totalPages }, (_, index) => index + 1)
          .filter((page) => page === 1 || page === totalPages || Math.abs(page - input.query.page) <= 2)
          .map((page, index, pages) => `${index > 0 && page - pages[index - 1]! > 1 ? `<span aria-hidden="true">…</span>` : ""}${page === input.query.page ? `<span aria-current="page"><span class="sr-only">Page </span>${page}</span>` : `<a href="${paginationUrl(page, input.query)}">${page}</a>`}`)
          .join("")}
        ${input.query.page < totalPages ? `<a href="${paginationUrl(input.query.page + 1, input.query)}" rel="next">Next</a>` : ""}
      </nav>`
    : "";

  return pageShell({
    title: input.query.query ? "Search sermons — Saving Grace Bible Church" : "Sermons — Saving Grace Bible Church",
    description,
    canonicalPath: archivePagePath(input.query.page),
    robots: input.hasQueryParameters ? "noindex, follow" : "index, follow",
    body: `<p class="eyebrow">Sermon library</p><h1>Sermons</h1><p>${description}</p>${filters}${activeFiltersMarkup(input.query, input.options)}<p class="result-status" role="status" aria-live="polite">${escapeHtml(resultLabel)}${totalPages ? ` · Page ${input.query.page} of ${totalPages}` : ""}</p>${results}${pagination}`
  });
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

export function renderPublicSermonPage(sermon: SermonDetail): string {
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
            (item) => `<li><h3>${escapeHtml(item.question)}</h3><div>${plainTextMarkup(item.answer)}</div></li>`
          )
          .join("")}</ol>
      </section>`
    : "";
  const scripture = sermon.scriptureReferences.length
    ? `<p><strong>Scripture:</strong> ${sermon.scriptureReferences.map((item) => escapeHtml(item.displayText)).join(", ")}</p>`
    : "";
  const speaker = sermon.speaker
    ? `<p><strong>Speaker:</strong> <a href="${filterUrl("sermon_speaker", sermon.speaker.slug)}">${escapeHtml(sermon.speaker.name)}</a></p>`
    : "";
  const series = sermon.series.length
    ? `<p><strong>Series:</strong> ${sermon.series.map((item) => `<a href="${filterUrl("sermon_series", item.slug)}">${escapeHtml(item.name)}</a>`).join(", ")}</p>`
    : "";
  const books = sermon.books.length
    ? `<p><strong>Bible book:</strong> ${sermon.books.map((item) => `<a href="${filterUrl("sermon_book", item.slug)}">${escapeHtml(item.name)}</a>`).join(", ")}</p>`
    : "";
  const media = sermon.media.length
    ? `<section class="content-section" aria-labelledby="media-heading"><h2 id="media-heading">Watch or listen</h2><ul class="media-list">${sermon.media
        .map((item) => `<li><a href="${escapeHtml(item.canonicalUrl)}" rel="noopener noreferrer">${escapeHtml(item.title)}</a></li>`)
        .join("")}</ul></section>`
    : "";
  const related = sermon.relatedSermons.length
    ? `<aside aria-labelledby="related-heading"><h2 id="related-heading">Related sermons</h2><div class="related-list">${sermon.relatedSermons.map((item) => `<article class="related-card"><p class="eyebrow">${escapeHtml(formattedDate(item.serviceDate))}</p><h3><a href="/sermons/${encodeURIComponent(item.slug)}/">${escapeHtml(item.title)}</a></h3><p class="related-reason">Related by ${escapeHtml(relatedReasonLabel(item))}</p></article>`).join("")}</div></aside>`
    : "";

  return pageShell({
    title: `${sermon.title} — Saving Grace Bible Church`,
    ...(metadataDescription ? { description: metadataDescription } : {}),
    canonicalPath,
    robots: "index, follow",
    openGraphType: "article",
    body: `<p><a href="/sermons/">← All sermons</a></p><div class="sermon-layout"><article class="sermon-main"><p class="eyebrow">Sermon</p><h1>${escapeHtml(sermon.title)}</h1><div class="sermon-meta"><p><strong>Service date:</strong> <time datetime="${escapeHtml(sermon.serviceDate)}">${escapeHtml(formattedDate(sermon.serviceDate))}</time></p>${speaker}${series}${scripture}${books}</div>${sermon.summary ? `<section class="content-section sermon-description" aria-labelledby="description-heading"><h2 id="description-heading">About this sermon</h2>${plainTextMarkup(sermon.summary)}</section>` : ""}${media}${transcript}${questions}</article>${related}</div>`
  });
}

function renderErrorPage(status: 400 | 404 | 410 | 500, heading: string, message: string): Response {
  const body = pageShell({
    title: `${heading} — Saving Grace Bible Church`,
    canonicalPath: archivePath,
    robots: "noindex, nofollow",
    body: `<div class="empty-state"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(message)}</p><p><a class="button" href="/sermons/">Browse sermons</a></p></div>`
  });
  return new Response(body, { status, headers: responseHeaders });
}

function methodNotAllowed(): Response {
  return new Response("Method not allowed", {
    status: 405,
    headers: { ...responseHeaders, Allow: "GET" }
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
        const [result, options] = await Promise.all([
          repository.listPublished(query),
          repository.listPublishedFilterOptions()
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
          hasQueryParameters: url.searchParams.size > 0
        }), { status: 200, headers: responseHeaders });
      }

      if (detailMatch) {
        const sermon = await repository.findPublishedBySlug(detailMatch[1]!);
        if (sermon) {
          return new Response(renderPublicSermonPage(sermon), {
            status: 200,
            headers: responseHeaders
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
