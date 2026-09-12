import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalReviewJson } from "../src/domain/delegated-ai-review";
import { compareRetainedCaptionTranscript } from "../src/enrichment/remaining-caption-comparison";
import { normalizedWords, parseVttBytes } from "../src/youtube/pilot-caption-proof";

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const vtt = (...cues: Array<[string, string, string]>) => Buffer.from("WEBVTT\n\n" + cues
  .map(([start, end, text]) => `${start} --> ${end}\n${text}\n`).join("\n"));
const single = (text: string) => vtt(["00:00:00.000", "00:00:02.000", text]);
const compare = (source: string, transcript: string) => compareRetainedCaptionTranscript({ sourceBytes: single(source), transcript });

describe("complete retained-caption comparison", () => {
  it("binds exact source bytes and transcript text while allowing approved presentation normalization", () => {
    const sourceBytes = single("<c>Café, DELTA!</c> Don’t lose 12 items.");
    const transcript = "cafe\u0301 delta dont  lose 12 ITEMS\n";
    const result = compareRetainedCaptionTranscript({ sourceBytes, transcript,
      expectedSourceSha256: sha(sourceBytes), expectedTranscriptSha256: sha(transcript) });
    expect(result.deterministicComparison).toMatchObject({ sourceSha256: sha(sourceBytes), transcriptSha256: sha(transcript),
      algorithm: "retained-caption-word-preservation-v1", outcome: "exact_word_sequence", completeSourceCompared: true });
    expect(result.receipt).toMatchObject({ rawSourceSha256: sha(sourceBytes), sourceByteCount: sourceBytes.length,
      source: { wordCount: 6, markerCount: 0 }, mismatchingTokenPositions: 0,
      semanticReadingAssessed: false, audioVerified: false });
    expect(result.deterministicComparison.comparisonReceiptSha256).toBe(sha(canonicalReviewJson(result.receipt)));
    expect(compareRetainedCaptionTranscript({ sourceBytes, transcript,
      expectedSourceSha256: sha(sourceBytes), expectedTranscriptSha256: sha(transcript) })).toEqual(result);
  });

  it.each([
    ["alpha must not lose 12 items", "alpha must lose 12 items"],
    ["alpha must not lose 12 items", "alpha must not lose 13 items"],
    ["alpha holds 1.2 units", "alpha holds 12 units"],
    ["alpha changed by -12 units", "alpha changed by 12 units"],
    ["alpha records 1:2 today", "alpha records 12 today"],
    ["alpha beta gamma delta", "alpha gamma beta delta"],
    ["alpha beta gamma delta", "alpha beta gamma gamma delta"],
    ["alpha beta gamma delta", "alpha beta gamma"],
    ["alpha beta gamma delta", "beta gamma delta"]
  ])("rejects omission, number change, ordering, duplication or truncation (%s)", (source, transcript) => {
    const result = compare(source, transcript);
    expect(result.deterministicComparison).toMatchObject({ outcome: "unexplained_difference", completeSourceCompared: true });
    expect(result.receipt.mismatchingTokenPositions).toBeGreaterThan(0);
  });

  it("checks the middle and final words of a complete long source", () => {
    const words = Array.from({ length: 20_000 }, (_, index) => `token${index}`);
    const source = words.join(" ");
    words[10_000] = "changedmiddle"; words[19_999] = "changedend";
    const result = compare(source, words.join(" "));
    expect(result.receipt).toMatchObject({ completeSourceCompared: true, mismatchingTokenPositions: 2,
      firstMismatchTokenIndex: 10_000, source: { wordCount: 20_000 }, transcript: { wordCount: 20_000 } });
  });

  it("preserves markers the existing parser deliberately excludes from lexical normalization", () => {
    const source = "alpha [ __ ] beta [__] gamma";
    expect(parseVttBytes(single(source)).normalizedWords).toEqual(normalizedWords("alpha beta gamma"));
    const result = compare(source, "alpha beta gamma");
    expect(result.receipt).toMatchObject({ outcome: "unexplained_difference", wordSequenceMatches: true,
      markerSequenceMatches: false, markerPositionsMatch: false, source: { markerCount: 2, redactionCount: 2 },
      transcript: { markerCount: 0, redactionCount: 0 } });
  });

  it("binds marker order and exact positions among words, even with identical counts", () => {
    const moved = compare("alpha [__] beta gamma [unclear] delta", "alpha beta [__] gamma [unclear] delta");
    expect(moved.receipt).toMatchObject({ outcome: "unexplained_difference", wordSequenceMatches: true,
      markerSequenceMatches: true, markerPositionsMatch: false });
    const swapped = compare("alpha [__] beta [unclear] gamma", "alpha [unclear] beta [__] gamma");
    expect(swapped.receipt).toMatchObject({ outcome: "unexplained_difference", markerSequenceMatches: false,
      source: { markerCount: 2 }, transcript: { markerCount: 2 } });
  });

  it.each([
    ["alpha [unclear name?] beta", "alpha [unclear name] beta"],
    ["alpha ?? beta", "alpha beta"],
    ["alpha ??? beta", "alpha ?? beta"],
    ["alpha [inaudible] beta", "alpha inaudible beta"],
    ["alpha [__] beta", "alpha [___] beta"],
    ["alpha [signal] beta", "alpha signal beta"]
  ])("retains uncertainty and arbitrary annotation content (%s)", (source, transcript) => {
    expect(compare(source, transcript).deterministicComparison.outcome).toBe("unexplained_difference");
  });

  it("allows marker case and whitespace only, retaining punctuation inside uncertainty", () => {
    expect(compare("alpha [ __ ] beta [Unclear   Name?] ?? delta", "ALPHA [__] beta [unclear name?] ?? delta").receipt)
      .toMatchObject({ outcome: "exact_word_sequence", source: { markerCount: 3, redactionCount: 1, uncertaintyCount: 2 } });
  });

  it("does not weaken capture-contract word boundaries while recognizing markers", () => {
    expect(compare("alpha[__]beta gamma", "alpha [__] beta gamma").receipt)
      .toMatchObject({ outcome: "unexplained_difference", mismatchingTokenPositions: 0, captureWordSequenceMatches: false });
    expect(compare("alpha ［＿＿］ beta", "alpha beta").receipt)
      .toMatchObject({ outcome: "unexplained_difference", source: { markerCount: 1, redactionCount: 1 } });
  });

  it("collapses only exact marker-aware rolling overlap at touching or overlapping cues", () => {
    const sourceBytes = vtt(["00:00:00.000", "00:00:01.000", "alpha [__] beta"],
      ["00:00:01.000", "00:00:02.000", "[ __ ] beta gamma"],
      ["00:00:01.900", "00:00:03.000", "gamma delta"]);
    const result = compareRetainedCaptionTranscript({ sourceBytes, transcript: "alpha [__] beta gamma delta" });
    expect(result.receipt).toMatchObject({ outcome: "exact_word_sequence", cueCount: 3,
      rawCueTokenCount: 8, rawCueMarkerCount: 2, overlapRemovedTokenCount: 3, overlapRemovedMarkerCount: 1,
      source: { tokenCount: 5, markerCount: 1 } });
  });

  it("retains repetition across a positive gap and differing markers across touching cues", () => {
    const withGap = vtt(["00:00:00.000", "00:00:01.000", "alpha [__] beta"],
      ["00:00:01.001", "00:00:02.000", "[__] beta gamma"]);
    expect(compareRetainedCaptionTranscript({ sourceBytes: withGap, transcript: "alpha [__] beta gamma" }).receipt)
      .toMatchObject({ outcome: "unexplained_difference", overlapRemovedTokenCount: 0 });
    const changedMarker = vtt(["00:00:00.000", "00:00:01.000", "alpha [__]"],
      ["00:00:01.000", "00:00:02.000", "[unclear] beta"]);
    expect(compareRetainedCaptionTranscript({ sourceBytes: changedMarker, transcript: "alpha [__] [unclear] beta" }).receipt)
      .toMatchObject({ outcome: "exact_word_sequence", overlapRemovedTokenCount: 0, source: { markerCount: 2 } });
  });

  it("supports WEBVTT headers, metadata, cue ids, inline timestamps and encoded markers", () => {
    const sourceBytes = Buffer.from("\ufeffWEBVTT sample\r\nKind: captions\r\nLanguage: en\r\n\r\nNOTE capture note\r\nignored metadata\r\n\r\ncue-id\r\n00:00:00.000 --> 00:00:02.000 align:start\r\n \r\n<v Reader><00:00:00.500>alpha &#91;__&#93; &quot;beta&quot;</v>\r\n");
    expect(compareRetainedCaptionTranscript({ sourceBytes, transcript: "alpha [ __ ] beta" }).receipt)
      .toMatchObject({ outcome: "exact_word_sequence", cueCount: 1, source: { wordCount: 2, markerCount: 1 } });
  });

  it.each([
    [Buffer.from([0xff, 0xfe]), "invalid_utf8"],
    [Buffer.from("private invalid source text"), "invalid_webvtt"],
    [Buffer.from("WEBVTT\n00:00:00.000 --> 00:00:02.000\nalpha"), "invalid_webvtt"],
    [single("alpha <unclear> beta"), "unsupported_markup"],
    [single("alpha [unclear beta"), "invalid_marker"],
    [single("alpha &unknown; beta"), "invalid_entity"],
    [single("alpha &#9999999999999; beta"), "invalid_entity"],
    [single("alpha \ufffd beta"), "unsupported_markup"],
    [single("[__]"), "unreadable_content"],
    [vtt(["00:00:02.000", "00:00:03.000", "alpha"], ["00:00:01.000", "00:00:02.000", "beta"]), "cue_order_invalid"],
    [vtt(["00:00:02.000", "00:00:01.000", "alpha"]), "invalid_cue"]
  ])("fails closed with safe codes for unsupported or malformed source (%s)", (sourceBytes, failureCode) => {
    expect(compareRetainedCaptionTranscript({ sourceBytes, transcript: "alpha beta" }).receipt)
      .toMatchObject({ outcome: "source_unavailable", completeSourceCompared: false, failureCode });
  });

  it("records missing sources honestly without an invented raw hash or comparison", () => {
    const result = compareRetainedCaptionTranscript({ sourceBytes: null, transcript: "alpha beta", expectedSourceSha256: "a".repeat(64) });
    expect(result.receipt).toMatchObject({ outcome: "source_unavailable", failureCode: "source_missing",
      rawSourceSha256: null, sourceSha256: "a".repeat(64), source: null, completeSourceCompared: false });
    expect(compareRetainedCaptionTranscript({ sourceBytes: null, transcript: "alpha beta" }).deterministicComparison.sourceSha256).toBeNull();
  });

  it("refuses hash drift even when the parsed word sequence would match", () => {
    expect(compareRetainedCaptionTranscript({ sourceBytes: single("alpha beta"), transcript: "alpha beta", expectedSourceSha256: "a".repeat(64) }).receipt)
      .toMatchObject({ outcome: "unexplained_difference", failureCode: "source_hash_mismatch", completeSourceCompared: false });
    expect(compareRetainedCaptionTranscript({ sourceBytes: single("alpha beta"), transcript: "alpha beta", expectedTranscriptSha256: "b".repeat(64) }).receipt)
      .toMatchObject({ outcome: "unexplained_difference", failureCode: "transcript_hash_mismatch", completeSourceCompared: false });
  });

  it("never includes source wording, marker text, input exceptions or semantic claims in evidence", () => {
    const source = "fictionalprivateword [unclear fictionalprivatename] beta";
    const result = compare(source, "fictionalprivateword beta");
    expect(JSON.stringify(result)).not.toMatch(/fictionalprivateword|fictionalprivatename|<|>/u);
    expect(result.receipt).toMatchObject({ semanticReadingAssessed: false, audioVerified: false });
    expect(() => compareRetainedCaptionTranscript({ sourceBytes: single(source), transcript: source,
      expectedSourceSha256: "fictionalprivatename" })).toThrow("comparison_expected_hash_invalid");
  });
});
