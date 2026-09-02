/**
 * HTML authoring helpers shared by every server-rendered frontend component.
 *
 * The `html` tagged template escapes every interpolated value by default.
 * Only values produced by `html` itself (or explicitly wrapped with `raw`)
 * pass through unescaped, so a component can nest other components freely
 * while approved content, slugs and query values are always escaped.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** A fragment that has already been rendered and escaped. */
export class Html {
  constructor(private readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export type Renderable = Html | string | number | boolean | null | undefined | Renderable[];

function renderValue(value: Renderable): string {
  if (value === null || value === undefined || value === false || value === true) return "";
  if (value instanceof Html) return value.toString();
  if (Array.isArray(value)) return value.map(renderValue).join("");
  return escapeHtml(String(value));
}

/**
 * Tagged template that escapes interpolations. Arrays are concatenated,
 * `null`/`undefined`/`false`/`true` render nothing, and `Html` passes through.
 * Whitespace is preserved exactly so inline fragments keep their spacing.
 */
export function html(strings: TemplateStringsArray, ...values: Renderable[]): Html {
  let output = "";
  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index];
    if (index < values.length) output += renderValue(values[index]);
  }
  return new Html(output);
}

/** Marks a string as already-safe markup. Use only for trusted, static markup. */
export function raw(value: string): Html {
  return new Html(value);
}

/** Renders a value only when the condition holds. */
export function when(condition: unknown, value: Renderable | (() => Renderable)): Renderable {
  if (!condition) return null;
  return typeof value === "function" ? value() : value;
}

/** Renders `name="value"` (escaped), `name` for true, or nothing for false/null. */
export function attribute(name: string, value: string | number | boolean | null | undefined): Html {
  if (value === null || value === undefined || value === false) return new Html("");
  return new Html(value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`);
}

/** Joins class names, dropping empty and false entries. */
export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Converts approved plain text into paragraphs. Blank lines separate
 * paragraphs; single line breaks are preserved. Wording is never altered.
 */
export function plainTextParagraphs(value: string): Html {
  return new Html(
    value
      .trim()
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
      .join("")
  );
}

/** Collapses whitespace for single-line previews without changing words. */
export function singleLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});

/** Formats an ISO calendar date such as 2026-08-02 as "2 August 2026". */
export function formattedDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

/** Renders a `<time>` element for an ISO calendar date. */
export function timeElement(isoDate: string): Html {
  return html`<time datetime="${isoDate}">${formattedDate(isoDate)}</time>`;
}

/** Pluralises a count with the supplied nouns. */
export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export const siteName = "Saving Grace Bible Church";

/** Document title in the house style. */
export function documentTitle(pageTitle?: string): string {
  return pageTitle ? `${pageTitle} — ${siteName}` : siteName;
}
