# Verified recording durations — D-177

This is metadata repair, not a content or eligibility task. Local writes are only
to PostgreSQL 16 at `127.0.0.1:5432/savinggrace_sermons_test`; scoped staging writes
are only to the verified existing staging database. Keep its current inventory.

## Evidence

The official [SermonAudio API](https://api.sermonaudio.com/v2/docs) exposes
`Sermon.audioDurationSeconds`; `Media.duration` is documented in seconds. Verify
the exact recording and church broadcaster and corroborate available audio media
renditions. Do not use `videoDurationSeconds`, text duration, timestamps or word
counts as audio duration. Positive safe integer seconds alone are persisted.
Conflicting positive values require investigation, not automatic replacement.

Retained official audio-player metadata may be reused where its existing exact
source match, broadcaster verification, parser version, page hash and retrieval
time remain intact. Reuse cached official YouTube video metadata only for that
same verified video; a video length is not relabelled as SermonAudio audio.
Earlier API captures did not record a separate metadata-request timestamp. Where
the subsequent transcript receipt supplies an upper bound, mark it explicitly as
`retained_transcript_receipt_upper_bound`, never an exact metadata retrieval time.
Preserve source bytes and cache history. No new YouTube access is authorized.

Only if verified caches lack metadata may the existing official SermonAudio
reader make metadata GET requests for mapped recordings; retain its serial spacing,
three-attempt temporary-failure limit and no retry on authentication failures.
No paid transcription, audio/video bytes or external generative provider is allowed.

## Persistence and display

Freeze identifiers, row versions and media hashes privately. Use serializable
transactions, application guards, optimistic concurrency and immutable audit
evidence. Identical replay must be unchanged. Never replace a different positive
duration silently. Preserve all sermon content and previous review decisions.
Refresh only currently valid acceptance dependencies affected by duration, with
truthful system attribution and no population expansion. Local-only completion
remains local; withdrawal/status/publication gates are unchanged.

The frontend carries a separate provider-bound duration, preferring a verified
SermonAudio audio row without overwriting the primary YouTube media selection.
Use `m:ss` below one hour and `h:mm:ss` thereafter. Missing values remain unknown.
Accessible labels identify the provider; each player displays its own duration.
Players remain deliberate-load and never autoplay.

## Delivery and recovery

Synchronize only existing destination records with matching stable source and
recording identities. Capture destination-specific versions and recovery evidence
before mutation; skip/report conflicts, never copy whole databases or accounts.
Both staging runtimes retain their current listener and privacy configuration.
Compensating metadata recovery must preserve new audit history, require the exact
unchanged post-state and refresh previously valid acceptance accordingly. Keep the
compatible image when old application code cannot interpret replacement receipts.

Only duration fields and necessary dataset file hashes may change in already
authorized curated exports. Snapshot imports confer no review authority. Run
anonymous unit/PostgreSQL tests, type/build checks, credential/private-content
scans and actual status-only browser checks without sermon screenshots.
