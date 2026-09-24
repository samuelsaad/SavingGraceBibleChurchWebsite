/**
 * Every church page and blog post, in one registry. Pages carry their own
 * publication status from the WordPress export; only "published" pages are
 * served publicly, drafts and private pages render in the authenticated
 * preview alone.
 */
import type { BlogPost, SitePage } from "../types";
import { aboutPage } from "./about";
import { lordsDayServicePage } from "./lords-day-service";
import { eveningServicePage } from "./evening-service";
import { doctrinalStatementPage } from "./doctrinal-statement";
import { whatWeTeachPage } from "./what-we-teach";
import { theGospelPage } from "./the-gospel";
import { sufficiencyOfScripturePage } from "./the-sufficiency-of-scripture";
import { believersBaptismPage } from "./believers-baptism";
import { mandatedChurchPage } from "./mandated-church";
import { mandatedChurchDraftPage } from "./mandated-church-draft";
import { lordshipSalvationPage } from "./lordship-salvation";
import { eldersPage } from "./elders";
import { eldersDraftPage } from "./elders-draft";
import { ourHistoryPage } from "./our-history";
import { ourHistoryDraftPage } from "./our-history-draft";
import { churchCovenantPage } from "./church-covenant";
import { churchMembershipPage } from "./church-membership";
import { ministriesPage } from "./ministries";
import { bibleStudiesPage } from "./bible-studies";
import { sundaySchoolPage } from "./sunday-school";
import { localOutreachPage } from "./local-outreach";
import { mensMinistryPage } from "./mens-ministry";
import { womensMinistryPage } from "./womens-ministry";
import { teachingPreachingPage } from "./teaching-preaching-ministry";
import { musicMinistryPage } from "./music-ministry";
import { formsPage } from "./forms";
import { givingPage } from "./giving";
import { contactPage } from "./contact";
import { archivedSermonsPage } from "./archived-sermons";
import { constitutionPage } from "./constitution";
import { eventsPage } from "./events";
import { blogsPage } from "./blogs";
import { sitemapPage } from "./sitemap";
import { makingADifferencePost } from "./post-making-a-difference";
import { savingGraceMeaningPost } from "./post-saving-grace-meaning";
import { understandingDispensationalismPost } from "./post-understanding-dispensationalism";

export const churchPages: readonly SitePage[] = Object.freeze([
  aboutPage,
  lordsDayServicePage,
  eveningServicePage,
  doctrinalStatementPage,
  whatWeTeachPage,
  theGospelPage,
  sufficiencyOfScripturePage,
  believersBaptismPage,
  mandatedChurchPage,
  mandatedChurchDraftPage,
  lordshipSalvationPage,
  eldersPage,
  eldersDraftPage,
  ourHistoryPage,
  ourHistoryDraftPage,
  churchCovenantPage,
  churchMembershipPage,
  ministriesPage,
  bibleStudiesPage,
  sundaySchoolPage,
  localOutreachPage,
  mensMinistryPage,
  womensMinistryPage,
  teachingPreachingPage,
  musicMinistryPage,
  formsPage,
  givingPage,
  contactPage,
  archivedSermonsPage,
  constitutionPage,
  eventsPage,
  blogsPage,
  sitemapPage
]);

export const blogPosts: readonly BlogPost[] = Object.freeze([
  makingADifferencePost,
  savingGraceMeaningPost,
  understandingDispensationalismPost
]);
