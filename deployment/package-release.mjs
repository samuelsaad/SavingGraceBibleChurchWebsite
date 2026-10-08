import { execFileSync } from "node:child_process";
import { readFile, realpath, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { permittedPackagePath } from "./package-policy.mjs";

const directory = process.env.STAGING_PACKAGE_DIRECTORY;
if (!directory || !isAbsolute(directory)) throw new Error("external_package_directory_required");
const destination = await realpath(directory);
if (!relative(process.cwd(), destination).startsWith("..")) throw new Error("package_inside_repository_refused");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const paths = new Set(["deployment/Dockerfile.cms-runtime", "deployment/build-cms-admin.mjs", "src/pages/admin/index.astro", "src/admin/workbench.css", "Dockerfile", ".dockerignore", "package.json", "package-lock.json",
  "deployment/build.mjs", "deployment/compose.yaml", "deployment/acceptance-compose.yaml", "deployment/topical-compose.yaml", "deployment/d160-draft-preview-compose.yaml", "deployment/d160-sync.ts", "deployment/d161-sync-compose.yaml", "deployment/d161-sync.ts", "deployment/restore.py", "deployment/README.md",
  "deployment/savinggrace-staging.socket", "deployment/savinggrace-staging.service",
  "deployment/savinggrace-d160-db.socket", "deployment/savinggrace-d160-db.service", "deployment/d167-protected-sync.ts", "deployment/sermon-durations-sync.ts"]);
for (const name of ["cms-admin", "cms-maintenance", "server", "database", "draft-preview", "sermonaudio-sync", "completed-sync", "sermonaudio-completion-sync", "sermon-durations-sync", "related-themes-sync", "d160-sync", "d161-sync", "d167-protected-sync"]) {
  for (const path of JSON.parse(await readFile(`dist-staging/${name}.inputs.json`, "utf8"))) {
    if (path.startsWith("src/")) paths.add(path);
  }
}
const migrations = execFileSync("git", ["ls-files", "db/migrations"], { encoding: "utf8" }).trim().split(/\r?\n/);
for (const path of migrations) paths.add(path);
for (const path of paths) {
  if (!permittedPackagePath(path)) throw new Error("prohibited_package_path");
  if (!(await lstat(path)).isFile()) throw new Error("package_symlink_or_nonfile");
  // Claude's committed church imagery is embedded in a large safe source module.
  // Keep the exact-byte check; the default 1 MiB child buffer is insufficient.
  const expected = execFileSync("git", ["show", `${commit}:${path}`], { maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"] });
  const actual = Buffer.from((await readFile(path, "utf8")).replace(/\r\n/g, "\n"));
  if (!expected.equals(actual)) throw new Error("package_uncommitted_drift");
}
const archive = resolve(destination, "release.tar");
if (await lstat(archive).then(() => true, () => false)) throw new Error("existing_release_archive_preserved");
execFileSync("git", ["-c", "core.autocrlf=false", "archive", "--format=tar", `--output=${archive}`, commit, "--", ...[...paths].sort()]);
const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
process.stdout.write(JSON.stringify({ commit, pathCount: paths.size, sha256 }) + "\n");
