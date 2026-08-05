import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must use PostgreSQL"
  ),
  PUBLIC_SITE_URL: z.url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
