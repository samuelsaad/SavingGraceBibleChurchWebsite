# D-157 remaining private review contract

## Scope and authority

Samuel explicitly delegates the remaining private requirements of the existing
155-sermon collection, frozen at canonical manifest SHA-256
`c46c9125291f2d73d73162d1e0a2be42a7ce7a27c3166579e6b60fd0c7b9fa68`.
This is not a content-generation, retrieval, publication or deletion batch. Preserve
D-156's 1,121 AI decisions, 118 human artifact approvals, all other human decisions,
historical policies, source and content bytes, correction history and provenance.
Use current interactive OpenAI Codex Astra with truthful available provenance;
unexposed revision/session/retention details remain unavailable. No separate API
or generative provider is permitted. Bounded Astra workers may assess disjoint
records with centrally coordinated application writes.

## Evidence and independent outcomes

Freeze current identities and dependencies before decisions. Recheck each relevant
version/hash under the guarded transaction; do not overwrite intervening human
edits. Persist separately attributed AI acceptance or a specific evidence exception
for each applicable component, never a human approval or false login event.

- Identity: use stable retained source/application mappings, original source
  titles and the documented conservative application-title projection. Service
  date and upload date are distinct. Similarity is not identity evidence.
- Speaker: accept only explicit source identification with one canonical mapping.
  Missing or conflicting names are exceptions; usual preacher/style are not proof.
  Persist supported missing assignments only with version-aware audit evidence.
- Passage: corroborate the main preaching passage with explicit retained metadata
  and contextual transcript evidence, distinguishing incidental references. Store
  only supported book/chapter/verse granularity. A supported no-single-primary
  finding is different from unavailable evidence. Preserve human passage decisions.
- Transcript: compare complete retained sources and transcripts under the existing
  documented word-preservation and caption-overlap contract, including negations,
  numbers, redactions and uncertainty. Reuse exact hash-bound valid previous checks.
  Examine unexplained omissions, duplication, truncation and material differences.
  Never edit captions/transcripts or describe caption fidelity as audio accuracy.
  Existing human approvals with unavailable source evidence remain human approvals
  with a visible source limitation, not fabricated AI source verification.
- Findings: assess every pending finding with enough surrounding context. Record
  resolved, demonstrated false-positive, acceptable documented source limitation,
  or unresolved disposition with evidence. An exact empty set may be explicitly
  acknowledged by AI only after its integrity check. Nonempty sets require every
  finding's disposition. Preserve warnings, redactions, human decisions and history.
  Unknown-audio association remains unconfirmed, not silently primary.
- Media: validate retained identities, source association and permitted reference
  format; no playback, download, new captions or playback-quality claim.

Record deterministic full-file comparison separately from exact semantic ranges
actually read. Prior D-156 semantic evidence may be reused only with matching scope,
content/source hashes and relevant coverage, with its origin explicitly retained.
Read surrounding passages as needed and expand when necessary; targeted reading
must never be labelled new complete semantic review. Descriptions/Q&A are not
independent source evidence for identity, speaker or passage decisions.

## Persistence and completion

Only PostgreSQL 16 `127.0.0.1:5432/savinggrace_sermons_test` with the existing
write opt-in is authorised. Use per-sermon atomic, audited, version-aware writes;
append immutable decisions and preserve original accepted evidence. Depend each
component only on relevant inputs; irrelevant metadata saves must not invalidate
independent acceptance. Changed relevant hashes, findings or human decisions block
stale application. Repeat identical requests without timestamp/version/audit churn.
Preserve the existing guarded-deletion and minimal tombstone safeguards; no deletion
is authorised. Additive schema is permitted only for honest immutable attribution.

Private final completion may combine valid human decisions, exact-current D-156
description/individual-Q&A acceptance and D-157 component acceptance. It requires
every applicable condition, `status = draft`, and no historical publication time.
Incomplete/stale/conflicting components remain exceptions. Do not manufacture
missing human decisions or let accepted description/Q&A clear unrelated stages.
Persist eligible private completion automatically with explicit AI attribution;
it is neither human review nor publication authorization. Preserve lifecycle
approval columns and all existing schedule/publish/public/search/feed/sitemap/SEO/
build/semantic eligibility checks. An AI private-completion record cannot satisfy
those human publication checks. Navigation, counters and private status must agree.

## Privacy, access and verification

Use retained local imports, captions, taxonomy and reconciliation evidence first.
When insufficient, the current task permits bounded read-only official church
public sermon pages/metadata for these existing identities only. No production
database/administration, MariaDB, AWS, YouTube API, new media/captions or other
provider is authorised. Never bypass a public-site access restriction.
Private evidence may enter the expressly authorised current Codex review context,
including bounded Astra workers, and approved ignored storage, not ordinary logs,
progress/final excerpts, tests, screenshots, Git or another provider. Use opaque
sequence filenames and sanitized errors. Human-facing exceptions belong in the
authenticated private queue. Preserve authentication, loopback restrictions and
honest development identity; AI audit subjects are not `local-admin-0001`.

Test direct handlers for source support, true exceptions, stale dependencies,
changed finding sets, human conflicts, unauthorized requests, races, idempotency,
private completion and draft/prior-publication guards. Run the full standard and
guarded disposable PostgreSQL suites, type/Astro checks, build and privacy/security/
public-exclusion checks. Read-only browser checks must agree for all 155 records.
Do not declare completion while records are unattempted. Report evidence exceptions
separately from infrastructure blockers or unfinished implementation. Keep the
working loopback queue available, preserve Claude's frontend, and commit only safe
implementation, anonymized tests and documentation locally; no push/merge/deploy.
