const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
export const integrationTestDatabasePrefix = "savinggrace_test_run_";
const integrationTokenPattern = /^[a-z0-9]{24,48}$/;

function parsedLocalDatabase(connectionString: string): { url: URL; databaseName: string } {
  const url = new URL(connectionString);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!loopbackHosts.has(url.hostname) || url.port !== "5432") {
    throw new Error("Local access requires loopback PostgreSQL on port 5432");
  }
  return { url, databaseName };
}

export function assertReadOnlyLocalDatabase(connectionString: string): void {
  const { databaseName } = parsedLocalDatabase(connectionString);
  if (databaseName !== "savinggrace_sermons_test") {
    throw new Error(
      "Local database reads are restricted to savinggrace_sermons_test on loopback port 5432"
    );
  }
}

function assertWriteOptIn(writeOptIn: string | undefined): void {
  if (writeOptIn !== "1") {
    throw new Error("Set ALLOW_LOCAL_DB_WRITE=1 to opt in to disposable local fixture writes");
  }
}

export function assertDisposableLocalDatabase(
  connectionString: string,
  writeOptIn = process.env.ALLOW_LOCAL_DB_WRITE
): void {
  const { databaseName } = parsedLocalDatabase(connectionString);
  if (databaseName !== "savinggrace_sermons_test") {
    throw new Error(
      "Local database writes are restricted to savinggrace_sermons_test on loopback port 5432"
    );
  }
  assertWriteOptIn(writeOptIn);
}

export function disposableIntegrationDatabaseName(runToken: string): string {
  if (!integrationTokenPattern.test(runToken)) {
    throw new Error("The disposable PostgreSQL test-run token is invalid");
  }
  return `${integrationTestDatabasePrefix}${runToken}`;
}

export function assertDisposableIntegrationTestDatabase(
  connectionString: string,
  runToken: string | undefined,
  writeOptIn = process.env.ALLOW_LOCAL_DB_WRITE
): string {
  if (!runToken) throw new Error("A disposable PostgreSQL test-run token is required");
  const expectedName = disposableIntegrationDatabaseName(runToken);
  const { databaseName } = parsedLocalDatabase(connectionString);
  if (databaseName === "savinggrace_sermons_test" || databaseName !== expectedName) {
    throw new Error(
      `PostgreSQL integration tests require the exact ${integrationTestDatabasePrefix}<run-token> database`
    );
  }
  assertWriteOptIn(writeOptIn);
  return expectedName;
}

export function authorisedLocalDatabaseName(
  environment: NodeJS.ProcessEnv = process.env
): string {
  const integrationRequested =
    environment.RUN_POSTGRES_INTEGRATION === "1" ||
    environment.TEST_DATABASE_URL !== undefined ||
    environment.DISPOSABLE_TEST_DATABASE_TOKEN !== undefined;
  if (!integrationRequested) return "savinggrace_sermons_test";
  if (environment.RUN_POSTGRES_INTEGRATION !== "1" || !environment.TEST_DATABASE_URL) {
    throw new Error("The disposable PostgreSQL integration environment is incomplete");
  }
  return assertDisposableIntegrationTestDatabase(
    environment.TEST_DATABASE_URL,
    environment.DISPOSABLE_TEST_DATABASE_TOKEN,
    environment.ALLOW_LOCAL_DB_WRITE
  );
}
