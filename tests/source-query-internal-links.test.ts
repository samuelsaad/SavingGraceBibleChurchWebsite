import {it,expect} from 'vitest';import {resolveHref} from '../src/frontend/content/markup';
it('resolves exact reviewed query aliases to their final destinations and retains fragments',()=>{const context={mode:'public' as const,basePath:'' as const,sourceResourceRedirects:{'/events/summary/?related_series=123':'/events/list/?related_series=123','/page/2/?post_type=tribe_events&eventDisplay=list':'/events/list/page/2/'}};expect(resolveHref('/events/summary/?related_series=123#calendar',context)).toBe('/events/list/?related_series=123#calendar');expect(resolveHref('https://www.savinggrace.org.au/page/2/?post_type=tribe_events&eventDisplay=list',context)).toBe('https://www.savinggrace.org.au/events/list/page/2/');expect(resolveHref('/events/summary/?related_series=999',context)).toBe('/events/summary/?related_series=999');});

it('sends typed Day controls directly to their date and scope without inheriting a list page',()=>{
 const context={mode:'public' as const,basePath:'' as const};
 expect(resolveHref('/page/4/?post_type=tribe_events&tag=es&eventDisplay=day&eventDate=2026-10-11&utm_source=church%20news#calendar',context)).toBe('/events/day/2026-10-11/?tag=es&utm_source=church%20news#calendar');
 expect(resolveHref('http://savinggrace.org.au/page/2/?post_type=tribe_events&eventDisplay=day&eventDate=2026-10-11',context)).toBe('https://www.savinggrace.org.au/events/day/2026-10-11/');
 expect(resolveHref('/page/2/?post_type=tribe_events&eventDisplay=list',context)).toBe('/page/2/?post_type=tribe_events&eventDisplay=list');
 expect(resolveHref('/page/2/?post_type=tribe_events&eventDisplay=day&eventDate=2026-02-30',context)).toContain('/page/2/');
 expect(resolveHref('/page/2/?post_type=tribe_events&eventDisplay=day&unknown=value',context)).toContain('/page/2/');
 expect(resolveHref('https://unrelated.test/page/2/?post_type=tribe_events&eventDisplay=day',context)).toContain('https://unrelated.test/');
});
