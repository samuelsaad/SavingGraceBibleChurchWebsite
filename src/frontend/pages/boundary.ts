/**
 * Not-found, private and error states rendered inside the normal shell so a
 * visitor always has the site's navigation available.
 */
import { boundaryArt } from "../components/marks";
import { html } from "../html";
import { archivePath, contextualPath, publicRenderContext, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";

export interface BoundaryPageInput {
  title: string;
  message: string;
  kind?: "not-found" | "private" | "error";
}

const kindLabels = {
  "not-found": "Not found",
  private: "Private content",
  error: "Something went wrong"
} as const;

export function renderFrontendBoundaryPage(
  input: BoundaryPageInput,
  context: FrontendRenderContext = publicRenderContext
): string {
  const kind = input.kind ?? "not-found";
  return pageShell({
    title: input.title,
    canonicalPath: "/sermons/",
    suppressCanonical: true,
    robots: "noindex, nofollow",
    body: html`<div class="boundary">
      <div>
        <h1>${input.title}</h1>
        <p class="title-page__category">${kindLabels[kind]}</p>
        <p class="boundary__message lede">${input.message}</p>
        <p><a class="button" href="${contextualPath(context, archivePath)}">Browse sermons</a></p>
      </div>
      ${boundaryArt(kind)}
    </div>`
  }, context);
}
