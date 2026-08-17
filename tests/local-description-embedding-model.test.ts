import { describe, expect, it } from "vitest";
import { descriptionSemanticPipelineFingerprint } from "../src/semantic/description-related-themes";
import {
  LocalDescriptionEmbeddingError,
  approvedDescriptionSemanticPipeline,
  assertApprovedDescriptionSemanticPipeline,
  loadApprovedLocalModelManifest,
  resolveConfiguredModelRoot,
  verifyApprovedRuntimePackage
} from "../src/semantic/local-description-embedding-model";

describe("approved local description embedding configuration", () => {
  it("locks the exact model, revision, runtime, files and description-only pipeline", async () => {
    const manifest = await loadApprovedLocalModelManifest();
    const pipeline = approvedDescriptionSemanticPipeline(manifest);

    expect(manifest.model).toMatchObject({
      identifier: "BAAI/bge-small-en-v1.5",
      revision: "5e62ea33e012fda8c02802b906664c915ebd1bb1",
      license: "MIT",
      format: "unquantised ONNX"
    });
    expect(manifest.runtime).toMatchObject({
      identifier: "@huggingface/transformers",
      version: "4.2.0",
      license: "Apache-2.0"
    });
    expect(manifest.files).toHaveLength(11);
    expect(new Set(manifest.files.map((file) => file.path)).size).toBe(11);
    expect(manifest.files.every((file) => file.sourceUrl.includes(manifest.model.revision))).toBe(true);
    expect(manifest.files.some((file) => /(?:quantized|safetensors|pytorch_model\.bin)/i.test(file.path)))
      .toBe(false);
    expect(JSON.stringify(manifest)).not.toMatch(/[A-Z]:\\Users\\/i);

    expect(pipeline).toMatchObject({
      inputField: "approved_public_description",
      inputMode: "symmetric_document",
      queryPrefix: null,
      documentPrefix: null,
      modelIdentifier: manifest.model.identifier,
      modelRevision: manifest.model.revision,
      runtimeIdentifier: manifest.runtime.identifier,
      runtimeVersion: manifest.runtime.version,
      runtimePackageIntegrity: manifest.runtime.packageIntegrity,
      pooling: "cls",
      normalisation: "l2_float32",
      truncationMaxTokens: 512,
      dimensions: 384
    });
    expect(descriptionSemanticPipelineFingerprint(pipeline)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies the exact installed runtime lock evidence offline", async () => {
    const manifest = await loadApprovedLocalModelManifest();
    await expect(verifyApprovedRuntimePackage(manifest)).resolves.toBeUndefined();
  });

  it("fails closed on absent, relative or repository-contained model roots", async () => {
    await expect(resolveConfiguredModelRoot({})).rejects.toMatchObject({
      code: "model_root_unavailable"
    });
    await expect(resolveConfiguredModelRoot({
      DESCRIPTION_EMBEDDING_MODEL_ROOT: "relative-model"
    })).rejects.toMatchObject({ code: "model_root_unavailable" });
    await expect(resolveConfiguredModelRoot({
      DESCRIPTION_EMBEDDING_MODEL_ROOT: process.cwd()
    })).rejects.toMatchObject({ code: "model_root_scope_failure" });
  });

  it("rejects any runtime, pooling or fingerprint drift before inference", async () => {
    const manifest = await loadApprovedLocalModelManifest();
    const pipeline = approvedDescriptionSemanticPipeline(manifest);
    expect(() => assertApprovedDescriptionSemanticPipeline({
      ...pipeline,
      runtimeVersion: "4.2.1"
    }, pipeline)).toThrow(LocalDescriptionEmbeddingError);
    expect(() => assertApprovedDescriptionSemanticPipeline({
      ...pipeline,
      pooling: "mean"
    }, pipeline)).toThrow(LocalDescriptionEmbeddingError);
  });
});
