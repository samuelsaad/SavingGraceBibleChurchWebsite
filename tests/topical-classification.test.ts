import { describe, expect, it } from "vitest";
import { parseTopicalManifest, topicalAuthorization, topicalClassificationSql } from "../src/domain/topical-classification";
import { restrictedAcceptanceManifest } from "../src/domain/restricted-acceptance";
import { buildPublishedTopicalSermonsQuery, publicRelationshipProjection } from "../src/server/queries/public-sermons";
import { readFileSync } from "node:fs";
describe("bounded Samuel editorial topical classification", () => {
  const fixture = { version: 1, authorization: topicalAuthorization, sourceAcceptanceManifest: restrictedAcceptanceManifest,
    sermonIds: ["99999999-9999-4999-8999-999999999159"] };
  it("requires the frozen nine-identity hash; fixtures cannot relax real scope", () => {
    expect(() => parseTopicalManifest(fixture)).toThrow();
    expect(parseTopicalManifest(fixture, true)).toEqual(fixture);
    for (const value of [{ ...fixture, extra: true }, { ...fixture, sermonIds: [...fixture.sermonIds, ...fixture.sermonIds] },
      { ...fixture, sourceAcceptanceManifest: "b".repeat(64) }, { ...fixture, authorization: "automatic" }]) expect(() => parseTopicalManifest(value, true)).toThrow();
  });
  it("requires explicit typed editorial evidence and its audit, never a null book or series name", () => {
    const sql = topicalClassificationSql("s");
    for (const required of ["schema_version=1", "tx.payload=jsonb_build_object", "samuel_editorial_decision", "content_dependency_sha256", "audit_events", "request_correlation_id"]) expect(sql).toContain(required);
    expect(sql).not.toContain("series"); expect(() => topicalClassificationSql("unsafe;sql")).toThrow();
    expect(publicRelationshipProjection("s", "public")).toContain("false AS is_topical");
  });
  it("keeps all restricted eligibility guards and normal public classification closed", () => {
    const q = buildPublishedTopicalSermonsQuery("restricted_accepted");
    for (const guard of ["published_row_version", "published_at", "restricted_acceptance_dependency", "withdrawals"]) expect(q.text).toContain(guard);
    expect(buildPublishedTopicalSermonsQuery("public").text).not.toContain("website.topical-classification");
  });
  it("mounts only individual protected inputs on the maintenance service", () => {
    const overlay = readFileSync(new URL("../deployment/topical-compose.yaml", import.meta.url), "utf8");
    expect(overlay).not.toMatch(/^  app:/m); expect(overlay.match(/read_only: true/g)).toHaveLength(3);
    expect(overlay).not.toMatch(/target: \/verification\s*$/m);
  });
});
