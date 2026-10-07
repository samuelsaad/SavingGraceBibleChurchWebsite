import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  descriptionSemanticPipelineFingerprint,
  descriptionSemanticPipelineSchema,
  type DescriptionEmbeddingModel,
  type DescriptionSemanticPipeline
} from "./description-related-themes";

const MODEL_IDENTIFIER = "BAAI/bge-small-en-v1.5";
const MODEL_REVISION = "5e62ea33e012fda8c02802b906664c915ebd1bb1";
const MODEL_ROOT_SETTING = "DESCRIPTION_EMBEDDING_MODEL_ROOT";
const LOCAL_ACQUISITION_MANIFEST = "acquisition-manifest.local.json";
const APPROVED_ONNX_SHA256 = "828e1496d7fabb79cfa4dcd84fa38625c0d3d21da474a00f08db0f559940cf35";
const APPROVED_FILE_PATHS = [
  "1_Pooling/config.json",
  "config_sentence_transformers.json",
  "config.json",
  "modules.json",
  "onnx/model.onnx",
  "README.md",
  "sentence_bert_config.json",
  "special_tokens_map.json",
  "tokenizer_config.json",
  "tokenizer.json",
  "vocab.txt"
] as const;
const APPROVED_DIRECTORY_PATHS = ["1_Pooling", "onnx"] as const;
const APPROVED_BATCH_SIZE = 8;
const NORMALISATION_TOLERANCE = 0.00002;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const publicFileSchema = z.object({
  path: z.enum(APPROVED_FILE_PATHS),
  sourceUrl: z.url(),
  redirectHosts: z.array(z.enum(["huggingface.co", "us.aws.cdn.hf.co"])).max(2),
  bytes: z.number().int().positive(),
  sha256: sha256Schema
}).strict();

export const approvedLocalModelManifestSchema = z.object({
  schemaVersion: z.literal("sgbc-approved-local-embedding-model-v1"),
  model: z.object({
    identifier: z.literal(MODEL_IDENTIFIER),
    revision: z.literal(MODEL_REVISION),
    license: z.literal("MIT"),
    format: z.literal("unquantised ONNX"),
    artifactSetSha256: sha256Schema
  }).strict(),
  runtime: z.object({
    identifier: z.literal("@huggingface/transformers"),
    version: z.literal("4.2.0"),
    license: z.literal("Apache-2.0"),
    repository: z.literal("https://github.com/huggingface/transformers.js"),
    registryTarball: z.literal(
      "https://registry.npmjs.org/@huggingface/transformers/-/transformers-4.2.0.tgz"
    ),
    packageIntegrity: z.literal(
      "sha512-8BRCoBMH0XsWaEIamuR0LrJGAfftgHAfb2Vrffy0VKlSAE/MnUJ5/h/zTfEP3fDIft+nk7TqB8xXEyABGitBjQ=="
    )
  }).strict(),
  pipeline: z.object({
    task: z.literal("feature-extraction"),
    pooling: z.literal("cls"),
    normalisation: z.literal("l2_float32"),
    dimensions: z.literal(384),
    maximumInputTokens: z.literal(512),
    dtype: z.literal("fp32"),
    queryPrefix: z.null(),
    documentPrefix: z.null(),
    batchSize: z.literal(APPROVED_BATCH_SIZE)
  }).strict(),
  storage: z.object({
    rootSetting: z.literal(MODEL_ROOT_SETTING),
    externalToRepository: z.literal(true),
    remoteModelsAllowed: z.literal(false)
  }).strict(),
  files: z.array(publicFileSchema).length(APPROVED_FILE_PATHS.length)
}).strict();

export type ApprovedLocalModelManifest = z.infer<typeof approvedLocalModelManifestSchema>;

const localAcquisitionManifestSchema = z.object({
  schema_version: z.literal("sgbc-local-model-acquisition-v1"),
  model: z.literal(MODEL_IDENTIFIER),
  revision: z.literal(MODEL_REVISION),
  license: z.literal("MIT"),
  format: z.literal("unquantised ONNX"),
  dimensions: z.literal(384),
  pooling: z.literal("CLS"),
  normalisation: z.literal("L2 float32"),
  max_input_tokens: z.literal(512),
  artifact_set_sha256: sha256Schema,
  files: z.array(z.object({
    path: z.enum(APPROVED_FILE_PATHS),
    source_url: z.url(),
    redirect_hosts: z.array(z.enum(["huggingface.co", "us.aws.cdn.hf.co"])).max(2),
    bytes: z.number().int().positive(),
    sha256: sha256Schema
  }).strict()).length(APPROVED_FILE_PATHS.length)
}).strict();

export class LocalDescriptionEmbeddingError extends Error {
  constructor(
    public readonly code:
      | "model_root_unavailable"
      | "model_root_scope_failure"
      | "model_manifest_failure"
      | "model_artifact_integrity_failure"
      | "runtime_integrity_failure"
      | "pipeline_fingerprint_mismatch"
      | "runtime_load_failure"
      | "input_too_long"
      | "runtime_output_failure",
    message: string
  ) {
    super(message);
    this.name = "LocalDescriptionEmbeddingError";
  }
}

function fail(
  code: LocalDescriptionEmbeddingError["code"],
  message: string
): never {
  throw new LocalDescriptionEmbeddingError(code, message);
}

const publicManifestPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../model-manifests/BAAI-bge-small-en-v1.5-5e62ea33e012fda8c02802b906664c915ebd1bb1.json"
);

export async function loadApprovedLocalModelManifest(
  manifestPath = publicManifestPath
): Promise<ApprovedLocalModelManifest> {
  try {
    const parsed = approvedLocalModelManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8"))
    );
    const paths = parsed.files.map((file) => file.path).sort();
    if (new Set(paths).size !== paths.length || paths.join("\n") !== [...APPROVED_FILE_PATHS].sort().join("\n")) {
      fail("model_manifest_failure", "The approved model manifest file inventory is not exact");
    }
    const expectedPrefix = `https://huggingface.co/${MODEL_IDENTIFIER}/resolve/${MODEL_REVISION}/`;
    for (const file of parsed.files) {
      if (file.sourceUrl !== `${expectedPrefix}${file.path}`) {
        fail("model_manifest_failure", "An approved model source URL is not immutable and exact");
      }
    }
    const onnx = parsed.files.find((file) => file.path === "onnx/model.onnx");
    if (onnx?.sha256 !== APPROVED_ONNX_SHA256) {
      fail("model_manifest_failure", "The approved ONNX checksum does not match policy");
    }
    return parsed;
  } catch (error) {
    if (error instanceof LocalDescriptionEmbeddingError) throw error;
    fail("model_manifest_failure", "The approved local model manifest is unavailable or invalid");
  }
}

function normalizedPath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function isWithin(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === "" || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== "..");
}

export async function resolveConfiguredModelRoot(
  environment: NodeJS.ProcessEnv = process.env,
  repositoryRoot = process.cwd()
): Promise<string> {
  const configured = environment[MODEL_ROOT_SETTING];
  if (!configured || !isAbsolute(configured)) {
    fail("model_root_unavailable", "The external local model root is not configured as an absolute path");
  }
  try {
    const requested = resolve(configured);
    const canonical = await realpath(requested);
    const item = await lstat(requested);
    if (!item.isDirectory() || item.isSymbolicLink()) {
      fail("model_root_scope_failure", "The configured local model root is not a direct directory");
    }
    if (normalizedPath(requested) !== normalizedPath(canonical)) {
      fail("model_root_scope_failure", "The configured local model root resolves through a link");
    }
    const canonicalRepository = await realpath(repositoryRoot);
    if (isWithin(canonicalRepository, canonical)) {
      fail("model_root_scope_failure", "The configured local model root must remain outside the repository");
    }
    return canonical;
  } catch (error) {
    if (error instanceof LocalDescriptionEmbeddingError) throw error;
    fail("model_root_unavailable", "The configured external local model root is unavailable");
  }
}

async function listDirectRegularFiles(root: string): Promise<{
  files: string[];
  directories: string[];
}> {
  const files: string[] = [];
  const directories: string[] = [];
  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const stat = await lstat(entryPath);
      if (stat.isSymbolicLink()) {
        fail("model_artifact_integrity_failure", "The local model contains a symbolic link");
      }
      if (stat.isDirectory()) {
        directories.push(relativePath);
        await visit(entryPath, relativePath);
      } else if (stat.isFile()) {
        files.push(relativePath);
      } else {
        fail("model_artifact_integrity_failure", "The local model contains a non-regular object");
      }
    }
  }
  await visit(root, "");
  return { files: files.sort(), directories: directories.sort() };
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function artifactSetSha256(files: readonly { path: string; bytes: number; sha256: string }[]): string {
  const records = [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.path}\t${file.bytes}\t${file.sha256}`)
    .join("\n") + "\n";
  return createHash("sha256").update(records, "utf8").digest("hex");
}

async function verifyApprovedLocalModelFilesUnchecked(
  root: string,
  manifest: ApprovedLocalModelManifest
): Promise<void> {
  const inventory = await listDirectRegularFiles(root);
  const expectedFiles = [...APPROVED_FILE_PATHS, LOCAL_ACQUISITION_MANIFEST].sort();
  if (inventory.files.join("\n") !== expectedFiles.join("\n")) {
    fail("model_artifact_integrity_failure", "The local model file inventory is incomplete or unexpected");
  }
  if (inventory.directories.join("\n") !== [...APPROVED_DIRECTORY_PATHS].sort().join("\n")) {
    fail("model_artifact_integrity_failure", "The local model directory inventory is unexpected");
  }

  const verifiedFiles: Array<{ path: string; bytes: number; sha256: string }> = [];
  for (const expected of manifest.files) {
    const path = join(root, ...expected.path.split("/"));
    const stat = await lstat(path);
    const sha256 = await sha256File(path);
    if (!stat.isFile() || stat.size !== expected.bytes || sha256 !== expected.sha256) {
      fail("model_artifact_integrity_failure", "A local model artifact failed size or checksum verification");
    }
    verifiedFiles.push({ path: expected.path, bytes: stat.size, sha256 });
    if (expected.path.endsWith(".json")) {
      try {
        JSON.parse(await readFile(path, "utf8"));
      } catch {
        fail("model_artifact_integrity_failure", "A local model JSON artifact is invalid");
      }
    }
  }
  if (artifactSetSha256(verifiedFiles) !== manifest.model.artifactSetSha256) {
    fail("model_artifact_integrity_failure", "The local model aggregate checksum failed verification");
  }

  try {
    const local = localAcquisitionManifestSchema.parse(
      JSON.parse(await readFile(join(root, LOCAL_ACQUISITION_MANIFEST), "utf8"))
    );
    if (local.artifact_set_sha256 !== manifest.model.artifactSetSha256) {
      fail("model_artifact_integrity_failure", "The local acquisition manifest aggregate is inconsistent");
    }
    const localFiles = [...local.files].sort((left, right) => left.path.localeCompare(right.path));
    const publicFiles = [...manifest.files].sort((left, right) => left.path.localeCompare(right.path));
    for (let index = 0; index < publicFiles.length; index += 1) {
      const localFile = localFiles[index]!;
      const publicFile = publicFiles[index]!;
      if (
        localFile.path !== publicFile.path
        || localFile.source_url !== publicFile.sourceUrl
        || localFile.bytes !== publicFile.bytes
        || localFile.sha256 !== publicFile.sha256
        || localFile.redirect_hosts.join("\n") !== publicFile.redirectHosts.join("\n")
      ) {
        fail("model_artifact_integrity_failure", "The local and committed acquisition manifests differ");
      }
    }
  } catch (error) {
    if (error instanceof LocalDescriptionEmbeddingError) throw error;
    fail("model_artifact_integrity_failure", "The local acquisition manifest is unavailable or invalid");
  }

  const modelConfig = JSON.parse(await readFile(join(root, "config.json"), "utf8")) as Record<string, unknown>;
  const tokenizerConfig = JSON.parse(
    await readFile(join(root, "tokenizer_config.json"), "utf8")
  ) as Record<string, unknown>;
  const poolingConfig = JSON.parse(
    await readFile(join(root, "1_Pooling", "config.json"), "utf8")
  ) as Record<string, unknown>;
  if (
    modelConfig.model_type !== "bert"
    || modelConfig.hidden_size !== manifest.pipeline.dimensions
    || modelConfig.max_position_embeddings !== manifest.pipeline.maximumInputTokens
    || modelConfig.torch_dtype !== "float32"
    || tokenizerConfig.model_max_length !== manifest.pipeline.maximumInputTokens
    || poolingConfig.pooling_mode_cls_token !== true
  ) {
    fail("model_artifact_integrity_failure", "The local model configuration does not match approved policy");
  }
}

export async function verifyApprovedLocalModelFiles(
  root: string,
  manifest: ApprovedLocalModelManifest
): Promise<void> {
  try {
    await verifyApprovedLocalModelFilesUnchecked(root, manifest);
  } catch (error) {
    if (error instanceof LocalDescriptionEmbeddingError) throw error;
    fail("model_artifact_integrity_failure", "The approved local model could not be verified");
  }
}

export async function verifyApprovedRuntimePackage(
  manifest: ApprovedLocalModelManifest,
  packageRoot = process.cwd()
): Promise<void> {
  try {
    const applicationPackage = JSON.parse(
      await readFile(join(packageRoot, "package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };
    const lock = JSON.parse(await readFile(join(packageRoot, "package-lock.json"), "utf8")) as {
      packages?: Record<string, { version?: string; resolved?: string; integrity?: string }>;
    };
    const locked = lock.packages?.["node_modules/@huggingface/transformers"];
    const runtimeEntry = fileURLToPath(import.meta.resolve("@huggingface/transformers"));
    const runtimePackage = JSON.parse(
      await readFile(resolve(dirname(runtimeEntry), "../package.json"), "utf8")
    ) as { name?: string; version?: string; license?: string };
    if (
      applicationPackage.dependencies?.[manifest.runtime.identifier] !== manifest.runtime.version
      || locked?.version !== manifest.runtime.version
      || locked.resolved !== manifest.runtime.registryTarball
      || locked.integrity !== manifest.runtime.packageIntegrity
      || runtimePackage.name !== manifest.runtime.identifier
      || runtimePackage.version !== manifest.runtime.version
      || runtimePackage.license !== manifest.runtime.license
    ) {
      fail("runtime_integrity_failure", "The installed local embedding runtime does not match the lock evidence");
    }
  } catch (error) {
    if (error instanceof LocalDescriptionEmbeddingError) throw error;
    fail("runtime_integrity_failure", "The local embedding runtime evidence is unavailable or invalid");
  }
}

export function approvedDescriptionSemanticPipeline(
  manifest: ApprovedLocalModelManifest
): DescriptionSemanticPipeline {
  const tokenizer = manifest.files.find((file) => file.path === "tokenizer.json")!;
  const onnx = manifest.files.find((file) => file.path === "onnx/model.onnx")!;
  return descriptionSemanticPipelineSchema.parse({
    pipelineVersion: "description-only-semantic-v1",
    inputField: "approved_public_description",
    inputMode: "symmetric_document",
    queryPrefix: null,
    documentPrefix: null,
    textNormalisation: "exact_utf8",
    modelIdentifier: manifest.model.identifier,
    modelRevision: manifest.model.revision,
    modelSha256: onnx.sha256,
    tokenizerIdentifier: `${manifest.model.identifier}@${manifest.model.revision}:tokenizer.json`,
    tokenizerSha256: tokenizer.sha256,
    runtimeIdentifier: manifest.runtime.identifier,
    runtimeVersion: manifest.runtime.version,
    runtimePackageIntegrity: manifest.runtime.packageIntegrity,
    pooling: manifest.pipeline.pooling,
    normalisation: manifest.pipeline.normalisation,
    truncationMaxTokens: manifest.pipeline.maximumInputTokens,
    dimensions: manifest.pipeline.dimensions
  });
}

/** Same verified model bytes; distinct fingerprint for bounded accepted input. */
export function acceptedDescriptionSemanticPipeline(manifest: ApprovedLocalModelManifest): DescriptionSemanticPipeline {
  return descriptionSemanticPipelineSchema.parse({ ...approvedDescriptionSemanticPipeline(manifest),
    pipelineVersion: "accepted-description-semantic-v2", inputField: "accepted_description" });
}

export function assertApprovedDescriptionSemanticPipeline(
  received: Readonly<DescriptionSemanticPipeline>,
  approved: Readonly<DescriptionSemanticPipeline>
): void {
  const parsed = descriptionSemanticPipelineSchema.parse(received);
  if (
    descriptionSemanticPipelineFingerprint(parsed)
    !== descriptionSemanticPipelineFingerprint(approved)
  ) {
    fail("pipeline_fingerprint_mismatch", "The requested embedding pipeline is not the approved local pipeline");
  }
}

interface FeatureTensor {
  type: string;
  dims: number[];
  data: Float32Array;
}

export interface LocalFeatureExtractor {
  run(texts: readonly string[]): Promise<FeatureTensor>;
  tokenCount?(text: string): number;
  dispose(): Promise<void>;
}

export type LocalFeatureExtractorLoader = (
  root: string,
  manifest: ApprovedLocalModelManifest
) => Promise<LocalFeatureExtractor>;

export function assertCompleteAcceptedDescriptionInput(texts:readonly string[],maxTokens:number,tokenCount:((text:string)=>number)|undefined):void {
  if(!tokenCount)fail("runtime_output_failure","Complete-description token verification is unavailable");
  for(const text of texts){
    const count=tokenCount(text);
    if(!Number.isInteger(count)||count<=0)fail("runtime_output_failure","The tokenizer returned an invalid token count");
    if(count>maxTokens)fail("input_too_long","Complete description exceeds the verified model token limit; no truncated embedding was generated");
  }
}

export const loadTransformersFeatureExtractor: LocalFeatureExtractorLoader = async (root, manifest) => {
  try {
    const runtime = await import("@huggingface/transformers");
    runtime.env.allowRemoteModels = false;
    runtime.env.allowLocalModels = true;
    runtime.env.localModelPath = root;
    runtime.env.useBrowserCache = false;
    runtime.env.useFSCache = false;
    const extractor = await runtime.pipeline("feature-extraction", root, {
      local_files_only: true,
      revision: manifest.model.revision,
      device: "cpu",
      dtype: "fp32",
      subfolder: "onnx",
      model_file_name: "model"
    });
    if (runtime.env.allowRemoteModels !== false || runtime.env.localModelPath !== root) {
      await extractor.dispose();
      fail("runtime_load_failure", "The local embedding runtime did not retain remote-disable controls");
    }
    return {
      tokenCount(text) { return extractor.tokenizer.encode(text, { add_special_tokens: true }).length; },
      async run(texts) {
        const output = await extractor([...texts], {
          pooling: "cls",
          normalize: true,
          quantize: false
        });
        return {
          type: output.type,
          dims: [...output.dims],
          data: output.data as Float32Array
        };
      },
      async dispose() {
        await extractor.dispose();
      }
    };
  } catch (error) {
    if (error instanceof LocalDescriptionEmbeddingError) throw error;
    fail("runtime_load_failure", "The approved local embedding runtime failed to load");
  }
};

export class ApprovedLocalDescriptionEmbeddingModel implements DescriptionEmbeddingModel {
  private constructor(
    private readonly extractor: LocalFeatureExtractor,
    private readonly approvedPipeline: DescriptionSemanticPipeline,
    private readonly batchSize: number
  ) {}

  static async create(input: {
    environment?: NodeJS.ProcessEnv;
    repositoryRoot?: string;
    extractorLoader?: LocalFeatureExtractorLoader;
  } = {}): Promise<ApprovedLocalDescriptionEmbeddingModel> {
    const manifest = await loadApprovedLocalModelManifest();
    const repositoryRoot = input.repositoryRoot ?? process.cwd();
    const root = await resolveConfiguredModelRoot(input.environment, repositoryRoot);
    await verifyApprovedLocalModelFiles(root, manifest);
    await verifyApprovedRuntimePackage(manifest, repositoryRoot);
    const approvedPipeline = approvedDescriptionSemanticPipeline(manifest);
    const extractor = await (input.extractorLoader ?? loadTransformersFeatureExtractor)(root, manifest);
    return new ApprovedLocalDescriptionEmbeddingModel(
      extractor,
      approvedPipeline,
      manifest.pipeline.batchSize
    );
  }

  get pipeline(): Readonly<DescriptionSemanticPipeline> {
    return this.approvedPipeline;
  }

  get pipelineFingerprint(): string {
    return descriptionSemanticPipelineFingerprint(this.approvedPipeline);
  }

  get acceptedPipeline(): Readonly<DescriptionSemanticPipeline> {
    return { ...this.approvedPipeline, pipelineVersion: "accepted-description-semantic-v2", inputField: "accepted_description" };
  }

  async embedApprovedDescriptions(
    approvedDescriptions: readonly string[],
    pipeline: Readonly<DescriptionSemanticPipeline>
  ): Promise<readonly Float32Array[]> {
    const accepted = pipeline.pipelineVersion === "accepted-description-semantic-v2";
    assertApprovedDescriptionSemanticPipeline(pipeline, accepted ? this.acceptedPipeline : this.approvedPipeline);
    const output: Float32Array[] = [];
    for (let start = 0; start < approvedDescriptions.length; start += this.batchSize) {
      const batch = approvedDescriptions.slice(start, start + this.batchSize);
      if (batch.some((description) => typeof description !== "string" || description.length === 0)) {
        fail("runtime_output_failure", "The local embedding input is not an approved description string");
      }
      if (accepted) {
        assertCompleteAcceptedDescriptionInput(batch,pipeline.truncationMaxTokens,this.extractor.tokenCount?.bind(this.extractor));
      }
      const tensor = await this.extractor.run(batch);
      if (
        tensor.type !== "float32"
        || !(tensor.data instanceof Float32Array)
        || tensor.dims.length !== 2
        || tensor.dims[0] !== batch.length
        || tensor.dims[1] !== this.approvedPipeline.dimensions
        || tensor.data.length !== batch.length * this.approvedPipeline.dimensions
      ) {
        fail("runtime_output_failure", "The local embedding runtime returned an invalid tensor shape or type");
      }
      for (let row = 0; row < batch.length; row += 1) {
        const vector = tensor.data.slice(
          row * this.approvedPipeline.dimensions,
          (row + 1) * this.approvedPipeline.dimensions
        );
        let squaredNorm = 0;
        for (const value of vector) {
          if (!Number.isFinite(value)) {
            fail("runtime_output_failure", "The local embedding runtime returned a non-finite value");
          }
          squaredNorm += value * value;
        }
        if (Math.abs(Math.sqrt(squaredNorm) - 1) > NORMALISATION_TOLERANCE) {
          fail("runtime_output_failure", "The local embedding runtime returned a non-normalised vector");
        }
        output.push(vector);
      }
    }
    return output;
  }

  async dispose(): Promise<void> {
    await this.extractor.dispose();
  }
}
