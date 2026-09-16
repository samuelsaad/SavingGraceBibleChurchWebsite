import type { Pool, PoolClient } from "pg";

/** D-156/D-157 historical JSON hashes used PostgreSQL's Australia/Sydney
 * serialization. Reproduce it only while reading those legacy dependencies.
 * No timestamp, historical hash, connection default or global setting is changed. */
export async function withLegacyReviewTimezone<T>(db: Pool | PoolClient, read: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!("release" in db)) {
    const client = await db.connect(); let discard = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const result = await withLegacyReviewTimezone(client, read);
      await client.query("COMMIT"); return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { discard = true; }
      throw error;
    } finally { client.release(discard); }
  }
  const previous = (await db.query("SHOW timezone")).rows[0].TimeZone as string;
  if (previous === "Australia/Sydney") return read(db);
  await db.query("SELECT set_config('TimeZone','Australia/Sydney',true)");
  try { return await read(db); }
  finally { await db.query("SELECT set_config('TimeZone',$1,true)", [previous]); }
}
