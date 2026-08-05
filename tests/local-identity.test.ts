import { describe, expect, it } from "vitest";
import {
  LocalTestIdentityProvider,
  localTestIdentity
} from "../src/server/auth/local-test-identity-provider";

describe("provider-independent local identity boundary", () => {
  it("is disabled by default and rejects unknown or removed selectors", async () => {
    const disabled = new LocalTestIdentityProvider(false, "development");
    expect(
      await disabled.authenticate(
        new Request("http://127.0.0.1", { headers: { "x-local-identity": "admin" } })
      )
    ).toBeNull();

    const enabled = new LocalTestIdentityProvider(true, "development");
    for (const selector of ["unknown", "editor", "contributor", ""]) {
      expect(
        await enabled.authenticate(
          new Request("http://127.0.0.1", {
            headers: { "x-local-identity": selector }
          })
        )
      ).toBeNull();
    }
  });

  it("resolves only the deterministic local admin and ignores spoofed claims", async () => {
    const provider = new LocalTestIdentityProvider(true, "development");
    const identity = await provider.authenticate(
      new Request("http://localhost", {
        headers: {
          "x-local-identity": "admin",
          "x-actor-role": "contributor",
          "x-actor-subject": "forged-subject"
        }
      })
    );
    expect(identity).toEqual(localTestIdentity);
  });

  it("cannot be enabled for production or a non-loopback request", async () => {
    const production = new LocalTestIdentityProvider(true, "production");
    expect(
      await production.authenticate(
        new Request("http://127.0.0.1", { headers: { "x-local-identity": "admin" } })
      )
    ).toBeNull();

    const development = new LocalTestIdentityProvider(true, "development");
    expect(
      await development.authenticate(
        new Request("https://admin.example.test", {
          headers: { "x-local-identity": "admin" }
        })
      )
    ).toBeNull();
  });
});
