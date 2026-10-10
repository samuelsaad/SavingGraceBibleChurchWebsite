import {describe,it,expect} from 'vitest';
import {resolveHref} from '../src/frontend/content/markup';
import {publicRenderContext} from '../src/frontend/routes';
describe('verified church absolute links',()=>{
 it('normalizes the observed covenant resource and preserves campaign bytes/fragments',()=>{
  expect(resolveHref('http://savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf?utm_source=old%20link#page=2',publicRenderContext)).toBe('https://www.savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf?utm_source=old%20link#page=2');
 });
 it('does not treat another host, credentials or alternate ports as canonical church links',()=>{
  for(const href of ['https://savinggrace.org.au.example.invalid/example','https://anonymous:fixture@savinggrace.org.au/example','https://savinggrace.org.au:8443/example'])expect(resolveHref(href,publicRenderContext)).toBe(href);
 });
});
