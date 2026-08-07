import { describe, expect, it } from "vitest";
import { deterministicSourceUuid } from "../src/migration/identity";
import {
  normalizeReferenceName,
  protestantBibleBooks,
  referenceCatalogueSha256,
  resolveCanonicalBibleBook,
  savingGraceSpeakers
} from "../src/migration/reference-catalogue";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";

describe("Saving Grace reference catalogue", () => {
  it("contains exactly the seven confirmed speakers with deterministic unique identities", () => {
    expect(savingGraceSpeakers.map((speaker) => speaker.name)).toEqual([
      "Binoy Joseph",
      "Matthew Johnston",
      "Nathan Vella",
      "Ralph Gambardella",
      "Rodney Hole",
      "Wesam Saad",
      "Yang Yu"
    ]);
    expect(new Set(savingGraceSpeakers.map((speaker) => speaker.id)).size).toBe(7);
    expect(new Set(savingGraceSpeakers.map((speaker) => speaker.slug)).size).toBe(7);
    for (const speaker of savingGraceSpeakers) {
      expect(speaker.id).toBe(deterministicSourceUuid("savinggrace-public-speaker", speaker.slug));
      expect(Object.keys(speaker).sort()).toEqual(["id", "name", "slug"]);
    }
    expect(JSON.stringify(savingGraceSpeakers)).not.toMatch(/sermonCount|sourceCount|legacyCount|"122"|"311"/i);
  });

  it("contains the exact 66-book Protestant canon in stable biblical order", () => {
    expect(protestantBibleBooks).toHaveLength(66);
    expect(protestantBibleBooks.filter((book) => book.testament === "old")).toHaveLength(39);
    expect(protestantBibleBooks.filter((book) => book.testament === "new")).toHaveLength(27);
    expect(protestantBibleBooks.map((book) => book.canonicalOrder)).toEqual(
      Array.from({ length: 66 }, (_, index) => index + 1)
    );
    expect(protestantBibleBooks[0]?.canonicalName).toBe("Genesis");
    expect(protestantBibleBooks[38]?.canonicalName).toBe("Malachi");
    expect(protestantBibleBooks[39]?.canonicalName).toBe("Matthew");
    expect(protestantBibleBooks[65]?.canonicalName).toBe("Revelation");
    expect(new Set(protestantBibleBooks.map((book) => book.canonicalName)).size).toBe(66);
    expect(new Set(protestantBibleBooks.map((book) => book.slug)).size).toBe(66);
    expect(new Set(protestantBibleBooks.map((book) => book.classificationId)).size).toBe(66);
  });

  it("maps canonical names, slugs, abbreviations and aliases without cross-book ambiguity", () => {
    const keys = new Map<string, number>();
    for (const book of protestantBibleBooks) {
      for (const value of [book.canonicalName, book.slug, ...book.abbreviations, ...book.aliases]) {
        const key = normalizeReferenceName(value);
        const existing = keys.get(key);
        expect(existing === undefined || existing === book.id).toBe(true);
        keys.set(key, book.id);
        expect(resolveCanonicalBibleBook(value)?.id).toBe(book.id);
      }
    }
    expect(resolveCanonicalBibleBook("Psalm")?.canonicalName).toBe("Psalms");
    expect(resolveCanonicalBibleBook("Song of Songs")?.canonicalName).toBe("Song of Solomon");
    expect(resolveCanonicalBibleBook("First John")?.canonicalName).toBe("1 John");
    expect(resolveCanonicalBibleBook("not a biblical book")).toBeNull();
    expect(referenceCatalogueSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derives distinct administrator and publicly eligible counts in the repository", async () => {
    const calls: string[] = [];
    const database = {
      async query(text: string) {
        calls.push(text);
        return { rows: [] };
      }
    };
    const repository = new PostgresAdminSermonRepository(database as never);
    await repository.listTaxonomies("speakers");
    await repository.listTaxonomies("books");
    expect(calls.every((text) => text.includes("count(DISTINCT sermon.id)"))).toBe(true);
    expect(calls.every((text) => text.includes("sermon.status = 'published'"))).toBe(true);
    expect(calls.every((text) => text.includes("readiness.is_complete"))).toBe(true);
    expect(calls[0]).toContain("sermon.speaker_id = reference.id");
    expect(calls[1]).toContain("sermon_book_classifications");
    expect(calls[1]).toContain("canonical.canonical_order NULLS LAST");
  });
});
