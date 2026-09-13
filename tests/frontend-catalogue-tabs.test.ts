import { describe, expect, it } from "vitest";
import { bibleBooks } from "../src/domain/bible-passage";
import type { SermonSummary } from "../src/domain/sermon";
import { catalogue, entry } from "../src/frontend/components/catalogue";
import { previewRenderContext, publicRenderContext, siteLinks } from "../src/frontend/routes";
import { coreStyles } from "../src/frontend/styles/core";

const fixture: SermonSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "An example catalogue entry",
  slug: "example-catalogue-entry",
  serviceDate: "2026-01-04",
  summary: "An anonymised description for layout verification only.",
  speaker: { name: "Example Speaker", slug: "example-speaker" },
  series: [], scriptureReferences: [], primaryPassages: [],
  primaryPassageState: "assigned",
  books: [{ name: "Romans", slug: "romans" }], primaryMedia: null
};

describe("consistent book tabs on every sermon listing", () => {
  it("uses slimmer shared side columns without shortening or hiding the book label", () => {
    expect(coreStyles).toContain("grid-template-columns: 2.75rem minmax(0, 1fr)");
    expect(coreStyles).toContain(".entry, .entry--card { grid-template-columns: 2.25rem minmax(0, 1fr)");
    expect(coreStyles).toContain("width: 100%; height: 100%; min-height: 10rem; justify-content: center");
    expect(coreStyles).not.toContain("grid-template-columns: 3.5rem minmax(0, 1fr)");
  });
  for (const variant of ["card", "row", "related"] as const) {
    it(`${variant} shows the classified book and category without a count badge`, () => {
      for (const book of bibleBooks) {
        const result = entry({ ...fixture, books: [{ name: book.canonicalName, slug: book.slug }] }, {
          variant, headingLevel: 3, links: siteLinks(previewRenderContext), ordinal: 3
        }).toString();
        expect(result).toContain(`class="entry entry--${variant} hue--${book.category}"`);
        expect(result).toContain('<div class="entry__tab">');
        expect(result).toContain(`href="/frontend-preview/books/${book.slug}/"`);
        expect(result).toContain(`<span class="tab__name" aria-hidden="true">${book.canonicalName}</span>`);
        expect(result).not.toContain('class="tab__count"');
        expect(result).not.toContain('class="entry__ordinal"');
        expect(result).toContain('href="/frontend-preview/sermons/example-catalogue-entry/"');
        expect(result).toContain('href="/frontend-preview/speakers/example-speaker/"');
      }
    });
  }

  it("keeps pagination order and public filter routes intact", () => {
    const result = catalogue([fixture, { ...fixture, slug: "second-example" }], {
      variant: "row", headingLevel: 2, links: siteLinks(publicRenderContext), ordinalStart: 51
    }).toString();
    expect(result).toContain('<ol class="catalogue" role="list" start="51">');
    expect(result).toContain('<span class="sr-only">Result 51.</span>');
    expect(result).toContain('<span class="sr-only">Result 52.</span>');
    expect(result).toContain('href="/sermons/?sermon_book=romans"');
    expect(result.indexOf('href="/sermons/example-catalogue-entry/"')).toBeLessThan(result.indexOf('href="/sermons/second-example/"'));
    expect(result).not.toContain("/frontend-preview/");
  });

  it("uses a neutral placeholder without guessing a missing or unknown classification", () => {
    for (const books of [[], [{ name: "Unresolved", slug: "unresolved" }]]) {
      const result = entry({ ...fixture, books }, {
        variant: "row", headingLevel: 2, links: siteLinks(previewRenderContext)
      }).toString();
      expect(result).toContain("tab--ghost");
      expect(result).not.toContain("/books/");
      expect(result).not.toContain("hue--");
    }
  });
});
