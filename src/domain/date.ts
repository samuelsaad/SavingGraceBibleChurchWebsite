const wordpressLocalDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export interface ServiceDateResult {
  serviceDate: string;
  isSunday: boolean;
}

export function mapWordPressLocalDate(value: string): ServiceDateResult | null {
  const match = wordpressLocalDateTimePattern.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    serviceDate: `${yearText}-${monthText}-${dayText}`,
    isSunday: date.getUTCDay() === 0
  };
}

export function parseWordPressGmt(value: string | null | undefined): string | null {
  if (!value || value === "0000-00-00 00:00:00") return null;
  const match = wordpressLocalDateTimePattern.exec(value);
  if (!match) return null;

  const isoValue = `${value.slice(0, 10)}T${value.slice(11)}Z`;
  const parsed = new Date(isoValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
