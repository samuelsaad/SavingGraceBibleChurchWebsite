# D-178 — description-only Related themes delivery

## Authority and recovered foundation

Samuel's 7 October 2026 instruction authorizes the existing accepted collection,
not a new processing batch or sermon publication. This decision extends D-127/
D-128 to environment-scoped accepted descriptions. Preserve v1 public eligibility
and its pending quality gate. The original independent Claude critique has not
been recovered from the tracked repository; the current instruction and recorded
foundation human-evaluation protocol are authoritative, not invented critique.

Reuse locked `BAAI/bge-small-en-v1.5`, revision
`5e62ea33e012fda8c02802b906664c915ebd1bb1`, MIT, unquantized ONNX, 384-dimensional
CLS/L2 float32 through Transformers.js 4.2.0. Hash-check its external artifact
inventory before loading. No provider inference or audio/video access. Exact
accepted description bytes are the sole embedding input. Refuse unsupported
language, invalid vectors and overlength input rather than truncating silently.
Use exact cosine, self/source deduplication and stable identity tie-breaking.

## Scope and persistence

Create the isolated `codex/sermon-related-themes` branch from current integrated
commit `4a453d4356a5435195d803184b95c7a7ca51777a`, preserving and carrying the
already-tested local V5/mobile refinement without mutating its original worktree.
No existing worktree is reset, switched, stashed or cleaned.

Freeze real accepted description/source hashes separately per environment in
ignored storage. Derive membership using the existing local or staging selector,
never by historical counts. Match staging records by preserved source identity.
Private vector checkpoints bind model/pipeline/input hashes; compatible reuse
must validate dimensions, finite values and norm. New immutable builds and their
active pointers commit atomically after current-corpus revalidation. Identical
reruns must not churn data. Serve-time eligibility/hash checks exclude revoked or
changed anchors and candidates regardless of stale stored vectors.

Initial read-only capture: local 430 stored, 407 eligible (406 English, one
Arabic); corpus SHA-256
`ca6abf015336e98ce4a4f74d4d3b36cb57562ffaf74f4a391aa3708de4986248`.
Verified staging has 398 eligible (397 English, one Arabic); its private
identity/hash-only capture SHA-256 is
`b93d4707a7f02c8336902f52545a8034b651999d17b2b77fc9215841f4e103c4`.
These are frozen evidence, not counts to force. Every write and serving operation
must revalidate its relevant membership and current description hashes.

Only local PostgreSQL16 `127.0.0.1:5432/savinggrace_sermons_test` and the verified
existing staging databases are in scope. Existing content/acceptance/publication
rows are read-only for this task. Additive semantic tables do not grant acceptance.
No whole-database copy. Before staging writes retain scoped index recovery and
the previous compatible image/configuration; rollback disables the feature or
reactivates the previous build without erasing sermon or review history.

## Evaluation and release

Freeze deterministic representative calibration and holdout anchors, complete
description hashes and pipeline. Compare exact semantic ranks1–5 with the
existing metadata baseline through reviewer-specific randomized blinded unions.
Keep method labels and scores in a private key, not the review page. Collect
independent human 0–3 usefulness, risk, redundancy, missing relationships and
preference evidence from at least two distinct reviewers. Preserve disagreements,
agreement reporting and adjudication. AI analysis is never human evidence.

Derive threshold and maximum count only from complete calibration evidence;
freeze that policy before opening holdout. Zero recommendations is valid. A
positive locked holdout and release evidence are prerequisites for ordinary
visitor output. Until then enable only the local/protected evaluation mechanism,
with honest provisional state and a usable export/import/report workflow.
No preview/evaluation API may become available on public staging by accident.

## Delivery and verification

Integrate a distinct Related themes section with established sermon presentation;
leave metadata Related sermons, keyword/Scripture search, media consent and SEO
unchanged. No vectors, model loading or query embedding in the browser. Preserve
mobile/keyboard/progressive behavior. Enable evaluation separately from normal
release; missing human input is a final handoff requirement, not permission to
invent calibration or stop implementation early.

Run focused and standard tests, guarded disposable PostgreSQL tests (including
migration apply/rollback/reapply/idempotency), type/Astro, build, anonymous browser
checks, real metadata-only preview checks and outgoing security/content scans.
Retain exact corpus/model/build evidence privately; safe aggregates only in Git.
Push the named branch normally to the existing GitHub repository after scanning.
Deploy scoped code/indexes only to existing staging runtimes, verify served commit
and access boundaries, and retain recovery instructions. No production changes.
