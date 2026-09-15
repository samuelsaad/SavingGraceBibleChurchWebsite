import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, lstat, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

// Only these fixed codes may cross the CLI boundary. Filesystem/PowerShell errors
// can contain private paths; never retain them as Error.cause or print stderr.
export class TokenReplacementError extends Error {
  constructor(readonly code: "token_target_invalid" | "token_changed" | "token_permissions_failed" |
    "token_replacement_failed" | "renewal_already_running" | "token_cleanup_failed" | "renewal_cancelled",
    readonly permissionStage?: "target" | "owner" | "construct" | "apply" | "verify" | "unavailable") { super(code); }
}

async function regularPrivateTarget(path: string): Promise<void> {
  const absolute = resolve(path);
  let ancestor = dirname(absolute);
  while (ancestor !== parse(ancestor).root) {
    const item = await lstat(ancestor);
    if (!item.isDirectory() || item.isSymbolicLink()) throw new TokenReplacementError("token_target_invalid");
    ancestor = dirname(ancestor);
  }
  const item = await lstat(absolute);
  if (!item.isFile() || item.isSymbolicLink() || item.nlink !== 1) throw new TokenReplacementError("token_target_invalid");
}

// The new file is EMPTY until this completes. mode 0600 alone is not a Windows
// DACL. Protect the replacement for the current owner, SYSTEM and Administrators;
// never modify the old token or inherit a broad sandbox/Users read grant.
const windowsAclScript = `
$ErrorActionPreference = 'Stop'
$stage = 'target'
try {
  $old = Get-Item -LiteralPath $env:SG_OAUTH_OLD_PATH
  $new = Get-Item -LiteralPath $env:SG_OAUTH_TEMP_PATH
  if ($old.PSIsContainer -or $new.PSIsContainer -or
      ($old.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
      ($new.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $new.Length -ne 0) { throw 'invalid' }
  $stage = 'owner'
  $current = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $owner = (Get-Acl -LiteralPath $old.FullName).GetOwner([Security.Principal.SecurityIdentifier])
  if ($owner.Value -notin @($current.Value, 'S-1-5-32-544')) { throw 'owner' }
  $allowed = @($current.Value, 'S-1-5-18', 'S-1-5-32-544')
  $stage = 'construct'
  $acl = New-Object Security.AccessControl.FileSecurity
  $acl.SetOwner($current)
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in $allowed) {
    $identity = New-Object Security.Principal.SecurityIdentifier($sid)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')
    $acl.AddAccessRule($rule)
  }
  $stage = 'apply'
  Set-Acl -LiteralPath $new.FullName -AclObject $acl
  $stage = 'verify'
  $verified = Get-Acl -LiteralPath $new.FullName
  $rules = @($verified.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
  if (-not $verified.AreAccessRulesProtected -or $rules.Count -ne 3 -or
      $verified.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $current.Value) { throw 'acl' }
  foreach ($rule in $rules) {
    if ($rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or
        $rule.IdentityReference.Value -notin $allowed -or $rule.FileSystemRights -ne 'FullControl') { throw 'acl' }
  }
  [Console]::Out.Write('protected')
} catch { [Console]::Out.Write($stage); exit 1 }
`;

export async function protectReplacementFile(oldPath: string, tempPath: string): Promise<void> {
  if (process.platform !== "win32") { await chmod(tempPath, 0o600); return; }
  // Windows PowerShell must resolve its own compatible built-in security module,
  // not inherit PowerShell Core's incompatible PSModulePath through Node.
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "psmodulepath"));
  await new Promise<void>((done, fail) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand",
      Buffer.from(windowsAclScript, "utf16le").toString("base64")], {
      windowsHide: true, timeout: 15_000, maxBuffer: 1024,
      env: { ...environment, SG_OAUTH_OLD_PATH: oldPath, SG_OAUTH_TEMP_PATH: tempPath }
    }, (error, stdout) => {
      if (error || stdout !== "protected") fail(new TokenReplacementError("token_permissions_failed",
        ["target", "owner", "construct", "apply", "verify"].includes(stdout)
          ? stdout as "target" | "owner" | "construct" | "apply" | "verify" : "unavailable"));
      else done();
    });
  });
}

export async function withTokenRenewalLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const lockPath = join(dirname(path), ".owner-renewal.lock");
  let lock: Awaited<ReturnType<typeof open>>;
  try { await regularPrivateTarget(path); lock = await open(lockPath, "wx", 0o600); }
  catch { throw new TokenReplacementError("renewal_already_running"); }
  try { return await operation(); }
  finally {
    await lock.close();
    await unlink(lockPath).catch(() => { throw new TokenReplacementError("token_cleanup_failed"); });
  }
}

export async function readExistingToken(path: string): Promise<Buffer> {
  try { await regularPrivateTarget(path); return await readFile(path); }
  catch { throw new TokenReplacementError("token_target_invalid"); }
}

export async function replaceVerifiedToken(path: string, original: Buffer, replacement: Buffer,
  // Dependency seam exercises failed atomic replacement with synthetic files.
  operations = { protect: protectReplacementFile, rename }, signal?: AbortSignal
): Promise<void> {
  const tempPath = join(dirname(path), `.owner-renewal-${randomUUID()}.tmp`);
  let created = false;
  let committed = false;
  try {
    await regularPrivateTarget(path);
    if (signal?.aborted) throw new TokenReplacementError("renewal_cancelled");
    if (!(await readFile(path)).equals(original)) throw new TokenReplacementError("token_changed");
    const handle = await open(tempPath, "wx", 0o600);
    created = true;
    await handle.close();
    await operations.protect(path, tempPath);
    const writer = await open(tempPath, "r+");
    try { await writer.writeFile(replacement); await writer.sync(); }
    finally { await writer.close(); }
    if (!(await readFile(tempPath)).equals(replacement)) throw new TokenReplacementError("token_replacement_failed");
    await regularPrivateTarget(path);
    if (!(await readFile(path)).equals(original)) throw new TokenReplacementError("token_changed");
    // Same-directory atomic replacement: never delete/move the old token first.
    if (signal?.aborted) throw new TokenReplacementError("renewal_cancelled");
    await operations.rename(tempPath, path);
    committed = true;
  } catch (error) {
    throw error instanceof TokenReplacementError ? error : new TokenReplacementError("token_replacement_failed");
  } finally {
    if (created && !committed) await unlink(tempPath).catch(() => { throw new TokenReplacementError("token_cleanup_failed"); });
  }
}
