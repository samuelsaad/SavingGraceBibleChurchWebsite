import {describe,expect,it} from "vitest";
import {buildFrozenMetadataEvaluationQuery} from "../src/semantic/metadata-evaluation-baseline";
const ids=["a1780000-0000-4000-8000-000000000001","a1780000-0000-4000-8000-000000000002"];
describe("private frozen metadata evaluation baseline",()=>{
 it("preserves the established score predicates and ordering without card hydration or repeated receipt checks",()=>{
  const query=buildFrozenMetadataEvaluationQuery({scope:"d175_local_completed",eligibleIds:ids,anchorIds:[ids[0]!],limit:3});
  expect(query.values).toEqual([[ids[0]],3,ids]);
  for(const weight of [100,70,35,15])expect(query.text).toContain(`THEN ${weight} ELSE 0 END`);
  expect(query.text).toContain("ORDER BY s.related_score DESC, s.service_date DESC, s.id");
  expect(query.text).toContain("LIMIT $2");expect(query.text).toContain("candidate.id = ANY($3::uuid[])");expect(query.text).toContain("sermons.id = ANY($3::uuid[])");
  expect(query.text).not.toMatch(/restricted_acceptance_dependency|sermon_extensions|primary_media|summary_status|source_wordpress_id|semantic.*score/);
 });
 it("refuses duplicate members, invalid limits or an anchor outside the exact frozen scope",()=>{
  expect(()=>buildFrozenMetadataEvaluationQuery({scope:"d175_local_completed",eligibleIds:[ids[0]!],anchorIds:[ids[1]!],limit:3})).toThrow("scope_invalid");
  expect(()=>buildFrozenMetadataEvaluationQuery({scope:"d175_local_completed",eligibleIds:[ids[0]!,ids[0]!],anchorIds:[ids[0]!],limit:3})).toThrow("scope_invalid");
  expect(()=>buildFrozenMetadataEvaluationQuery({scope:"d175_local_completed",eligibleIds:ids,anchorIds:ids,limit:100})).toThrow();
 });
});
