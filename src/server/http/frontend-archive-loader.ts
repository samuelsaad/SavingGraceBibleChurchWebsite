/**
 * Loads everything the sermon archive page needs from the repository.
 *
 * Shared by the public site handler and the authenticated preview handler so
 * discovery rules (when carousels load, page-size, out-of-range pages) live in
 * exactly one place.
 */
import { publicSermonListQuerySchema, type PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { translateLegacySermonQuery } from "../../api/legacy-sermon-query";
import { archivePageSize, hasActiveSermonFilters } from "../../frontend/routes";
import type { PublicSermonRepository } from "../repositories/sermon-repository";
import type { SermonArchivePageInput } from "../../frontend/pages/archive";

export type ArchivePageLoad =
  | { kind: "page"; input: SermonArchivePageInput; query: PublicSermonListQuery }
  | { kind: "not-found" };

/**
 * Parses the legacy-compatible query, loads the page and, on the unfiltered
 * first page only, the discovery sections. Throws ZodError or
 * InvalidLegacySermonQueryError for invalid input, which callers map to 400.
 */
export async function loadArchivePage(
  repository: PublicSermonRepository,
  searchParams: URLSearchParams,
  pathPage: number | null
): Promise<ArchivePageLoad> {
  const translated = translateLegacySermonQuery(searchParams);
  const query = publicSermonListQuerySchema.parse({
    ...translated,
    page: pathPage ?? translated.page ?? 1,
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
  if (query.page > 1 && (totalPages === 0 || query.page > totalPages)) return { kind: "not-found" };
  return {
    kind: "page",
    query,
    input: {
      sermons: result.data,
      totalItems: result.totalItems,
      query,
      options,
      topicalSermons,
      seriesRepresentatives,
      hasQueryParameters: searchParams.size > 0
    }
  };
}
