# Official YouTube pilot-caption proof

**Status:** Three-pilot retrieval and independent comparison complete; two normalized exact matches and one private manual-review result

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

`npm run youtube:pilot-retrieve-local` repeats those validation and inspection gates. It ordinarily considers only serving, non-draft English tracks on the primary audio track. The bounded pilot-only amendment also permits an `unknown` audio association when the video has exactly one caption track in total and that sole track is serving, non-draft, English and either standard or ASR. This fallback records `audio_track_type_unverified` and `primaryAudioAssociationConfirmed: false`; it never claims that YouTube confirmed primary audio. Descriptive, dubbed, unexpected-audio, failed, draft, non-English and unsupported-kind tracks remain ineligible. One standard track has priority over ASR, and two tracks at the same best eligible priority produce an ambiguous result for that video.

The selected track is downloaded with `tfmt=vtt`, without `tlang` or machine translation. Exact returned bytes are preserved before parsing, without cleaning or rewriting, beneath the ignored private `phase-3b2-pilot/youtube-api-caption-proof/` directory. Files use create-only writes and content hashes; an identical rerun is non-mutating and a conflict fails closed. Valid comparison provenance records the approved identifiers and metadata, retrieval time, byte/cue/character/word counts, SHA-256 values, cue times, duration-coverage measures, audio-association warning and safe comparison metrics. No caption wording is written to terminal output or tracked artifacts.

## Initial inspection result - 19 August 2026

Owner authentication succeeded only after the authenticated YouTube channel matched the single common owner channel of all three pilots. The subsequent official `captions.list` inspection returned exactly one track for each pilot. Each track was serving, non-draft, English and ASR, but the API reported its audio-track association as `unknown`, not `primary`.

The approved selection rule therefore produced `no_eligible_track` for all three pilots. There was no ambiguity, but the primary-audio requirement was not satisfied. The retrieval command was not run, `captions.download` was not called, no VTT or private provenance file was created, and no Studio export was read or compared. This observed result does not authorise treating `unknown` as `primary`; changing that rule requires a separate explicit decision.

## Bounded amendment result - 19 August 2026

Samuel Saad explicitly authorised the sole-track `unknown` fallback for only these three pilots. Reinspection selected all three sole English, serving, non-draft ASR tracks with `audio_track_type_unverified`; no track was described as confirmed primary audio.

The first pilot's exact VTT bytes were downloaded without translation and retained in ignored private storage. A whitespace-only WEBVTT payload line initially exposed a parser defect; the corrected parser distinguishes true empty separators and preserves the provider bytes unchanged. YouTube's 2,457 contiguous rolling cues repeat suffix/prefix text across touching cue boundaries, so comparison version 2 collapses only exact rolling overlap when cues overlap or touch and retains repetition across any positive time gap.

After that segmentation-only normalization, the official sequence contained 7,262 words and the existing Studio export 7,265. The sequences did not match; they shared 45 leading and 158 trailing words. The result therefore remains substantive and requires manual review without exposing the differing wording. Retrieval stopped immediately. The other two pilots were not downloaded or compared, and this result grants no authority to relax the wording gate.

That stop was the outcome under the then-current rule. Samuel later explicitly superseded only the global stop-on-first-difference behavior: each of the same three pilots must receive its own retrieval/comparison outcome, while a difference or per-video failure remains isolated and unaccepted. Authentication/channel/credential, exact allowlist and private-storage safety failures still stop the whole command.

## Independent completion result - 19 August 2026

Comparison version 3 applies one identical normalization to both sources: Unicode NFKC, locale-stable lowercase, whitespace tokenization and removal of Unicode punctuation/symbol separators within each token. Exact rolling suffix/prefix repetition is first removed only across VTT cues that overlap or touch. A deterministic Hirschberg global sequence alignment using unit-cost Levenshtein match/substitution/insertion/deletion scoring then compares the complete normalized sequences in linear memory. Common prefix/suffix counts are secondary diagnostics, not the comparison method.

All three exact API VTT responses were retained privately without `tlang`, translation, cleaning or rewriting. Each selected track remained the sole English, serving, non-draft ASR track and retained `audio_track_type_unverified`; primary-audio association remains unconfirmed.

| Pilot video | Exact-byte SHA-256 | Bytes | Cues | Official / Studio words | Matches | Insertions / deletions / substitutions | Total changes | Difference regions / largest | WER | Similarity | Outcome |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `RAMFOAOWwMA` | `7cd423358ba102e39d0b7fcb1ee9eba3fa43a7b506eeb573d106f15270672a87` | 376,576 | 2,457 | 7,260 / 7,263 | 7,182 | 28 / 31 / 50 | 109 | 87 / 3 | 1.500757% | 98.499243% | `differences_detected_manual_review_required` |
| `--U52ZfBC48` | `ae8913ad5e0c06a7b271930d9e507583a5b1dc1ba5652b3decaea48796e9efe0` | 262,406 | 1,525 | 5,402 / 5,402 | 5,402 | 0 / 0 / 0 | 0 | 0 / 0 | 0% | 100% | `normalized_exact_match` |
| `H2-Rh_w8Dfg` | `22537246455bc37fd8e25c4935169103c5bac823617f422d932a31eb3d10780b` | 279,077 | 1,591 | 5,685 / 5,685 | 5,685 | 0 / 0 / 0 | 0 | 0 / 0 | 0% | 100% | `normalized_exact_match` |

The first result contains 45 common leading and 158 common trailing normalized words. Its 87 aligned difference passages and official cue-time references exist only in one ignored private human-review artifact. No differing wording entered terminal output, tests, documentation or Git. The tool does not decide whether those normalized changes are acceptable or which source is correct; a human must review them. Exact normalization for the other two is comparison evidence, not approval of their caption wording.

## Private Studio-export comparison

The retrieval command resolves the three existing YouTube Studio exports only through the already approved ignored pilot manifest. It verifies video identity and records language/track-type agreement, successful VTT parsing, normalized word-sequence hashes, character/word/cue counts, first/final cue times and apparent duration coverage. Cue layout and byte formatting may differ. Outcomes are restricted to `normalized_exact_match`, `differences_detected_manual_review_required` and `comparison_unavailable`. Each non-exact result creates an ignored private artifact containing the aligned passages and cue references needed for human review. No result automatically accepts either source.

## Verification and stop boundary

Automated tests use only anonymised synthetic captions. They cover exact allowlisting, standard-over-ASR priority, ambiguity, the sole-track unknown-audio warning, descriptive and multi-track-unknown rejection, cross-video results, malformed and non-UTF-8 downloads, optional WEBVTT headers, whitespace-only payload lines, rolling-cue normalization, positive-gap repetition, Unicode/case/punctuation/whitespace normalization, early isolated changes, insertion/deletion/substitution accounting, multiple difference regions, exact agreement, private review-artifact isolation and idempotence, independent continuation after a per-video failure, exact-byte preservation and source-level provider/content-exclusion guards.

This proof grants no authority to retrieve another video, process an evaluation batch, create transcript/description/Q&A content, run the embedding model, alter an approval, publish, deploy or begin Phase 3C.
