import { createHash } from "node:crypto";
import { normalizeYouTube } from "../domain/media";
import type { CaptionAnalysis, CaptionTrackSelection } from "./pilot-caption-proof";

export const wave1CaptionProcessingVersion = "phase3b2c-wave1-captions-v1" as const;
export const productionMappingQueryVersion = "phase3b2c-youtube-mapping-v1" as const;
export const expectedInventoryContentSha256 = "52b544e0a1620eb536c37a6e5cc2344593ee76619ff1222ed0348d1183602ddc";
export const expectedSelectionContentSha256 = "64ce90ab70fe366534373143ecb169d90fb364c40c273163b36be9658bfb0e4d";
export const expectedSelectionPolicy = "phase3b2c-selection-v1";
export const expectedPrimaryCount = 36;
export const expectedAlternateCount = 12;
export const expectedWaveOneCount = 12;
export const youtubeMetadataKey = "asp_sermon_youtube";

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;

export interface SelectionPrimary {
  sourceId: number;
  selectionRank: number;
  wave: number;
  waveOrder: number;
}

export interface SelectionAlternate {
  sourceId: number;
  alternateOrder: number;
  replacementForPrimarySourceId: number;
  replacementPrimaryWave: number;
  allowedReplacementReasons: string[];
}

export interface VerifiedSelection {
  primary: SelectionPrimary[];
  alternates: SelectionAlternate[];
  selectedSourceIds: number[];
}

export type MappingStatus =
  | "mapped"
  | "missing"
  | "malformed"
  | "duplicate_metadata_rows"
  | "ambiguous"
  | "duplicate_video_identity";

export interface PrivateVideoMappingRecord {
  sourceId: number;
  status: MappingStatus;
  videoId: string | null;
  metadataValueSha256: string | null;
  metadataRowCount: number;
}

export interface RawMappingRow {
  source_id: number | string;
  youtube_metadata_value: string | null;
}

export interface CaptionInspectionRecord {
  sourceId: number;
  videoId: string | null;
  outcome:
    | "selected"
    | "mapping_unavailable"
    | "video_missing"
    | "wrong_channel"
    | "no_eligible_track"
    | "ambiguous_track"
    | "caption_list_failed";
  selection: CaptionTrackSelection | null;
  durationMs: number | null;
}

export interface ResolvedWavePosition {
  waveOrder: number;
  primarySourceId: number;
  resolvedSourceId: number | null;
  resolution: "primary" | "alternate" | "unavailable";
  reason: string | null;
}

export interface StructuralCaptionMetrics {
  cueCount: number;
  emptyCueCount: number;
  wordCount: number;
  firstCueTimeMs: number;
  finalCueTimeMs: number;
  largeGapCount: number;
  overlapCount: number;
  replacementCharacterCount: number;
  repeatedAdjacentCueCount: number;
  sentenceBoundaryCount: number;
  punctuationScarce: boolean;
  apparentDurationCoveragePercent: number | null;
  warnings: string[];
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(`${label} must be a positive integer`);
  return Number(value);
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function manifestContentSha256(input: unknown): string {
  const manifest = requireObject(input, "Private manifest");
  const { integrity: _integrity, ...content } = manifest;
  return sha256(JSON.stringify(content));
}

function requireManifestIntegrity(input: unknown, expected: string, label: string): void {
  const manifest = requireObject(input, label);
  const integrity = requireObject(manifest.integrity, `${label} integrity`);
  if (integrity.contentSha256 !== expected || !sha256Pattern.test(String(integrity.contentSha256))) {
    throw new Error(`${label} recorded content hash did not match the approved checkpoint`);
  }
  if (manifestContentSha256(input) !== expected) {
    throw new Error(`${label} canonical content hash did not match the approved checkpoint`);
  }
}

export function verifyPrivateSelection(inventoryInput: unknown, selectionInput: unknown): VerifiedSelection {
  requireManifestIntegrity(inventoryInput, expectedInventoryContentSha256, "Inventory manifest");
  requireManifestIntegrity(selectionInput, expectedSelectionContentSha256, "Selection manifest");
  const selection = requireObject(selectionInput, "Selection manifest");
  if (selection.policyVersion !== expectedSelectionPolicy) throw new Error("Selection policy version changed");
  if (!Array.isArray(selection.primary) || !Array.isArray(selection.alternates)) {
    throw new Error("Selection manifest does not contain primary and alternate arrays");
  }
  const primary = selection.primary.map((value, index): SelectionPrimary => {
    const item = requireObject(value, `Primary selection ${index + 1}`);
    return {
      sourceId: requirePositiveInteger(item.sourceId, "Primary source ID"),
      selectionRank: requirePositiveInteger(item.selectionRank, "Selection rank"),
      wave: requirePositiveInteger(item.wave, "Wave"),
      waveOrder: requirePositiveInteger(item.waveOrder, "Wave order")
    };
  });
  const alternates = selection.alternates.map((value, index): SelectionAlternate => {
    const item = requireObject(value, `Alternate selection ${index + 1}`);
    if (!Array.isArray(item.allowedReplacementReasons) ||
      !item.allowedReplacementReasons.every((reason) => typeof reason === "string" && reason.length > 0)) {
      throw new Error("Alternate replacement reasons are invalid");
    }
    return {
      sourceId: requirePositiveInteger(item.sourceId, "Alternate source ID"),
      alternateOrder: requirePositiveInteger(item.alternateOrder, "Alternate order"),
      replacementForPrimarySourceId: requirePositiveInteger(
        item.replacementForPrimarySourceId,
        "Mapped primary source ID"
      ),
      replacementPrimaryWave: requirePositiveInteger(item.replacementPrimaryWave, "Mapped primary wave"),
      allowedReplacementReasons: [...item.allowedReplacementReasons]
    };
  });
  if (primary.length !== expectedPrimaryCount || alternates.length !== expectedAlternateCount) {
    throw new Error("Selection cardinality changed from the approved 36-primary/12-alternate design");
  }
  const allIds = [...primary.map((item) => item.sourceId), ...alternates.map((item) => item.sourceId)];
  if (new Set(allIds).size !== expectedPrimaryCount + expectedAlternateCount) {
    throw new Error("Selection contains a duplicate source identity");
  }
  const waveOne = primary.filter((item) => item.wave === 1);
  if (waveOne.length !== expectedWaveOneCount || new Set(waveOne.map((item) => item.waveOrder)).size !== waveOne.length) {
    throw new Error("Wave 1 does not contain exactly 12 uniquely ordered primary positions");
  }
  const primaryIds = new Set(primary.map((item) => item.sourceId));
  for (const alternate of alternates) {
    if (!primaryIds.has(alternate.replacementForPrimarySourceId)) {
      throw new Error("An alternate is not mapped to an approved primary selection");
    }
  }
  return { primary, alternates, selectedSourceIds: allIds.sort((left, right) => left - right) };
}

export function parseCanonicalYouTubeVideoId(value: string): string | null {
  const normalized = value.trim().replaceAll("&amp;", "&");
  if (videoIdPattern.test(normalized)) return normalized;
  return normalizeYouTube(normalized, "Private sermon source")?.media.externalId ?? null;
}

export function buildPrivateMappings(
  selectedSourceIds: readonly number[],
  rows: readonly RawMappingRow[]
): PrivateVideoMappingRecord[] {
  const expected = new Set(selectedSourceIds);
  if (expected.size !== selectedSourceIds.length || selectedSourceIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Mapping scope contains an invalid or duplicate source identity");
  }
  const grouped = new Map<number, Array<string | null>>();
  for (const row of rows) {
    const sourceId = Number(row.source_id);
    if (!Number.isSafeInteger(sourceId) || !expected.has(sourceId)) {
      throw new Error("Production mapping query returned an identity outside the approved selection scope");
    }
    const values = grouped.get(sourceId) ?? [];
    values.push(row.youtube_metadata_value);
    grouped.set(sourceId, values);
  }
  const result = selectedSourceIds.map((sourceId): PrivateVideoMappingRecord => {
    const rawValues = grouped.get(sourceId) ?? [];
    const populated = rawValues.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (populated.length === 0) {
      return { sourceId, status: "missing", videoId: null, metadataValueSha256: null, metadataRowCount: rawValues.length };
    }
    const parsed = populated.map((value) => ({ value, videoId: parseCanonicalYouTubeVideoId(value) }));
    if (parsed.some((item) => item.videoId === null)) {
      return {
        sourceId,
        status: "malformed",
        videoId: null,
        metadataValueSha256: sha256(populated.join("\n")),
        metadataRowCount: populated.length
      };
    }
    const identities = [...new Set(parsed.map((item) => item.videoId!))];
    if (identities.length > 1) {
      return {
        sourceId,
        status: "ambiguous",
        videoId: null,
        metadataValueSha256: sha256(populated.join("\n")),
        metadataRowCount: populated.length
      };
    }
    return {
      sourceId,
      status: populated.length > 1 ? "duplicate_metadata_rows" : "mapped",
      videoId: identities[0]!,
      metadataValueSha256: sha256(populated.join("\n")),
      metadataRowCount: populated.length
    };
  });
  const byVideo = new Map<string, PrivateVideoMappingRecord[]>();
  for (const record of result) {
    if (!record.videoId) continue;
    const records = byVideo.get(record.videoId) ?? [];
    records.push(record);
    byVideo.set(record.videoId, records);
  }
  for (const records of byVideo.values()) {
    if (records.length < 2) continue;
    for (const record of records) {
      record.status = "duplicate_video_identity";
      record.videoId = null;
    }
  }
  return result;
}

export function replacementReasonForInspection(record: CaptionInspectionRecord): string | null {
  if (record.outcome === "selected") return null;
  const mapped: Record<CaptionInspectionRecord["outcome"], string | null> = {
    selected: null,
    mapping_unavailable: "unavailable_source_file",
    video_missing: "unavailable_source_file",
    wrong_channel: "source_outside_authorized_workflow",
    no_eligible_track: "missing_caption_export",
    ambiguous_track: "ambiguous_source_identity",
    caption_list_failed: "unavailable_source_file"
  };
  return mapped[record.outcome];
}

export function resolveInitialWaveOne(
  selection: VerifiedSelection,
  inspections: readonly CaptionInspectionRecord[]
): ResolvedWavePosition[] {
  const inspectionBySource = new Map(inspections.map((item) => [item.sourceId, item]));
  const waveOne = selection.primary.filter((item) => item.wave === 1).sort((a, b) => a.waveOrder - b.waveOrder);
  return waveOne.map((primary): ResolvedWavePosition => {
    const primaryInspection = inspectionBySource.get(primary.sourceId);
    if (!primaryInspection) throw new Error("Caption inspection cache does not cover every Wave 1 primary");
    if (primaryInspection.outcome === "selected") {
      return {
        waveOrder: primary.waveOrder,
        primarySourceId: primary.sourceId,
        resolvedSourceId: primary.sourceId,
        resolution: "primary",
        reason: null
      };
    }
    const reason = replacementReasonForInspection(primaryInspection)!;
    const mapped = selection.alternates
      .filter((item) => item.replacementForPrimarySourceId === primary.sourceId && item.replacementPrimaryWave === 1)
      .sort((a, b) => a.alternateOrder - b.alternateOrder);
    const eligible = mapped.find((alternate) => {
      const alternateInspection = inspectionBySource.get(alternate.sourceId);
      return alternate.allowedReplacementReasons.includes(reason) && alternateInspection?.outcome === "selected";
    });
    if (!eligible) {
      return {
        waveOrder: primary.waveOrder,
        primarySourceId: primary.sourceId,
        resolvedSourceId: null,
        resolution: "unavailable",
        reason
      };
    }
    return {
      waveOrder: primary.waveOrder,
      primarySourceId: primary.sourceId,
      resolvedSourceId: eligible.sourceId,
      resolution: "alternate",
      reason
    };
  });
}

export function structuralCaptionMetrics(input: {
  analysis: CaptionAnalysis;
  cueTimes: Array<{ startMs: number; endMs: number; visibleText: string }>;
  durationMs: number | null;
}): StructuralCaptionMetrics {
  if (input.analysis.cueCount === null || input.analysis.firstCueTimeMs === null || input.analysis.finalCueTimeMs === null) {
    throw new Error("Wave 1 structural assessment requires parsed VTT cue timing");
  }
  let largeGapCount = 0;
  let overlapCount = 0;
  let repeatedAdjacentCueCount = 0;
  for (let index = 1; index < input.cueTimes.length; index += 1) {
    const previous = input.cueTimes[index - 1]!;
    const current = input.cueTimes[index]!;
    if (current.startMs - previous.endMs > 30_000) largeGapCount += 1;
    if (current.startMs < previous.endMs) overlapCount += 1;
    if (current.visibleText.trim() && current.visibleText.trim() === previous.visibleText.trim()) {
      repeatedAdjacentCueCount += 1;
    }
  }
  const joined = input.cueTimes.map((cue) => cue.visibleText).join(" ");
  const sentenceBoundaryCount = (joined.match(/[.!?](?:["'’)]|\s|$)/gu) ?? []).length;
  const punctuationScarce = sentenceBoundaryCount < Math.max(5, Math.floor(input.analysis.wordCount / 80));
  const emptyCueCount = input.cueTimes.filter((cue) => !cue.visibleText.trim()).length;
  const replacementCharacterCount = (joined.match(/\uFFFD/gu) ?? []).length;
  const apparentDurationCoveragePercent = input.durationMs && input.durationMs > 0
    ? Number(((input.analysis.finalCueTimeMs / input.durationMs) * 100).toFixed(2))
    : null;
  const warnings = [
    ...(largeGapCount ? ["large_caption_gaps"] : []),
    ...(overlapCount ? ["caption_cue_overlaps"] : []),
    ...(emptyCueCount ? ["empty_caption_cues"] : []),
    ...(replacementCharacterCount ? ["replacement_characters_present"] : []),
    ...(repeatedAdjacentCueCount ? ["adjacent_repeated_cues"] : []),
    ...(punctuationScarce ? ["punctuation_scarcity"] : []),
    ...(apparentDurationCoveragePercent !== null && apparentDurationCoveragePercent < 85
      ? ["apparent_duration_coverage_low"]
      : [])
  ];
  return {
    cueCount: input.analysis.cueCount,
    emptyCueCount,
    wordCount: input.analysis.wordCount,
    firstCueTimeMs: input.analysis.firstCueTimeMs,
    finalCueTimeMs: input.analysis.finalCueTimeMs,
    largeGapCount,
    overlapCount,
    replacementCharacterCount,
    repeatedAdjacentCueCount,
    sentenceBoundaryCount,
    punctuationScarce,
    apparentDurationCoveragePercent,
    warnings
  };
}

export function safeAggregateMappingCounts(records: readonly PrivateVideoMappingRecord[]): Record<string, number> {
  return records.reduce<Record<string, number>>((counts, record) => {
    counts[record.status] = (counts[record.status] ?? 0) + 1;
    return counts;
  }, {});
}
