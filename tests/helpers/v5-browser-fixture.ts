/**
 * Anonymous V5 browser fixture. All sermon records are generated in memory;
 * this helper never imports database configuration, private content or providers.
 *
 * Launch: node --import tsx tests/helpers/v5-browser-fixture.ts
 * Optional port: V5_FIXTURE_PORT (default 4413). Open /sermons-v5/.
 * Stop with Ctrl+C. Only 127.0.0.1 is bound; no host override is accepted.
 */
import { createServer } from "node:http";
import type { PublicSermonListQuery } from "../../src/api/contracts/public-sermons";
import { sermonSummarySchema, type SermonDetail, type SermonSummary } from "../../src/domain/sermon";
import type { PublicSermonFilterOption, PublicSermonFilterOptions, PublicSermonRepository } from "../../src/server/repositories/sermon-repository";
import { createSealedStagingHandler } from "../../src/staging/handler";

const books = [
  { name: "Genesis", slug: "genesis" },
  { name: "Joshua", slug: "joshua" },
  { name: "Psalms", slug: "psalms" },
  { name: "Isaiah", slug: "isaiah" },
  { name: "Matthew", slug: "matthew" },
  { name: "Romans", slug: "romans" },
  { name: "James", slug: "james" },
  { name: "Revelation", slug: "revelation" }
];
const speakers = [
  { name: "Example Speaker One", slug: "example-speaker-one" },
  { name: "Example Speaker Two", slug: "example-speaker-two" }
];
const series = [
  { name: "An anonymous series", slug: "anonymous-series" },
  { name: "A second example series", slug: "second-example-series" }
];

const sermons: SermonSummary[] = Array.from({ length: 25 }, (_, index) => {
  const ordinal = String(index + 1).padStart(2, "0");
  const book = books[index % books.length]!;
  const durationSeconds = [2450, 4328, null][index % 3]!;
  return sermonSummarySchema.parse({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `Anonymous layout example ${ordinal}${index === 3 ? ": a longer synthetic title for narrow screens" : ""}`,
    slug: `anonymous-layout-${ordinal}`,
    serviceDate: `2026-01-${String(28 - index).padStart(2, "0")}`,
    summary: [
      `This is synthetic description ${ordinal}, written only to exercise the archive layout. It contains no actual sermon wording or private material. The opening paragraph gives the journal enough text to demonstrate its ordinary reading width and line wrapping.`,
      "This second synthetic paragraph makes the full description longer than the collapsed preview. Opening the description should reveal every sentence without changing the record, requesting a transcript, or duplicating content. Keyboard focus and the neighboring rows should remain easy to follow.",
      `The final synthetic paragraph marks the end of example ${ordinal}. It provides a stable ending for checks after appending another page, changing screen width, and opening or closing the description.`
    ].join("\n\n"),
    speaker: speakers[index % speakers.length]!,
    series: [series[Math.floor(index / 2) % series.length]!],
    scriptureReferences: [{ displayText: `${book.name} 1:1`, parseStatus: "curated" }],
    primaryPassages: [{ displayText: `${book.name} 1:1`, isLead: true }],
    primaryPassageState: "assigned",
    books: [book],
    primaryMedia: null,
    recordingDuration: durationSeconds === null ? null : {
      provider: "sermonaudio", mediaType: "audio", externalId: `synthetic-recording-${ordinal}`, durationSeconds
    }
  });
});

function matchingSermons(query: PublicSermonListQuery): SermonSummary[] {
  const words = query.query?.toLocaleLowerCase("en-AU").split(/\s+/u) ?? [];
  const selectedBook = query.passageBook ?? query.book;
  const selected = sermons.filter(sermon => {
    const searchable = [sermon.title, sermon.summary, sermon.speaker?.name,
      ...sermon.series.map(item => item.name), ...sermon.books.map(item => item.name)].join(" ").toLocaleLowerCase("en-AU");
    return (!query.speaker || sermon.speaker?.slug === query.speaker)
      && (!query.series || sermon.series.some(item => item.slug === query.series))
      && (!selectedBook || sermon.books.some(item => item.slug === selectedBook))
      && (!query.dateFrom || sermon.serviceDate >= query.dateFrom)
      && (!query.dateTo || sermon.serviceDate <= query.dateTo)
      && (!query.passage || query.passage === `${sermon.books[0]!.slug}-1-1`)
      && (query.passageChapter === undefined || query.passageChapter === 1)
      && (query.passageVerse === undefined || query.passageVerse === 1)
      && words.every(word => searchable.includes(word));
  });
  return selected.sort((left, right) => {
    const dateOrder = left.serviceDate.localeCompare(right.serviceDate);
    return (query.order === "ASC" ? dateOrder : -dateOrder) || left.id.localeCompare(right.id);
  });
}

function counted(items: PublicSermonFilterOption[], belongs: (sermon: SermonSummary, slug: string) => boolean) {
  return items.map(item => ({ ...item, sermonCount: sermons.filter(sermon => belongs(sermon, item.slug)).length }));
}

const options: PublicSermonFilterOptions = {
  speakers: counted(speakers, (sermon, slug) => sermon.speaker?.slug === slug),
  series: counted(series, (sermon, slug) => sermon.series.some(item => item.slug === slug)),
  books: counted(books, (sermon, slug) => sermon.books.some(item => item.slug === slug)),
  passages: books.map(book => ({ name: `${book.name} 1:1`, slug: `${book.slug}-1-1` })),
  passageVerseAvailability: books.map(book => ({ bookSlug: book.slug, chapter: 1, verses: [1] }))
};

const repository: PublicSermonRepository = {
  async listPublished(query) {
    const matching = matchingSermons(query);
    return { data: matching.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), totalItems: matching.length };
  },
  async findPublishedBySlug(slug): Promise<SermonDetail | null> {
    const sermon = sermons.find(item => item.slug === slug);
    return sermon ? { ...sermon, seoDescription: null, body: null,
      media: [{ provider: "sermonaudio", mediaType: "audio", externalId: "1111111111111",
        canonicalUrl: "https://www.sermonaudio.com/sermons/1111111111111", title: "Synthetic audio fixture" }],
      transcript: { bodyText: "An anonymous transcript for browser layout testing. No real sermon wording is used.\n\nA second synthetic paragraph checks readable line lengths and the native disclosure control." },
      questionAnswers: [{ question: "What does this anonymous layout fixture demonstrate?", answer: "It tests the placement of a complete answer without using private sermon content.", displayOrder: 1 }],
      relatedSermons: [] } : null;
  },
  async listPublishedFilterOptions() { return options; },
  async listPublishedTopicalSermons() { return []; },
  async listPublishedSeriesRepresentatives() { return []; },
  async listPublishedSitemapEntries() { return []; },
  async findPublicPathDisposition() { return null; }
};

const portText = process.env.V5_FIXTURE_PORT ?? "4413";
const port = Number(portText);
if (!/^\d+$/u.test(portText) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("V5_FIXTURE_PORT must be an integer from 1024 through 65535");
}
const origin = `http://127.0.0.1:${port}`;
// The real visitor handler supplies the real route, asset, CSP and noindex
// behavior. Its private-route denial remains in force; there is no admin login.
const handle = createSealedStagingHandler(repository, async () => {}, "0".repeat(40));
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? "/", origin);
    const host = incoming.headers.host;
    if (url.origin !== origin || (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)) {
      outgoing.writeHead(400, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      outgoing.end("Invalid fixture origin");
      return;
    }
    const response = await handle(new Request(url, { method: incoming.method ?? "GET" }));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    outgoing.end("Anonymous fixture unavailable");
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ status: "anonymous_v5_fixture_ready", origin, path: "/sermons-v5/", records: sermons.length }));
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
