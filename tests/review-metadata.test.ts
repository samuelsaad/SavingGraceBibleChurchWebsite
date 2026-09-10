import {describe,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import {resolveSourceSpeaker,selectedReviewBook,changedReviewBookSelection,reviewBookOptions} from "../src/domain/review-metadata";

const evidence={sourceWordPressId:100,relationshipCount:1,termIds:[12],evidenceSha256:"a".repeat(64)};
const catalogue=[{id:"first",sourceTermId:12},{id:"second",sourceTermId:13}];
describe("source-backed review metadata, never approval",()=>{
  it("maps exactly one source term, without a popularity or first-speaker fallback",()=>{
    expect(resolveSourceSpeaker(null,evidence,catalogue)).toEqual({speakerId:"first",reason:"verified_source_term_mapping"});
    expect(resolveSourceSpeaker(null,{...evidence,termIds:[99]},catalogue).speakerId).toBeNull();
    expect(resolveSourceSpeaker(null,{...evidence,relationshipCount:2,termIds:[12,13]},catalogue).speakerId).toBeNull();
    expect(resolveSourceSpeaker(null,evidence,[...catalogue,{id:"duplicate",sourceTermId:12}]).speakerId).toBeNull();
    expect(resolveSourceSpeaker(null,{...evidence,evidenceSha256:"bad"},catalogue).speakerId).toBeNull();
  });
  it("preserves a selected or explicitly cleared value but not an untouched blank",()=>{
    expect(resolveSourceSpeaker("second",evidence,catalogue).speakerId).toBe("second");
    expect(resolveSourceSpeaker(null,evidence,catalogue,true).reason).toBe("human_clearing_preserved");
    expect(resolveSourceSpeaker(null,evidence,catalogue,false).speakerId).toBe("first");
  });
  it("prefills a pending lead primary book, preserves numbered books and human classifications",()=>{
    const books=[{id:"john",canonicalBookId:43},{id:"first-john",canonicalBookId:62}];
    const primary={canonicalBookId:62,relationshipRole:"primary",isLead:true,reviewStatus:"proposed"};
    expect(selectedReviewBook([], [primary],books)).toBe("first-john");
    expect(selectedReviewBook([{id:"human"}], [primary],books)).toBe("human");
    expect(selectedReviewBook([], [{...primary,reviewStatus:"rejected"}],books)).toBe("");
    expect(selectedReviewBook([], [primary,primary],books)).toBe("");
    expect(selectedReviewBook([], [],books)).toBe("");
  });
  it("saving the same projection leaves all stored classifications and secondary passages alone",()=>{
    expect(changedReviewBookSelection("first-john","first-john")).toEqual({});
    expect(changedReviewBookSelection("first-john","john")).toEqual({bookClassificationIds:["john"]});
    expect(changedReviewBookSelection("first-john","")).toEqual({bookClassificationIds:[]});
  });
  it("keeps an existing noncanonical classification selected without guessing its canonical identity",()=>{
    const books=[{id:"canonical",canonicalBookId:43},{id:"saved-legacy",canonicalBookId:null},{id:"unrelated-legacy",canonicalBookId:null}];
    const existing=[{id:"saved-legacy"}];
    const options=reviewBookOptions(existing,books);
    expect(options.map(book=>book.id)).toEqual(["canonical","saved-legacy"]);
    const selected=selectedReviewBook(existing,[],options);
    expect(options.some(book=>book.id===selected)).toBe(true);
    expect(changedReviewBookSelection(selected,selected)).toEqual({});
    expect(reviewBookOptions([],books).map(book=>book.id)).toEqual(["canonical"]);
  });
  it("removes misleading manual-only hints, retains pending decisions and saves only explicit book changes",async()=>{
    const code=await readFile("src/admin/dashboard.ts","utf8");
    expect(code).not.toContain("No speaker is selected automatically.");
    expect(code).not.toContain("There is no automatic or default assignment.");
    expect(code).toContain("preselection is not approval");
    expect(code).toContain("changedReviewBookSelection");
    expect(code).toContain('action === "confirm" ? "confirmed" : "pending"');
  });
});
