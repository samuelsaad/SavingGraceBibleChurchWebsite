import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { assertDisposableLocalDatabase } from "./local-database-safety";
import { deterministicSourceUuid } from "./identity";

export const referenceCatalogueVersion = "saving-grace-reference-catalogue-v1";

const speakerNames = [
  "Binoy Joseph",
  "Matthew Johnston",
  "Nathan Vella",
  "Ralph Gambardella",
  "Rodney Hole",
  "Wesam Saad",
  "Yang Yu"
] as const;

const bibleBookSource = [
  ["Genesis", ["Gen", "Ge"], []],
  ["Exodus", ["Exod", "Ex"], []],
  ["Leviticus", ["Lev"], []],
  ["Numbers", ["Num"], []],
  ["Deuteronomy", ["Deut", "Dt"], []],
  ["Joshua", ["Josh"], []],
  ["Judges", ["Judg", "Jdg"], []],
  ["Ruth", ["Rth"], []],
  ["1 Samuel", ["1 Sam"], ["First Samuel"]],
  ["2 Samuel", ["2 Sam"], ["Second Samuel"]],
  ["1 Kings", ["1 Kgs"], ["First Kings"]],
  ["2 Kings", ["2 Kgs"], ["Second Kings"]],
  ["1 Chronicles", ["1 Chr"], ["First Chronicles"]],
  ["2 Chronicles", ["2 Chr"], ["Second Chronicles"]],
  ["Ezra", ["Ezr"], []],
  ["Nehemiah", ["Neh"], []],
  ["Esther", ["Esth"], []],
  ["Job", ["Jb"], []],
  ["Psalms", ["Ps"], ["Psalm"]],
  ["Proverbs", ["Prov"], []],
  ["Ecclesiastes", ["Eccl"], ["Qoheleth"]],
  ["Song of Solomon", ["Song"], ["Song of Songs", "Canticles"]],
  ["Isaiah", ["Isa"], []],
  ["Jeremiah", ["Jer"], []],
  ["Lamentations", ["Lam"], []],
  ["Ezekiel", ["Ezek"], []],
  ["Daniel", ["Dan"], []],
  ["Hosea", ["Hos"], []],
  ["Joel", ["Jl"], []],
  ["Amos", ["Am"], []],
  ["Obadiah", ["Obad"], []],
  ["Jonah", ["Jonah"], []],
  ["Micah", ["Mic"], []],
  ["Nahum", ["Nah"], []],
  ["Habakkuk", ["Hab"], []],
  ["Zephaniah", ["Zeph"], []],
  ["Haggai", ["Hag"], []],
  ["Zechariah", ["Zech"], []],
  ["Malachi", ["Mal"], []],
  ["Matthew", ["Matt"], []],
  ["Mark", ["Mk"], []],
  ["Luke", ["Lk"], []],
  ["John", ["Jn"], []],
  ["Acts", ["Ac"], ["Acts of the Apostles"]],
  ["Romans", ["Rom"], []],
  ["1 Corinthians", ["1 Cor"], ["First Corinthians"]],
  ["2 Corinthians", ["2 Cor"], ["Second Corinthians"]],
  ["Galatians", ["Gal"], []],
  ["Ephesians", ["Eph"], []],
  ["Philippians", ["Phil"], []],
  ["Colossians", ["Col"], []],
  ["1 Thessalonians", ["1 Thess"], ["First Thessalonians"]],
  ["2 Thessalonians", ["2 Thess"], ["Second Thessalonians"]],
  ["1 Timothy", ["1 Tim"], ["First Timothy"]],
  ["2 Timothy", ["2 Tim"], ["Second Timothy"]],
  ["Titus", ["Tit"], []],
  ["Philemon", ["Phlm"], []],
  ["Hebrews", ["Heb"], []],
  ["James", ["Jas"], []],
  ["1 Peter", ["1 Pet"], ["First Peter"]],
  ["2 Peter", ["2 Pet"], ["Second Peter"]],
  ["1 John", ["1 Jn"], ["First John"]],
  ["2 John", ["2 Jn"], ["Second John"]],
  ["3 John", ["3 Jn"], ["Third John"]],
  ["Jude", ["Jud"], []],
  ["Revelation", ["Rev"], ["Revelation of John", "Apocalypse"]]
] as const satisfies readonly (readonly [string, readonly string[], readonly string[]])[];

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeReferenceName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export const savingGraceSpeakers = speakerNames.map((name) => {
  const slug = slugify(name);
  return Object.freeze({
    id: deterministicSourceUuid("savinggrace-public-speaker", slug),
    name,
    slug
  });
});

export const protestantBibleBooks = bibleBookSource.map(([canonicalName, abbreviations, aliases], index) => {
  const canonicalOrder = index + 1;
  return Object.freeze({
    id: canonicalOrder,
    canonicalName,
    slug: slugify(canonicalName),
    canonicalOrder,
    testament: canonicalOrder <= 39 ? "old" as const : "new" as const,
    abbreviations: [...abbreviations],
    aliases: [...aliases],
    classificationId: deterministicSourceUuid(
      "savinggrace-canonical-book-classification",
      canonicalOrder
    )
  });
});

function assertUniqueCatalogue(): void {
  const speakerIds = new Set<string>();
  const speakerNames = new Set<string>();
  const speakerSlugs = new Set<string>();
  for (const speaker of savingGraceSpeakers) {
    const normalizedName = normalizeReferenceName(speaker.name);
    if (
      speakerIds.has(speaker.id) ||
      speakerNames.has(normalizedName) ||
      speakerSlugs.has(speaker.slug) ||
      speaker.slug !== slugify(speaker.name)
    ) {
      throw new Error("The Saving Grace speaker catalogue contains a duplicate or unstable identity.");
    }
    speakerIds.add(speaker.id);
    speakerNames.add(normalizedName);
    speakerSlugs.add(speaker.slug);
  }

  const bookIds = new Set<number>();
  const bookNames = new Set<string>();
  const bookSlugs = new Set<string>();
  const classificationIds = new Set<string>();
  const lookup = new Map<string, number>();
  for (const book of protestantBibleBooks) {
    if (
      bookIds.has(book.id) ||
      bookNames.has(normalizeReferenceName(book.canonicalName)) ||
      bookSlugs.has(book.slug) ||
      classificationIds.has(book.classificationId) ||
      book.id !== book.canonicalOrder ||
      book.slug !== slugify(book.canonicalName)
    ) {
      throw new Error("The Bible-book catalogue contains a duplicate or unstable canonical identity.");
    }
    bookIds.add(book.id);
    bookNames.add(normalizeReferenceName(book.canonicalName));
    bookSlugs.add(book.slug);
    classificationIds.add(book.classificationId);
    for (const value of [book.canonicalName, book.slug, ...book.abbreviations, ...book.aliases]) {
      const key = normalizeReferenceName(value);
      const owner = lookup.get(key);
      if (owner !== undefined && owner !== book.id) {
        throw new Error("A Bible-book abbreviation or alias is ambiguous across canonical books.");
      }
      lookup.set(key, book.id);
    }
  }
  if (protestantBibleBooks.length !== 66 || protestantBibleBooks.at(-1)?.canonicalOrder !== 66) {
    throw new Error("The Bible-book catalogue must contain one contiguous canonical order from 1 to 66.");
  }
}

assertUniqueCatalogue();

const bibleLookup = new Map<string, (typeof protestantBibleBooks)[number]>();
for (const book of protestantBibleBooks) {
  for (const value of [book.canonicalName, book.slug, ...book.abbreviations, ...book.aliases]) {
    bibleLookup.set(normalizeReferenceName(value), book);
  }
}

export function resolveCanonicalBibleBook(value: string) {
  return bibleLookup.get(normalizeReferenceName(value)) ?? null;
}

export const referenceCatalogueSha256 = createHash("sha256")
  .update(JSON.stringify({
    version: referenceCatalogueVersion,
    speakers: savingGraceSpeakers,
    bibleBooks: protestantBibleBooks
  }), "utf8")
  .digest("hex");

interface ApplyOptions {
  connectionString: string;
  writeOptIn?: string | undefined;
}

async function verifyTarget(client: PoolClient): Promise<void> {
  const result = await client.query<{
    server_16: boolean;
    loopback: boolean;
    port_5432: boolean;
    target_database: boolean;
  }>(`SELECT
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
      inet_server_addr() = '127.0.0.1'::inet AS loopback,
      inet_server_port() = 5432 AS port_5432,
      current_database() = 'savinggrace_sermons_test' AS target_database`);
  if (!Object.values(result.rows[0] ?? {}).every(Boolean)) {
    throw new Error("The reference catalogue database identity failed closed.");
  }
}

function assertNoConflict(
  kind: string,
  intended: { id: string; name: string; slug: string },
  rows: Array<{ id: string; name: string; slug: string }>
): { exists: boolean } {
  const normalizedName = normalizeReferenceName(intended.name);
  const matches = rows.filter((row) =>
    row.id === intended.id ||
    normalizeReferenceName(row.name) === normalizedName ||
    row.slug.toLowerCase() === intended.slug.toLowerCase()
  );
  if (matches.length === 0) return { exists: false };
  if (
    matches.length !== 1 ||
    matches[0]!.id !== intended.id ||
    matches[0]!.name !== intended.name ||
    matches[0]!.slug !== intended.slug
  ) {
    throw new Error(`${kind} reference identity conflicts with existing data.`);
  }
  return { exists: true };
}

export async function applyReferenceCatalogue(pool: Pool, options: ApplyOptions) {
  assertDisposableLocalDatabase(options.connectionString, options.writeOptIn);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verifyTarget(client);
    await client.query("SELECT pg_advisory_xact_lock(72419066)");
    const existingSpeakers = await client.query<{ id: string; name: string; slug: string }>(
      "SELECT id, name, slug FROM speakers"
    );
    const existingBooks = await client.query<{
      id: number;
      canonical_name: string;
      slug: string;
      testament: "old" | "new";
      canonical_order: number;
    }>("SELECT id, canonical_name, slug, testament, canonical_order FROM bible_books");
    const existingClassifications = await client.query<{
      id: string;
      name: string;
      slug: string;
      canonical_book_id: number | null;
      classification_type: string;
      review_status: string;
    }>(`SELECT id, name, slug, canonical_book_id, classification_type, review_status
        FROM book_classifications`);

    let speakersCreated = 0;
    let booksCreated = 0;
    let classificationsCreated = 0;
    for (const speaker of savingGraceSpeakers) {
      const state = assertNoConflict("Speaker", speaker, existingSpeakers.rows);
      if (!state.exists) {
        await client.query(
          "INSERT INTO speakers (id, name, slug) VALUES ($1, $2, $3)",
          [speaker.id, speaker.name, speaker.slug]
        );
        existingSpeakers.rows.push(speaker);
        speakersCreated += 1;
      }
    }
    for (const book of protestantBibleBooks) {
      const matchingBooks = existingBooks.rows.filter((row) =>
        row.id === book.id ||
        normalizeReferenceName(row.canonical_name) === normalizeReferenceName(book.canonicalName) ||
        row.slug.toLowerCase() === book.slug
      );
      if (matchingBooks.length === 0) {
        await client.query(
          `INSERT INTO bible_books (id, canonical_name, slug, testament, canonical_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [book.id, book.canonicalName, book.slug, book.testament, book.canonicalOrder]
        );
        existingBooks.rows.push({
          id: book.id,
          canonical_name: book.canonicalName,
          slug: book.slug,
          testament: book.testament,
          canonical_order: book.canonicalOrder
        });
        booksCreated += 1;
      } else if (
        matchingBooks.length !== 1 ||
        matchingBooks[0]!.id !== book.id ||
        matchingBooks[0]!.canonical_name !== book.canonicalName ||
        matchingBooks[0]!.slug !== book.slug ||
        matchingBooks[0]!.testament !== book.testament ||
        matchingBooks[0]!.canonical_order !== book.canonicalOrder
      ) {
        throw new Error("A canonical Bible-book identity conflicts with existing data.");
      }

      const intendedClassification = {
        id: book.classificationId,
        name: book.canonicalName,
        slug: book.slug
      };
      const state = assertNoConflict(
        "Bible-book classification",
        intendedClassification,
        existingClassifications.rows
      );
      const existing = existingClassifications.rows.find((row) => row.id === book.classificationId);
      if (state.exists) {
        if (
          existing?.canonical_book_id !== book.id ||
          existing.classification_type !== "canonical" ||
          existing.review_status !== "approved"
        ) {
          throw new Error("A canonical Bible-book classification has conflicting state.");
        }
      } else {
        await client.query(
          `INSERT INTO book_classifications (
             id, name, slug, canonical_book_id, classification_type, review_status
           ) VALUES ($1, $2, $3, $4, 'canonical', 'approved')`,
          [book.classificationId, book.canonicalName, book.slug, book.id]
        );
        existingClassifications.rows.push({
          ...intendedClassification,
          canonical_book_id: book.id,
          classification_type: "canonical",
          review_status: "approved"
        });
        classificationsCreated += 1;
      }
    }
    await client.query("COMMIT");
    const created = speakersCreated + booksCreated + classificationsCreated;
    return {
      outcome: created === 0 ? "unchanged" as const : "created" as const,
      version: referenceCatalogueVersion,
      catalogueSha256: referenceCatalogueSha256,
      speakers: { created: speakersCreated, unchanged: savingGraceSpeakers.length - speakersCreated },
      bibleBooks: { created: booksCreated, unchanged: protestantBibleBooks.length - booksCreated },
      bookClassifications: {
        created: classificationsCreated,
        unchanged: protestantBibleBooks.length - classificationsCreated
      }
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function rollbackReferenceCatalogue(pool: Pool, options: ApplyOptions) {
  assertDisposableLocalDatabase(options.connectionString, options.writeOptIn);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verifyTarget(client);
    await client.query("SELECT pg_advisory_xact_lock(72419066)");
    const speakerIds = savingGraceSpeakers.map((speaker) => speaker.id);
    const classificationIds = protestantBibleBooks.map((book) => book.classificationId);
    const bookIds = protestantBibleBooks.map((book) => book.id);
    const counts = await client.query<{
      speakers: number;
      books: number;
      classifications: number;
      speaker_links: number;
      book_links: number;
      scripture_links: number;
      other_classifications: number;
    }>(`SELECT
      (SELECT count(*)::integer FROM speakers WHERE id = ANY($1::uuid[])) AS speakers,
      (SELECT count(*)::integer FROM bible_books WHERE id = ANY($2::smallint[])) AS books,
      (SELECT count(*)::integer FROM book_classifications WHERE id = ANY($3::uuid[])) AS classifications,
      (SELECT count(*)::integer FROM sermons WHERE speaker_id = ANY($1::uuid[])) AS speaker_links,
      (SELECT count(*)::integer FROM sermon_book_classifications
       WHERE book_classification_id = ANY($3::uuid[])) AS book_links,
      (SELECT count(*)::integer FROM scripture_references
       WHERE canonical_book_id = ANY($2::smallint[])) AS scripture_links,
      (SELECT count(*)::integer FROM book_classifications
       WHERE canonical_book_id = ANY($2::smallint[]) AND NOT (id = ANY($3::uuid[]))) AS other_classifications`,
      [speakerIds, bookIds, classificationIds]
    );
    const state = counts.rows[0]!;
    if (state.speakers === 0 && state.books === 0 && state.classifications === 0) {
      await client.query("COMMIT");
      return { outcome: "unchanged" as const, removedSpeakers: 0, removedBibleBooks: 0 };
    }
    if (
      state.speakers !== savingGraceSpeakers.length ||
      state.books !== protestantBibleBooks.length ||
      state.classifications !== protestantBibleBooks.length
    ) {
      throw new Error("The reference catalogue is partial or changed; rollback refused.");
    }
    if (state.speaker_links || state.book_links || state.scripture_links || state.other_classifications) {
      throw new Error("The reference catalogue is in use; rollback refused.");
    }
    await client.query("DELETE FROM book_classifications WHERE id = ANY($1::uuid[])", [classificationIds]);
    await client.query("DELETE FROM bible_books WHERE id = ANY($1::smallint[])", [bookIds]);
    await client.query("DELETE FROM speakers WHERE id = ANY($1::uuid[])", [speakerIds]);
    await client.query("COMMIT");
    return {
      outcome: "removed" as const,
      removedSpeakers: savingGraceSpeakers.length,
      removedBibleBooks: protestantBibleBooks.length
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
