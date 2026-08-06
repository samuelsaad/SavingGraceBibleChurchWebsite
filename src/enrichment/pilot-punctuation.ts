import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";

export const phase3b2PunctuationProcessingVersion = "phase3b2b-punctuation-v2";
export const punctuationChunkTokenLimit = 450;

export type PunctuationFailureCode =
  | "missing_input"
  | "corrupt_json"
  | "schema_failure"
  | "unauthorised_record"
  | "path_safety_failure"
  | "lexical_preservation_failure"
  | "supporting_reference_failure"
  | "persistence_conflict"
  | "database_verification_failure"
  | "manual_punctuation_required"
  | "not_attempted_prior_failure"
  | "unexpected_failure";

export class PunctuationWorkflowError extends Error {
  constructor(
    readonly code: PunctuationFailureCode,
    readonly safeDetail: string,
    options?: ErrorOptions
  ) {
    super(safeDetail, options);
    this.name = "PunctuationWorkflowError";
  }
}

export function punctuationFailure(
  error: unknown,
  fallbackCode: PunctuationFailureCode = "unexpected_failure",
  fallbackDetail = "The punctuation workflow stopped safely because an unexpected error occurred."
): PunctuationWorkflowError {
  return error instanceof PunctuationWorkflowError
    ? error
    : new PunctuationWorkflowError(fallbackCode, fallbackDetail, { cause: error });
}

export interface PunctuationChunkBoundary {
  chunkId: string;
  index: number;
  tokenStart: number;
  tokenEndExclusive: number;
  sourceStart: number;
  sourceEnd: number;
  sourceSha256: string;
}

export interface PunctuationChunkTemplate extends PunctuationChunkBoundary {
  sourceFilename: string;
  cleanedFilename: string;
}

export interface PunctuationWorkspaceTemplate {
  schemaVersion: 2;
  processingVersion: typeof phase3b2PunctuationProcessingVersion;
  videoId: string;
  sourceContentSha256: string;
  sourceTokenSequenceSha256: string;
  unicodeNormalization: "NFC";
  lexicalTokenPolicy: "whitespace-delimited-non-punctuation-case-folded";
  chunkTokenLimit: typeof punctuationChunkTokenLimit;
  chunks: PunctuationChunkTemplate[];
}

export interface PunctuationChunkOutput extends PunctuationChunkBoundary {
  cleanedOutputSha256: string;
  cleanedText: string;
}

export interface PunctuationPack {
  schemaVersion: 2;
  processingVersion: typeof phase3b2PunctuationProcessingVersion;
  videoId: string;
  sourceContentSha256: string;
  sourceTokenSequenceSha256: string;
  unicodeNormalization: "NFC";
  lexicalTokenPolicy: "whitespace-delimited-non-punctuation-case-folded";
  chunkTokenLimit: typeof punctuationChunkTokenLimit;
  chunks: PunctuationChunkOutput[];
}

export interface PunctuationValidationMetrics {
  sourceContentSha256: string;
  sourceTokenSequenceSha256: string;
  cleanedTokenSequenceSha256: string;
  tokenSequencesMatch: true;
  sourceTokenCount: number;
  cleanedTokenCount: number;
  chunkCount: number;
  punctuationChangeCount: number;
  capitalizationChangeCount: number;
  paragraphCount: number;
  zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens: true;
  whitespaceBoundariesPreserved: true;
  sourceSegmentsCompleteAndUnique: true;
  chunkReassemblyComplete: true;
}

export interface ValidatedPunctuationResult {
  cleanedText: string;
  metrics: PunctuationValidationMetrics;
}

interface LexicalToken {
  canonical: string;
  start: number;
  end: number;
}

const windowsReservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizePunctuationText(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC");
}

function caseFold(value: string): string {
  return value.toLowerCase();
}

function canonicalToken(segment: string): string {
  return caseFold([...segment].filter((character) => !/\p{P}/u.test(character)).join("").normalize("NFC"));
}

function lexicalTokenEntries(value: string): LexicalToken[] {
  const normalized = normalizePunctuationText(value);
  return [...normalized.matchAll(/\S+/gu)].flatMap((match) => {
    const canonical = canonicalToken(match[0]);
    return canonical.length === 0
      ? []
      : [{ canonical, start: match.index!, end: match.index! + match[0].length }];
  });
}

export function lexicalTokens(value: string): string[] {
  return lexicalTokenEntries(value).map((token) => token.canonical);
}

export function lexicalTokenSequenceSha256(value: string): string {
  return sha256(JSON.stringify(lexicalTokens(value)));
}

function assertSameLexicalTokens(source: string, cleaned: string, context: string): void {
  const sourceTokens = lexicalTokens(source);
  const cleanedTokens = lexicalTokens(cleaned);
  if (
    sourceTokens.length !== cleanedTokens.length ||
    sourceTokens.some((token, index) => token !== cleanedTokens[index])
  ) {
    throw new PunctuationWorkflowError(
      "lexical_preservation_failure",
      `${context} changed lexical tokens or whitespace word boundaries.`
    );
  }
}

export function deterministicPunctuationChunkPlan(
  sourceInput: string
): PunctuationChunkBoundary[] {
  const source = normalizePunctuationText(sourceInput);
  const tokens = lexicalTokenEntries(source);
  if (tokens.length === 0) {
    throw new PunctuationWorkflowError(
      "missing_input",
      "The punctuation source contains no lexical tokens."
    );
  }
  const chunks: PunctuationChunkBoundary[] = [];
  for (
    let tokenStart = 0, index = 0;
    tokenStart < tokens.length;
    tokenStart += punctuationChunkTokenLimit, index += 1
  ) {
    const tokenEndExclusive = Math.min(tokenStart + punctuationChunkTokenLimit, tokens.length);
    const sourceStart = index === 0 ? 0 : tokens[tokenStart]!.start;
    const sourceEnd = tokenEndExclusive === tokens.length
      ? source.length
      : tokens[tokenEndExclusive]!.start;
    const chunkId = `chunk-${String(index + 1).padStart(4, "0")}`;
    chunks.push({
      chunkId,
      index,
      tokenStart,
      tokenEndExclusive,
      sourceStart,
      sourceEnd,
      sourceSha256: sha256(source.slice(sourceStart, sourceEnd))
    });
  }
  const reassembled = chunks.map((chunk) => source.slice(chunk.sourceStart, chunk.sourceEnd)).join("");
  if (reassembled !== source) {
    throw new PunctuationWorkflowError(
      "lexical_preservation_failure",
      "Deterministic punctuation source chunks did not reassemble exactly."
    );
  }
  return chunks;
}

export function createPunctuationWorkspaceTemplate(
  videoId: string,
  sourceInput: string
): PunctuationWorkspaceTemplate {
  const source = normalizePunctuationText(sourceInput);
  return {
    schemaVersion: 2,
    processingVersion: phase3b2PunctuationProcessingVersion,
    videoId,
    sourceContentSha256: sha256(source),
    sourceTokenSequenceSha256: lexicalTokenSequenceSha256(source),
    unicodeNormalization: "NFC",
    lexicalTokenPolicy: "whitespace-delimited-non-punctuation-case-folded",
    chunkTokenLimit: punctuationChunkTokenLimit,
    chunks: deterministicPunctuationChunkPlan(source).map((chunk) => ({
      ...chunk,
      sourceFilename: `${chunk.chunkId}.source.txt`,
      cleanedFilename: `${chunk.chunkId}.cleaned.txt`
    }))
  };
}

function assertBoundaryMatches(
  expected: PunctuationChunkBoundary,
  actual: PunctuationChunkBoundary,
  position: number
): void {
  for (const field of [
    "chunkId",
    "index",
    "tokenStart",
    "tokenEndExclusive",
    "sourceStart",
    "sourceEnd",
    "sourceSha256"
  ] as const) {
    if (actual[field] !== expected[field]) {
      throw new PunctuationWorkflowError(
        "lexical_preservation_failure",
        `Punctuation chunk ${position + 1} has invalid or reordered boundary metadata.`
      );
    }
  }
}

function comparisonParts(value: string): { content: string[]; punctuationGaps: string[] } {
  const content: string[] = [];
  const punctuationGaps = [""];
  for (const character of normalizePunctuationText(value)) {
    if (/\s|\p{Z}/u.test(character)) continue;
    if (/\p{P}/u.test(character)) {
      punctuationGaps[punctuationGaps.length - 1] += character;
      continue;
    }
    content.push(character);
    punctuationGaps.push("");
  }
  return { content, punctuationGaps };
}

function editDistance(left: string, right: string): number {
  const leftCharacters = [...left];
  const rightCharacters = [...right];
  let previous = Array.from({ length: rightCharacters.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= leftCharacters.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= rightCharacters.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + (
          leftCharacters[leftIndex - 1] === rightCharacters[rightIndex - 1] ? 0 : 1
        )
      );
    }
    previous = current;
  }
  return previous[rightCharacters.length]!;
}

function changeMetrics(source: string, cleaned: string): {
  punctuationChangeCount: number;
  capitalizationChangeCount: number;
} {
  const sourceParts = comparisonParts(source);
  const cleanedParts = comparisonParts(cleaned);
  if (
    sourceParts.content.length !== cleanedParts.content.length ||
    sourceParts.content.some((character, index) => caseFold(character) !== caseFold(cleanedParts.content[index]!))
  ) {
    throw new PunctuationWorkflowError(
      "lexical_preservation_failure",
      "Punctuation output changed non-punctuation source characters."
    );
  }
  const capitalizationChangeCount = sourceParts.content.reduce((count, character, index) => {
    const cleanedCharacter = cleanedParts.content[index]!;
    return count + (
      character !== cleanedCharacter && /\p{L}/u.test(character) && /\p{L}/u.test(cleanedCharacter)
        ? 1
        : 0
    );
  }, 0);
  const punctuationChangeCount = sourceParts.punctuationGaps.reduce(
    (count, gap, index) => count + editDistance(gap, cleanedParts.punctuationGaps[index]!),
    0
  );
  return { punctuationChangeCount, capitalizationChangeCount };
}

export function buildPunctuationPack(
  videoId: string,
  sourceInput: string,
  template: PunctuationWorkspaceTemplate,
  cleanedChunkTexts: readonly string[]
): PunctuationPack {
  const source = normalizePunctuationText(sourceInput);
  const expectedTemplate = createPunctuationWorkspaceTemplate(videoId, source);
  if (
    template.schemaVersion !== 2 ||
    template.processingVersion !== phase3b2PunctuationProcessingVersion ||
    template.videoId !== videoId ||
    template.sourceContentSha256 !== expectedTemplate.sourceContentSha256 ||
    template.sourceTokenSequenceSha256 !== expectedTemplate.sourceTokenSequenceSha256 ||
    template.unicodeNormalization !== "NFC" ||
    template.lexicalTokenPolicy !== "whitespace-delimited-non-punctuation-case-folded" ||
    template.chunkTokenLimit !== punctuationChunkTokenLimit ||
    template.chunks.length !== expectedTemplate.chunks.length ||
    cleanedChunkTexts.length !== expectedTemplate.chunks.length
  ) {
    throw new PunctuationWorkflowError(
      "schema_failure",
      "The punctuation workspace does not match the deterministic source template."
    );
  }
  const chunks = expectedTemplate.chunks.map((expected, index) => {
    const actual = template.chunks[index];
    if (!actual) {
      throw new PunctuationWorkflowError(
        "missing_input",
        `The punctuation workspace is missing chunk ${index + 1}.`
      );
    }
    assertBoundaryMatches(expected, actual, index);
    if (
      actual.sourceFilename !== expected.sourceFilename ||
      actual.cleanedFilename !== expected.cleanedFilename
    ) {
      throw new PunctuationWorkflowError(
        "path_safety_failure",
        `Punctuation chunk ${index + 1} has a non-deterministic filename.`
      );
    }
    const cleanedText = normalizePunctuationText(cleanedChunkTexts[index] ?? "").trim();
    if (!cleanedText) {
      throw new PunctuationWorkflowError(
        "missing_input",
        `Punctuation chunk ${index + 1} has no cleaned output.`
      );
    }
    const sourceText = source.slice(expected.sourceStart, expected.sourceEnd);
    assertSameLexicalTokens(sourceText, cleanedText, `Punctuation chunk ${index + 1}`);
    return {
      chunkId: expected.chunkId,
      index: expected.index,
      tokenStart: expected.tokenStart,
      tokenEndExclusive: expected.tokenEndExclusive,
      sourceStart: expected.sourceStart,
      sourceEnd: expected.sourceEnd,
      sourceSha256: expected.sourceSha256,
      cleanedOutputSha256: sha256(cleanedText),
      cleanedText
    };
  });
  const pack: PunctuationPack = {
    schemaVersion: 2,
    processingVersion: phase3b2PunctuationProcessingVersion,
    videoId,
    sourceContentSha256: expectedTemplate.sourceContentSha256,
    sourceTokenSequenceSha256: expectedTemplate.sourceTokenSequenceSha256,
    unicodeNormalization: "NFC",
    lexicalTokenPolicy: "whitespace-delimited-non-punctuation-case-folded",
    chunkTokenLimit: punctuationChunkTokenLimit,
    chunks
  };
  validatePunctuationPack(videoId, source, pack);
  return pack;
}

export function validatePunctuationPack(
  videoId: string,
  sourceInput: string,
  pack: PunctuationPack
): ValidatedPunctuationResult {
  const source = normalizePunctuationText(sourceInput);
  const expectedChunks = deterministicPunctuationChunkPlan(source);
  const expectedSourceSha256 = sha256(source);
  const expectedTokenSequenceSha256 = lexicalTokenSequenceSha256(source);
  if (
    pack.schemaVersion !== 2 ||
    pack.processingVersion !== phase3b2PunctuationProcessingVersion ||
    pack.videoId !== videoId ||
    pack.unicodeNormalization !== "NFC" ||
    pack.lexicalTokenPolicy !== "whitespace-delimited-non-punctuation-case-folded" ||
    pack.chunkTokenLimit !== punctuationChunkTokenLimit ||
    pack.sourceContentSha256 !== expectedSourceSha256 ||
    pack.sourceTokenSequenceSha256 !== expectedTokenSequenceSha256 ||
    pack.chunks.length !== expectedChunks.length
  ) {
    throw new PunctuationWorkflowError(
      "schema_failure",
      "The punctuation pack does not match the authorised source."
    );
  }
  const cleanedChunks = pack.chunks.map((chunk, index) => {
    const expected = expectedChunks[index];
    if (!expected) {
      throw new PunctuationWorkflowError(
        "schema_failure",
        `The punctuation pack has an unexpected chunk ${index + 1}.`
      );
    }
    assertBoundaryMatches(expected, chunk, index);
    if (sha256(chunk.cleanedText) !== chunk.cleanedOutputSha256) {
      throw new PunctuationWorkflowError(
        "lexical_preservation_failure",
        `Punctuation chunk ${index + 1} has a stale cleaned-output hash.`
      );
    }
    const sourceChunk = source.slice(expected.sourceStart, expected.sourceEnd);
    assertSameLexicalTokens(sourceChunk, chunk.cleanedText, `Punctuation chunk ${index + 1}`);
    return normalizePunctuationText(chunk.cleanedText).trim();
  });
  const cleanedText = cleanedChunks.join(" ");
  assertSameLexicalTokens(source, cleanedText, "The reassembled punctuation output");
  const sourceTokens = lexicalTokens(source);
  const cleanedTokens = lexicalTokens(cleanedText);
  const cleanedTokenSequenceSha256 = lexicalTokenSequenceSha256(cleanedText);
  if (cleanedTokenSequenceSha256 !== expectedTokenSequenceSha256) {
    throw new PunctuationWorkflowError(
      "lexical_preservation_failure",
      "The reassembled punctuation output failed whole-sermon token-sequence preservation."
    );
  }
  const changes = changeMetrics(source, cleanedText);
  return {
    cleanedText,
    metrics: {
      sourceContentSha256: expectedSourceSha256,
      sourceTokenSequenceSha256: expectedTokenSequenceSha256,
      cleanedTokenSequenceSha256,
      tokenSequencesMatch: true,
      sourceTokenCount: sourceTokens.length,
      cleanedTokenCount: cleanedTokens.length,
      chunkCount: pack.chunks.length,
      punctuationChangeCount: changes.punctuationChangeCount,
      capitalizationChangeCount: changes.capitalizationChangeCount,
      paragraphCount: cleanedText.split(/\n\s*\n/g).filter((paragraph) => paragraph.trim()).length,
      zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens: true,
      whitespaceBoundariesPreserved: true,
      sourceSegmentsCompleteAndUnique: true,
      chunkReassemblyComplete: true
    }
  };
}

export function resolveSafeDirectChild(
  root: string,
  name: string,
  kind: "file" | "directory",
  expectedSuffix?: string
): string {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    basename(name) !== name ||
    /[\\/:\0]/.test(name) ||
    /[. ]$/.test(name) ||
    windowsReservedName.test(name) ||
    (expectedSuffix !== undefined && !name.endsWith(expectedSuffix))
  ) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      `The private punctuation ${kind} name is unsafe or has the wrong type.`
    );
  }
  const target = resolve(root, name);
  const relationship = relative(resolve(root), target);
  if (!relationship || relationship.startsWith("..") || relationship.includes(":")) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      `The private punctuation ${kind} must be a direct child of its approved directory.`
    );
  }
  return target;
}

export async function assertSafeDirectory(path: string): Promise<void> {
  let status;
  try {
    status = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PunctuationWorkflowError("missing_input", "A required private directory is missing.", { cause: error });
    }
    throw error;
  }
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      "A private workspace directory is a symlink or has an unexpected type."
    );
  }
}

export async function ensureSafeDirectory(path: string): Promise<"created" | "unchanged"> {
  try {
    await mkdir(path);
    await assertSafeDirectory(path);
    return "created";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    await assertSafeDirectory(path);
    return "unchanged";
  }
}

export async function readSafeFile(path: string): Promise<Buffer> {
  let status;
  try {
    status = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PunctuationWorkflowError("missing_input", "A required private input is missing.", { cause: error });
    }
    throw error;
  }
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      "A private input is a symlink or has an unexpected type."
    );
  }
  return readFile(path);
}

async function compareExisting(path: string, expected: Buffer): Promise<"unchanged"> {
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      "A private output target is a symlink or has an unexpected type."
    );
  }
  const existing = await readFile(path);
  if (!existing.equals(expected)) {
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "An existing private artifact differs; refusing to overwrite it."
    );
  }
  return "unchanged";
}

export async function persistNoClobber(
  path: string,
  content: string | Buffer
): Promise<"created" | "unchanged"> {
  const expected = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  await assertSafeDirectory(dirname(path));
  try {
    return await compareExisting(path, expected);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const temporaryName = `.${basename(path)}.${randomUUID()}.tmp`;
  const temporaryPath = resolveSafeDirectChild(dirname(path), temporaryName, "file", ".tmp");
  const handle = await open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(expected);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporaryPath, path);
    return "created";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return await compareExisting(path, expected);
    }
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "The private artifact could not be persisted safely.",
      { cause: error }
    );
  } finally {
    await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export function sourceUncertaintyPassages(
  sourceInput: string
): Array<{ marker: string; safeReason: string }> {
  const uncertaintyPattern = /\[(?:inaudible|unintelligible|unclear)(?:[^\]]*)\]|\?\?+/giu;
  return [...normalizePunctuationText(sourceInput).matchAll(uncertaintyPattern)].map((_match, index) => ({
    marker: `uncertain-${index + 1}`,
    safeReason: "The source export explicitly marks this passage as uncertain; administrator verification is required."
  }));
}
