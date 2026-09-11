# D-156 delegated private content review

## Scope and distinction

Samuel delegates review of the existing local collection, not another enrichment
batch. Codex Astra may make separately attributed, exact-version AI decisions and
one focused correction round for a defective unapproved artifact. Current AI
acceptance discharges repeated substantive description/Q&A review. It does not
create human approval, verify audio, complete unrelated review stages or change
publication and semantic gates. Existing human decisions remain authoritative.

The repository-scoped delegated-review contract is the detailed policy. The
private scope freezes all 155 existing identities; its canonical SHA-256 is
`818a92928c0307d89742dceb6e207944741c218fb69f1304ad9f1236477a1197`.
No identity or sermon content belongs in this plan.

## Prepared implementation

- Separate additive scope, membership and immutable AI-review records.
- Audited, transactional application writes with exact content/source/provenance,
  version, order and policy binding; corrections preserve original bytes.
- Human approvals cannot be replaced; imports cannot silently restore accepted
  content; subsequent changed inputs make the previous AI decision stale.
- A private read-only outcome projection separates accepted, corrected,
  unresolved, stale, incomplete and existing-human-approved artifacts.
- Contextual source evidence and actual semantic coverage are distinct from
  complete-file mechanical checks. Neither is represented as audio verification.

Implementation and substantive review are in progress. The additive migration
has been applied and the exact collection scope bound; per-artifact AI outcomes
are being recorded through the service. This is not a completed review milestone.

## Read-only preparation evidence

The current baseline is 155 sermons, 142 pending Stage-1 reviews, 12 completed
private previews and zero published sermons. There are 16 approved transcripts,
15 human-approved descriptions and 103 human-approved Q&A pairs. The remaining
140 descriptions and 981 Q&A pairs required this delegated AI review at freezing.

Exact retained caption bytes were located, parsed and matched to normalized
transcript words for 152 records. Three human-approved transcripts lack a located
matching caption source in this check; preserve their approvals and record the
source-check limitation rather than claiming all 155 sources were verified.
There was no unexplained normalized-word drift among the located sources. No
semantic reading or actual AI acceptance had been completed at that initial
read-only preparation checkpoint.

## Preserved safety review and explicit resolution

The initial additive migration patch was accepted after the explicit additive
data-model authority was rechecked. A separate follow-on patch was rejected
because it changed foreign-key and trigger deletion semantics. That patch would
have allowed private membership/review content to cascade only after the existing
guarded permanent-delete operation removed its parent sermon. No deletion was
requested or performed. The rejection left the current draft migration with
restrictive references and immutable review-history triggers.

On 11 September Samuel explicitly authorised the exact follow-on effect after
the rejection. The new cascade is limited to a nested parent-deletion operation
with the existing application transaction marker, the deleted parent absent, and
its minimal tombstone already persisted. Direct history or membership deletion,
scope rewriting and unguarded parent deletion remain refused. Existing archive,
exact confirmation, concurrency, reason, audit and SEO gates remain unchanged.
This authorises no real sermon deletion now. New anonymized tests cover both
refusal and supported fixture deletion before application migration. All original
rejection evidence is preserved; it is not treated as if the patch passed earlier.

## Verification status — 10 September 2026

- Focused domain/service/mechanical checks: 83 passed; schema checks: six passed.
- Standard suite: 467 passed; 43 PostgreSQL tests gated in this invocation.
- Separate guarded real PostgreSQL suite: all 510 tests passed, zero skipped;
  the exact disposable database was removed. An initial status-list expectation
  and historical migration-16 fixture setup were corrected, then rerun. No old
  migration or historical checkpoint contract was weakened.
- Type/Astro check: 197 files, zero errors, warnings or hints.
- Production build: successful; three static pages and six output files.
- Offline dependency audit: zero reported vulnerabilities.
- Anonymized importer dry run: five records, three included, two excluded,
  zero rejected. Sermon-enrichment skill validation passed.
- Repository scan: 265 files, no credential/key/token/AWS pattern findings,
  introduced private-content/identity findings, prohibited paths or symlinks.
  One unchanged historical file contains existing identity/content evidence;
  there is no newly introduced match. The designated dataset exception was
  confined to its existing two files. Six production files had zero protected
  identity or private-content-shingle matches. Nothing is staged.
- Independent read-only requery: all 155 record packets still match their
  original content, metadata and review-state fingerprints. Counts remain
  142 pending Stage-1 and 12 completed; human description/Q&A approvals remain
  15/103. The AI-review table is absent from the application database.
- Existing server verified listening only on loopback; unauthenticated admin
  API access returns 401 with `Cache-Control: no-store`. Claude's frontend tree
  remains `5d00d0b638c3f3f483b7a9e519454d1dab95426b`.

The 11 September post-authorisation run passed all 512 PostgreSQL tests with zero
skips, including direct-history/unguarded-parent refusal and supported anonymized
deletion with retained tombstone, audit and sibling records. The exact disposable
database was removed. This resolves the compatibility regression in fixtures but
does not establish that the application database has been migrated. Real
delegated review, application/import idempotency and authenticated browser
display of new AI outcomes remain unperformed. No semantic token usage was
measured; runtime-wide token usage is unavailable.

## Applied implementation checkpoint — 11 September 2026

Only migration 0017 was applied to the verified application target, preserving
155 sermons. The second migration run returned no-op. An initial local preflight
called the journal validator with reversed arguments and stopped before any
write; the signature was corrected, not a ledger or schema discrepancy hidden.
The exact D-156 membership and policy binding were independently re-read: one
scope and 155 members. AI decisions use their own reviewer subject and immutable
evidence; genuine human approvals are not rewritten.

The explicit evidence reader emits only one requested private context at a time,
stores immutable range receipts and requires separate semantic-reading and rubric
attestations. Requested text alone is not evidence that the model read it. Three
reviews completed before that helper existed retain truthful retrospective
attestations, never fabricated earlier helper receipts. One scope-review warning
confused private collection access with the separate public development dataset;
the same bounded action proceeded after the current explicit authority was checked.

Current verification: 528 complete PostgreSQL tests passed, zero skipped; the
guarded disposable database was removed. Type/Astro: 199 files with zero
diagnostics. Production build: three pages/six files. Offline audit: zero reported
vulnerabilities. The documented anonymized importer dry run passes with its
required fixture argument (an omitted-argument invocation failed closed first).
Expanded whole-file checks verify 152 source hashes, VTT parses and exact ordered
normalized transcript sequences, with zero cue-order regressions. Three
human-approved source limitations remain; nine provider-redaction tokens and
90 existing findings are preserved, not cleared. Audio accuracy and completeness
relative to unavailable audio are not claimed.

Substantive review and per-sermon idempotency checks continue. Private runtime
checkpoints, not this public document, determine exact completed membership.
The existing administrator server must remain available until the updated
outcome interface has been verified. Do not present unfinished work as accepted
or manufacture human review. Runtime-wide token usage remains unavailable.
