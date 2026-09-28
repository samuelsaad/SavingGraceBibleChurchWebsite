import { describe, expect, it } from "vitest";
import type { SermonDetail } from "../src/domain/sermon";
import { emptyFilterOptions } from "../src/frontend";
import { previewRenderContext, publicRenderContext, renderPublicSermonPage } from "../src/server/http/public-sermon-page";

const sermon: SermonDetail = {
  id: "75df2144-b557-50f6-98bd-011cd696bfb9",
  title: "Grace <script>alert(1)</script>",
  slug: "grace-alone",
  serviceDate: "2026-08-02",
  summary: "This safe approved description explains the sermon message before the visitor reaches its media and transcript.",
  seoDescription: null,
  speaker: { name: "Example Speaker", slug: "example-speaker" },
  series: [],
  scriptureReferences: [{ displayText: "Romans 8:1", parseStatus: "exact" }],
  primaryPassages: [{ displayText: "Romans 8:1", isLead: true }],
  primaryPassageState: "assigned",
  books: [],
  primaryMedia: null,
  body: null,
  media: [],
  transcript: { bodyText: "First paragraph.\n\nSecond <strong>plain</strong> paragraph." },
  questionAnswers: [
    { question: "Why <img src=x>?", answer: "Because <script>bad()</script>.", displayOrder: 1 }
  ],
  relatedSermons: [
    {
      id: "c964f4c0-182b-4de3-ac7b-5fb5fa6587ae",
      title: "A related anonymised sermon",
      slug: "a-related-anonymised-sermon",
      serviceDate: "2026-07-26",
      summary: null,
      speaker: { name: "Example Speaker", slug: "example-speaker" },
      series: [],
      scriptureReferences: [],
      primaryPassages: [],
      primaryPassageState: "none",
      books: [],
      primaryMedia: null,
      relationshipReasons: ["same_speaker"]
    }
  ]
};

const youtube = {
  provider: "youtube" as const,
  mediaType: "video" as const,
  externalId: "abcdefghijk",
  canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  title: "An anonymised sermon video"
};

const shelved: SermonDetail = { ...sermon, books: [{ name: "Romans", slug: "romans" }] };
const options = { ...emptyFilterOptions, books: [{ name: "Romans", slug: "romans", sermonCount: 3 }] };

describe("server-rendered public sermon page", () => {
  it("keeps the approved description first, the transcript in an open native disclosure and Q&A open, all safely escaped", () => {
    const html = renderPublicSermonPage(sermon);
    expect(html).toContain('<details class="transcript" open data-open-for-print>');
    expect(html).toContain('<summary class="transcript__summary"><span class="transcript__label--closed">Read the transcript</span><span class="transcript__label--open">Hide the transcript</span>');
    expect(html).toContain('<span class="transcript__stats">5 words · about 1 minute</span>');
    expect(html).not.toMatch(/<summary\b[^>]*aria-expanded/u);
    expect(html.indexOf('id="about-heading"')).toBeLessThan(html.indexOf('id="transcript-heading"'));
    expect(html).toContain("First paragraph");
    expect(html).toContain("Second &lt;strong&gt;plain&lt;/strong&gt;");
    expect(html).toContain("Why &lt;img src=x&gt;?");
    expect(html).toContain("Because &lt;script&gt;bad()&lt;/script&gt;.");
    expect(html).toContain("Grace &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html.match(/<script /gu)).toHaveLength(3);
    expect(html).toContain('<script data-enhancement="sermon">');
    expect(html).toContain('<script data-enhancement="navigation">');
    expect(html).toContain('<script data-enhancement="mobileNavigation">');
    expect(html).not.toContain("application/ld+json");
    expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/grace-alone/"');
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).not.toMatch(/fetch\(|XMLHttpRequest/u);
    expect(html).toContain(`meta name="description" content="${sermon.summary}"`);
    expect(html).toContain("Related sermons");
    expect(html).toContain('<p class="entry__reason">Related by same speaker</p>');
    expect(html).toContain('<p class="sermon__stamp"><span class="sr-only">Preached from </span>Romans 8:1</p>');
    expect(html).toContain("<dt>Preached from</dt><dd>Romans 8:1</dd>");
    expect(html).not.toContain("Related themes");
    expect(html).not.toContain("Other Scripture metadata");
  });

  it("renders every question and answer open in the initial HTML, not inside a disclosure", () => {
    const html = renderPublicSermonPage(sermon);
    expect(html).toContain('<h2 id="questions-heading" class="section__title">Questions for reflection</h2>');
    expect(html).toContain('<ol class="questions" role="list">');
    expect(html.match(/<li class="question">/gu)).toHaveLength(1);
    expect(html).toContain('<span class="sr-only">Question 1: </span>');
    expect(html).not.toMatch(/<details[^>]*>\s*<summary[^>]*>[^<]*Question/u);
  });

  it("keeps the required content order and offers in-page navigation from the rail", () => {
    const html = renderPublicSermonPage({ ...sermon, media: [youtube] });
    const order = ["sermon__head", 'id="about-heading"', 'id="media-heading"', 'id="transcript-heading"', 'id="questions-heading"', 'id="related-heading"'];
    const positions = order.map((marker) => html.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(html).toContain('<nav class="rail__contents" aria-labelledby="contents-heading" data-contents>');
    expect(html).toContain('<li><a href="#questions">Questions</a></li>');
    expect(html).toContain('<section class="sermon-section" id="questions" aria-labelledby="questions-heading">');
    expect(html).toContain('<aside class="sermon__rail" aria-label="Sermon details">');
  });

  it("uses the controlled SEO override for metadata without changing visible description", () => {
    const html = renderPublicSermonPage({ ...sermon, seoDescription: "Controlled SEO override" });
    expect(html).toContain('meta name="description" content="Controlled SEO override"');
    expect(html).toContain(sermon.summary!);
  });

  it("omits independently unavailable enrichment sections without empty headings", () => {
    const html = renderPublicSermonPage({
      ...sermon,
      summary: null,
      seoDescription: null,
      transcript: null,
      questionAnswers: [],
      media: [],
      relatedSermons: []
    });

    expect(html).not.toContain("About this sermon");
    expect(html).not.toContain('id="transcript-heading"');
    expect(html).not.toContain("Questions for reflection");
    expect(html).not.toContain('id="media-heading"');
    expect(html).not.toContain("Related sermons");
    expect(html).not.toContain("Related themes");
    expect(html).not.toContain('class="rail__contents"');
    expect(html).not.toContain('<meta name="description"');
  });

  it("keeps click-to-load YouTube media without an iframe or a website-owned outbound link", () => {
    const html = renderPublicSermonPage({ ...sermon, media: [youtube] });

    expect(html).toContain('<section class="sermon-section sermon-section--media" id="watch" aria-labelledby="media-heading">');
    expect(html).toContain('<div class="plate" data-video-frame>');
    expect(html).toContain('data-load-youtube data-video-id="abcdefghijk" data-video-title="Video: Grace &lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).toContain("youtube-nocookie.com/embed/");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("autoplay");
    expect(html).not.toContain('href="https://www.youtube.com/watch?v=abcdefghijk"');
    expect(html).not.toContain("Open video");
    expect(html).toContain("connects to YouTube (youtube-nocookie.com)");
    expect(html).toContain("<noscript>");
  });

  it("does not repeat a passage already stated in the title", () => {
    const stamp = 'class="sermon__stamp"';
    expect(renderPublicSermonPage(sermon)).toContain(stamp);
    expect(renderPublicSermonPage({ ...sermon, title: "Jesus is Calling You — Romans 8:1" })).not.toContain(stamp);
    expect(renderPublicSermonPage({ ...sermon, title: "Hope — Romans 8:1-4", primaryPassages: [{ displayText: "Romans 8:1–4", isLead: true }] })).not.toContain(stamp);
  });

  it("pulls the classified book from the shelf as a tab, a strip mark and a rail entry", () => {
    const html = renderPublicSermonPage(shelved, publicRenderContext, { options });
    expect(html).toContain('<article class="sermon hue--pauline">');
    expect(html).toContain('<a class="tab hue--pauline" href="/sermons/?passageBook=romans&amp;passageScope=book#canon"><span class="tab__name" aria-hidden="true">Romans</span><span class="tab__count" aria-hidden="true">3</span><span class="sr-only">Romans, 3 sermons</span></a>');
    expect(html).toContain('<svg class="strip strip--marked"');
    expect(html.match(/ strip__seg--current"/gu)).toHaveLength(1);
    expect(html).toContain('<p class="strip__label">Romans on the shelf</p>');
    expect(html).toContain('<li><a href="/sermons/?sermon_book=romans">Romans</a></li>');
    expect(html).toContain('<dt>Shelved under</dt><dd><a href="/sermons/?sermon_book=romans">Romans</a></dd>');

    const unshelved = renderPublicSermonPage(sermon);
    expect(unshelved).toContain('<article class="sermon">');
    expect(unshelved).toContain('<span class="tab tab--ghost" aria-hidden="true">');
    expect(unshelved).not.toContain("Shelved under");
    expect(unshelved).not.toContain('class="strip strip--marked"');
  });

  it("explains a reviewed no-primary outcome only in the authenticated preview", () => {
    const none: SermonDetail = { ...sermon, primaryPassages: [], primaryPassageState: "none" };
    expect(renderPublicSermonPage(none)).not.toContain("No single primary passage");
    expect(renderPublicSermonPage(none)).not.toContain("Topical or multi-passage");
    expect(renderPublicSermonPage(none, previewRenderContext)).toContain("No single primary passage (reviewed outcome)");
  });
});
