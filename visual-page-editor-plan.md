# Visual page editor delivery — D-180

The 9 October brief selects direct editing on the actual website, with a compact
toolbar and contextual inspector. This is an Operate-mode extension of the
existing mineral-blue/Vera admin system. The website design and real frontend
components remain authoritative. No concept choice or redesign is pending.

## Experience

Opening a CMS page defaults to the real server-rendered canvas; advanced forms
remain available explicitly. Click selects real content, double-click edits text,
and the inspector changes images, links and supported layout fields. Global
header/footer/navigation controls are visibly identified as shared. Editing
intercepts navigation/playback; Preview restores normal interaction.

The canvas occupies most of the desktop viewport. A compact, sticky toolbar
contains page selection, device sizes, save state, undo/redo, preview and a named
publication destination. A restrained inspector occupies the right edge; it becomes
an accessible drawer on small screens. Selection and insertion cues use the
existing copper accent. No decorative dashboard cards or new design system.

## Implementation and persistence

Use existing CMS APIs, optimistic versions, immutable revisions, safe rich text and
persistent assets. Authenticated/CSRF-protected render requests validate actual
content against the entity kind and render an isolated overlay of one draft over
the published snapshot. Short-lived opaque frame URLs are session-bound and
bounded. Never persist preview payloads or allow arbitrary HTML/CSS.

Optional validated presentation settings preserve existing omitted defaults.
Sermon collections keep the existing eligible repository and remain read-only
content references. Global edits still operate through the settings revision.
Undo/redo and removal recovery are editor history; saved drafts/history remain
PostgreSQL-backed. Publishing identifies and publishes the saved revision only.

## Delivery and evidence

Worktree/branch codex/visual-page-editor starts at d3a2a8a. Preserve all other
worktrees. Run focused unit/API/render checks, full standard and guarded zero-skip
PostgreSQL suites, type/Astro checks, builds, dry run, offline audit and outgoing
privacy scans. Demonstrate all nine requested browser flows plus restart, draft
isolation, conflict handling, actual drag and keyboard movement. Restore original
published demonstration records without deleting history.

Use existing staging packaging and pinned SSH with a bounded CMS-upgrade operator,
reusing its schema, credentials, roles and durable assets. Freeze recovery and
verify canary/deploy/rollback/reactivation and unchanged unrelated data. Push
normally to the existing repository; verify remote and deployed commits.

Production configuration audit must identify the actual runtime, admin identity,
HTTPS origin, guarded database and durable assets. Canonical SEO URLs are not a
deployment destination. Finish local/staging even when that connection is absent,
and report it precisely without claiming a production publication.
