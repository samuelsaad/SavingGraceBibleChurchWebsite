# Nine explicit Topical classifications

Samuel's written editorial decision `SAMUEL-NINE-TOPICAL-2026-09-14` applies only
to nine existing accepted no-single-primary records. Their private canonical
manifest SHA-256 is `b1016476118bb3029a42658c78cc38e97897970b6adc553511f7cae06c7f8b56`.
The same identity-only digest reconciled independently in local and sealed staging.
This is website organization, not source discovery, a new AI review or personal
authentication. No automatic null-book or series-name classification is allowed.

## Persistence and acceptance

Reuse the existing `sermon_extensions` relation, expressly designed for versioned,
application-allowlisted extensions. The sole new namespace is
`website.topical-classification`, schema version 1. Its exact payload records
Topical, Samuel's editorial authorization, separate Codex execution attribution,
the scope hash and original acceptance dependency hash. The extension and existing
audit row record the timestamp. The audit correlation binds the exact payload hash.
Reject unknown payload fields, a changed scope, conflicting existing extensions,
missing audit evidence, stale content/reviews or an approved primary-book conflict.
No database migration, new taxonomy, source-term invention or governance waiver
is needed. Preserve even unreviewed legacy relationships.

D-158's unchanged dependency function does not include extension metadata. This
separate classification binds the original receipt dependency and is rendered
only under the unchanged restricted eligibility selector. All original content,
review, version, publication-time and withdrawal checks remain required. Therefore
classification does not require superseding any acceptance receipt. Neither original
hashes nor human/AI decisions may be rewritten; the other 135 acceptances are untouched.

## Operator and recovery boundaries

The non-HTTP command requires the exact manifest, write opt-in, verified PostgreSQL
16 target and a protected, hash-verified custom-format pre-change backup. One
serializable transaction locks dependencies, reconciles all 155 identities/144
eligible records, inserts nine extensions and nine system audit events, and verifies
the original full-database fingerprint with only those exact inserts projected out.
Failure rolls back the entire operation. An identical rerun verifies existing
payloads/audits without timestamp, version or audit churn. No content or publication
state is updated. Local/staging backups and fingerprints remain independent.

The maintenance-only Compose overlay mounts individual protected inputs read-only;
the application receives no manifest or backup. The database stays private and the
app remains SSH/loopback-only, read-only, non-indexable and without remote admin.
Recovery can use the preserved compatible prior application image (classification
remains stored but is not displayed) or the existing fail-closed switch. Do not
erase the new audit history or restore an older whole database over decisions.

## Verification gates

Run exact-scope, stale-payload/audit, normal-public exclusion, genuine primary-book
rejection, rollback, content/receipt preservation and idempotency tests on guarded
disposable fixtures, plus the complete PostgreSQL and standard suites, checks,
builds and private-content/security scans. Before real writes freeze/re-read the
manifest and verify protected current backups in both environments. Afterward
independently verify nine classifications, 135 Bible-associated sermons/16 books,
144 visible and 11 unchanged hidden records; inspect actual shared cards, topical
discovery and detail pages in both browsers. Record results only after execution.
