import type { SermonDetail } from "../../domain/sermon";
import type { PublicSermonRepository } from "../repositories/sermon-repository";

const canonicalOrigin = "https://www.savinggrace.org.au";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function plainTextMarkup(value: string): string {
  return value
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export function renderPublicSermonPage(sermon: SermonDetail): string {
  const canonicalPath = `/sermons/${sermon.slug}/`;
  const canonicalUrl = `${canonicalOrigin}${canonicalPath}`;
  const transcript = sermon.transcript
    ? `<section aria-labelledby="transcript-heading">
        <h2 id="transcript-heading">Full transcript</h2>
        <details class="transcript-disclosure">
          <summary>Read full transcript</summary>
          <div class="transcript-body">${plainTextMarkup(sermon.transcript.bodyText)}</div>
        </details>
      </section>`
    : "";
  const questions = sermon.questionAnswers.length
    ? `<section aria-labelledby="questions-heading">
        <h2 id="questions-heading">Questions for reflection</h2>
        <ol class="question-list">${sermon.questionAnswers
          .map(
            (item) => `<li>
              <h3>${escapeHtml(item.question)}</h3>
              <div>${plainTextMarkup(item.answer)}</div>
            </li>`
          )
          .join("")}</ol>
      </section>`
    : "";
  const scripture = sermon.scriptureReferences.length
    ? `<p><strong>Scripture:</strong> ${sermon.scriptureReferences
        .map((item) => escapeHtml(item.displayText))
        .join(", ")}</p>`
    : "";
  const media = sermon.media.length
    ? `<ul class="media-list">${sermon.media
        .map(
          (item) => `<li><a href="${escapeHtml(item.canonicalUrl)}" rel="noopener noreferrer">${escapeHtml(item.title)}</a></li>`
        )
        .join("")}</ul>`
    : "";

  return `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonicalUrl}" />
    <title>${escapeHtml(sermon.title)} — Saving Grace Bible Church</title>
    <style>
      :root{font-family:system-ui,sans-serif;color:#18251f;background:#f7f8f6}body{margin:0}main{width:min(52rem,calc(100% - 2rem));margin:auto;padding:3rem 0 5rem}a{color:#174f38}h1,h2,h3{font-family:Georgia,serif;line-height:1.15}h1{font-size:clamp(2rem,6vw,3.5rem)}.meta{color:#5c6c64}.transcript-disclosure{border:1px solid #d8e1dc;border-radius:.75rem;background:white}.transcript-disclosure summary{cursor:pointer;padding:1rem;font-weight:750}.transcript-body{padding:0 1rem 1rem;line-height:1.75}.question-list{display:grid;gap:1rem;padding-left:1.5rem}.question-list li{padding:1rem;border-left:.25rem solid #ba8b37;background:white}.media-list{padding-left:1.25rem}
    </style>
  </head>
  <body>
    <main>
      <article>
        <p><a href="/sermons/">Sermons</a></p>
        <h1>${escapeHtml(sermon.title)}</h1>
        <div class="meta">
          <p>${escapeHtml(sermon.serviceDate)}${sermon.speaker ? ` · ${escapeHtml(sermon.speaker.name)}` : ""}</p>
          ${scripture}
        </div>
        ${sermon.summary ? `<p>${escapeHtml(sermon.summary)}</p>` : ""}
        ${media}
        ${transcript}
        ${questions}
      </article>
    </main>
  </body>
</html>`;
}

export function createPublicSermonPageHandler(repository: PublicSermonRepository) {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const match = /^\/sermons\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/.exec(url.pathname);
    if (!match) return null;
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
    }
    const sermon = await repository.findPublishedBySlug(match[1]!);
    if (!sermon) {
      return new Response("<!doctype html><title>Sermon not found</title><h1>Sermon not found</h1>", {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow"
        }
      });
    }
    return new Response(renderPublicSermonPage(sermon), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' https:; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff"
      }
    });
  };
}
