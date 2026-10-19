# D-183 pre-cutover completion — 19 October 2026

This continuation preserves D-182's original finding denominators and source evidence.
The final acceptance report remains NOT READY until fresh candidate comparisons and
release deployment evidence are appended. Earlier reports are dated evidence.

Implemented candidate changes:

- Original recording backup/hosting: exactly 117 MP3 and one MP4, unchanged, 1,106,058,680
  bytes; source MIME/range/hash checks and idempotent copy. Recording binaries stay private.
  Immutable streaming supports HEAD, conditional/suffix ranges, 206 and 416 responses.
- Exact numeric attachment/feed aliases redirect directly to their verified recording;
  prior resource redirects are retained. Campaign parameters survive. Duplicate identities
  and unrelated destinations are refused.
- Calendar subscriptions use published CMS event revisions, stable UIDs, sequence and
  modification values, Melbourne recurrence/time-zone rules and cancellation records.
  Draft edits cannot leak into the feed; unpublishing binds the exact last published
  revision. Known category/tag/venue/organizer scopes retain their identities.
- Captured calendar views from October 2026 onward use current CMS occurrences, including
  actual pagination and descriptions. Historical captures remain source-backed. Invalid
  dates/scopes/pages fail explicitly. A bounded public API comparison independently matched
  all 234 occurrences in the coming year across six recurrence groups; this does not
  establish stored WordPress database completeness.
- Contact has an accessible server-rendered form, bounded same-origin validation, retained
  input/error states and explicit delivery failure. Optional TLS SMTP configuration refuses
  unauthorized test recipients and staging use of production mail configuration. Intercepted
  transport tests passed; no live mail was sent without a verified approved recipient.
- Exact observed query metadata/indexability is preserved rather than inherited from the
  base archive. 435 source indexability flags were corrected with source-version guards.
  Untouched source seed revisions defer to audited native sermon titles; later CMS edits win.
- Fifteen exact captured obsolete WordPress implementation assets have explicit 410 outcomes;
  this is not a prefix rule or a disposition for missing church content.
- Exact presentation witnesses retain the raw findings and require full same-identity card
  facts, visible text or actual image-byte/alternative-text evidence before equivalence.

The sole source inventory expansion is the verified 18 October sermon (WordPress 30134),
raising the known public set to 459 and observed URL inventory to 23,018. No sermon body,
backup, account data or recording binary is added to Git. Original-public projection and
CMS adoption do not create enrichment approval or alter native human review states.

Private frozen deployment inputs: 554 source rows (118 recording resources, 435 guarded
indexability updates, one new sermon), 534 exact resource redirects (298 retained plus
236 recording aliases), and a one-document CMS adoption plan. Reruns are no-ops. The
staging operator preserves native/source/CMS history and credentials and requires its
actual incumbent release, fresh inventory, complete recovery coverage and canaries.
The asset recovery has two mandatory parts: the ordinary staging archive and the frozen
118-file owner-local recording backup. Neither part alone is a complete asset backup.

Current missing external evidence: a current original WordPress database/uploads/config
backup or appropriately restricted source access; church-owned Search Console/Analytics
property access and verified GA4 stream/consent/test configuration; approved SMTP test
recipient/configuration; selected managed production administrator authentication/MFA/
recovery and final production deployment/routing configuration. Production/DNS remains
unchanged. Docker is available through WSL; original WordPress restoration requires the
actual backup, with inert plugins and integrations disabled under the task-owned project
prefix `sgbc-seo-wp-restore-20261019-`.
