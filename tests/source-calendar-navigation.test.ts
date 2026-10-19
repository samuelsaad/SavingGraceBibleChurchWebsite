import{it,expect}from'vitest';import{renderSourceContent}from'../src/frontend/source-content';
it('resets only retained Day-view controls while preserving filters and campaign bytes',()=>{
 const link=(text:string,href:string)=>renderSourceContent([{tag:'a',href,children:[{tag:'text',text}]}]).toString();
 const href='/?post_type=tribe_events&eventDisplay=day&paged=2&eventDate=2026-10-04&tag=tb&utm_source=old%20link';
 expect(link('Day',href)).toContain('href="/events/day/2026-10-04/?tag=tb&amp;utm_source=old%20link"');expect(link('Next page',href)).toContain('paged=2');
 for(const changed of [href.replace('tribe_events','post'),href.replace('2026-10-04','2026-02-31'),href+'&paged=3'])expect(link('Day',changed)).toContain('eventDisplay=day');
 expect(link('Day','/?post_type=tribe_events&eventDisplay=day&paged=2')).toContain('href="/events/day/"');
});

it('resets inherited page state on verified Day navigation while retaining the chosen date and known series',()=>{
 const href='/page/5/?post_type=tribe_events&eventDisplay=day&tag=ms&eventDate=2026-10-18';
 for(const text of ['Day','Previous Day','Next Day',''])expect(renderSourceContent([{tag:'a',href,text}]).toString()).toContain('href="/events/day/2026-10-18/?tag=ms"');
 expect(renderSourceContent([{tag:'a',href:'/?post_type=tribe_events&eventDisplay=day&related_series=123&paged=2',text:'Day'}]).toString()).toContain('href="/events/day/?related_series=123"');
});

it('repairs only the exact dead original shortcode navigation while leaving its URL disposition separate',()=>{
 const href='/events/?pagename=church-events&shortcode=9ddfb0dc';expect(renderSourceContent([{tag:'a',href,text:'next upcoming events'}]).toString()).toContain('href="/events/list/"');expect(renderSourceContent([{tag:'a',href:href+'&other=1',text:'next upcoming events'}]).toString()).toContain('shortcode=9ddfb0dc');
});
