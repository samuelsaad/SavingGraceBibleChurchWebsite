# Controlled SermonAudio linking and playback

This is a media integration, not enrichment, approval or publication. It preserves the church frontend and existing sermon layouts and selectors.

## Identity and source evidence

An individual recording uses a numeric SermonAudio identity (up to the official API's 24-character limit), a canonical `https://www.sermonaudio.com/sermons/<id>` link and the official audio-player path `https://embed.sermonaudio.com/player/a/<id>/`. Library, broadcaster-wide latest-sermon, foreign-host and contradictory identity URLs are rejected. Imported iframe strings are parsed as inert source evidence; scripts and multiple frames are rejected, and original markup never reaches the rendered page.

Matching starts with a preserved WordPress record identity and its explicit audio reference. Official recording metadata must confirm the church broadcaster, `savinggrace`, and corroborate the service date and title or speaker. The official broadcaster's church name, Westmeadows address and church website were independently checked. A repeated title, fuzzy title, upload date or typical speaker cannot create a mapping. Missing evidence, multiple IDs and contradictory evidence remain separate outcomes.

The official public RSS feed supplies a limited catalogue, not an exhaustive archive. Its publication timestamp is not assumed to be the preached date. The wider documented API requires a broadcaster API key; no borrowed key or access-control bypass is used.

## Playback and privacy

The existing media section retains YouTube and adds an audio consent panel only for a validated structured recording. An explicit, keyboard-accessible **Load audio player** action creates the responsive iframe. There is no iframe, preconnect, player request or autoplay before activation. The iframe has a descriptive title and keyboard focus; a normal **Listen on SermonAudio** link survives script or player failure. No audio/video is downloaded, stored, transcribed or processed by the application.

CSP permits only `https://embed.sermonaudio.com` as an additional frame origin, and only on documents containing actual controlled audio markup. Existing YouTube and unrelated CSP restrictions remain intact. Private cache and indexing protections are unchanged.

## Audited writes and preserved review dependencies

`applyVerifiedSermonAudioLink` is a transaction-owned metadata primitive, using the existing application audit mechanism. The caller must verify the authorized database and write gate. It checks the exact source identity, locks the sermon/media rows, compares the row version and complete prior media hash, and refuses to replace an existing different recording. A permitted addition preserves the existing media rows and stores the previous values, evidence hashes and mapping provenance in the existing private media-audit table. Identical reruns make no content, version, timestamp or audit changes.

**A verified mapping is not automatically an attachable mapping.** Existing human completion, accepted media/completion decisions and restricted acceptances bind the media dependency. Adding a row would invalidate their freshness. Such records remain pending in the private reconciliation report. This implementation does not rewrite immutable acceptance hashes, repeat substantive reviews, manufacture administrator approval or change any selector to make the new media visible. No new schema or migration is introduced.

Any later authority to refresh affected media evidence must use a separately guarded workflow that preserves history. Until then, a proposed mapping is not an active recording on the sermon page.

## Current reconciliation

## Authorized media-only follow-through

The 5 October authorization supplies the formerly missing media-refresh and
branch-history permissions. The ordinary `applyVerifiedSermonAudioLink` guard is
retained. The separate `applyReviewedSermonAudioLink` requires an affirmative,
bounded source/recording assessment, exact source/version/prior-media checks and
the same guarded caller-owned transaction. It appends, never rewrites, previous
media provenance, a truthful AI media assessment and immutable audit hashes.

Description/Q&A/transcript/identity/speaker/passage/finding evidence is unaffected
by a media-only write. Existing media/completion dependencies do change and their
old receipts remain historical. A replacement restricted receipt is possible only
when the complete original acceptance was current immediately before this change.
It binds the original receipt, old/new dependency and version, and the new media
review. Current dependency, version, status, publication timestamp and withdrawal
checks stay mandatory in the opt-in restricted selector. Missing/stale prior
acceptance leaves attachment separate from eligibility. No human review or audio
quality verification is claimed; no new content is generated.

Existing application-allowlisted `sermon_extensions` support these two versioned
receipts, so the task needs no database migration. Staging synchronization is
media-only for existing members, with preserved source evidence, atomic current
receipt refresh, recovery snapshots and an identical no-op verification pass.
The public/default selector, inventories, design and non-sermon pages are unchanged.

The actual local inventory contains **311** sermons, of which **279** retain restricted-frontend eligibility. The read-only live WordPress source contains **464** sermon records, **432** with explicit valid single-sermon audio references. Exact WordPress joins cover **308** local records; the three historical local pilot identifiers are not treated as interchangeable with production WordPress identifiers. There are **156** source records outside those joins; no new sermons are created.

Local outcomes: **271 verified**, **25 unmatched in the inspected evidence**, **1 conflicting**, **14 unavailable**, and **0 ambiguous**. All 271 verified proposals are pending due to existing immutable media-review or acceptance dependencies. There are **0 already-correct structured SermonAudio links** and **0 newly attached links**. Wider catalogue access was unavailable through the public web interface, and the RSS feed covered 100 entries; these totals are not a claim that every recording in the full archive was inspected. The metadata-only, per-record report and earlier extraction/reconciliation versions remain private and ignored.

## Verification and rollback

Anonymized tests cover strict identities, exact source joins, ambiguity/conflicts, upload-date separation, controlled rendering, activation and CSP. Disposable PostgreSQL integration verifies transactionality, preserved content, single audit/provenance records, identical reruns, concurrent changes and protected dependencies. No real review is changed to demonstrate a save.

Browser verification at 1440 and 390 pixels confirmed zero initial external requests, keyboard activation, correct official recording/broadcaster metadata, responsive framing, no autoplay, fallback links and the retained YouTube control. Audio was not played or processed. The temporary verification browser and listener were closed.

Database rollback is unnecessary for this reconciliation because no application media writes were eligible. The full database fingerprint must remain unchanged. For a future permitted write, rollback must compare the current media and version with its receipt, preserve intervening edits and append compensating audit history rather than delete history. Application rollback uses the prior exact staging image and unchanged Compose configuration, with an app-only restart; never recreate a database or volume.

Official references: [single-sermon embed instructions](https://sermonaudiotips.com/embedding-singlesermon/), [embed editor](https://sermonaudiotips.com/embed-codes/), [church broadcaster](https://www.sermonaudio.com/broadcasters/savinggrace/), [API documentation](https://api.sermonaudio.com/v2/docs).

## Verified staging rollout

Both visitor runtimes serve implementation commit
`78e4b904f6a8bc115e90d46001948912e1d245ee`, image
`sha256:08f447640c43460ac7f3cf7b801b86cfc5ce104ecc9c489711fe92bc5bb8fd78`.
The 212-path, committed dependency-closure package has SHA-256
`de27d17e42a9bbb9028adcccf1d84a0e5e75ec7e925978a7c64197d9e0a22868`.
It excludes datasets, private mappings, local configuration and credentials.
Pre-existing uncommitted V5 work was not shipped or committed.

The public database remains 191 sermons / 148 eligible; the protected database
remains 148 sermons / 148 eligible. Full table/sequence fingerprints matched
before deployment, during the successful app-only rollback, and after restoration.
No migration, scoped media write, data synchronization or publication change was
performed. Rollback configurations, the prior exact image and the guarded helper
are retained under the established release-directory convention. The helper's
`rollback` operation restores only the prior applications; `deploy` restores this
release. Both operations check readiness and unchanged databases/listeners.

Real local and staging page checks passed at 1440/390 pixels. Six church-page
HTML hashes match the prior release, eligible details retain YouTube and private
routes remain denied with no-store/noindex. Both staging APIs still report the
exact 148 eligible records. A first browser test used a nonexistent `/giving/`
path; inspection identified the actual giving route, and the corrected check
passed without changing any page or route.

Public staging remains <http://54.253.237.138:8080/sermons-v4/>. Protected visitor
staging remains on EC2 loopback 8082 via the existing pinned SSH mechanism.
There are no active SermonAudio-linked page URLs to claim: verified mappings are
still pending the preserved media-review boundary. The wider WordPress inventory
has 156 records outside the local joins, including 149 explicit audio references;
these were neither individually verified against the full catalogue nor imported.

GitHub publication is not completed. Current AGENTS.md confines dataset-bearing
history publication to the original project-sync branch; the requested integrated
branch is absent remotely. A separately recorded, narrowly scoped protected-file
exception is required before this existing history can be pushed. No alternate
branch, replacement history or private-data upload was used.
