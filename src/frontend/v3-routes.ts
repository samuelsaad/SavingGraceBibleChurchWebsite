import type { PublicSermonListQuery } from "../api/contracts/public-sermons";
import { contextualPath, standardizedFilterParameters, type FrontendRenderContext } from "./routes";

/** Alternate presentation; the existing home, archive and detail URLs stay intact. */
export const sermonsV3Path = "/sermons-v3/";

export function sermonsV3Url(context: FrontendRenderContext, query?: PublicSermonListQuery, page = 1): string {
  const path = contextualPath(context, page === 1 ? sermonsV3Path : `${sermonsV3Path}page/${page}/`);
  const parameters = query ? standardizedFilterParameters(query) : new URLSearchParams();
  return `${path}${parameters.size ? `?${parameters.toString()}` : ""}`;
}
