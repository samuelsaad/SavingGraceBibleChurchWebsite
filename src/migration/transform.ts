import { createHash } from "node:crypto";
import { mapWordPressLocalDate, parseWordPressGmt } from "../domain/date";
import { normalizeSermonAudio, normalizeYouTube } from "../domain/media";
import { transformScripture, type ScriptureSource } from "../domain/scripture";
import { validateLegacySlug } from "../domain/slug";
import { deterministicSourceUuid } from "./identity";
import { assessSermonTitle } from "../domain/sermon-title";
import {
  legacySermonRecordSchema,
  type LegacySermonRecord,
  type MigrationWarning,
  type TransformedMigrationRecord
} from "./types";

function excluded(
  record: LegacySermonRecord,
  reasonCode: string
): TransformedMigrationRecord {
  return {
    report: {
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceStatus: record.postStatus,
      outcome: "excluded",
      reasonCode,
      targetId: null,
      warnings: []
    },
    sermon: null,
    privateSourceAudit: null
  };
}

function rejected(
  record: LegacySermonRecord,
  reasonCode: string,
  warning: MigrationWarning
): TransformedMigrationRecord {
  return {
    report: {
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceStatus: record.postStatus,
      outcome: "rejected",
      reasonCode,
      targetId: null,
      warnings: [warning]
    },
    sermon: null,
    privateSourceAudit: null
  };
}

function canonicalSourceChecksum(record: LegacySermonRecord): string {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

export function transformLegacySermon(input: unknown): TransformedMigrationRecord {
  const parsed = legacySermonRecordSchema.safeParse(input);
  if (!parsed.success) {
    const fallback = {
      sourceTable: "invalid",
      sourceId: 0,
      postStatus: null
    };
    return rejected(fallback as LegacySermonRecord, "invalid_source_record", {
      code: "invalid_source_record",
      severity: "error",
      safeDetail: "Source record failed structural validation"
    });
  }

  const record = parsed.data;
  if (record.sourceTable !== "wp_posts") {
    return excluded(record, "excluded_legacy_table");
  }
  if (record.postType !== "sermons") {
    return excluded(record, "excluded_legacy_post_type");
  }
  if (record.postStatus === "draft") {
    return excluded(record, "excluded_draft");
  }

  const hasTitle = Boolean(record.title?.trim());
  if (record.postStatus === "pending" && !hasTitle) {
    return excluded(record, "excluded_blank_pending_title");
  }
  if (record.postStatus !== "publish" && record.postStatus !== "pending") {
    return rejected(record, "unsupported_source_status", {
      code: "unsupported_source_status",
      severity: "error",
      field: "postStatus",
      safeDetail: "Advanced Sermons source status is not supported"
    });
  }
  if (!hasTitle) {
    return rejected(record, "missing_required_title", {
      code: "missing_required_title",
      severity: "error",
      field: "title",
      safeDetail: "Included source record requires a nonblank title"
    });
  }

  const slug = validateLegacySlug(record.slug);
  if (!slug) {
    return rejected(record, "invalid_required_slug", {
      code: "invalid_required_slug",
      severity: "error",
      field: "slug",
      safeDetail: "Included source record has no safe canonical slug"
    });
  }

  const dateResult = record.postDateLocal
    ? mapWordPressLocalDate(record.postDateLocal)
    : null;
  if (!dateResult) {
    return rejected(record, "invalid_service_date", {
      code: "invalid_service_date",
      severity: "error",
      field: "postDateLocal",
      safeDetail: "WordPress local post date is missing or invalid"
    });
  }

  const sourceCreatedGmt = parseWordPressGmt(record.postDateGmt);
  if (record.postStatus === "publish" && !sourceCreatedGmt) {
    return rejected(record, "invalid_published_timestamp", {
      code: "invalid_published_timestamp",
      severity: "error",
      field: "postDateGmt",
      safeDetail: "Published source record requires a valid WordPress GMT timestamp"
    });
  }

  const warnings: MigrationWarning[] = [];
  if (record.speakers.length > 1) {
    warnings.push({
      code: "multiple_source_speakers",
      severity: "error",
      field: "speaker",
      safeDetail: "Multiple source speaker relationships require manual resolution; no speaker was selected"
    });
  }
  if (!dateResult.isSunday) {
    warnings.push({
      code: "non_sunday_service_date",
      severity: "warning",
      field: "serviceDate",
      safeDetail: "Source preached date is not Sunday and was preserved unchanged"
    });
  }

  const scriptureSources: ScriptureSource[] = record.passageTerms.map((term) => ({
    kind: "taxonomy",
    originalValue: term.name,
    sourceTermId: term.termId,
    sourceTermTaxonomyId: term.termTaxonomyId
  }));
  const scripture = transformScripture(record.meta.biblePassage, scriptureSources);
  for (const code of scripture.warningCodes) {
    warnings.push({
      code,
      severity: "warning",
      field: "scriptureReferences",
      safeDetail:
        code === "scripture_source_conflict"
          ? "Passage metadata and taxonomy values differ and were preserved separately"
          : "Only one scripture source is present and was preserved"
    });
  }

  const media = [];
  const mediaSources = [];
  if (record.meta.youtube?.trim()) {
    const normalized = normalizeYouTube(record.meta.youtube, record.title!);
    if (normalized) {
      media.push(normalized.media);
      mediaSources.push(normalized.sourceAudit);
    } else {
      warnings.push({
        code: "invalid_youtube_source",
        severity: "warning",
        field: "youtube",
        safeDetail: "YouTube source could not be normalized and will not be rendered"
      });
    }
  }
  if (record.meta.audioEmbed?.trim()) {
    const normalized = normalizeSermonAudio(record.meta.audioEmbed, record.title!);
    if (normalized) {
      media.push(normalized.media);
      mediaSources.push(normalized.sourceAudit);
    } else {
      warnings.push({
        code: "invalid_sermonaudio_source",
        severity: "warning",
        field: "audioEmbed",
        safeDetail: "Audio source could not be normalized and will not be rendered"
      });
    }
  }

  const targetId = deterministicSourceUuid("wordpress-sermon", record.sourceId);
  const titleAssessment = assessSermonTitle(record.title!, {
    sourceTitles: [record.title!], passageTexts: scripture.references.map((item) => item.displayText)
  });
  if (titleAssessment.outcome === "manual_review") warnings.push({
    code: "title_reference_requires_manual_review", severity: "warning", field: "title",
    safeDetail: "A possible passage in the source title has no safe unambiguous boundary; the original title was preserved."
  });
  const sermon = {
    id: targetId,
    sourceWordPressId: record.sourceId,
    sourceStatus: record.postStatus,
    title: titleAssessment.title,
    slug,
    status: record.postStatus === "publish" ? ("published" as const) : ("pending" as const),
    serviceDate: dateResult.serviceDate,
    publishedAt: record.postStatus === "publish" ? sourceCreatedGmt : null,
    sourceCreatedLocal: record.postDateLocal!,
    sourceCreatedGmt,
    sourceModifiedLocal: record.postModifiedLocal,
    sourceModifiedGmt: parseWordPressGmt(record.postModifiedGmt),
    body: record.body?.length ? record.body : null,
    summary: record.summary?.length ? record.summary : null,
    speaker: record.speakers.length === 1 ? record.speakers[0]! : null,
    sourceSpeakerCount: record.speakers.length,
    series: record.series,
    books: record.books,
    passageTerms: record.passageTerms,
    scriptureReferences: scripture.references,
    media,
    sourceChecksumSha256: canonicalSourceChecksum(record)
  };

  return {
    report: {
      sourceTable: record.sourceTable,
      sourceId: record.sourceId,
      sourceStatus: record.postStatus,
      outcome: "included",
      reasonCode:
        record.postStatus === "publish" ? "included_published" : "included_titled_pending",
      targetId,
      warnings
    },
    sermon,
    privateSourceAudit: {
      targetSermonId: targetId,
      legacyViewCount: record.legacyViewCount,
      mediaSources
    }
  };
}
