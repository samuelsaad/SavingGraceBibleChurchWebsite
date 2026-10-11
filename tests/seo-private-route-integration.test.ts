import {describe,it,expect} from 'vitest';
import {retainPrivateRoutes} from '../src/seo/site-integration';
import {createCmsDashboardHandler} from '../src/cms/dashboard';
import {CmsSessionProvider} from '../src/cms/session';
describe('source visitor preserves the protected CMS asset boundary',()=>{
 it('routes only the exact admin bundle and stylesheet to the existing handler',async()=>{
  const handler=retainPrivateRoutes(async()=>new Response('protected'),async()=>new Response('visitor'));
  for(const path of ['/_astro/cms-admin.js','/_astro/cms-admin.css','/_astro/cms-admin.js?cache=1','/admin/cms'])expect(await(await handler(new Request('http://127.0.0.1:4396'+path))).text()).toBe('protected');
  for(const path of ['/_astro/visitor.js','/_astro/cms-admin.js-extra','/_astro/cms-admin.jsx','/about/'])expect(await(await handler(new Request('http://127.0.0.1:4396'+path))).text()).toBe('visitor');
 });
 it('does not make admin assets accessible without the existing session',async()=>{
  const session=new CmsSessionProvider({origin:'http://127.0.0.1:4396',secret:'ab'.repeat(32),environment:'staging'});
  const dashboard=createCmsDashboardHandler('/unused-no-files-needed',session,'staging');
  const handler=retainPrivateRoutes(async request=>(await dashboard(request))??new Response('missing',{status:404}),async()=>new Response('visitor'));
  for(const path of ['/_astro/cms-admin.js','/_astro/cms-admin.css']){const response=await handler(new Request('http://127.0.0.1:4396'+path));expect(response.status).toBe(303);expect(response.headers.get('Location')).toBe('/admin/login');expect(response.headers.get('X-Robots-Tag')).toContain('noindex');}
 });
});
