import { verseCountsForBook } from "./protestant-bible-versification";

export const biblePassageParserVersion = "saving-grace-primary-passage-v1" as const;

type Testament = "old" | "new";

export const bibleBookCategories = [
  { key: "law", label: "Law / Pentateuch", firstBookId: 1, lastBookId: 5 },
  { key: "history", label: "Historical books", firstBookId: 6, lastBookId: 17 },
  { key: "wisdom", label: "Wisdom and Poetry", firstBookId: 18, lastBookId: 22 },
  { key: "major-prophets", label: "Major Prophets", firstBookId: 23, lastBookId: 27 },
  { key: "minor-prophets", label: "Minor Prophets", firstBookId: 28, lastBookId: 39 },
  { key: "gospels", label: "Gospels", firstBookId: 40, lastBookId: 43 },
  { key: "acts", label: "Acts", firstBookId: 44, lastBookId: 44 },
  { key: "pauline", label: "Pauline Epistles", firstBookId: 45, lastBookId: 57 },
  { key: "general", label: "General Epistles", firstBookId: 58, lastBookId: 65 },
  { key: "revelation", label: "Revelation", firstBookId: 66, lastBookId: 66 }
] as const;

export type BibleBookCategory = typeof bibleBookCategories[number]["key"];

export interface BibleBookDefinition {
  id: number;
  canonicalName: string;
  slug: string;
  testament: Testament;
  canonicalOrder: number;
  chapterCount: number;
  verseCounts: readonly number[];
  abbreviation: string;
  category: BibleBookCategory;
  aliases: readonly string[];
}

const source = [
  ["Genesis", "genesis", 50, ["Gen", "Ge"]],
  ["Exodus", "exodus", 40, ["Exod", "Ex"]],
  ["Leviticus", "leviticus", 27, ["Lev"]],
  ["Numbers", "numbers", 36, ["Num"]],
  ["Deuteronomy", "deuteronomy", 34, ["Deut", "Dt"]],
  ["Joshua", "joshua", 24, ["Josh"]],
  ["Judges", "judges", 21, ["Judg", "Jdg"]],
  ["Ruth", "ruth", 4, ["Rth"]],
  ["1 Samuel", "1-samuel", 31, ["1 Sam", "First Samuel"]],
  ["2 Samuel", "2-samuel", 24, ["2 Sam", "Second Samuel"]],
  ["1 Kings", "1-kings", 22, ["1 Kgs", "First Kings"]],
  ["2 Kings", "2-kings", 25, ["2 Kgs", "Second Kings"]],
  ["1 Chronicles", "1-chronicles", 29, ["1 Chr", "First Chronicles"]],
  ["2 Chronicles", "2-chronicles", 36, ["2 Chr", "Second Chronicles"]],
  ["Ezra", "ezra", 10, ["Ezr"]],
  ["Nehemiah", "nehemiah", 13, ["Neh"]],
  ["Esther", "esther", 10, ["Esth"]],
  ["Job", "job", 42, ["Jb"]],
  ["Psalms", "psalms", 150, ["Psalm", "Ps"]],
  ["Proverbs", "proverbs", 31, ["Prov"]],
  ["Ecclesiastes", "ecclesiastes", 12, ["Eccl", "Qoheleth"]],
  ["Song of Solomon", "song-of-solomon", 8, ["Song", "Song of Songs", "Canticles"]],
  ["Isaiah", "isaiah", 66, ["Isa"]],
  ["Jeremiah", "jeremiah", 52, ["Jer"]],
  ["Lamentations", "lamentations", 5, ["Lam"]],
  ["Ezekiel", "ezekiel", 48, ["Ezek"]],
  ["Daniel", "daniel", 12, ["Dan"]],
  ["Hosea", "hosea", 14, ["Hos"]],
  ["Joel", "joel", 3, ["Jl"]],
  ["Amos", "amos", 9, ["Am"]],
  ["Obadiah", "obadiah", 1, ["Obad"]],
  ["Jonah", "jonah", 4, []],
  ["Micah", "micah", 7, ["Mic"]],
  ["Nahum", "nahum", 3, ["Nah"]],
  ["Habakkuk", "habakkuk", 3, ["Hab"]],
  ["Zephaniah", "zephaniah", 3, ["Zeph"]],
  ["Haggai", "haggai", 2, ["Hag"]],
  ["Zechariah", "zechariah", 14, ["Zech"]],
  ["Malachi", "malachi", 4, ["Mal"]],
  ["Matthew", "matthew", 28, ["Matt"]],
  ["Mark", "mark", 16, ["Mk"]],
  ["Luke", "luke", 24, ["Lk"]],
  ["John", "john", 21, ["Jn"]],
  ["Acts", "acts", 28, ["Ac", "Acts of the Apostles"]],
  ["Romans", "romans", 16, ["Rom"]],
  ["1 Corinthians", "1-corinthians", 16, ["1 Cor", "First Corinthians"]],
  ["2 Corinthians", "2-corinthians", 13, ["2 Cor", "Second Corinthians"]],
  ["Galatians", "galatians", 6, ["Gal"]],
  ["Ephesians", "ephesians", 6, ["Eph"]],
  ["Philippians", "philippians", 4, ["Phil"]],
  ["Colossians", "colossians", 4, ["Col"]],
  ["1 Thessalonians", "1-thessalonians", 5, ["1 Thess", "First Thessalonians"]],
  ["2 Thessalonians", "2-thessalonians", 3, ["2 Thess", "Second Thessalonians"]],
  ["1 Timothy", "1-timothy", 6, ["1 Tim", "First Timothy"]],
  ["2 Timothy", "2-timothy", 4, ["2 Tim", "Second Timothy"]],
  ["Titus", "titus", 3, ["Tit"]],
  ["Philemon", "philemon", 1, ["Phlm"]],
  ["Hebrews", "hebrews", 13, ["Heb"]],
  ["James", "james", 5, ["Jas"]],
  ["1 Peter", "1-peter", 5, ["1 Pet", "First Peter"]],
  ["2 Peter", "2-peter", 3, ["2 Pet", "Second Peter"]],
  ["1 John", "1-john", 5, ["1 Jn", "First John"]],
  ["2 John", "2-john", 1, ["2 Jn", "Second John"]],
  ["3 John", "3-john", 1, ["3 Jn", "Third John"]],
  ["Jude", "jude", 1, ["Jud"]],
  ["Revelation", "revelation", 22, ["Rev", "Revelation of John", "Apocalypse"]]
] as const;

export const bibleBooks: readonly BibleBookDefinition[] = source.map(
  ([canonicalName, slug, chapterCount, aliases], index) => {
    const id = index + 1;
    const verseCounts = verseCountsForBook(slug);
    const category = bibleBookCategories.find(
      (item) => id >= item.firstBookId && id <= item.lastBookId
    );
    if (!verseCounts || verseCounts.length !== chapterCount || !category) {
      throw new Error(`Canonical Bible metadata is incomplete for ${canonicalName}`);
    }
    return {
      id,
      canonicalName,
      slug,
      testament: index < 39 ? "old" : "new",
      canonicalOrder: id,
      chapterCount,
      verseCounts,
      abbreviation: aliases[0] ?? canonicalName,
      category: category.key,
      aliases: [canonicalName, slug, ...aliases]
    };
  }
);

const singleChapterBookIds = new Set([31, 57, 63, 64, 65]);

export function normalizeBibleBookName(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

const booksById = new Map(bibleBooks.map((book) => [book.id, book]));
const booksBySlug = new Map(bibleBooks.map((book) => [book.slug, book]));
const booksByName = new Map<string, BibleBookDefinition>();
for (const book of bibleBooks) {
  for (const alias of book.aliases) {
    const key = normalizeBibleBookName(alias);
    const current = booksByName.get(key);
    if (current && current.id !== book.id) throw new Error("Ambiguous Bible-book alias");
    booksByName.set(key, book);
  }
}

export function bibleBookById(id: number): BibleBookDefinition | null {
  return booksById.get(id) ?? null;
}

export function bibleBookBySlug(slug: string): BibleBookDefinition | null {
  return booksBySlug.get(slug.toLowerCase()) ?? null;
}

export function resolveBibleBook(value: string): BibleBookDefinition | null {
  return booksByName.get(normalizeBibleBookName(value)) ?? null;
}

export interface StructuredBiblePassage {
  canonicalBookId: number;
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
  displayText: string;
  originalReferenceText: string;
}

export interface PassageValidationResult {
  valid: boolean;
  issues: string[];
}

export interface PrimaryPassageCoordinates {
  canonicalBookId: number;
  startChapter: number | null;
  startVerse: number | null;
  endChapter: number | null;
  endVerse: number | null;
}

export function validateBiblePassage(
  value: PrimaryPassageCoordinates
): PassageValidationResult {
  const issues: string[] = [];
  const book = bibleBookById(value.canonicalBookId);
  if (!book) issues.push("Unknown canonical Bible book");
  if ((value.startChapter === null) !== (value.endChapter === null)) {
    issues.push("Starting and ending chapters must either both be present or both be absent");
  }
  if (value.startChapter !== null && (!Number.isInteger(value.startChapter) || value.startChapter < 1 || (book && value.startChapter > book.chapterCount))) {
    issues.push("Starting chapter is outside the canonical book");
  }
  if (value.endChapter !== null && (!Number.isInteger(value.endChapter) || value.endChapter < 1 || (book && value.endChapter > book.chapterCount))) {
    issues.push("Ending chapter is outside the canonical book");
  }
  for (const [label, verse, chapter] of [
    ["Starting", value.startVerse, value.startChapter],
    ["Ending", value.endVerse, value.endChapter]
  ] as const) {
    const chapterVerseCount = book && chapter !== null ? book.verseCounts[chapter - 1] : undefined;
    if (verse !== null && (
      !Number.isInteger(verse) || verse < 1 || chapterVerseCount === undefined || verse > chapterVerseCount
    )) {
      issues.push(`${label} verse is outside the canonical chapter`);
    }
  }
  if ((value.startVerse !== null || value.endVerse !== null) && value.startChapter === null) {
    issues.push("A verse requires a parent book and chapter");
  }
  if (value.endVerse !== null && value.startVerse === null) issues.push("An ending verse requires a starting verse");
  if (value.startChapter !== null && value.endChapter !== null) {
    const start = value.startChapter * 1_000 + (value.startVerse ?? 0);
    const end = value.endChapter * 1_000 + (value.endVerse ?? 999);
    if (end < start) issues.push("Passage range is reversed");
  }
  return { valid: issues.length === 0, issues };
}

export function formatBiblePassage(value: PrimaryPassageCoordinates): string {
  const book = bibleBookById(value.canonicalBookId);
  if (!book) throw new Error("Unknown canonical Bible book");
  if (value.startChapter === null || value.endChapter === null) return book.canonicalName;
  const start = `${book.canonicalName} ${value.startChapter}${value.startVerse === null ? "" : `:${value.startVerse}`}`;
  if (value.endChapter === value.startChapter && value.endVerse === value.startVerse) return start;
  if (value.startVerse === null && value.endVerse === null) {
    return value.endChapter === value.startChapter ? start : `${start}–${value.endChapter}`;
  }
  if (value.endChapter === value.startChapter) return `${start}–${value.endVerse}`;
  return `${start}–${value.endChapter}:${value.endVerse}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const aliasEntries = bibleBooks
  .flatMap((book) => book.aliases.map((alias) => ({ book, alias })))
  .sort((left, right) => right.alias.length - left.alias.length);
const aliasPattern = aliasEntries
  .map(({ alias }) => escapeRegExp(alias).replace(/[\s-]+/g, "[\\s.-]+"))
  .join("|");
const referencePattern = new RegExp(
  `(?:^|(?<=[^A-Za-z0-9]))(?<book>${aliasPattern})\\s+(?<first>\\d{1,3})(?::(?<verse>\\d{1,3}))?(?:\\s*[\\-–—]\\s*(?:(?<endChapter>\\d{1,3}):)?(?<endVerseOrChapter>\\d{1,3}))?(?=$|[^A-Za-z0-9])`,
  "giu"
);

function passageFromMatch(match: RegExpExecArray): StructuredBiblePassage | null {
  const groups = match.groups ?? {};
  const book = resolveBibleBook(groups.book ?? "");
  if (!book) return null;
  const first = Number(groups.first);
  const explicitVerse = groups.verse === undefined ? null : Number(groups.verse);
  const rangeEnd = groups.endVerseOrChapter === undefined ? null : Number(groups.endVerseOrChapter);
  const explicitEndChapter = groups.endChapter === undefined ? null : Number(groups.endChapter);
  const singleChapter = singleChapterBookIds.has(book.id);
  const startChapter = singleChapter && explicitVerse === null ? 1 : first;
  const startVerse = singleChapter && explicitVerse === null ? first : explicitVerse;
  let endChapter = startChapter;
  let endVerse = startVerse;
  if (rangeEnd !== null) {
    if (explicitEndChapter !== null) {
      endChapter = explicitEndChapter;
      endVerse = rangeEnd;
    } else if (startVerse !== null) {
      endVerse = rangeEnd;
    } else {
      endChapter = rangeEnd;
      endVerse = null;
    }
  }
  const coordinates = { canonicalBookId: book.id, startChapter, startVerse, endChapter, endVerse };
  if (!validateBiblePassage(coordinates).valid) return null;
  return {
    ...coordinates,
    displayText: formatBiblePassage(coordinates),
    originalReferenceText: match[0]!.trim()
  };
}

export type TitlePassageExtraction =
  | { outcome: "one_valid_reference"; passage: StructuredBiblePassage }
  | { outcome: "no_reference"; passage: null }
  | { outcome: "manual_review_required"; passage: null; reason: "multiple_references" | "invalid_reference" };

export function extractPrimaryPassageFromTitle(title: string): TitlePassageExtraction {
  referencePattern.lastIndex = 0;
  const valid: StructuredBiblePassage[] = [];
  let candidateCount = 0;
  for (const match of title.normalize("NFKC").matchAll(referencePattern)) {
    candidateCount += 1;
    const passage = passageFromMatch(match);
    if (passage) valid.push(passage);
  }
  if (valid.length === 1 && candidateCount === 1) return { outcome: "one_valid_reference", passage: valid[0]! };
  if (candidateCount === 0) return { outcome: "no_reference", passage: null };
  return {
    outcome: "manual_review_required",
    passage: null,
    reason: valid.length > 1 ? "multiple_references" : "invalid_reference"
  };
}

export function passageQueryLabel(input: {
  passageBook?: string | undefined;
  passageChapter?: number | undefined;
  passageVerse?: number | undefined;
  passageEndVerse?: number | undefined;
}): string | null {
  if (!input.passageBook) return null;
  const book = bibleBookBySlug(input.passageBook);
  if (!book) return null;
  if (input.passageChapter === undefined) return book.canonicalName;
  if (input.passageVerse === undefined) return `${book.canonicalName} ${input.passageChapter}`;
  const end = input.passageEndVerse && input.passageEndVerse !== input.passageVerse
    ? `–${input.passageEndVerse}`
    : "";
  return `${book.canonicalName} ${input.passageChapter}:${input.passageVerse}${end}`;
}

export function biblePassageIntervalsOverlap(
  left: Pick<StructuredBiblePassage, "canonicalBookId" | "startChapter" | "startVerse" | "endChapter" | "endVerse">,
  right: Pick<StructuredBiblePassage, "canonicalBookId" | "startChapter" | "startVerse" | "endChapter" | "endVerse">
): boolean {
  if (left.canonicalBookId !== right.canonicalBookId ||
    !validateBiblePassage(left).valid || !validateBiblePassage(right).valid) return false;
  const leftStart = left.startChapter * 1_000 + (left.startVerse ?? 0);
  const leftEnd = left.endChapter * 1_000 + (left.endVerse ?? 999);
  const rightStart = right.startChapter * 1_000 + (right.startVerse ?? 0);
  const rightEnd = right.endChapter * 1_000 + (right.endVerse ?? 999);
  return leftStart <= rightEnd && leftEnd >= rightStart;
}
