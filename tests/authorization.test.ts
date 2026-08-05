import { describe, expect, it } from "vitest";
import type { SermonStateAction } from "../src/api/contracts/admin-sermons";
import {
  assertAdminAccess,
  assertMayEditSermon,
  assertMayManageTaxonomies,
  assertMayPermanentlyDelete,
  assertMayReadSermon,
  assertMayTransitionSermon,
  assertMayViewAudit,
  type ApplicationIdentity
} from "../src/application/authorization";

const admin = { subject: "admin-1", role: "admin" } satisfies ApplicationIdentity;
const actions: SermonStateAction[] = [
  "submit",
  "withdraw",
  "schedule",
  "publish",
  "unpublish",
  "archive",
  "restore"
];

describe("approved single-admin authorization", () => {
  it("allows the approved admin every administration capability", () => {
    expect(() => assertAdminAccess(admin)).not.toThrow();
    expect(() => assertMayReadSermon(admin, { createdBySubject: null })).not.toThrow();
    expect(() => assertMayEditSermon(admin, { status: "archived" })).not.toThrow();
    expect(() => assertMayManageTaxonomies(admin)).not.toThrow();
    expect(() => assertMayViewAudit(admin)).not.toThrow();
    expect(() => assertMayPermanentlyDelete(admin)).not.toThrow();
    for (const action of actions) {
      expect(() => assertMayTransitionSermon(admin, {}, action)).not.toThrow();
    }
  });

  it("denies forged former roles and unknown identities by default", () => {
    for (const role of ["editor", "contributor", "visitor", ""] as const) {
      const forged = { subject: `forged-${role}`, role } as unknown as ApplicationIdentity;
      expect(() => assertAdminAccess(forged)).toThrow("Administration access is required");
      expect(() => assertMayReadSermon(forged)).toThrow();
      expect(() => assertMayEditSermon(forged)).toThrow();
      expect(() => assertMayManageTaxonomies(forged)).toThrow();
      expect(() => assertMayViewAudit(forged)).toThrow();
      expect(() => assertMayPermanentlyDelete(forged)).toThrow();
      expect(() => assertMayTransitionSermon(forged, {}, "publish")).toThrow();
    }
  });
});
