import { createHash } from "node:crypto";
import type { PublicMedia } from "./sermon";
import { canonicalYouTubeUrl, youtubeVideoIdFromUrl } from "./youtube";
export {
  canonicalYouTubeUrl,
  resolveYouTubeIdentity,
  youtubeVideoIdFromUrl,
  youtubeVideoIdPattern
} from "./youtube";
export type { YouTubeIdentityCandidate, YouTubeIdentityResolution } from "./youtube";

export interface MediaSourceAudit {
  sourceMetaKey: string;
  originalValue: string;
  sourceValueSha256: string;
}

export interface NormalizedMediaResult {
  media: PublicMedia;
  sourceAudit: MediaSourceAudit;
}

function audit(sourceMetaKey: string, originalValue: string): MediaSourceAudit {
  return {
    sourceMetaKey,
    originalValue,
    sourceValueSha256: createHash("sha256").update(originalValue).digest("hex")
  };
}

export function normalizeYouTube(
  originalValue: string,
  title: string
): NormalizedMediaResult | null {
  const externalId = youtubeVideoIdFromUrl(originalValue);
  if (!externalId) return null;

  return {
    media: {
      provider: "youtube",
      mediaType: "video",
      externalId,
      canonicalUrl: canonicalYouTubeUrl(externalId)!,
      title: `Video: ${title}`
    },
    sourceAudit: audit("asp_sermon_youtube", originalValue)
  };
}

function extractIframeSource(value: string): string | null {
  if (!value.includes("<")) return value.trim();
  if (/<script\b/i.test(value)) return null;
  const match = /<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i.exec(value);
  return match?.[2]?.trim() ?? null;
}

export function normalizeSermonAudio(
  originalValue: string,
  title: string
): NormalizedMediaResult | null {
  const source = extractIframeSource(originalValue);
  if (!source) return null;

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(hostname === "sermonaudio.com" || hostname.endsWith(".sermonaudio.com"))) {
    return null;
  }

  const externalId =
    url.searchParams.get("SID") ??
    url.searchParams.get("sid") ??
    url.searchParams.get("sermon") ??
    url.pathname.split("/").filter(Boolean).at(-1) ??
    null;

  return {
    media: {
      provider: "sermonaudio",
      mediaType: "audio",
      externalId,
      canonicalUrl: url.toString(),
      title: `Audio: ${title}`
    },
    sourceAudit: audit("asp_sermon_audio_embed", originalValue)
  };
}
