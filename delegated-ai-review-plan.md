# D-156 delegated private content review

## Private handler resolution — 12 September 2026

Starting commit: `766928553e4f5e6364a9f22939f651b3a909862f`. Samuel explicitly
authorised the narrow handler amendment following the rejection recorded below.
The revised patch passed execution review. No protected policy hash, migration,
AI decision or real administrator progress changed.

The omitted context was `sermon.status !== "draft"` in
`AdminSermonService.finishEnrichmentReview`, called by the protected
`POST .../review/finish` route. It prevents private completion of any other
lifecycle state. The guard remains explicit and additionally rejects a historical
`publishedAt`; the same private-state predicate now guards
`updateEnrichmentReviewProgress` (`PATCH .../review/progress`). The role-only
`assertMayEditSermon` is not mistaken for a status check. Both handlers retain
authentication, administrator authorisation, sermon/review locks, optimistic
versions and normal transactional persistence. Publication uses the unchanged
human-only `readiness.isComplete` in `transition`, not delegated completion.

| Predicate | Private handler result |
| --- | --- |
| Description | Current valid human approval or current version/source/policy-bound D-156 AI acceptance |
| Ordered Q&A | Every current item satisfied individually; five to ten unique consecutive pairs; mixed attribution allowed |
| Stale/missing/unresolved decision | Affected substantive component remains incomplete |
| Identity/speaker/date | Explicit identity confirmation, stored speaker and non-placeholder date still required |
| Findings | Exact identity/count/transcript integrity plus all decisions or explicit empty-set acknowledgement still required |
| Transcript | Existing human-approved complete transcript still required |
| Passage/media | Existing reviewed passage outcome and controlled-media checks still required to finish |
| Status | Draft and never published; all other states refused |
| Publication | No change; AI acceptance/private completion cannot satisfy human publication approval |

One private helper feeds read-only status, stage navigation and final completion.
The temporary blocked-transition flag/callout is removed. Historical completion
markers cannot substitute for current identity/transcript/substantive checks.
Identical successful operations with current versions are no-ops; stale versions
remain conflicts. There is no bulk-completion path or automatic acknowledgement.

All 155 real list/detail/guided statuses agree. The original 37 full-table
fingerprints remain identical, including all 1,121 AI decisions, 118 human
artifact approvals, source/content, versions, progress and audits. Counts remain
155 private drafts, 142 at Stage 1 and 12 completed private previews. Thirteen
records satisfy final prerequisites: twelve were already complete and one can
now be finished by Samuel. No final decision was submitted for it.

Remaining independent requirements are unchanged: 142 identity/source checks,
eight speakers, 139 finding acknowledgements, 139 human transcript approvals,
139 passage decisions and 143 final completions. Counts overlap. All description
and current Q&A substantive requirements are satisfied without repeated review.

Handler tests cover current and mixed acceptance, absent/needs-human/stale and
reordered Q&A, source/transcript changes, unrelated blockers, every non-draft
state, previously published drafts, authentication/authorisation, simultaneous
completion, stale versions and unchanged repeated writes/audits. All mutations
use the guarded disposable fixture database. Initial fixture setup correctly
hit existing finding and accepted-content protections; it was corrected to use
the supported editor and valid constraints, without weakening those guards.

Verification: all 553 PostgreSQL tests passed with zero skips and the disposable
database removed; 489 standard tests passed (64 database cases exercised in the
full run); type/Astro checks have zero diagnostics; production build, offline
audit and anonymised importer dry run pass. All 155 HTTP projections agree;
465 public/anonymous detail checks deny access, public/search/sitemap results
remain empty, and private-cache/anti-indexing/CSP protections remain intact.
Browser refresh shows honest AI status and no legacy blocker. An unresolved
Stage-1 record still has later navigation locked; an independently ready record
at Stage 4 exposes enabled onward navigation. No real save or finish button was
used, and no sermon screenshot/prose was captured. Security, protected-identity,
private-content, symlink and production-output scans have no introduced finding.
Claude's frontend tree is unchanged. The working queue remains
`http://127.0.0.1:4359/admin/sermons` in explicitly authorised development-identity
mode, not personal sign-in. D-155 stays closed; nothing is published or deployed.

## Status-display follow-up — 12 September 2026

The main dashboard displayed the human-only publication-readiness result as
"Needs work" without consuming D-156 decisions. Guided description/Q&A counters
also read only lifecycle approvals; the separate AI queue alone showed the
decisions. The old browser reproduced the label. No decision was lost or stale.

The read-only repair adds a separate current-artifact projection to list, detail
and guided previews. Q&A completion requires five to ten unique, consecutive
current individual decisions. Human approvals remain distinct. Changed content,
version, transcript/grounding, source/provenance, policy or order makes prior AI
acceptance stale. Identity/source findings remain independent. Publication,
public selectors, semantic gates and review write handlers are unchanged.

Execution safety rejected the private navigation/completion-handler amendment
twice. Its final reason was: "This repeats the previously rejected admin-service
completion change and could let delegated AI acceptance satisfy review completion
unless the omitted status guard is verified, creating a material risk of
bypassing human review or publication gates." The rejected changes were not
applied or bypassed. A read-only `delegatedCompletionBlocked` signal disables
unsupported legacy transitions and tells the administrator not to repeat
accepted content reviews as a workaround. Fresh approval following the rejection
was required at that checkpoint. The subsequent explicit authorisation and
handler resolution above supersede that partial-delivery limitation; the
rejection and earlier checks remain historical evidence.

All 155 current description/Q&A sets satisfy substantive review: 1,121 current
AI decisions and 118 preserved human artifact approvals. Independent remaining
work: 142 identity/source verifications, eight speakers, 139 finding-set/empty-set
acknowledgements, 139 transcript approvals, 139 passage decisions (129 proposals,
ten unresolved cases), and 143 final private-review completions. Counts overlap.
The database remains 155 private drafts, 142 at Stage 1, 12 completed previews.
No content, decision, approval, provenance, correction or audit was rewritten.

Tests cover current individual decisions, mixed attribution, stale bindings,
missing/duplicate/reordered pairs and unchanged publication denial. All 535
PostgreSQL tests pass without skips; the exact disposable database is removed.
The standard suite passes 489 tests, with its 46 database tests run separately
in that full PostgreSQL suite. Further verification is recorded in the validation
plan. No schema or protected policy-file changes were made.

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

Implementation and substantive review are complete; the final evidence below
supersedes the explicitly dated preparation and in-progress checkpoints. The
additive migration and exact collection scope remain bound. Completion here means
delegated description/Q&A review, not human-completed sermon review or publication.

## Read-only preparation evidence

The frozen baseline is 155 sermons, 142 pending Stage-1 reviews, 12 completed
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

At that implementation checkpoint substantive review and idempotency checks continued. Private runtime
checkpoints, not this public document, determine exact completed membership.
The existing administrator server must remain available until the updated
outcome interface has been verified. Do not present unfinished work as accepted
or manufacture human review. Runtime-wide token usage remains unavailable.

## Completed delegated review — 11 September 2026

Safe implementation commit: `4d49d6afb51c44ba4c9b12fdda597a1cc63fa90e`.
All 140 pending sermon review sets are assessed, validated and persisted, with no
missing or unapplied set. The scope and frozen policy hashes still match.

| Content | AI accepted unchanged | Corrected once and accepted | Unresolved | Existing human approval preserved |
| --- | ---: | ---: | ---: | ---: |
| Description | 139 | 1 | 0 | 15 |
| Individual Q&A | 980 | 1 | 0 | 103 |

One description had a source-established terminology defect; one answer had an
unsupported substantive addition. Only those two artifacts were corrected, with
the original bytes, source evidence, correction lineage and exact accepted new
versions preserved privately. Questions, order and satisfactory content were not
regenerated. There were no concurrency conflicts, unresolved content exceptions
or further correction rounds. No human-approved artifact was overwritten.

All 1,121 pending artifacts were read in full. Actual contextual semantic reading
covered 139 complete transcripts and one targeted transcript: 4,698,235 of
4,705,330 characters (99.8492% of those 140 source transcripts). This is not a
claim to have re-reviewed all 155 transcripts semantically or verified audio.
The 15 entirely human-approved sets were preserved rather than reaccepted by AI.
Mechanical checks still verify 152 retained caption hashes, VTT parses and exact
ordered normalized transcript sequences, with no missing/duplicated/reordered
words or cue-order regression relative to those retained sources. Three existing
human-approved source limitations remain. Nine redaction tokens and 90 findings
were not filled, cleared or disguised as verified speech.

Every new decision records truthful `gpt-6-astra` AI provenance, exact content and
source hashes, policy binding, contextual evidence, reading coverage and audit.
AI attribution uses its own system reviewer, not Samuel or a personal sign-in.
Unavailable immutable model revision, runtime-wide token usage and privacy details
remain unavailable; no separate generative provider or API was used.

Each application had an identical second pass. A final complete replay returned
`unchanged` for all 1,121 decisions across 140 sermons. Before/after whole-table
hashes across eleven content, review and audit tables were identical: zero
duplicate, content, version, timestamp, audit or review-progress churn. Independent
requery verified every original 155-record packet, allowing only the two authorised
correction effects. Transcripts, generation/source/import evidence, title and
speaker corrections, passage relationships, findings and human approvals remain
unchanged. All 1,121 new audit events have the separate AI/system attribution.

Current counts remain 155 sermons, 142 pending Stage-1 reviews and 12 completed
private previews. There are 16 approved transcripts and unchanged 15/103 human
description/Q&A approvals. Eight speakers and ten passage cases remain unresolved.
The live passage-review table has 16 human outcomes and 129 pending proposals;
the frozen reference packets already contained 129 proposed and 15 confirmed
record sets. Earlier 15/130 reports are historical snapshots, not a reason to
rewrite genuine decisions. D-156 writes no passage decision. Public eligibility,
semantic eligibility, semantic builds and semantic relationships remain zero.

The running updated backend's `/admin/ai-reviews` display was verified in the
browser: zero unfinished/material-exception rows, 1,119 accepted plus two corrected
outcomes, and an optional all-outcomes table of 1,239 rows including 118 preserved
human approvals. The display makes no mandatory rereading request for clean AI
content. Existing identity/transcript/finding/passage stages remain separate.
It uses the explicitly authorised loopback development identity, not personal
authentication. No approval or human-review control was submitted by Codex.

Final verification on unchanged implementation code:

- `npm test`: 483 passed, 45 database cases gated in the standard invocation.
- `npm run test:postgres`: all 528 tests in 58 files passed, zero skipped;
  the guarded disposable database was removed. These results cover migration
  apply/rollback/reapply, attribution, concurrency, correction, rollback,
  idempotency, import protection and guarded fixture-only deletion.
- `npm run check`: 205 files, zero errors, warnings or hints.
- `npm run build`: three static pages, six output files.
- `npm audit --offline`: zero reported vulnerabilities; no new dependency.
- Anonymized importer dry run: five records, three included, two excluded,
  zero rejected. Skill validation passed.
- Anonymous administrator API and private preview return 401. Authorized outcome
  API returns 200 with no-store/noindex; the local dashboard retains CSP and
  anti-indexing headers. All 155 public pages and 155 public API details return
  404. Public list, keyword and structured Scripture searches contain zero
  records; the sermon sitemap contains zero sermon entries.
- Private-content, protected-identity, secret/key/token/cloud, prohibited-file
  and symlink checks cover tracked/staged changes and all six production files.
  No new sensitive match or production-output match was found. Existing tracked
  baseline matches and the designated development dataset are not misreported
  as newly introduced leaks. Private evidence, corrections and receipts remain
  ignored and unstaged; no private review text is committed.

Claude's frontend tree remains
`5d00d0b638c3f3f483b7a9e519454d1dab95426b`. No audio/video/caption retrieval,
production access, real deletion, human approval, publication, embeddings,
push, merge or deployment occurred. The review server remains available. D-155
stays closed; no future collection or processing authority is created.
