import { describe,it,expect } from "vitest";
import { assessPrimaryBook,resolveExplicitPassage,fillExplicitPrimaryBook,type PrimaryBookEvidence } from "../src/domain/primary-book-resolution";
import { scriptureReferenceInputSchema } from "../src/api/contracts/admin-sermons";

const empty:PrimaryBookEvidence={reviewStatus:null,references:[],sourceTitles:[],sourcePassages:[]};
describe("automatic explicit primary Bible-book assignment",()=>{
  it.each([["Romans",45],["Rom 8:1–11",45],["1 John 2:1–6",62],["1 Jn 2:1-6",62],["1 Peter",60],["Jude 3–7",65]])("resolves %s to its canonical identity",(text,id)=>{
    expect(resolveExplicitPassage(text)?.passage.canonicalBookId).toBe(id);
  });
  it("keeps book-only coordinates empty and validates full ranges",()=>{
    expect(resolveExplicitPassage("Romans")?.passage).toEqual({canonicalBookId:45,startChapter:null,startVerse:null,endChapter:null,endVerse:null});
    expect(resolveExplicitPassage("Romans 8:1–9:3")?.passage).toEqual({canonicalBookId:45,startChapter:8,startVerse:1,endChapter:9,endVerse:3});
  });
  it.each(["Romans 99","Romans 8:99","Romans 8 and John 3","Romans and John","About hope in Romans 8","", "Paul"])('does not infer a primary field from %s',text=>{
    expect(resolveExplicitPassage(text)).toBeNull();
  });
  it("uses a preserved source title, not the cleaned application title",()=>{
    expect(assessPrimaryBook({...empty,sourceTitles:["Anonymised Hope — Romans 8:1–11"]})).toMatchObject({outcome:"newly_assigned",reason:"preserved_source_title",passage:{canonicalBookId:45}});
    expect(assessPrimaryBook(empty)).toMatchObject({outcome:"unresolved",reason:"missing_explicit_passage"});
  });
  it("retains missing, ambiguous and conflicting source evidence",()=>{
    expect(assessPrimaryBook({...empty,sourceTitles:["Romans 8 and John 3"]}).outcome).toBe("unresolved");
    expect(assessPrimaryBook({...empty,sourcePassages:["Romans 8","John 3"]}).reason).toBe("multiple_books_without_primary_designation");
    expect(assessPrimaryBook({...empty,sourcePassages:["Romans 8"],sourceTitles:["Example — Romans 9"]}).reason).toBe("conflicting_passage_ranges");
  });
  it("preserves human choices including a no-primary decision, and flags conflicts",()=>{
    const reference={id:"anonymised-reference",displayText:"Romans",canonicalBookId:45,startChapter:null,startVerse:null,endChapter:null,endVerse:null,
      relationshipRole:"primary",isLead:true,reviewStatus:"confirmed",provenance:"administrator"};
    expect(assessPrimaryBook({...empty,reviewStatus:"confirmed_none"})).toMatchObject({outcome:"preserved_human_selection",passage:null});
    expect(assessPrimaryBook({...empty,reviewStatus:"confirmed_passage",references:[reference],sourceTitles:["Example — John 3"]})).toMatchObject({outcome:"preserved_human_selection",reason:"human_selection_source_conflict",passage:{canonicalBookId:45}});
    expect(assessPrimaryBook({...empty,references:[{...reference,reviewStatus:"proposed",provenance:"title_proposal"}]}).outcome).toBe("already_correct");
  });
  it("normal metadata parsing fills only the missing book and never silently replaces a selection",()=>{
    const input=scriptureReferenceInputSchema.parse({displayText:"1 John 2:1–6",relationshipRole:"primary",isLead:true});
    expect(input).toMatchObject({canonicalBookId:62,startChapter:null,startVerse:null,endChapter:null,endVerse:null});
    expect(fillExplicitPrimaryBook({...input,canonicalBookId:45}).canonicalBookId).toBe(45);
    expect(scriptureReferenceInputSchema.safeParse({displayText:"Romans and John",relationshipRole:"primary"}).success).toBe(false);
    expect(scriptureReferenceInputSchema.parse({displayText:"John 3",relationshipRole:"unclassified"}).canonicalBookId).toBeNull();
  });
});
