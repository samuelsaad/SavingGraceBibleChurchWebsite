# Modular website CMS delivery plan (D-179)

Samuel's 8 October brief authorizes the complete CMS, local migration, configured
staging delivery and normal GitHub push on codex/modular-admin-cms. Baseline
b259a16 preserves the integrated Astra/Claude site; unrelated dirty worktrees and
the separate one-sermon design proposal are not part of this delivery.

## Coverage

Migrate the homepage, 33 church pages, three posts, ten events, three venues,
global menus/contact/footer/branding and existing image references into PostgreSQL.
Preserve wording, addresses, current visibility and visual components. The exact
mapping is docs/cms-content-inventory.md. Add typed reusable modules with stable
IDs, enabled state and order; never copy sermon content into CMS records.

## Persistence and rendering

Immutable revisions have independent draft and published pointers, optimistic
version checks and audit. Restore appends a draft. Seed inserts absent stable
keys only. Request-scoped published snapshots feed all existing page, event,
calendar, sitemap and shared-shell renderers without rebuild or restart. Private
preview overlays only the selected revision. No global mutable content registry.
Uploads use existing asset metadata plus validated immutable persistent files,
with signature/size/path checks and reference-aware public access.

## Safety and delivery gates

Follow AGENTS.md D-179. Local writes require the normal explicit write gate and
verified PG16 loopback5432 target. The existing uniquely token-bound integration
runner alone may create/remove its test DB, never the application DB. Test empty
migration apply/down/reapply and identical reruns; populated down must refuse.
Capture scoped recovery and prove unrelated sermon/content/audit preservation.

Use existing pinned staging SSH configuration. Verify current target/image/schema
before any mutation. Deploy a checksum-aware compatible reader bridge before
migration27. Separate CMS writer privilege from read-only visitor access; protect
staging administration with secret-backed sessions over SSH-loopback, preserving
public admin denial. This is not church-owned production sign-in. Preserve
revisions and uploads in app rollback; never restore staging wholesale from local.

## Completion

Demonstrate actual dashboard text/image editing, add/reorder/disable/publish,
ordinary-page editing, event creation, navigation/footer editing, document upload
and attachment, and revision restore. Verify rendered results and restart
persistence, then restore demonstration edits. Run standard and zero-skip guarded
PostgreSQL tests, type/build, browser checks, importer dry run, offline audit and
outgoing scans. Review and commit only intended safe code/seed, push normally and
verify remote/staging commits. Record evidence and truthful limitations.
