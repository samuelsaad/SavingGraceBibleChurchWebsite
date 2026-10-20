/** W3C modification dates from stored content; never deployment time. */
export function sitemapDate(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2})))?$/u.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))
    || new Date(match[1] + 'T00:00:00Z').toISOString().slice(0, 10) !== match[1]
    || match[2] && (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59 || Number(match[5] ?? 0) > 23 || Number(match[6] ?? 0) > 59)) {
    throw Error('seo_sitemap_date_invalid');
  }
  return value.includes('T') ? new Date(value).toISOString() : value;
}
export function latestSitemapDate(values: readonly (string | null | undefined)[]): string | undefined {
  return values.filter((value): value is string => Boolean(value)).map(sitemapDate)
    .sort((a, b) => Date.parse(b) - Date.parse(a) || Number(b.includes('T')) - Number(a.includes('T')))[0];
}
