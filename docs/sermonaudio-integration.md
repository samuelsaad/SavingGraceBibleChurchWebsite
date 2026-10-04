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

The actual local inventory contains **311** sermons, of which **279** retain restricted-frontend eligibility. The read-only live WordPress source contains **464** sermon records, **432** with explicit valid single-sermon audio references. Exact WordPress joins cover **308** local records; the three historical local pilot identifiers are not treated as interchangeable with production WordPress identifiers. There are **156** source records outside those joins; no new sermons are created.

Local outcomes: **271 verified**, **25 unmatched in the inspected evidence**, **1 conflicting**, **14 unavailable**, and **0 ambiguous**. All 271 verified proposals are pending due to existing immutable media-review or acceptance dependencies. There are **0 already-correct structured SermonAudio links** and **0 newly attached links**. Wider catalogue access was unavailable through the public web interface, and the RSS feed covered 100 entries; these totals are not a claim that every recording in the full archive was inspected. The metadata-only, per-record report and earlier extraction/reconciliation versions remain private and ignored.

## Verification and rollback

Anonymized tests cover strict identities, exact source joins, ambiguity/conflicts, upload-date separation, controlled rendering, activation and CSP. Disposable PostgreSQL integration verifies transactionality, preserved content, single audit/provenance records, identical reruns, concurrent changes and protected dependencies. No real review is changed to demonstrate a save.

Browser verification at 1440 and 390 pixels confirmed zero initial external requests, keyboard activation, correct official recording/broadcaster metadata, responsive framing, no autoplay, fallback links and the retained YouTube control. Audio was not played or processed. The temporary verification browser and listener were closed.

Database rollback is unnecessary for this reconciliation because no application media writes were eligible. The full database fingerprint must remain unchanged. For a future permitted write, rollback must compare the current media and version with its receipt, preserve intervening edits and append compensating audit history rather than delete history. Application rollback uses the prior exact staging image and unchanged Compose configuration, with an app-only restart; never recreate a database or volume.

Official references: [single-sermon embed instructions](https://sermonaudiotips.com/embedding-singlesermon/), [embed editor](https://sermonaudiotips.com/embed-codes/), [church broadcaster](https://www.sermonaudio.com/broadcasters/savinggrace/), [API documentation](https://api.sermonaudio.com/v2/docs).
