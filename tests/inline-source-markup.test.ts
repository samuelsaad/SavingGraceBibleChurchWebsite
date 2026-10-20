import{describe,it,expect}from'vitest';import{inline,plainText}from'../src/frontend/content/markup';import{publicRenderContext}from'../src/frontend/routes';
describe('retained source emphasis containing links',()=>{
 it('renders a complete original emphasized phrase across its unchanged inline link',()=>{
  const value='_An anonymous introduction with [the same link](/source_identity/) inside._',rendered=inline(value,publicRenderContext).toString();expect(rendered).toBe('<em>An anonymous introduction with <a href="/source_identity/">the same link</a> inside.</em>');expect(plainText(value)).toBe('An anonymous introduction with the same link inside.');
 });
 it('preserves separate emphasis runs and strong text surrounding an inline link',()=>{
  expect(inline('_One_ and _two_',publicRenderContext).toString()).toBe('<em>One</em> and <em>two</em>');expect(inline('**An anonymous [link](/same/) and statement**',publicRenderContext).toString()).toBe('<strong>An anonymous <a href="/same/">link</a> and statement</strong>');
 });
 it('keeps text escaped and rejects unsupported link protocols inside emphasis',()=>{
  const value='_<script>private()</script> [safe <label>](javascript:alert) end._',rendered=inline(value,publicRenderContext).toString();expect(rendered).toBe('<em>&lt;script&gt;private()&lt;/script&gt; safe &lt;label&gt; end.</em>');expect(rendered).not.toContain('href=');expect(rendered).not.toContain('<script>');
 });
});
