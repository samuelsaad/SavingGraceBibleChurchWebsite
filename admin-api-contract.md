# Phase 3B Administration and Dashboard Contract

**Status:** Yang's final Phase 3B.1 decisions are approved and implemented locally; Cognito/AWS and production remain excluded.
**Scope:** Sermons, approved sermon descriptions, one-speaker relationship, speaker/series/book definitions, scripture, controlled media, full transcript, ordered Q&A, content readiness, audit history, permanent deletion, enrichment progress, and the local administration dashboard.
**Excluded:** Production identities, role management, WordPress-style metadata, production data, deployment, and every remote service.

## Identity and authorization boundary

There is one active application role: `admin`. An authenticated identity does not become an administrator automatically. The future provider adapter must verify its provider claims and explicitly decide that the subject has been granted administration access before returning the provider-independent `{ subject, role: "admin" }` identity.

The local harness has one deterministic non-secret identity, `local-admin-0001`. It is available only when explicitly enabled, only for loopback request URLs, and never when `NODE_ENV=production`. Unknown, unauthenticated, `editor`, `contributor`, spoofed-subject, and spoofed-role requests are denied. No password, token, refresh token, or fake Cognito secret is stored.

| Capability | Approved administrator |
| --- | --- |
| List/detail every sermon state | Allowed |
| Create and edit sermons | Allowed |
| Manage the sole speaker, series, book, scripture, controlled media, transcript, and Q&A | Allowed |
| Submit, withdraw, schedule, publish, unpublish, archive, and restore | Allowed when the transition is valid |
| Manage speaker/series/book definitions | Allowed |
| View sermon and global audit history | Allowed |
| Permanently delete an archived sermon | Allowed only through the safeguarded explicit operation |
| Manage identities/roles | Deferred to the future identity administration design |

Any capability not listed is denied. The provisional Phase 3 editor/contributor roles, contributor ownership restrictions, role switching, and multi-role dashboard behaviour are superseded and inactive. Imported records with null local creator remain fully manageable by the approved administrator.

## Editorial transition matrix

| From | Action | To | Conditions |
| --- | --- | --- | --- |
| `draft` | `submit` | `pending` | Explicit operation |
| `pending` | `withdraw` | `draft` | Explicit operation |
| `draft`, `pending`, `unpublished` | `schedule` | `scheduled` | Future RFC 3339 timestamp and complete content checklist required |
| `draft`, `pending`, `scheduled`, `unpublished` | `publish` | `published` | Complete content checklist required; first publication sets `publishedAt` |
| `scheduled`, `published` | `unpublish` | `unpublished` | Clears schedule, preserves first publication timestamp |
| Any non-archived state | `archive` | `archived` | Clears schedule, preserves first publication timestamp |
| `archived` | `restore` | `draft` | Preserves first publication timestamp |

Clients cannot patch `status` directly. Every mutation requires the current positive `rowVersion`. All non-published states remain excluded from every public route and public count.

The complete checklist is derived server-side: one valid `speakerId`, one nonblank approved 80-2,000 character sermon description, nonblank approved transcript, 5–10 nonblank consecutively ordered all-approved Q&A rows, and valid controlled media plus existing required sermon metadata. Incomplete drafts/imported records are valid, but schedule/publish returns `400 content_incomplete` with every field-level issue. Historical WordPress status is preserved and incomplete included rows carry `historicalBackfillRequired`.

## Permanent deletion contract

Permanent deletion is a separate `POST .../permanent-delete` operation rather than an ordinary update or an ambiguous generic `DELETE` request. It requires all of the following:

- The current record exists and is `archived`.
- The request carries the current `rowVersion`.
- `confirmation` exactly matches the current slug or title.
- `reason` is trimmed and between 3 and 500 characters.
- A previously published sermon supplies either a validated redirect to a different currently published sermon path or an explicit `gone` disposition for a future HTTP 410 response.
- A never-published sermon does not create an unsupported public URL disposition.
- The URL disposition, minimal tombstone, non-content audit event, and content deletion occur in one transaction.

Deleting the sermon cascades through sermon relationships, scripture rows and their sources, media and private media-source provenance, resources, extensions, and private legacy metrics. The tombstone is deliberately limited to actor, action, former sermon identifier, former slug, timestamp, reason, prior-publication flag, SEO disposition, optional redirect target, and correlation ID. It never stores the deleted title, summary, body, media, embed HTML, source provenance, credentials, or secrets. Audit events have no sermon foreign key and remain valid after deletion.

Historic slug changes for previously published sermons automatically upsert a direct `301` mapping from the former path to the new canonical path and collapse prior aliases to avoid chains. Permanent deletion changes the current path and its aliases to the final redirect or `410` outcome. These dispositions remain launch-controlled by `seo-migration-validation-plan.md`.

## Routes

```text
GET    /api/v1/admin/sermons
POST   /api/v1/admin/sermons
GET    /api/v1/admin/sermons/:id
PATCH  /api/v1/admin/sermons/:id
POST   /api/v1/admin/sermons/:id/submit
POST   /api/v1/admin/sermons/:id/withdraw
POST   /api/v1/admin/sermons/:id/schedule
POST   /api/v1/admin/sermons/:id/publish
POST   /api/v1/admin/sermons/:id/unpublish
POST   /api/v1/admin/sermons/:id/archive
POST   /api/v1/admin/sermons/:id/restore
POST   /api/v1/admin/sermons/:id/permanent-delete
GET    /api/v1/admin/sermons/:id/audit
GET    /api/v1/admin/audit

GET    /api/v1/admin/taxonomies/:kind
POST   /api/v1/admin/taxonomies/:kind
PATCH  /api/v1/admin/taxonomies/:kind/:id
```

The sermon list accepts bounded title/slug search, state, sole speaker ID, series ID, inclusive service-date bounds, content issue, page, and page size. `contentIssue` supports `complete`, `missing_speaker`, `missing_description`, `description_awaiting_review`, `missing_transcript`, `transcript_awaiting_review`, `insufficient_questions`, `questions_awaiting_review`, and `missing_media`. It returns state counts, sole-speaker/series summaries, per-record readiness, and aggregate approved-description plus completed/remaining checklist counts. `:kind` is `speakers`, `series`, or `books`.

## Validation and response safety

- Strict request schemas reject unknown fields, direct status edits, arbitrary postmeta, raw iframe/embed HTML, and uncontrolled extensions.
- `speakerId` is a single nullable UUID; speaker arrays/unknown multi-speaker fields are rejected.
- Sermon description, transcript and Q&A are plain text, bounded, status-controlled, provenance-aware, concurrency-protected and audited. Approved transitions stamp the verified administrator subject and time; generated/imported drafts never approve themselves. Description text changes require an explicit description status.
- Media writes accept only provider-matched YouTube video or SermonAudio audio URLs with controlled labels.
- Relationship UUIDs must exist; dashboard-edited scripture references are `curated` while immutable imported provenance remains separate and private.
- Relationship replacement, search refresh, slug dispositions, tombstone/audit writes, and deletion share the relevant transaction.
- Stale writes return `409 stale_write`; validation, authentication, authorization, conflict, and not-found errors use safe codes without database details.
- Normal admin responses exclude migration mappings, private source values, legacy metrics, embed configuration, internal warnings, credentials, and iframe HTML.
- Audit responses expose safe action metadata and controlled deletion tombstones, never request payloads or deleted content.

Public `/api/v1/sermons` selects only non-deleted `published` records. List responses may include the approved bounded `summary` but omit transcript/Q&A bodies. Published detail responses include approved summary, approved transcript and approved ordered Q&A only; unapproved content and provenance are absent. Detail includes controlled `seoDescription` only for server metadata selection.

## Dashboard contract

The static Astro dashboard is served by the local Node harness at `/admin` only when `ENABLE_LOCAL_DASHBOARD=1`. It opens with a visible anonymised-demonstration notice and aggregate completion progress. Editing remains six steps: (1) basics with **Sermon description**, character feedback, lifecycle state and review/approval actions, (2) speaker and scripture, (3) media, (4) full transcript, (5) questions and answers, and (6) review and publish. It provides missing/awaiting-review filters, description progress/checklist, accessible announcements, validation/concurrency feedback, taxonomy/audit/SEO safeguards and keyboard-accessible controls.

The shell is labelled local-development-only, sends no remote requests, receives `X-Robots-Tag: noindex`, and is served with restrictive content/security headers. Navigation, forms, dialogs, tables, live status feedback, visible focus, reduced-motion support, and mobile/tablet/desktop layouts use semantic accessible controls. The interface does not duplicate service authorization or lifecycle decisions.

## Controlled SEO administration

The dashboard displays the resulting title, slug, and expected canonical public sermon URL. It warns before changing a previously published slug. Slug mapping and deletion dispositions are explicit contract fields rather than WordPress-style postmeta.

Migration `0005` persists only the controlled optional `seoDescription` override. The approved visible description is the deterministic metadata/social fallback when the override is null. Future ordered migrations may add only approved fields such as `seoTitle`, controlled social title/description, a managed social image, and managed image alt text. No role may add arbitrary meta names, raw `<head>` fragments, scripts, external canonicals, arbitrary JSON-LD, or unrestricted metadata. Indexability remains derived from route, environment, template, and publication state.

## Phase 3B.2 private provenance review

Admin sermon detail may include a private `enrichmentSource` object when a draft came from the controlled caption pilot. It exposes only canonical video identity, caption language/track type, original filename, SHA-256, authorised-export attribution, aggregate source/cleaned counts, processing version/timestamps/duration, safe warning codes, unresolved marker identifiers, review estimate, and the fixed `required` human-accuracy state. It never appears in public API responses or search documents and never includes source caption text, credentials, cookies or tokens.

The six-step editor displays this evidence and warnings before the transcript field. Reviewing the provenance, transcript, description and each Q&A is possible without changing status. Moving any area to in-review or approved remains a separate explicit administrator action that records the administrator subject and timestamp. The local pilot importer has no approval capability and never impersonates the administrator.
