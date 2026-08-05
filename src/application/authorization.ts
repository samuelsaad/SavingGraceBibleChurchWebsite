import type { ApplicationRole, SermonStateAction } from "../api/contracts/admin-sermons";
import { forbidden } from "./errors";

export interface ApplicationIdentity {
  subject: string;
  role: ApplicationRole;
}

export function assertAdminAccess(identity: ApplicationIdentity): void {
  if (identity.role !== "admin") forbidden("Administration access is required");
}

export function assertMayEditSermon(
  identity: ApplicationIdentity,
  _sermon?: { status?: string }
): void {
  assertAdminAccess(identity);
}

export function assertMayReadSermon(identity: ApplicationIdentity, _sermon?: unknown): void {
  assertAdminAccess(identity);
}

export function assertMayTransitionSermon(
  identity: ApplicationIdentity,
  _sermon: unknown,
  _action: SermonStateAction
): void {
  assertAdminAccess(identity);
}

export const assertMayManageTaxonomies = assertAdminAccess;
export const assertMayViewAudit = assertAdminAccess;
export const assertMayPermanentlyDelete = assertAdminAccess;
