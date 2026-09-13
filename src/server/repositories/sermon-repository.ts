import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../../domain/sermon";

export interface PaginatedSermons {
  data: SermonSummary[];
  totalItems: number;
}

export interface PublicSermonFilterOption {
  name: string;
  slug: string;
  /** Number of eligible sermons carrying this relationship, when the projection provides it. */
  sermonCount?: number | undefined;
}

export interface PublicPassageVerseAvailability {
  bookSlug: string;
  chapter: number;
  verses: number[];
}

export interface PublicSermonFilterOptions {
  speakers: PublicSermonFilterOption[];
  series: PublicSermonFilterOption[];
  passages: PublicSermonFilterOption[];
  books: PublicSermonFilterOption[];
  passageVerseAvailability: PublicPassageVerseAvailability[];
}

export interface PublicSeriesRepresentative {
  series: PublicSermonFilterOption;
  sermon: SermonSummary;
}

export interface PublicSermonSitemapEntry {
  slug: string;
  lastModified: string;
}

export type PublicSermonPathDisposition =
  | { kind: "redirect"; location: string }
  | { kind: "gone" };

export interface PublicSermonRepository {
  listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons>;
  findPublishedBySlug(slug: string): Promise<SermonDetail | null>;
  listPublishedFilterOptions(): Promise<PublicSermonFilterOptions>;
  listPublishedTopicalSermons(): Promise<SermonSummary[]>;
  listPublishedSeriesRepresentatives(): Promise<PublicSeriesRepresentative[]>;
  listPublishedSitemapEntries(): Promise<PublicSermonSitemapEntry[]>;
  findPublicPathDisposition(path: string): Promise<PublicSermonPathDisposition | null>;
}
