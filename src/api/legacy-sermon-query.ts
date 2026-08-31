export class InvalidLegacySermonQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLegacySermonQueryError";
  }
}

const legacyDateRangePattern = /^(\d{4}-\d{2}-\d{2}) - (\d{4}-\d{2}-\d{2})$/;

export interface LegacyDateRange {
  dateFrom: string;
  dateTo: string;
}

export function parseLegacyDateRange(value: string): LegacyDateRange {
  const match = legacyDateRangePattern.exec(value.trim());
  if (!match) {
    throw new InvalidLegacySermonQueryError(
      "sermon_dates must use YYYY-MM-DD - YYYY-MM-DD"
    );
  }

  const [, dateFrom, dateTo] = match;
  if (dateFrom! > dateTo!) {
    throw new InvalidLegacySermonQueryError("sermon_dates end must not precede start");
  }

  return { dateFrom: dateFrom!, dateTo: dateTo! };
}

function first(parameters: URLSearchParams, modern: string, legacy?: string): string | undefined {
  return parameters.get(modern) ?? (legacy ? parameters.get(legacy) : null) ?? undefined;
}

export function translateLegacySermonQuery(parameters: URLSearchParams): Record<string, string> {
  const translated: Record<string, string> = {};
  const mappings: Array<[string, string, string?]> = [
    ["query", "query", "s"],
    ["speaker", "speaker", "sermon_speaker"],
    ["series", "series", "sermon_series"],
    ["passage", "passage", "sermon_topics"],
    ["book", "book", "sermon_book"],
    ["passageBook", "passageBook"],
    ["passageChapter", "passageChapter"],
    ["passageVerse", "passageVerse"],
    ["passageEndVerse", "passageEndVerse"],
    ["dateFrom", "dateFrom"],
    ["dateTo", "dateTo"],
    ["order", "order"],
    ["view", "view"],
    ["page", "page"],
    ["pageSize", "pageSize"]
  ];

  for (const [target, modern, legacy] of mappings) {
    const value = first(parameters, modern, legacy);
    if (value !== undefined && value !== "") translated[target] = value;
  }

  const legacyDate = parameters.get("sermon_dates");
  if (legacyDate && !translated.dateFrom && !translated.dateTo) {
    Object.assign(translated, parseLegacyDateRange(legacyDate));
  }

  return translated;
}
