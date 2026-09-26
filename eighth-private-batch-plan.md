# D-167 eighth fixed private enrichment and protected reconciliation

## Executed outcome — 26 September 2026

All 36 positions are terminal; this exception is consumed. The manifest hash
below and every historical source/candidate/checkpoint remain unchanged.
Selection excluded 267 prior attempts; 51 clean candidates became 36 fixed
positions, leaving 15. Selected service dates span 25 May 2025–12 April 2026.
No later batch or substitution was processed.

All 36 exact English ASR captions used the truthful unknown-audio exception:
12,209,568 bytes and 77,200 cues were hash-verified. The 35 preserved transcripts
contain 232,755 words and 1,221,605 characters. Four provider-redacted markers
remain; no explicit uncertainty marker was removed or replaced. Sequence 24
retains its word-preservation failure and has no import. The 35 descriptions
meet 180–220 words and each Q&A set has seven ordered pairs (245 total).
Nine original candidates required one permitted pre-import correction, at
sequences 4, 9, 15, 16, 19, 22, 23, 30 and 34; every original remains preserved.
No imported prose was changed during substantive review.

Each description and Q&A was substantively reviewed against its complete
transcript. The 280 content decisions passed; source-component review recorded
162 accepted and 48 held decisions across 210 checks. Explicit speaker evidence
supported assignments only at sequences 15 and 26. There are no fabricated human
approvals, audio-verification claims, private completions or new restricted
acceptances. Selected Sol provenance remains separate from unavailable runtime
metadata and the limited-reproducibility warning.

| Manifest positions | Actual terminal outcome / remaining evidence |
| --- | --- |
| 1–3, 5–10, 12–14, 16–22, 25, 27–30, 33–35 | Imported and content-reviewed; held for canonical speaker evidence |
| 4 | Imported and content-reviewed; speaker evidence and uncertain closing-prayer wording |
| 11 | Imported and content-reviewed; speaker and primary-passage evidence |
| 15 | Imported and content-reviewed; primary-passage evidence |
| 23 | Imported and content-reviewed; speaker evidence and provider-redacted wording |
| 24 | Transcript word-preservation failure; not imported |
| 26 | Imported and content-reviewed; primary-passage evidence and provider-redacted wording |
| 31 | Imported and content-reviewed; speaker evidence and uncertain instruction wording |
| 32, 36 | Imported and content-reviewed; speaker evidence and provider-redacted wording |

All 35 atomic imports succeeded; 35 identical imports and both supported speaker
assignment reruns were unchanged, including versions, timestamps, audit and review
progress. The local database contains 296 sermons, 282 pending Stage-1 reviews
and 148 restricted-eligible sermons. All 12,357 previously snapshotted baseline
rows remain unchanged. The new protected staging database contains the same 148
eligible sermons, with 8,076 scoped rows and an unchanged idempotency/restart
fingerprint. All held sermons remain excluded. The original public staging
database remains at 191 stored sermons with its same 148 accepted identities and
original application image. See `migration-validation-plan.md` for verification
and existing unrelated failures; see `deployment/README.md` for rollback.

This is a public-safe execution contract, not a manifest. The private manifest
SHA-256 is `0218989d1c09224ed301caecb915cefc787a5017f28f6253aee3020a7c3b3ae5`.
The manifest and checkpoint remain ignored, with opaque names and no identities
in tracked files or ordinary output.

## Scope and order

- Verify the canonical manifest hash, exact 36 ordered one-to-one mappings,
  zero-attempt checkpoint, source evidence hashes, 267 prior attempted identities,
  51 clean candidates before selection and 15 after selection. Stop on drift.
- Preserve the 261-record local database baseline and its review/acceptance
  evidence. Do not overwrite any existing record. A failed position consumes its
  place; no substitution or 37th new sermon is allowed.
- Bind D-167 and the governance commit before new caption access. Use only the
  current primary Codex task for generated prose and substantive review. Store
  Samuel's selected Sol label separately from verified runtime identity;
  unavailable fields are `not_exposed_by_runtime`. No separately billed
  generative API or other provider is permitted.
- For each fixed video, freshly verify authenticated church-channel ownership and
  exact caption identity through the official YouTube Data API. Select only
  serving, non-draft English standard/ASR tracks, rejecting forced, commentary,
  descriptive and equal-priority ambiguity. Rank standard-primary,
  standard-unknown, ASR-primary, ASR-unknown. An accepted unknown association
  retains `CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION`,
  `primary_audio_confirmed: false` and exact D-167 manifest provenance.
  Download exact VTT bytes with `tfmt=vtt` and no translation. Do not process
  audio/video or use an unofficial provider.
- Prepare complete word-preserving private transcripts, retaining source hashes,
  uncertainty and warnings. Generate one approximately 200-word private
  description and five to ten ordered, grounded Q&A, targeting seven naturally.
  Preserve each original candidate. Run the unchanged structural, support-range,
  editorial, provenance and privacy validators. Permit at most one focused
  correction per artifact before import, retaining both versions and lineage.
  Do not weaken validation or change transcript wording to force a pass.
- Import only validated candidates atomically into
  `127.0.0.1:5432/savinggrace_sermons_test` with the existing
  `ALLOW_LOCAL_DB_WRITE=1` gate. Import an identical second time and require
  unchanged versions, audit, timestamps and review progress. Imported transcripts,
  descriptions and Q&A remain draft/private/unapproved and excluded from public
  routes, search, feeds, sitemaps, SEO/build output and semantic processing.
- Substantively review every current description and ordered Q&A against its
  complete transcript. Record what was actually read and truthful AI attribution.
  Exact current content/source hashes and evidence govern each review outcome.
  Only supported identity, speaker, passage, finding, retained-caption and media
  checks may be accepted. Redacted, ambiguous, missing or stale evidence stays
  pending. Private completion and separate restricted-frontend acceptance require
  every applicable condition; neither is human approval or publication authority.

## Restricted frontend and staging boundary

Reconcile existing current review evidence without repeating a valid review.
Show every eligible record in the authenticated local restricted preview; keep
held records in administrator review. Preserve V1/V2/V4 and the current church
pages. Do not change the ordinary public sermon selector.

The existing D-166 public raw-IP application, database and exact 148 accepted
sermons remain unchanged. Create a distinct staging application and isolated
database, with a separate persistent volume/network and loopback-only application
listener reached through the pinned SSH tunnel. Use only a scoped, recoverable,
idempotent transfer of eligible sermon dependencies and real review/acceptance
evidence, never accounts, sessions, credentials or unrelated private artifacts.
Take a scoped recovery point before writes; verify destination identity, version,
hashes, provenance, permissions, no public port and an identical second sync.
Protect newer staging edits and stop on conflicts. Keep admin and draft-preview
unreachable remotely. Restricted staging does not authorize internet publication.

## Verification and stop rules

Run focused policy/import/review tests, the standard and real PostgreSQL suites
with zero skips, type/Astro checks, production build, offline audit, credential,
key, private-content, tracked/staged-file and production-output scans. Verify
membership, source/grounding hashes, review freshness, import/sync idempotency,
unchanged earlier database records, held exclusions, authenticated restricted
routes and public/search/feed/sitemap/SEO/semantic exclusion. Preserve Claude's
frontend design and the public site's 148-sermon identity-set hash.

Stop on systemic manifest, channel, OAuth, database-target, privacy or staging
identity failure. Checkpoint and report quota interruption without a retry loop.
An individual source or content failure is terminal only for its original
position; continue unrelated positions. Do not contact production WordPress,
MariaDB, AWS APIs or another provider. Do not push, merge, publicly deploy,
approve, publish or start another batch.
