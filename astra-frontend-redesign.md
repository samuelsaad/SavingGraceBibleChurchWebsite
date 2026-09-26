# Astra frontend alternative

This candidate lives on `codex/astra-frontend-redesign` and starts at Claude's completed `frontend-church-site` commit **6a51443d117cc9cb20e82f8d50046f77e7a4aa08**. Claude's branch and preview checkout remain unchanged. This is a comparison candidate, not a deployment or publication.

## Design direction

A photographic church journal: warm paper, deep forest green, clay accents, generous Georgia typography, and the church's existing photography and official logo. A monochrome typography-led direction and a blue gallery direction were considered; the photographic direction best supports both a welcoming first visit and extended reading.

The homepage combines a congregation photograph with the existing welcome and service information, a numbered beliefs introduction, a distinct visit section, recent sermons, a calendar ledger, the church introduction and the existing giving quotation. The navigation becomes a compact desktop header and an accessible mobile menu.

Church pages use layouts appropriate to their content: photographic introductions, a contents rail for long beliefs documents, portrait biographies, history rows, ministry image grids, practical contact and giving sections, and event/blog listings.

Sermon discovery puts the latest three messages first, followed by a native expandable Bible index with full horizontal book names. Search and combined filters remain ordinary GET forms. Sermon pages use a broad reading column, a details rail, and restrained typography. The complete description remains before media, transcript and ordered Q&A. The existing alternate sermon URLs remain available, but the primary navigation presents one sermon archive.

## Preserved foundations

- The complete church content registry, all 33 church pages (including four drafts and one private page), three blog posts, ten events, recurrence rules, calendar feed, original URLs and redirect/gone rules are unchanged.
- Church wording, biographies, beliefs, sermon wording, metadata and ordered Q&A are unchanged. All 45 existing images and the official logo remain available; no dependency or font download was added.
- Repository selectors, authentication, administration, database schema, publication states, acceptance evidence and private batch checkpoints are unchanged. No sermon was imported, exported, generated, approved or published.
- The authenticated preview reads the established restricted population: 148 eligible sermons. It does not grant eligibility to held or incomplete records.
- Safe escaping, server-rendered content, CSP hashing, no-store/noindex preview headers and click-to-load YouTube remain in place.

## Compare locally

- Astra: **http://127.0.0.1:4402/frontend-preview/**
- Astra session entry, when a browser needs a fresh preview session: **http://127.0.0.1:4402/admin/**, then **Frontend preview**.
- Existing Claude preview: **http://127.0.0.1:4396/**

The Astra preview is deliberately left running for comparison. Its local server uses the repository's existing `frontend-preview:local` mechanism, loopback host, port 4402 and `D162_RESTRICTED_ACCEPTANCE_ENABLED=1`. It requires the established protected local PostgreSQL authentication and read-only connection configuration. Build first so that the local admin session-entry page exists. It does not require a snapshot import.

The stricter `deployment/accepted-local.ts` launcher was not relaxed: the current local database has migration 0022 while that launcher on Claude's base expects 0021. The existing authenticated frontend preview verifies the PostgreSQL 16 loopback database identity and read-only transaction guard and uses the same eligible-content selector.

## Verification and limits

See the Astra entry in [migration-validation-plan.md](migration-validation-plan.md) for the final commands and evidence.

The inherited exact-optional-property TypeScript error in the snapshot CLI was corrected by omitting absent optional properties. The inherited Windows-only admin layout assertion was corrected by normalizing CRLF before comparing the same source strings. Neither change modifies runtime administrator or database behavior.

The original integration limits remain: Contact Form 7 has no mail transport, newsletter/social destinations are not configured, and third-party media/document links require their external services. No external media request, production connection, database write, hosting change or deployment was performed for this redesign.
