# Official YouTube pilot-caption proof

**Status:** Owner authentication and three-video metadata inspection verified; retrieval blocked because no track has an explicit primary-audio association

## Bounded purpose

This command-line proof uses only the official YouTube Data API v3 to inspect and retrieve existing caption tracks for the three accepted Phase 3B.2 pilot videos hard-coded in `src/youtube/pilot-caption-proof.ts`. It cannot accept a video ID argument. It does not scrape YouTube, process audio, transcribe speech, clean captions, generate sermon content, import data, approve content, publish, deploy or process an evaluation batch.

The commands are server-only local Node/TypeScript processes. They do not connect to MariaDB or PostgreSQL. API retries are disabled so an operator can see and assess each failure rather than create an uncontrolled request loop.

## Owner authentication

`npm run youtube:pilot-auth-local`:

1. Requires exactly one regular desktop OAuth JSON file in the protected ignored `youtube-oath/` directory.
2. Creates an ephemeral loopback callback on `127.0.0.1` and an OAuth state plus PKCE S256 challenge.
3. Opens Google's consent page with a fresh account chooser in the Windows system browser. The actual channel owner signs in and selects the church YouTube identity personally; the command never asks for or handles a password.
4. Requests only `https://www.googleapis.com/auth/youtube.force-ssl`, with consent and offline access.
5. Uses `videos.list` to derive one common owner channel from all three hard-coded pilot videos, then `channels.list` with `mine=true` to require the authenticated channel to be exactly that common owner with the expected church-channel title.
6. Retains the token only after those checks pass, at `%LOCALAPPDATA%\SavingGraceBibleChurch\youtube-oauth\token.json`. The token is outside the repository and is never printed. An existing regular token is reverified and is not overwritten.

The granted scope permits more YouTube operations than this proof needs because the official caption-download endpoint requires it. The implementation itself contains only `channels.list`, `videos.list`, `captions.list` and `captions.download`; it provides no YouTube write call.

## Inspection and retrieval

`npm run youtube:pilot-inspect-local` revalidates the stored channel identity and pilot ownership, calls `captions.list` with `part=snippet`, and reports safe track metadata without downloading caption bytes.

`npm run youtube:pilot-retrieve-local` repeats those validation and inspection gates. For each pilot it considers only serving, non-draft English tracks on the primary audio track. One standard track has priority over ASR. Two tracks at the same best priority produce an `ambiguous_track` result for that video; no eligible track produces `no_eligible_track`. A selected track is downloaded with `tfmt=vtt`, without `tlang` or machine translation.

The returned bytes must be valid UTF-8 WEBVTT with at least one non-empty readable cue. Valid bytes are saved exactly, without cleaning or rewriting, beneath the ignored private `phase-3b2-pilot/youtube-api-caption-proof/` directory. Files use create-only writes and content hashes; an identical rerun is non-mutating and a conflict fails closed. Adjacent private provenance records the approved identifiers and metadata, retrieval time, byte/cue/character/word counts, SHA-256 values, cue times, duration-coverage measures and safe comparison metrics. No caption wording is written to terminal output or tracked artifacts.

## Verified pilot result - 19 August 2026

Owner authentication succeeded only after the authenticated YouTube channel matched the single common owner channel of all three pilots. The subsequent official `captions.list` inspection returned exactly one track for each pilot. Each track was serving, non-draft, English and ASR, but the API reported its audio-track association as `unknown`, not `primary`.

The approved selection rule therefore produced `no_eligible_track` for all three pilots. There was no ambiguity, but the primary-audio requirement was not satisfied. The retrieval command was not run, `captions.download` was not called, no VTT or private provenance file was created, and no Studio export was read or compared. This observed result does not authorise treating `unknown` as `primary`; changing that rule requires a separate explicit decision.

## Private Studio-export comparison

The retrieval command resolves the three existing YouTube Studio exports only through the already approved ignored pilot manifest. It verifies video identity and records language/track-type agreement, successful VTT parsing, normalized word-sequence hashes, character/word/cue counts, first/final cue times and apparent duration coverage. Cue layout and byte formatting may differ. Any normalized wording difference is conservatively marked `retrieved_manual_review_required`; it is never silently accepted.

## Verification and stop boundary

Automated tests use only anonymised synthetic captions. They cover exact allowlisting, standard-over-ASR priority, ambiguity, absent and ineligible tracks, cross-video results, malformed and non-UTF-8 downloads, normalized wording agreement/difference, exact-byte preservation, idempotent reruns and source-level provider/content-exclusion guards.

This proof grants no authority to retrieve another video, process an evaluation batch, create transcript/description/Q&A content, run the embedding model, alter an approval, publish, deploy or begin Phase 3C.
