import{it,expect}from'vitest';import{renderSourceContent}from'../src/frontend/source-content';
it('resets only retained Day-view controls while preserving filters and campaign bytes',()=>{
 const link=(text:string,href:string)=>renderSourceContent([{tag:'a',href,children:[{tag:'text',text}]}]).toString();
 const href='/?post_type=tribe_events&eventDisplay=day&paged=2&eventDate=2026-10-04&tag=tb&utm_source=old%20link';
 expect(link('Day',href)).toContain('href="/events/day/2026-10-04/?tag=tb&amp;utm_source=old%20link"');expect(link('Next page',href)).toContain('paged=2');
 for(const changed of [href.replace('tribe_events','post'),href+'&related_series=123',href.replace('2026-10-04','2026-02-31'),href+'&paged=3'])expect(link('Day',changed)).toContain('eventDisplay=day');
 expect(link('Day','/?post_type=tribe_events&eventDisplay=day&paged=2')).toContain('href="/events/day/"');
});
