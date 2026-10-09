# D-181 SEO migration acceptance record

**Status: NOT READY — final evidence and release gates remain pending.**

This is an in-progress acceptance record for `codex/whole-site-seo-migration`,
not permission to change production traffic or DNS. Results below distinguish
implemented safeguards, executed checks and evidence still required. Final URL,
content and asset coverage counts must come from the frozen reports; none are
inferred from historical inventories or earlier sermon review totals.

The execution scope is [the migration contract](../seo-migration-plan.md).
Operational procedures remain in the
[cutover and rollback runbook](seo-cutover-rollback-runbook.md),
[staging procedure](seo-staging-deployment.md), and
[monitoring plan](seo-post-launch-monitoring.md).

## Release identity and preservation

| Item | Evidence or current state |
| --- | --- |
| Integrated starting commit | `6a5239b136e5c68211d85bd34380db9992c29ef9` |
| Existing local work | Preserved sermon media, transcript/Q&A interaction and directory-count refinements are part of the integrated migration scope. The source worktree is retained. |
| Final reviewed commit | Pending final diff review and commit. |
| Source and runtime archives | Pending committed-input packaging, file hashes and fresh outgoing scans. |
| Private source and asset bundle identities | Pending final frozen bundle hashes and reconciliation report. These bundles remain outside Git and code archives. |
| Normal branch publication | Pending final gates and recorded remote result. No force-push or production merge is part of this record. |

## Implemented behavior

Verified originally public content has a separate immutable, provenance-bound
projection. Its additive migration, import receipts and current-version pointers
do not grant enrichment approval, clear findings or rewrite existing sermon
publication states. Imports require expected prior versions, preserve immutable
history, reject conflicts and honor explicit withdrawal decisions. Missing optional
generated enrichment does not suppress a verified original-public source page.

The visitor repository also admits normal approved sermon publications through
the unchanged public eligibility selector. Existing records bind to originals by
their unique stored WordPress source ID. Approved descriptions, transcripts and
Q&A can augment the original; the captured body and metadata remain defaults.
Successful administrator edit events identify deliberate field overrides, including
edits before a later source recrawl. Import/system events do not count as those
edits. New eligible sermons enter visitor detail, search, discovery and sitemaps.
Explicit slug changes resolve original URLs and verified source short links to the
chosen canonical directly. Withdrawn source pointers and explicit gone responses
cannot be reintroduced as newly published records by this composition.

Source-only non-sermon fallback documents remain immutable migration snapshots
until an administrator explicitly creates and publishes a supported CMS entity at
the retained path, or adopts a reviewed replacement and redirect. They are not
automatically editable modules in the visual editor. Existing CMS-owned pages and
shared settings already override the fallback; a draft does not replace the public
original, and a published redirect/gone disposition prevents its resurrection. The
final content inventory must identify any fallback documents requiring this adoption;
this record does not claim whole-source visual editing coverage.

Public HTML uses the configured canonical origin and server-rendered content and
links. Canonicals are derived from validated routes. Captured titles and optional
metadata supply defaults; explicit versioned CMS metadata overrides them. An absent
captured description remains absent instead of being invented from seeded copy.
Search, preview, staging, errors and unapproved variants have separate indexing
rules. Only exact observed eligible archive query paths can retain query canonicals.
Reviewed redirects resolve directly to the final destination.

CMS search appearance controls cover title, description, sharing text, managed
images and an explicit noindex choice. They do not accept arbitrary canonical URLs
or executable structured data. Draft, publish, hide, rename, restore and unpublish
operations retain optimistic concurrency and immutable revision history. Initial
imports, no-op saves and replayed restores do not manufacture sitemap modification
dates. Structured data uses supplied facts, escapes executable-looking text and
does not automatically invent FAQ or recording schema.

The source asset path accepts only bounded, content-addressed, type-checked files.
The public handler checks current metadata, expected length and byte hash. SVG and
feed responses retain the restricted content-security policy. Deployment archives
reject links, duplicate names, arbitrary paths, extra members and byte mismatches;
existing asset bytes cannot be overwritten by transfer.

## Executed CMS and implementation checks

| Check | Result and limit |
| --- | --- |
| Guarded PostgreSQL integration file | 145 tests passed with zero skips in the final focused rerun; the exact disposable test database was removed. This includes source/editorial publication, withdrawal, child-only approval invalidation and same-sermon redirect preservation. The full guarded suite completed; the exact disposable database was removed. |
| CMS lifecycle through actual loopback HTTP | The integration run exercised anonymous synthetic content through authenticated API requests and visitor HTTP responses: draft isolation, protected preview, publish, metadata, module visibility, repeated slug changes, revision restore, inbound-link protection, unpublish/gone responses and sitemap exclusion. |
| Read-only local CMS browser inspection | Five checks passed for home/page search previews, optional SEO entry, canonical guidance, advanced navigation and the mobile inspector. External requests and content mutations were blocked by the harness; none were attempted. Revision pointers remained identical and there were no browser errors. This used the existing development identity, not personal production authentication. No content was added, saved or published in this browser check; mutation coverage comes from the separate synthetic HTTP workflow. |
| Source repository, runtime snapshot and package checks | Focused anonymous tests passed. Final aggregate suite result and receipt are pending. |
| Source/editorial composite and actual loopback HTTP | Anonymous tests verify original-only rendering, normal approved augmentation, new publication discovery, intentional metadata/body changes, direct slug aliases, source-ID short links and withdrawn/private exclusion. The public constructor uses the existing public selector, never a restricted-preview scope. |
| Local restore guard/comparison unit tests | Four tests passed. They prove guard and comparison behavior, not that a database was restored. |
| Staging operator tests | Eleven offline tests passed without remote, Docker or database execution. |
| Metadata regression tests | Eleven tests passed across the source-asset/schema and CMS SEO files, including absent captured description, exact archive title and explicit CMS override precedence. All new fixtures are synthetic. |
| Final tests, type checks, builds, dry run, offline dependency audit and outgoing scans | Unit tests:1,222 passed,145 database-gated skips covered by the1,367/1,367 PostgreSQL run. Astro:626 files,zero errors/warnings,seven hints. Production and offline staging builds passed. Anonymous importer:five records,three included,two excluded,zero rejected. Offline dependency audit:zero vulnerabilities. Outgoing scans are recorded with the final release. |

The HTTP checks found and corrected a restore defect: promoting a historical slug
could temporarily turn the selected canonical path into a self-redirect. The route
update now excludes that selected path while flattening aliases. Packaging review
also added the new source-public maintenance entry to both runtime and source-input
closures; the final packager must still verify the committed archive bytes.

## Security and administration boundary

Read-only review covered the source import compare-and-swap checks, immutable
version history, withdrawal handling, safe source rendering, structured-data
escaping, asset confinement and publication separation. It found no additional
concrete blocker after the reported corrections. This is a bounded code review,
not an independent penetration test or a production certification.

The existing local development identity and protected staging operator-key session
remain environment-specific administration mechanisms. Neither is individual
production authentication or MFA. The source visitor integration retains the
existing admin/API/private-preview boundaries; source publication adds no CMS-writer
privileges. Production administration and account connection remain a separate
launch gate. Secrets, source bodies, private receipts and database archives remain
outside Git, ordinary logs and release payloads.

A separate pinned, read-only check confirmed the incumbent staging reader already
has SELECT on the audit table and the existing tables/views needed by the normal
public selector and its cache dependencies. It returned only boolean results and
changed no grants. Immutable edit attribution stays server-side. Source migration
still adds only the documented SELECT grants on its three new tables.

## Source parity and coverage evidence

| Required evidence | Final report status |
| --- | --- |
| Fresh source capture, canonical hosts, robots and sitemaps | Pending final report identity, capture interval and explained limitations. |
| Disposition for every discovered URL | Pending final ledger counts and unresolved-item list. |
| Current original-public sermon reconciliation | Pending source-to-candidate identity and content report; historical cohort counts are not completeness evidence. |
| Titles, descriptions, headings, dates, language and visible content | Pending actual HTTP comparison report and approved differences. |
| Direct redirects, gone/missing responses and short links | Pending exhaustive candidate result summary. |
| Navigation, internal links, discovery and sitemap eligibility | Pending final route-level comparison. |
| Images, documents and feeds | Pending final asset ledger and byte/response verification. Recordings are not downloaded for this task. |
| Fresh WordPress database evidence | The strict read-only privilege gate blocked the attempted fresh inspection. No weaker credential or guard bypass was used. Final source reconciliation must state the resulting limitation. |
| Search Console, Analytics and Tag Manager evidence | Pending an access/result statement. No unavailable evidence may be represented as checked. |
| Browser/accessibility and laboratory performance evidence |42 local browser cases passed across1440/390/320 widths with JavaScript enabled/disabled:one main/H1,no horizontal overflow,zero uncaught errors,zero external requests. Maximum measured CLS0.001587 and LCP588ms, unthrottled headless Edge on loopback. INP and comparable source/field measurements are not established. |
| Field Core Web Vitals and post-launch search behavior | Unavailable for the replacement before launch. Laboratory results are not field performance, and staging cannot prove future indexing, traffic or ranking parity. |

## Backup and restoration gate

The private local proof is implemented in `scripts/seo-local-recovery.ts` and
documented in [the recovery procedure](seo-local-recovery.md). It takes a consistent
read-only exported snapshot, retains a private custom-format dump, restores only to
one newly created guarded target, compares all table counts and fingerprints, and
cleans up only the database created by that run. It cannot restore over the source.

**Actual restoration remains unexecuted and blocking.** Automatic approval review
rejected the proposed narrow database-governance amendment because the direct
authorization for that exact amendment was not established in its trusted context.
Explicit user confirmation is pending. No restore target was created, and no
alternative path bypassed that rejection. Unit tests and `pg_restore --list`
validation do not meet the demonstrated-restoration requirement.

The staging operator implements a private full database dump and captures CMS,
assets, immutable configuration and secret identities before changes. Its archive
header/listing checks and hashes must be recorded when staging preparation actually
runs. Reconstructing production roles, identities and grants is not claimed by the
isolated local schema/data recovery procedure.

## Protected staging delivery gate

The latest read-only inventory observed D-180 release
`e8892c08eb1ea26e9675c8af87ebefef9866699d`, image
`sha256:2760ce944f9393cde4388a2fe6e1ed5aba108a4f8ac48ad3dbcb41558c2462cc`,
and schema ledger 27. These are the incumbent identities, not a D-181 deployment.

| Required staging evidence | Status |
| --- | --- |
| Fresh inventory bound to the final release | Pending. |
| Private recovery snapshots and full dump | Pending execution and verified receipts. |
| Compatible feature-off bridge canary and activation | Pending. |
| Migration 28 apply, unchanged replay and source import replay | Pending. |
| Candidate canary, activation and actual HTTP parity checks | Pending. |
| CMS, asset, sermon/review, secret, mount, network and listener preservation | Pending before/after evidence. |
| Rollback to the schema-compatible bridge and reactivation | Pending actual exercise and HTTP verification. |
| Final protected staging image/configuration identity | Pending. |

The implemented operator requires the bridge before migration and permits only
the compatible bridge as application rollback after migration 28. Ordinary rollback
does not erase source history, assets, audit records or subsequent CMS changes.
No D-181 staging transfer, application switch, migration or role change is certified
by this record yet. Production traffic, DNS and WordPress remain unchanged.

## Outstanding acceptance decision

The final reviewer must attach the frozen evidence identities, replace pending
entries with actual results, enumerate unresolved differences and decide whether
they block launch. Demonstrated restoration, complete source/candidate comparison,
release verification and protected staging delivery remain open. Missing account
or field evidence must retain an explicit limitation and follow-up owner. This
record cannot be used as a READY verdict while these gates remain unresolved.

## Completed source and implementation milestone

The frozen linked baseline observes11,300 URLs and captures6,135 responses. The final private source projection contains2,351 routes/resources:30 pages,three posts,665 archive/query pages,457 sermons,377 events and819 resources. Every one of the454 published retained-export sermon identities is present; three further current public IDs are included. All457 have primary media relationships. The exact source import replay changed nothing.

The source comparison identified real missing paragraphs in initial CMS copy and a leading-slash filter failure affecting516 observed URLs. The implementation now retains missing original text/links/images in the selected layout, restores verified original headings where the seed label is unchanged, honors subsequent explicit CMS edits, preserves exact observed calendar/archive queries without indexing those duplicate spaces, and retains original social types. Protected previews use the same source defaults. Existing sealed-staging enrichment uses the incumbent selector and warnings; production cannot select that delegate.

A measured font fallback correction retains the chosen self-hosted face and uses Verdana before Segoe UI while loading. Source images are responsive and source tables have keyboard-accessible horizontal scrolling. All changes address recorded content, metadata, accessibility or performance defects.

The full source coverage remains incomplete:162 source requests remained rate-limited after allowed retries and4,987 additional observed URLs were not recursively requested. Three dynamic host resource variants differ and remain unaccepted. The final exhaustive comparison, per-URL disposition review, Git release and protected staging receipts must be attached below before this record is finalized.

GA4 continuity code was not added: automatic approval review rejected the proposed opt-in production telemetry/CSP change, and explicit confirmation remains pending. The public source config receipt is private; no analytics tag or account API was executed.
