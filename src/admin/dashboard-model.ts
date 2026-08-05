import type { SermonStatus } from "../domain/sermon";
import type { DeletionSeoDisposition } from "../api/contracts/admin-sermons";
import type { ControlledMediaInput } from "../server/repositories/admin-sermon-repository";

const actionMap: Record<SermonStatus, string[]> = {
  draft: ["submit", "schedule", "publish", "archive"],
  pending: ["withdraw", "schedule", "publish", "archive"],
  scheduled: ["publish", "unpublish", "archive"],
  published: ["unpublish", "archive"],
  unpublished: ["schedule", "publish", "archive"],
  archived: ["restore"]
};

export function allowedDashboardActions(status: SermonStatus): string[] {
  return [...actionMap[status]];
}

export function expectedPublicSermonUrl(
  slug: string,
  origin = "https://www.savinggrace.org.au"
): string {
  return `${origin.replace(/\/$/, "")}/sermons/${slug}/`;
}

export function shouldWarnAboutSlugChange(
  originalSlug: string,
  currentSlug: string,
  publishedAt: string | null
): boolean {
  return publishedAt !== null && originalSlug !== currentSlug;
}

function optionalControlledMedia(
  provider: "youtube" | "sermonaudio",
  canonicalUrl: string,
  title: string
): ControlledMediaInput | null {
  const trimmedUrl = canonicalUrl.trim();
  if (!trimmedUrl) return null;
  return {
    provider,
    mediaType: provider === "youtube" ? "video" : "audio",
    externalId: null,
    canonicalUrl: trimmedUrl,
    title: title.trim() || (provider === "youtube" ? "Sermon video" : "Sermon audio")
  };
}

export function buildControlledMediaInputs(input: {
  youtubeUrl: string;
  youtubeTitle: string;
  sermonAudioUrl: string;
  sermonAudioTitle: string;
}): ControlledMediaInput[] {
  return [
    optionalControlledMedia("youtube", input.youtubeUrl, input.youtubeTitle),
    optionalControlledMedia("sermonaudio", input.sermonAudioUrl, input.sermonAudioTitle)
  ].filter((value): value is ControlledMediaInput => value !== null);
}

export function buildDeletionSeoDisposition(
  kind: "none" | "redirect" | "gone",
  targetPath: string
): DeletionSeoDisposition | null {
  if (kind === "redirect") return { kind, targetPath: targetPath.trim() };
  if (kind === "gone") return { kind };
  return null;
}
