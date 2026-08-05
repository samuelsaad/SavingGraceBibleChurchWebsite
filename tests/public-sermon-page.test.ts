import { describe, expect, it } from "vitest";
import type { SermonDetail } from "../src/domain/sermon";
import { renderPublicSermonPage } from "../src/server/http/public-sermon-page";

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
  books: [],
  primaryMedia: null,
  body: null,
  media: [],
  transcript: { bodyText: "First paragraph.\n\nSecond <strong>plain</strong> paragraph." },
  questionAnswers: [
    { question: "Why <img src=x>?", answer: "Because <script>bad()</script>.", displayOrder: 1 }
  ]
};

describe("server-rendered public sermon page", () => {
  it("contains the collapsed transcript and Q&A in initial safe HTML", () => {
    const html = renderPublicSermonPage(sermon);
    expect(html).toContain("<details class=\"transcript-disclosure\">");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Read full transcript");
    expect(html).toContain('<section class="sermon-description"');
    expect(html.indexOf("sermon-description")).toBeLessThan(html.indexOf("transcript-heading"));
    expect(html).not.toContain('class="sermon-description" hidden');
    expect(html).toContain("First paragraph");
    expect(html).toContain("Second &lt;strong&gt;plain&lt;/strong&gt;");
    expect(html).toContain("Why &lt;img src=x&gt;?");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("application/ld+json");
    expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/grace-alone/"');
    expect(html).not.toMatch(/fetch\(|XMLHttpRequest/);
    expect(html).toContain(`meta name="description" content="${sermon.summary}"`);
  });

  it("uses the controlled SEO override for metadata without changing visible description", () => {
    const html = renderPublicSermonPage({ ...sermon, seoDescription: "Controlled SEO override" });
    expect(html).toContain('meta name="description" content="Controlled SEO override"');
    expect(html).toContain(sermon.summary!);
  });
});
