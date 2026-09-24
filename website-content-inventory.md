# Website Content Inventory and Reconciliation

**Source:** the WordPress WXR export `savinggracebiblechurch-bible-basedworshipinmelbourne.WordPress.2026-09-24.xml` (WordPress 6.4.12, generated 24 September 2026, 1,357 items) and the 308-image media archive supplied with the whole-site redesign brief. The export and the archive stay outside the repository; this document records what they contained, where every content-bearing item now lives, and what was deliberately not carried over. Nothing here duplicates sermon bodies, credentials, administrator data or private material.

**Implementation:** branch `frontend-church-site` (continuation of `frontend-sermons-v4`), decision D-165. Every page's text lives in `src/frontend/content/pages/*.ts` as data blocks whose wording is transcribed verbatim from the export; the media registry is `src/frontend/assets/media.ts` with the archive mapping in `src/frontend/assets/media/README.md`; events are `src/frontend/content/events.ts`; navigation is `src/frontend/content/navigation.ts`; legacy addresses resolve through `src/frontend/content/registry.ts`. `tests/church-site.test.ts` asserts the reconciliation facts recorded below.

## What the export contained

| Type | Count | Handling |
| --- | --- | --- |
| `page` | 110 (30 published, 79 draft, 1 private) | 29 published pages rebuilt; 1 published page (`I am new here`, WordPress 37) held only theme placeholder text and redirects to the Lord's Day Service page; 4 church-authored drafts kept as drafts (authenticated preview only); the private Constitution kept private (preview only); 74 drafts were theme demonstration pages (Home Layouts, Portfolio, Store, Elements, Typography, Widgets, Coming Soon, lorem-ipsum "Our Mission"/"Statement of Faith"/"Services"/"Connect"/"Giving"/"Welcome", WooCommerce, GiveWP, Donations) and were not rebuilt. |
| `sermons` | 462 (454 published) | Not imported: the existing sermon system stays the sermon source (`/sermons/`, D-163 snapshot). |
| `attachment` | 437 records | Reconciled against the 308-file archive; 45 images selected, optimised and embedded (see Images). |
| `nav_menu_item` | 301 across 15 menus | The live "Saving Grace Main Menu" and "Footer Menu" drive the masthead and footer; the other 13 menus were theme demonstration menus (Vamtam "One Page", "Parallax", "Theme features", "Pages", "Main Menu" with demo links, language stubs) and were not carried over. |
| `tribe_events` | 15 (14 published, 1 draft) | 10 distinct gatherings/events rebuilt with their recurrence rules; duplicate records of the same gathering merged; the draft (30088) was an empty duplicate of the published outreach event. |
| `tribe_event_series` | 5 | Folded into the corresponding events; their addresses redirect. |
| `tribe_venue` / `tribe_organizer` | 3 / 1 | Venue details carried into event pages; their addresses redirect. |
| `post` | 3 published | Rebuilt at their original `/2024/01/…/` addresses with a blog index at `/blogs/`. |
| `testimonials` | 3 | Theme sample quotations attributed to Robert H. Schuller, Thomas Paine and Rodney Stratton with lorem-ipsum bodies (dated 2013, before the church existed): retired with `410 Gone`. |
| `wpcf7_contact_form` | 3 | Contact Form 7 definitions (one used on Contact Us, one on the placeholder page, one theme sample). No mail service exists in this application, so no form is rendered; see Integrations. |
| `bold-timeline` | 1 published ("Church History") | Rendered on Our History as the timeline. |
| `custom_css`, `wp_global_styles`, `elementor_library`, `acf-field-group`, `acf-field` | 3, 1, 1, 1, 7 | Theme/plugin configuration; not content. The ACF sermon fields belong to the sermon migration, not this redesign. |

## Design direction

The church pages continue "the Canon" system of the sermon frontend: plaster ground, ink, one gilt accent, condensed signage for labels, a display serif for titles and a reading serif for prose. Each content page opens with a breadcrumb trail, a section eyebrow, the page's own heading and lede, and either a full-width photograph band or a photograph beside the head. The body is a reading column of the church's paragraphs, Scripture quotations on a gilt rule, tile grids for hubs and cross-links, person cards for the elders, a timeline for the history, download cards, hymn cards, the doctrinal index, the giving panel, the contact panel, and click-to-load plates for YouTube videos and playlists (no third-party frame loads until the visitor asks). Every page ends with "Also in this section" links. The homepage keeps its welcome-card composition and now carries the entrance photograph, a congregation photograph, real links on every label and events computed for the day it is rendered. The masthead follows the church's main menu with About Us and Ministries disclosures beside the Sermons menu; the footer follows the church's footer menu and links the telephone, e-mail and map.

## Integrations and gaps

- **Contact form.** The WordPress Contact Us page submitted a Contact Form 7 form by e-mail through WordPress. This application has no mail transport, so no form is rendered and no submission is simulated. The page offers the real destinations the church published: `mailto:info@savinggrace.org.au`, `tel:+61450545589` and the church's Google Maps listing. The sentence "Please feel free to submit your inquiries using the form provided above." is therefore not shown. Completing the form needs a mail service and a server endpoint; neither is authorised here.
- **Newsletter.** Several pages end with "subscribe to our newsletter and follow us on social media". The export contains no newsletter service (only an unused MailPoet form in a demo draft) and no social account address, so the sentences stay as the church wrote them and the four "Follow us" marks remain non-interactive pending labels.
- **PDF downloads.** The Doctrinal Statement, Church Covenant and Constitution PDFs were not in the supplied archive (images only), so their links keep the church's existing WordPress upload addresses on `savinggrace.org.au`; the membership application and service policies open on OneDrive as before. These four links are the only remaining references to the WordPress site.
- **SermonAudio.** The Archived Sermons page embedded a SermonAudio browser and two drafts embedded SermonAudio players. They render as labelled external plates that open the same SermonAudio addresses; no frame loads.
- **YouTube.** The Gospel and Believer's Baptism videos and the eight Bible Studies playlists are click-to-load plates on `youtube-nocookie.com` with a visible "Open on YouTube" link; the sermon page's loader was shared for this.
- **Events Calendar.** "Subscribe to our calendar" now links to the site's own iCalendar feed at `/events/calendar.ics`, generated from the same schedules with the export's recurrence rules and exclusions.
- **Photographs not supplied.** The draft Elders page used portraits of Davia Prasad and Ray Keane and the draft history page a 2020 photograph; none was in the archive, so those drafts render without them.
- **Social accounts.** No Facebook, YouTube, Instagram or podcast account address exists anywhere in the export.

## Wording the church may wish to review

Transcription is verbatim, so these remain as authored: "Beleiver's" in the Believer's Baptism video heading; "it's" for "its" on the About Us and Sufficiency pages; the Church History timeline's supertitles disagree with its own text and with the Our History paragraphs (the 1977 item describes 1970, the 1995 item describes 1977 and 1990, and Epping is dated 2021 on the timeline but 2019 in the prose); the Ministries page's editing placeholder heading "Test Ministry" was not carried (its paragraphs were, as the tile descriptions); "Click [here] to make your donation" on the giving page had no destination and now opens the page's own Stripe link; the Street Evangelism event's description is a copy of the Sunday Evening Service description in the export.

## Pages

| WordPress | Title | Status | Original URL | Destination | Images | Blocks | Legacy addresses redirected |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 26490 | About Us | published | /about/ | `/about/` | elders, tulips | paragraph×8, figure, heading×2, list, tiles, quote | `/pages/about/` |
| 26330 | Lord’s Day Service | published | /pages/lordsdayservice/ | `/lords-day-service/` | lords-day, wesam | paragraph×5, heading×5, list×3, people, sermon-cards, tiles, quote | `/pages/lordsdayservice/`, `/pages/im-new-here/` |
| 26344 | Evening Service | published | /evening-service/ | `/evening-service/` | sunset, fellowship | next-event, paragraph×9, quote, heading×6, figure, callout | — |
| 26193 | Doctrinal Statement | published | /doctrinal-statement/ | `/doctrinal-statement/` | pen | paragraph×92, quote, downloads, heading×9, index, list | `/pages/doctrinal-statement/` |
| 26195 | What We Teach | published | /what-we-teach/ | `/what-we-teach/` | books, open-bible, baptism-water, bible-rose, congregation | tiles | `/pages/what-we-teach/` |
| 26191 | The Gospel | published | /what-we-teach/the-gospel/ | `/what-we-teach/the-gospel/` | cross-sunset, bible-rose | figure, paragraph×8, quote, heading, video | `/pages/the-gospel/`, `/pages/what-we-teach/the-gospel/`, `/the-gospel/` |
| 27815 | The Sufficiency of Scripture | published | /what-we-teach/the-sufficiency-of-scripture/ | `/what-we-teach/the-sufficiency-of-scripture/` | open-bible | figure, paragraph×16, heading×7 | `/pages/the-sufficiency-of-scripture/`, `/pages/what-we-teach/the-sufficiency-of-scripture/` |
| 27844 | Believer’s Baptism | published | /what-we-teach/believers-baptism/ | `/what-we-teach/believers-baptism/` | baptism-water | figure, paragraph×24, heading, video | `/pages/believers-baptism/`, `/pages/what-we-teach/believers-baptism/` |
| 27854 | Mandated Church | published | /what-we-teach/mandated-church/ | `/what-we-teach/mandated-church/` | congregation, bible-rose | figure, paragraph×17, heading×7 | `/pages/mandated-church/`, `/pages/what-we-teach/mandated-church/` |
| 29971 | Mandated Church - Draft | draft | /?page_id=29971 | `/what-we-teach/mandated-church/draft/` | bible-rose | figure, paragraph×17, heading×8, external-plate×6 | — |
| 27836 | Lordship Salvation | draft | /?page_id=27836 | `/what-we-teach/lordship-salvation/` | lit-cross | figure, paragraph×17, heading×2, external-plate×2 | `/pages/lordship-salvation/` |
| 34 | Elders | published | /elders/ | `/elders/` | elders, wesam, ralph | paragraph, people | — |
| 29431 | Elders - inc Prasad and Ray | draft | /?page_id=29431 | `/elders/draft/` | wesam, ralph | paragraph, people | — |
| 27427 | Our History | published | /our-history/ | `/our-history/` | early-church, merge | heading×4, paragraph×3, quote, timeline, figure | — |
| 29436 | Our History inc ECC | draft | /?page_id=29436 | `/our-history/draft/` | merge | timeline, paragraph×8, heading×6, figure, quote | — |
| 27475 | Church Covenant | published | /pages/church-covenant/ | `/church-covenant/` | hands, membership-roll | heading×2, panel, paragraph×13, downloads, tiles, callout | `/pages/church-covenant/` |
| 26391 | Church Membership | published | /church-membership/ | `/church-membership/` | membership-roll | heading×3, paragraph×5, list, callout | `/pages/church-membership/` |
| 7043 | Ministries | published | /ministries/ | `/ministries/` | bible-shelf, open-bible, mens-bible-study, womens-prayer, good-news, child-reading, music-sheet, teaching | quote, tiles, heading, paragraph | — |
| 26358 | Bible Studies | published | /pages/biblestudies/ | `/bible-studies/` | end-times | next-event, paragraph×11, heading×5, list×2, playlist×8, quote, callout | `/pages/biblestudies/` |
| 26375 | Sunday School | published | /pages/sunday-school/ | `/sunday-school/` | child-reading | quote, paragraph×3, heading×4, list, callout | `/pages/sunday-school/` |
| 26384 | Local Outreach | published | /pages/local-outreach/ | `/local-outreach/` | good-news | heading×4, paragraph×5, quote×2, list×2, callout | `/pages/local-outreach/` |
| 27942 | Men’s Ministry | published | /mens-ministry/ | `/mens-ministry/` | mens-ministry, fight-like-a-man | heading×5, paragraph×7, quote, next-event×2, book, callout | `/pages/mens-ministry/` |
| 28000 | Women’s Ministry | published | /womens-ministry/ | `/womens-ministry/` | womens-ministry, blessing-of-humility | heading×4, paragraph×4, quote, next-event, book, callout | `/pages/womens-ministry/` |
| 29584 | Teaching & Preaching Ministry | published | /teaching-preaching-ministry/ | `/teaching-preaching-ministry/` | teaching, preaching-and-preachers | heading×5, paragraph×5, list×3, quote, next-event, book, callout | `/pages/teaching-preaching-ministry/` |
| 28136 | Music Ministry | published | /music-ministry/ | `/music-ministry/` | worship-team, ralph-music | heading×6, paragraph×5, quote, downloads, people, hymns, callout | `/pages/music-ministry/` |
| 29840 | Resources \| Downloads | published | /forms/ | `/forms/` | pen | heading, downloads | — |
| 2285 | Support Our Mission through Your Offering | published | /support-saving-grace-church-offering/ | `/support-saving-grace-church-offering/` | grace | giving-methods, heading×3, paragraph×3, quote, list×2, callout | `/pages/support-saving-grace-church-offering/`, `/give/` |
| 3002 | Contact Us | published | /contact-us-2/ | `/contact/` | welcome-door | contact-panel, paragraph | `/contact-us-2/`, `/pages/contact-us/`, `/venue/saving-grace-bible-church/`, `/organiser/saving-grace-bible-church/` |
| 28656 | Archived Sermons | published | /archived-sermons/ | `/archived-sermons/` | old-book | external-plate, callout | — |
| 2340 | Constitution | private | /constitution-3/ | `/constitution/` | — | paragraph×2, list | `/constitution-3/` |
| 28031 | News & Events | published | /church-events/ | `/events/` | — | paragraph, events-calendar | `/church-events/`, `/events/upcoming/`, `/events/month/`, `/events/today/`, `/events/list/` |
| 274 | Saving Grace Blogs | published | /blogs/ | `/blogs/` | — | template | — |
| 3003 | Sitemap | published | /pages/sitemap/ | `/sitemap/` | — | template | `/pages/sitemap/` |

## Posts

| WordPress | Title | Date | Destination (unchanged) | Image |
| --- | --- | --- | --- | --- |
| 29160 | Making a Difference: How Churches in Australia Influence Melbourne’s Community | 2024-01-05 | `/2024/01/making-a-difference-how-churches-in-australia-influence-melbournes-community/` | fellowship |
| 29285 | Saving Grace Meaning - What does it mean to be saved by Grace | 2024-01-08 | `/2024/01/saving-grace-meaning-what-does-it-mean-to-be-saved-by-grace/` | grace |
| 29343 | Understanding Dispensationalism: Unveiling God’s Plan Through the Ages | 2024-01-09 | `/2024/01/understanding-dispensationalism-unveiling-gods-plan-through-the-ages/` | books |

## Events

| Event | Source records | Schedule (current) | Venue | Destination | Legacy addresses |
| --- | --- | --- | --- | --- | --- |
| Sunday Evening Service | 27911, 30083, 27914 | Every Sunday, 5:30 pm – 7:00 pm (excluding 2026-05-31) | Saving Grace Bible Church | `/events/sunday-evening-service/` | `/event/sunday-evening-service/`, `/event/sunday-evening-service-2/`, `/series/sunday-evening-service/` |
| Tuesday Bible Study | 30031, 30102, 27923 | Every Tuesday, 7:00 pm – 8:30 pm (excluding 2026-06-30, 2026-07-07) | Saving Grace Bible Church | `/events/tuesday-bible-study/` | `/event/tuesday-bible-study-2-2/`, `/event/tuesday-bible-study-2-2-2/`, `/series/tuesday-bible-study/` |
| Men’s Theological Study | 29966, 27984 | Every Sunday, 4:30 pm – 5:30 pm | Saving Grace Bible Church | `/events/mens-theological-study/` | `/event/mens-theological-study-2/`, `/series/mens-theological-study/` |
| Woman's Study | 30027, 28009 | First Saturday of the month, 3:30 pm – 5:00 pm | Saving Grace Bible Church | `/events/womans-study/` | `/event/womans-study-2-2-2/`, `/series/womans-study/` |
| Men’s Study | 30029, 27990 | First Saturday of the month, 3:30 pm – 5:00 pm | Saving Grace Bible Church | `/events/mens-study/` | `/event/mens-leadership-study-2-2/`, `/series/mens-leadership-study/` |
| Men’s Teaching and Preaching Study | 29593, 29964, 30104 | Every Tuesday, 6:00 pm – 7:00 pm (excluding 2026-06-30, 2026-07-07) | Saving Grace Bible Church | `/events/mens-teaching-and-preaching-study/` | `/event/mens-teaching-and-preaching-study/`, `/event/mens-teaching-and-preaching-study-2/`, `/event/mens-teaching-and-preaching-study-2-2/` |
| Street Evangelism \| Outreach | 30090 | Sunday 31 May 2026, 2:00 pm – 5:00 pm | State Library | `/events/street-evangelism-outreach/` | `/event/street-evangelism-outreach/` |
| Music Team Meeting | 29099 | Sunday 25 February 2024, 12:30 pm – 1:30 pm | Saving Grace Bible Church | `/events/music-team-meeting/` | `/event/music-team-meeting/` |
| SGBC Members Meeting | 29101 | Sunday 10 March 2024, 4:30 pm – 5:30 pm | Saving Grace Bible Church | `/events/sgbc-members-meeting/` | `/event/sgbc-members-meeting/` |
| SGBC Picnic - Rye | 29103 | Saturday 23 March 2024, 8:00 am – 5:00 pm | Rye Civic Hall | `/events/sgbc-picnic-rye/` | `/event/sgbc-picnic-rye/` |

## Legacy dispositions

| Legacy path | Disposition | Reason |
| --- | --- | --- |
| `/pages/about/` | 301 → `/about/` | Legacy address of About Us. |
| `/pages/lordsdayservice/` | 301 → `/lords-day-service/` | Legacy address of Lord’s Day Service. |
| `/pages/im-new-here/` | 301 → `/lords-day-service/` | Legacy address of Lord’s Day Service. |
| `/pages/doctrinal-statement/` | 301 → `/doctrinal-statement/` | Legacy address of Doctrinal Statement. |
| `/pages/what-we-teach/` | 301 → `/what-we-teach/` | Legacy address of What We Teach. |
| `/pages/the-gospel/` | 301 → `/what-we-teach/the-gospel/` | Legacy address of The Gospel. |
| `/pages/what-we-teach/the-gospel/` | 301 → `/what-we-teach/the-gospel/` | Legacy address of The Gospel. |
| `/the-gospel/` | 301 → `/what-we-teach/the-gospel/` | Legacy address of The Gospel. |
| `/pages/the-sufficiency-of-scripture/` | 301 → `/what-we-teach/the-sufficiency-of-scripture/` | Legacy address of The Sufficiency of Scripture. |
| `/pages/what-we-teach/the-sufficiency-of-scripture/` | 301 → `/what-we-teach/the-sufficiency-of-scripture/` | Legacy address of The Sufficiency of Scripture. |
| `/pages/believers-baptism/` | 301 → `/what-we-teach/believers-baptism/` | Legacy address of Believer’s Baptism. |
| `/pages/what-we-teach/believers-baptism/` | 301 → `/what-we-teach/believers-baptism/` | Legacy address of Believer’s Baptism. |
| `/pages/mandated-church/` | 301 → `/what-we-teach/mandated-church/` | Legacy address of Mandated Church. |
| `/pages/what-we-teach/mandated-church/` | 301 → `/what-we-teach/mandated-church/` | Legacy address of Mandated Church. |
| `/pages/lordship-salvation/` | 301 → `/what-we-teach/lordship-salvation/` | Legacy address of Lordship Salvation. |
| `/pages/church-covenant/` | 301 → `/church-covenant/` | Legacy address of Church Covenant. |
| `/pages/church-membership/` | 301 → `/church-membership/` | Legacy address of Church Membership. |
| `/pages/biblestudies/` | 301 → `/bible-studies/` | Legacy address of Bible Studies. |
| `/pages/sunday-school/` | 301 → `/sunday-school/` | Legacy address of Sunday School. |
| `/pages/local-outreach/` | 301 → `/local-outreach/` | Legacy address of Local Outreach. |
| `/pages/mens-ministry/` | 301 → `/mens-ministry/` | Legacy address of Men’s Ministry. |
| `/pages/womens-ministry/` | 301 → `/womens-ministry/` | Legacy address of Women’s Ministry. |
| `/pages/teaching-preaching-ministry/` | 301 → `/teaching-preaching-ministry/` | Legacy address of Teaching & Preaching Ministry. |
| `/pages/music-ministry/` | 301 → `/music-ministry/` | Legacy address of Music Ministry. |
| `/pages/support-saving-grace-church-offering/` | 301 → `/support-saving-grace-church-offering/` | Legacy address of Support Our Mission through Your Offering. |
| `/give/` | 301 → `/support-saving-grace-church-offering/` | Legacy address of Support Our Mission through Your Offering. |
| `/contact-us-2/` | 301 → `/contact/` | Legacy address of Contact Us. |
| `/pages/contact-us/` | 301 → `/contact/` | Legacy address of Contact Us. |
| `/venue/saving-grace-bible-church/` | 301 → `/contact/` | Legacy address of Contact Us. |
| `/organiser/saving-grace-bible-church/` | 301 → `/contact/` | Legacy address of Contact Us. |
| `/constitution-3/` | 301 → `/constitution/` | Legacy address of Constitution. |
| `/church-events/` | 301 → `/events/` | Legacy address of News & Events. |
| `/events/upcoming/` | 301 → `/events/` | Legacy address of News & Events. |
| `/events/month/` | 301 → `/events/` | Legacy address of News & Events. |
| `/events/today/` | 301 → `/events/` | Legacy address of News & Events. |
| `/events/list/` | 301 → `/events/` | Legacy address of News & Events. |
| `/pages/sitemap/` | 301 → `/sitemap/` | Legacy address of Sitemap. |
| `/event/sunday-evening-service/` | 301 → `/events/sunday-evening-service/` | Legacy Events Calendar address of Sunday Evening Service. |
| `/event/sunday-evening-service-2/` | 301 → `/events/sunday-evening-service/` | Legacy Events Calendar address of Sunday Evening Service. |
| `/series/sunday-evening-service/` | 301 → `/events/sunday-evening-service/` | Legacy Events Calendar address of Sunday Evening Service. |
| `/event/tuesday-bible-study-2-2/` | 301 → `/events/tuesday-bible-study/` | Legacy Events Calendar address of Tuesday Bible Study. |
| `/event/tuesday-bible-study-2-2-2/` | 301 → `/events/tuesday-bible-study/` | Legacy Events Calendar address of Tuesday Bible Study. |
| `/series/tuesday-bible-study/` | 301 → `/events/tuesday-bible-study/` | Legacy Events Calendar address of Tuesday Bible Study. |
| `/event/mens-theological-study-2/` | 301 → `/events/mens-theological-study/` | Legacy Events Calendar address of Men’s Theological Study. |
| `/series/mens-theological-study/` | 301 → `/events/mens-theological-study/` | Legacy Events Calendar address of Men’s Theological Study. |
| `/event/womans-study-2-2-2/` | 301 → `/events/womans-study/` | Legacy Events Calendar address of Woman's Study. |
| `/series/womans-study/` | 301 → `/events/womans-study/` | Legacy Events Calendar address of Woman's Study. |
| `/event/mens-leadership-study-2-2/` | 301 → `/events/mens-study/` | Legacy Events Calendar address of Men’s Study. |
| `/series/mens-leadership-study/` | 301 → `/events/mens-study/` | Legacy Events Calendar address of Men’s Study. |
| `/event/mens-teaching-and-preaching-study/` | 301 → `/events/mens-teaching-and-preaching-study/` | Legacy Events Calendar address of Men’s Teaching and Preaching Study. |
| `/event/mens-teaching-and-preaching-study-2/` | 301 → `/events/mens-teaching-and-preaching-study/` | Legacy Events Calendar address of Men’s Teaching and Preaching Study. |
| `/event/mens-teaching-and-preaching-study-2-2/` | 301 → `/events/mens-teaching-and-preaching-study/` | Legacy Events Calendar address of Men’s Teaching and Preaching Study. |
| `/event/street-evangelism-outreach/` | 301 → `/events/street-evangelism-outreach/` | Legacy Events Calendar address of Street Evangelism | Outreach. |
| `/event/music-team-meeting/` | 301 → `/events/music-team-meeting/` | Legacy Events Calendar address of Music Team Meeting. |
| `/event/sgbc-members-meeting/` | 301 → `/events/sgbc-members-meeting/` | Legacy Events Calendar address of SGBC Members Meeting. |
| `/event/sgbc-picnic-rye/` | 301 → `/events/sgbc-picnic-rye/` | Legacy Events Calendar address of SGBC Picnic - Rye. |
| `/testimonials/robert-h-schuller/` | 410 Gone | Theme sample testimonial (WordPress 4586); no church content. |
| `/testimonials/thomas-paine/` | 410 Gone | Theme sample testimonial (WordPress 4587); no church content. |
| `/testimonials/rodney-stratton/` | 410 Gone | Theme sample testimonial (WordPress 25241); no church content. |
| `/venue/rye-civic-hall/` | 301 → `/events/sgbc-picnic-rye/` | Events Calendar venue page for the picnic's venue. |
| `/venue/state-library/` | 301 → `/events/street-evangelism-outreach/` | Events Calendar venue page for the outreach event's venue. |


## Images

Forty-five images were selected from the 308-file archive after reviewing every file on contact sheets: the church's own photographs (entrance, congregation, fellowship, the merged congregation, the 2017 hall, the elders, the worship team, the welcoming door), the graphics the church made for its gatherings (End Times study, Tuesday Bible study invitation), the book covers of the current studies, the stock photographs WordPress used on the corresponding pages, the white logo for the footer, and the church's favicon. Each is served at `/media/{file}` (icons under `/brand/`) from bytes embedded in `src/frontend/assets/media-bytes.ts`, with the readable copies and the archive mapping in `src/frontend/assets/media/`. Not used: theme demonstration artwork, duplicate crops and copies, screenshots of WordPress screens, sermon title cards with burned-in text, event flyers for past dates, an AI-generated family-day graphic, and stock photographs that did not serve a page.

## Publication states

Only pages whose WordPress status was `publish` are served on the public site, in the static build and in the sealed visitor runtime. The four church-authored drafts (Lordship Salvation, Our History inc ECC, Elders inc Prasad and Ray, Mandated Church - Draft) and the private Constitution render only in the authenticated administrator preview, each with a visible "not published" status band, `noindex`, no canonical and no sitemap entry. Their legacy addresses answer `404` publicly and redirect inside the preview. Tiles that point at an unpublished page (the Lord's Day Service page's "Lordship Salvation") render as inert labels publicly and as links in the preview.
