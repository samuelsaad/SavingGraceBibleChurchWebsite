const canonicalSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateLegacySlug(slug: string | null | undefined): string | null {
  if (!slug || slug.length > 200 || !canonicalSlugPattern.test(slug)) {
    return null;
  }

  return slug;
}

export function normalizeSlugForUniqueness(slug: string): string {
  return slug.normalize("NFKC").toLocaleLowerCase("en-AU");
}
