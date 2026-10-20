import {describe, it, expect} from 'vitest';
import {sitemapDate, latestSitemapDate} from '../src/seo/sitemap-dates';
import {renderSeoSitemap} from '../src/seo/http-sitemap';
import {publicRenderContext} from '../src/frontend/routes';
import {sourcePublicSitemap} from '../src/seo/source-public-handler';
import {sourcePageSchema} from '../src/seo/source-public-model';
describe('historical sitemap modification dates', () => {
 it('preserves full original time and timezone without substituting a release date', () => {
  expect(sitemapDate('2020-01-02T12:34:56+11:00')).toBe('2020-01-02T01:34:56.000Z');
  expect(sitemapDate('2020-01-02')).toBe('2020-01-02');
  expect(latestSitemapDate([null, '2020-01-02', '2020-01-02T00:00:00Z'])).toBe('2020-01-02T00:00:00.000Z');
  expect(latestSitemapDate([])).toBeUndefined();
 });
 it('rejects impossible calendar dates, timestamps and non-W3C input', () => {
  for (const value of ['2020-02-30', '2020-02-30T00:00:00Z', '2020-01-01T24:00:00Z', '2020-01-01T12:61:00Z', '2020-01-01T01:00:00+25:00', '-001-11-30', 'yesterday', '']) expect(() => sitemapDate(value)).toThrow('seo_sitemap_date_invalid');
 });
 it('keeps the latest genuine modification when native and original routes merge', () => {
  const xml = renderSeoSitemap([{slug:'anonymous', lastModified:'2020-02-03T04:05:06+00:00'}], publicRenderContext, false, [{path:'/sermons/anonymous/', lastModified:'2019-01-01T00:00:00Z'}]);
  expect(xml).toContain('/sermons/anonymous/</loc><lastmod>2020-02-03T04:05:06.000Z</lastmod>');
  expect(xml).toContain('/sermons/</loc><lastmod>2020-02-03T04:05:06.000Z</lastmod>');
 });
 it('keeps an original date on an ordinary page without sitemap images', () => {
  const page=sourcePageSchema.parse({path:'/anonymous/',kind:'page',sourceUrl:'https://www.savinggrace.org.au/anonymous/',sourceId:1,capturedAt:'2026-10-20T00:00:00Z',responseSha256:'a'.repeat(64),title:'Anonymous',heading:'Anonymous',description:null,indexable:true,canonicalSource:'https://www.savinggrace.org.au/anonymous/',publishedAt:null,modifiedAt:'2020-01-02T03:04:05Z',content:[],sermon:null});
  expect(sourcePublicSitemap([page])).toEqual([{path:'/anonymous/',lastModified:'2020-01-02T03:04:05.000Z'}]);
 });
});
