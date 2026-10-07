import { describe, expect, it } from "vitest";
import { sermonDetailSchema, type SermonDetail, type SermonSummary } from "../src/domain/sermon";
import { renderPublicSermonPage } from "../src/frontend/pages/sermon";
import { previewRenderContext, publicRenderContext } from "../src/frontend/routes";

const candidate: SermonSummary = {
  id: "00000000-0000-4000-8000-000000000002", title: "Anonymous candidate", slug: "anonymous-candidate",
  summary: "An entirely fictional description for a local interface test. It is not a real sermon.",
  serviceDate: "2026-01-04", speaker: { name: "Example speaker", slug: "example-speaker" }, series: [],
  scriptureReferences: [], primaryPassages: [], primaryPassageState:'unresolved', books: [], primaryMedia: null
};
const sermon: SermonDetail = {
  ...candidate, id: "00000000-0000-4000-8000-000000000001", title: "Anonymous anchor", slug: "anonymous-anchor",
  seoDescription: null, body: null, media: [], transcript: { bodyText: "Fictional unchanged transcript for layout tests." },
  questionAnswers: [{ question: "What does this fictional fixture test?", answer: "Only a safe interface contract.", displayOrder: 1 }],
  relatedSermons: [{ ...candidate, relationshipReasons: ["same_speaker"] }]
};

describe("distinct description-only Related themes detail section", () => {
  it("remains completely absent when the server has not enabled its separate gate", () => {
    const html = renderPublicSermonPage(sermon);
    expect(html).toContain('id="related-heading"');
    expect(html).not.toContain('id="related-themes"');
    expect(html).not.toContain("Related themes");
  });
  it("renders provisional suggestions separately after metadata recommendations with contextual links", () => {
    const html = renderPublicSermonPage({ ...sermon, relatedThemes: { mode: "evaluation", sermons: [candidate] } }, previewRenderContext);
    expect(html).toContain("Evaluation preview: these provisional connections");
    expect(html.indexOf('id="related-themes"')).toBeGreaterThan(html.indexOf('id="related"'));
    expect(html).toContain('href="/frontend-preview/sermons/anonymous-candidate/"');
    expect(html).toContain('href="#related-themes"');
    const themes = html.slice(html.indexOf('id="related-themes"'), html.indexOf('</section>', html.indexOf('id="related-themes"')));
    expect(themes).not.toContain("Same speaker");
    expect(themes).not.toMatch(/cosine|model|\d+%/i);
    expect(html).toContain(sermon.transcript!.bodyText);
    expect(html).toContain(sermon.questionAnswers[0]!.answer);
  });
  it("renders a useful empty state and does not invent filler recommendations", () => {
    const html = renderPublicSermonPage({ ...sermon, relatedSermons: [], relatedThemes: { mode: "evaluation", sermons: [] } }, previewRenderContext);
    expect(html).toContain("No related themes are available");
    expect(html).not.toContain('href="/frontend-preview/sermons/anonymous-candidate/"');
    expect(html).not.toContain('id="related-heading"');
  });
  it("uses normal public links only for an explicitly released server projection", () => {
    const html = renderPublicSermonPage({ ...sermon, relatedThemes: { mode: "released", sermons: [candidate] } }, publicRenderContext);
    expect(html).not.toContain("Evaluation preview");
    expect(html).toContain('href="/sermons/anonymous-candidate/"');
    expect(html).toContain("separately from the passage, series and speaker links");
    expect(html).not.toContain("rawCosineScore");
  });
  it("restricts the projection to five normal summaries without score fields", () => {
    expect(sermonDetailSchema.parse({ ...sermon, relatedThemes: { mode: "evaluation", sermons: [candidate] } }).relatedThemes?.sermons).toHaveLength(1);
    expect(() => sermonDetailSchema.parse({ ...sermon, relatedThemes: { mode: "evaluation", sermons: [], rawCosineScore: .9 } })).toThrow();
    expect(() => sermonDetailSchema.parse({ ...sermon, relatedThemes: { mode: "evaluation", sermons: Array(6).fill(candidate) } })).toThrow();
  });
});
