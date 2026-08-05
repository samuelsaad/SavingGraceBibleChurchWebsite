import { describe, expect, it } from "vitest";
import { assertLoopbackApiHost } from "../src/server/local-api-safety";

describe("local API bind safety", () => {
  it("accepts loopback names and rejects externally reachable binds", () => {
    for (const host of ["127.0.0.1", "localhost", "::1"]) {
      expect(() => assertLoopbackApiHost(host)).not.toThrow();
    }
    for (const host of ["0.0.0.0", "::", "192.0.2.10", "api.example.test"]) {
      expect(() => assertLoopbackApiHost(host)).toThrow("only to loopback");
    }
  });
});
