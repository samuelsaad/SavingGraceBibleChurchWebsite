# Bounded 36-sermon unknown-audio retry

**Status:** D-152 authorised; implementation must pass before source retrieval

Decision D-152 applies only to the existing ignored 36-record D-151 manifest whose canonical SHA-256 is `7e513f03cab908f30223753832211d2593ce4ffab15706ee851760385d9acb30`. The prior checkpoint is immutable and every ordered record must have ended specifically as `caption_primary_audio_unconfirmed`. The retry adds a distinct attempt bound to the D-152 governance commit and prior-checkpoint hash. It cannot accept another manifest, substitute a failed record or process a thirty-seventh identity.

The selector freshly verifies the requested video, verified church-channel ownership and caption-resource video identity. It considers only serving, non-draft English tracks whose kind is standard or ASR and whose audio type is primary or unknown. Standard has priority over ASR; multiple eligible tracks at the same priority are ambiguous. Commentary, descriptive, forced, wrong-language, draft, failed, unsupported-kind and unexpected-audio tracks remain ineligible.

An unknown-audio selection is not evidence of primary-audio association. Its private provenance must include:

```text
CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION
audio_track_type: unknown
primary_audio_confirmed: false
accepted_under_bounded_exception: true
```

Exact VTT bytes are downloaded with `tfmt=vtt` and no `tlang`, then kept only in ignored private storage. Usable captions may produce complete private unapproved transcripts and immediately grounded private unapproved descriptions and Q&A under the D-151/D-152 generation contract. Every result retains source, generator, manifest, governance, warning and output hashes; transcript changes make dependants stale. Nothing is approved, public, searchable, included in feeds/sitemaps/metadata/builds, or semantically eligible.

The retry is complete and expires after all 36 manifest positions receive one D-152 attempt, regardless of success. No authority remains for another record, retry, provider, publication, deployment, push, Related themes or Phase 3C.
