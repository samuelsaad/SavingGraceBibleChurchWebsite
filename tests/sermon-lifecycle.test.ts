import { describe, expect, it } from "vitest";
import { isFutureSchedule, transitionSermonStatus } from "../src/application/sermon-lifecycle";

describe("admin sermon lifecycle", () => {
  it("supports the explicit provisional transition matrix", () => {
    expect(transitionSermonStatus("draft", "submit")).toBe("pending");
    expect(transitionSermonStatus("pending", "withdraw")).toBe("draft");
    expect(transitionSermonStatus("pending", "schedule")).toBe("scheduled");
    expect(transitionSermonStatus("scheduled", "publish")).toBe("published");
    expect(transitionSermonStatus("published", "unpublish")).toBe("unpublished");
    expect(transitionSermonStatus("unpublished", "archive")).toBe("archived");
    expect(transitionSermonStatus("archived", "restore")).toBe("draft");
    expect(transitionSermonStatus("archived", "publish")).toBeNull();
  });

  it("accepts only a future scheduled timestamp", () => {
    const now = new Date("2026-08-05T00:00:00.000Z");
    expect(isFutureSchedule("2026-08-05T00:00:00.000Z", now)).toBe(false);
    expect(isFutureSchedule("2026-08-05T00:00:00.001Z", now)).toBe(true);
    expect(isFutureSchedule(undefined, now)).toBe(false);
  });
});
