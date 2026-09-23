import { describe, expect, it } from "vitest";
import type { SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions, renderFrontendHomePage } from "../src/frontend";
import { eventsCopy, homepageInventory, pendingLabels } from "../src/frontend/content/home-content";
import { previewRenderContext, publicRenderContext, restrictedRenderContext } from "../src/frontend/routes";
import { contentSecurityPolicy, embeddedScriptHashes, embeddedStyleHashes } from "../src/server/http/frontend-response";

function sermon(index: number): SermonSummary {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `An anonymised sermon ${index}`,
    slug: `anonymised-sermon-${index}`,
    serviceDate: `2026-02-${String(index).padStart(2, "0")}`,
    summary: "An anonymised approved description that is comfortably longer than eighty characters for the excerpt.",
    speaker: { name: "Example Speaker", slug: "example-speaker" },
    series: [{ name: "Example Series", slug: "example-series" }],
    scriptureReferences: [],
    primaryPassages: [{ displayText: `Luke ${index}:1–4`, isLead: true }],
    primaryPassageState: "assigned",
    books: [{ name: "Luke", slug: "luke" }],
    primaryMedia: null
  };
}

const options = { ...emptyFilterOptions, books: [{ name: "Luke", slug: "luke", sermonCount: 4 }] };
const sermons = [sermon(4), sermon(3), sermon(2), sermon(1)];

function decode(html: string): string {
  return html.replaceAll("&amp;", "&").replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&quot;", "\"").replaceAll("&#39;", "'");
}

describe("church homepage", () => {
  it("carries every text item from the supplied screenshots verbatim", () => {
    const html = decode(renderFrontendHomePage({ sermons, options, totalItems: 4 }, publicRenderContext));
    for (const item of homepageInventory) expect(html, item).toContain(item);
    expect(html.match(/<h1[\s>]/gu)).toHaveLength(1);
    expect(html).toContain('<h1 id="hero-heading" class="arrive__title"><span class="arrive__name">Saving Grace</span><span class="arrive__name">Bible Church</span></h1>');
    expect(html).toContain('<p class="eyebrow arrive__eyebrow">Welcome to</p>');
    expect(html).toContain('<h2 id="welcome-heading" class="welcome__title">Welcome to Saving Grace Bible Church</h2>');
    expect(html).toContain('<aside class="notice" aria-label="Church notice">');
    expect(html).toContain("Men's Theological Study");
    expect(html).toContain("© 2023 Saving Grace Bible Church");
    expect(html).not.toContain("datetime=\"2026-09-27\"");
  });

  it("links only to real in-page sections and archive routes and renders every unknown destination as a pending label", () => {
    const html = renderFrontendHomePage({ sermons, options, totalItems: 4 }, publicRenderContext);
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/gu)].map((match) => match[1]!);
    for (const href of hrefs) {
      expect(href, href).not.toBe("#");
      expect(href, href).not.toBe("");
      expect(href, href).not.toMatch(/^(https?:|mailto:|tel:)/u);
    }
    for (const id of ["top", "about", "services", "sermons", "events", "give", "contact", "welcome", "visit", "pillar-our-faith"]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toContain('<a class="button welcome-card__cta" href="#services">Join Us This Weekend</a>');
    expect(html).toContain('<a class="pillar__more" href="#services">Read more<span class="sr-only"> about Lord’s Day</span></a>');
    expect(html).toContain('<a class="pillar__more" href="#about">Read more<span class="sr-only"> about Our Faith</span></a>');
    expect(html).toContain('<a class="button masthead__give" href="/#give">Give</a>');
    expect(html).toContain('<li><a href="/#about">About Us</a></li>');
    expect(html).toContain('<li><a href="/#events">News &amp; Events</a></li>');
    expect(html).toContain('<li><a href="/#contact">Contact Us</a></li>');
    expect(html).toContain('<li><a href="/#pillar-our-faith">What We Teach</a></li>');
    expect(html).toContain('<a class="footer-bar__top" href="#top">');
    expect(html).toContain('<a class="footer-bar__glyph footer-bar__glyph--link" href="/sermons/#sermon-search">');
    expect(html).toContain('<a class="button button--outline" href="/sermons/">View All</a>');
    expect(html.match(/class="(?:[^"]* )?pending(?: [^"]*)?"/gu)).toHaveLength(pendingLabels.length);
    expect(html.match(/ \(link not yet available\)<\/span>/gu)).toHaveLength(pendingLabels.length);
    for (const label of ["Ministries", "Blogs", "Learn more about our church &gt;", "View Calendar", "Get directions on the map →"]) {
      expect(html).toContain(`${label}<span class="sr-only"> (link not yet available)</span>`);
    }
    expect(html).not.toContain("<button disabled");
    expect(html).not.toContain("Tel: <a");
    expect(html).toContain("<span>Tel: 0450545589</span>");
    expect(html).toContain("<span>E-mail: info@savinggrace.org.au</span>");
  });

  it("renders the newest sermons with the V4 card system and the newest in the footer, from the repository only", () => {
    const html = renderFrontendHomePage({ sermons, options, totalItems: 4 }, publicRenderContext);
    const recent = html.slice(html.indexOf('id="sermons"'), html.indexOf('class="section about-row"'));
    expect(recent.match(/<article class="card /gu)).toHaveLength(3);
    expect(recent).toContain('href="/sermons/anonymised-sermon-4/"');
    expect(recent).toContain('href="/sermons/anonymised-sermon-2/"');
    expect(recent).not.toContain("anonymised-sermon-1");
    expect(recent).not.toContain("card--latest");
    expect(recent).toContain('<h3 class="card__title"><a href="/sermons/anonymised-sermon-4/">An anonymised sermon 4</a></h3>');
    const footer = html.slice(html.indexOf('<footer class="site-footer">'));
    expect(footer).toContain('<h2 class="footer-col__title" id="footer-sermon-heading">Recent Sermon</h2>');
    expect(footer.match(/<article class="card /gu)).toHaveLength(1);
    expect(footer).toContain('href="/sermons/anonymised-sermon-4/"');
    expect(html).not.toContain("Weak men in the mighty hands of Christ");
    expect(html).not.toContain('class="entry entry--');
  });

  it("shows honest empty states in the static build and keeps the homepage indexable with its metadata", () => {
    const html = renderFrontendHomePage({ sermons: [], options: emptyFilterOptions, totalItems: 0 }, publicRenderContext);
    expect(html).toContain("<title>Saving Grace Bible Church</title>");
    expect(html).toContain('<meta name="robots" content="index, follow" />');
    expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/"');
    expect(html).toContain('<meta name="description" content="Saving Grace Bible Church in Westmeadows, Victoria:');
    expect(html).toContain('<h2 id="recent-heading" class="section__title">Recent Sermons</h2>');
    expect(html.match(/No sermon is available yet\. Please check back soon\./gu)).toHaveLength(2);
    expect(html).not.toContain('<article class="card');
    expect(html).not.toContain("<script");
    expect(html).not.toContain('class="preview-band"');
    expect(html).not.toContain("SermonsV1");
    expect(html).toContain('<img class="brand__logo" src="/brand/saving-grace-logo.png" width="300" height="178" alt="Saving Grace Bible Church" decoding="async" />');
    expect(html).not.toContain(' style="');
    expect(html).not.toMatch(/url\(/u);
    for (const item of homepageInventory) {
      if (item === "Recent Sermon" || item === "Home") continue;
      expect(decode(html), item).toContain(item);
    }
    const csp = contentSecurityPolicy(html);
    for (const styleHash of embeddedStyleHashes(html)) expect(csp).toContain(styleHash);
    expect(embeddedScriptHashes(html)).toHaveLength(0);
    expect(csp).not.toContain("script-src");
    expect(csp).not.toContain("frame-src");
  });

  it("keeps the events as verbatim page copy without inventing a year, and works in every render context", () => {
    expect(eventsCopy.events).toHaveLength(2);
    for (const context of [previewRenderContext, restrictedRenderContext]) {
      const html = renderFrontendHomePage({ sermons, options, totalItems: 4 }, context);
      expect(html).not.toContain('rel="canonical"');
      expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
      expect(html).toContain('<script data-enhancement="navigation">');
      expect(html).toContain('<details class="masthead__menu" data-sermon-menu>');
      expect(html).toContain(">SermonsV4</a>");
      expect(html).toContain("SEP");
      expect(html).toContain("4:30 pm – 5:30 pm");
      expect(html).toContain('<span class="sr-only">Recurring</span>');
      expect(html.match(/<time /gu)?.length ?? 0).toBe(4);
    }
    const preview = renderFrontendHomePage({ sermons, options, totalItems: 4 }, previewRenderContext);
    expect(preview).toContain('<a class="button masthead__give" href="/frontend-preview/#give">Give</a>');
    expect(preview).toContain('href="/frontend-preview/sermons/anonymised-sermon-4/"');
    expect(preview).toContain('href="/frontend-preview/books/luke/"');
  });
});
