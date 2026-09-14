import { isAbsolute } from "node:path";
import { Pool } from "pg";
import { protectedLocalPostgresUser as user, protectedLocalPostgresPassword as password } from "../src/migration/protected-local-postgres";
import { runTopicalClassificationCommand } from "../src/application/topical-classification-command";
async function main() {
  const directory = process.env.TOPICAL_PRIVATE_DIRECTORY;
  if (!directory || !isAbsolute(directory)) throw new Error("topical_private_directory_required");
  const pool = new Pool({ host: "127.0.0.1", port: 5432, database: "savinggrace_sermons_test", user, password, max: 1 });
  try { process.stdout.write(JSON.stringify(await runTopicalClassificationCommand(pool, "local_loopback", directory)) + "\n"); }
  finally { await pool.end(); }
}
main().catch(() => { process.stderr.write("topical_operation_refused\n"); process.exitCode = 1; });
