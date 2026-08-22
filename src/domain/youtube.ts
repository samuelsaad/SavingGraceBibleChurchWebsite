export interface YouTubeIdentityCandidate {
  videoId: string | null;
  canonicalUrl: string | null;
}

export type YouTubeIdentityResolution =
  | { status: "available"; videoId: string; canonicalUrl: string }
  | { status: "missing" | "invalid" | "conflicting" };

export const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function canonicalYouTubeUrl(videoId: string): string | null {
  const normalized = videoId.trim();
  return youtubeVideoIdPattern.test(normalized)
    ? `https://www.youtube.com/watch?v=${normalized}`
    : null;
}

export function youtubeVideoIdFromUrl(originalValue: string): string | null {
  let url: URL;
  try {
    url = new URL(originalValue.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  let externalId: string | null = null;

  if (hostname === "youtu.be") {
    externalId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    if (url.pathname === "/watch") externalId = url.searchParams.get("v");
    if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
      externalId = url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  return externalId && youtubeVideoIdPattern.test(externalId) ? externalId : null;
}

export function resolveYouTubeIdentity(
  candidates: readonly YouTubeIdentityCandidate[]
): YouTubeIdentityResolution {
  if (candidates.length === 0) return { status: "missing" };

  const identities = new Set<string>();
  for (const candidate of candidates) {
    const suppliedId = candidate.videoId?.trim() || null;
    const urlId = candidate.canonicalUrl
      ? youtubeVideoIdFromUrl(candidate.canonicalUrl)
      : null;

    if (
      (!suppliedId && !candidate.canonicalUrl) ||
      (suppliedId !== null && !youtubeVideoIdPattern.test(suppliedId)) ||
      (candidate.canonicalUrl !== null && urlId === null) ||
      (suppliedId !== null && urlId !== null && suppliedId !== urlId)
    ) {
      return { status: "invalid" };
    }

    identities.add(suppliedId ?? urlId!);
  }

  if (identities.size > 1) return { status: "conflicting" };
  const videoId = [...identities][0];
  if (!videoId) return { status: "missing" };
  return {
    status: "available",
    videoId,
    canonicalUrl: canonicalYouTubeUrl(videoId)!
  };
}
