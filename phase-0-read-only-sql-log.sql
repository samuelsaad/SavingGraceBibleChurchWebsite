-- Saving Grace Bible Church website rebuild
-- Phase 0 read-only discovery SQL log
-- Started: 2026-08-04 (Australia/Sydney)
-- Credentials, connection strings, account names, database names, and host addresses are intentionally omitted.
-- WordPress prefix `wp` was observed by SHOW TABLES on 2026-08-04.
-- The administrator-approved temporary grant exception is documented in the Markdown discovery artifacts.
-- Every content-discovery session is placed in a read-only transaction.

-- Mandatory gate (executed 2026-08-04)
SELECT VERSION();
SELECT DATABASE();
SELECT CURRENT_USER();
SHOW GRANTS FOR CURRENT_USER;
SHOW TABLES;

-- Read-only session guard (executed before each database inventory batch)
SET SESSION TRANSACTION READ ONLY;
START TRANSACTION READ ONLY;

-- Core schema inventory
DESCRIBE wp_posts;
DESCRIBE wp_postmeta;
DESCRIBE wp_terms;
DESCRIBE wp_term_taxonomy;
DESCRIBE wp_term_relationships;
DESCRIBE wp_termmeta;
DESCRIBE wp_options;

SELECT table_name, engine, table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND (table_name LIKE '%sermon%' OR table_name LIKE '%asp%')
ORDER BY table_name;

-- Installed/active plugin evidence. These statements return booleans or names, never plugin option payloads.
SELECT
  MAX(option_name = 'active_plugins') AS active_plugins_option_present,
  MAX(option_name = 'active_plugins' AND LOCATE('advanced-sermons/advanced-sermons.php', option_value) > 0) AS parent_plugin_active,
  MAX(option_name = 'active_plugins' AND LOCATE('advanced-sermons-pro/advanced-sermons-pro.php', option_value) > 0) AS pro_addon_active
FROM wp_options
WHERE option_name = 'active_plugins';

SELECT
  option_name,
  (option_value REGEXP 's:[0-9]+:"advanced-sermons-pro/advanced-sermons-pro\\.php";s:[0-9]+:"2\\.2"') AS installed_version_2_2_evidence,
  CHAR_LENGTH(option_value) AS value_length
FROM wp_options
WHERE option_name IN ('_site_transient_update_plugins', '_transient_update_plugins');

SELECT option_name, CHAR_LENGTH(option_value) AS value_length, autoload
FROM wp_options
WHERE (option_name LIKE '%sermon%' OR option_name LIKE 'asp_%')
  AND option_name NOT REGEXP '(license|secret|token|password|auth|nonce|key)'
ORDER BY option_name;

SELECT
  SUM(option_name = 'asp_license_key') AS sensitive_license_option_present,
  SUM(option_name REGEXP '(password|secret|token|auth|nonce)') AS other_sensitive_named_options_present
FROM wp_options
WHERE option_name LIKE 'asp_%' OR option_name LIKE '%sermon%';

SELECT option_name,
       CASE
         WHEN option_value = '' THEN 'empty'
         WHEN option_value REGEXP '^a:[0-9]+:' OR option_value REGEXP '^O:[0-9]+:' THEN 'php_serialized'
         WHEN option_value REGEXP '^-?[0-9]+([.][0-9]+)?$' THEN 'numeric'
         WHEN option_value REGEXP '^https?://' THEN 'url'
         ELSE 'text'
       END AS value_shape,
       CHAR_LENGTH(option_value) AS value_length,
       option_value
FROM wp_options
WHERE option_name IN (
  'asp_general_archive_slug', 'asp_general_date_format', 'asp_general_sermon_layout',
  'asp_general_sermon_search', 'asp_general_sermon_duplicator',
  'asp_archive_sermon_count', 'asp_archive_target_control', 'asp_archive_scripture',
  'asp_archive_series_details', 'asp_archive_speaker_details',
  'asp_archive_hide_filter_order', 'asp_archive_hide_filter_speaker',
  'asp_archive_hide_filter_topic', 'asp_archive_hide_filter_book',
  'asp_archive_hide_filter_series', 'asp_archive_hide_date_range',
  'asp_single_sermon_disable_passage_link', 'asp_single_sermon_passage_version',
  'asp_single_sermon_enable_sidebar', 'asp_single_sermon_disable_social_share',
  'asp_single_sermon_enable_navigation', 'asp_single_sermon_related_sermons',
  'asp_single_sermon_related_sermons_count', 'asp_single_sermon_default_series_image',
  'asp_misc_passage_meta', 'asp_misc_pdf_meta', 'asp_misc_youtube_meta',
  'asp_misc_vimeo_meta', 'asp_misc_facebook_meta', 'asp_misc_video_embed_meta',
  'asp_misc_audio_meta', 'asp_misc_audio_embed_meta', 'asp_misc_soundcloud_meta',
  'asp_misc_bulletin_meta'
)
ORDER BY option_name;

SELECT option_name,
       CASE
         WHEN option_name IN ('home', 'siteurl') THEN option_value LIKE 'https://www.savinggrace.org.au%'
         ELSE NULL
       END AS matches_public_origin,
       CASE WHEN option_name NOT IN ('home', 'siteurl') THEN option_value ELSE NULL END AS safe_value
FROM wp_options
WHERE option_name IN ('timezone_string', 'gmt_offset', 'date_format', 'time_format',
                      'permalink_structure', 'home', 'siteurl');

-- Post types, sermon statuses, dates, and data quality
SELECT post_type, post_status, COUNT(*) AS record_count
FROM wp_posts
GROUP BY post_type, post_status
ORDER BY post_type, post_status;

SELECT post_status,
       COUNT(*) AS sermon_count,
       SUM(post_title = '') AS missing_title_count,
       SUM(post_name = '') AS missing_slug_count,
       SUM(post_date = '0000-00-00 00:00:00') AS zero_local_date_count,
       SUM(post_date_gmt = '0000-00-00 00:00:00') AS zero_gmt_date_count,
       MIN(NULLIF(post_date, '0000-00-00 00:00:00')) AS earliest_local_date,
       MAX(NULLIF(post_date, '0000-00-00 00:00:00')) AS latest_local_date,
       MIN(NULLIF(post_date_gmt, '0000-00-00 00:00:00')) AS earliest_gmt_date,
       MAX(NULLIF(post_date_gmt, '0000-00-00 00:00:00')) AS latest_gmt_date,
       MAX(post_modified) AS latest_modified_local
FROM wp_posts
WHERE post_type = 'sermons'
GROUP BY post_status
ORDER BY post_status;

SELECT ID, post_title, post_name, post_status, post_date, post_date_gmt,
       post_modified, post_modified_gmt, CHAR_LENGTH(post_excerpt) AS excerpt_length,
       CHAR_LENGTH(post_content) AS content_length
FROM wp_posts
WHERE post_type = 'sermons' AND post_status = 'publish'
ORDER BY post_date DESC, ID DESC
LIMIT 10;

SELECT ID, post_title, post_name, post_status, post_date, post_date_gmt,
       post_modified, post_modified_gmt, CHAR_LENGTH(post_excerpt) AS excerpt_length,
       CHAR_LENGTH(post_content) AS content_length
FROM wp_posts
WHERE post_type = 'sermons' AND post_status = 'publish'
ORDER BY post_date ASC, ID ASC
LIMIT 10;

WITH duplicate_slugs AS (
  SELECT post_name
  FROM wp_posts
  WHERE post_type = 'sermons' AND post_name <> ''
  GROUP BY post_name
  HAVING COUNT(*) > 1
)
SELECT COUNT(*) AS duplicate_slug_groups
FROM duplicate_slugs;

SELECT post_status,
       SUM(post_date > NOW()) AS future_local_date_count,
       SUM(post_date_gmt > UTC_TIMESTAMP()) AS future_gmt_date_count
FROM wp_posts
WHERE post_type = 'sermons'
GROUP BY post_status
ORDER BY post_status;

-- Sermon post metadata: key inventory and value shapes only
SELECT pm.meta_key,
       COUNT(*) AS value_count,
       COUNT(DISTINCT pm.post_id) AS sermon_count,
       SUM(pm.meta_value = '') AS empty_value_count,
       SUM(pm.meta_value REGEXP '^(a|O|s|i|b|d):[0-9]+:') AS serialized_like_count,
       SUM(pm.meta_value REGEXP '^https?://') AS url_like_count,
       SUM(pm.meta_value REGEXP '^-?[0-9]+$') AS integer_like_count,
       SUM(pm.meta_value REGEXP '<[A-Za-z][^>]*>') AS html_like_count,
       MIN(CHAR_LENGTH(pm.meta_value)) AS min_value_length,
       MAX(CHAR_LENGTH(pm.meta_value)) AS max_value_length
FROM wp_postmeta pm
JOIN wp_posts p ON p.ID = pm.post_id
WHERE p.post_type = 'sermons'
GROUP BY pm.meta_key
ORDER BY sermon_count DESC, pm.meta_key;

WITH duplicate_meta AS (
  SELECT pm.post_id, pm.meta_key, COUNT(*) AS duplicate_count
  FROM wp_postmeta pm
  JOIN wp_posts p ON p.ID = pm.post_id
  WHERE p.post_type = 'sermons'
  GROUP BY pm.post_id, pm.meta_key
  HAVING COUNT(*) > 1
)
SELECT meta_key, COUNT(*) AS affected_sermons, MAX(duplicate_count) AS maximum_rows_per_sermon
FROM duplicate_meta
GROUP BY meta_key
ORDER BY affected_sermons DESC, meta_key;

SELECT pm.meta_key,
       COUNT(*) AS row_count,
       COUNT(DISTINCT pm.post_id) AS sermon_count,
       SUM(pm.meta_value = '') AS empty_count,
       SUM(pm.meta_value REGEXP '^https?://') AS url_count,
       SUM(pm.meta_value REGEXP '^-?[0-9]+$') AS integer_count,
       SUM(pm.meta_value REGEXP '<(iframe|audio|video|object|embed)[^>]*>') AS embed_markup_count,
       SUM(pm.meta_value LIKE '%youtube.com/watch%') AS youtube_watch_count,
       SUM(pm.meta_value LIKE '%youtu.be/%') AS youtube_short_count,
       SUM(pm.meta_value LIKE '%youtube.com/embed/%') AS youtube_embed_count,
       SUM(pm.meta_value LIKE '%vimeo.com/%') AS vimeo_count,
       SUM(pm.meta_value LIKE '%soundcloud.com/%') AS soundcloud_count,
       SUM(pm.meta_value LIKE '%.mp3%') AS mp3_reference_count,
       SUM(pm.meta_value LIKE '%.m4a%') AS m4a_reference_count,
       SUM(pm.meta_value LIKE '%.pdf%') AS pdf_reference_count,
       MIN(CHAR_LENGTH(pm.meta_value)) AS min_length,
       MAX(CHAR_LENGTH(pm.meta_value)) AS max_length
FROM wp_postmeta pm
JOIN wp_posts p ON p.ID = pm.post_id
WHERE p.post_type = 'sermons'
  AND (pm.meta_key LIKE 'asp_%' OR pm.meta_key = '_thumbnail_id'
       OR pm.meta_key LIKE '%view%' OR pm.meta_key LIKE '%podcast%' OR pm.meta_key LIKE '%seo%')
GROUP BY pm.meta_key
ORDER BY pm.meta_key;

SELECT
  COUNT(DISTINCT p.ID) AS published_sermons,
  COUNT(DISTINCT CASE WHEN thumb.meta_id IS NOT NULL THEN p.ID END) AS with_thumbnail_meta,
  COUNT(DISTINCT CASE WHEN attachment.ID IS NOT NULL THEN p.ID END) AS with_valid_thumbnail_attachment,
  COUNT(DISTINCT CASE WHEN thumb.meta_id IS NOT NULL AND attachment.ID IS NULL THEN p.ID END) AS broken_thumbnail_reference
FROM wp_posts p
LEFT JOIN wp_postmeta thumb ON thumb.post_id = p.ID AND thumb.meta_key = '_thumbnail_id'
LEFT JOIN wp_posts attachment ON attachment.ID = CAST(thumb.meta_value AS UNSIGNED)
                             AND attachment.post_type = 'attachment'
WHERE p.post_type = 'sermons' AND p.post_status = 'publish';

SELECT attachment.post_mime_type, attachment.post_status, COUNT(DISTINCT attachment.ID) AS attachment_count
FROM wp_posts sermon
JOIN wp_postmeta thumb ON thumb.post_id = sermon.ID AND thumb.meta_key = '_thumbnail_id'
JOIN wp_posts attachment ON attachment.ID = CAST(thumb.meta_value AS UNSIGNED)
WHERE sermon.post_type = 'sermons'
GROUP BY attachment.post_mime_type, attachment.post_status
ORDER BY attachment_count DESC, attachment.post_mime_type;

SELECT pm.meta_key,
       COUNT(*) AS references_count,
       SUM(pm.meta_value REGEXP '^[0-9]+$') AS numeric_reference_count,
       SUM(pm.meta_value REGEXP '^https?://') AS url_reference_count,
       SUM(pm.meta_value REGEXP '^[0-9]+$' AND attachment.ID IS NOT NULL) AS valid_attachment_id_count,
       SUM(pm.meta_value REGEXP '^[0-9]+$' AND attachment.ID IS NULL) AS broken_attachment_id_count
FROM wp_postmeta pm
JOIN wp_posts sermon ON sermon.ID = pm.post_id AND sermon.post_type = 'sermons'
LEFT JOIN wp_posts attachment ON attachment.ID = CASE WHEN pm.meta_value REGEXP '^[0-9]+$' THEN CAST(pm.meta_value AS UNSIGNED) END
                              AND attachment.post_type = 'attachment'
WHERE pm.meta_key IN ('asp_sermon_pdf', 'asp_sermon_bulletin', 'asp_sermon_mp4',
                      'asp_sermon_audio_embed', 'asp_sermon_video_embed')
GROUP BY pm.meta_key
ORDER BY pm.meta_key;

-- Taxonomy, relationship, hierarchy, and term metadata inventory
SELECT tt.taxonomy,
       COUNT(DISTINCT tr.object_id) AS sermon_count,
       COUNT(DISTINCT tt.term_id) AS term_count,
       COUNT(*) AS relationship_count,
       SUM(tt.parent <> 0) AS relationships_to_child_terms
FROM wp_term_relationships tr
JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
JOIN wp_posts p ON p.ID = tr.object_id
WHERE p.post_type = 'sermons'
GROUP BY tt.taxonomy
ORDER BY tt.taxonomy;

SELECT tt.taxonomy, t.term_id, t.name, t.slug,
       CHAR_LENGTH(tt.description) AS description_length,
       tt.parent, tt.count AS stored_count,
       COUNT(DISTINCT tr.object_id) AS actual_sermon_relationship_count
FROM wp_term_taxonomy tt
JOIN wp_terms t ON t.term_id = tt.term_id
LEFT JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id
WHERE tt.taxonomy LIKE 'sermon_%'
GROUP BY tt.taxonomy, t.term_id, t.name, t.slug, tt.description, tt.parent, tt.count
ORDER BY tt.taxonomy, t.term_id;

WITH per_sermon_taxonomy AS (
  SELECT tt.taxonomy, tr.object_id, COUNT(*) AS term_count
  FROM wp_term_relationships tr
  JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
  JOIN wp_posts p ON p.ID = tr.object_id
  WHERE p.post_type = 'sermons' AND tt.taxonomy LIKE 'sermon_%'
  GROUP BY tt.taxonomy, tr.object_id
)
SELECT taxonomy,
       COUNT(*) AS sermons_with_terms,
       SUM(term_count > 1) AS sermons_with_multiple_terms,
       MAX(term_count) AS maximum_terms_on_one_sermon
FROM per_sermon_taxonomy
GROUP BY taxonomy
ORDER BY taxonomy;

SELECT taxonomy,
       SUM(assigned_term_count = 0) AS published_sermons_without_term,
       SUM(assigned_term_count > 1) AS published_sermons_with_multiple_terms
FROM (
  SELECT tax.taxonomy, p.ID,
         COUNT(DISTINCT tt.term_taxonomy_id) AS assigned_term_count
  FROM wp_posts p
  CROSS JOIN (
    SELECT 'sermon_series' AS taxonomy UNION ALL
    SELECT 'sermon_speaker' UNION ALL
    SELECT 'sermon_topics' UNION ALL
    SELECT 'sermon_book' UNION ALL
    SELECT 'sermon_campus' UNION ALL
    SELECT 'sermon_service_type'
  ) tax
  LEFT JOIN wp_term_relationships tr ON tr.object_id = p.ID
  LEFT JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
                               AND tt.taxonomy = tax.taxonomy
  WHERE p.post_type = 'sermons' AND p.post_status = 'publish'
  GROUP BY tax.taxonomy, p.ID
) assignments
GROUP BY taxonomy
ORDER BY taxonomy;

SELECT tt.taxonomy, tm.meta_key,
       COUNT(*) AS value_count,
       COUNT(DISTINCT tm.term_id) AS term_count,
       SUM(tm.meta_value = '') AS empty_count,
       SUM(tm.meta_value REGEXP '^[0-9]+$') AS integer_like_count,
       SUM(tm.meta_value REGEXP '^https?://') AS url_like_count,
       SUM(tm.meta_value REGEXP '^(a|O|s|i|b|d):[0-9]+:') AS serialized_like_count,
       MIN(CHAR_LENGTH(tm.meta_value)) AS min_length,
       MAX(CHAR_LENGTH(tm.meta_value)) AS max_length
FROM wp_termmeta tm
JOIN wp_term_taxonomy tt ON tt.term_id = tm.term_id
WHERE tt.taxonomy LIKE 'sermon_%'
GROUP BY tt.taxonomy, tm.meta_key
ORDER BY tt.taxonomy, tm.meta_key;

SELECT tt.taxonomy, tm.meta_key,
       COUNT(*) AS references_count,
       SUM(tm.meta_value REGEXP '^[0-9]+$' AND attachment.ID IS NOT NULL) AS valid_attachment_id_count,
       SUM(tm.meta_value REGEXP '^[0-9]+$' AND attachment.ID IS NULL) AS broken_attachment_id_count
FROM wp_termmeta tm
JOIN wp_term_taxonomy tt ON tt.term_id = tm.term_id
LEFT JOIN wp_posts attachment ON attachment.ID = CASE WHEN tm.meta_value REGEXP '^[0-9]+$' THEN CAST(tm.meta_value AS UNSIGNED) END
                             AND attachment.post_type = 'attachment'
WHERE tt.taxonomy IN ('sermon_series', 'sermon_speaker')
  AND tm.meta_key IN ('series-taxonomy-image-id', 'speaker-taxonomy-image-id')
GROUP BY tt.taxonomy, tm.meta_key
ORDER BY tt.taxonomy, tm.meta_key;

-- Passage/book quality and legacy URL relationships
SELECT
  SUM(tt.taxonomy = 'sermon_topics') AS passage_term_count,
  SUM(tt.taxonomy = 'sermon_topics' AND t.name = 'Selected Text') AS selected_text_passage_terms,
  SUM(tt.taxonomy = 'sermon_topics' AND t.name REGEXP '^[1-3]?[[:space:]]*[A-Za-z]+([[:space:]][A-Za-z]+)*[[:space:]]+[0-9]+([:][0-9]+)?([[:space:]]*[-–][[:space:]]*[0-9]+([:][0-9]+)?)?$') AS scripture_like_passage_terms,
  SUM(tt.taxonomy = 'sermon_book') AS book_term_count,
  SUM(tt.taxonomy = 'sermon_book' AND t.name = 'Selected Text') AS selected_text_book_terms
FROM wp_term_taxonomy tt
JOIN wp_terms t ON t.term_id = tt.term_id
WHERE tt.taxonomy IN ('sermon_topics', 'sermon_book');

SELECT
  COUNT(*) AS old_slug_rows,
  COUNT(DISTINCT pm.post_id) AS sermons_with_old_slugs,
  COUNT(DISTINCT pm.meta_value) AS distinct_old_slugs
FROM wp_postmeta pm
JOIN wp_posts p ON p.ID = pm.post_id
WHERE p.post_type = 'sermons' AND pm.meta_key = '_wp_old_slug';

SELECT
  COUNT(*) AS published_sermons,
  SUM(post_name = '') AS missing_slug_count,
  COUNT(DISTINCT post_name) AS distinct_slug_count
FROM wp_posts
WHERE post_type = 'sermons' AND post_status = 'publish';

-- Additional evidence-driven cross-checks added after the first aggregate pass
SELECT
  REGEXP_SUBSTR(option_value,
    's:[0-9]+:"advanced-sermons-pro/advanced-sermons-pro\\.php";s:[0-9]+:"[0-9]+([.][0-9]+)*"')
    AS checked_installed_pro_version_pair
FROM wp_options
WHERE option_name IN ('_site_transient_update_plugins', '_transient_update_plugins');

SELECT option_name, option_value
FROM wp_options
WHERE option_name IN (
  'asp_archive_pagination_type', 'asp_archive_filter_sermon_count',
  'asp_archive_hide_criteria_box', 'asp_archive_hide_filtering',
  'asp_archive_book_dropdown_order', 'asp_archive_book_dropdown_orderby',
  'asp_archive_series_dropdown_order', 'asp_archive_series_dropdown_orderby',
  'asp_archive_speaker_dropdown_order', 'asp_archive_speaker_dropdown_orderby',
  'asp_archive_topic_dropdown_order', 'asp_archive_topic_dropdown_orderby',
  'asp_general_archive_option', 'asp_general_archive_page',
  'asp_general_book_label', 'asp_general_speaker_label', 'asp_general_topic_label'
)
ORDER BY option_name;

SELECT
  SUM(post_content LIKE '%[asp-archive%') AS asp_archive_shortcode_posts,
  SUM(post_content LIKE '%[asp-series%') AS asp_series_shortcode_posts,
  SUM(post_content LIKE '%[asp-sermons%') AS asp_sermons_shortcode_posts,
  SUM(post_content LIKE '%[asp-speakers%') AS asp_speakers_shortcode_posts,
  SUM(post_content LIKE '%[asp-widgets%') AS asp_widgets_shortcode_posts
FROM wp_posts;

SELECT post_status,
       COUNT(*) AS sermon_count,
       SUM(post_content <> '') AS nonempty_content_count,
       SUM(post_excerpt <> '') AS nonempty_excerpt_count,
       SUM(post_password <> '') AS password_protected_count
FROM wp_posts
WHERE post_type = 'sermons'
GROUP BY post_status
ORDER BY post_status;

SELECT p.post_status,
       COUNT(*) AS sermon_count,
       SUM(COALESCE(youtube.meta_value, '') <> '') AS with_youtube,
       SUM(COALESCE(audio.meta_value, '') <> '') AS with_audio_embed,
       SUM(COALESCE(youtube.meta_value, '') <> '' AND COALESCE(audio.meta_value, '') <> '') AS with_both,
       SUM(COALESCE(youtube.meta_value, '') = '' AND COALESCE(audio.meta_value, '') = '') AS with_neither,
       SUM(COALESCE(passage.meta_value, '') <> '') AS with_passage_meta
FROM wp_posts p
LEFT JOIN wp_postmeta youtube ON youtube.post_id = p.ID AND youtube.meta_key = 'asp_sermon_youtube'
LEFT JOIN wp_postmeta audio ON audio.post_id = p.ID AND audio.meta_key = 'asp_sermon_audio_embed'
LEFT JOIN wp_postmeta passage ON passage.post_id = p.ID AND passage.meta_key = 'asp_sermon_bible_passage'
WHERE p.post_type = 'sermons'
GROUP BY p.post_status
ORDER BY p.post_status;

SELECT pm.meta_key,
       COUNT(*) AS row_count,
       SUM(pm.meta_value IS NULL) AS null_value_count,
       SUM(pm.meta_value = '') AS empty_string_count,
       SUM(pm.meta_value IS NOT NULL AND pm.meta_value <> '') AS populated_count
FROM wp_postmeta pm
JOIN wp_posts p ON p.ID = pm.post_id
WHERE p.post_type = 'sermons'
GROUP BY pm.meta_key
ORDER BY pm.meta_key;

SELECT COUNT(*) AS duplicate_post_meta_groups
FROM (
  SELECT pm.post_id, pm.meta_key
  FROM wp_postmeta pm
  JOIN wp_posts p ON p.ID = pm.post_id
  WHERE p.post_type = 'sermons'
  GROUP BY pm.post_id, pm.meta_key
  HAVING COUNT(*) > 1
) duplicate_meta;

SELECT tt.taxonomy,
       SUM(tr.term_order <> 0) AS nonzero_relationship_order_count,
       MIN(tr.term_order) AS minimum_relationship_order,
       MAX(tr.term_order) AS maximum_relationship_order
FROM wp_term_relationships tr
JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
JOIN wp_posts p ON p.ID = tr.object_id
WHERE p.post_type = 'sermons' AND tt.taxonomy LIKE 'sermon_%'
GROUP BY tt.taxonomy
ORDER BY tt.taxonomy;

SELECT tt.taxonomy, t.term_id, t.name, t.slug,
       CHAR_LENGTH(tt.description) AS description_length,
       tt.parent, tt.count AS stored_count,
       COUNT(DISTINCT tr.object_id) AS actual_sermon_relationship_count
FROM wp_term_taxonomy tt
JOIN wp_terms t ON t.term_id = tt.term_id
LEFT JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id
WHERE tt.taxonomy IN ('sermon_series', 'sermon_speaker', 'sermon_book')
GROUP BY tt.taxonomy, t.term_id, t.name, t.slug, tt.description, tt.parent, tt.count
ORDER BY tt.taxonomy, t.term_id;

SELECT tt.taxonomy, t.term_id, t.name, t.slug,
       CHAR_LENGTH(tt.description) AS description_length,
       tt.parent, tt.count AS stored_count
FROM wp_term_taxonomy tt
JOIN wp_terms t ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'sermon_topics'
  AND t.name <> 'Selected Text'
  AND t.name NOT REGEXP '^[1-3]?[[:space:]]*[A-Za-z]+([[:space:]][A-Za-z]+)*[[:space:]]+[0-9]+([:][0-9]+)?([[:space:]]*[-–][[:space:]]*[0-9]+([:][0-9]+)?)?$'
ORDER BY t.term_id;

DESCRIBE wp_sb_books_sermons;
DESCRIBE wp_sb_sermons;
DESCRIBE wp_sb_sermons_tags;

SELECT
  (SELECT COUNT(*) FROM wp_sb_books_sermons) AS books_sermons_rows,
  (SELECT COUNT(*) FROM wp_sb_sermons) AS sermons_rows,
  (SELECT COUNT(*) FROM wp_sb_sermons_tags) AS sermons_tags_rows;

SELECT post_type, post_status, COUNT(*) AS posts_using_asp_sermons_shortcode
FROM wp_posts
WHERE post_content LIKE '%[asp-sermons%'
GROUP BY post_type, post_status
ORDER BY post_type, post_status;

SELECT
  SUM(option_name LIKE 'asp_language_%') AS populated_pro_language_options,
  SUM(option_name IN ('asp_general_sermon_duplicator', 'asp_general_sermon_search')) AS populated_pro_general_options,
  SUM(option_name = 'asp_design_accent') AS populated_pro_design_options,
  SUM(option_name IN (
    'asp_single_sermon_disable_passage_link', 'asp_single_sermon_passage_version',
    'asp_single_sermon_enable_sidebar', 'asp_single_sermon_disable_social_share',
    'asp_single_sermon_enable_navigation', 'asp_single_sermon_related_sermons',
    'asp_single_sermon_related_sermons_count'
  )) AS populated_pro_single_options,
  SUM(option_name IN (
    'asp_archive_series_details', 'asp_archive_speaker_details', 'asp_archive_target_control',
    'asp_archive_sermon_count', 'asp_archive_scripture', 'asp_archive_hide_filter_order',
    'asp_archive_hide_filter_speaker', 'asp_archive_hide_filter_topic',
    'asp_archive_hide_filter_book', 'asp_archive_hide_filter_series',
    'asp_archive_hide_date_range'
  )) AS populated_pro_archive_options,
  SUM(option_name IN (
    'asp_misc_passage_meta', 'asp_misc_pdf_meta', 'asp_misc_youtube_meta',
    'asp_misc_vimeo_meta', 'asp_misc_facebook_meta', 'asp_misc_video_embed_meta',
    'asp_misc_audio_meta', 'asp_misc_audio_embed_meta', 'asp_misc_soundcloud_meta',
    'asp_misc_bulletin_meta'
  )) AS populated_pro_misc_options
FROM wp_options;

WITH passage_taxonomy AS (
  SELECT tr.object_id AS sermon_id, MAX(t.name) AS taxonomy_passage
  FROM wp_term_relationships tr
  JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
  JOIN wp_terms t ON t.term_id = tt.term_id
  WHERE tt.taxonomy = 'sermon_topics'
  GROUP BY tr.object_id
), passage_meta AS (
  SELECT post_id AS sermon_id, meta_value AS meta_passage
  FROM wp_postmeta
  WHERE meta_key = 'asp_sermon_bible_passage'
)
SELECT p.post_status,
       COUNT(*) AS sermon_count,
       SUM(COALESCE(pm.meta_passage, '') <> '' AND COALESCE(pt.taxonomy_passage, '') <> '') AS both_present,
       SUM(COALESCE(pm.meta_passage, '') <> '' AND COALESCE(pt.taxonomy_passage, '') = '') AS meta_only,
       SUM(COALESCE(pm.meta_passage, '') = '' AND COALESCE(pt.taxonomy_passage, '') <> '') AS taxonomy_only,
       SUM(COALESCE(pm.meta_passage, '') = '' AND COALESCE(pt.taxonomy_passage, '') = '') AS neither_present,
       SUM(COALESCE(pm.meta_passage, '') <> '' AND pm.meta_passage = pt.taxonomy_passage) AS exact_match,
       SUM(COALESCE(pm.meta_passage, '') <> '' AND COALESCE(pt.taxonomy_passage, '') <> ''
           AND pm.meta_passage <> pt.taxonomy_passage) AS mismatch
FROM wp_posts p
LEFT JOIN passage_meta pm ON pm.sermon_id = p.ID
LEFT JOIN passage_taxonomy pt ON pt.sermon_id = p.ID
WHERE p.post_type = 'sermons'
GROUP BY p.post_status
ORDER BY p.post_status;

WITH passage_taxonomy AS (
  SELECT tr.object_id AS sermon_id, MAX(t.name) AS taxonomy_passage
  FROM wp_term_relationships tr
  JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
  JOIN wp_terms t ON t.term_id = tt.term_id
  WHERE tt.taxonomy = 'sermon_topics'
  GROUP BY tr.object_id
), passage_meta AS (
  SELECT post_id AS sermon_id, meta_value AS meta_passage
  FROM wp_postmeta
  WHERE meta_key = 'asp_sermon_bible_passage'
)
SELECT p.ID, p.post_title, p.post_name, p.post_status,
       pm.meta_passage, pt.taxonomy_passage
FROM wp_posts p
LEFT JOIN passage_meta pm ON pm.sermon_id = p.ID
LEFT JOIN passage_taxonomy pt ON pt.sermon_id = p.ID
WHERE p.post_type = 'sermons' AND p.post_status = 'publish'
  AND (
    (COALESCE(pm.meta_passage, '') <> '' AND COALESCE(pt.taxonomy_passage, '') = '') OR
    (COALESCE(pm.meta_passage, '') = '' AND COALESCE(pt.taxonomy_passage, '') <> '') OR
    (COALESCE(pm.meta_passage, '') <> '' AND COALESCE(pt.taxonomy_passage, '') <> ''
     AND pm.meta_passage <> pt.taxonomy_passage)
  )
ORDER BY p.ID
LIMIT 25;

SELECT tt.taxonomy, t.term_id, t.name, t.slug,
       tm.meta_key, tm.meta_value,
       CASE WHEN attachment.ID IS NOT NULL THEN 1 ELSE 0 END AS valid_attachment_reference
FROM wp_termmeta tm
JOIN wp_term_taxonomy tt ON tt.term_id = tm.term_id
JOIN wp_terms t ON t.term_id = tm.term_id
LEFT JOIN wp_posts attachment
  ON attachment.ID = CASE WHEN tm.meta_value REGEXP '^[0-9]+$' THEN CAST(tm.meta_value AS UNSIGNED) END
 AND attachment.post_type = 'attachment'
WHERE tt.taxonomy LIKE 'sermon_%'
ORDER BY tt.taxonomy, t.term_id, tm.meta_key;

SELECT p.ID, p.post_title, p.post_name, p.post_status,
       REGEXP_SUBSTR(p.post_content, '\\[asp-sermons[^]]*\\]') AS asp_sermons_shortcode
FROM wp_posts p
WHERE p.post_status = 'publish' AND p.post_content LIKE '%[asp-sermons%'
ORDER BY p.ID;

SELECT p.ID, p.post_title, p.post_name, p.post_status,
       SUBSTRING(
         p.post_content,
         LOCATE('[asp-sermons', p.post_content),
         LOCATE(']', p.post_content, LOCATE('[asp-sermons', p.post_content))
           - LOCATE('[asp-sermons', p.post_content) + 1
       ) AS asp_sermons_shortcode_corrected
FROM wp_posts p
WHERE p.post_status = 'publish' AND p.post_content LIKE '%[asp-sermons%'
ORDER BY p.ID;

SELECT p.post_type, p.post_status, COUNT(*) AS linked_legacy_sermon_rows
FROM wp_sb_sermons legacy
LEFT JOIN wp_posts p ON p.ID = legacy.page_id
GROUP BY p.post_type, p.post_status
ORDER BY p.post_type, p.post_status;

SELECT
  SUM(legacy_sermon.id IS NOT NULL) AS valid_books_sermons_links,
  SUM(legacy_sermon.id IS NULL) AS broken_books_sermons_links
FROM wp_sb_books_sermons relation
LEFT JOIN wp_sb_sermons legacy_sermon ON legacy_sermon.id = relation.sermon_id;

SELECT
  SUM(legacy_sermon.id IS NOT NULL) AS valid_sermons_tags_links,
  SUM(legacy_sermon.id IS NULL) AS broken_sermons_tags_links
FROM wp_sb_sermons_tags relation
LEFT JOIN wp_sb_sermons legacy_sermon ON legacy_sermon.id = relation.sermon_id;

WITH duplicate_youtube AS (
  SELECT meta_value, COUNT(*) AS occurrence_count
  FROM wp_postmeta pm
  JOIN wp_posts p ON p.ID = pm.post_id
  WHERE p.post_type = 'sermons' AND pm.meta_key = 'asp_sermon_youtube'
    AND COALESCE(pm.meta_value, '') <> ''
  GROUP BY meta_value
  HAVING COUNT(*) > 1
), duplicate_audio AS (
  SELECT meta_value, COUNT(*) AS occurrence_count
  FROM wp_postmeta pm
  JOIN wp_posts p ON p.ID = pm.post_id
  WHERE p.post_type = 'sermons' AND pm.meta_key = 'asp_sermon_audio_embed'
    AND COALESCE(pm.meta_value, '') <> ''
  GROUP BY meta_value
  HAVING COUNT(*) > 1
)
SELECT
  (SELECT COUNT(*) FROM duplicate_youtube) AS duplicate_youtube_value_groups,
  (SELECT COALESCE(SUM(occurrence_count), 0) FROM duplicate_youtube) AS youtube_rows_in_duplicate_groups,
  (SELECT COUNT(*) FROM duplicate_audio) AS duplicate_audio_value_groups,
  (SELECT COALESCE(SUM(occurrence_count), 0) FROM duplicate_audio) AS audio_rows_in_duplicate_groups;

SELECT option_name,
       CHAR_LENGTH(option_value) AS value_length,
       option_value REGEXP '^https?://' AS is_url,
       option_value LIKE '%stage.savinggrace.org.au%' AS uses_staging_origin,
       option_value LIKE '%www.savinggrace.org.au%' AS uses_public_www_origin
FROM wp_options
WHERE option_name IN ('asp_design_sermon_image', 'asp_single_sermon_default_series_image')
ORDER BY option_name;

-- Complete registered sermon-term inventory (440 rows returned)
SELECT tt.taxonomy, t.term_id, t.name, t.slug, tt.term_taxonomy_id,
       tt.parent, tt.count AS stored_count,
       SUM(p.post_type = 'sermons') AS actual_all_sermon_relationships,
       SUM(p.post_type = 'sermons' AND p.post_status = 'publish') AS actual_published_sermon_relationships
FROM wp_term_taxonomy tt
JOIN wp_terms t ON t.term_id = tt.term_id
LEFT JOIN wp_term_relationships tr ON tr.term_taxonomy_id = tt.term_taxonomy_id
LEFT JOIN wp_posts p ON p.ID = tr.object_id
WHERE tt.taxonomy IN (
  'sermon_book', 'sermon_series', 'sermon_speaker', 'sermon_topics',
  'sermon_campus', 'sermon_service_type'
)
GROUP BY tt.term_taxonomy_id, tt.taxonomy, t.term_id, t.name, t.slug, tt.parent, tt.count
ORDER BY tt.taxonomy, t.name;

-- No COMMIT is issued. Closing each mysqlsh session ends its read-only transaction.

-- Yang decision checks (executed 2026-08-05)
-- A fresh read-only transaction was started before these statements.
SET SESSION TRANSACTION READ ONLY;
START TRANSACTION READ ONLY;

SELECT post_status,
       COUNT(*) AS sermon_count,
       SUM(TRIM(COALESCE(post_title, '')) <> '') AS titled_count,
       SUM(TRIM(COALESCE(post_title, '')) = '') AS blank_title_count,
       SUM(DAYOFWEEK(DATE(post_date)) = 1) AS sunday_count,
       SUM(DAYOFWEEK(DATE(post_date)) <> 1) AS non_sunday_count
FROM wp_posts
WHERE post_type = 'sermons'
GROUP BY post_status
ORDER BY post_status;

SELECT
  SUM(post_status = 'publish') AS published_included,
  SUM(post_status = 'pending' AND TRIM(COALESCE(post_title, '')) <> '') AS titled_pending_included,
  SUM(post_status = 'pending' AND TRIM(COALESCE(post_title, '')) = '') AS blank_pending_excluded,
  SUM(post_status = 'draft') AS draft_excluded,
  SUM((post_status = 'publish' OR (post_status = 'pending' AND TRIM(COALESCE(post_title, '')) <> ''))
      AND DAYOFWEEK(DATE(post_date)) <> 1) AS included_non_sunday_review_count
FROM wp_posts
WHERE post_type = 'sermons';

-- No COMMIT was issued. The mysqlsh session ended the read-only transaction.
