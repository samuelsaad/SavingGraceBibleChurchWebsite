import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { loadSchemaMigrations, validateSchemaMigrationJournal } from "../migration/schema-migrations";

export async function verifyReleaseSchema(client: Pick<PoolClient, "query">) {
  const migrations = await loadSchemaMigrations();
  const journal = await client.query("SELECT migration_order, migration_id, checksum_sha256 FROM schema_migrations ORDER BY migration_order");
  const applied = validateSchemaMigrationJournal(migrations, journal.rows);
  if (applied !== migrations.length || applied !== 18) throw new Error("staging_pending_or_unexpected_migrations");
  return { migrations: applied, pending: 0 };
}

/** Only digests and counts cross this boundary; no row bodies or identities. */
export async function databaseFingerprint(client: PoolClient) {
  await client.query("SET LOCAL timezone = 'UTC'");
  await client.query("SET LOCAL datestyle = 'ISO, YMD'");
  await client.query("SET LOCAL extra_float_digits = 3");
  const names = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename COLLATE "C"`);
  const tables: Array<{ table: string; count: number; sha256: string }> = [];
  for (const { tablename } of names.rows) {
    if (!/^[a-z_]+$/.test(tablename)) throw new Error("unrecognized_table_name");
    const result = await client.query(`SELECT count(*)::integer AS count,
      encode(digest(COALESCE(string_agg(h, '' ORDER BY h COLLATE "C"), ''), 'sha256'),'hex') AS sha256
      FROM (SELECT encode(digest(to_jsonb(t)::text, 'sha256'), 'hex') h FROM public."${tablename}" t) hashes`);
    tables.push({ table: tablename, ...result.rows[0] });
  }
  const sequences = await client.query(`SELECT sequencename, start_value::text, min_value::text, max_value::text,
    increment_by::text, cycle, cache_size::text, last_value::text FROM pg_sequences
    WHERE schemaname='public' ORDER BY sequencename COLLATE "C"`);
  const sequenceHash = createHash("sha256").update(JSON.stringify(sequences.rows)).digest("hex");
  const totalHash = createHash("sha256").update(JSON.stringify({ tables, sequenceHash })).digest("hex");
  const aggregate = await client.query(`SELECT
    (SELECT count(*)::integer FROM sermons) sermons,
    (SELECT count(*)::integer FROM sermon_transcripts) transcripts,
    (SELECT count(*)::integer FROM sermons WHERE summary IS NOT NULL) descriptions,
    (SELECT count(*)::integer FROM sermon_question_answers) qa,
    (SELECT count(*)::integer FROM sermon_ai_content_reviews) d156,
    (SELECT count(*)::integer FROM sermon_ai_component_reviews WHERE component <> 'completion') d157_components,
    (SELECT count(*)::integer FROM sermon_ai_component_reviews WHERE component = 'completion') ai_completions,
    (SELECT count(*)::integer FROM sermon_enrichment_reviews WHERE completed_at IS NOT NULL) human_completions,
    (SELECT count(*)::integer FROM sermons WHERE status='published') published,
    (SELECT count(*)::integer FROM sermons WHERE published_at IS NOT NULL) publication_timestamps`);
  return { tables, sequenceHash, sha256: totalHash, counts: aggregate.rows[0] };
}
