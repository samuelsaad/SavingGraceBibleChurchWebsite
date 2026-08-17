# Description-only Related Themes Foundation

**Status:** Offline model-independent mechanics only; no model acquired, no real description embedded, no quality approval, no public feature

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
- Stored relationships contain identities, both description hashes, build/pipeline provenance, rank, raw cosine score and generation time. Build provenance includes model/tokenizer identifiers and hashes, pooling, normalisation, truncation, dimensions, corpus version and quality-policy identity.

Every build starts `pending`. Retrieval requires `quality_status = 'approved'`, and no application method in this foundation grants that status. No semantic data is wired into the public API or renderer, so **Related themes** cannot appear publicly. Synthetic PostgreSQL tests mark only a disposable fixture build as approved to exercise the read gate.

## Local model inspection result

No approved embedding model, tokenizer, weight file, model runtime or project-specific private model directory was found. No download, package installation, model execution, API call or provider contact occurred. Deterministic fixed synthetic vectors test mechanics only and are not evidence of language understanding or recommendation quality.

## Future model-acquisition request

**Request ID:** `description-embedding-model-acquisition-v1`
**Candidate model:** `sentence-transformers/all-MiniLM-L6-v2`
**Intended use:** symmetric English sentence/document embeddings for approved public descriptions only
**Candidate license:** Apache-2.0, requiring primary-source verification before approval
**Source domain:** `huggingface.co`, requiring separate explicit network/provider authorisation
**Local destination:** ACL-restricted `C:\Users\samue\AppData\Local\SavingGraceBibleChurch\PrivateModels\description-embedding-v1`, outside Git and outside content/inventory storage
**Text transmission:** none; approved descriptions must remain local
**Operational cost:** no provider/billable inference; local CPU time only
**Expected rebuild scale:** one offline pass over at most 453 descriptions plus exact pairwise comparison; timing must be measured on the approved runtime rather than asserted from synthetic vectors

This request is intentionally not executable yet. Offline evidence does not establish an approved immutable upstream revision, exact runtime file set, byte sizes or trusted SHA-256 values. A later approval must provide and verify, before any download:

1. One immutable 40-hex upstream revision; floating branches/tags are forbidden.
2. The minimal non-quantised weight file plus configuration, tokenizer vocabulary/model, tokenizer configuration, special-token mapping, pooling/module configuration and license/model-card files needed by the approved runtime.
3. Exact expected byte size and SHA-256 for every file, derived from the immutable primary-source objects or an independently authenticated release manifest.
4. A deterministic aggregate manifest hash over sorted `relative-path<TAB>bytes<TAB>sha256` records.
5. Runtime dependency names, immutable versions, lockfile integrity, license review and an offline vulnerability scan. No Python/ONNX/Transformers runtime is selected by this foundation.
6. Download limits, retry count, cost ceiling, retention, rollback and deletion rules.
7. Post-download verification in a temporary ACL-restricted directory, followed by atomic promotion only after every file and aggregate hash passes; otherwise remove the rejected task-owned files.

No model may be acquired until the unresolved immutable revision, exact files, sizes, hashes and runtime dependencies receive explicit approval. This prevents invented artifact evidence from becoming a supply-chain control.

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
