import type { SermonStateAction } from "../api/contracts/admin-sermons";
import type { SermonStatus } from "../domain/sermon";

const transitions: Record<SermonStateAction, Partial<Record<SermonStatus, SermonStatus>>> = {
  submit: { draft: "pending" },
  withdraw: { pending: "draft" },
  schedule: { draft: "scheduled", pending: "scheduled", unpublished: "scheduled" },
  publish: {
    draft: "published",
    pending: "published",
    scheduled: "published",
    unpublished: "published"
  },
  unpublish: { scheduled: "unpublished", published: "unpublished" },
  archive: {
    draft: "archived",
    pending: "archived",
    scheduled: "archived",
    published: "archived",
    unpublished: "archived"
  },
  restore: { archived: "draft" }
};

export function transitionSermonStatus(
  currentStatus: SermonStatus,
  action: SermonStateAction
): SermonStatus | null {
  return transitions[action][currentStatus] ?? null;
}

export function isFutureSchedule(scheduledFor: string | undefined, now: Date): boolean {
  return Boolean(scheduledFor && new Date(scheduledFor).getTime() > now.getTime());
}
