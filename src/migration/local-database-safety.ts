export function assertDisposableLocalDatabase(
  connectionString: string,
  writeOptIn = process.env.ALLOW_LOCAL_DB_WRITE
): void {
  const url = new URL(connectionString);
  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
  const databaseName = url.pathname.slice(1);
  if (
    !localHosts.has(url.hostname) ||
    url.port !== "5432" ||
    databaseName !== "savinggrace_sermons_test"
  ) {
    throw new Error(
      "Local database writes are restricted to savinggrace_sermons_test on loopback port 5432"
    );
  }
  if (writeOptIn !== "1") {
    throw new Error("Set ALLOW_LOCAL_DB_WRITE=1 to opt in to disposable local fixture writes");
  }
}
