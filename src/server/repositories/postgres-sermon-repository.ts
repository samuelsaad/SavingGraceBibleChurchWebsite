import type { QueryResult, QueryResultRow } from "pg";
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import {
  sermonDetailSchema,
  sermonSummarySchema,
  type SermonDetail,
  type SermonSummary
} from "../../domain/sermon";
import {
  buildPublishedSermonCountQuery,
  buildPublishedSermonDetailQuery,
  buildPublishedSermonListQuery
} from "../queries/public-sermons";
import type { PaginatedSermons, PublicSermonRepository } from "./sermon-repository";

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
  books: unknown;
  primary_media: unknown;
  total_items?: number;
};

type PublicSermonDetailRow = PublicSermonRow & {
  seo_description: string | null;
  body: string | null;
  media: unknown;
  transcript: unknown;
  question_answers: unknown;
};

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
    books: row.books,
    primaryMedia: row.primary_media
  });
}

function detailFromRow(row: PublicSermonDetailRow): SermonDetail {
  return sermonDetailSchema.parse({
    ...summaryFromRow(row),
    seoDescription: row.seo_description ?? null,
    body: row.body,
    media: row.media,
    transcript: row.transcript,
    questionAnswers: row.question_answers
  });
}

export class PostgresSermonRepository implements PublicSermonRepository {
  constructor(private readonly database: SqlExecutor) {}

  async listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons> {
    const statement = buildPublishedSermonListQuery(query);
    const result = await this.database.query(statement.text, statement.values);
    const rows = result.rows as PublicSermonRow[];
    let totalItems = rows[0]?.total_items ?? 0;

    // A window count cannot report a total for an out-of-range page because it
    // returns no row. Preserve pagination metadata with one parameterized count.
    if (rows.length === 0 && query.page > 1) {
      const countStatement = buildPublishedSermonCountQuery(query);
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
    const statement = buildPublishedSermonDetailQuery(slug);
    const result = await this.database.query(statement.text, statement.values);
    const row = (result.rows as PublicSermonDetailRow[])[0];
    return row ? detailFromRow(row) : null;
  }
}
