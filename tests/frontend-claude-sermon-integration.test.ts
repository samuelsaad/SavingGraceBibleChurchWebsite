import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import type { SermonDetail } from "../src/domain/sermon";
import { emptyFilterOptions, renderFrontendHomePage, renderSermonsV4Page, renderPublicSermonPage } from "../src/frontend";
import { previewRenderContext, publicRenderContext } from "../src/frontend/routes";
import { claudeSermonStyles } from "../src/frontend/styles/claude-sermons";
import { claudeSermonTokens } from "../src/frontend/styles/claude-sermon-tokens";
import { siteStyles } from "../src/frontend/styles";
import { contentSecurityPolicy } from "../src/server/http/frontend-response";

const preservedSources = [
  [
    "src/frontend/pages/home.ts",
    // Visual-editor attributes are private; all 47 baseline church HTML documents remain byte-identical.
    "47bccd2ecac412f5b8c4ab667c60b512e5cc762a1c02e13ba04bc579eb32a18e"
  ],
  [
    "src/frontend/pages/church.ts",
    // Visual-editor attributes are private; all 47 baseline church HTML documents remain byte-identical.
    "45ae19e675558f556c97e61147d5266c6fe7817890cbd740e561c5826bdb1dd5"
  ],
  [
    "src/frontend/styles/core.ts",
    // Authorized mobile adaptation: contained no-JS menus and text-scaled gutters.
    "1f12349f226180706458727a2b6a4e8a6e46297d4d4cbef1e76687a318a7df9b"
  ],
  [
    "src/frontend/styles/home.ts",
    "ce78abc44f38d7730875df581a7c816c31263e34d6037c098342c75c5884e845"
  ],
  [
    "src/frontend/styles/church.ts",
    // Authorized mobile adaptation: contact heading stacks instead of squeezing.
    "6b1e4d9ea734e5ffe872104f7cd1d2a591a63aef4546e6b3da57bdb1f14aefdb"
  ],
  [
    "src/frontend/styles/cards.ts",
    "2db806711e8f18010515b634291d5bca03c04709c589d1dec10c0b003bad6a86"
  ],
  [
    "src/frontend/tokens.ts",
    "f5c9097145bc4a8c171181edcd73f37df56264837657d83fc734c4000a3b47de"
  ],
  [
    "src/frontend/components/sections.ts",
    // Visual-editor attributes are private; all 47 baseline church HTML documents remain byte-identical.
    "b61c919dd2eeccde0b066d4fada075a1bfc6e2cc519810f918c719866d5ce30e"
  ],
  [
    "src/frontend/components/cards.ts",
    // D-177 adds only optional recording metadata to the existing date line.
    "5d26580a9280ac6b7d593c46f8dcec0166ad9d2e76abb804c08d7ae3df1384ab"
  ],
  [
    "src/frontend/components/search.ts",
    "1996c79e6d4f64404d7b00601bff0a07d443611a891cf4cc373a1d8baf2e09df"
  ],
  [
    "src/frontend/scripts/canon.ts",
    "ab5124d684a32561265c9d0707e6eedf960c14561004eb03fec3f5b5a1dd618a"
  ],
  [
    "src/frontend/scripts/sermon.ts",
    "4941b691d054e2afe570b4436bfbfbc581c3a5ddbfc033fc1e30be6d73f3abad"
  ],
] as const;
export const fixture: SermonDetail = {
  id: "00000000-0000-4000-8000-000000000071", title: "An example of steady faith",
  slug: "example-steady-faith", serviceDate: "2026-01-04",
  summary: "An anonymized layout description. It exists only for presentation tests, with no copied church sermon language.",
  speaker: { name: "Example Speaker", slug: "example-speaker" }, series: [],
  scriptureReferences: [], primaryPassages: [{displayText: "Romans 5:1", isLead: true}],
  primaryPassageState: "assigned", books: [{ name: "Romans", slug: "romans" }],
  primaryMedia: null, media: [], seoDescription: null, body: null,
  transcript: { bodyText: "First fixture paragraph with <unsafe> text.\n\nSecond fixture paragraph." },
  questionAnswers: [
    {question: "First fixture question?", answer: "First unchanged fixture answer.", displayOrder: 1},
    {question: "Second fixture question?", answer: "Second unchanged fixture answer.", displayOrder: 2}
  ], relatedSermons: []
};
const input = {
  sermons: [fixture, {...fixture, slug: "another-example", title: "Another example"}],
  totalItems: 20, query: publicSermonListQuerySchema.parse({page:1,pageSize:9}),
  options: {...emptyFilterOptions, books:[{name:"Romans",slug:"romans",sermonCount:20}]},
  topicalSermons: [], seriesRepresentatives: [], hasQueryParameters:false
};

describe("Claude sermon integration inside the preserved Astra shell", () => {
  it("preserves church pages, typography, cards and interactions plus additive V5 results focus", () => {
    for (const [path, expected] of preservedSources) {
      const actual = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
      expect(createHash("sha256").update(actual).digest("hex"), path).toBe(expected);
    }
  });

  it('preserves existing route shapes while allowing validated WordPress Unicode sermon slugs', async()=>{
    const {sermonPath}=await import('../src/frontend/routes');
    expect(sermonPath(publicRenderContext,'example-steady-faith')).toBe('/sermons/example-steady-faith/');
    expect(sermonPath(previewRenderContext,'example-steady-faith')).toBe('/frontend-preview/sermons/example-steady-faith/');
    const encoded=encodeURIComponent('مثال-تجريبي').toLowerCase();
    expect(sermonPath(publicRenderContext,encoded)).toBe('/sermons/'+encoded+'/');
  });

  it('adds Arabic language/direction only to original-language reading content without redesigning the chrome',()=>{
    const page=renderPublicSermonPage({...fixture,language:'ar',title:'مثال تجريبي',summary:'نص عربي تجريبي لا يتضمن مادة وعظ حقيقية.',transcript:{bodyText:'فقرة تجريبية أولى.\n\nفقرة تجريبية ثانية.'},questionAnswers:[{question:'سؤال تجريبي؟',answer:'جواب تجريبي.',displayOrder:1}]});
    expect(page).toContain('<ol class="questions" role="list" lang="ar" dir="rtl">');
    expect(page).toContain('class="prose transcript__body" lang="ar" dir="rtl"');
    expect(page).toContain('data-site-header');expect(page).not.toContain('<html lang="ar"');
    const english=renderPublicSermonPage(fixture);expect(english).toContain('<ol class="questions" role="list">');expect(english).not.toContain('class="prose transcript__body" lang="ar"');
  });

  it("anchors every Claude selector and all its tokens inside the sermon wrapper", () => {
    expect(claudeSermonTokens.startsWith(".claude-sermons{")).toBe(true);
    const clean = claudeSermonStyles.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of clean.matchAll(/(?:^|[{}])\s*([^{}]+)\{/g)) {
      const selector = match[1]!.trim();
      if (selector.startsWith("@")) continue;
      for (const part of selector.split(/,(?![^()]*\))/g)) expect(part.trim()).toMatch(/^\.claude-sermons(?:\s|$)/);
    }
    expect(clean).not.toMatch(/@font-face|:root\s*\{|\.claude-sermons\s+\.(?:masthead|site-footer)/);
    expect(siteStyles()).not.toContain(".claude-sermons");
    const home = renderFrontendHomePage({sermons:[],options:emptyFilterOptions,totalItems:0,today:"2026-09-28"});
    expect(home).not.toContain(".claude-sermons");
  });

  it("restores the serif V4 opening, folded shelf, equal cards and current filter/pagination URLs", () => {
    const page = renderSermonsV4Page(input);
    expect(page).toContain('<div class="claude-sermons"><div class="v4">');
    expect(page.indexOf('<p class="eyebrow">Sermon archive')).toBeLessThan(page.indexOf('<h1 class="title-page__title'));
    expect(page).toContain('id="v4-shelf" data-fold>');
    expect(page).not.toContain('id="v4-shelf" open');
    expect(page).toContain('class="card__flag"');
    expect(page).toContain('action="/sermons-v4/#v4-results"');
    expect(page).toContain('/sermons/example-steady-faith/');
    const results = renderSermonsV4Page({...input,query:publicSermonListQuerySchema.parse({view:"recent",page:2,pageSize:9})});
    expect(results).toContain('/sermons-v4/page/3/#v4-results');
    expect(claudeSermonStyles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(claudeSermonTokens).toContain('--font-display:"Sitka Banner"');
  });

  it("preserves exact escaped content, description-first order, visible ordered answers and private draft notices", () => {
    const page=renderPublicSermonPage({...fixture,reviewState:"draft_awaiting_review"},previewRenderContext);
    const body=page.slice(page.indexOf('<main'));
    expect(body).toContain('First fixture paragraph with &lt;unsafe&gt; text.');
    expect(body).toContain('Second fixture paragraph.');
    expect(body.indexOf(fixture.summary!)).toBeLessThan(body.indexOf('id="transcript"'));
    expect(body.indexOf('First fixture question?')).toBeLessThan(body.indexOf('Second fixture question?'));
    expect(body).toContain('First unchanged fixture answer.');
    expect(body).toContain('Second unchanged fixture answer.');
    expect(body).toContain('<details class="transcript" open');
    expect(body).toContain('Private draft awaiting administrator review.');
    expect(body).not.toMatch(/<details[^>]*class="question/);
    expect(page).not.toContain('rel="canonical"');
    expect(contentSecurityPolicy(page)).not.toContain("'unsafe-inline'");
  });

  it("changes only the main Sermons destination, preserving the existing menu and stable alternative routes", () => {
    const publicHome=renderFrontendHomePage({sermons:[],options:emptyFilterOptions,totalItems:0,today:"2026-09-28"},publicRenderContext);
    expect(publicHome).toContain('<li class="masthead__links-sermons"><a href="/sermons-v4/"');
    const preview=renderSermonsV4Page(input,previewRenderContext);
    expect(preview).toContain('<a href="/frontend-preview/sermons-v4/" data-sermon-archive');
    expect(preview).toContain('double-click to browse SermonsV4');
    for(const label of ["SermonsV1","SermonsV2","SermonsV4"])expect(preview).toContain(">"+label+"</a>");
  });
});
