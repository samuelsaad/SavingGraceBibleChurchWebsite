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
GET    /api/v1/admin/sermons/:id/review
PATCH  /api/v1/admin/sermons/:id/review/progress
POST   /api/v1/admin/sermons/:id/review/items/:itemId/decision
POST   /api/v1/admin/sermons/:id/review/finish
POST   /api/v1/admin/sermons/:id/primary-passage-decision
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

The sermon list accepts bounded title/slug search, state, sole speaker ID, series ID, inclusive service-date bounds, content issue, primary-passage coordinates/review state, page, and page size. Passage coordinates use numeric `passageBook`, `passageChapter`, `passageVerse` and optional `passageEndVerse`; dependencies, canonical chapter/verse bounds and range order are validated. Passage matching uses inclusive structured overlap across proposed and confirmed primary relationships. `passageReviewState` supports `proposed_passage`, `confirmed_passage`, `pending_review`, `no_primary_passage`, `no_proposal_detected` and `proposal_rejected`. `contentIssue` supports `complete`, `missing_speaker`, `missing_description`, `description_awaiting_review`, `missing_transcript`, `transcript_awaiting_review`, `insufficient_questions`, `questions_awaiting_review`, and `missing_media`. The response distinguishes passage state and display text per record while retaining state counts, sole-speaker/series summaries, readiness, and aggregate approved-description plus completed/remaining checklist counts. Each administrator summary/detail also returns nullable `youtubeSource: { videoId, canonicalUrl }`; the server supplies it only when all valid stored YouTube media/provenance candidates resolve to one identity. Invalid or conflicting candidates fail closed to null. `:kind` is `speakers`, `series`, or `books`.

## Validation and response safety

- Strict request schemas reject unknown fields, direct status edits, arbitrary postmeta, raw iframe/embed HTML, and uncontrolled extensions.
- `speakerId` is a single nullable UUID; speaker arrays/unknown multi-speaker fields are rejected.
- Sermon description, transcript and Q&A are plain text, bounded, status-controlled, provenance-aware, concurrency-protected and audited. Approved transitions stamp the verified administrator subject and time; generated/imported drafts never approve themselves. Description text changes require an explicit description status.
- Media writes accept only provider-matched YouTube video or SermonAudio audio URLs with controlled labels.
- YouTube media requires HTTPS and a supported `youtube.com`, mobile, short, embed or Shorts URL form. The stored/resolved 11-character video ID is canonical; playlist, tracking and timestamp parameters do not affect identity, and a supplied ID that conflicts with the URL is rejected.
- Relationship UUIDs must exist; dashboard-edited scripture references are `curated` while immutable imported provenance remains separate and private.
- A primary-passage decision requires current sermon and passage-review row versions. `confirm_passages` requires at least one structurally valid primary passage and exactly one lead; valid shapes are book only, book plus chapter, or book/chapter/verse range. Verses require their parent chapter. `reject_proposal` and `confirm_no_primary_passage` accept no passage payload. Pending review remains incomplete, while an attributed `confirm_no_primary_passage` decision is complete. Only the approved administrator can create reviewer identity/time and audit evidence. Viewing a proposal never confirms it.
- Relationship replacement, search refresh, slug dispositions, tombstone/audit writes, and deletion share the relevant transaction.
- Stale writes return `409 stale_write`; validation, authentication, authorization, conflict, and not-found errors use safe codes without database details.
- Normal admin responses exclude migration mappings, private source values, legacy metrics, embed configuration, internal warnings, credentials, and iframe HTML.
- Audit responses expose safe action metadata and controlled deletion tombstones, never request payloads or deleted content.

Public `/api/v1/sermons` selects only non-deleted `published` records. List responses may include the approved bounded `summary` but omit transcript/Q&A bodies. Published detail responses include approved summary, approved transcript and approved ordered Q&A only; unapproved content and provenance are absent. Detail includes controlled `seoDescription` only for server metadata selection.

## Dashboard contract

The static Astro dashboard is served by the local Node harness at `/admin` only when `ENABLE_LOCAL_DASHBOARD=1`. It opens with a visible anonymised-demonstration notice and aggregate completion progress. The general sermon editor retains the existing lifecycle and relationship controls for sermons without imported enrichment.

Imported enrichment drafts use `/admin/sermons/:id/review`, not the all-in-one lifecycle form. That route renders one of six stages at a time: identity/provenance, flagged items, transcript, description, ordered Q&A and final summary. Stage 2 normally shows unresolved items only and places the exact associated transcript paragraphs in a large editable field. Accepting leaves the transcript unchanged; correcting transactionally stores original/corrected wording and attribution, updates only the exact versioned association, preserves sibling decisions and advances to the next unresolved item. Resolved items are read-only history. The route stores progress for pause/resume, renders epoch dates blank/unresolved, collapses technical provenance by default, provides large responsive transcript/Q&A controls, and requires explicit actions. An unsaved-change warning precedes navigation. The route contains no submit, schedule, publish, archive or deletion action.

Prepared records also show a separate primary-preaching-passage panel in Stage 1. It identifies local-title proposal provenance, supports book-only, chapter-level and verse-range primary/supporting references, one lead passage, correction, rejection and explicit no-primary decisions. The no-primary control is labelled `No single primary passage / topical or multi-passage sermon`. These controls do not advance guided review, approve sermon content or publish a record.

Grounded description and Q&A references use the transcript's immutable grounding revision and exact content SHA-256. Transcript body or source-identity changes rotate the revision and make grounded artifacts stale. Approval metadata, generic sermon/transcript row versions, passage decisions, review timestamps and saves in another generated content area do not. Legacy row-version references are accepted only through migration-recorded compatibility evidence tied to the unchanged transcript hash and current immutable revision.

The dashboard displays the canonical administrator-only YouTube source action in the sermon table, ordinary edit/overview header, guided-review header, identity/provenance card and primary-passage panel. Links are HTTPS anchors with descriptive text, a visible external-link mark, `target="_blank"` and `rel="noopener noreferrer"`. The dashboard does not create an iframe, thumbnail, script, cookie-bearing preload or automatic provider request; public DTOs and pages are unchanged.

The administrator sermon list at `/admin/sermons` has dependent Bible-book, chapter, starting-verse and optional ending-verse controls, a passage-review-state selector and a passage-only clear action that preserves unrelated filters. Its Primary passage column labels proposed, confirmed, pending, no-primary, no-proposal and rejected states explicitly. List filtering may inspect proposals for editorial work, but only a separately attributed administrator decision can confirm a passage.

The shell is labelled local-development-only, sends no remote requests, receives `X-Robots-Tag: noindex`, and is served with restrictive content/security headers. Navigation, forms, dialogs, tables, live status feedback, visible focus, reduced-motion support, and mobile/tablet/desktop layouts use semantic accessible controls. The interface does not duplicate service authorization or lifecycle decisions.

## Controlled SEO administration

The dashboard displays the resulting title, slug, and expected canonical public sermon URL. It warns before changing a previously published slug. Slug mapping and deletion dispositions are explicit contract fields rather than WordPress-style postmeta.

Migration `0005` persists only the controlled optional `seoDescription` override. The approved visible description is the deterministic metadata/social fallback when the override is null. Future ordered migrations may add only approved fields such as `seoTitle`, controlled social title/description, a managed social image, and managed image alt text. No role may add arbitrary meta names, raw `<head>` fragments, scripts, external canonicals, arbitrary JSON-LD, or unrestricted metadata. Indexability remains derived from route, environment, template, and publication state.

## Phase 3B.2 private provenance review

Admin sermon detail may include a private `enrichmentSource` object when a draft came from the controlled caption pilot. It exposes only canonical video identity, caption language/track type, original filename, SHA-256, authorised-export attribution, aggregate source/cleaned counts, processing version/timestamps/duration, safe warning codes, unresolved marker identifiers, review estimate, and the fixed `required` human-accuracy state. It never appears in public API responses or search documents and never includes source caption text, credentials, cookies or tokens.

Migration `0007` provides private review progress and the now-superseded aggregate prompts. Migration `0008` adds the authoritative atomic item shape: deterministic identity, source record/category ordinal, private detail, supporting paragraph references, transcript hash/version expectation and individual decision concurrency. The exact expected count and ordered identity-set hash must match the stored rows; missing, extra, duplicate, reordered, pending or stale items block completion. Only the truthful `caption_error` and `name_or_scripture_reference` categories are used, and aggregate warnings never become decisions. Accepted or corrected resolves only that item; left-unresolved and rejected remain blockers. A full-transcript edit resets prior transcript-bound decisions to pending. The exact per-finding correction action instead advances all associations to the new transcript version without altering sibling decisions. Review completion still requires confirmed identity/date/provenance, resolved items, approved transcript/description/5–10 ordered Q&A, controlled media and a sermon that remains draft.

Viewing, navigation and saving never change approval. Each approval and review-item decision is a separate server-authorised action with optimistic concurrency and audit. The local pilot importer has no approval capability and never impersonates the administrator. Review source/items never appear in public APIs, public search or readiness content.
