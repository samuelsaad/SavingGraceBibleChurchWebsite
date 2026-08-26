# Saving Grace Bible Church Website

Local Phase 3B.2 caption/enrichment rehearsal, Phase 3B.2b punctuation hardening, and a guided private administrator-review workflow for the Astro/TypeScript/PostgreSQL replacement described in `church-website-architecture-plan.md`.

## Current scope

- Fail-closed journalled local PostgreSQL schema runner plus explicit standalone rollback SQL
- Typed public/admin sermon API contracts
- Runtime input validation
- Parameterized PostgreSQL public sermon repository
- Framework-independent `/api/v1/sermons` list/detail HTTP router
- Server-rendered local public sermon archive/detail routes with legacy-compatible search and filters, stable pagination, metadata-related sermons, mapped `301`/`410` handling, and a published-only sermon sitemap
- Separate server-rendered **Browse by Bible passage** controls backed only by administrator-confirmed structured primary preaching passages; pending title proposals, supporting references and private sermons are excluded
- Offline description-only semantic foundation with a verified external BAAI ONNX model, locked local-only Transformers.js adapter, exact float32 scoring, shared eligibility/stale-removal guards, pending quality status, no model files in Git and no public **Related themes** output
- Provider-independent protected admin handlers with allowlisted local test identities
- Final default-deny single-`admin` policy with no editor/contributor or ownership-based behaviour
- Transactional create/update/relationship operations, explicit lifecycle transitions, audit, and row-version concurrency
- Exactly one nullable-while-incomplete speaker relationship; schedule/publish requires one and migration refuses multi-speaker anomalies
- Idempotent local reference seeding for the seven confirmed speakers and the exact 66-book Protestant canon, with deterministic identities, canonical order, supported Bible-book aliases, no automatic sermon assignment, and relationship-derived administrator/public counts
- Reused `sermons.summary` as the reviewed public **Sermon description**, with explicit lifecycle/provenance, approved-only weight-C search and controlled `seo_description` fallback
- First-class reviewed plain-text transcripts and 5–10 ordered reviewed Q&A pairs with approved-only lower-weight search
- Derived readiness, a 448-currently-published-candidate public-launch gate, deterministic enrichment queue, and idempotent draft-only import contract
- Private YouTube Studio caption-file processor with trusted exact-scope derivation, deterministic punctuation-only chunks and hashes, whole-sermon lexical-token preservation/rollback, structured source provenance/warnings, and no media/network implementation
- Bounded official YouTube Data API proof for owner-authenticated, read-only inspection and exact-byte VTT retrieval of only the three accepted pilots, with ignored private provenance, deterministic full-sequence alignment and private human-review evidence
- Deterministic Phase 3B.2c selection controls for 36 primaries plus 12 predetermined alternates, with caption inspection separated from the exact 12-record Wave 1 retrieval/processing boundary
- One-shot, retry-disabled official YouTube `videos.list(part=snippet)` title provenance for only the fixed 12-record Wave 1 allowlist, with exact UTF-8 titles and integrity hashes confined to ignored private storage
- Exact Wave 1 private import of 12 transcript drafts, 12 description drafts and 84 Q&A drafts, followed by quarantine of the superseded extractive descriptions/Q&A and one approved-transcript-grounded replacement canary; everything remains unapproved and private
- Repository-scoped `sermon-enrichment` skill with mandatory approved-transcript binding, paragraph/Q&A support ranges, stale-result rejection, administrator-only quality decisions and a private atomic replacement workflow
- Independent generated-description/Q&A mechanical proofreading with blocking pre-import/pre-approval checks, safe contextual review flags and a bounded idempotent current-15 draft correction command
- Legacy query/date compatibility translation
- Deterministic Advanced Sermons dry-run importer
- Loopback-only anonymised fixture loader with an explicit write opt-in
- Date, status, slug, taxonomy, scripture, and media transformations
- Structured migration audit/warning output
- Permanent whole-site SEO non-regression, one-to-one URL mapping, and launch-gate planning
- Responsive accessible local `/admin` foundation plus a dedicated one-stage-at-a-time `/admin/sermons/:id/review` workflow for imported drafts, with one decision per deterministic atomic finding, exact identity-set completion gates, large transcript/Q&A editors, persistent progress, explicit approval, optimistic concurrency and audit
- Administrator sermon-list primary-passage filters for book/chapter/verse/range and review state, plus an explicit Primary passage column that distinguishes pending proposals, confirmed passages and unresolved outcomes
- Canonical administrator-only YouTube source links on sermon lists, edit/overview pages and every guided-review stage, resolved fail-closed from controlled media plus private provenance without embeds, thumbnails or provider requests
- Server-rendered uncollapsed approved description before media/transcript/Q&A; collapsed transcript remains in initial markup and list payloads omit heavy bodies
- Automated migration, security, lifecycle, configuration, and schema-contract tests
- Static `/health.json` build metadata explicitly marked `runtimeHealth: false`; a genuine runtime health check remains future work

This milestone does not include deployment, cloud infrastructure, Cognito configuration, production loading, audio/video processing, new transcription, or any WordPress/YouTube mutation. The completed official YouTube reads were separately bounded: first to the three accepted pilots, then to metadata inspection of the deterministic 36-primary/12-alternate set and exact-byte retrieval of only the resolved 12-record Wave 1. No continuing provider authority is implied. A read-only reconciliation on 17 August 2026 confirmed that all three pilot records remain private draft sermons and have completed guided reviews, approved transcripts, approved descriptions, seven approved Q&A pairs each, confirmed identity metadata and one canonical Bible-book assignment each. Samuel Saad accepted only that three-sermon pilot. The later 12 Wave 1 records remain separate and private. One authorised canary now has a replacement description and seven replacement Q&A drafts awaiting administrator review; the other 11 generated description/Q&A sets are visibly quarantined and cannot be approved. Neither pilot acceptance nor this canary authorises another sermon, semantic generation/quality acceptance, public **Related themes**, publication, production/deployment access or Phase 3C. The AWS runtime and Astro production adapter remain intentionally undecided.

The approved direction is a complete WordPress replacement, with WordPress remaining live until authorised cutover. Continue Astro/API/PostgreSQL, preferably a statically generated public site separated from protected administration/API/PostgreSQL. Production administration will use individually attributable MFA identities for Samuel and Yang or another authorised church administrator. Exact AWS services/pricing are undecided; target ongoing hosting below A$70/month where practical and avoid unnecessary NAT, Fargate, RDS Proxy or Multi-AZ infrastructure. There is no fixed launch month. The five pending sermons remain unpublished and do not block the 448-candidate public launch gate; the three WordPress drafts remain excluded.

Operational local work is restricted to `savinggrace_sermons_test` on `127.0.0.1:5432`. `npm run test:postgres` refuses that persistent pilot database and instead creates a strongly named unique loopback database, runs the complete PostgreSQL suite, and drops only that exact disposable target. The schema runner uses a separate `schema_migrations` journal, stable checksums of each paired up/down definition, an advisory lock, exact-prefix validation and transactional DDL/receipt writes. A matching fully applied schema is a no-op; unknown, changed, missing, duplicate, reordered or unjournalled history fails closed instead of being baselined.

The implemented admin routes, authorization, transition, deletion, and dashboard contracts are documented in `admin-api-contract.md`. There is one non-secret local admin identity, disabled by default, limited to loopback/development, and never a substitute for the future verified identity adapter.

## Permanent SEO launch gate

The current website performs well in organic search. The rebuild must preserve its established search signals at minimum across the entire website and should improve technical SEO only when safely validated. Production launch is blocked unless complete URL mapping, metadata/canonical parity, direct redirects, crawlability/indexability, sitemap/robots/structured data, internal-link, mobile/accessibility/performance, pre-launch crawl, and rollback evidence pass the requirements in `seo-migration-validation-plan.md`.

Ranking improvements are not guaranteed. Primary indexable content must be server-rendered and visible without client-side JavaScript; non-public/admin/search/preview/staging routes must remain non-indexable. The known staging-origin social-image defect must be corrected before launch. A fresh production crawl or Search Console/analytics access requires a later explicitly approved read-only task and has not been performed in this local milestone.

## Local commands

```text
npm install
npm run check
npm test
npm run test:postgres
npm run build
npm run migration:dry-run -- --input tests/fixtures/dry-run.json
npm run enrichment:export-queue-local -- anonymised-local-fixture
npm run enrichment:import-draft-local -- path/to/strict-local-draft-bundle.json
npm run enrichment:pilot-local -- path/to/ignored-private-pilot-manifest.json
npm run enrichment:punctuation-local -- prepare path/to/ignored-private-pilot-manifest.json video-id private-workspace
npm run youtube:pilot-auth-local
npm run youtube:pilot-inspect-local
npm run youtube:pilot-retrieve-local
npm run youtube:wave1-map-local
npm run youtube:wave1-inspect-local
npm run youtube:wave1-retrieve-local
npm run youtube:wave1-titles-local
npm run enrichment:wave1-metadata-local
npm run enrichment:wave1-verify-local
npm run enrichment:wave1-review-repair-local
npm run enrichment:canary-local -- prepare
npm run enrichment:canary-local -- validate
npm run enrichment:canary-local -- import
npm run enrichment:canary-local -- verify
npm run enrichment:mechanical-qa-current15-local
npm run db:apply-atomic-review-local
npm run db:rollback-atomic-review-local
npm run db:apply-primary-passage-local
npm run scripture:prepare-current15-local
npm run scripture:repair-current15-official-titles-local
npm run db:rollback-primary-passage-local
npm run reference:apply-local
npm run reference:rollback-local
npm run launch-readiness:local
```

The dry-run command accepts an approved local JSON input and prints only the safe migration report. It does not connect to MariaDB or PostgreSQL and never writes records. Original media/embed values remain internal migration provenance and are deliberately omitted from stdout.

The enrichment queue is deterministic by safe source WordPress ID and missing requirement across description, transcript and Q&A. Draft import requires the same loopback/write gate as fixture loading, validates target/source identity and row version, rejects HTML-like content, stores private structured provenance, remains idempotent, never marks content reviewed/approved, and refuses to replace different approved descriptions, transcripts, or Q&A. The private enrichment commands read local caption text only and contain no downloader, audio processing, speech-to-text, provider or network implementation. The separate official API proof is documented in `youtube-pilot-caption-proof.md`; it can download exact existing VTT bytes only for an eligible track on one of the three hard-coded accepted pilots and never cleans or imports them. Phase 3B.2b normalises source and cleaned text to Unicode NFC, measures whitespace-delimited lexical-token sequences independently, strips only Unicode punctuation from each token for comparison, and case-folds the remainder. It rejects any token count, boundary, order or content change—including splitting or merging—while allowing punctuation, case and line-break changes. Stable chunks, cryptographic hashes, deterministic reassembly, exact-two trusted scope, no-clobber persistence and fail-closed verification were exercised by the authorised private exact-two run. Import itself created no approval; the later recorded administrator actions completed all three reviews while every sermon remained draft and private.

The bounded official API pilot proof completed on 19 August 2026 after owner authentication verified the common owner channel of all three pilots. Each video exposed one serving, non-draft English ASR track with an `unknown` audio association. The explicit three-pilot-only amendment allowed such a track only when it is the video's sole caption track, retaining `audio_track_type_unverified` and never claiming confirmed primary audio. All three exact VTT responses were retained privately without translation. Deterministic full-sequence alignment produced two normalized exact matches and one `differences_detected_manual_review_required` result: 109 insertions/deletions/substitutions across 87 short regions, 98.499243% normalized similarity. The aligned wording and cue references exist only in an ignored private review artifact; neither source was automatically accepted. Per-video continuation does not authorise another video, content processing, database work, publication or deployment.

The separately authorised Phase 3B.2c run inspected caption metadata for the deterministic 36 primaries and 12 mapped alternates, then retrieved and processed only the 12 resolved Wave 1 primaries. Migration `0013_official_youtube_caption_provenance` accepts both authorised Studio-export and official-API provenance while rejecting other values. The exact local database retains migrations `0011`–`0013`; the semantic migrations created structure only and all semantic eligibility/build/relationship counts remain zero. Wave 1 contains 12 private transcript drafts, 12 private description drafts and 84 private Q&A drafts. All have mandatory review provenance and `audio_track_type_unverified`; none has an approval marker, public-search eligibility or semantic output. The second import was unchanged for every record.

The original Wave 1 import left all six atomic guided-review expectation fields uninitialised. This made every one of the 12 review sets fail source-identity, item-count, item-identity and transcript-version verification even though their stored zero-finding sets and draft bodies were intact. The bounded local repair command synchronises only those expectation fields from the existing private drafts, records a safe system audit event and refuses any unexpected review/content/provenance state. Its identical rerun is a no-op. All 12 review sets are now verified and offer explicit zero-finding acknowledgement; no acknowledgement, content decision, approval or completion was created automatically, and later stages remain locked until genuine administrator action.

The Wave 1 extractive description/Q&A path is retired and its `process` command fails closed. Existing bodies carrying that processing reference remain in their private bundles and database audit history, but the service and dashboard prevent them from entering review or approval. The `sermon-enrichment` skill is required for replacement work. Its canary command prepares a private request from the current approved transcript, validates a structured private result with transcript hash/version and per-output support ranges, atomically replaces only untouched unapproved description/Q&A fields, preserves transcript/provenance/review/audit evidence, and proves a second import is unchanged. Automated validation is structural and grounding evidence only; it is never theological or administrator approval.

Generated descriptions and Q&A additionally pass `generated-text-mechanical-qa-v1`. Incorrect Jesus/Christ casing and obvious mechanical spacing, punctuation, sentence-start and join defects block grounded import and generated-content review/approval. Context-dependent capitalization and possible name/fragment concerns are shown as review flags and are never blindly corrected. The bounded current-15 command requires the exact three-pilot/12-Wave-1 processing-version scope and local write gate; it updates only indisputable defects in unreviewed generated drafts, records safe system audit evidence, preserves privacy/provenance/administrator state and must be unchanged on rerun. The completed current audit corrected 13 capitalization defects across three sermons; one sentence-start finding and 15 contextual flags remain for human review in quarantined material.

When a disposable loopback PostgreSQL database is available, apply the schema and load the anonymised fixture only with both `DATABASE_URL` and `ALLOW_LOCAL_DB_WRITE=1`:

```text
npm run db:apply-local
npm run migration:load-local -- --input tests/fixtures/dry-run.json
npm run api:local
npm run db:rollback-local
```

The schema commands keep schema history separate from `migration_records` and `sermon_enrichment_draft_imports`. Apply runs only the pending canonical suffix. Rollback removes only the latest requested receipt, or the full applied suffix for an unscoped rollback, in the same transaction as its down SQL. The SQL files remain independently executable rollback artifacts; the runner normalises CRLF/CR/LF differences before hashing their paired definitions.

Migration `0014_primary_preaching_passages` extends the existing Scripture-reference model with reviewed primary/supporting/unclassified roles, one confirmed lead primary, provenance and concurrency fields plus private proposal-review state. Its bounded preparation command accepts no record argument: it requires the exact one/two/twelve processing-version split for the current three pilots and 12 Wave 1 records, writes exact evidence to ignored private storage, and creates pending proposals or manual-review outcomes without altering sermon content or administrator decisions. The later authorised repair used one retry-disabled official `videos.list(part=snippet)` response for exactly the fixed 12 Wave 1 identities, retained only their exact title provenance privately, preserved the three pilot proposals, and changed the Wave 1 aggregate from 12 no-reference outcomes to 11 pending proposals plus one pending no-reference outcome. Its identical rerun preserved all 12 repaired records. Only an administrator-confirmed primary passage can appear under **Preached from** or satisfy `passageBook`, `passageChapter`, `passageVerse` and `passageEndVerse` public query parameters.

Reference seeding is a separate local data operation because the core schema already provides the required structure. It requires the same exact loopback PostgreSQL 16 test target and write opt-in, inserts only the confirmed seven speakers plus 66 canonical books/classifications, and is idempotent. Its guarded rollback refuses partial, changed, or in-use catalogue state. It never selects a speaker or Bible book for a sermon. Bible-book abbreviations and aliases are normalised only to resolve trusted import terms; ambiguous aliases fail closed. Administrator relationship counts include private drafts, while public counts include only complete published sermons, and neither count is stored as historical source truth.

After `npm run build`, the reviewed Phase 3B dashboard can be started with the existing password-free libpq credential mechanism:

```powershell
$env:DATABASE_URL="postgresql://127.0.0.1:5432/savinggrace_sermons_test"
$env:ALLOW_LOCAL_DB_WRITE="1"
npm run dashboard:local
```

Open `http://127.0.0.1:4322/admin`. The harness refuses non-loopback database and listener targets. Stop it with `Ctrl+C` after local review.

Imported Phase 3B.2 drafts, including the 12 Wave 1 records, appear in the dashboard's imported-sermon review queue and open in the dedicated `/admin/sermons/:id/review` route. The authorised canary is labelled as a transcript-grounded replacement draft and remains available for full review. The other 11 records display an explicit superseded-generation quarantine and have disabled description/Q&A approval actions until separately authorised replacements exist. The administrator must review identity/provenance, every warning or finding, the complete transcript, description and each ordered Q&A before any approval. Viewing or saving never implies approval. The route has no publish, schedule, archive or deletion action, and the general dashboard also hides scheduling until a real publication worker exists.

Administrator sermon responses derive `youtubeSource` from the existing controlled `sermon_media` relationship and, when present, the private `sermon_enrichment_sources` provenance row. A link is returned only when every stored YouTube candidate is valid and all candidates identify the same 11-character video ID; missing, invalid or conflicting evidence fails closed to no link. The dashboard constructs one HTTPS canonical watch URL, strips playlist/tracking/timestamp parameters from identity, never embeds or preloads YouTube, and opens the source in a new tab with `noopener noreferrer`. This field is administrator-only and does not alter public sermon pages.

Operational loaders refuse every target except `savinggrace_sermons_test` on loopback port 5432. The integration runner requires its generated token and exact `savinggrace_test_run_<token>` database, and explicitly rejects the persistent pilot target.

## Project boundaries

- `src/domain`: framework-independent types and deterministic transformations
- `src/api/contracts`: stable `/api/v1` public/admin validation contracts
- `src/application`: lifecycle and permission rules
- `src/server/auth`: provider-independent identity boundary and local-only allowlisted adapter
- `src/server`: server-only PostgreSQL repository, query, and portable HTTP boundaries
- `src/migration`: journalled schema runner, importer, audit output, identity, and CLI
- `src/enrichment`: strict queue/draft contracts, provider interfaces, and local idempotent PostgreSQL draft workflow
- `src/youtube`: bounded server-only official API pilot-caption proof; it has no application or public-site integration
- `src/readiness`: derived inventory/readiness reporting; the approved public-launch gate applies to the 448 published candidates
- `historical-enrichment-plan.md`: three-output Phase 3B.2 contract, review boundary and exact launch gate
- `youtube-pilot-caption-proof.md`: owner OAuth, track-selection, private persistence/comparison and stop-boundary contract
- `db/migrations`: ordered PostgreSQL SQL migrations
- `tests`: anonymised fixtures and automated contract tests

## Configuration

Copy `.env.example` to a local ignored `.env` only when a local PostgreSQL service is available. Never place legacy or production credentials in repository files. A production Astro/AWS adapter has not been selected; `api:local` is a local-only Node harness around the portable request handlers.

## Source safety

The proprietary `advanced-sermons*.zip` pattern and extracted plugin directories are excluded by `.gitignore`. Plugin implementation code must never be copied into this application. The exact installed source was inspected read-only outside the workspace and is identified only by aggregate fingerprints in the discovery artifacts.

## Next approval gate

The immediate gate is real administrator review of the one replacement canary and a separate human decision about whether its enrichment quality is acceptable. The other 11 Wave 1 description/Q&A sets remain quarantined; replacing them requires fresh authority after the canary decision. Pilot acceptance does not accept Wave 1. Wave 2, Wave 3, every other sermon, embeddings, semantic relationships, public **Related themes**, publication, production/deployment and Phase 3C remain unauthorised. The verified live source snapshot contains 449 published and five pending eligible sermons; the three Advanced Sermons drafts remain excluded. Public launch remains blocked until every included published candidate passes the content and whole-site SEO gates.
