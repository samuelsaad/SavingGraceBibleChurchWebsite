export function assertLoopbackApiHost(hostname: string): void {
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(hostname)) {
    throw new Error("The local API harness may bind only to loopback");
  }
}
