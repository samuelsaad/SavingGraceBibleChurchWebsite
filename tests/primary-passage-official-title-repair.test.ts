import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { biblePassageParserVersion } from "../src/domain/bible-passage";
import { classifyOfficialTitleReviewRepair } from "../src/scripture/primary-passage-official-title-repair";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

describe("official-title primary-passage repair state", () => {
  const previousEvidenceSha256 = sha256("An anonymised display title");
  const expectedEvidenceSha256 = sha256("An anonymised source title | Mark 10:46-50");
  const pendingReview = {
    proposal_outcome: "no_reference" as const,
    evidence_source: "local_youtube_title" as const,
    evidence_sha256: previousEvidenceSha256,
    parser_version: biblePassageParserVersion,
    review_status: "pending" as const,
    reviewed_by_subject: null,
    reviewed_at: null
  };

  it("plans one repair, then preserves the matching repaired state on rerun", () => {
    expect(classifyOfficialTitleReviewRepair({
      review: pendingReview,
      auditCount: 0,
      previousEvidenceSha256,
      expectedEvidenceSha256,
      expectedProposalOutcome: "proposed"
    })).toBe("repair");

    expect(classifyOfficialTitleReviewRepair({
      review: {
        ...pendingReview,
        proposal_outcome: "proposed",
        evidence_sha256: expectedEvidenceSha256
      },
      auditCount: 1,
      previousEvidenceSha256,
      expectedEvidenceSha256,
      expectedProposalOutcome: "proposed"
    })).toBe("preserve");
  });

  it("refuses administrator decisions, changed evidence, and duplicate audit markers", () => {
    expect(classifyOfficialTitleReviewRepair({
      review: { ...pendingReview, reviewed_by_subject: "administrator" },
      auditCount: 0,
      previousEvidenceSha256,
      expectedEvidenceSha256,
      expectedProposalOutcome: "proposed"
    })).toBe("conflict");
    expect(classifyOfficialTitleReviewRepair({
      review: { ...pendingReview, proposal_outcome: "proposed", evidence_sha256: sha256("changed") },
      auditCount: 1,
      previousEvidenceSha256,
      expectedEvidenceSha256,
      expectedProposalOutcome: "proposed"
    })).toBe("conflict");
    expect(classifyOfficialTitleReviewRepair({
      review: pendingReview,
      auditCount: 2,
      previousEvidenceSha256,
      expectedEvidenceSha256,
      expectedProposalOutcome: "proposed"
    })).toBe("conflict");
  });
});
