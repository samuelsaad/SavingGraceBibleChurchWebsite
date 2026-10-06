const canonicalSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unicodeSlugPattern = /^[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:-[\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*$/u;

/** Preserve an existing WordPress encoded Unicode slug, but reject encoded
 * separators, dots, controls, double encoding and arbitrary URL material. */
export function encodedUnicodeSlug(slug:string):string|null{
 if(!slug||slug.length>200||!/^(?:[a-z0-9-]|%[a-f0-9]{2})+$/iu.test(slug)||!slug.includes('%'))return null;
 try{const decoded=decodeURIComponent(slug);if(!unicodeSlugPattern.test(decoded)||canonicalSlugPattern.test(decoded))return null;
  const canonical=encodeURIComponent(decoded).toLowerCase();return canonical===slug.toLowerCase()?canonical:null;
 }catch{return null;}
}

export function canonicalStoredSermonSlug(slug:string):string|null{
 const legacy=validateLegacySlug(slug);if(legacy)return legacy;
 return unicodeSlugPattern.test(slug)&&!canonicalSlugPattern.test(slug)?encodedUnicodeSlug(encodeURIComponent(slug)):null;
}

export function sermonSlugPathSegment(slug:string):string{
 return encodedUnicodeSlug(slug)??encodeURIComponent(slug);
}

export function validateLegacySlug(slug: string | null | undefined): string | null {
  if (!slug || slug.length > 200) {
    return null;
  }
  return canonicalSlugPattern.test(slug)?slug:encodedUnicodeSlug(slug);
}

export function normalizeSlugForUniqueness(slug: string): string {
  return slug.normalize("NFKC").toLocaleLowerCase("en-AU");
}
