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
const paths = new Set(["Dockerfile", ".dockerignore", "package.json", "package-lock.json",
  "deployment/build.mjs", "deployment/compose.yaml", "deployment/acceptance-compose.yaml", "deployment/topical-compose.yaml", "deployment/d160-draft-preview-compose.yaml", "deployment/d160-sync.ts", "deployment/restore.py", "deployment/README.md",
  "deployment/savinggrace-staging.socket", "deployment/savinggrace-staging.service"]);
for (const name of ["server", "database", "draft-preview", "d160-sync"]) {
  for (const path of JSON.parse(await readFile(`dist-staging/${name}.inputs.json`, "utf8"))) {
    if (path.startsWith("src/")) paths.add(path);
  }
}
const migrations = execFileSync("git", ["ls-files", "db/migrations"], { encoding: "utf8" }).trim().split(/\r?\n/);
for (const path of migrations) paths.add(path);
for (const path of paths) {
  if (!permittedPackagePath(path)) throw new Error("prohibited_package_path");
  if (!(await lstat(path)).isFile()) throw new Error("package_symlink_or_nonfile");
  const expected = execFileSync("git", ["show", `${commit}:${path}`]);
  const actual = Buffer.from((await readFile(path, "utf8")).replace(/\r\n/g, "\n"));
  if (!expected.equals(actual)) throw new Error("package_uncommitted_drift");
}
const archive = resolve(destination, "release.tar");
if (await lstat(archive).then(() => true, () => false)) throw new Error("existing_release_archive_preserved");
execFileSync("git", ["archive", "--format=tar", `--output=${archive}`, commit, "--", ...[...paths].sort()]);
const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
process.stdout.write(JSON.stringify({ commit, pathCount: paths.size, sha256 }) + "\n");
