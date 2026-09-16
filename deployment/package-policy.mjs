// This validates source paths, not semantic words in migration names.
/** @param {string} path */
export function permittedPackagePath(path) {
  if (path.includes("\\") || path.split("/").some(part => part === ".." || part === "." || part === "")) return false;
  if (/(?:^|\/)(?:private|development-data|youtube|node_modules|\.git)(?:\/|$)|\.private\.|\.(?:pem|key)$|(?:^|\/)\.env|local-test-identity|local-dashboard-static/i.test(path)) return false;
  return ["Dockerfile", ".dockerignore", "package.json", "package-lock.json", "deployment/build.mjs",
    "deployment/compose.yaml", "deployment/acceptance-compose.yaml", "deployment/topical-compose.yaml", "deployment/d160-draft-preview-compose.yaml", "deployment/d160-sync.ts", "deployment/restore.py", "deployment/README.md",
    "deployment/savinggrace-staging.socket", "deployment/savinggrace-staging.service",
    "deployment/savinggrace-d160-db.socket", "deployment/savinggrace-d160-db.service"].includes(path)
    || /^src\/[a-zA-Z0-9_/-]+\.ts$/.test(path)
    || /^db\/migrations\/[0-9]{4}_[a-z0-9_]+(?:\.down)?\.sql$/.test(path);
}
