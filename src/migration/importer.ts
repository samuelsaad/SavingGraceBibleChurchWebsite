import { normalizeSlugForUniqueness } from "../domain/slug";
import { transformLegacySermon } from "./transform";
import type {
  LegacySermonRecord,
  MigrationDryRunResult,
  TransformedMigrationRecord
} from "./types";

function sourceOrder(left: LegacySermonRecord, right: LegacySermonRecord): number {
  return left.sourceTable.localeCompare(right.sourceTable) || left.sourceId - right.sourceId;
}

export function runMigrationDryRun(records: LegacySermonRecord[]): MigrationDryRunResult {
  const transformed: TransformedMigrationRecord[] = [...records]
    .sort(sourceOrder)
    .map(transformLegacySermon);

  const seenSlugs = new Map<string, number>();
  for (const result of transformed) {
    if (!result.sermon) continue;
    const key = normalizeSlugForUniqueness(result.sermon.slug);
    const firstSourceId = seenSlugs.get(key);
    if (firstSourceId !== undefined) {
      result.report.outcome = "rejected";
      result.report.reasonCode = "duplicate_canonical_slug";
      result.report.targetId = null;
      result.report.warnings.push({
        code: "duplicate_canonical_slug",
        severity: "error",
        field: "slug",
        safeDetail: `Canonical slug collides with source sermon ${firstSourceId}`
      });
      result.sermon = null;
      result.privateSourceAudit = null;
    } else {
      seenSlugs.set(key, result.sermon.sourceWordPressId);
    }
  }

  const safeRecords = transformed.map((result) => result.report);
  const candidates = transformed.flatMap((result) => (result.sermon ? [result.sermon] : []));
  const privateSourceAudit = transformed.flatMap((result) =>
    result.privateSourceAudit ? [result.privateSourceAudit] : []
  );

  return {
    summary: {
      total: safeRecords.length,
      included: safeRecords.filter((record) => record.outcome === "included").length,
      excluded: safeRecords.filter((record) => record.outcome === "excluded").length,
      rejected: safeRecords.filter((record) => record.outcome === "rejected").length,
      publishedIncluded: safeRecords.filter(
        (record) => record.reasonCode === "included_published"
      ).length,
      pendingIncluded: safeRecords.filter(
        (record) => record.reasonCode === "included_titled_pending"
      ).length,
      nonSundayWarnings: safeRecords.reduce(
        (count, record) =>
          count + record.warnings.filter((warning) => warning.code === "non_sunday_service_date").length,
        0
      )
    },
    records: safeRecords,
    candidates,
    privateSourceAudit
  };
}
