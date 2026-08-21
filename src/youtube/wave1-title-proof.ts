import { createHash } from "node:crypto";

export const waveOneOfficialTitleRetrievalVersion = "phase3b2c-wave1-official-youtube-titles-v1" as const;
export const waveOneOfficialTitleRetrievalMethod = "official_youtube_data_api_v3_videos_list" as const;

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;

export interface WaveOneRetrievalIdentity {
  waveOrder: number;
  primarySourceId: number;
  resolvedSourceId: number | null;
  outcome: "retrieved" | "unavailable";
  videoId: string | null;
  channelId: string | null;
}

export interface OfficialVideoSnippetItem {
  id?: string | null | undefined;
  snippet?: {
    title?: string | null | undefined;
    channelId?: string | null | undefined;
  } | null | undefined;
}

export interface OfficialTitleRecord {
  videoId: string;
  outcome: "retrieved" | "manual_review_required";
  failureCode: "missing_video" | "duplicate_video" | "wrong_channel" | "missing_title" | null;
  title: string | null;
  channelId: string | null;
  retrievedAt: string;
  retrievalMethod: typeof waveOneOfficialTitleRetrievalMethod;
  retrievalVersion: typeof waveOneOfficialTitleRetrievalVersion;
  recordSha256: string;
}

export interface PrivateOfficialTitleArtifact {
  schemaVersion: 1;
  privateContent: true;
  retrievalMethod: typeof waveOneOfficialTitleRetrievalMethod;
  retrievalVersion: typeof waveOneOfficialTitleRetrievalVersion;
  retrievedAt: string;
  expectedChannelId: string;
  records: OfficialTitleRecord[];
  integrity: { recordSetSha256: string };
}

export function sha256TitleEvidence(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableTitleRecord(record: Omit<OfficialTitleRecord, "recordSha256">): string {
  return JSON.stringify(record);
}

export function titleRecordSetSha256(records: readonly OfficialTitleRecord[]): string {
  return sha256TitleEvidence(JSON.stringify(records));
}

export function exactWaveOneVideoAllowlist(records: readonly WaveOneRetrievalIdentity[]): string[] {
  if (records.length !== 12) throw new Error("The private Wave 1 retrieval evidence does not contain exactly 12 records");
  const ordered = [...records].sort((left, right) => left.waveOrder - right.waveOrder);
  if (ordered.some((record, index) =>
    record.waveOrder !== index + 1 ||
    record.outcome !== "retrieved" ||
    record.resolvedSourceId === null ||
    !record.videoId ||
    !videoIdPattern.test(record.videoId) ||
    !record.channelId
  )) {
    throw new Error("The private Wave 1 retrieval evidence does not identify 12 complete ordered videos");
  }
  const videoIds = ordered.map((record) => record.videoId!);
  if (new Set(videoIds).size !== 12) throw new Error("The Wave 1 video allowlist contains a duplicate identity");
  if (new Set(ordered.map((record) => record.resolvedSourceId)).size !== 12) {
    throw new Error("The Wave 1 source allowlist contains a duplicate identity");
  }
  return videoIds;
}

export function buildOfficialTitleRecords(input: {
  allowlistedVideoIds: readonly string[];
  expectedChannelId: string;
  retrievedAt: string;
  items: readonly OfficialVideoSnippetItem[];
}): OfficialTitleRecord[] {
  if (input.allowlistedVideoIds.length !== 12 || new Set(input.allowlistedVideoIds).size !== 12 ||
    input.allowlistedVideoIds.some((videoId) => !videoIdPattern.test(videoId))) {
    throw new Error("Official-title retrieval requires the exact 12-video Wave 1 allowlist");
  }
  if (!input.expectedChannelId.trim()) throw new Error("The verified church channel identity is unavailable");
  const allowlist = new Set(input.allowlistedVideoIds);
  const grouped = new Map<string, OfficialVideoSnippetItem[]>();
  for (const item of input.items) {
    if (!item.id || !allowlist.has(item.id)) {
      throw new Error("The official API returned a video outside the exact Wave 1 allowlist");
    }
    const group = grouped.get(item.id) ?? [];
    group.push(item);
    grouped.set(item.id, group);
  }
  return input.allowlistedVideoIds.map((videoId) => {
    const matches = grouped.get(videoId) ?? [];
    let value: Omit<OfficialTitleRecord, "recordSha256">;
    if (matches.length === 0) {
      value = titleFailure(videoId, "missing_video", input.retrievedAt);
    } else if (matches.length !== 1) {
      value = titleFailure(videoId, "duplicate_video", input.retrievedAt);
    } else {
      const item = matches[0]!;
      const channelId = item.snippet?.channelId ?? null;
      const title = item.snippet?.title;
      if (channelId !== input.expectedChannelId) {
        value = titleFailure(videoId, "wrong_channel", input.retrievedAt, channelId);
      } else if (typeof title !== "string" || title.length === 0) {
        value = titleFailure(videoId, "missing_title", input.retrievedAt, channelId);
      } else {
        value = {
          videoId,
          outcome: "retrieved",
          failureCode: null,
          title,
          channelId,
          retrievedAt: input.retrievedAt,
          retrievalMethod: waveOneOfficialTitleRetrievalMethod,
          retrievalVersion: waveOneOfficialTitleRetrievalVersion
        };
      }
    }
    return { ...value, recordSha256: sha256TitleEvidence(stableTitleRecord(value)) };
  });
}

function titleFailure(
  videoId: string,
  failureCode: Exclude<OfficialTitleRecord["failureCode"], null>,
  retrievedAt: string,
  channelId: string | null = null
): Omit<OfficialTitleRecord, "recordSha256"> {
  return {
    videoId,
    outcome: "manual_review_required",
    failureCode,
    title: null,
    channelId,
    retrievedAt,
    retrievalMethod: waveOneOfficialTitleRetrievalMethod,
    retrievalVersion: waveOneOfficialTitleRetrievalVersion
  };
}

export function buildPrivateOfficialTitleArtifact(input: {
  expectedChannelId: string;
  retrievedAt: string;
  records: OfficialTitleRecord[];
}): PrivateOfficialTitleArtifact {
  return {
    schemaVersion: 1,
    privateContent: true,
    retrievalMethod: waveOneOfficialTitleRetrievalMethod,
    retrievalVersion: waveOneOfficialTitleRetrievalVersion,
    retrievedAt: input.retrievedAt,
    expectedChannelId: input.expectedChannelId,
    records: input.records,
    integrity: { recordSetSha256: titleRecordSetSha256(input.records) }
  };
}

export function verifyPrivateOfficialTitleArtifact(value: unknown): PrivateOfficialTitleArtifact {
  if (!value || typeof value !== "object") throw new Error("Private official-title evidence is invalid");
  const artifact = value as Partial<PrivateOfficialTitleArtifact>;
  if (artifact.schemaVersion !== 1 || artifact.privateContent !== true ||
    artifact.retrievalMethod !== waveOneOfficialTitleRetrievalMethod ||
    artifact.retrievalVersion !== waveOneOfficialTitleRetrievalVersion ||
    typeof artifact.expectedChannelId !== "string" || !artifact.expectedChannelId ||
    !Array.isArray(artifact.records) || artifact.records.length !== 12 ||
    !artifact.integrity || !sha256Pattern.test(artifact.integrity.recordSetSha256) ||
    titleRecordSetSha256(artifact.records) !== artifact.integrity.recordSetSha256) {
    throw new Error("Private official-title evidence failed its integrity contract");
  }
  for (const record of artifact.records) {
    const { recordSha256, ...stable } = record;
    if (!videoIdPattern.test(record.videoId) || !sha256Pattern.test(recordSha256) ||
      sha256TitleEvidence(stableTitleRecord(stable)) !== recordSha256 ||
      record.retrievalMethod !== waveOneOfficialTitleRetrievalMethod ||
      record.retrievalVersion !== waveOneOfficialTitleRetrievalVersion ||
      (record.outcome === "retrieved" &&
        (record.failureCode !== null || typeof record.title !== "string" || record.title.length === 0 ||
          record.channelId !== artifact.expectedChannelId)) ||
      (record.outcome === "manual_review_required" && (record.failureCode === null || record.title !== null))) {
      throw new Error("A private official-title record failed its integrity contract");
    }
  }
  if (new Set(artifact.records.map((record) => record.videoId)).size !== 12) {
    throw new Error("Private official-title evidence contains duplicate video identities");
  }
  return artifact as PrivateOfficialTitleArtifact;
}
