# Advanced Sermons Field Map

**Status:** Migration mappings approved for local dry-run implementation  
**Rule:** Preserve source identity, original value, and provenance. Do not merge, parse, normalise, or discard ambiguous values silently.

Evidence values use the original machine labels. The exact installed source snapshot is parent 3.7 plus Pro 2.2; live database evidence continues to control actual stored data.

## Core sermon mapping

| WordPress source | Live shape | Proposed PostgreSQL target | Transformation/preservation rule | Evidence |
| --- | --- | --- | --- | --- |
| `wp_posts.ID` | 456 `sermons` rows | `migration_records.source_id`; target sermon UUID | Preserve as string with source system/entity type; never match by title alone | `database-observed` |
| `post_title` | Present on all 456 | `sermons.title` | Preserve Unicode exactly; validate required after reconciliation | `database-observed` |
| `post_name` | Unique/present on 448 published and 5 pending; empty on 3 drafts | `sermons.slug`; redirect/migration source path | Preserve valid public slugs; generate draft slugs only under an approved editorial rule | `database-observed` |
| `post_status` | 448 publish, 5 pending, 3 draft | `sermons.status`; migration outcome/audit | Include publish as published; include all 5 titled pending as unpublished; exclude all 3 drafts | `database observed` |
| `post_date`, `post_date_gmt` | Local/GMT values; draft GMT zeros | `sermons.service_date`; immutable source timestamp fields | Map the exact local `post_date` calendar date as preached date; preserve timestamps; flag but do not change non-Sundays | `database observed` |
| `post_modified`, `post_modified_gmt` | Source update timestamps | `source_updated_at`; migration checksum/audit | Preserve with WordPress timezone context | `database-observed` |
| `post_content` | Empty on all sermons | `sermons.body` nullable | Do not fabricate body content | `database-observed` |
| `post_excerpt` | Empty on all sermons | `sermons.summary` nullable only while incomplete; reviewed description required before schedule/publish/launch | Do not fabricate or auto-approve summaries; Phase 3B.2 must draft and humans must approve all 453 | `database-observed-and-approved-target-decision` |
| `post_password` | Empty on all sermons | None | Do not introduce a password-protected state | `database-observed` |
| `guid` | Not treated as canonical URL | Optional source audit only | Canonical mapping comes from public permalink/slug evidence | `database-observed` |
| `post_author` | WordPress identity reference | Optional migration audit | Do not migrate users, password hashes, auth data, or credentials through this content map | `database-observed` |

`post_date` is the field used by Pro list/widget output, related-sermon ordering, and series date-range calculations. Yang confirmed it represents the preached date. Four included published records are non-Sunday and must be preserved with `non_sunday_service_date` warnings. (`source and database confirmed`)

## Sermon post metadata

| Source key | Live usage/value shape | Proposed target | Migration rule | Evidence |
| --- | --- | --- | --- | --- |
| `asp_sermon_youtube` | 453 rows; 324 populated; all populated values are `youtu.be` URLs | `sermon_media` (`video`, `youtube`) | Retain source URL; parse canonical video ID; generate controlled embeds | `source-and-database-confirmed` |
| `asp_sermon_video_type_select` | `youtube` on 324 records | Media source audit/provider discriminator | Use only as corroborating evidence; infer provider from validated source too | `database-observed` |
| `asp_sermon_audio_embed` | 453 rows; 424 populated SermonAudio iframes; max length 186 | `sermon_media` (`audio`, `sermonaudio`) plus controlled migration source | Extract approved provider URL/ID; never render imported markup directly | `source-and-database-confirmed` |
| `asp_sermon_bible_passage` | 453 rows; 436 populated free-form values | `scripture_references.display_text` with provenance | Preserve exactly; parse optionally; reconcile without overwriting taxonomy value | `source-and-database-confirmed` |
| `asp_sermon_pdf` | 453 rows, all empty | `sermon_resources` only if a future nonempty record exists | Do not create empty resources | `database-observed` |
| `asp_sermon_bulletin` | 422 rows, empty | `sermon_resources` only if populated | Do not infer use from field registration | `database-observed` |
| `asp_sermon_vimeo` | 422 rows, empty | `sermon_media` only if populated | No live migration row expected | `database-observed` |
| `asp_sermon_facebook` | 422 rows, empty | `sermon_media` only if populated | No live migration row expected | `database-observed` |
| `asp_sermon_video_embed` | 422 rows, null | Controlled media staging only if populated | Reject/direct-review arbitrary embed markup | `database-observed` |
| `asp_sermon_mp4` | 422 rows, empty | `sermon_media` only after provider/type validation | Do not assume audio/video from the key name | `database-observed` |
| `asp_sermon_soundcloud` | 422 rows, empty | `sermon_media` only if populated | No live migration row expected | `database-observed` |
| `_thumbnail_id` | No sermon relationship | `featured_asset_id` remains null unless another approved source supplies one | Do not create attachment references | `database-observed` |
| `post_views_count` | 453 numeric values; 14–1,550; total 290,487 | `sermon_legacy_metrics` private migration audit | Preserve every value; never expose through public API; public display disabled pending a separate decision | `source-and-database-confirmed` |
| AIOSEO sermon keys | 450 rows; effective per-sermon fields null/empty | SEO columns only when meaningful value exists | Do not import empty plugin arrays or inherited placeholders | `database-observed` |

There are no duplicate sermon/key rows for the relevant `asp_sermon_*` keys. YouTube has no duplicate nonempty value group. Audio has five duplicate nonempty groups covering 11 rows; those must be compared by sermon/date before deduplication. (`database-observed`)

The empty per-sermon AIOSEO overrides do not prove that rendered titles, descriptions, canonicals, social metadata, or visible content are absent. Preserve those template-generated and page-visible signals through the whole-site baseline and parity process in `seo-migration-validation-plan.md`. If a later approved extraction finds materially populated SEO/social overrides, retain them as controlled migration evidence and map only supported values into explicit target fields; never discard them because the new visual design omits a field.

Published media matrix: 319 YouTube, 419 audio, 290 both, zero neither. Pending: all five have both. Drafts: none has either. (`database-observed`)

## Taxonomy mapping

| Source taxonomy | Actual live semantics | Proposed target | Migration rule | Evidence |
| --- | --- | --- | --- | --- |
| `sermon_speaker` | Public label Preacher; 9 registered, 8 used by any sermon, 7 used by published sermons; included rows have at most one observed assignment | `speakers`, nullable sole `sermons.speaker_id` | Preserve the sole assignment; Yang's final one-speaker decision supersedes the generic taxonomy join. Refuse/warn and leave incomplete on a multi-speaker anomaly rather than selecting silently | `source-and-database-confirmed-and-approved-decision` |
| `sermon_series` | 29 terms; 441 assignments; 9 sermons have two series | `series`, `sermon_series_map` | Many-to-many required; preserve near-duplicates until approved merge | `source-and-database-confirmed` |
| `sermon_topics` | Public Passage filter; 379 registered, 376 used by any sermon | `source_taxonomy_terms`; scripture-reference provenance; optional approved topic model | Do not treat blindly as general topics; preserve exact term/slug/assignment | `source-and-database-confirmed` |
| `sermon_book` | 23 terms including noncanonical `Selected Text`; one non-public sermon has two | `book_classifications`, `sermon_book_classifications`, optional canonical `bible_book_id` | Preserve source classification and map canonically only when reliable | `source-and-database-confirmed` |
| `sermon_campus` | No registered term or relationship | Omit from initial target | Add only if a separate authoritative source/requirement emerges | `database-observed` |
| `sermon_service_type` | No registered term or relationship | Omit from initial target | Add only if a separate authoritative source/requirement emerges | `database-observed` |

All term descriptions are empty, all parents are zero, and relationship order is zero. `asp_term_order` exists for one book, two speakers, and 90 passage terms. (`database-observed`)

The parent uses `asp_term_order` as numeric taxonomy display-order metadata; it is not an attachment ID. Preserve it on the source-term record, while public filter order continues to follow the live ascending-name options. (`source-and-database-confirmed`)

Term image metadata maps `series-taxonomy-image-id` and `speaker-taxonomy-image-id` to optional media assets. Two speaker references resolve, one speaker reference is broken, and the single series value is zero/broken. (`source-and-database-confirmed`)

## Passage reconciliation map

| Condition on published sermons | Count | Target handling | Evidence |
| --- | ---: | --- | --- |
| Meta and taxonomy both present, exact text match | 387 | One display reference may be normalised, but retain both source provenances | `database-observed` |
| Both present, text mismatch | 36 | Preserve two source values; apply an approved normaliser/parser; never choose silently | `database-observed` |
| Meta only | 8 | Preserve as free-form scripture reference | `database-observed` |
| Taxonomy only | 5 | Preserve term-backed display reference and source assignment | `database-observed` |
| Neither | 12 | Allow null/empty scripture collection | `database-observed` |

Common non-semantic mismatches include `Psalm`/`Psalms` and abbreviations, but some values genuinely differ. Structured parsing must record `parse_status` and original input. (`database-observed`)

## Pro option inventory

The supplied Pro source registers the following 53 normal settings. The live database populates all 31 non-language settings and none of the 22 language settings. (`source-and-database-confirmed`)

| Group | Registered option names | Live shape/usage | Evidence |
| --- | --- | --- | --- |
| General (2) | `asp_general_sermon_duplicator`, `asp_general_sermon_search` | Duplicator enabled; empty search value means the default search control remains visible | `source-and-database-confirmed` |
| Design (1) | `asp_design_accent` | Populated | `source-and-database-confirmed` |
| Single sermon (7) | `asp_single_sermon_disable_passage_link`, `asp_single_sermon_passage_version`, `asp_single_sermon_enable_sidebar`, `asp_single_sermon_disable_social_share`, `asp_single_sermon_enable_navigation`, `asp_single_sermon_related_sermons`, `asp_single_sermon_related_sermons_count` | Passage version `NASB1995`; related count 3; related/navigation/social enabled; sidebar disabled | `source-and-database-confirmed` |
| Archive (11) | `asp_archive_series_details`, `asp_archive_speaker_details`, `asp_archive_target_control`, `asp_archive_sermon_count`, `asp_archive_scripture`, `asp_archive_hide_filter_order`, `asp_archive_hide_filter_speaker`, `asp_archive_hide_filter_topic`, `asp_archive_hide_filter_book`, `asp_archive_hide_filter_series`, `asp_archive_hide_date_range` | Count 9; target `_self`; filters/date visible; speaker details `none` | `source-and-database-confirmed` |
| Metadata mapping (10) | `asp_misc_passage_meta`, `asp_misc_pdf_meta`, `asp_misc_youtube_meta`, `asp_misc_vimeo_meta`, `asp_misc_facebook_meta`, `asp_misc_video_embed_meta`, `asp_misc_audio_meta`, `asp_misc_audio_embed_meta`, `asp_misc_soundcloud_meta`, `asp_misc_bulletin_meta` | All rows exist; passage/PDF/YouTube/audio-embed mappings are empty; several others contain identifier-like text | `source-and-database-confirmed` |
| Language (22) | `asp_language_archive_button`, `asp_language_archive_title`, `asp_language_audio_player_heading`, `asp_language_bible_passage`, `asp_language_date_range_placeholder`, `asp_language_download_tooltip`, `asp_language_filter_button`, `asp_language_filter_clear_all`, `asp_language_list_button`, `asp_language_listen_tooltip`, `asp_language_load_more_button`, `asp_language_navigation_next`, `asp_language_navigation_previous`, `asp_language_order_newest_placeholder`, `asp_language_order_oldest_placeholder`, `asp_language_related_sermons`, `asp_language_search_keyword_placeholder`, `asp_language_sermon_details_bulletin`, `asp_language_sermon_details_download`, `asp_language_sermon_details_listen`, `asp_language_sermon_details_soundcloud`, `asp_language_share_sermon` | None populated; defaults/localisation are therefore parent/add-on/runtime concerns, not stored overrides | `source-and-database-confirmed` |

Additional live parent/general settings select list view, archive numeric/default pagination, ascending-name filter option ordering, date format `j F, Y`, empty archive slug override, and no default series image. The configured general sermon-image setting is a URL on an origin other than the known staging or public `www` hosts; the value was not retrieved. (`database-observed`)

Material parent option names confirmed from the installed source are:

| Concern | Parent option names | Migration/parity treatment |
| --- | --- | --- |
| URL/date/labels/layout | `asp_general_archive_slug`, `asp_general_date_format`, `asp_general_sermon_layout`, `asp_general_sermon_label`, `asp_general_speaker_label`, `asp_general_topic_label`, `asp_general_book_label` | Preserve URL and visible terminology behavior where populated; content migration does not copy visual configuration wholesale |
| Views | `asp_general_disable_view_count` | Public counter display remains disabled; source values move to private audit |
| Pagination/filter shell | `asp_archive_pagination_type`, `asp_archive_sermon_count`, `asp_archive_hide_filtering`, `asp_archive_filter_search`, `asp_archive_filter_date_range`, `asp_archive_filter_order`, `asp_archive_filter_series`, `asp_archive_filter_speaker`, `asp_archive_filter_topic`, `asp_archive_filter_book` | Current database selects numeric/default pagination, 9/page, and visible controls |
| Dropdown ordering | `asp_archive_series_dropdown_order`, `asp_archive_series_dropdown_orderby`, `asp_archive_speaker_dropdown_order`, `asp_archive_speaker_dropdown_orderby`, `asp_archive_topic_dropdown_order`, `asp_archive_topic_dropdown_orderby`, `asp_archive_book_dropdown_order`, `asp_archive_book_dropdown_orderby` | Current values specify ascending name order; target facets must use actual published relationships |
| Default images/player | `asp_design_sermon_image`, `asp_single_sermon_default_series_image`, `asp_misc_media_player_style_kit`, `asp_misc_facebook_assets` | Do not import unknown-origin/default visual assets automatically; provider rendering is application-controlled |

The installed parent registers 104 settings in total (13 general, 15 archive, 67 design, 6 single, 3 miscellaneous). Only the subset above materially affects migration or behavior parity; the 67 visual-design settings are not copied into the target data model. (`source-and-database-confirmed`)

The installed source confirms these are compatibility mappings for alternate/custom metadata keys. Cross-checking found no additional populated sermon values to import from the configured identifiers; registered or populated mapping options do not create target data by themselves. (`source-and-database-confirmed`)

A sensitive licence option exists. Only its presence was counted; its value is excluded from discovery and migration artifacts. (`database-observed`)

## Shortcodes, query parameters, and source behaviour

| Source feature | Intended/live evidence | Migration implication | Evidence |
| --- | --- | --- | --- |
| `asp-archive` | Registered by Pro; no current content use found | No content conversion required unless dynamic/theme use is later found | `source-and-database-confirmed` |
| `asp-series` | Registered; no current content use found | Preserve only if theme/snippet evidence emerges | `source-and-database-confirmed` |
| `asp-sermons` | Registered; homepage uses `[asp-sermons order="DESC" post="3"]` | Replace homepage block with a newest-three published-sermons query | `source-and-database-confirmed` |
| `asp-speakers` | Registered; no current content use found | No content conversion currently required | `source-and-database-confirmed` |
| `asp-widgets` | Registered; no current content use found | Theme/widget use remains a separate source inspection item | `source-and-database-confirmed` |
| Archive filters | `s`, `sermon_dates`, `order`, `sermon_series`, `sermon_speaker`, `sermon_topics`, `sermon_book` | Preserve compatibility at web-route boundary | `source-and-database-confirmed` |
| Related sermons | Published sermons sharing current series, excluding current; date-desc; count setting | Implement deterministic M:N series query; define behaviour for multiple series | `source-and-database-confirmed` |
| Legacy detail URLs | Parent archive slug defaults to `sermons` with `with_front=false`; Pro uses core permalinks; live URLs are `/sermons/{slug}/` | Preserve observed archive/detail paths | `source-and-database-confirmed` |
| Keyword matching | Native WordPress `s` search over post title/content/excerpt plus exact taxonomy-name lookup; no plugin relevance/tokenization override | Translate legacy `s`; target weighted full-text search is deliberate and documented | `source-confirmed` |
| Date range | `sermon_dates=YYYY-MM-DD - YYYY-MM-DD`; inclusive `after`/`before` on local `post_date` | Translate to inclusive target `dateFrom`/`dateTo` | `source-confirmed` |
| Cross-filter semantics | Direct/main query uses `AND`; AJAX-prepared taxonomy branch uses `OR` | Preserve observed/approved `AND`; regression-test the discrepancy | `source-and-database-confirmed` |
| AJAX/fallback | Public and authenticated generation endpoints, form-data filter events, history updates, numeric/load-more support; direct GET form URLs are the fallback | Keep server-rendered/no-JS URLs mandatory; enhancement is optional | `source-confirmed` |
| View counts | Parent increments `post_views_count` on the single template, except for `manage_options` users or when disabled | Preserve privately only; no public/API field | `source-and-database-confirmed` |

## Exact installed-source registration map

- `sermons` is public, hierarchical, publicly queryable, archived and queryable, excluded from the native site-wide search, omitted from REST, and uses standard post capabilities/statuses. Supports are title, editor, thumbnail, excerpt, and comments. (`source-confirmed`)
- `sermon_series`, `sermon_speaker`, and `sermon_book` are hierarchical; `sermon_topics` is flat. All are public/admin-visible/queryable and omitted from REST. (`source-confirmed`)
- Parent-owned sermon keys are `asp_sermon_youtube`, `asp_sermon_vimeo`, `asp_sermon_facebook`, `asp_sermon_video_embed`, `asp_sermon_video_type_select`, `asp_sermon_mp4`, `asp_sermon_soundcloud`, `asp_sermon_audio_embed`, `asp_sermon_pdf`, `asp_sermon_bulletin`, and `asp_sermon_bible_passage`. Term keys are `asp_term_order`, `series-taxonomy-image-id`, and `speaker-taxonomy-image-id`. Database usage is recorded above. (`source-and-database-confirmed`)
- Admin controls are text inputs for provider/resource URLs and passage, textareas for custom video/audio markup, a video-type select, and WordPress media uploaders for MP4/PDF/bulletin URLs. The save path uses a nonce/capability check but one broad HTML allowlist and no provider-specific URL validation or blank-value deletion. The replacement does not imitate these insecure/obsolete details. (`source-confirmed`)
- Parent templates support child-theme override locations for archive/search/single sermon templates and expose archive, single, media, related-sermon, navigation, social, and sidebar action hooks used by Pro. (`source-confirmed`)
- Pro duplication creates a draft and copies post fields, taxonomies, and postmeta. Its action has a nonce but no explicit action-level capability check; the replacement retains server-enforced roles. (`source-confirmed`)

Installed snapshot identity is recorded in `current-wordpress-sermon-inventory.md` and `decision-log.md`. No semantic difference from the earlier Pro 2.2 review was found; byte identity remains `unresolved` only because the old ZIP is absent.
