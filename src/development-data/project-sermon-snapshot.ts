import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const projectSermonSnapshotVersion = "project-sermon-snapshot-v1" as const;
export const projectSermonSnapshotDirectory = resolve("development-data/project-sermon-snapshot-v1");
export const projectSermonSnapshotContentPath = resolve(projectSermonSnapshotDirectory, "sermons.json");
export const projectSermonSnapshotManifestPath = resolve(projectSermonSnapshotDirectory, "manifest.json");
export const projectSermonSnapshotSyntheticSubject = "project-sermon-snapshot-v1";
export const projectSermonSnapshotSourceStatus = "project_sermon_snapshot_v1";

export type JsonRow = Record<string, unknown>;

export interface ProjectSermonSnapshot {
  schemaVersion: typeof projectSermonSnapshotVersion;
  source: {
    databaseClass: "local-disposable-postgresql";
    snapshotIsolation: "repeatable-read-read-only";
    exportedAt: string;
  };
  tables: {
    speakers: JsonRow[];
    series: JsonRow[];
    bookClassifications: JsonRow[];
    sourceTaxonomyTerms: JsonRow[];
    sermons: JsonRow[];
    sermonSeries: JsonRow[];
    sermonBooks: JsonRow[];
    sermonSourceTerms: JsonRow[];
    scriptureReferences: JsonRow[];
    media: JsonRow[];
    extensions: JsonRow[];
    transcripts: JsonRow[];
    questionAnswers: JsonRow[];
    enrichmentSources: JsonRow[];
    guidedReviews: JsonRow[];
    guidedReviewItems: JsonRow[];
    primaryPassageReviews: JsonRow[];
    aiContentReviews: JsonRow[];
    aiComponentReviews: JsonRow[];
    aiMetadataAssignments: JsonRow[];
    restrictedAcceptances: JsonRow[];
  };
}

export interface ProjectSermonSnapshotManifest {
  schemaVersion: typeof projectSermonSnapshotVersion;
  contentFile: "sermons.json";
  contentSha256: string;
  counts: Record<string, number>;
  sermonIdsSha256: string;
  transcriptBodiesSha256: string;
  descriptionBodiesSha256: string;
  questionAnswerBodiesSha256: string;
  operationalDataExcluded: string[];
  importMode: "private-development-projection";
}

const sha256Pattern = /^[0-9a-f]{64}$/u;
const forbiddenKeyPattern = /(?:password|secret|token|private.?key|session|cookie|credential|oauth|authorization.?code|reviewer.?subject|authorized.?by|executed.?by|created.?by.?subject|updated.?by.?subject|approved.?by.?subject|reviewed.?by.?subject|actor.?subject|admin.?subject|original.?filename)/iu;

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function serializeProjectSnapshot(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function requireObject(value: unknown, label: string): asserts value is JsonRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function requireString(row: JsonRow, key: string, label: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label}.${key} must be a non-empty string`);
  return value;
}

function inspectForbiddenKeys(value: unknown, path = "snapshot"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeyPattern.test(key)) throw new Error(`Forbidden operational field at ${path}.${key}`);
    inspectForbiddenKeys(child, `${path}.${key}`);
  }
}

export function snapshotCounts(snapshot: ProjectSermonSnapshot): Record<string, number> {
  return Object.fromEntries(Object.entries(snapshot.tables).map(([name, rows]) => [name, rows.length]));
}

export function validateProjectSermonSnapshot(value: unknown): ProjectSermonSnapshot {
  requireObject(value, "snapshot");
  if (value.schemaVersion !== projectSermonSnapshotVersion) throw new Error("Unsupported project sermon snapshot version");
  requireObject(value.source, "snapshot.source");
  if (value.source.databaseClass !== "local-disposable-postgresql" ||
      value.source.snapshotIsolation !== "repeatable-read-read-only" ||
      typeof value.source.exportedAt !== "string") {
    throw new Error("Project snapshot source metadata is invalid");
  }
  requireObject(value.tables, "snapshot.tables");
  const expectedTables = [
    "speakers", "series", "bookClassifications", "sourceTaxonomyTerms", "sermons",
    "sermonSeries", "sermonBooks", "sermonSourceTerms", "scriptureReferences", "media",
    "extensions", "transcripts", "questionAnswers", "enrichmentSources", "guidedReviews",
    "guidedReviewItems", "primaryPassageReviews", "aiContentReviews", "aiComponentReviews",
    "aiMetadataAssignments", "restrictedAcceptances"
  ] as const;
  for (const name of expectedTables) {
    if (!Array.isArray(value.tables[name])) throw new Error(`snapshot.tables.${name} must be an array`);
  }
  if (Object.keys(value.tables).sort().join("\n") !== [...expectedTables].sort().join("\n")) {
    throw new Error("Project snapshot contains an unrecognised table projection");
  }
  inspectForbiddenKeys(value);

  const snapshot = value as unknown as ProjectSermonSnapshot;
  const sermonIds = new Set<string>();
  const slugs = new Set<string>();
  for (const row of snapshot.tables.sermons) {
    const id = requireString(row, "id", "sermon");
    const slug = requireString(row, "slug", "sermon");
    if (sermonIds.has(id) || slugs.has(slug)) throw new Error("Project snapshot sermon identities must be unique");
    sermonIds.add(id);
    slugs.add(slug);
    requireString(row, "title", "sermon");
    requireString(row, "status", "sermon");
  }
  if (snapshot.tables.transcripts.length !== sermonIds.size) throw new Error("Every snapshot sermon must have exactly one transcript");
  const transcriptIds = new Set<string>();
  for (const row of snapshot.tables.transcripts) {
    const id = requireString(row, "sermon_id", "transcript");
    if (!sermonIds.has(id) || transcriptIds.has(id)) throw new Error("Transcript identities do not match the sermon scope");
    transcriptIds.add(id);
    const body = requireString(row, "body_text", "transcript");
    if (row.content_sha256 !== sha256(body)) throw new Error("Transcript content hash mismatch");
  }
  const qaBySermon = new Map<string, number[]>();
  for (const row of snapshot.tables.questionAnswers) {
    const id = requireString(row, "sermon_id", "questionAnswer");
    if (!sermonIds.has(id)) throw new Error("Q&A row points outside the sermon scope");
    const order = row.display_order;
    if (!Number.isInteger(order) || Number(order) < 1) throw new Error("Q&A order must be a positive integer");
    const question = requireString(row, "question_text", "questionAnswer");
    const answer = requireString(row, "answer_text", "questionAnswer");
    if (row.content_sha256 !== sha256(`${question}\n${answer}`)) throw new Error("Q&A content hash mismatch");
    const values = qaBySermon.get(id) ?? [];
    values.push(Number(order));
    qaBySermon.set(id, values);
  }
  for (const id of sermonIds) {
    const orders = (qaBySermon.get(id) ?? []).sort((a, b) => a - b);
    if (orders.some((order, index) => order !== index + 1)) throw new Error("Q&A ordering must be contiguous within each sermon");
  }
  for (const row of snapshot.tables.sermons) {
    const summary = row.summary;
    const expected = summary === null ? null : sha256(String(summary));
    if (row.summary_sha256 !== expected) throw new Error("Description content hash mismatch");
  }
  const linkedTables = [
    snapshot.tables.sermonSeries, snapshot.tables.sermonBooks, snapshot.tables.sermonSourceTerms,
    snapshot.tables.scriptureReferences, snapshot.tables.media, snapshot.tables.extensions,
    snapshot.tables.enrichmentSources, snapshot.tables.guidedReviews, snapshot.tables.primaryPassageReviews,
    snapshot.tables.aiContentReviews, snapshot.tables.aiComponentReviews,
    snapshot.tables.aiMetadataAssignments, snapshot.tables.restrictedAcceptances
  ];
  for (const rows of linkedTables) {
    for (const row of rows) {
      if (!sermonIds.has(requireString(row, "sermon_id", "linkedRow"))) {
        throw new Error("Snapshot relationship points outside the sermon scope");
      }
    }
  }
  return snapshot;
}

export function validateProjectSermonManifest(value: unknown): ProjectSermonSnapshotManifest {
  requireObject(value, "manifest");
  if (value.schemaVersion !== projectSermonSnapshotVersion || value.contentFile !== "sermons.json" ||
      value.importMode !== "private-development-projection") throw new Error("Project snapshot manifest metadata is invalid");
  for (const key of ["contentSha256", "sermonIdsSha256", "transcriptBodiesSha256", "descriptionBodiesSha256", "questionAnswerBodiesSha256"]) {
    if (typeof value[key] !== "string" || !sha256Pattern.test(value[key] as string)) throw new Error(`Invalid manifest ${key}`);
  }
  requireObject(value.counts, "manifest.counts");
  if (!Array.isArray(value.operationalDataExcluded) || value.operationalDataExcluded.some((item) => typeof item !== "string")) {
    throw new Error("Manifest operational exclusions are invalid");
  }
  return value as unknown as ProjectSermonSnapshotManifest;
}

function joinedHash(rows: JsonRow[], selector: (row: JsonRow) => string): string {
  return sha256(rows.map(selector).join("\n"));
}

export function deriveProjectSnapshotHashes(snapshot: ProjectSermonSnapshot) {
  return {
    sermonIdsSha256: joinedHash(snapshot.tables.sermons, (row) => String(row.id)),
    transcriptBodiesSha256: joinedHash(snapshot.tables.transcripts, (row) => String(row.content_sha256)),
    descriptionBodiesSha256: joinedHash(snapshot.tables.sermons, (row) => String(row.summary_sha256 ?? "")),
    questionAnswerBodiesSha256: joinedHash(snapshot.tables.questionAnswers, (row) => String(row.content_sha256))
  };
}

export async function loadTrackedProjectSermonSnapshot() {
  const [contentBytes, manifestBytes] = await Promise.all([
    readFile(projectSermonSnapshotContentPath),
    readFile(projectSermonSnapshotManifestPath)
  ]);
  const manifest = validateProjectSermonManifest(JSON.parse(manifestBytes.toString("utf8")));
  const contentSha256 = sha256(contentBytes);
  if (manifest.contentSha256 !== contentSha256) throw new Error("Project snapshot content hash does not match its manifest");
  const snapshot = validateProjectSermonSnapshot(JSON.parse(contentBytes.toString("utf8")));
  if (JSON.stringify(snapshotCounts(snapshot)) !== JSON.stringify(manifest.counts)) throw new Error("Project snapshot counts do not match its manifest");
  const derived = deriveProjectSnapshotHashes(snapshot);
  for (const [key, expected] of Object.entries(derived)) {
    if (manifest[key as keyof typeof derived] !== expected) throw new Error(`Project snapshot ${key} mismatch`);
  }
  return { snapshot, manifest, contentSha256, manifestSha256: sha256(manifestBytes) };
}
