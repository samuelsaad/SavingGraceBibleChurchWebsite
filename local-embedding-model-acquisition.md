# Local embedding model acquisition and rollback

## Approved identity

- Model: `BAAI/bge-small-en-v1.5`
- Immutable revision: `5e62ea33e012fda8c02802b906664c915ebd1bb1`
- Model license: MIT
- Format: unquantised ONNX
- Dimensions: 384
- Pooling: CLS
- Normalisation: L2 float32
- Maximum input: 512 tokens, derived from both approved model and tokenizer configuration
- Runtime: `@huggingface/transformers@4.2.0`, Apache-2.0

The sanitized acquisition evidence is `model-manifests/BAAI-bge-small-en-v1.5-5e62ea33e012fda8c02802b906664c915ebd1bb1.json`. It is the only committed model manifest. Model bytes and the local acquisition manifest remain outside the repository.

## Local configuration

Set `DESCRIPTION_EMBEDDING_MODEL_ROOT` in the local process to the exact external directory for the approved revision. The value must be an absolute direct directory outside the repository. Do not commit an `.env` file or machine-specific path.

Run the synthetic acceptance check only with clearly fictional text:

```powershell
$env:DESCRIPTION_EMBEDDING_MODEL_ROOT = '<external-approved-revision-directory>'
npm run test:model-local
```

The adapter verifies the complete file inventory, individual byte sizes and SHA-256 values, aggregate manifest hash, JSON syntax, model/tokenizer dimensions and truncation, CLS configuration, local acquisition manifest, installed package version, registry tarball and npm integrity before loading ONNX.

## Network and runtime controls

- `env.allowRemoteModels = false`
- `env.allowLocalModels = true`
- `env.localModelPath` is the configured external root
- `local_files_only: true`
- browser and filesystem model caches disabled
- CPU and `fp32` selected explicitly
- only `onnx/model.onnx` requested
- no hosted inference, query embedding, remote fallback, CDN runtime asset or browser model path
- no public API, renderer integration or client vector data

The dependency was installed with lifecycle scripts disabled. Registry metadata showed that the integrity-locked Windows x64 ONNX package already contains the required CPU runtime and declares no platform download requirement. Its dormant postinstall was inspected but not executed. Reinstall with lifecycle scripts enabled is not approved by this document.

## Failure and rollback

Any missing file, unexpected file, link, invalid JSON, size/hash mismatch, model-configuration mismatch, runtime lock mismatch, pipeline fingerprint mismatch, non-float32 shape, non-finite value or non-normalised output fails closed. The public **Related themes** feature remains absent regardless of adapter availability.

Rollback of repository integration requires a separately reviewed commit that removes the adapter, manifest, migration `0012`, tests and exact runtime dependency without rewriting history. Deleting the external model directory is a separate destructive local action and must target only the exact approved revision directory after explicit authorization. Never use a wildcard or broad model-root cleanup.

## Remaining gate

Synthetic paraphrase behavior proves only that the local runtime is mechanically usable. Real descriptions, relationship generation, threshold selection, human usefulness evaluation, public rendering, deployment and production operation remain separately gated.
