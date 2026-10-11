import {describe,it,expect} from 'vitest';
import vm from 'node:vm';
import {ga4Script,ga4PublicLocation,type VerifiedGa4Configuration} from '../src/seo/measurement';
const config:VerifiedGa4Configuration={measurementId:'G-TEST123456',propertyId:'123',streamId:'456',configurationSha256:'a'.repeat(64),enhancedMeasurementDisabled:true,advertisingDisabled:true,existingAnalyticsConsent:'granted'};
describe('bounded church measurement',()=>{
 it('drops sensitive URL components and rejects every nonpublic environment',()=>{
  const location='https://www.savinggrace.org.au/about/?s=private&email=secret#transcript';
  expect(ga4PublicLocation(location)).toBe('https://www.savinggrace.org.au/about/');
  for(const environment of ['local','staging'])expect(ga4Script(config,environment,location,'Public title')).toBe('');
  for(const path of ['/admin/','/api/','/cms-editor-frame/token','/frontend-preview/sermons/'])expect(ga4Script(config,'production','https://www.savinggrace.org.au'+path,'Private title')).toBe('');
  expect(ga4Script({...config,existingAnalyticsConsent:'denied'},'production',location,'Title')).toBe('');
 });
 it('sends one explicit sanitized pageview, denies advertising and does not load on localhost',()=>{
  const script=ga4Script(config,'production','https://www.savinggrace.org.au/about/?s=secret#private','Public title');const tags:unknown[]=[];const window:{dataLayer:unknown[];__sgbcGa4?:boolean}={dataLayer:[]};
  const context={window,location:{origin:'https://www.savinggrace.org.au'},document:{createElement:()=>({}),head:{appendChild:(tag:unknown)=>tags.push(tag)}}};
  vm.runInNewContext(script,context);vm.runInNewContext(script,context);
  const commands=window.dataLayer.map(value=>Array.from(value as Iterable<unknown>));
  expect(commands.filter(value=>value[0]==='event'&&value[1]==='page_view')).toHaveLength(1);
  expect(JSON.stringify(commands)).not.toContain('secret');expect(JSON.stringify(commands)).not.toContain('#private');expect(tags).toHaveLength(1);
  expect(commands.find(value=>value[0]==='config')?.[2]).toMatchObject({send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_referrer:''});
  const local={...context,window:{dataLayer:[]},location:{origin:'http://127.0.0.1:4440'}};vm.runInNewContext(script,local);expect(local.window.dataLayer).toEqual([]);
 });
 it('requires exact property, stream, privacy settings and evidence before activation',()=>{
  expect(()=>ga4Script({...config,streamId:''},'production','https://www.savinggrace.org.au/','Title')).toThrow('unverified');
  expect(()=>ga4Script({...config,enhancedMeasurementDisabled:false} as unknown as VerifiedGa4Configuration,'production','https://www.savinggrace.org.au/','Title')).toThrow('unverified');
 });
});
