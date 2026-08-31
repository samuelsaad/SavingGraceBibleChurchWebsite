import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Pool, PoolClient } from "pg";
import {
  assertDisposableIntegrationTestDatabase,
  assertDisposableLocalDatabase
} from "./local-database-safety";

const schemaMigrationLockKeys: [number, number] = [1_397_176_899, 1_397_111_885];
const journalTableName = "schema_migrations";

export type SchemaMigrationDirection = "apply" | "rollback";
export type SchemaMigrationScope =
  | "all"
  | "0003_single_admin_deletion_seo"
  | "0004_sermon_enrichment_readiness"
  | "0005_approved_sermon_descriptions"
  | "0006_phase3b2_pilot_provenance"
  | "0007_guided_sermon_review"
  | "0008_atomic_sermon_review_items"
  | "0009_pilot_completion_safeguards"
  | "0010_zero_finding_guided_review"
  | "0011_description_semantic_relationships"
  | "0012_description_semantic_runtime_provenance"
  | "0013_official_youtube_caption_provenance"
  | "0014_primary_preaching_passages"
  | "0015_optional_passage_and_grounding_identity";

interface SchemaMigrationDefinition {
  id: string;
  order: number;
  upPath: string;
  downPath: string;
  addedRelations: readonly string[];
  removedRelations?: readonly string[];
  addedFunctions?: readonly string[];
  removedFunctions?: readonly string[];
  addedTriggers?: readonly string[];
  removedTriggers?: readonly string[];
}

export interface LoadedSchemaMigration extends SchemaMigrationDefinition {
  checksumSha256: string;
  upBody: string;
  downBody: string;
}

export interface SchemaMigrationJournalRow {
  migration_order: number;
  migration_id: string;
  checksum_sha256: string;
  applied_at?: Date | string;
}

export interface SchemaMigrationRunResult {
  direction: SchemaMigrationDirection;
  outcome: "applied" | "rolled_back" | "no_op";
  appliedMigrationIds: string[];
  rolledBackMigrationIds: string[];
  journalReceiptCount: number;
}

export class SchemaMigrationError extends Error {
  constructor(
    public readonly code:
      | "database_verification_failure"
      | "journal_shape_failure"
      | "journal_state_failure"
      | "migration_checksum_mismatch"
      | "schema_drift_failure"
      | "migration_transaction_failure",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "SchemaMigrationError";
  }
}

export const schemaMigrationDefinitions: readonly SchemaMigrationDefinition[] = [
  {
    id: "0001_initial",
    order: 1,
    upPath: "db/migrations/0001_initial.sql",
    downPath: "db/migrations/0001_initial.down.sql",
    addedRelations: [
      "media_assets",
      "sermons",
      "sermon_legacy_metrics",
      "speakers",
      "series",
      "bible_books",
      "book_classifications",
      "source_taxonomy_terms",
      "sermon_speakers",
      "sermon_series_map",
      "sermon_book_classifications",
      "sermon_source_terms",
      "scripture_references",
      "scripture_reference_sources",
      "sermon_media",
      "sermon_media_source_audit",
      "sermon_resources",
      "sermon_extensions",
      "migration_runs",
      "migration_records",
      "migration_warnings",
      "redirects",
      "audit_events"
    ]
  },
  {
    id: "0002_admin_foundation",
    order: 2,
    upPath: "db/migrations/0002_admin_foundation.sql",
    downPath: "db/migrations/0002_admin_foundation.down.sql",
    addedRelations: []
  },
  {
    id: "0003_single_admin_deletion_seo",
    order: 3,
    upPath: "db/migrations/0003_single_admin_deletion_seo.sql",
    downPath: "db/migrations/0003_single_admin_deletion_seo.down.sql",
    addedRelations: ["sermon_deletion_tombstones"]
  },
  {
    id: "0004_sermon_enrichment_readiness",
    order: 4,
    upPath: "db/migrations/0004_sermon_enrichment_readiness.sql",
    downPath: "db/migrations/0004_sermon_enrichment_readiness.down.sql",
    addedRelations: [
      "sermon_transcripts",
      "sermon_question_answers",
      "sermon_enrichment_draft_imports",
      "sermon_content_readiness"
    ],
    removedRelations: ["sermon_speakers"],
    addedFunctions: [
      "refresh_sermon_enrichment(uuid)",
      "refresh_sermon_enrichment_from_child()"
    ],
    addedTriggers: [
      "sermon_question_answers_refresh_enrichment",
      "sermon_transcripts_refresh_enrichment"
    ]
  },
  {
    id: "0005_approved_sermon_descriptions",
    order: 5,
    upPath: "db/migrations/0005_approved_sermon_descriptions.sql",
    downPath: "db/migrations/0005_approved_sermon_descriptions.down.sql",
    addedRelations: [],
    addedFunctions: ["refresh_sermon_enrichment_from_sermon()"],
    addedTriggers: ["sermons_refresh_description_enrichment"]
  },
  {
    id: "0006_phase3b2_pilot_provenance",
    order: 6,
    upPath: "db/migrations/0006_phase3b2_pilot_provenance.sql",
    downPath: "db/migrations/0006_phase3b2_pilot_provenance.down.sql",
    addedRelations: ["sermon_enrichment_sources"]
  },
  {
    id: "0007_guided_sermon_review",
    order: 7,
    upPath: "db/migrations/0007_guided_sermon_review.sql",
    downPath: "db/migrations/0007_guided_sermon_review.down.sql",
    addedRelations: [
      "sermon_enrichment_reviews",
      "sermon_enrichment_review_items"
    ],
    addedFunctions: [
      "seed_sermon_enrichment_review(uuid)",
      "seed_sermon_enrichment_review_from_source()"
    ],
    addedTriggers: [
      "sermon_enrichment_sources_seed_review",
      "sermon_transcripts_seed_enrichment_review"
    ]
  },
  {
    id: "0008_atomic_sermon_review_items",
    order: 8,
    upPath: "db/migrations/0008_atomic_sermon_review_items.sql",
    downPath: "db/migrations/0008_atomic_sermon_review_items.down.sql",
    addedRelations: []
  },
  {
    id: "0009_pilot_completion_safeguards",
    order: 9,
    upPath: "db/migrations/0009_pilot_completion_safeguards.sql",
    downPath: "db/migrations/0009_pilot_completion_safeguards.down.sql",
    addedRelations: [],
    addedFunctions: ["protect_audit_events_append_only()"],
    addedTriggers: ["audit_events_append_only_for_application"]
  },
  {
    id: "0010_zero_finding_guided_review",
    order: 10,
    upPath: "db/migrations/0010_zero_finding_guided_review.sql",
    downPath: "db/migrations/0010_zero_finding_guided_review.down.sql",
    addedRelations: []
  },
  {
    id: "0011_description_semantic_relationships",
    order: 11,
    upPath: "db/migrations/0011_description_semantic_relationships.sql",
    downPath: "db/migrations/0011_description_semantic_relationships.down.sql",
    addedRelations: [
      "sermon_description_semantic_eligibility",
      "description_semantic_builds",
      "description_semantic_relationships"
    ],
    addedFunctions: ["remove_stale_description_semantic_relationships()"],
    addedTriggers: ["sermons_remove_stale_description_semantics"]
  },
  {
    id: "0012_description_semantic_runtime_provenance",
    order: 12,
    upPath: "db/migrations/0012_description_semantic_runtime_provenance.sql",
    downPath: "db/migrations/0012_description_semantic_runtime_provenance.down.sql",
    addedRelations: []
  },
  {
    id: "0013_official_youtube_caption_provenance",
    order: 13,
    upPath: "db/migrations/0013_official_youtube_caption_provenance.sql",
    downPath: "db/migrations/0013_official_youtube_caption_provenance.down.sql",
    addedRelations: []
  },
  {
    id: "0014_primary_preaching_passages",
    order: 14,
    upPath: "db/migrations/0014_primary_preaching_passages.sql",
    downPath: "db/migrations/0014_primary_preaching_passages.down.sql",
    addedRelations: ["sermon_primary_passage_reviews"],
    addedFunctions: ["enforce_primary_passage_review_consistency()"],
    addedTriggers: [
      "scripture_references_primary_review_consistency",
      "sermon_primary_passage_reviews_consistency"
    ]
  },
  {
    id: "0015_optional_passage_and_grounding_identity",
    order: 15,
    upPath: "db/migrations/0015_optional_passage_and_grounding_identity.sql",
    downPath: "db/migrations/0015_optional_passage_and_grounding_identity.down.sql",
    addedRelations: ["sermon_transcript_legacy_grounding_bindings"],
    addedFunctions: ["rotate_sermon_transcript_grounding_revision()"],
    addedTriggers: ["sermon_transcripts_rotate_grounding_revision"]
  }
] as const;

export function normalizeMigrationSql(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n*$/, "\n");
}

export function schemaMigrationChecksum(upSql: string, downSql: string): string {
  const definition = [
    "saving-grace-schema-migration-v1",
    "-- up",
    normalizeMigrationSql(upSql),
    "-- down",
    normalizeMigrationSql(downSql)
  ].join("\n");
  return createHash("sha256").update(definition, "utf8").digest("hex");
}

function transactionBody(value: string, label: string): string {
  const normalized = normalizeMigrationSql(value);
  const match = normalized.match(/^\s*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/i);
  if (!match) {
    throw new SchemaMigrationError(
      "journal_state_failure",
      `${label} must contain one explicit outer BEGIN/COMMIT transaction.`
    );
  }
  return match[1]!.trim();
}

export async function loadSchemaMigrations(): Promise<LoadedSchemaMigration[]> {
  return Promise.all(schemaMigrationDefinitions.map(async (definition) => {
    const [upSql, downSql] = await Promise.all([
      readFile(definition.upPath, "utf8"),
      readFile(definition.downPath, "utf8")
    ]);
    return {
      ...definition,
      checksumSha256: schemaMigrationChecksum(upSql, downSql),
      upBody: transactionBody(upSql, definition.upPath),
      downBody: transactionBody(downSql, definition.downPath)
    };
  }));
}

export function validateSchemaMigrationJournal(
  migrations: readonly LoadedSchemaMigration[],
  rows: readonly SchemaMigrationJournalRow[]
): number {
  const orders = new Set<number>();
  const identities = new Set<string>();
  for (const row of rows) {
    if (orders.has(row.migration_order) || identities.has(row.migration_id)) {
      throw new SchemaMigrationError(
        "journal_state_failure",
        "The schema-migration journal contains duplicate identities or orders."
      );
    }
    orders.add(row.migration_order);
    identities.add(row.migration_id);
  }
  if (rows.length > migrations.length) {
    throw new SchemaMigrationError(
      "journal_state_failure",
      "The schema-migration journal contains unknown migration receipts."
    );
  }
  const ordered = [...rows].sort((left, right) => left.migration_order - right.migration_order);
  for (const [index, row] of ordered.entries()) {
    const expected = migrations[index];
    if (!expected || row.migration_order !== expected.order || row.migration_id !== expected.id) {
      throw new SchemaMigrationError(
        "journal_state_failure",
        "The schema-migration journal is not an exact canonical migration prefix."
      );
    }
    if (row.checksum_sha256 !== expected.checksumSha256) {
      throw new SchemaMigrationError(
        "migration_checksum_mismatch",
        `The applied schema migration ${expected.id} no longer matches its trusted checksum.`
      );
    }
  }
  return ordered.length;
}

function expectedObjects(
  migrations: readonly LoadedSchemaMigration[],
  appliedCount: number
): { relations: Set<string>; functions: Set<string>; triggers: Set<string> } {
  const relations = new Set<string>([journalTableName]);
  const functions = new Set<string>();
  const triggers = new Set<string>();
  for (const migration of migrations.slice(0, appliedCount)) {
    migration.removedRelations?.forEach((name) => relations.delete(name));
    migration.addedRelations.forEach((name) => relations.add(name));
    migration.removedFunctions?.forEach((name) => functions.delete(name));
    migration.addedFunctions?.forEach((name) => functions.add(name));
    migration.removedTriggers?.forEach((name) => triggers.delete(name));
    migration.addedTriggers?.forEach((name) => triggers.add(name));
  }
  return { relations, functions, triggers };
}

function equalSets(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

async function currentApplicationObjects(client: PoolClient): Promise<{
  relations: Set<string>;
  functions: Set<string>;
  triggers: Set<string>;
}> {
  const relations = await client.query<{ name: string }>(
      `SELECT relation.relname AS name
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = 'public'
         AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
       ORDER BY relation.relname`
    );
  const functions = await client.query<{ name: string }>(
      `SELECT procedure.proname || '(' || oidvectortypes(procedure.proargtypes) || ')' AS name
       FROM pg_proc procedure
       JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = 'public'
         AND NOT EXISTS (
           SELECT 1
           FROM pg_depend dependency
           WHERE dependency.classid = 'pg_proc'::regclass
             AND dependency.objid = procedure.oid
             AND dependency.deptype = 'e'
         )
       ORDER BY name`
    );
  const triggers = await client.query<{ name: string }>(
      `SELECT trigger.tgname AS name
       FROM pg_trigger trigger
       JOIN pg_class relation ON relation.oid = trigger.tgrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = 'public' AND NOT trigger.tgisinternal
       ORDER BY trigger.tgname`
    );
  return {
    relations: new Set(relations.rows.map((row) => row.name)),
    functions: new Set(functions.rows.map((row) => row.name)),
    triggers: new Set(triggers.rows.map((row) => row.name))
  };
}

async function verifyExpectedSchemaState(
  client: PoolClient,
  migrations: readonly LoadedSchemaMigration[],
  appliedCount: number
): Promise<void> {
  const expected = expectedObjects(migrations, appliedCount);
  const actual = await currentApplicationObjects(client);
  if (
    !equalSets(expected.relations, actual.relations) ||
    !equalSets(expected.functions, actual.functions) ||
    !equalSets(expected.triggers, actual.triggers)
  ) {
    throw new SchemaMigrationError(
      "schema_drift_failure",
      "The public application schema does not exactly match its trusted migration receipts."
    );
  }
}

async function verifyDatabaseIdentity(client: PoolClient, expectedDatabaseName: string): Promise<void> {
  const result = await client.query<{
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
       current_database() = $1 AS target_database,
       version() LIKE 'PostgreSQL%' AS postgres_server`,
    [expectedDatabaseName]
  );
  if (!Object.values(result.rows[0] ?? {}).every(Boolean)) {
    throw new SchemaMigrationError(
      "database_verification_failure",
      "The PostgreSQL schema runner refused an unverified disposable database target."
    );
  }
}

async function journalExists(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ present: boolean }>(
    "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present"
  );
  return result.rows[0]?.present === true;
}

async function bootstrapJournal(client: PoolClient): Promise<void> {
  if (await journalExists(client)) return;
  const objects = await currentApplicationObjects(client);
  if (objects.relations.size || objects.functions.size || objects.triggers.size) {
    throw new SchemaMigrationError(
      "schema_drift_failure",
      "Application objects exist without a trusted schema-migration journal; automatic baselining is forbidden."
    );
  }
  await client.query("BEGIN");
  try {
    await client.query(
      `CREATE TABLE public.schema_migrations (
         migration_order integer NOT NULL,
         migration_id text NOT NULL,
         checksum_sha256 text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
         CONSTRAINT schema_migrations_pkey PRIMARY KEY (migration_order),
         CONSTRAINT schema_migrations_identity_unique UNIQUE (migration_id),
         CONSTRAINT schema_migrations_order_positive_check CHECK (migration_order > 0),
         CONSTRAINT schema_migrations_identity_check
           CHECK (migration_id ~ '^[0-9]{4}_[a-z0-9_]+$'),
         CONSTRAINT schema_migrations_checksum_check
           CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
       )`
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new SchemaMigrationError(
      "migration_transaction_failure",
      "The schema-migration journal could not be bootstrapped transactionally.",
      { cause: error }
    );
  }
}

async function verifyJournalShape(client: PoolClient): Promise<void> {
  const columns = await client.query<{
    name: string;
    type: string;
    not_null: boolean;
    default_expression: string | null;
  }>(
      `SELECT attribute.attname AS name,
              format_type(attribute.atttypid, attribute.atttypmod) AS type,
              attribute.attnotnull AS not_null,
              pg_get_expr(default_value.adbin, default_value.adrelid) AS default_expression
       FROM pg_attribute attribute
       JOIN pg_class relation ON relation.oid = attribute.attrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       LEFT JOIN pg_attrdef default_value
         ON default_value.adrelid = relation.oid AND default_value.adnum = attribute.attnum
       WHERE namespace.nspname = 'public' AND relation.relname = 'schema_migrations'
         AND relation.relkind = 'r' AND attribute.attnum > 0 AND NOT attribute.attisdropped
       ORDER BY attribute.attnum`
    );
  const constraints = await client.query<{ name: string; type: string }>(
      `SELECT catalog_constraint.conname AS name, catalog_constraint.contype AS type
       FROM pg_constraint catalog_constraint
       JOIN pg_class relation ON relation.oid = catalog_constraint.conrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       WHERE namespace.nspname = 'public' AND relation.relname = 'schema_migrations'
       ORDER BY catalog_constraint.conname`
    );
  const expectedColumns = [
    { name: "migration_order", type: "integer", not_null: true },
    { name: "migration_id", type: "text", not_null: true },
    { name: "checksum_sha256", type: "text", not_null: true },
    { name: "applied_at", type: "timestamp with time zone", not_null: true }
  ];
  const shapeMatches = columns.rows.length === expectedColumns.length && expectedColumns.every(
    (expected, index) => {
      const actual = columns.rows[index];
      return actual?.name === expected.name && actual.type === expected.type && actual.not_null === expected.not_null;
    }
  );
  const expectedConstraints = new Map([
    ["schema_migrations_checksum_check", "c"],
    ["schema_migrations_identity_check", "c"],
    ["schema_migrations_identity_unique", "u"],
    ["schema_migrations_order_positive_check", "c"],
    ["schema_migrations_pkey", "p"]
  ]);
  const constraintsMatch = constraints.rows.length === expectedConstraints.size && constraints.rows.every(
    (row) => expectedConstraints.get(row.name) === row.type
  );
  const timestampDefaultMatches = columns.rows.find((row) => row.name === "applied_at")
    ?.default_expression?.includes("clock_timestamp()") === true;
  if (!shapeMatches || !constraintsMatch || !timestampDefaultMatches) {
    throw new SchemaMigrationError(
      "journal_shape_failure",
      "The schema-migration journal shape or constraints are not trusted."
    );
  }
}

async function readJournal(client: PoolClient): Promise<SchemaMigrationJournalRow[]> {
  const result = await client.query<SchemaMigrationJournalRow>(
    `SELECT migration_order, migration_id, checksum_sha256, applied_at
     FROM public.schema_migrations ORDER BY migration_order`
  );
  return result.rows;
}

async function applyOne(client: PoolClient, migration: LoadedSchemaMigration): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(migration.upBody);
    await client.query(
      `INSERT INTO public.schema_migrations (migration_order, migration_id, checksum_sha256)
       VALUES ($1, $2, $3)`,
      [migration.order, migration.id, migration.checksumSha256]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new SchemaMigrationError(
      "migration_transaction_failure",
      `Schema migration ${migration.id} failed and was rolled back.`,
      { cause: error }
    );
  }
}

async function rollbackOne(client: PoolClient, migration: LoadedSchemaMigration): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(migration.downBody);
    const receipt = await client.query(
      `DELETE FROM public.schema_migrations
       WHERE migration_order = $1 AND migration_id = $2 AND checksum_sha256 = $3`,
      [migration.order, migration.id, migration.checksumSha256]
    );
    if (receipt.rowCount !== 1) {
      throw new SchemaMigrationError(
        "journal_state_failure",
        `Schema migration ${migration.id} did not have one matching rollback receipt.`
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof SchemaMigrationError) throw error;
    throw new SchemaMigrationError(
      "migration_transaction_failure",
      `Schema migration ${migration.id} rollback failed and was rolled back.`,
      { cause: error }
    );
  }
}

function selectedMigration(
  migrations: readonly LoadedSchemaMigration[],
  scope: SchemaMigrationScope
): LoadedSchemaMigration | null {
  if (scope === "all") return null;
  const migration = migrations.find((candidate) => candidate.id === scope);
  if (!migration) {
    throw new SchemaMigrationError("journal_state_failure", "The requested schema migration is unknown.");
  }
  return migration;
}

export async function runSchemaMigrations(
  pool: Pool,
  options: {
    direction: SchemaMigrationDirection;
    scope?: SchemaMigrationScope;
    connectionString: string;
    writeOptIn?: string | undefined;
    testRunToken?: string | undefined;
  }
): Promise<SchemaMigrationRunResult> {
  const expectedDatabaseName = options.testRunToken
    ? assertDisposableIntegrationTestDatabase(
        options.connectionString,
        options.testRunToken,
        options.writeOptIn
      )
    : (assertDisposableLocalDatabase(options.connectionString, options.writeOptIn),
      "savinggrace_sermons_test");
  const migrations = await loadSchemaMigrations();
  const client = await pool.connect();
  let locked = false;
  try {
    await verifyDatabaseIdentity(client, expectedDatabaseName);
    await client.query("SELECT pg_advisory_lock($1::integer, $2::integer)", schemaMigrationLockKeys);
    locked = true;
    await bootstrapJournal(client);
    await verifyJournalShape(client);
    const journal = await readJournal(client);
    let appliedCount = validateSchemaMigrationJournal(migrations, journal);
    await verifyExpectedSchemaState(client, migrations, appliedCount);

    const scope = options.scope ?? "all";
    const requested = selectedMigration(migrations, scope);
    const appliedMigrationIds: string[] = [];
    const rolledBackMigrationIds: string[] = [];

    if (options.direction === "apply") {
      const pending = requested
        ? requested.order <= appliedCount
          ? []
          : requested.order === appliedCount + 1
            ? [requested]
            : (() => {
                throw new SchemaMigrationError(
                  "journal_state_failure",
                  "The requested migration is not the next canonical pending migration."
                );
              })()
        : migrations.slice(appliedCount);
      for (const migration of pending) {
        await applyOne(client, migration);
        appliedCount += 1;
        appliedMigrationIds.push(migration.id);
        await verifyExpectedSchemaState(client, migrations, appliedCount);
      }
    } else {
      const pending = requested
        ? requested.order > appliedCount
          ? []
          : requested.order === appliedCount
            ? [requested]
            : (() => {
                throw new SchemaMigrationError(
                  "journal_state_failure",
                  "Rollback may remove only the latest applied migration."
                );
              })()
        : migrations.slice(0, appliedCount).reverse();
      for (const migration of pending) {
        await rollbackOne(client, migration);
        appliedCount -= 1;
        rolledBackMigrationIds.push(migration.id);
        await verifyExpectedSchemaState(client, migrations, appliedCount);
      }
    }

    const finalJournal = await readJournal(client);
    const finalCount = validateSchemaMigrationJournal(migrations, finalJournal);
    await verifyExpectedSchemaState(client, migrations, finalCount);
    const changed = appliedMigrationIds.length + rolledBackMigrationIds.length;
    return {
      direction: options.direction,
      outcome: changed === 0
        ? "no_op"
        : options.direction === "apply" ? "applied" : "rolled_back",
      appliedMigrationIds,
      rolledBackMigrationIds,
      journalReceiptCount: finalCount
    };
  } finally {
    if (locked) {
      await client.query(
        "SELECT pg_advisory_unlock($1::integer, $2::integer)",
        schemaMigrationLockKeys
      )
        .catch(() => undefined);
    }
    client.release();
  }
}
