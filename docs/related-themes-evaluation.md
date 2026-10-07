# Related themes: private human evaluation

This tooling implements D-178's evaluation, not content approval or publication.
The existing D-127/D-128 foundation supplies exact float32 cosine similarity and
a verified local embedding model. The recovered tracked protocol is in
`description-related-themes-foundation.md`; its original independent Claude
critique and any human rating files were not found in the inspected tracked or
relevant ignored notes. Do not reconstruct them or invent prior human evidence.

## Frozen experiment

`createRelatedThemesEvaluation` freezes the eligible descriptions and hashes,
source identities, model revision, pipeline fingerprint, deterministic seed,
two pseudonymous reviewer assignments, both candidate methods and anchor split.
All source identities must be unique. No field other than the complete description
is an embedding input. Metadata recommendations enter only the separate baseline.

The highest and lowest thirds of top semantic scores provide repeated-theme and
contrasting-subject sampling proxies. The middle group prioritizes disagreement
with the metadata baseline as difficult-negative cases. Hash-seeded ordering within
strata and round-robin selection create reproducible disjoint calibration/holdout
anchors. These are sampling proxies, not an invented theological taxonomy or a
claim that an AI has substantively verified subject coverage. Inspect coverage
before distributing the frozen experiment; a different corpus/selection requires
a new fingerprint, never an unrecorded replacement. Calibration and holdout also
exclude shared unordered sermon pairs across the entire candidate union: a rated
A-to-B relationship cannot recur as B-to-A. Full candidate lists remain intact;
insufficient independent anchors fail closed. Descriptions can recur in different
pairs, so this is a same-corpus relationship holdout, not an unseen-document test.

Each reviewer receives an independently randomized union of semantic ranks 1–5
and up to five existing metadata recommendations, deduplicated by identity. Packs
contain complete descriptions and opaque tokens only: no title, speaker, passage,
method names, cosine score or operational sermon identifier. Recommendation lists
A/B are independently relabelled for overall preference. The private plan retains
the decoding key; never serve the plan alongside a reviewer pack.

## Review and import

`createBlindedReviewerPack` exports calibration immediately. Holdout export requires
a valid frozen calibration lock. `renderRelatedThemesEvaluationHtml` returns a
responsive standalone form that reads no credentials, uses no network requests,
performs no server mutation and downloads the completed JSON locally. Serve it only
behind the explicit local/protected evaluation boundary, with no-store/noindex and
the existing authentication or SSH-tunnel protection. It is not a public endpoint.

The reviewer rates usefulness 0–3, theological risk with an explanation, redundancy,
missing obvious relationships and overall A/B preference. The reviewer explicitly
attests independent blinded human work. Pseudonymous assignment and checkbox
attestation do not prove a personal identity: an authorized operator must separately
confirm that two actual distinct people received and completed their assigned packs.
Do not fill these forms on their behalf or relabel an AI assessment as human work.
The tooling accepts labelled AI assessments for supplemental reporting only.

`importEvaluationRatings` checks the frozen pack and every anchor/candidate, rejects
missing/duplicate/extra values, and returns unchanged for identical imports. A
conflicting resubmission is not overwritten. Preserve originals and explicitly
version a new experiment if evidence genuinely needs replacement. All packs,
reviewer files, decoding keys, descriptions and adjudications remain private.

## Calibration and release

`analyzeEvaluation` requires both assigned human reviewers; it reports raw usefulness
agreement and quadratic-weighted Cohen kappa (null when undefined), all disagreements,
method preference and missing-relationship reports. Any usefulness, risk or redundancy
disagreement requires a separately recorded human adjudication bound to the exact
reviewer evidence fingerprint. Original ratings remain intact. Missing-relationship
findings are retained, never silently cleared.

`calibrateAndLockEvaluationPolicy` accepts calibration evidence only. It enumerates
observed calibration cosine values and result limits 1–5. Every selected candidate
must have usefulness at least 2, no theological-risk finding and no redundant finding
after required adjudication. Among surviving choices it maximizes total usefulness,
then useful coverage, then prefers the smaller limit and higher threshold. If no
policy survives, it refuses to invent a cutoff or fill recommendation slots. These
are conservative evaluation criteria, not an empirically proven universal threshold.

The immutable policy lock binds corpus, pipeline, calibration evidence, threshold,
maximum count and time. Holdout cannot be exported before the lock and submitted
holdout evidence cannot predate it. `evaluateLockedHoldout` applies that unchanged
policy; it cannot tune it. Normal release requires complete two-human judgments,
adjudication, at least one selected result, no selected weak/risky/redundant match,
more semantic than metadata preferences, no “neither” preference and no unexplained
missing-relationship report. A failed holdout stays failed; a changed policy needs
a new untouched holdout, not relabelled reused results.

No current human ratings means **awaiting human evaluation** and normal release
disabled. The local/protected evaluation preview remains usable. Synthetic tests
demonstrate mechanics only and cannot satisfy this release gate. Revalidate current
eligibility, description hashes and environment membership separately when serving
any result, even after a positive evaluation.

## Operator commands

From the isolated delivery worktree, `node --import tsx scripts/related-themes-local.ts`
supports `inventory`, guarded `migrate`, guarded `build`, `verify`, `evaluate`, and
destination-scoped `export`. The model directory is supplied through the existing
protected external model-root setting; no model files enter the repository.
The default local evaluation and all reviewer evidence live in ignored storage.

Use `node --import tsx scripts/related-themes-evaluate.ts import <private-rating-file>`
for each actual reviewer's downloaded JSON. Identical imports are unchanged;
conflicting imports are refused and preserved. `analysis` reports missing human
evidence or disagreements. Supply separately authored, validated adjudications
through `RELATED_THEMES_ADJUDICATION_FILE`. `lock` preserves the calibrated policy
once, `holdout-pack` exports both locked reviewer packs, and `report` creates a
private release report. Only a passing report exports release evidence.

To render the locked holdout in the same protected browser interface, configure
`RELATED_THEMES_CALIBRATION_FILE` with the generated private calibration-evidence
file and restart only that preview. `/reviewer-a/holdout/` and
`/reviewer-b/holdout/` beneath the evaluation root stay HTTP 423 before this gate.
The normal release flag additionally needs `RELATED_THEMES_RELEASE_FILE`; it
recalculates the calibration lock and holdout assessment rather than trusting an
editable `passed` boolean. Any corpus or pipeline change invalidates the evidence.
These file settings are deployment configuration, never request parameters.

## Evaluation form direction

Operate mode extends the existing mineral-blue, white and pale-sky interface with
native labelled controls, a measured reading column and visible focus. The first
viewport gives the real review instructions and anchor description, not a dashboard
of metrics. Individual ratings precede the A/B list comparison. Mobile fields stack;
44px controls and wrapping labels support touch and larger text. No imagery, model
details, decorative motion or comparison score can distract or bias a reviewer.
The shipping UI needs anonymous desktop/mobile browser verification; no real sermon
prose belongs in screenshots. Existing DESIGN.md remains unchanged.
