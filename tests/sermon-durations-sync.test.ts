import { describe, expect, it } from "vitest";
import { assertDurationStatePreserved, durationPacketHash, durationSourceBaselineSha256, planDurationRecord,
  resolveDurationSourceIdentity, validateDurationPacket, matchesDurationRecording } from "../deployment/sermon-durations-sync";

const sermonId = "00000000-0000-4000-8000-000000000001";
const mediaId = "00000000-0000-4000-8000-000000000002";
const otherId = "00000000-0000-4000-8000-000000000003";
const raw = () => ({ schemaVersion: 1, decision: "D-177", baselineHash: durationSourceBaselineSha256, records: [{
  sermonId, sourceWordPressId: "987650001", mediaId, expectedRowVersion: 5, expectedMediaHash: "a".repeat(64),
  evidence: { provider: "sermonaudio", recordingId: "101012345678", broadcasterId: "savinggrace", field: "audioDurationSeconds",
    originalValue: 4328, originalUnits: "seconds", durationSeconds: 4328, retrievedAt: "2026-10-07T00:00:00.000Z",
    metadataSha256: "b".repeat(64), identityVerified: true, broadcasterVerified: true, sourceKind: "cached_official_api" }
}] });
const mapping = () => ({ sequence: 1, outcome: "mapped" as const, sermonId, sourceWordPressId: 987650001, mediaId,
  rowVersion: 5, mediaHash: "a".repeat(64), durationSeconds: null as number | null, status: "draft", deleted: false });

describe("strict duration-only synchronization packet", () => {
  it("normalizes PostgreSQL bigint source IDs while retaining an exact source snapshot binding", () => {
    const p = validateDurationPacket(raw());
    expect(p.records[0]?.sourceWordPressId).toBe(987650001);
    expect(durationPacketHash(p)).toBe(durationPacketHash(validateDurationPacket(p)));
    expect(() => validateDurationPacket({ ...raw(), baselineHash: "f".repeat(64) })).toThrow("duration_sync_packet_invalid");
  });
  it("rejects duplicate scope, unsafe IDs, secrets and arbitrary fields with a fixed error", () => {
    const p = raw();
    for (const candidate of [{ ...p, records: [...p.records, ...p.records] },
      { ...p, records: [{ ...p.records[0], sourceWordPressId: "9007199254740993" }] },
      { ...p, credential: "synthetic-secret-value" }, { ...p, records: [{ ...p.records[0], description: "Disallowed synthetic prose" }] }]) {
      expect(() => validateDurationPacket(candidate)).toThrow(/^duration_sync_packet_invalid$/u);
    }
  });
  it("requires provider units, exact broadcaster and coherent official evidence", () => {
    const p = raw(), record = p.records[0]!;
    for (const evidence of [{ ...record.evidence, originalUnits: "milliseconds" },
      { ...record.evidence, broadcasterId: "different-fixture-church" },
      { ...record.evidence, durationSeconds: 5 }, { ...record.evidence, sourceKind: "cached_official_player" }]) {
      expect(() => validateDurationPacket({ ...p, records: [{ ...record, evidence }] })).toThrow("duration_sync_packet_invalid");
    }
    expect(validateDurationPacket({ ...p, records: [{ ...record, evidence: { ...record.evidence,
      field: "official_audio_player.duration", sourceKind: "cached_official_player", pageSha256: "c".repeat(64) } }] }).records).toHaveLength(1);
  });
});

describe("duration source and version reconciliation", () => {
  it("keeps cached video and audio identities in their own provider and media type", () => {
    const audio = validateDurationPacket(raw()).records[0]!.evidence;
    expect(matchesDurationRecording(audio, { provider: "sermonaudio", media_type: "audio", external_id: "101012345678",
      canonical_url: "https://www.sermonaudio.com/sermons/101012345678" })).toBe(true);
    const video = validateDurationPacket({ ...raw(), records: [{ ...raw().records[0], evidence: {
      provider: "youtube", recordingId: "abcdefghijk", expectedChannelId: `UC${"a".repeat(22)}`,
      originalValue: 4328000, originalUnits: "milliseconds", durationSeconds: 4328, field: "contentDetails.duration(normalized_cache)",
      retrievedAt: "2026-10-07T00:00:00.000Z", metadataSha256: "a".repeat(64), identityVerified: true, channelVerified: true,
      sourceKind: "cached_official_youtube" } }] }).records[0]!.evidence;
    const media = { provider: "youtube", media_type: "video", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk" };
    expect(matchesDurationRecording(video, media)).toBe(true);
    expect(matchesDurationRecording(video, { ...media, canonical_url: "https://www.youtube.com/watch?v=abcdefghijl" })).toBe(false);
    expect(matchesDurationRecording(video, { ...media, canonical_url: null })).toBe(false);
    expect(matchesDurationRecording(video, { ...media, media_type: "audio" })).toBe(false);
    expect(matchesDurationRecording(audio, media)).toBe(false);
  });
  it("joins only one exact WordPress identity and never creates absent sermons", () => {
    const record = validateDurationPacket(raw()).records[0]!;
    const row = { id: otherId, sourceWordPressId: record.sourceWordPressId, rowVersion: 3, status: "draft", deleted: false };
    expect(resolveDurationSourceIdentity(record, [row])).toMatchObject({ outcome: "mapped", record: { id: otherId } });
    expect(resolveDurationSourceIdentity(record, [])).toMatchObject({ outcome: "unavailable" });
    expect(resolveDurationSourceIdentity(record, [row, { ...row, id: sermonId }])).toMatchObject({ outcome: "conflicting" });
    expect(resolveDurationSourceIdentity(record, [{ ...row, id: sermonId, sourceWordPressId: 987650002 }])).toMatchObject({ outcome: "conflicting" });
  });
  it("uses current local plan versions, but the frozen destination versions on staging", () => {
    const record = validateDurationPacket(raw()).records[0]!, saved = mapping();
    expect(planDurationRecord(record, saved, saved, "local").outcome).toBe("ready");
    const staged = { ...saved, sermonId: otherId, mediaId: "00000000-0000-4000-8000-000000000004", rowVersion: 2, mediaHash: "d".repeat(64) };
    expect(planDurationRecord(record, staged, staged, "staging").outcome).toBe("ready");
    expect(planDurationRecord(record, staged, staged, "local").outcome).toBe("conflicting");
    expect(planDurationRecord(record, saved, { ...saved, rowVersion: 6 }, "local").reason).toBe("concurrent_metadata_change");
    expect(planDurationRecord(record, staged, { ...staged, mediaHash: "e".repeat(64) }, "staging").reason).toBe("concurrent_metadata_change");
  });
  it("recognizes an identical rerun and preserves different durations or ineligible status", () => {
    const record = validateDurationPacket(raw()).records[0]!, saved = mapping();
    expect(planDurationRecord(record, saved, { ...saved, rowVersion: 6, durationSeconds: 4328, mediaHash: "f".repeat(64) }, "local").outcome).toBe("unchanged");
    expect(planDurationRecord(record, saved, { ...saved, durationSeconds: 4300 }, "local").reason).toBe("existing_recording_duration_differs");
    expect(planDurationRecord(record, saved, { ...saved, status: "archived" }, "local").outcome).toBe("pending");
    expect(planDurationRecord(record, saved, { ...saved, deleted: true }, "local").outcome).toBe("pending");
  });
});

type State = Parameters<typeof assertDurationStatePreserved>[0];
const state = (): State => ({
  fingerprint: { sha256: "a".repeat(64), sequenceHash: "b".repeat(64), counts: { sermons: 1 }, tables: [
    { table: "sermons", count: 1, sha256: "sermon-hash" }, { table: "sermon_transcripts", count: 1, sha256: "transcript-hash" },
    { table: "sermon_media", count: 1, sha256: "media-hash" }] },
  membership: [sermonId], eligible: [sermonId], publicEligible: [],
  sermons: [{ key: sermonId, hash: "before-sermon", preservedHash: "content" }],
  media: [{ key: mediaId, sermonId, hash: "before-media", preservedHash: "identity", durationSeconds: null }],
  audits: [{ key: "audit-1", hash: "original-audit" }], mediaAudits: [{ key: "source-1", hash: "original-source" }],
  extensions: [{ key: `${sermonId}:website.original-acceptance`, hash: "original-decision" }], durationReceipts: []
});
describe("duration preservation proof", () => {
  it("allows only scoped metadata/version changes plus appended audited history", () => {
    const before = state(), after = structuredClone(before);
    after.sermons[0]!.hash = "after-sermon"; after.media[0]!.hash = "after-media"; after.media[0]!.durationSeconds = 4328;
    after.audits.push({ key: "audit-2", hash: "new-duration-audit" });
    after.mediaAudits.push({ key: "source-2", hash: "new-duration-source" });
    after.durationReceipts.push({ key: `${sermonId}:website.recording-duration-refresh`, hash: "new-duration-receipt" });
    expect(() => assertDurationStatePreserved(before, after, new Set([sermonId]), new Set([mediaId]))).not.toThrow();
    expect(() => assertDurationStatePreserved(before, after, new Set(), new Set())).toThrow("duration_sync_unrelated_record_changed");
  });
  it("rejects content, media identity, eligibility, old audit, original receipt or unrelated table changes", () => {
    const before = state();
    const changes: Array<(after: State) => void> = [
      after => { after.sermons[0]!.preservedHash = "changed-content"; },
      after => { after.media[0]!.preservedHash = "changed-recording"; },
      after => { after.eligible = []; }, after => { after.publicEligible = [sermonId]; },
      after => { after.audits[0]!.hash = "rewritten-audit"; }, after => { after.mediaAudits = []; },
      after => { after.extensions[0]!.hash = "fabricated-approval"; },
      after => { after.fingerprint.tables[1]!.sha256 = "changed-transcript"; },
      after => { after.fingerprint.sequenceHash = "reset-sequence"; }
    ];
    for (const change of changes) {
      const after = structuredClone(before); change(after);
      expect(() => assertDurationStatePreserved(before, after, new Set([sermonId]), new Set([mediaId]))).toThrow(/^duration_sync_/u);
    }
  });
});
