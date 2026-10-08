# Modular church content coverage

The CMS imports the existing integrated Astra church website and preserves Claude's sermon archive/detail components. Its initial content is built by `src/cms/seed.ts` from the tracked church content sources. No sermon transcript, description, Q&A, acceptance or review evidence is copied into CMS documents.

The source inventory is **51 entities**: one homepage, 33 church pages, three blog posts, ten events, three venues and one global settings document. The 33 pages comprise 28 published pages, four drafts and one private page. The homepage is the twenty-ninth published church page. The seed registers metadata for the 45 existing embedded media images and the separate church logo, retaining their current URLs and bytes. It does not retrieve the legacy PDF or OneDrive documents.

## Editors, sources and renderers

| Dashboard editor | Initial source | Frontend renderer and route |
| --- | --- | --- |
| Homepage | `src/frontend/content/home-content.ts`, `content/site-snapshot.ts` | `pages/home.ts`, `/` |
| Church pages | `src/frontend/content/pages/*.ts` and page registry | `pages/church.ts`, canonical `SitePage.path` |
| Blog posts | `content/pages/post-*.ts` | Blog index and post renderers in `pages/church.ts`; three original dated URLs |
| Events | `content/events.ts` ten event definitions | Homepage event module, event modules, `/events/`, individual event pages, `/events/calendar.ics` |
| Venues | `content/events.ts` three venues | Event detail, listing and calendar feed |
| Website settings | `content/home-content.ts`, `content/navigation.ts`, current shell wording | `shell.ts` on every church, sermon, archive, taxonomy and boundary page |
| Images and documents | `assets/media.ts`, embedded logo and persistent CMS asset metadata | `components/blocks.ts` pictures/downloads and the controlled asset route |
| Module composition | Ordered source blocks and five homepage compositions | `components/blocks.ts`, existing Astra components; no administrator HTML or CSS |

The backend retains immutable draft/published revisions separately. `createCmsFrontendSnapshot` projects only repository-selected revisions into an immutable per-request object. `FrontendRenderContext.siteContent` carries that object through routing, page lookups, image lookups, events, shell and components. There is no mutable global content registry or startup-only copy. Both the public handler's `content` provider and the protected preview handler's `church.content` provider refresh it for every request. The default static Astro build remains a reproducible baseline; the local/staging server renders the selected database revisions without rebuilding it.

## Church page coverage

Every row supports its title, description, heading/intro, existing hero image and visibility, supported content modules, ordered module visibility, related links, parent and page publication controls. Existing legacy addresses remain recorded. Optional source notes/provenance are retained without turning them into visitor content.

| Area | Canonical page paths | Source files in `src/frontend/content/pages/` |
| --- | --- | --- |
| About and leadership | `/about/`, `/elders/`, `/our-history/` | `about.ts`, `elders.ts`, `our-history.ts` |
| Services | `/lords-day-service/`, `/evening-service/` | `lords-day-service.ts`, `evening-service.ts` |
| Doctrine and teaching | `/doctrinal-statement/`, `/what-we-teach/`, `/what-we-teach/the-gospel/`, `/what-we-teach/the-sufficiency-of-scripture/`, `/what-we-teach/believers-baptism/`, `/what-we-teach/mandated-church/` | `doctrinal-statement.ts`, `what-we-teach.ts`, `the-gospel.ts`, `the-sufficiency-of-scripture.ts`, `believers-baptism.ts`, `mandated-church.ts` |
| Church membership | `/church-covenant/`, `/church-membership/` | `church-covenant.ts`, `church-membership.ts` |
| Ministries | `/ministries/`, `/bible-studies/`, `/sunday-school/`, `/local-outreach/`, `/mens-ministry/`, `/womens-ministry/`, `/teaching-preaching-ministry/`, `/music-ministry/` | The matching eight page files |
| Resources and archived recordings | `/forms/`, `/archived-sermons/` | `forms.ts`, `archived-sermons.ts` |
| Giving and contact | `/support-saving-grace-church-offering/`, `/contact/` | `giving.ts`, `contact.ts` |
| Collection/index pages | `/events/`, `/blogs/`, `/sitemap/` | `events.ts`, `blogs.ts`, `sitemap.ts`; the generated listings are editable, movable modules |
| Draft pages | `/what-we-teach/mandated-church/draft/`, `/what-we-teach/lordship-salvation/`, `/elders/draft/`, `/our-history/draft/` | `mandated-church-draft.ts`, `lordship-salvation.ts`, `elders-draft.ts`, `our-history-draft.ts` |
| Private page | `/constitution/` | `constitution.ts` |

The four drafts and private Constitution begin without a published revision. Protected preview overlays only the selected entity/revision onto the published snapshot. It does not make the other held pages visible. Imported legacy aside blocks begin disabled because the integrated frontend did not display them; an administrator can enable them deliberately.

The three posts preserve their complete original blocks and addresses under `/2024/01/`: `making-a-difference-how-churches-in-australia-influence-melbournes-community/`, `saving-grace-meaning-what-does-it-mean-to-be-saved-by-grace/`, and `understanding-dispensationalism-unveiling-gods-plan-through-the-ages/`.

## Supported modules

There are **29 supported module kinds**. Instances have a stable identity, enabled switch and position within a revision. Their visual components stay in code; editing, duplicating, moving, adding and publishing these supported structures needs no code change.

| Module family | Kinds and editable content |
| --- | --- |
| Homepage compositions | Arrival/visitor information and service cards; welcome, pillars and photograph; recent/curated sermons; about and giving quotation; upcoming events |
| Reading | Paragraph, section heading, ordered/unordered list, quotation, callout, grouped panel |
| Images | Figure with caption/size/alt/focal point; book cover with description; page hero with visibility/alt/focal point |
| People and history | People cards and biographies; timeline entries |
| Links and resources | Linked cards, page-link index, document downloads, hymn links, external-resource plate |
| Recorded media | Validated YouTube video and playlist plates using the existing click-to-load consent behavior |
| Church information | Contact panel, giving methods, next gathering |
| Dynamic collections | Sermon collection, events calendar, blog listing, site map |

Image/document pickers reference the existing asset registry or persisted uploads. The renderer uses selected image metadata, escaped alternative text and CSP-hashed focal-point rules. It does not introduce arbitrary inline styles or remote image retrieval. Existing unsupported/missing PDF and OneDrive assets remain their exact published external destinations until an administrator replaces them with an uploaded document.

Sermon modules store only display configuration and curated UUIDs. Both home and ordinary-page sermon modules resolve those UUIDs through the existing environment's eligible `PublicSermonRepository`. A held/draft UUID that the repository does not return cannot render. They never read acceptance tables directly or enable Related themes. Existing sermon wording, detail layout, consent loaders, taxonomy/search and semantic evaluation gates remain code-owned.

## Global settings

The settings document covers primary navigation, footer navigation, footer utility links, header giving action, church identity/branding, contact name/address/phone/email/map links, service copy and destinations, social labels/real URLs/visibility, copyright, archive explanation, announcement text/visibility, footer column visibility and recent-sermon heading. The original social destinations remain unset rather than being guessed. Navigation placement uses internal pages or validated destination links and supports keyboard ordering. Unavailable pages are not emitted as ordinary navigation links.

The home visitor link and its destination, service cards, images, pillars, about text and giving panel are structured fields rather than opaque serialized homepage HTML. Dates and event occurrences are computed from published event revisions, not embedded into homepage copy.

## Events, feeds and addresses

Ten initial event identities remain unchanged: Sunday Evening Service, Tuesday Bible Study, Men's Theological Study, Woman's Study, Men's Study, Men's Teaching and Preaching Study, Street Evangelism / Outreach, Music Team Meeting, SGBC Members Meeting and SGBC Picnic / Rye. Venue identities are the church, Rye Civic Hall and State Library.

The feed retains the existing `event-id@www.savinggrace.org.au` UID convention and Melbourne wall-clock timezone/recurrence rules. The editor supports one-off dates, weekly and first-weekday monthly recurrence, start/end times, recurrence bounds and excluded dates. The CMS is its own source of truth; no Google Calendar connection is required. Only events selected into the published snapshot enter visitor pages or the calendar feed.

The church handler uses revision-aware canonical page paths and direct CMS redirect/gone dispositions before legacy fallbacks. The HTML site map and new church XML sitemap contain only selected published pages/posts/events. `/sitemap-sermons.xml` remains under the unchanged sermon eligibility repository. Restricted staging keeps its existing non-indexable policy. Hiding a module changes neither page address nor publication state.

## Verification boundaries

`tests/cms-frontend.test.ts` verifies deterministic scope, validated seed payloads, original content/image/order parity, unchanged calendar output, isolated snapshots, immediate rendering after a new published snapshot, global settings on Claude archive pages, image/document attachment and focal-point CSP, disabled sections, protected selected-revision preview, redirect/gone/sitemap behavior and eligibility-bound sermon curation. Existing church, home, navigation, shell and Claude integration tests remain applicable. Backend/database, durable upload, browser workflow, deployment and persistence evidence are recorded by their respective delivery checks; this inventory does not claim they ran merely because adapters exist.

Intentionally code-owned behavior includes component CSS/layout, supported module definitions, provider consent/security wording, accessibility labels, scripture/sermon search, authentication, acceptance and publication safeguards, anti-indexing staging boundaries and semantic recommendation quality policy. Contact-mail delivery, newsletter providers and external calendar synchronization are not simulated by content editing.
