/** Exact pg_dump/restore associative-AND normalization witnesses. No other differences allowed. */
const pairs:Record<string,readonly [string,string]>={
  "sermon_deletion_tombstones_former_slug_check": [
    "CHECK ((((char_length(former_slug) >= 1) AND (char_length(former_slug) <= 200)) AND (former_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)))",
    "CHECK (((char_length(former_slug) >= 1) AND (char_length(former_slug) <= 200) AND (former_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)))"
  ],
  "sermon_enrichment_sources_original_filename_check": [
    "CHECK ((((char_length(original_filename) >= 1) AND (char_length(original_filename) <= 255)) AND (original_filename !~ '[\\\\/]'::text)))",
    "CHECK (((char_length(original_filename) >= 1) AND (char_length(original_filename) <= 255) AND (original_filename !~ '[\\\\/]'::text)))"
  ],
  "sermons_seo_description_check": [
    "CHECK (((seo_description IS NULL) OR (((char_length(TRIM(BOTH FROM seo_description)) >= 1) AND (char_length(TRIM(BOTH FROM seo_description)) <= 320)) AND (seo_description !~ '<[^>]+>'::text))))",
    "CHECK (((seo_description IS NULL) OR ((char_length(TRIM(BOTH FROM seo_description)) >= 1) AND (char_length(TRIM(BOTH FROM seo_description)) <= 320) AND (seo_description !~ '<[^>]+>'::text))))"
  ]
};
export function restoreConstraintCanonical(name:string,definition:string):string{const pair=pairs[name];return pair?.includes(definition)?pair[1]:definition;}
