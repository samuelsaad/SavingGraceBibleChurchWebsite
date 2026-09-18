import type { QueryResult, QueryResultRow } from "pg";
import { z } from "zod";
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import {
  relatedSermonSummarySchema,
  sermonDetailSchema,
  sermonSummarySchema,
  type SermonDetail,
  type SermonSummary
} from "../../domain/sermon";
import {
  buildPublishedSermonCountQuery,
  buildPublishedSermonDetailQuery,
  buildPublishedSermonFilterOptionsQuery,
  buildPublishedSermonListQuery,
  buildPublishedSermonSitemapQuery,
  buildPublishedSeriesRepresentativesQuery,
  buildPublicSermonPathDispositionQuery,
  buildPublishedTopicalSermonsQuery,
  buildRelatedPublishedSermonsQuery
} from "../queries/public-sermons";
import type { FrontendSermonScope } from "../queries/public-sermons";
import type {
  PaginatedSermons,
  PublicSermonFilterOptions,
  PublicSermonPathDisposition,
  PublicSermonRepository,
  PublicSermonSitemapEntry,
  PublicSeriesRepresentative
} from "./sermon-repository";

export interface SqlExecutor {
  query(text: string, values?: unknown[]): Promise<QueryResult<QueryResultRow>>;
}

type PublicSermonRow = QueryResultRow & {
  id: string;
  title: string;
  slug: string;
  service_date: string;
  summary: string | null;
  speaker: unknown;
  series: unknown;
  scripture_references: unknown;
  primary_passages: unknown;
  primary_passage_state: unknown;
  books: unknown;
  primary_media: unknown;
  review_state?: unknown;
  total_items?: number;
  is_topical?: boolean;
};

type PublicSermonDetailRow = PublicSermonRow & {
  seo_description: string | null;
  body: string | null;
  media: unknown;
  transcript: unknown;
  question_answers: unknown;
  review_warnings?: unknown;
  review_provenance?: unknown;
};

type RelatedSermonRow = PublicSermonRow & {
  relationship_reasons: unknown;
};

type SeriesRepresentativeRow = PublicSermonRow & {
  representative_series: unknown;
};

const filterOptionSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  sermonCount: z.number().int().nonnegative().optional()
});

const filterOptionsSchema = z.object({
  speakers: z.array(filterOptionSchema),
  series: z.array(filterOptionSchema),
  passages: z.array(filterOptionSchema),
  books: z.array(filterOptionSchema),
  passageVerseAvailability: z.array(z.object({
    bookSlug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
    chapter: z.number().int().positive(),
    verses: z.array(z.number().int().min(1).max(176))
  }))
});

const sitemapEntrySchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  lastModified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

function summaryFromRow(row: PublicSermonRow): SermonSummary {
  return sermonSummarySchema.parse({
    id: row.id,
    title: row.title,
    slug: row.slug,
    serviceDate: row.service_date,
    summary: row.summary,
    speaker: row.speaker,
    series: row.series,
    scriptureReferences: row.scripture_references,
    primaryPassages: row.primary_passages,
    primaryPassageState: row.primary_passage_state,
    books: row.books,
    primaryMedia: row.primary_media,
    reviewState: row.review_state ?? undefined,
    isTopical: row.is_topical || undefined
  });
}

function detailFromRow(
  row: PublicSermonDetailRow,
  relatedSermons: SermonDetail["relatedSermons"]
): SermonDetail {
  return sermonDetailSchema.parse({
    ...summaryFromRow(row),
    seoDescription: row.seo_description ?? null,
    body: row.body,
    media: row.media,
    transcript: row.transcript,
    questionAnswers: row.question_answers,
    reviewWarnings: row.review_warnings ?? [],
    reviewProvenance: row.review_provenance ?? undefined,
    relatedSermons
  });
}

function relatedFromRow(row: RelatedSermonRow) {
  return relatedSermonSummarySchema.parse({
    ...summaryFromRow(row),
    relationshipReasons: row.relationship_reasons
  });
}

export class PostgresSermonRepository implements PublicSermonRepository {
  constructor(
    private readonly database: SqlExecutor,
    private readonly scope: FrontendSermonScope = "public"
  ) {}

  async listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons> {
    const statement = buildPublishedSermonListQuery(query, this.scope);
    const result = await this.database.query(statement.text, statement.values);
    const rows = result.rows as PublicSermonRow[];
    let totalItems = rows[0]?.total_items ?? 0;

    // A window count cannot report a total for an out-of-range page because it
    // returns no row. Preserve pagination metadata with one parameterized count.
    if (rows.length === 0 && query.page > 1) {
      const countStatement = buildPublishedSermonCountQuery(query, this.scope);
      const countResult = await this.database.query(
        countStatement.text,
        countStatement.values
      );
      totalItems = (countResult.rows as Array<{ total_items: number }>)[0]?.total_items ?? 0;
    }

    return {
      data: rows.map(summaryFromRow),
      totalItems
    };
  }

  async findPublishedBySlug(slug: string): Promise<SermonDetail | null> {
    const statement = buildPublishedSermonDetailQuery(slug, this.scope);
    const result = await this.database.query(statement.text, statement.values);
    const row = (result.rows as PublicSermonDetailRow[])[0];
    if (!row) return null;

    const relatedStatement = buildRelatedPublishedSermonsQuery(row.id, 3, this.scope);
    const relatedResult = await this.database.query(
      relatedStatement.text,
      relatedStatement.values
    );
    return detailFromRow(
      row,
      (relatedResult.rows as RelatedSermonRow[]).map(relatedFromRow)
    );
  }

  async listPublishedFilterOptions(query?: PublicSermonListQuery): Promise<PublicSermonFilterOptions> {
    const statement = buildPublishedSermonFilterOptionsQuery(this.scope, query);
    const result = await this.database.query(statement.text, statement.values);
    const row = result.rows[0] as
      | {
          speakers: unknown;
          series: unknown;
          passages: unknown;
          books: unknown;
          passage_verse_availability: unknown;
        }
      | undefined;
    return filterOptionsSchema.parse(row ? {
      speakers: row.speakers,
      series: row.series,
      passages: row.passages,
      books: row.books,
      passageVerseAvailability: row.passage_verse_availability
    } : {
      speakers: [], series: [], passages: [], books: [], passageVerseAvailability: []
    });
  }

  async listPublishedTopicalSermons(): Promise<SermonSummary[]> {
    if (this.scope !== "restricted_accepted" && this.scope !== "d161_restricted_accepted") return [];
    const statement = buildPublishedTopicalSermonsQuery(this.scope);
    return (await this.database.query(statement.text, statement.values)).rows.map(row => summaryFromRow(row as PublicSermonRow));
  }

  async listPublishedSeriesRepresentatives(): Promise<PublicSeriesRepresentative[]> {
    const statement = buildPublishedSeriesRepresentativesQuery(this.scope);
    const result = await this.database.query(statement.text, statement.values);
    return (result.rows as SeriesRepresentativeRow[]).map((row) => ({
      series: filterOptionSchema.parse(row.representative_series),
      sermon: summaryFromRow(row)
    }));
  }

  async listPublishedSitemapEntries(): Promise<PublicSermonSitemapEntry[]> {
    if (this.scope !== "public") return [];
    const statement = buildPublishedSermonSitemapQuery();
    const result = await this.database.query(statement.text, statement.values);
    return result.rows.map((row) => sitemapEntrySchema.parse({
      slug: row.slug,
      lastModified: row.last_modified
    }));
  }

  async findPublicPathDisposition(path: string): Promise<PublicSermonPathDisposition | null> {
    if (this.scope !== "public") return null;
    const statement = buildPublicSermonPathDispositionQuery(path);
    const result = await this.database.query(statement.text, statement.values);
    const row = result.rows[0] as { status_code: number; new_path: string | null } | undefined;
    if (!row) return null;
    if (row.status_code === 410) return { kind: "gone" };
    if (row.status_code === 301 && row.new_path) {
      return { kind: "redirect", location: row.new_path };
    }
    return null;
  }
}
