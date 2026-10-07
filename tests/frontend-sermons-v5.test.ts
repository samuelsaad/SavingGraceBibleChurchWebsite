import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import type { SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions, renderSermonsV5Page } from "../src/frontend";
import { recordingDuration, verifiedSpeakerPortrait } from "../src/frontend/components/sermon-journal";
import { finder } from "../src/frontend/components/search";
import { previewRenderContext, publicRenderContext, sermonsV5Target } from "../src/frontend/routes";

const sermon: SermonSummary = {
  id: "00000000-0000-4000-8000-000000000051", slug: "anonymous-v5", title: "An anonymous presentation example",
  serviceDate: "2026-01-04", summary: "A synthetic description used to test layout and escaping. This is not extracted from an actual church sermon.",
  speaker: { name: "Example Speaker", slug: "example-speaker" }, series: [{ name: "Example series", slug: "example-series" }],
  scriptureReferences: [], primaryPassages: [{ displayText: "Romans 5:1", isLead: true }],
  primaryPassageState: "assigned", books: [{ name: "Romans", slug: "romans" }], primaryMedia: null
};
const input = {
  sermons: [sermon], totalItems: 20, query: publicSermonListQuerySchema.parse({page: 1, pageSize: 9}),
  options: {...emptyFilterOptions, books: [{name: "Romans", slug: "romans", sermonCount: 20}],
    speakers: [{name: "Example Speaker", slug: "example-speaker", sermonCount: 20}],
    series: [{name: "Example series", slug: "example-series", sermonCount: 20}]},
  topicalSermons: [], seriesRepresentatives: [], hasQueryParameters: false
};

describe("SermonsV5 presentation", () => {
  it("preserves original Arabic content with scoped right-to-left language attributes", () => {
    const record: SermonSummary = {...sermon, language: "ar", title: "عنوان تجريبي", summary: "وصف مصطنع لأغراض الاختبار فقط."};
    const page = renderSermonsV5Page({...input, sermons: [record]}, previewRenderContext);
    expect(page).toContain('<h3 class="journal__title" lang="ar" dir="rtl">');
    expect(page).toContain('id="description-00000000-0000-4000-8000-000000000051" lang="ar" dir="rtl">');
    expect(page).toContain(record.summary);
    expect(page).toContain(record.title);
  });
  it("reuses the complete finder and closed book disclosure, with V5 targets", () => {
    const page = renderSermonsV5Page(input);
    expect(page).toContain(String(finder({query: input.query, options: input.options, context: publicRenderContext, target: sermonsV5Target})));
    expect(page).toContain('<details class="fold" id="v5-shelf" data-fold>');
    expect(page).not.toContain('id="v5-shelf" data-fold open');
    expect(page).toContain('/sermons-v5/?sermon_book=romans#canon');
    expect(page).toContain('class="journal__entry journal__entry--featured hue--pauline"');
    expect(page).not.toContain('class="cards');
  });
  it("keeps original summary, passages and index destinations in semantic tables", () => {
    const page = renderSermonsV5Page(input);
    expect(page).toContain(sermon.summary);
    expect(page).toContain("Romans 5:1");
    expect(page.indexOf('id="v5-series-heading"')).toBeGreaterThan(page.indexOf('class="journal"'));
    expect(page.indexOf('id="v5-speakers-heading"')).toBeGreaterThan(page.indexOf('id="v5-series-heading"'));
    expect(page.match(/<table class="v5-directory">/g)).toHaveLength(2);
    expect(page).toContain('<th scope="col">Sermons</th>');
    expect(page).toContain('/sermons/?sermon_speaker=example-speaker');
    expect(page).toContain('href="/sermons/anonymous-v5/"');
  });
  it("features one latest entry without repeating it or mislabelling filtered results", () => {
    const page = renderSermonsV5Page(input);
    expect(page).toContain("Last Week’s Sermon");
    expect(page).toContain("Latest available recording");
    expect(page.match(/<article class="journal__entry/g)).toHaveLength(1);
    const filtered = renderSermonsV5Page({...input, query: publicSermonListQuerySchema.parse({speaker: "example-speaker"})});
    expect(filtered).not.toContain('id="v5-latest-heading"');
    expect(filtered).not.toContain('class="journal__entry journal__entry--featured');
  });
  it("renders the complete description once, safely escaped, with a progressive toggle and inert icons", () => {
    const record = {...sermon, summary: 'Synthetic first paragraph.\n\nLast paragraph with <script>unsafe fixture</script>.', transcript: {bodyText: "Private transcript fixture must not appear in V5."}};
    const page = renderSermonsV5Page({...input, sermons: [record]});
    expect(page).toContain('class="journal__description" id="description-00000000-0000-4000-8000-000000000051"');
    expect(page).toContain('type="button" hidden aria-expanded="false" aria-controls="description-00000000-0000-4000-8000-000000000051"');
    expect(page).toContain('data-description-label>See more');
    expect(page).toContain('Last paragraph with &lt;script&gt;unsafe fixture&lt;/script&gt;.');
    expect(page.match(/Synthetic first paragraph\./g)).toHaveLength(1);
    expect(page).not.toContain('<script>unsafe fixture');
    expect(page).not.toContain('Private transcript fixture');
    expect(page).not.toContain('class="journal__reading"');
    expect(page).not.toContain('class="journal__transcript"');
    expect(page).toContain('aria-label="Media shortcuts, not yet active"');
    for (const type of ["youtube", "audio", "text"]) expect(page).toContain(`class="journal__format journal__format--${type}"`);
    expect(page).not.toContain('<iframe');
    expect(page).toContain('class="journal__rail"');
    expect(page).toContain('class="journal__open"');
    const absent = renderSermonsV5Page({...input, sermons: [{...sermon, summary: null}]});
    expect(absent).not.toContain('class="journal__toggle"');
    expect(absent).not.toContain('Transcript unavailable');
  });
  it("keeps real tables, exact taxonomy links and only verified speaker portraits", () => {
    const page = renderSermonsV5Page({...input, options: {...input.options, speakers: [{name: "Wesam Saad", slug: "wesam-saad", sermonCount: 18}, {name: "Example Speaker", slug: "example-speaker"}]}}, previewRenderContext);
    expect(page).toContain('<caption class="sr-only">Speakers and available sermons</caption>');
    expect(page).toContain('class="v5-directory__portrait" src="/media/wesam.jpg"');
    expect(page.match(/class="v5-directory__portrait"/g)).toHaveLength(1);
    expect(page).toContain('class="v5-directory__count">18');
    expect(page).toContain('aria-label="Count unavailable"');
    expect(page.includes('href="/frontend-preview/speakers/wesam-saad/"')).toBe(true);
  });
  it("formats only genuine positive recording lengths, never a word-count estimate", () => {
    expect(recordingDuration(2450)).toBe("40:50");
    expect(recordingDuration(3661)).toBe("1:01:01");
    for (const value of [undefined, null, 0, -1, 1.5, Infinity, NaN]) expect(recordingDuration(value)).toBeNull();
    expect(renderSermonsV5Page(input)).toContain("Duration unavailable");
    const page = renderSermonsV5Page({...input, sermons: [{...sermon, primaryMedia: {provider: "youtube", mediaType: "video", externalId: "fixture1234", canonicalUrl: "https://www.youtube.com/watch?v=fixture1234", title: "Synthetic recording", durationSeconds: 2450}}]});
    expect(page).toContain("40:50");
    expect(page).toContain('class="journal__date"><time');
  });
  it("uses only explicit tracked portrait associations without guessing for other names", () => {
    expect(verifiedSpeakerPortrait("Wesam Saad")?.path).toBe("/media/wesam.jpg");
    expect(verifiedSpeakerPortrait("Ralph Gambardella")?.path).toBe("/media/ralph.jpg");
    expect(verifiedSpeakerPortrait("Wesam")).toBeNull();
    expect(verifiedSpeakerPortrait("Example Speaker")).toBeNull();
    expect(renderSermonsV5Page(input)).not.toContain('class="journal__portrait"');
  });
  it("keeps preview links protected and surfaces draft warnings rather than approving them", () => {
    const page = renderSermonsV5Page({...input, sermons: [{...sermon, reviewState: "draft_awaiting_review"}]}, previewRenderContext);
    expect(page).toContain('href="/frontend-preview/sermons/anonymous-v5/"');
    expect(page).toContain('action="/frontend-preview/sermons-v5/#v5-results"');
    expect(page).toContain("Draft · awaiting administrator review");
    expect(page).toContain('content="noindex, nofollow, noarchive"');
  });
  it("handles empty results, missing speaker, hostile content and page-two filters", () => {
    const query = publicSermonListQuerySchema.parse({page: 2, pageSize: 9, speaker: "example-speaker"});
    const page = renderSermonsV5Page({...input, query, sermons: [{...sermon, title: '<script>alert("fixture")</script>', speaker: null}]});
    expect(page).not.toContain('<script>alert');
    expect(page).toContain('&lt;script&gt;');
    expect(page).toContain('/sermons-v5/?sermon_speaker=example-speaker#v5-results');
    const empty = renderSermonsV5Page({...input, query, sermons: [], totalItems: 0});
    expect(empty).toContain("No sermons matched these filters");
    expect(empty).toContain('href="/sermons-v5/">Clear filters');
  });
});

