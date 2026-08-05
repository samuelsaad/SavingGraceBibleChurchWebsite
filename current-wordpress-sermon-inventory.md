# Current WordPress Sermon Inventory

**Phase:** 0 — read-only existing-system discovery  
**Status:** Complete and reconciled with Yang’s migration decisions  
**Observed:** 3–5 August 2026 (Australia/Sydney)  
**Source of truth:** `church-website-architecture-plan.md`, revision 2.1

## Evidence model and safety boundary

Every factual finding below is labelled with one of the required classifications:

- `source-confirmed`: intended behaviour found in the exact installed parent/Pro source snapshot.
- `database-observed`: actual state found in the live database.
- `source-and-database-confirmed`: source intent and live data agree.
- `provisional due to source version difference`: retained only for historic findings that have not been superseded by exact installed-source evidence.
- `unresolved`: the available evidence cannot establish the answer.

The database remains authoritative for stored data. No PHP or WordPress code was executed, installed, activated, or modified. The installed directories were read statically in place and were not copied into the repository. No licence implementation/value was inspected or recorded, and no production connection or write was performed for the exact-source comparison.

The SQL statement log is [phase-0-read-only-sql-log.sql](./phase-0-read-only-sql-log.sql). It contains no credentials or connection identifiers. Every content-query session began with `SET SESSION TRANSACTION READ ONLY` and `START TRANSACTION READ ONLY`; only `SELECT`, `SHOW`, and `DESCRIBE` statements plus those read-only guards were used.

## Mandatory connection and grant checks

| Check | Result | Evidence |
| --- | --- | --- |
| MySQL Shell connection | Successful with MySQL Shell 26.7 and its Windows credential store; no credential was printed or written | `database-observed` |
| Server | MariaDB 10.6.7 | `database-observed` |
| Selected database/account | Both matched the configured environment-backed connection identity | `database-observed` |
| Grants | Global `PROCESS`; database-level `SELECT`, `SHOW VIEW`, `EVENT`, and `TRIGGER` | `database-observed` |
| Grant exit gate | The database administrator and project owner formally accepted these excessive grants as a temporary exception; discovery did not use `PROCESS`, events, or triggers | `database-observed` |
| Table access | 211 tables visible | `database-observed` |
| WordPress prefix | A unique complete core-table set uses `wp_`; prefix is `wp` | `database-observed` |

The account is not least-privilege. The temporary exception must be removed after discovery/migration work and must not be treated as the target production access model.

## Exact installed plugin source snapshot

| Finding | Result | Evidence |
| --- | --- | --- |
| Parent identity | Advanced Sermons 3.7; 69 files; 673,389 bytes; deterministic aggregate SHA-256 `766fc92d041ea3c031bbf48af023c7ca3d3a77c39cae288d437d1a6565fc23f5` | `source-confirmed` |
| Pro identity | Advanced Sermons Pro 2.2; 31 files; 150,444 bytes; deterministic aggregate SHA-256 `a753c8c594669c7363ade57934cc0a26649bd3414c6f94068acb5d7cd2bdd361` | `source-confirmed` |
| Manifest method | SHA-256 over the sorted sequence `relative-path<TAB>length<TAB>file-sha256`; names/hashes only, no proprietary file content copied | `source-confirmed` |
| Dependency | Pro is an add-on requiring the free `advanced-sermons/advanced-sermons.php` parent; it is not a standalone plugin | `source-confirmed` |
| Production activation | Both parent and Pro occur in the live `active_plugins` option | `source-and-database-confirmed` |
| Earlier Pro 2.2 comparison | Same plugin name/version, 31-file/150,444-byte expanded shape, and no semantic difference in inspected behaviour | `source-confirmed` |
| Byte identity to earlier ZIP | Cannot be re-proven because the earlier ZIP is no longer present; its previously recorded archive hash remains in the historical log | `unresolved` |

Source-code findings describe intended behaviour. They do not imply that every registered field, option, shortcode, or template path is populated or exercised; the database observations below remain authoritative for actual usage.

### Parent registration and lifecycle

- The parent registers hierarchical, public, publicly queryable `sermons` content with archive/query support, standard WordPress post capabilities, and title/editor/thumbnail/excerpt/comments support. It excludes sermons from native site search and does not expose the type through REST. No custom post status is registered; the observed `publish`, `pending`, and `draft` rows use WordPress core status/capability behaviour. (`source-and-database-confirmed`)
- It registers `sermon_series` (hierarchical), `sermon_speaker` (hierarchical), `sermon_topics` (flat), and `sermon_book` (hierarchical), all public, queryable, visible in the admin and excluded from REST. Their rewrites route through the sermon archive query parameters. (`source-and-database-confirmed`)
- The meta save hook verifies a nonce and the current user's post-edit capability, then updates the ten content fields plus the video-type selector. It uses one broad HTML allowlist for every field, performs no provider-specific URL validation, and updates blank values instead of deleting meta. The replacement keeps stricter field-specific validation. (`source-confirmed`)
- Normal add/edit/publish/pending/draft/trash/delete behaviour is WordPress core post workflow. Pro adds a duplicate-as-draft action that copies post content, taxonomies, and postmeta. The source action uses a nonce but does not contain an explicit capability check of its own, so the replacement must continue enforcing roles server-side. (`source-confirmed`)

## Sermon records and statuses

| Status | Records | Title/slug observations | Evidence |
| --- | ---: | --- | --- |
| `publish` | 448 | No missing title or slug; include as published | `database-observed` |
| `pending` | 5 | All five titles and slugs present; include as unpublished/pending | `database-observed` |
| `draft` | 3 | Titles present; all three slugs empty and `post_date_gmt` zero; exclude | `database-observed` |
| **Total `sermons`** | **456** | No future-dated row and no other status | `database-observed` |

The 448 published database rows exactly reconcile with the 448-record public archive baseline. Published slugs are unique, no duplicate sermon-slug group exists, and no sermon has `_wp_old_slug` metadata. All 456 sermons have empty `post_content` and `post_excerpt`, and none has a post password. (`database-observed`)

Yang confirmed that other sermon plugins are out of migration scope. The one `ctc_sermon`, three `wpfc_sermon`, eight `wpv_sermon`, and all `wp_sb_*` records remain documented but are excluded without modifying WordPress. (`database observed`)

## Date semantics

Published local `post_date` values run from 5 February 2017 12:57:28 to 2 August 2026 21:59:52. The database timezone option is `Australia/Melbourne`; WordPress formats are `d/m/Y` and `g:i a`; the Pro display option is `j F, Y`. (`database-observed`)

Parent and Pro list/widget and related-sermon code uses WordPress `post_date`, `the_time()`, and date-descending queries. The archive date picker emits `YYYY-MM-DD - YYYY-MM-DD`; the parent parses inclusive `after`/`before` boundaries using the default WordPress date column (`post_date`, in the site timezone). This agrees with the dates exposed by the live archive. (`source-and-database-confirmed`)

Yang confirmed that local WordPress `post_date` is intended to be the preached date. Migration maps its exact local calendar date to `service_date`, preserves all source timestamps, never moves it to Sunday, and emits a manual-review warning for non-Sunday values. Four included published sermons are non-Sunday; all five included pending records are Sunday. (`database observed`)

## Taxonomies and relationships

The complete query returned 440 registered terms: 23 `sermon_book`, 29 `sermon_series`, 9 `sermon_speaker`, and 379 `sermon_topics`; no `sermon_campus` or `sermon_service_type` term was present. Descriptions are empty, every taxonomy parent is zero, and relationship `term_order` is zero. (`database-observed`)

| Taxonomy | Sermons assigned, all statuses | Terms used, all statuses | Relationships, all statuses | Published relationships | Published missing | Published multi-assigned | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `sermon_book` | 443 | 23 | 444 | 438 | 10 | 0 | `database-observed` |
| `sermon_series` | 432 | 29 | 441 | 436 | 21 | 9 | `database-observed` |
| `sermon_speaker` | 453 | 8 | 453 | 448 | 0 | 0 | `database-observed` |
| `sermon_topics` | 432 | 376 | 432 | 428 | 20 | 0 | `database-observed` |

Series is demonstrably many-to-many: nine sermons have two series assignments. One non-public sermon has two book assignments. Speaker and passage happen to be single-valued for assigned records, but that observed content pattern does not prove a parent-plugin constraint. (`database-observed`)

Term anomalies requiring review include near-duplicate series “Our Call…”/“Our Calling…”, noncanonical book/passage values such as `Selected Text`, an unused `Hosea` passage term, a book term used only by non-public content, and an unused `Psalm 13` term classified as a speaker. Stored term counts are not always authoritative; for example, `Topical` stores 54 while 59 live relationships were counted. (`database-observed`)

## Passage metadata versus passage taxonomy

`asp_sermon_bible_passage` is populated for 436 of its 453 rows. The `sermon_topics` taxonomy is the public Passage filter, even though its technical name says “topics.” (`source-and-database-confirmed`)

| Status | Both present | Meta only | Taxonomy only | Neither | Exact matches | Mismatches | Evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| publish | 423 | 8 | 5 | 12 | 387 | 36 | `database-observed` |
| pending | 4 | 1 | 0 | 0 | 4 | 0 | `database-observed` |
| draft | 0 | 0 | 0 | 3 | 0 | 0 | `database-observed` |

Mismatches include `Psalm` versus `Psalms`, abbreviations such as `Ex` versus `Exodus`, and genuinely different free-form values. Neither source may overwrite the other during extraction; both value and provenance must be retained until an explicit reconciliation rule is approved. (`database-observed`)

## Post metadata, media, resources, and images

No sermon has duplicate rows for the same relevant Advanced Sermons meta key. Most Advanced Sermons field rows exist on 453 records—the 448 published plus five pending—while the three drafts lack them. (`database-observed`)

| Source key/relationship | Observed value shape and usage | Evidence |
| --- | --- | --- |
| `asp_sermon_youtube` | 453 rows; 324 populated; every populated value is a URL-like `youtu.be` short link; 319 published and 5 pending | `source-and-database-confirmed` |
| `asp_sermon_video_type_select` | `youtube` on the same 324 media-bearing records | `database-observed` |
| `asp_sermon_audio_embed` | 453 rows; 424 populated; every populated value is a SermonAudio iframe; maximum length 186; no script tags; 419 published and 5 pending | `source-and-database-confirmed` |
| `asp_sermon_bible_passage` | 453 rows; 436 populated; plain/free-form passage text | `source-and-database-confirmed` |
| `asp_sermon_pdf` | 453 rows, all empty | `database-observed` |
| bulletin/Facebook/MP4/SoundCloud/Vimeo/video-embed fields | Present on 422 older records but unpopulated | `database-observed` |
| `_thumbnail_id` | No sermon row has a featured-image relationship | `database-observed` |
| AIOSEO sermon metadata | 450 rows, but title/description/social overrides are null/empty or empty serialized collections; no material per-sermon override observed | `database-observed` |
| `post_views_count` | 453 numeric rows; range 14–1,550; total 290,487; retained in private migration audit only | `source-and-database-confirmed` |

Among published sermons, 319 have YouTube, 419 have audio, 290 have both, and none has neither. All five pending records have both; drafts have neither. YouTube values have no duplicate group. Audio has five duplicate value groups involving 11 rows and requires duplicate-versus-intent review. (`database-observed`)

The Pro audio path directly outputs the stored audio-embed metadata and does not show an escaping/sanitisation step in the add-on source. The replacement must parse approved providers into controlled fields and must never reproduce arbitrary direct embed rendering. (`source-confirmed`)

The parent single template increments `post_views_count` unless view counting is disabled, initializes a missing counter at zero, and excludes users with `manage_options`. The metric is legacy page-view state, not a comparable analytics measure. It remains disabled in public API/UI and is preserved only in private migration audit. (`source-and-database-confirmed`)

Series term image metadata has one zero/broken reference. Speaker image metadata has two valid attachment references and one missing/broken reference. Numeric `asp_term_order` values are ordering metadata, not media IDs. The configured global sermon image is a URL on neither the known staging nor public `www` origin; its value was deliberately not retrieved. The default series image option is empty. (`database-observed`)

## Pro settings and behaviour

The installed Pro source registers 53 normal settings: 2 general, 1 design, 7 single-sermon, 11 archive, 10 metadata-mapping, and 22 language settings. All 31 non-language settings are populated in the database; none of the 22 language settings is populated. The parent registers 104 settings across general (13), archive (15), design (67), single (6), and miscellaneous (3) groups. Registration therefore does not imply live population. (`source-and-database-confirmed`)

Observed live settings select list view, nine sermons per archive page, numeric/default pagination, taxonomy dropdown ordering by ascending name, visible keyword/date/order/series/speaker/passage/book controls, target `_self`, preacher label `Preacher`, passage label `Passage`, and an empty archive slug override. Related sermons are enabled with a count of three; navigation and social sharing are enabled; sidebar is disabled. (`database-observed`)

The Pro source registers shortcodes `asp-archive`, `asp-series`, `asp-sermons`, `asp-speakers`, and `asp-widgets`. The database contains current content use only of `[asp-sermons order="DESC" post="3"]` on the published homepage; the other 121 matching rows are a draft page or revisions. No current use of the other Pro shortcodes was found. (`source-and-database-confirmed`)

The source supports published-sermon queries filtered by series, speaker, topic/passage, and book, ordered by date; related sermons use the same series and exclude the current record. It builds archive query strings with `sermon_series`, `sermon_speaker`, `sermon_topics`, and `sermon_book`. The normal/direct main-query path combines selected dimensions with `AND`; a separate AJAX-prepared branch uses `OR`, which conflicts with both the observed direct-query result and the approved replacement contract. (`source-and-database-confirmed`)

Keyword input uses WordPress native `s` search for title/content/excerpt and adds exact taxonomy-name matches; it has no plugin-defined relevance weights, fuzzy match, partial taxonomy-name match, or tokenization override. The target's weighted PostgreSQL search is a deliberate improvement, while legacy parameter compatibility remains deterministic. (`source-confirmed`)

The parent exposes public/nopriv AJAX generation plus an archive-order action. Frontend JavaScript sends form data on filter/change/reload events, updates browser history, and configures a two-month range picker. The underlying archive GET form/direct URLs remain the no-JavaScript compatibility path, although automatic select updates require JavaScript. (`source-confirmed`)

The installed source confirms the ten metadata-mapping settings provide compatibility with alternate/custom metadata keys. Several live values are empty and the populated identifier-like values do not correspond to additional populated sermon data, so they create no target rows. (`source-and-database-confirmed`)

A sensitive licence option is present. Only presence was counted; its value was never selected, displayed, or written. (`database-observed`)

## Custom tables and legacy residue

Three sermon-named custom tables exist: `wp_sb_sermons` (1 row), `wp_sb_books_sermons` (2 rows), and `wp_sb_sermons_tags` (1 row). Their internal relations resolve, but the lone `wp_sb_sermons.page_id` does not resolve to a current `wp_posts` row. Pro source creates no table. (`database-observed`)

Numerous `sermonmanager_*`, migration-marker, and `vamtam-sermons-version` options indicate earlier sermon systems or migrations. Yang confirmed that these legacy systems are excluded from migration and from the replacement sermon collections; their source data remains untouched. (`database observed`)

## Exact-source reconciliation and remaining items

| Item | Current conclusion | Evidence |
| --- | --- | --- |
| Grant least privilege | Temporary owner-approved exception; still a cleanup requirement | `database-observed` |
| Installed plugin versions | Parent 3.7 and Pro 2.2 identified from exact installed directories | `source-confirmed` |
| Earlier Pro ZIP byte identity | Semantic/version/shape match; ZIP absent, so a fresh byte comparison is impossible | `unresolved` |
| Search fields/date parser/AJAX | Parent behavior is confirmed; direct filters are AND while AJAX-prepared taxonomy clauses are OR | `source-and-database-confirmed` |
| Sermon date business meaning | Confirmed as preached date; preserve exact local date and warn on four included non-Sundays | `database observed` |
| Metadata-mapping options | Registered option names and live shapes are known; several populated identifier-like values have no corresponding populated sermon field and therefore import nothing | `source-and-database-confirmed` |
| Legacy custom tables/other sermon CPTs | Yang confirmed complete exclusion from migration | `database observed` |
| Near-duplicate/misclassified terms | Preserve first; merge/reclassify only by approved mapping | `unresolved` |

Phase 0 read-only inventory and exact-source reconciliation are complete under the acknowledged grant exception. The approved inclusion set remains 453 sermons: 448 published and 5 titled pending. Three drafts, zero blank-title pending records, the legacy custom-table rows, and 12 other-plugin sermon-like posts are excluded. No database count or migration-scope decision changed because of source inspection.
