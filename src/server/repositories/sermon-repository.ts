import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../../domain/sermon";

export interface PaginatedSermons {
  data: SermonSummary[];
  totalItems: number;
}

export interface PublicSermonRepository {
  listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons>;
  findPublishedBySlug(slug: string): Promise<SermonDetail | null>;
}
