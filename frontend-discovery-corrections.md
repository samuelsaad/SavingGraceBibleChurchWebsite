# Restricted frontend discovery corrections

## Scope and findings

The read-only audit of the D-158 cohort found 144 currently eligible sermons.
135 have reviewed primary-book evidence, across 16 canonical books. Nine have a
reviewed no-single-primary outcome and no approved book classification. All 11
excluded records remain excluded. The original legacy classification join covered
only 14 sermons across nine books, although current primary references were already
available in passage text and structured passage search. No review or metadata
rewrite is needed to connect those sources.

The shared book projection now combines reviewed primary coordinates (lead first)
with approved legacy classifications, resolves canonical identity through the
existing catalogue, and deduplicates each sermon/book pair. List, detail, related,
series-representative and filtered cards consume the same projection. Broad book
filters and full-collection counts consume the same relationship union. Filtered
counts retain AND semantics and do not depend on the current page. The narrower
structured primary-passage filter retains its separate interval semantics.

The current cohort has 135 distinct book-associated sermons and 135 associations;
there is no multiple-book inflation. The general contract still permits multiple
reviewed associations, counted once per sermon within each book. Summing book
counts is not generally the same as counting all eligible sermons.

## Menu and restricted rendering

The missing menu was not a broken click handler: the ordinary public rendering
context deliberately delivered a plain Sermons link and omitted the existing
navigation enhancement. The sealed visitor runtime now has its own restricted
render context. It reuses the unchanged SermonsV1, SermonsV2, Speakers, Series and
Books disclosure and CSP-hashed enhancement, with server-rendered taxonomy indexes.
Their items link to the existing paginated archive filters, not a capped collection.
Single click opens; double click on the parent navigates to SermonsV2; ordinary
dropdown links use single activation. No private-preview or admin route is opened.
Normal public-mode routes and their taxonomy/indexability boundary remain unchanged.
Restricted pages emit no canonical or social metadata and retain noindex/no-store.

## Original Topical evidence limitation and explicit resolution

The shared card/detail renderer now supports an explicit trusted `isTopical`
classification, with a labelled plum-colour tab that takes precedence over the
book tab while retaining Scripture references. The optional display field does
not create a classification workflow or database assignment.

At the earlier `903e386` checkpoint there were zero authoritative assignments.
Two series memberships named Topical were not classification decisions, and no
missing-book fallback was introduced. Samuel subsequently explicitly classified
the exact nine accepted no-primary sermons as Topical. Implementation `60b31a1`
persists his decision in the existing versioned allowlisted extension relation,
with an exact private scope, original acceptance-dependency binding and separate
system audit. Both databases now contain those nine assignments; each identical
second operation made no changes. Original content/reviews/receipts, the other 135
Bible-associated sermons and all 11 exclusions are unchanged. This is editorial
organization, not newly discovered source evidence or another content review.
See `topical-classification-plan.md` and the current deployment report.

## Verification

New tests exercise numbered-book aliases, every card variant, missing metadata,
topical precedence, menu delivery/CSP, sealed taxonomy access and mutation denial.
The real PostgreSQL regression uses an invented AI-accepted proposed primary
reference without legacy book mapping and checks count/list/detail agreement,
alias filtering, out-of-range pagination, combined filtering and stale exclusion.
Full standard and disposable PostgreSQL suites, type/Astro checks, builds, offline
audit and privacy scans are required. Actual local/staging browser and deployment
outcomes are recorded in `deployment/STATUS.md` after verification.

Before packaging: 629 standard tests passed; the separate complete guarded
PostgreSQL run passed 743 tests with zero skips and removed its disposable database.
Type/Astro checking reported zero errors/warnings (one existing private-helper
hint). Production and staging builds passed, as did the anonymized importer dry
run and offline cached dependency audit. The private-content scan covered all 155
records and 1,092,303 protected eight-word sequences, with zero findings.
The temporary real local browser verified all 144 identities across 16 archive
pages and every book's pagination, 16 book counts, shared labels and vertical text,
menu interaction at four viewport widths, touch, and exclusion of all 11 records.
Minimum rendered book-tab contrast was 6.15:1; the invented topical fixture was
9.43:1. No external request, mutation request, console error or screenshot occurred.
The existing local and sealed-staging full database fingerprints were unchanged.
These are pre-deployment checks, not a claim that the corrected image was deployed.

Deployment subsequently passed: running code is
`903e386f10f34001a04f3355ec096518c68e0ab8` on both working URLs. The complete real
browser pass succeeded independently in both environments, with the same counts,
labels, contrast and exclusions. `deployment/STATUS.md` records the immutable image,
package and archive hashes, exact unchanged database fingerprints, security checks
and the distinction between the implemented topical display and missing real
topical classifications. No database records were altered by these corrections.
