import { Pool } from "pg";

export function createPostgresPool(
  connectionString: string,
  options: { readOnly?: boolean; max?: number } = {}
): Pool {
  return new Pool({
    connectionString,
    max: options.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: options.readOnly
      ? "saving-grace-frontend-preview-read-only"
      : "saving-grace-website",
    ...(options.readOnly ? { options: "-c default_transaction_read_only=on" } : {})
  });
}
