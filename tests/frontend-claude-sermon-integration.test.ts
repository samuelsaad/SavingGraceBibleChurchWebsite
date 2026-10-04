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
    "458a1bb4220be2611838a1bead2c4fb0f15a9bedabb3666fe6ece50e5027cd5f"
  ],
  [
    "src/frontend/pages/church.ts",
    "03d5989872352c982d4bc701827fe73a098da77303caec6b7557521f09d7ad84"
  ],
  [
    "src/frontend/styles/core.ts",
    "ad288f8eaa48887cec4225f438e422fa46f47c47fd54e1eff4d871412fad34f8"
  ],
  [
    "src/frontend/styles/home.ts",
    "ce78abc44f38d7730875df581a7c816c31263e34d6037c098342c75c5884e845"
  ],
  [
    "src/frontend/styles/church.ts",
    "8e5178cc1df7fbd1eb069607bf1bde180a7236ef345b9b9038cd5824bcf1b1b1"
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
    "881828489257b7e5af7efb0ab3c2b68444da82e8efdbedbbd56538e1e822e180"
  ],
  [
    "src/frontend/components/cards.ts",
    "8cb4200dd6ed718014117cc0b1f9fe3efc3c935485e09167a039225eb0ce11e9"
  ],
  [
    "src/frontend/components/search.ts",
    "1996c79e6d4f64404d7b00601bff0a07d443611a891cf4cc373a1d8baf2e09df"
  ],
  [
    "src/frontend/scripts/canon.ts",
    "545d26e4b1efac58d57bd44f98d065d5bb1d32f548c7f25fc551b5f182698197"
  ],
  [
    "src/frontend/scripts/sermon.ts",
    "4941b691d054e2afe570b4436bfbfbc581c3a5ddbfc033fc1e30be6d73f3abad"
  ],
  [
    "src/frontend/routes.ts",
    "a3b6eedf10f1a2575837b6955f54835ab18a4e83ba4ae9fc281de24c83741bc7"
  ]
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
  it("keeps church pages, global typography, home cards, sermon interactions and routes byte-identical", () => {
    for (const [path, expected] of preservedSources) {
      const actual = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
      expect(createHash("sha256").update(actual).digest("hex"), path).toBe(expected);
    }
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
