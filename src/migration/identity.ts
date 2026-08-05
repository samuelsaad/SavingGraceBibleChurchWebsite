import { createHash } from "node:crypto";

const projectNamespace = "8391ea65-a273-58f7-a824-dabf8a80f2be";

function uuidBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

export function deterministicSourceUuid(entityType: string, sourceId: number | string): string {
  const hash = createHash("sha1")
    .update(uuidBytes(projectNamespace))
    .update(`${entityType}:${sourceId}`)
    .digest();

  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
