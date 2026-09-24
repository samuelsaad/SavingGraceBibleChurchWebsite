import { describe, expect, it } from "vitest";
import type { SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions, renderFrontendHomePage } from "../src/frontend";
import { homepageInventory, pendingLabels } from "../src/frontend/content/home-content";
import { destinationAvailable } from "../src/frontend/content/registry";
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
const today = "2026-09-24";

function decode(html: string): string {
  return html.replaceAll("&amp;", "&").replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&quot;", "\"").replaceAll("&#39;", "'");
}

describe("church homepage", () => {
  it("carries every text item from the church's homepage copy verbatim", () => {
    const html = decode(renderFrontendHomePage({ sermons, options, totalItems: 4, today }, publicRenderContext));
    for (const item of homepageInventory) expect(html, item).toContain(item);
    expect(html.match(/<h1[\s>]/gu)).toHaveLength(1);
    expect(html).toContain('<h1 id="hero-heading" class="arrive__title"><span class="arrive__name">Saving Grace</span><span class="arrive__name">Bible Church</span></h1>');
    expect(html).toContain('<p class="eyebrow arrive__eyebrow">Welcome to</p>');
    expect(html).toContain('<h2 id="welcome-heading" class="welcome__title">Welcome to Saving Grace Bible Church</h2>');
    expect(html).toContain('<aside class="notice" aria-label="Church notice">');
    expect(html).toContain("© 2023 Saving Grace Bible Church");
    expect(html).toContain('<img class="welcome-card__image" src="/media/entrance.jpg" width="289" height="510" alt="The entrance to Saving Grace Bible Church');
    expect(html).toContain('<img class="home__photo-image" src="/media/congregation.jpg"');
  });

  it("links every label to a real page of this site or a destination the church published, and keeps only the social marks pending", () => {
    const html = renderFrontendHomePage({ sermons, options, totalItems: 4, today }, publicRenderContext);
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/gu)].map((match) => match[1]!);
    for (const href of hrefs) {
      expect(href, href).not.toBe("#");
      expect(href, href).not.toBe("");
      if (href.startsWith("/")) expect(destinationAvailable(href, publicRenderContext), href).toBe(true);
      else expect(href, href).toMatch(/^(?:#|tel:\+61450545589|mailto:info@savinggrace\.org\.au|https:\/\/goo\.gl\/maps\/gL2hcbXG3Ci9zqRVA)/u);
    }
    for (const id of ["top", "about", "services", "sermons", "events", "give", "contact", "welcome", "visit", "pillar-our-faith"]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toContain('<a class="button welcome-card__cta" href="/lords-day-service/">Join Us This Weekend</a>');
    expect(html).toContain('<a class="pillar__more" href="/our-history/">Read more<span class="sr-only"> about History</span></a>');
    expect(html).toContain('<a class="pillar__more" href="/what-we-teach/the-gospel/">Read more<span class="sr-only"> about The Gospel</span></a>');
    expect(html).toContain('<h3 class="service__title"><a href="/lords-day-service/">Sunday Morning 10:30am (Formal)</a></h3>');
    expect(html).toContain('<a class="pillar__more" href="/about/">Learn more about our church &gt;</a>');
    expect(html).toContain('<a class="button button--onink" href="/support-saving-grace-church-offering/">Ways to make an offering</a>');
    expect(html).toContain('<a class="button masthead__give" href="/support-saving-grace-church-offering/">Give</a>');
    expect(html).toContain('<a class="button button--outline events__calendar" href="/events/">View Calendar</a>');
    expect(html).toContain('<li><a href="/about/">About Us</a></li>');
    expect(html).toContain('<li><a href="/ministries/">Ministries</a></li>');
    expect(html).toContain('<li><a href="/blogs/">Blogs</a></li>');
    expect(html).toContain('<a href="https://goo.gl/maps/gL2hcbXG3Ci9zqRVA" rel="noopener">Get directions on the map →<span class="sr-only"> (external site)</span></a>');
    expect(html).toContain('<a href="tel:+61450545589">Tel: 0450545589</a>');
    expect(html).toContain('<a href="mailto:info@savinggrace.org.au">E-mail: info@savinggrace.org.au</a>');
    expect(html).toContain('<a class="footer-bar__top" href="#top">');
    expect(html).toContain('<a class="button button--outline" href="/sermons/">View All</a>');
    expect(html.match(/class="(?:[^"]* )?pending(?: [^"]*)?"/gu)).toHaveLength(pendingLabels.length);
    expect(html.match(/ \(link not yet available\)<\/span>/gu)).toHaveLength(pendingLabels.length);
    expect(html).not.toContain("<button disabled");
    expect(html).not.toContain("coming soon");
  });

  it("renders the newest sermons with the V4 card system and the newest in the footer, from the repository only", () => {
    const html = renderFrontendHomePage({ sermons, options, totalItems: 4, today }, publicRenderContext);
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
    expect(footer).toContain('<img class="brand__logo brand__logo--inverse" src="/media/logo-white.png"');
    expect(html).not.toContain("Weak men in the mighty hands of Christ");
    expect(html).not.toContain('class="entry entry--');
  });

  it("computes the upcoming events for the render date instead of carrying dated copy", () => {
    const html = decode(renderFrontendHomePage({ sermons, options, totalItems: 4, today }, publicRenderContext));
    const section = html.slice(html.indexOf('id="events"'), html.indexOf('<footer class="site-footer">'));
    expect(section).toContain('<span class="event__month">SEP</span><span class="event__day">27</span>');
    expect(section).toContain('<time datetime="2026-09-27T16:30">Sunday 27 September 2026, 4:30 pm – 5:30 pm</time>');
    expect(section).toContain('<a href="/events/mens-theological-study/">Men’s Theological Study</a>');
    expect(section).toContain('<a href="/events/sunday-evening-service/">Sunday Evening Service</a>');
    expect(section).toContain('<span class="sr-only">Recurring</span>');
    expect(section.match(/<li class="event">/gu)).toHaveLength(4);
    const later = decode(renderFrontendHomePage({ sermons, options, totalItems: 4, today: "2026-10-01" }, publicRenderContext));
    expect(later).toContain('<span class="event__month">OCT</span><span class="event__day">3</span>');
    expect(later).toContain("Woman's Study");
  });

  it("shows honest empty states in the static build and keeps the homepage indexable with its metadata", () => {
    const html = renderFrontendHomePage({ sermons: [], options: emptyFilterOptions, totalItems: 0, today }, publicRenderContext);
    expect(html).toContain("<title>Saving Grace Bible Church</title>");
    expect(html).toContain('<meta name="robots" content="index, follow" />');
    expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/"');
    expect(html).toContain('<meta name="description" content="Saving Grace Bible Church in Westmeadows, Victoria:');
    expect(html).toContain('<link rel="icon" href="/brand/favicon-32.png" sizes="32x32" type="image/png" />');
    expect(html).toContain('<h2 id="recent-heading" class="section__title">Recent Sermons</h2>');
    expect(html.match(/No sermon is available yet\. Please check back soon\./gu)).toHaveLength(2);
    expect(html).not.toContain('<article class="card');
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
    expect(embeddedScriptHashes(html)).toHaveLength(1);
    expect(html).toContain('<script data-enhancement="navigation">');
    expect(csp).not.toContain("frame-src");
  });

  it("works in every render context with the shared menus", () => {
    for (const context of [previewRenderContext, restrictedRenderContext]) {
      const html = renderFrontendHomePage({ sermons, options, totalItems: 4, today }, context);
      expect(html).not.toContain('rel="canonical"');
      expect(html).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
      expect(html).toContain('<script data-enhancement="navigation">');
      expect(html).toContain('<details class="masthead__menu" data-menu data-sermon-menu>');
      expect(html).toContain(">SermonsV4</a>");
      expect(html).toContain('<details class="masthead__menu" data-menu>');
    }
    const preview = renderFrontendHomePage({ sermons, options, totalItems: 4, today }, previewRenderContext);
    expect(preview).toContain('<a class="button masthead__give" href="/frontend-preview/support-saving-grace-church-offering/">Give</a>');
    expect(preview).toContain('href="/frontend-preview/sermons/anonymised-sermon-4/"');
    expect(preview).toContain('href="/frontend-preview/books/luke/"');
    expect(preview).toContain('href="/frontend-preview/events/mens-theological-study/"');
  });
});
