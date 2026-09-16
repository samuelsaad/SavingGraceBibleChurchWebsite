import { describe, expect, it } from "vitest";
import { prepareCaptionTranscript } from "../src/enrichment/caption-transcript-preparation";
import { compareRetainedCaptionTranscript } from "../src/enrichment/remaining-caption-comparison";

const filler = Array.from({ length: 520 }, (_, i) => `sample${i}`).join(" ");
function source(cues: string[]) { return Buffer.from("WEBVTT\n\n" + cues.join("\n\n") +
  `\n\n00:10.000 --> 06:00.000\n${filler}\n`); }
function checked(cues: string[]) {
  const bytes=source(cues), prepared=prepareCaptionTranscript(bytes);
  const comparison=compareRetainedCaptionTranscript({sourceBytes:bytes,transcript:prepared.text});
  expect(comparison.receipt.outcome).toBe("exact_word_sequence");
  expect(comparison.receipt.markerPositionsMatch).toBe(true);
  expect(comparison.receipt.captureWordSequenceMatches).toBe(true);
  return {prepared,receipt:comparison.receipt};
}
describe("source-preserving transcript preparation", () => {
  it("retains a leading provider redaction at zero overlap", () => {
    const {prepared,receipt}=checked(["00:00.000 --> 00:01.000\n[ __ ] words remain"]);
    expect(prepared.text.startsWith("[ __ ] words remain")).toBe(true); expect(receipt.source?.redactionCount).toBe(1);
  });
  it("retains a marker-only cue", () => {
    const {receipt}=checked(["00:00.000 --> 00:01.000\n[ __ ]", "00:02.000 --> 00:03.000\nwords continue"]);
    expect(receipt.source?.redactionCount).toBe(1);
  });
  it("removes only exact touching overlap including markers", () => {
    const {receipt}=checked(["00:00.000 --> 00:02.000\nwords [ __ ] continue", "00:01.000 --> 00:03.000\n[ __ ] continue onward"]);
    expect(receipt.source?.redactionCount).toBe(1);
  });
  it("preserves repeated markers across a positive time gap", () => {
    const {receipt}=checked(["00:00.000 --> 00:01.000\nwords [ __ ]", "00:02.000 --> 00:03.000\n[ __ ] words"]);
    expect(receipt.source?.redactionCount).toBe(2);
  });
  it("preserves uncertainty and numeric punctuation", () => {
    const {prepared,receipt}=checked(["00:00.000 --> 00:01.000\n[unclear name] values 1.2 and -12 remain"]);
    expect(prepared.text).toContain("1.2 and -12"); expect(receipt.source?.uncertaintyCount).toBe(1);
  });
  it("refuses unsafe markup and incomplete source material", () => {
    expect(()=>prepareCaptionTranscript(source(["00:00.000 --> 00:01.000\n<unknown>hidden</unknown> words remain"])))
      .toThrow("prepared_transcript_marker_or_word_mismatch");
    expect(()=>prepareCaptionTranscript(Buffer.from("WEBVTT\n\n00:00.000 --> 00:01.000\nshort\n")))
      .toThrow("caption_not_sufficiently_complete_for_grounded_generation");
  });
});
