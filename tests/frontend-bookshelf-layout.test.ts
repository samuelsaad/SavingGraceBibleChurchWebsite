import { describe, expect, it } from "vitest";
import { bibleBooks } from "../src/domain/bible-passage";
import { emptyFilterOptions } from "../src/frontend";
import { shelf } from "../src/frontend/components/shelf";
import { bookshelfLayoutStyles } from "../src/frontend/styles/bookshelf-layout";
import { claudeSermonStyles } from "../src/frontend/styles/claude-sermons";
import { shelfStyles } from "../src/frontend/styles/shelf";
import { font } from "../src/frontend/tokens";

describe("shared contained bookshelf lettering", () => {
  it("uses one measured geometry and the delivered church font on V1/V2 and scoped V4", () => {
    expect(shelfStyles).toContain(bookshelfLayoutStyles());
    expect(claudeSermonStyles).toContain(bookshelfLayoutStyles(".claude-sermons "));
    const styles = bookshelfLayoutStyles();
    expect(styles).toContain(`font-family: ${font.signage}`);
    expect(styles).toContain("font-stretch: normal");
    expect(styles).not.toMatch(/Bahnschrift|Arial Narrow|overflow: hidden|text-overflow/);
  });

  it("reserves independent label and non-wrapping count rows instead of flex overflow", () => {
    const styles = bookshelfLayoutStyles();
    expect(styles).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(styles).toContain("justify-content: stretch");
    expect(styles).toContain("white-space: nowrap");
    expect(styles).toContain("width: max-content");
    expect(styles).toContain("height: auto");
    expect(styles).toContain("--spine-height: 9.5rem");
    expect(styles).toContain('spine[data-len="mid"] .spine__abbr { display: block; }');
    expect(styles).toContain("--spine-height: 5rem");
    expect(styles).toContain("@media (pointer: coarse)");
    expect(styles).toContain("--spine-base: 2.75rem");
  });

  it("retains all 66 names, canonical order, genuine counts and server-rendered book links", () => {
    const options = {...emptyFilterOptions, books: bibleBooks.map((b, i) => ({
      name: b.canonicalName, slug: b.slug, sermonCount: [1, 28, 144][i % 3]!
    }))};
    const markup = String(shelf(options, {href: b => `/books/${b.slug}/`, skipTo: "results", headingId: "bookshelf"}));
    expect(markup.match(/class="spine__link"/g)).toHaveLength(66);
    let last = -1;
    for (const book of bibleBooks) {
      const position = markup.indexOf(`href="/books/${book.slug}/"`);
      expect(position).toBeGreaterThan(last);
      expect(markup).toContain(`${book.canonicalName},`);
      last = position;
    }
    expect(markup).toContain('class="spine__count" aria-hidden="true">144</span>');
    expect(markup).toContain('class="shelf__skip"');
  });

  it("keeps empty books noninteractive, full accessible names and unchanged no-JS destinations", () => {
    const markup = String(shelf({...emptyFilterOptions, books: [{name: "Colossians", slug: "colossians", sermonCount: 28}]}, {
      href: b => `/sermons-v4/?sermon_book=${b.slug}`, skipTo: "results", headingId: "bookshelf"
    }));
    expect(markup.match(/class="spine__link"/g)).toHaveLength(1);
    expect(markup.match(/class="spine__ghost"/g)).toHaveLength(65);
    expect(markup).toContain("Colossians, 28 sermons");
    expect(markup).toContain('href="/sermons-v4/?sermon_book=colossians"');
    expect(markup).not.toContain('href="/sermons-v4/?sermon_book=revelation"');
  });
});
