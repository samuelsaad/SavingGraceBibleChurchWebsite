# Phase 3B Administration and Dashboard Contract

**Status:** Yang's final decisions are approved and implemented locally; Cognito/AWS and production remain excluded.  
**Scope:** Sermons, speaker/series/book definitions, scripture relationships, controlled media, audit history, permanent deletion, and the local administration dashboard.  
**Excluded:** Production identities, role management, WordPress-style metadata, production data, deployment, and every remote service.

## Identity and authorization boundary

There is one active application role: `admin`. An authenticated identity does not become an administrator automatically. The future provider adapter must verify its provider claims and explicitly decide that the subject has been granted administration access before returning the provider-independent `{ subject, role: "admin" }` identity.

The local harness has one deterministic non-secret identity, `local-admin-0001`. It is available only when explicitly enabled, only for loopback request URLs, and never when `NODE_ENV=production`. Unknown, unauthenticated, `editor`, `contributor`, spoofed-subject, and spoofed-role requests are denied. No password, token, refresh token, or fake Cognito secret is stored.

| Capability | Approved administrator |
| --- | --- |
| List/detail every sermon state | Allowed |
| Create and edit sermons | Allowed |
| Manage speaker, series, book, scripture, and controlled-media relationships | Allowed |
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
| `draft`, `pending`, `unpublished` | `schedule` | `scheduled` | Future RFC 3339 timestamp required |
| `draft`, `pending`, `scheduled`, `unpublished` | `publish` | `published` | First publication sets `publishedAt` |
| `scheduled`, `published` | `unpublish` | `unpublished` | Clears schedule, preserves first publication timestamp |
| Any non-archived state | `archive` | `archived` | Clears schedule, preserves first publication timestamp |
| `archived` | `restore` | `draft` | Preserves first publication timestamp |

Clients cannot patch `status` directly. Every mutation requires the current positive `rowVersion`. All non-published states remain excluded from every public route and public count.

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

The sermon list accepts bounded title/slug search, state, speaker ID, series ID, inclusive service-date bounds, page, and page size. It returns state counts plus speaker/series summaries for the dashboard. `:kind` is `speakers`, `series`, or `books`.

## Validation and response safety

- Strict request schemas reject unknown fields, direct status edits, arbitrary postmeta, raw iframe/embed HTML, and uncontrolled extensions.
- Media writes accept only provider-matched YouTube video or SermonAudio audio URLs with controlled labels.
- Relationship UUIDs must exist; dashboard-edited scripture references are `curated` while immutable imported provenance remains separate and private.
- Relationship replacement, search refresh, slug dispositions, tombstone/audit writes, and deletion share the relevant transaction.
- Stale writes return `409 stale_write`; validation, authentication, authorization, conflict, and not-found errors use safe codes without database details.
- Normal admin responses exclude migration mappings, private source values, legacy metrics, embed configuration, internal warnings, credentials, and iframe HTML.
- Audit responses expose safe action metadata and controlled deletion tombstones, never request payloads or deleted content.

Public `/api/v1/sermons` behaviour remains unchanged and selects only non-deleted `published` records.

## Dashboard contract

The static Astro dashboard is served by the local Node harness at `/admin` only when `ENABLE_LOCAL_DASHBOARD=1`. It provides the application shell, state summary, searchable/filterable/paginated list, new/edit flows, relationship and safe-media editing, all explicit transitions, taxonomy screens, audit history, slug/URL preview, permanent-deletion dialogue, conflict feedback, and unsaved-change protection.

The shell is labelled local-development-only, sends no remote requests, receives `X-Robots-Tag: noindex`, and is served with restrictive content/security headers. Navigation, forms, dialogs, tables, live status feedback, visible focus, reduced-motion support, and mobile/tablet/desktop layouts use semantic accessible controls. The interface does not duplicate service authorization or lifecycle decisions.

## Controlled SEO administration

The dashboard displays the resulting title, slug, and expected canonical public sermon URL. It warns before changing a previously published slug. Slug mapping and deletion dispositions are explicit contract fields rather than WordPress-style postmeta.

The current schema still does not persist general SEO overrides. A future ordered migration and versioned contract may add only approved fields such as `seoTitle`, `seoDescription`, controlled social title/description, a managed social image, and managed image alt text. No role may add arbitrary meta names, raw `<head>` fragments, scripts, external canonicals, arbitrary JSON-LD, or unrestricted metadata. Indexability remains derived from route, environment, template, and publication state.
