import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSermonInputSchema,
  permanentlyDeleteSermonInputSchema,
  sermonTransitionInputSchema,
  taxonomyWriteInputSchema,
  updateSermonInputSchema
} from "../src/api/contracts/admin-sermons";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import type { ApplicationIdentity } from "../src/application/authorization";
import { ApplicationError } from "../src/application/errors";
import type { SermonStatus } from "../src/domain/sermon";
import { runMigrationDryRun } from "../src/migration/importer";
import { loadMigrationResult } from "../src/migration/postgres-loader";
import { legacySermonRecordSchema } from "../src/migration/types";
import { LocalTestIdentityProvider } from "../src/server/auth/local-test-identity-provider";
import { createApplicationApiRouter } from "../src/server/http/application-api-router";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";
const integration = enabled ? describe : describe.skip;

function disposableConnectionString(): string {
  if (process.env.ALLOW_LOCAL_DB_WRITE !== "1") {
    throw new Error("PostgreSQL integration tests require ALLOW_LOCAL_DB_WRITE=1");
  }
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
  const url = new URL(value);
  if (
    !new Set(["127.0.0.1", "localhost", "[::1]", "::1"]).has(url.hostname) ||
    url.port !== "5432" ||
    url.pathname.slice(1) !== "savinggrace_sermons_test"
  ) {
    throw new Error("Integration tests require savinggrace_sermons_test on loopback port 5432");
  }
  return value;
}

integration("disposable PostgreSQL Phase 3B application", () => {
  let pool: Pool;
  let up1: string;
  let down1: string;
  let up2: string;
  let down2: string;
  let up3: string;
  let down3: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: disposableConnectionString(), max: 4 });
    const identity = await pool.query<{
      server_16: boolean;
      loopback: boolean;
      port_5432: boolean;
      target_database: boolean;
      postgres_server: boolean;
    }>(
      `SELECT
         current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
         inet_server_addr() = '127.0.0.1'::inet AS loopback,
         inet_server_port() = 5432 AS port_5432,
         current_database() = 'savinggrace_sermons_test' AS target_database,
         version() LIKE 'PostgreSQL%' AS postgres_server`
    );
    expect(identity.rows[0]).toEqual({
      server_16: true,
      loopback: true,
      port_5432: true,
      target_database: true,
      postgres_server: true
    });

    [up1, down1, up2, down2, up3, down3] = await Promise.all([
      readFile("db/migrations/0001_initial.sql", "utf8"),
      readFile("db/migrations/0001_initial.down.sql", "utf8"),
      readFile("db/migrations/0002_admin_foundation.sql", "utf8"),
      readFile("db/migrations/0002_admin_foundation.down.sql", "utf8"),
      readFile("db/migrations/0003_single_admin_deletion_seo.sql", "utf8"),
      readFile("db/migrations/0003_single_admin_deletion_seo.down.sql", "utf8")
    ]);
    await pool.query(down3);
    await pool.query(down2);
    await pool.query(down1);
    await pool.query(up1);
    await pool.query(up2);
    await pool.query(up3);

    const fixture = legacySermonRecordSchema.array().parse(
      JSON.parse(await readFile("tests/fixtures/dry-run.json", "utf8"))
    );
    const transformed = runMigrationDryRun(fixture);
    await loadMigrationResult(pool, transformed, "anonymised-phase3b-fixture");
    await loadMigrationResult(pool, transformed, "anonymised-phase3b-fixture");
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(down3);
    const deltaRemoved = await pool.query<{ tombstone_removed: boolean; source_column_removed: boolean }>(
      `SELECT
         to_regclass('public.sermon_deletion_tombstones') IS NULL AS tombstone_removed,
         NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'redirects' AND column_name = 'source_sermon_id'
         ) AS source_column_removed`
    );
    expect(deltaRemoved.rows[0]).toEqual({ tombstone_removed: true, source_column_removed: true });
    await pool.query(up3);

    await pool.query(down3);
    await pool.query(down2);
    await pool.query(down1);
    await pool.query(up1);
    await pool.query(up2);
    await pool.query(up3);
    const reapplied = await pool.query<{ sermon: string | null; tombstone: string | null }>(
      `SELECT to_regclass('public.sermons')::text AS sermon,
              to_regclass('public.sermon_deletion_tombstones')::text AS tombstone`
    );
    expect(reapplied.rows[0]).toEqual({
      sermon: "sermons",
      tombstone: "sermon_deletion_tombstones"
    });
    await pool.query(down3);
    await pool.query(down2);
    await pool.query(down1);
    await pool.end();
  });

  it("applies 0001-0003 and loads anonymised fixtures idempotently", async () => {
    const counts = await pool.query<{
      sermons: number;
      views: number;
      unowned: number;
      tombstone_table: string | null;
      source_sermon_column: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM sermons) AS sermons,
         (SELECT count(*)::integer FROM sermon_legacy_metrics) AS views,
         (SELECT count(*)::integer FROM sermons WHERE created_by_subject IS NULL) AS unowned,
         to_regclass('public.sermon_deletion_tombstones')::text AS tombstone_table,
         (SELECT count(*)::integer FROM information_schema.columns
          WHERE table_name = 'redirects' AND column_name = 'source_sermon_id') AS source_sermon_column`
    );
    expect(counts.rows[0]).toEqual({
      sermons: 3,
      views: 3,
      unowned: 3,
      tombstone_table: "sermon_deletion_tombstones",
      source_sermon_column: 1
    });
  });

  it("preserves published-only public list, search, filters, pagination, and safe detail", async () => {
    const repository = new PostgresSermonRepository(pool);
    const page = await repository.listPublished(publicSermonListQuerySchema.parse({ pageSize: 1 }));
    expect(page).toMatchObject({ totalItems: 2 });
    expect(page.data).toHaveLength(1);

    const filtered = await repository.listPublished(
      publicSermonListQuerySchema.parse({
        query: "grace",
        speaker: "example-speaker",
        series: "example-series",
        passage: "romans-8-1-4",
        book: "romans",
        dateFrom: "2026-08-02",
        dateTo: "2026-08-02"
      })
    );
    expect(filtered.data.map((sermon) => sermon.slug)).toEqual([
      "grace-for-an-anonymised-congregation"
    ]);
    expect(
      await repository.listPublished(
        publicSermonListQuerySchema.parse({
          series: "example-series",
          speaker: "second-speaker"
        })
      )
    ).toMatchObject({ data: [], totalItems: 0 });

    expect(await repository.findPublishedBySlug("an-anonymised-pending-sermon")).toBeNull();
    const sermon = await repository.findPublishedBySlug(
      "grace-for-an-anonymised-congregation"
    );
    const json = JSON.stringify(sermon);
    expect(sermon?.media.map((media) => media.provider)).toEqual(["youtube", "sermonaudio"]);
    expect(json).not.toMatch(/<iframe|legacyViewCount|originalValue|source_wordpress/i);
  });

  it("supports admin filters, counts, every state transition, and transactional edits", async () => {
    const admin = { subject: "local-admin-0001", role: "admin" } satisfies ApplicationIdentity;
    const repository = new PostgresAdminSermonRepository(pool);
    const publicRepository = new PostgresSermonRepository(pool);
    const service = new AdminSermonService(repository, () => new Date("2026-08-05T00:00:00.000Z"));
    const taxonomyIds: string[] = [];
    const sermonIds: string[] = [];
    try {
      const speaker = await service.createTaxonomy(
        "speakers",
        taxonomyWriteInputSchema.parse({ name: "Phase 3B Speaker", slug: "phase-3b-speaker" }),
        admin,
        "phase3b-speaker"
      );
      const series = await service.createTaxonomy(
        "series",
        taxonomyWriteInputSchema.parse({ name: "Phase 3B Series", slug: "phase-3b-series" }),
        admin,
        "phase3b-series"
      );
      taxonomyIds.push(speaker.id, series.id);

      const created = await service.create(
        createSermonInputSchema.parse({
          title: "Phase 3B Controlled Sermon",
          slug: "phase-3b-controlled-sermon",
          serviceDate: "2026-08-05",
          speakerIds: [speaker.id],
          seriesIds: [series.id],
          scriptureReferences: [{ displayText: "Romans 8:1-4" }],
          media: [{
            provider: "youtube",
            mediaType: "video",
            externalId: null,
            canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
            title: "Controlled sermon video"
          }]
        }),
        admin,
        "phase3b-create"
      );
      sermonIds.push(created.id);
      expect(created).toMatchObject({ status: "draft" });
      expect(created).not.toHaveProperty("ownership");

      const list = await service.list(
        { query: "Controlled", speakerId: speaker.id, seriesId: series.id, page: 1, pageSize: 20 },
        admin
      ) as ListResponseShape;
      expect(list.data).toHaveLength(1);
      expect(list.countsByStatus.draft).toBeGreaterThanOrEqual(1);
      expect(list.data[0]?.speakers[0]?.name).toBe("Phase 3B Speaker");

      await expect(
        service.transition(
          created.id,
          "withdraw",
          sermonTransitionInputSchema.parse({ rowVersion: created.rowVersion }),
          admin,
          "phase3b-invalid-transition"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      await expect(
        service.transition(
          created.id,
          "schedule",
          sermonTransitionInputSchema.parse({ rowVersion: created.rowVersion, scheduledFor: "2026-08-04T00:00:00.000Z" }),
          admin,
          "phase3b-invalid-schedule"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

      const pending = await service.transition(created.id, "submit", { rowVersion: created.rowVersion }, admin, "phase3b-submit");
      const withdrawn = await service.transition(created.id, "withdraw", { rowVersion: pending.rowVersion }, admin, "phase3b-withdraw");
      const scheduled = await service.transition(
        created.id,
        "schedule",
        { rowVersion: withdrawn.rowVersion, scheduledFor: "2027-08-05T00:00:00.000Z" },
        admin,
        "phase3b-schedule"
      );
      const published = await service.transition(created.id, "publish", { rowVersion: scheduled.rowVersion }, admin, "phase3b-publish");
      expect(published.publishedAt).toBe("2026-08-05T00:00:00.000Z");
      expect((await publicRepository.findPublishedBySlug(published.slug))?.id).toBe(created.id);
      const unpublished = await service.transition(created.id, "unpublish", { rowVersion: published.rowVersion }, admin, "phase3b-unpublish");
      const archived = await service.transition(created.id, "archive", { rowVersion: unpublished.rowVersion }, admin, "phase3b-archive");
      const restored = await service.transition(created.id, "restore", { rowVersion: archived.rowVersion }, admin, "phase3b-restore");
      expect(restored).toMatchObject({ status: "draft", publishedAt: published.publishedAt });
      expect(await publicRepository.findPublishedBySlug(restored.slug)).toBeNull();

      const current = await service.update(
        created.id,
        updateSermonInputSchema.parse({ rowVersion: restored.rowVersion, summary: "Current edit" }),
        admin,
        "phase3b-current"
      );
      await expect(
        service.update(
          created.id,
          updateSermonInputSchema.parse({ rowVersion: restored.rowVersion, summary: "Stale edit" }),
          admin,
          "phase3b-stale"
        )
      ).rejects.toMatchObject({ status: 409, code: "stale_write" });

      await expect(
        service.update(
          created.id,
          updateSermonInputSchema.parse({
            rowVersion: current.rowVersion,
            title: "Must roll back",
            scriptureReferences: [{ displayText: "Invalid FK", canonicalBookId: 66 }]
          }),
          admin,
          "phase3b-rollback"
        )
      ).rejects.toBeInstanceOf(ApplicationError);
      expect((await service.detail(created.id, admin)).title).not.toBe("Must roll back");

      const importedId = (await pool.query<{ id: string }>("SELECT id FROM sermons WHERE source_wordpress_id = 9003")).rows[0]!.id;
      expect((await service.detail(importedId, admin)).id).toBe(importedId);
    } finally {
      await pool.query("DELETE FROM audit_events WHERE actor_subject = 'local-admin-0001'");
      if (sermonIds.length) await pool.query("DELETE FROM sermons WHERE id = ANY($1::uuid[])", [sermonIds]);
      if (taxonomyIds.length) {
        await pool.query("DELETE FROM speakers WHERE id = ANY($1::uuid[])", [taxonomyIds]);
        await pool.query("DELETE FROM series WHERE id = ANY($1::uuid[])", [taxonomyIds]);
      }
    }
  });

  it("records slug redirects and enforces permanent deletion safeguards with minimal tombstones", async () => {
    const admin = { subject: "local-admin-0001", role: "admin" } satisfies ApplicationIdentity;
    const repository = new PostgresAdminSermonRepository(pool);
    const service = new AdminSermonService(repository, () => new Date("2026-08-05T00:00:00.000Z"));
    const createdIds: string[] = [];
    try {
      const created = await service.create(
        createSermonInputSchema.parse({
          title: "Delete Safeguard Sermon",
          slug: "delete-safeguard-sermon",
          serviceDate: "2026-08-05",
          scriptureReferences: [{ displayText: "John 3:16" }],
          media: [{
            provider: "sermonaudio",
            mediaType: "audio",
            externalId: null,
            canonicalUrl: "https://www.sermonaudio.com/sermons/example",
            title: "Controlled audio"
          }]
        }),
        admin,
        "delete-create"
      );
      createdIds.push(created.id);
      const published = await service.transition(created.id, "publish", { rowVersion: created.rowVersion }, admin, "delete-publish");
      const renamed = await service.update(
        created.id,
        updateSermonInputSchema.parse({ rowVersion: published.rowVersion, slug: "delete-safeguard-renamed" }),
        admin,
        "delete-rename"
      );
      expect(
        (await pool.query("SELECT new_path, status_code FROM redirects WHERE old_path = '/sermons/delete-safeguard-sermon/'")).rows[0]
      ).toEqual({ new_path: "/sermons/delete-safeguard-renamed/", status_code: 301 });

      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: renamed.rowVersion, confirmation: renamed.slug, reason: "Incorrect state", seoDisposition: { kind: "gone" } }),
          admin,
          "delete-wrong-state"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

      const archived = await service.transition(created.id, "archive", { rowVersion: renamed.rowVersion }, admin, "delete-archive");
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: "wrong", reason: "Mismatch", seoDisposition: { kind: "gone" } }),
          admin,
          "delete-confirmation"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion - 1, confirmation: archived.slug, reason: "Stale", seoDisposition: { kind: "gone" } }),
          admin,
          "delete-stale"
        )
      ).rejects.toMatchObject({ status: 409, code: "stale_write" });
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: archived.slug, reason: "Missing disposition" }),
          admin,
          "delete-missing-seo"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: archived.slug, reason: "Invalid target", seoDisposition: { kind: "redirect", targetPath: "/sermons/not-a-published-target/" } }),
          admin,
          "delete-invalid-target"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

      const result = await service.permanentlyDelete(
        created.id,
        permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: archived.slug, reason: "Duplicate content retired", seoDisposition: { kind: "gone" } }),
        admin,
        "delete-success"
      );
      expect(result).toMatchObject({ deleted: true, formerSlug: "delete-safeguard-renamed", seoDisposition: { kind: "gone" } });
      createdIds.splice(createdIds.indexOf(created.id), 1);

      const dependent = await pool.query<{
        sermon: number;
        scripture: number;
        media: number;
        media_source: number;
        tombstone: number;
        audit: number;
      }>(
        `SELECT
           (SELECT count(*)::integer FROM sermons WHERE id = $1) AS sermon,
           (SELECT count(*)::integer FROM scripture_references WHERE sermon_id = $1) AS scripture,
           (SELECT count(*)::integer FROM sermon_media WHERE sermon_id = $1) AS media,
           (SELECT count(*)::integer FROM sermon_media_source_audit a JOIN sermon_media m ON m.id = a.sermon_media_id WHERE m.sermon_id = $1) AS media_source,
           (SELECT count(*)::integer FROM sermon_deletion_tombstones WHERE former_sermon_id = $1) AS tombstone,
           (SELECT count(*)::integer FROM audit_events WHERE entity_id = $1 AND action = 'sermon.permanent_delete') AS audit`,
        [created.id]
      );
      expect(dependent.rows[0]).toEqual({ sermon: 0, scripture: 0, media: 0, media_source: 0, tombstone: 1, audit: 1 });
      const dispositions = await pool.query("SELECT old_path, new_path, status_code FROM redirects WHERE source_sermon_id = $1 ORDER BY old_path", [created.id]);
      expect(dispositions.rows).toEqual([
        { old_path: "/sermons/delete-safeguard-renamed/", new_path: null, status_code: 410 },
        { old_path: "/sermons/delete-safeguard-sermon/", new_path: null, status_code: 410 }
      ]);
      const history = await service.auditHistory(admin);
      const tombstone = history.deletionTombstones.find((item) => item.formerSermonId === created.id);
      expect(tombstone).toMatchObject({ formerSlug: "delete-safeguard-renamed", reason: "Duplicate content retired", seoDisposition: "gone" });
      expect(JSON.stringify(tombstone)).not.toMatch(/body|media|iframe|originalValue|password|token|secret/i);
      expect((await service.listAudit(created.id, admin)).some((event) => event.action === "sermon.permanent_delete")).toBe(true);

      const neverPublished = await service.create(
        createSermonInputSchema.parse({ title: "Never Public", slug: "never-public", serviceDate: "2026-08-05" }),
        admin,
        "never-public-create"
      );
      const neverArchived = await service.transition(neverPublished.id, "archive", { rowVersion: neverPublished.rowVersion }, admin, "never-public-archive");
      await service.permanentlyDelete(
        neverPublished.id,
        permanentlyDeleteSermonInputSchema.parse({ rowVersion: neverArchived.rowVersion, confirmation: "Never Public", reason: "Draft entered in error" }),
        admin,
        "never-public-delete"
      );
      expect((await pool.query("SELECT count(*)::integer AS count FROM redirects WHERE source_sermon_id = $1", [neverPublished.id])).rows[0].count).toBe(0);

      const redirectSource = await service.create(
        createSermonInputSchema.parse({ title: "Redirect Retired Sermon", slug: "redirect-retired-sermon", serviceDate: "2026-08-05" }),
        admin,
        "redirect-delete-create"
      );
      const redirectPublished = await service.transition(redirectSource.id, "publish", { rowVersion: redirectSource.rowVersion }, admin, "redirect-delete-publish");
      const redirectArchived = await service.transition(redirectSource.id, "archive", { rowVersion: redirectPublished.rowVersion }, admin, "redirect-delete-archive");
      await service.permanentlyDelete(
        redirectSource.id,
        permanentlyDeleteSermonInputSchema.parse({
          rowVersion: redirectArchived.rowVersion,
          confirmation: redirectArchived.title,
          reason: "Consolidated with retained sermon",
          seoDisposition: {
            kind: "redirect",
            targetPath: "/sermons/grace-for-an-anonymised-congregation/"
          }
        }),
        admin,
        "redirect-delete-success"
      );
      expect(
        (await pool.query("SELECT new_path, status_code FROM redirects WHERE old_path = '/sermons/redirect-retired-sermon/'")).rows[0]
      ).toEqual({
        new_path: "/sermons/grace-for-an-anonymised-congregation/",
        status_code: 301
      });
    } finally {
      if (createdIds.length) await pool.query("DELETE FROM sermons WHERE id = ANY($1::uuid[])", [createdIds]);
      await pool.query("DELETE FROM redirects WHERE source_sermon_id IS NOT NULL");
      await pool.query("DELETE FROM sermon_deletion_tombstones");
      await pool.query("DELETE FROM audit_events WHERE actor_subject = 'local-admin-0001'");
    }
  });

  it("requires the one approved local admin on every admin route", async () => {
    const route = createApplicationApiRouter(
      new PostgresSermonRepository(pool),
      new PostgresAdminSermonRepository(pool),
      new LocalTestIdentityProvider(true, "development")
    );
    expect((await route(new Request("http://127.0.0.1/api/v1/admin/sermons"))).status).toBe(401);
    expect((await route(new Request("http://127.0.0.1/api/v1/admin/sermons", { headers: { "x-local-identity": "admin" } }))).status).toBe(200);
    for (const selector of ["editor", "contributor", "unknown"]) {
      expect((await route(new Request("http://127.0.0.1/api/v1/admin/sermons", { headers: { "x-local-identity": selector, "x-actor-role": "admin" } }))).status).toBe(401);
    }
    expect((await route(new Request("http://127.0.0.1/api/v1/admin/audit", { headers: { "x-local-identity": "admin" } }))).status).toBe(200);
  });
});

interface ListResponseShape {
  data: Array<{ speakers: RelationshipShape[] }>;
  countsByStatus: Record<SermonStatus, number>;
}

interface RelationshipShape {
  name: string;
}
