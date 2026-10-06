import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { concernLabel, reviewDestination, summarizeWorkbench, type WorkbenchSermon } from "../src/domain/admin-workbench";
import { readAdminWorkbench, workbenchEligibilitySql } from "../src/server/queries/admin-workbench";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import { createAdminApiRouter } from "../src/server/http/admin-api-router";
import type { AdminSermonRepository } from "../src/server/repositories/admin-sermon-repository";

const row = (complete: boolean): WorkbenchSermon => ({ id:"11111111-1111-4111-8111-111111111111", title:"Synthetic sermon", speaker:null, serviceDate:"2026-01-01", publicationStatus:"draft",rowVersion:1,complete,previouslyAccepted:complete,concerns:[] });
describe("current private review workbench", () => {
  it("counts the entire returned inventory rather than an old delegated scope", () => {
    const result=summarizeWorkbench([...Array.from({length:279},()=>row(true)),...Array.from({length:32},()=>row(false))],"2026-01-01T00:00:00Z");
    expect(result.counts).toEqual({total:311,complete:279,attention:32});
    expect(result.data.every(r=>r.publicationStatus==='draft')).toBe(true);
    expect(summarizeWorkbench([],"now").counts).toEqual({total:0,complete:0,attention:0});
  });
  it("names evidence requirements and links directly to view-only correction stages", () => {
    expect(concernLabel("findings","provider_redaction_unresolved")).toBe("Source wording needs checking");
    expect(concernLabel("transcript","instruction_negation_uncertain")).toContain("meaning");
    expect(reviewDestination(row(false).id,"speaker")).toContain("viewStage=1");
    expect(reviewDestination(row(false).id,"description")).toContain("viewStage=4");
    expect(reviewDestination(row(false).id,"questions")).toContain("viewStage=5");
  });
  it.each(["d158","d161","d162","d167","d168","d169"] as const)("requires current version, complete dependencies and no withdrawal for %s", key=>{
    const sql=workbenchEligibilitySql(key);
    expect(sql).toContain("row_version");expect(sql).toContain("dependency");expect(sql).toContain("withdrawals");
    expect(sql).toContain("published_at");expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("originalAcceptanceSha256");expect(sql).toContain("audit_events");
  });
  it("uses a UTC read-only consistent snapshot and returns safe missing-receipt guidance", async()=>{
    const calls:string[]=[];
    const query=vi.fn(async(sql:string)=>{calls.push(sql);return {rows:sql.startsWith("SELECT tablename")?[]:sql.includes("s.service_date DESC")?[{id:row(false).id,title:"Synthetic",speaker:"Example Speaker",service_date:"2026-01-01",status:"draft",row_version:1,complete:false,previously_accepted:true}]:[]};});
    const release=vi.fn();const pool={connect:async()=>({query,release})} as unknown as Pool;
    const result=await readAdminWorkbench(pool);
    expect(calls[0]).toContain("REPEATABLE READ READ ONLY");expect(calls[1]).toBe("SET LOCAL TIME ZONE 'UTC'");
    expect(calls.at(-1)).toBe("COMMIT");expect(release).toHaveBeenCalledOnce();
    expect(result.data[0]?.concerns[0]?.component).toBe("freshness");
    expect(calls.some(s=>/^(UPDATE|INSERT|DELETE)/u.test(s))).toBe(false);
  });
  it("rolls back failures and releases the pooled connection without hiding them",async()=>{
    const calls:string[]=[];const release=vi.fn();
    const pool={connect:async()=>({query:async(sql:string)=>{calls.push(sql);if(sql.startsWith("SELECT"))throw Error("fixture_failure");return{rows:[]};},release})} as unknown as Pool;
    await expect(readAdminWorkbench(pool)).rejects.toThrow("fixture_failure");expect(calls.at(-1)).toBe("ROLLBACK");expect(release).toHaveBeenCalledOnce();
  });
  it("authenticates, authorizes and disallows mutation on the overview endpoint",async()=>{
    const readWorkbench=vi.fn(async()=>summarizeWorkbench([row(true)],"now"));
    const service=new AdminSermonService({readWorkbench} as unknown as AdminSermonRepository);
    const request=new Request("http://127.0.0.1/api/v1/admin/workbench");
    expect((await createAdminApiRouter(service,{authenticate:async()=>null})(request)).status).toBe(401);
    const route=createAdminApiRouter(service,{authenticate:async()=>({subject:"fixture-admin",role:"admin"})});
    const response=await route(request);expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toBe("no-store");expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    expect((await route(new Request(request,{method:"POST"}))).status).toBe(405);expect(readWorkbench).toHaveBeenCalledOnce();
  });
});
