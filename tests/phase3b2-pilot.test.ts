import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { enrichmentDraftBundleSchema } from "../src/enrichment/contracts";
import { phase3b2PilotManifestSchema } from "../src/enrichment/pilot-contracts";
import { phase3b2PunctuationCompletionManifestSchema } from "../src/enrichment/pilot-punctuation-contracts";
import {
  canonicalYouTubeIdentity,
  prepareExistingCaptionText
} from "../src/enrichment/pilot-caption";
import {
  buildPunctuationPack,
  createPunctuationWorkspaceTemplate,
  deterministicPunctuationChunkPlan,
  lexicalTokenSequenceSha256,
  lexicalTokens,
  normalizePunctuationText,
  persistNoClobber,
  resolveSafeDirectChild,
  assertSafeDirectory,
  validatePunctuationPack
} from "../src/enrichment/pilot-punctuation";
import {
  assembleCompletion,
  finalizeWorkspace,
  importCompletion,
  verifyCompletion,
  prepareWorkspace
} from "../src/enrichment/pilot-punctuation-cli";
import {
  assertExactCompletionScope,
  loadTrustedPunctuationSources,
  validateSupportingParagraphs
} from "../src/enrichment/phase3b2b-pilot";
import {
  remainingAuthorisedPilotVideoId,
  restoreRemainingPhase3b2Pilot
} from "../src/enrichment/phase3b2-pilot";

const ids = ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"] as const;
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function longCaption(punctuated = true): string {
  const sentence = punctuated
    ? "the anonymised speaker explains a reviewed example and invites careful reflection."
    : "the anonymised speaker explains a reviewed example and invites careful reflection";
  return Array.from({ length: 110 }, () => sentence).join(" ");
}

function manifest() {
  return {
    schemaVersion: 1,
    sourceSnapshotId: "anonymised-three-record-pilot",
    allowlistedVideoIds: [...ids],
    records: ids.map((videoId, index) => ({
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}&list=playlist&tracking=ignored`,
      captionFilename: `anonymised-${index + 1}.txt`,
      captionLanguage: "en-AU",
      captionTrackType: "unknown",
      sourceWordPressId: 990_000 + index,
      title: `Anonymised pilot ${index + 1}`,
      slug: `anonymised-pilot-${index + 1}`,
      serviceDate: "1970-01-01",
      descriptionDraft: null,
      questionAnswers: []
    }))
  };
}

function punctuationSource(): string {
  return Array.from(
    { length: 1_050 },
    (_, index) => `word${index} testimony reflection`
  ).join(" ");
}

function validPunctuationPack() {
  const source = punctuationSource();
  const template = createPunctuationWorkspaceTemplate(ids[0], source);
  const cleaned = template.chunks.map((chunk, index) => {
    const sourceChunk = source.slice(chunk.sourceStart, chunk.sourceEnd).trim();
    return `${index % 2 === 0 ? sourceChunk.replace(/^w/, "W") : sourceChunk}.`;
  });
  return { source, template, pack: buildPunctuationPack(ids[0], source, template, cleaned) };
}

function singleChunkPack(source: string, cleaned: string) {
  const template = createPunctuationWorkspaceTemplate(ids[0], source);
  return buildPunctuationPack(ids[0], source, template, [cleaned]);
}

function completionRecord(videoId: string, punctuationPackFilename: string) {
  return {
    videoId,
    punctuationPackFilename,
    descriptionDraft: "This anonymised private description is grounded in the local test transcript and remains subject to explicit administrator review.",
    descriptionSupportingParagraphs: [1],
    questionAnswers: Array.from({ length: 7 }, (_, index) => ({
      question: `What does anonymised question ${index + 1} ask?`,
      answer: "It records a transcript-grounded anonymised answer that remains a draft for administrator review.",
      supportingParagraphs: [1]
    })),
    possibleCaptionErrors: [{ detail: "An anonymised uncertainty requires review.", supportingParagraphs: [1] }],
    apparentNamesAndScriptureReferences: []
  };
}

async function createAnonymisedPilotRoot() {
  const root = await mkdtemp(join(tmpdir(), "phase3b2b-hardening-"));
  temporaryRoots.push(root);
  const value = manifest();
  const manifestPath = join(root, "phase3b2-manifest.private.json");
  await writeFile(manifestPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await Promise.all(value.records.map((record, index) =>
    writeFile(join(root, record.captionFilename), longCaption(index === 0), "utf8")
  ));
  return { root, manifestPath, value };
}

describe("Phase 3B.2 private caption pilot", () => {
  it("accepts only the explicit three-video allowlist and ignores playlist identity parameters", () => {
    expect(
      canonicalYouTubeIdentity(
        "https://www.youtube.com/watch?v=aaaaaaaaaaa&list=example&index=4&utm_source=test",
        ids
      )
    ).toEqual({
      videoId: "aaaaaaaaaaa",
      canonicalUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa"
    });
    expect(() =>
      canonicalYouTubeIdentity("https://www.youtube.com/watch?v=ddddddddddd", ids)
    ).toThrow("not in the private pilot allowlist");
    expect(() =>
      canonicalYouTubeIdentity("https://www.youtube.com/embed/aaaaaaaaaaa", ids)
    ).toThrow("watch URLs");
  });

  it("requires an exact one-to-one three-record mapping manifest", () => {
    expect(phase3b2PilotManifestSchema.parse(manifest()).records).toHaveLength(3);
    const invalid = manifest();
    invalid.records[2]!.videoId = ids[0];
    expect(() => phase3b2PilotManifestSchema.parse(invalid)).toThrow();
  });

  it("uses one exact remaining-pilot restoration allowlist identity", () => {
    expect(remainingAuthorisedPilotVideoId).toBe("RAMFOAOWwMA");
    expect(() => restoreRemainingPhase3b2Pilot(
      {} as Pool,
      "unused-anonymised-root",
      manifest(),
      ids[0]
    )).toThrow("outside the exact remaining-restoration allowlist");
  });

  it("prepares only captions with safe sentence boundaries and preserves the word sequence", () => {
    const source = longCaption(true);
    const result = prepareExistingCaptionText(source);
    expect(result.usable).toBe(true);
    if (!result.usable) throw new Error("Expected usable anonymised caption");
    const sourceWords = source.toLocaleLowerCase("en-AU").match(/[a-z]+/g);
    const cleanedWords = result.cleanedText.toLocaleLowerCase("en-AU").match(/[a-z]+/g);
    expect(cleanedWords).toEqual(sourceWords);
    expect(result.cleanedText.startsWith("The anonymised")).toBe(true);
  });

  it("fails missing, short, unpunctuated, and unsafe sources without inventing text", () => {
    expect(prepareExistingCaptionText("").usable).toBe(false);
    const unpunctuated = prepareExistingCaptionText(longCaption(false));
    expect(unpunctuated).toMatchObject({
      usable: false,
      failure: { code: "manual_punctuation_required" }
    });
    expect(prepareExistingCaptionText(`${longCaption(true)} <iframe>`)).toMatchObject({
      usable: false,
      failure: { code: "unsafe_caption_markup" }
    });
  });

  it("retains explicit uncertainty markers for human review", () => {
    const source = `${longCaption(true)} [unclear wording].`;
    const result = prepareExistingCaptionText(source);
    expect(result.usable).toBe(true);
    if (!result.usable) throw new Error("Expected usable anonymised caption");
    expect(result.metrics.uncertaintyMarkerCount).toBe(1);
    expect(result.unresolvedPassages).toEqual([
      expect.objectContaining({ marker: "uncertain-1" })
    ]);
    expect(result.cleanedText).toContain("[unclear wording]");
  });

  it("accepts structured private provenance but grants no approval", () => {
    const parsed = enrichmentDraftBundleSchema.parse({
      schemaVersion: 3,
      sourceWordPressId: 990_001,
      targetSermonId: "75df2144-b557-50f6-98bd-011cd696bfb9",
      expectedRowVersion: 1,
      description: {
        bodyText: "An anonymised draft description that is long enough for later human review and remains private until an administrator explicitly approves it.",
        provenance: { sourceKind: "generated_draft", sourceReference: "anonymised-local-pilot" }
      },
      transcript: {
        bodyText: "An anonymised prepared transcript.",
        provenance: { sourceKind: "caption", sourceReference: "anonymised-local-pilot" }
      },
      questionAnswers: Array.from({ length: 5 }, (_, index) => ({
        question: `How should the anonymised example ${index + 1} be considered?`,
        answer: `The anonymised answer ${index + 1} remains a draft for human review.`,
        provenance: { sourceKind: "generated_draft", sourceReference: "anonymised-local-pilot" }
      })),
      sourceProvenance: {
        provider: "youtube",
        videoId: ids[0],
        canonicalUrl: `https://www.youtube.com/watch?v=${ids[0]}`,
        captionLanguage: "en-AU",
        captionTrackType: "unknown",
        originalFilename: "anonymised.txt",
        sourceContentSha256: "a".repeat(64),
        retrievalAttribution: "authorised_youtube_studio_export",
        sourceCharacterCount: 10_000,
        cleanedCharacterCount: 10_020,
        apparentCompleteness: "apparently_complete",
        uncertaintyMarkerCount: 0,
        warnings: [{ code: "human_review_required", safeDetail: "Human review remains required." }],
        unresolvedPassages: [],
        processingVersion: "test-v1",
        importedAt: "2026-08-06T00:00:00.000Z",
        processedAt: "2026-08-06T00:00:01.000Z",
        processingDurationMs: 1_000,
        estimatedReviewMinutes: 60,
        manualAttentionRequired: true,
        accuracyReviewStatus: "required"
      }
    });
    expect(parsed.schemaVersion).toBe(3);
    expect(JSON.stringify(parsed)).not.toMatch(/"status":"approved"|approvedBy/);
  });

  it("contains no audio/video download or external request implementation", async () => {
    const source = (await Promise.all([
      readFile("src/enrichment/phase3b2-pilot.ts", "utf8"),
      readFile("src/enrichment/phase3b2b-pilot.ts", "utf8"),
      readFile("src/enrichment/pilot-punctuation.ts", "utf8"),
      readFile("src/enrichment/pilot-punctuation-cli.ts", "utf8")
    ])).join("\n");
    expect(source).not.toMatch(/\bfetch\s*\(|https?\.request|youtube-dl|yt-dlp|ffmpeg|speech[-_ ]to[-_ ]text/i);
    expect(source).toContain("'phase3b2_pilot'");
    expect(source).not.toContain("VALUES ($1, 'wordpress', 'phase3b2_private_pilot'");
  });

  it("uses deterministic non-overlapping word ranges and exact chunk reassembly", () => {
    const source = punctuationSource();
    const chunks = deterministicPunctuationChunkPlan(source);
    expect(chunks).toHaveLength(7);
    expect(chunks[0]).toMatchObject({ index: 0, tokenStart: 0, tokenEndExclusive: 450, sourceStart: 0 });
    expect(chunks.at(-1)).toMatchObject({ index: 6, tokenStart: 2_700, tokenEndExclusive: 3_150 });
    expect(chunks.slice(1).every((chunk, index) => chunk.sourceStart === chunks[index]!.sourceEnd)).toBe(true);
    expect(chunks.map((chunk) => source.slice(chunk.sourceStart, chunk.sourceEnd)).join("")).toBe(source);
  });

  it("accepts punctuation, case and paragraph changes with independently measured token sequences", () => {
    const { source, pack } = validPunctuationPack();
    const validated = validatePunctuationPack(ids[0], source, pack);
    expect(validated.metrics).toMatchObject({
      tokenSequencesMatch: true,
      sourceTokenCount: 3_150,
      cleanedTokenCount: 3_150,
      chunkCount: 7,
      capitalizationChangeCount: 4,
      punctuationChangeCount: 7,
      zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens: true,
      whitespaceBoundariesPreserved: true,
      sourceSegmentsCompleteAndUnique: true,
      chunkReassemblyComplete: true
    });
    expect(validated.metrics.sourceTokenSequenceSha256).toBe(lexicalTokenSequenceSha256(source));
    expect(validated.metrics.cleanedTokenSequenceSha256).toBe(lexicalTokenSequenceSha256(validated.cleanedText));
    expect(validated.metrics.cleanedTokenCount).toBe(lexicalTokens(validated.cleanedText).length);
  });

  it("rejects missing, duplicated, reordered, stale-hash and lexically changed chunks", () => {
    const { source, pack } = validPunctuationPack();

    const missing = structuredClone(pack);
    missing.chunks.pop();
    expect(() => validatePunctuationPack(ids[0], source, missing)).toThrow("does not match");

    const duplicated = structuredClone(pack);
    duplicated.chunks[1] = structuredClone(duplicated.chunks[0]!);
    expect(() => validatePunctuationPack(ids[0], source, duplicated)).toThrow("invalid or reordered");

    const reordered = structuredClone(pack);
    [reordered.chunks[0], reordered.chunks[1]] = [reordered.chunks[1]!, reordered.chunks[0]!];
    expect(() => validatePunctuationPack(ids[0], source, reordered)).toThrow("invalid or reordered");

    const staleHash = structuredClone(pack);
    staleHash.chunks[0]!.cleanedText += "!";
    expect(() => validatePunctuationPack(ids[0], source, staleHash)).toThrow("stale cleaned-output hash");

    const changedWord = structuredClone(pack);
    const template = createPunctuationWorkspaceTemplate(ids[0], source);
    const changedChunks = changedWord.chunks.map((chunk) => chunk.cleanedText);
    changedChunks[0] = changedChunks[0]!.replace(/word0/i, "altered0");
    expect(() => buildPunctuationPack(ids[0], source, template, changedChunks)).toThrow(
      "changed lexical tokens or whitespace word boundaries"
    );
  });

  it("authorises exactly two unique punctuation-completion records", () => {
    const completion = {
      schemaVersion: 2,
      sourceSnapshotId: "anonymised-punctuation-completion",
      records: [ids[0], ids[1]].map((videoId, index) => ({
        videoId,
        punctuationPackFilename: `anonymised-${index + 1}.private.json`,
        descriptionDraft: "An anonymised private draft description grounded in the prepared transcript and long enough for controlled administrator review.",
        descriptionSupportingParagraphs: [1],
        questionAnswers: Array.from({ length: 7 }, (_, questionIndex) => ({
          question: `What does anonymised question ${questionIndex + 1} ask?`,
          answer: "It records an anonymised, transcript-grounded draft answer for later administrator review.",
          supportingParagraphs: [1]
        })),
        possibleCaptionErrors: [],
        apparentNamesAndScriptureReferences: []
      }))
    };
    expect(phase3b2PunctuationCompletionManifestSchema.parse(completion).records).toHaveLength(2);
    completion.records[1]!.videoId = ids[0];
    expect(() => phase3b2PunctuationCompletionManifestSchema.parse(completion)).toThrow(
      "exactly two unique records"
    );
  });

  it("rejects token merging, splitting, addition, removal, substitution, duplication and reordering", () => {
    const rejected: Array<[string, string]> = [
      ["not able", "notable"],
      ["notable", "not able"],
      ["alpha beta", "alpha beta gamma"],
      ["alpha beta gamma", "alpha gamma"],
      ["alpha beta", "alpha delta"],
      ["alpha beta", "alpha alpha beta"],
      ["alpha beta", "beta alpha"]
    ];
    for (const [source, cleaned] of rejected) {
      expect(() => singleChunkPack(source, cleaned)).toThrow(
        "changed lexical tokens or whitespace word boundaries"
      );
    }
    expect(validatePunctuationPack(ids[0], "not able", singleChunkPack("not able", "Not, able.")))
      .toMatchObject({ metrics: { sourceTokenCount: 2, cleanedTokenCount: 2 } });
    expect(validatePunctuationPack(ids[0], "notable", singleChunkPack("notable", "Not-able.")))
      .toMatchObject({ metrics: { sourceTokenCount: 1, cleanedTokenCount: 1 } });
  });

  it("documents NFC token comparison while retaining content and chunk hashes", () => {
    const source = "cafe\u0301 reflection";
    const pack = singleChunkPack(source, "Café,\n\nreflection.");
    const validated = validatePunctuationPack(ids[0], source, pack);
    expect(validated.metrics).toMatchObject({
      sourceTokenCount: 2,
      cleanedTokenCount: 2,
      tokenSequencesMatch: true
    });
    expect(pack).toMatchObject({
      unicodeNormalization: "NFC",
      lexicalTokenPolicy: "whitespace-delimited-non-punctuation-case-folded"
    });
    expect(pack.sourceContentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pack.chunks[0]?.cleanedOutputSha256).toMatch(/^[0-9a-f]{64}$/);

    const rawMultichunkSource = `\uFEFF${Array.from(
      { length: 500 },
      (_, index) => `cafe\u0301-${index}`
    ).join("\r\n")}`;
    const normalizedSource = normalizePunctuationText(rawMultichunkSource);
    const normalizedChunks = deterministicPunctuationChunkPlan(normalizedSource);
    expect(normalizedChunks.map((chunk) =>
      normalizedSource.slice(chunk.sourceStart, chunk.sourceEnd)
    ).join("")).toBe(normalizedSource);
  });

  it("uses no-clobber byte identity and rejects traversal and symlink directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "phase3b2b-persistence-"));
    temporaryRoots.push(root);
    const artifact = resolveSafeDirectChild(root, "artifact.private.json", "file", ".private.json");
    await expect(persistNoClobber(artifact, "safe\n")).resolves.toBe("created");
    await expect(persistNoClobber(artifact, "safe\n")).resolves.toBe("unchanged");
    await expect(persistNoClobber(artifact, "different\n")).rejects.toMatchObject({
      code: "persistence_conflict"
    });
    expect(() => resolveSafeDirectChild(root, "..\\outside.private.json", "file", ".private.json"))
      .toThrow("unsafe");

    const target = join(root, "target");
    const linked = join(root, "linked");
    await mkdir(target);
    await symlink(target, linked, process.platform === "win32" ? "junction" : "dir");
    await expect(assertSafeDirectory(linked)).rejects.toMatchObject({ code: "path_safety_failure" });
  });

  it("derives exact-two authority from source state at prepare, finalize and assemble", async () => {
    const { root, manifestPath, value } = await createAnonymisedPilotRoot();
    const trusted = await loadTrustedPunctuationSources(root, value);
    expect(trusted.sources.map((source) => source.record.videoId)).toEqual([ids[1], ids[2]]);

    await expect(prepareWorkspace(manifestPath, ids[0], "successful-record-workspace"))
      .rejects.toMatchObject({ code: "unauthorised_record" });
    await expect(prepareWorkspace(manifestPath, "ddddddddddd", "unknown-record-workspace"))
      .rejects.toMatchObject({ code: "unauthorised_record" });
    await expect(finalizeWorkspace(
      manifestPath,
      ids[0],
      "successful-record-workspace",
      "successful.private.json"
    )).rejects.toMatchObject({ code: "unauthorised_record" });
    await expect(finalizeWorkspace(
      manifestPath,
      "ddddddddddd",
      "unknown-record-workspace",
      "unknown.private.json"
    )).rejects.toMatchObject({ code: "unauthorised_record" });

    const workspaces = ["punctuation-one", "punctuation-two"];
    const packs = ["anonymised-one.pack.private.json", "anonymised-two.pack.private.json"];
    for (const [index, videoId] of [ids[1], ids[2]].entries()) {
      const prepared = await prepareWorkspace(manifestPath, videoId, workspaces[index]!);
      expect(prepared).toMatchObject({ outcome: "punctuation_workspace_prepared" });
      const finalized = await finalizeWorkspace(
        manifestPath,
        videoId,
        workspaces[index]!,
        packs[index]!
      );
      expect(finalized).toMatchObject({
        outcome: "punctuation_pack_validated",
        sourceTokenCount: expect.any(Number),
        cleanedTokenCount: expect.any(Number)
      });
      await writeFile(
        join(root, `record-${index + 1}.private.json`),
        `${JSON.stringify(completionRecord(videoId, packs[index]!), null, 2)}\n`,
        "utf8"
      );
    }

    const assembled = await assembleCompletion(
      manifestPath,
      "record-1.private.json",
      "record-2.private.json",
      "completion.private.json"
    );
    expect(assembled).toMatchObject({ authorisedRecordCount: 2, questionAnswerDraftCount: 14 });
    const completion = phase3b2PunctuationCompletionManifestSchema.parse(
      JSON.parse(await readFile(join(root, "completion.private.json"), "utf8"))
    );
    expect(() => assertExactCompletionScope(completion, trusted.manifest, trusted.sources)).not.toThrow();

    await writeFile(
      join(root, "successful-record.private.json"),
      `${JSON.stringify(completionRecord(ids[0], packs[0]!), null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(root, "unknown-record.private.json"),
      `${JSON.stringify(completionRecord("ddddddddddd", packs[0]!), null, 2)}\n`,
      "utf8"
    );
    for (const [firstRecord, output] of [
      ["successful-record.private.json", "successful-scope.private.json"],
      ["unknown-record.private.json", "unknown-scope.private.json"]
    ] as const) {
      await expect(assembleCompletion(
        manifestPath,
        firstRecord,
        "record-2.private.json",
        output
      )).rejects.toMatchObject({ code: "unauthorised_record" });
    }

    const rejectedScopes = [
      {
        filename: "successful-completion.private.json",
        completion: { ...completion, records: [completionRecord(ids[0], packs[0]!), completion.records[1]!] }
      },
      {
        filename: "unknown-completion.private.json",
        completion: {
          ...completion,
          records: [completionRecord("ddddddddddd", packs[0]!), completion.records[1]!]
        }
      }
    ];
    const databaseMustNotBeReached = {
      query: () => {
        throw new Error("Database access must not occur before trusted exact-two scope validation.");
      }
    } as unknown as Pool;
    for (const rejected of rejectedScopes) {
      const path = join(root, rejected.filename);
      await writeFile(path, `${JSON.stringify(rejected.completion, null, 2)}\n`, "utf8");
      await expect(importCompletion(manifestPath, path, databaseMustNotBeReached))
        .rejects.toMatchObject({ code: "unauthorised_record" });
      await expect(verifyCompletion(manifestPath, path, databaseMustNotBeReached))
        .rejects.toMatchObject({ code: "unauthorised_record" });
    }

    await expect(assembleCompletion(
      manifestPath,
      "record-1.private.json",
      "record-1.private.json",
      "invalid-completion.private.json"
    )).rejects.toMatchObject({ code: "schema_failure" });
  });

  it("fails closed on differing finalized packs and invalid supporting references", async () => {
    const { root, manifestPath } = await createAnonymisedPilotRoot();
    await prepareWorkspace(manifestPath, ids[1], "punctuation-workspace");
    await expect(finalizeWorkspace(
      manifestPath,
      ids[1],
      "punctuation-workspace",
      "anonymised.pack.private.json"
    )).resolves.toMatchObject({ persistence: "created" });
    await expect(finalizeWorkspace(
      manifestPath,
      ids[1],
      "punctuation-workspace",
      "anonymised.pack.private.json"
    )).resolves.toMatchObject({ persistence: "unchanged" });

    const template = JSON.parse(
      await readFile(join(root, "punctuation-workspace", "chunk-manifest.private.json"), "utf8")
    ) as { chunks: Array<{ cleanedFilename: string }> };
    const cleanedPath = join(root, "punctuation-workspace", template.chunks[0]!.cleanedFilename);
    const cleaned = await readFile(cleanedPath, "utf8");
    await writeFile(cleanedPath, `${cleaned.trim()}.`, "utf8");
    await expect(finalizeWorkspace(
      manifestPath,
      ids[1],
      "punctuation-workspace",
      "anonymised.pack.private.json"
    )).rejects.toMatchObject({ code: "persistence_conflict" });

    const invalidReferences = completionRecord(ids[1], "anonymised.pack.private.json");
    invalidReferences.descriptionSupportingParagraphs = [2];
    expect(() => validateSupportingParagraphs(invalidReferences, 1)).toThrow(
      "outside the punctuated transcript"
    );
  });
});
