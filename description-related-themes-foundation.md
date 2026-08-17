# Description-only Related Themes Foundation

**Status:** Verified external local model and locked adapter; synthetic inference only, no real description embedded, no quality approval, no public feature

## Boundary

The future **Related themes** feature is separate from keyword/structured search and from the existing metadata-based related-sermon results. Its sole embedding input is the exact approved public `sermons.summary` value.

Admitted input:

- Approved public sermon description text only.

Excluded from embedding, scoring and ordering:

- Title, Scripture references, canonical Bible book, speaker, series, topics/tags, dates and every other metadata field.
- Sermon body, transcript, questions, answers, search keywords, synonyms and theological glossary expansions.
- Public query text. Keyword requests such as `Romans 8` continue through the existing PostgreSQL keyword/structured-reference path.

Metadata may be fetched and displayed only after semantic neighbour identities have been selected. It cannot alter semantic rank or score. Existing metadata-based recommendations remain independently scored by shared series, overlapping Scripture, approved canonical Bible book and speaker and are not renamed or blended with this mechanism.

## Eligibility and stale-data handling

The database view `sermon_description_semantic_eligibility` is the shared generation, persistence and retrieval rule. It returns only sermon identity, exact approved description and description SHA-256 when the row is published, not deleted, explicitly description-approved and nonblank. Draft, pending, scheduled, unpublished, archived, deleted, unapproved and blank-description rows are absent.

The precomputation repository re-reads and compares the complete eligible identity/description/hash set inside a serializable transaction before replacing any stored build. A changed corpus aborts without partial publication. An empty eligible set still replaces prior build state; it never returns early and leaves stale relationships.

An update trigger removes every inbound and outbound relationship involving a sermon when its status, deletion state, description approval or description text changes. Foreign-key cascades handle deletion. Retrieval again joins both source and neighbour through the eligibility view and verifies both current description hashes. There is no cache or fallback path.

## Scoring and persistence

- A model adapter receives an ordered array of approved description strings and the model pipeline contract—no sermon object or metadata.
- The contract requires symmetric document-to-document use with null query/document prefixes.
- Model output is converted to `Float32Array`, validated for finite fixed dimensions and L2-normalised using float32-rounded operations.
- Cosine comparison is exact brute-force float32 dot product for the small corpus; no pgvector, managed vector store, ANN index, quantisation, binary vector format or client vector file is used.
- The current sermon is excluded, neighbours are unique, and equal scores use stable sermon-ID ordering.
- A build-specific quality policy supplies a later evidence-backed minimum score and maximum result count. The foundation defines no universal threshold. Candidates below the supplied policy threshold are omitted rather than used to fill a quota.
- Vectors remain in process memory only for scoring and are not persisted.
- Stored relationships contain identities, both description hashes, build/pipeline provenance, rank, raw cosine score and generation time. Build provenance includes immutable model revision, model/tokenizer hashes, exact runtime version and registry integrity, pooling, normalisation, truncation, dimensions, corpus version and quality-policy identity.

Every build starts `pending`. Retrieval requires `quality_status = 'approved'`, and no application method in this foundation grants that status. No semantic data is wired into the public API or renderer, so **Related themes** cannot appear publicly. Synthetic PostgreSQL tests mark only a disposable fixture build as approved to exercise the read gate.

## Approved local model and runtime

The acquired model is exactly `BAAI/bge-small-en-v1.5` at immutable revision `5e62ea33e012fda8c02802b906664c915ebd1bb1`, licensed MIT, using the unquantised `onnx/model.onnx`. Its approved SHA-256 is `828e1496d7fabb79cfa4dcd84fa38625c0d3d21da474a00f08db0f559940cf35`. The complete public filenames, immutable source URLs, redirect hosts, byte sizes and hashes are recorded in `model-manifests/BAAI-bge-small-en-v1.5-5e62ea33e012fda8c02802b906664c915ebd1bb1.json`.

Model files remain outside the repository. `DESCRIPTION_EMBEDDING_MODEL_ROOT` must point to the exact external revision directory; no machine-specific path or `.env` file is committed. The adapter rejects a relative, unavailable, linked, repository-contained, incomplete, altered or unexpected model directory before runtime loading.

The runtime is exactly `@huggingface/transformers@4.2.0` with npm SHA-512 integrity locked in `package-lock.json`. Loading sets `env.allowRemoteModels = false`, enables only local files, points `env.localModelPath` to the configured external root, disables browser/filesystem caches, passes `local_files_only: true`, selects CPU plus `fp32`, and requests only `onnx/model.onnx`. Inference uses feature extraction, CLS pooling, L2 normalisation, 384 dimensions, the model-configured 512-token maximum and deterministic batches of eight. No query or document prefix is added.

The npm install used lifecycle scripts disabled. Required Windows x64 ONNX CPU binaries were already present in the integrity-locked package, and the dormant ONNX postinstall reported no Windows x64 download requirement. The runtime is server-only, has no public endpoint, is not imported by the public renderer, and does not ship model or vector data to a browser. See `local-embedding-model-acquisition.md` for verification and rollback controls.

The synthetic acceptance test is a compatibility smoke test only. No real description was supplied and no real relationship was generated.

## Future human quality gate

Do not expose **Related themes** until a separate authorised evaluation uses a meaningfully larger set of genuinely approved public descriptions. The evaluation must:

1. Sample representative periods, speakers, series and theological subjects without feeding those metadata fields to the model or score.
2. Present blinded description-only recommendations to human reviewers and separately record Scripture, series and speaker overlap only after the usefulness judgment.
3. Judge the first several neighbours per anchor for thematic usefulness, harmful or misleading false positives and missing obvious neighbours.
4. Review the worst false positives individually rather than relying on an average metric.
5. Derive any score threshold and result count from observed corpus evidence; do not inherit the synthetic mechanics threshold.
6. Compare against no semantic feature and preserve separate labels for metadata recommendations and any later **More on this passage** feature.
7. Permit rejection of the semantic feature when it adds insufficient value or creates misleading associations.

Passing keyword, Scripture, database, or synthetic-vector tests does not satisfy this quality gate.
