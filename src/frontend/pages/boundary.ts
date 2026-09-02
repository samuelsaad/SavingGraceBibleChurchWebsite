/**
 * Not-found, private and error states rendered inside the normal shell so a
 * visitor always has the site's navigation available.
 */
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
  return pageShell({
    title: input.title,
    canonicalPath: "/sermons/",
    robots: "noindex, nofollow",
    body: html`<div class="boundary">
      <p class="page-head__kind">${kindLabels[input.kind ?? "not-found"]}</p>
      <h1>${input.title}</h1>
      <p class="boundary__message">${input.message}</p>
      <p><a class="button" href="${contextualPath(context, archivePath)}">Browse sermons</a></p>
    </div>`
  }, context);
}
