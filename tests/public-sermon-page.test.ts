import { describe, expect, it } from "vitest";
import type { SermonDetail } from "../src/domain/sermon";
import { previewRenderContext, renderPublicSermonPage } from "../src/server/http/public-sermon-page";

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

describe("server-rendered public sermon page", () => {
  it("keeps the approved description first, the transcript collapsed and Q&A open, all safely escaped", () => {
    const html = renderPublicSermonPage(sermon);
    expect(html).toContain('<details class="transcript" data-open-for-print>');
    expect(html).not.toContain("<details open");
    expect(html).toContain("Read the full transcript");
    expect(html.indexOf('id="description-heading"')).toBeLessThan(html.indexOf('id="transcript-heading"'));
    expect(html).toContain("First paragraph");
    expect(html).toContain("Second &lt;strong&gt;plain&lt;/strong&gt;");
    expect(html).toContain("Why &lt;img src=x&gt;?");
    expect(html).toContain("Because &lt;script&gt;bad()&lt;/script&gt;.");
    expect(html).toContain("Grace &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html.match(/<script /gu)).toHaveLength(1);
    expect(html).not.toContain('data-enhancement="navigation"');
    expect(html).not.toContain("application/ld+json");
    expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/grace-alone/"');
    expect(html).not.toMatch(/fetch\(|XMLHttpRequest/u);
    expect(html).toContain(`meta name="description" content="${sermon.summary}"`);
    expect(html).toContain("Related sermons");
    expect(html).toContain("Related by same speaker");
    expect(html).toContain("Preached from </span>Romans 8:1");
    expect(html).not.toContain("Related themes");
    expect(html).not.toContain("Other Scripture metadata");
  });

  it("renders every question and answer open in the initial HTML, not inside a disclosure", () => {
    const html = renderPublicSermonPage(sermon);
    expect(html).toContain('<ol class="qa-list" role="list">');
    expect(html.match(/class="qa-item"/gu)).toHaveLength(1);
    expect(html).toContain('<span class="sr-only">Question 1: </span>');
    expect(html).not.toMatch(/<details[^>]*>\s*<summary[^>]*>[^<]*Question/u);
  });

  it("keeps the required content order and offers in-page navigation", () => {
    const html = renderPublicSermonPage({ ...sermon, media: [youtube] });
    const order = ["sermon__head", 'id="description-heading"', 'id="media-heading"', 'id="transcript-heading"', 'id="questions-heading"', 'id="related-heading"'];
    const positions = order.map((marker) => html.indexOf(marker));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(html).toContain('aria-label="On this page"');
    expect(html).toContain('href="#questions-heading"');
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
    expect(html).not.toContain('aria-label="On this page"');
  });

  it("keeps click-to-load YouTube media without an iframe or a website-owned outbound link", () => {
    const html = renderPublicSermonPage({ ...sermon, media: [youtube] });

    expect(html).toContain("data-load-youtube");
    expect(html).toContain('data-video-id="abcdefghijk"');
    expect(html).toContain("youtube-nocookie.com/embed/");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("autoplay");
    expect(html).not.toContain('href="https://www.youtube.com/watch?v=abcdefghijk"');
    expect(html).not.toContain("Open video");
    expect(html).toContain("connects to YouTube (youtube-nocookie.com)");
    expect(html).toContain("<noscript>");
  });

  it("does not repeat a passage already stated in the title", () => {
    const kicker = 'class="sermon__kicker"';
    expect(renderPublicSermonPage(sermon)).toContain(kicker);
    expect(renderPublicSermonPage({ ...sermon, title: "Jesus is Calling You — Romans 8:1" })).not.toContain(kicker);
    expect(renderPublicSermonPage({ ...sermon, title: "Hope — Romans 8:1-4", primaryPassages: [{ displayText: "Romans 8:1–4", isLead: true }] })).not.toContain(kicker);
  });

  it("explains a reviewed no-primary outcome only in the authenticated preview", () => {
    const none: SermonDetail = { ...sermon, primaryPassages: [], primaryPassageState: "none" };
    expect(renderPublicSermonPage(none)).not.toContain("No single primary passage");
    expect(renderPublicSermonPage(none)).not.toContain("Topical or multi-passage");
    expect(renderPublicSermonPage(none, previewRenderContext)).toContain("No single primary passage (reviewed outcome)");
  });
});
