import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  ApprovedLocalDescriptionEmbeddingModel,
  LocalDescriptionEmbeddingError,
  approvedDescriptionSemanticPipeline,
  assertApprovedDescriptionSemanticPipeline,
  loadApprovedLocalModelManifest,
  resolveConfiguredModelRoot,
  verifyApprovedLocalModelFiles,
  verifyApprovedRuntimePackage,
  type ApprovedLocalModelManifest
} from "../src/semantic/local-description-embedding-model";

const syntheticDescriptions = [
  "A fictional community learns to remain hopeful while caring patiently for neighbours during hardship.",
  "In an invented story, neighbours show patient care and keep their hope through difficult circumstances.",
  "A synthetic engineering manual explains how to calibrate a turbine pressure sensor in a laboratory."
] as const;

function cosine(left: Float32Array, right: Float32Array): number {
  assert.equal(left.length, right.length);
  let value = 0;
  for (let index = 0; index < left.length; index += 1) value += left[index]! * right[index]!;
  return value;
}

function norm(vector: Float32Array): number {
  return Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
}

async function expectSafeFailure(
  action: () => Promise<unknown> | unknown,
  code: LocalDescriptionEmbeddingError["code"]
): Promise<void> {
  try {
    await action();
    assert.fail(`Expected safe failure: ${code}`);
  } catch (error) {
    assert.ok(error instanceof LocalDescriptionEmbeddingError);
    assert.equal(error.code, code);
  }
}

async function createHashMismatchFixture(
  approvedRoot: string,
  manifest: ApprovedLocalModelManifest,
  fixtureRoot: string
): Promise<void> {
  for (const file of manifest.files) {
    const destination = join(fixtureRoot, ...file.path.split("/"));
    await mkdir(dirname(destination), { recursive: true });
    if (file.path === "onnx/model.onnx") {
      await writeFile(destination, "synthetic-tamper-fixture", "utf8");
    } else {
      await cp(join(approvedRoot, ...file.path.split("/")), destination);
    }
  }
  await cp(
    join(approvedRoot, "acquisition-manifest.local.json"),
    join(fixtureRoot, "acquisition-manifest.local.json")
  );
}

async function main(): Promise<void> {
  const manifest = await loadApprovedLocalModelManifest();
  const approvedRoot = await resolveConfiguredModelRoot();
  const temporaryRoot = await mkdtemp(join(tmpdir(), "sgbc-local-model-acceptance-"));
  const originalFetch = globalThis.fetch;
  let networkAttempts = 0;
  let model: ApprovedLocalDescriptionEmbeddingModel | null = null;
  globalThis.fetch = (async () => {
    networkAttempts += 1;
    throw new Error("NETWORK_DISABLED_DURING_LOCAL_MODEL_ACCEPTANCE");
  }) as typeof fetch;

  try {
    model = await ApprovedLocalDescriptionEmbeddingModel.create();
    const vectors = await model.embedApprovedDescriptions(syntheticDescriptions, model.pipeline);
    const repeated = await model.embedApprovedDescriptions([syntheticDescriptions[0]], model.pipeline);

    assert.equal(vectors.length, 3);
    assert.ok(vectors.every((vector) => vector instanceof Float32Array));
    assert.ok(vectors.every((vector) => vector.length === 384));
    assert.ok(vectors.every((vector) => [...vector].every(Number.isFinite)));
    assert.ok(vectors.every((vector) => Math.abs(norm(vector) - 1) <= 0.00002));
    assert.ok(
      vectors[0]!.every((value, index) => Math.abs(value - repeated[0]![index]!) <= 0.000001)
    );

    const paraphraseScore = cosine(vectors[0]!, vectors[1]!);
    const unrelatedScore = cosine(vectors[0]!, vectors[2]!);
    assert.ok(paraphraseScore > unrelatedScore);
    assert.equal(model.pipeline.queryPrefix, null);
    assert.equal(model.pipeline.documentPrefix, null);
    assert.equal(model.pipeline.pooling, "cls");
    assert.equal(model.pipeline.dimensions, 384);
    assert.equal(model.pipeline.truncationMaxTokens, 512);

    const alteredPipeline = { ...model.pipeline, pooling: "mean" as const };
    await expectSafeFailure(
      () => assertApprovedDescriptionSemanticPipeline(alteredPipeline, model!.pipeline),
      "pipeline_fingerprint_mismatch"
    );

    const mismatchedRuntime = {
      ...manifest,
      runtime: { ...manifest.runtime, version: "4.2.1" }
    } as unknown as ApprovedLocalModelManifest;
    await expectSafeFailure(
      () => verifyApprovedRuntimePackage(mismatchedRuntime),
      "runtime_integrity_failure"
    );

    await expectSafeFailure(
      () => verifyApprovedLocalModelFiles(join(temporaryRoot, "missing"), manifest),
      "model_artifact_integrity_failure"
    );
    const alteredRoot = join(temporaryRoot, "altered");
    await mkdir(alteredRoot);
    await createHashMismatchFixture(approvedRoot, manifest, alteredRoot);
    await expectSafeFailure(
      () => verifyApprovedLocalModelFiles(alteredRoot, manifest),
      "model_artifact_integrity_failure"
    );

    assert.equal(networkAttempts, 0);
    assert.deepEqual(model.pipeline, approvedDescriptionSemanticPipeline(manifest));
    process.stdout.write(`${JSON.stringify({
      modelRevision: manifest.model.revision,
      dimensions: vectors[0]!.length,
      finiteValues: vectors.reduce((count, vector) => count + vector.length, 0),
      normalisedVectors: vectors.length,
      repeatedEmbeddingStable: true,
      paraphraseAboveUnrelated: true,
      pipelineFingerprint: model.pipelineFingerprint,
      remoteModelsAllowed: false,
      networkAttempts,
      safeFailureAssertions: 4,
      realSermonsProcessed: 0
    })}\n`);
  } finally {
    if (model) await model.dispose();
    globalThis.fetch = originalFetch;
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  const code = error instanceof LocalDescriptionEmbeddingError
    ? error.code
    : "synthetic_local_model_acceptance_failure";
  process.stderr.write(`Local model acceptance failed safely: ${code}\n`);
  process.exitCode = 1;
});
