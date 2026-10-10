import {describe,it,expect} from 'vitest';
import {resolveHref} from '../src/frontend/content/markup';
import {publicRenderContext} from '../src/frontend/routes';
import {renderChurchPage,emptyFilterOptions} from '../src/frontend';
import {pageById} from '../src/frontend/content/registry';
describe('verified church absolute links',()=>{
 it('normalizes the observed covenant resource and preserves campaign bytes/fragments',()=>{
  expect(resolveHref('http://savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf?utm_source=old%20link#page=2',publicRenderContext)).toBe('https://www.savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf?utm_source=old%20link#page=2');
 });
 it('does not treat another host, credentials or alternate ports as canonical church links',()=>{
  for(const href of ['https://savinggrace.org.au.example.invalid/example','https://anonymous:fixture@savinggrace.org.au/example','https://savinggrace.org.au:8443/example'])expect(resolveHref(href,publicRenderContext)).toBe(href);
 });
 it('renders both covenant download buttons with the final canonical resource URL',()=>{
  for(const id of ['forms','church-covenant']){
   const page=pageById(id);
   const body=renderChurchPage(page,{today:'2026-10-10',sermons:[],options:emptyFilterOptions},publicRenderContext);
   expect(body).toContain('href="https://www.savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf"');
   expect(body).not.toContain('href="https://savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf"');
  }
 });
});
