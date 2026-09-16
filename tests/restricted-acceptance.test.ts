import { describe,expect,it,vi } from "vitest";
import type { PoolClient } from "pg";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";
import { parseRestrictedManifest,restrictedEligibilitySql } from "../src/domain/restricted-acceptance";
import { withLegacyReviewTimezone } from "../src/application/legacy-review-timezone";
import { verifyRestrictedPublicationBoundary } from "../src/staging/restricted-publication-boundary";
import { createSealedStagingHandler } from "../src/staging/handler";
import { frontendSermonEligibilitySql } from "../src/server/queries/public-sermons";
import { verifyAcceptanceTarget } from "../src/application/restricted-acceptance-service";
import { readFileSync } from "node:fs";
describe("D-158 manifest and restricted recovery boundary",()=>{
  it("keeps private evidence mounts on maintenance only and never mounts a protected directory",()=>{
    const overlay=readFileSync(new URL("../deployment/acceptance-compose.yaml",import.meta.url),"utf8");
    expect(overlay).not.toMatch(/^  app:/m);expect(overlay.match(/read_only: true/g)).toHaveLength(3);
    for(const name of ["before.dump","backup-integrity.private.json","acceptance-manifest.private.json"])expect(overlay).toContain(`/verification/${name}`);
    expect(overlay).not.toMatch(/target: \/verification\s*$/m);
  });
  it("refuses a missing write opt-in and mismatched database identity before any transaction",async()=>{
    const gate=process.env.ALLOW_LOCAL_DB_WRITE;const query=vi.fn().mockResolvedValue({rows:[{ok:false}]});const c={query} as unknown as PoolClient;
    try{delete process.env.ALLOW_LOCAL_DB_WRITE;await expect(verifyAcceptanceTarget(c,"local_loopback")).rejects.toThrow("restricted_acceptance_write_gate_required");
      expect(query).not.toHaveBeenCalled();process.env.ALLOW_LOCAL_DB_WRITE="1";
      await expect(verifyAcceptanceTarget(c,"local_loopback")).rejects.toThrow("restricted_acceptance_target_mismatch");
      expect(query.mock.calls.every(call=>String(call[0]).startsWith("SELECT"))).toBe(true);
    }finally{if(gate===undefined)delete process.env.ALLOW_LOCAL_DB_WRITE;else process.env.ALLOW_LOCAL_DB_WRITE=gate;}
  });
  const fixture={decision:"D-158",version:1,members:[{sermonId:"99999999-9999-4999-8999-999999999158",rowVersion:1,
    dependencySha256:"a".repeat(64),completionKind:"ai",passageBasis:"no_single_primary"}],blocked:[]};
  it("cannot accept an alternative manifest, duplicates, ordering drift or unknown fields",()=>{
    expect(()=>parseRestrictedManifest(fixture)).toThrow();expect(parseRestrictedManifest(fixture,true).members).toHaveLength(1);
    for(const value of [{...fixture,unexpected:true},{...fixture,members:[...fixture.members,...fixture.members]},
      {...fixture,blocked:[{sermonId:fixture.members[0]!.sermonId,reasons:[]}]}]) expect(()=>parseRestrictedManifest(value,true)).toThrow();
  });
  it("preserves the normal approval and publication selector outside the explicit restricted scope",()=>{
    const normal=frontendSermonEligibilitySql("s","public");expect(normal).not.toContain("sermon_restricted_acceptances");expect(normal).toContain("approved");
    const restricted=frontendSermonEligibilitySql("s","restricted_accepted");
    for(const guard of ["published_row_version","published_at","restricted_acceptance_dependency","withdrawals","manifest_sha256"])
      expect(restricted).toContain(guard);
    expect(()=>restrictedEligibilitySql("s;unsafe")).toThrow();
  });
  it.each([0,144])("allows only the sealed empty or exact receipt cohort: %s",async(accepted)=>{
    const query=vi.fn().mockResolvedValue({rows:[{accepted,wrong_receipts:0,outside:0}]});
    await expect(verifyRestrictedPublicationBoundary({query},"sealed_staging")).resolves.toBeUndefined();
    for(const change of [{accepted:143},{wrong_receipts:1},{outside:1}]){
      query.mockResolvedValue({rows:[{accepted,wrong_receipts:0,outside:0,...change}]});
      await expect(verifyRestrictedPublicationBoundary({query},"sealed_staging")).rejects.toThrow();
    }
  });
  it("recovers application availability without exposing content, deleting history or enabling admin",async()=>{
    const repository=new Proxy({},{get(){throw new Error("content_query_forbidden_during_recovery");}}) as PublicSermonRepository;
    const handler=createSealedStagingHandler(repository,async()=>{},"a".repeat(40),true);
    for(const path of ["/","/sermons/","/api/v1/sermons","/sermons/invented/"]){
      const response=await handler(new Request("http://127.0.0.1"+path));expect(response.status).toBe(503);expect(await response.text()).toBe("restricted_frontend_temporarily_disabled");
    }
    expect((await handler(new Request("http://127.0.0.1/admin"))).status).toBe(401);
    expect((await handler(new Request("http://127.0.0.1/health/ready"))).status).toBe(200);
  });
  it.each([false,true])("restores the caller's timezone after legacy validation, including failure: %s",async(failure)=>{
    const query=vi.fn().mockResolvedValue({rows:[{TimeZone:"UTC"}]});const client={query,release:vi.fn()} as unknown as PoolClient;
    const result=withLegacyReviewTimezone(client,async()=>{if(failure)throw new Error("fixture_failure");return "ok";});
    if(failure)await expect(result).rejects.toThrow("fixture_failure");else expect(await result).toBe("ok");
    expect(query).toHaveBeenLastCalledWith("SELECT set_config('TimeZone',$1,true)",["UTC"]);
  });
});
