/** D-182: activation requires verified church configuration and existing consent. */
export interface VerifiedGa4Configuration {
 measurementId:string;propertyId:string;streamId:string;configurationSha256:string;
 enhancedMeasurementDisabled:true;advertisingDisabled:true;
 existingAnalyticsConsent:'granted'|'denied';
}
export const ga4Destinations=Object.freeze({tag:'https://www.googletagmanager.com/gtag/js',collect:['https://www.google-analytics.com/g/collect','https://region1.google-analytics.com/g/collect']});
const privatePath=/^\/(?:admin|api|cms-preview|cms-editor-frame|frontend-preview|draft-preview|related-themes-evaluation|health)(?:\/|$)/u;
export function ga4PublicLocation(location:string):string|null {
 try{const url=new URL(location);if(url.origin!=='https://www.savinggrace.org.au'||privatePath.test(decodeURIComponent(url.pathname))||/%(?:2f|5c|00)/iu.test(url.pathname)||url.username||url.password)return null;return url.origin+url.pathname;}catch{return null;}
}
export function ga4Script(config:VerifiedGa4Configuration,environment:string,location:string,title:string):string {
 const clean=ga4PublicLocation(location);
 if(environment!=='production'||!clean||config.existingAnalyticsConsent!=='granted')return '';
 if(!/^G-[A-Z0-9]{6,20}$/u.test(config.measurementId)||!/^\d{1,20}$/u.test(config.propertyId)||!/^\d{1,20}$/u.test(config.streamId)||! /^[a-f0-9]{64}$/u.test(config.configurationSha256)||config.enhancedMeasurementDisabled!==true||config.advertisingDisabled!==true)throw Error('ga4_configuration_unverified');
 const encode=(value:string)=>JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
 return `(function(){'use strict';if(location.origin!=='https://www.savinggrace.org.au'||window.__sgbcGa4)return;window.__sgbcGa4=true;window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config',${encode(config.measurementId)},{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:${encode(clean)},page_title:${encode(title)},page_referrer:'',ignore_referrer:true});gtag('event','page_view',{send_to:${encode(config.measurementId)},page_location:${encode(clean)},page_title:${encode(title)}});var tag=document.createElement('script');tag.async=true;tag.referrerPolicy='origin';tag.src=${encode(ga4Destinations.tag+'?id='+config.measurementId)};document.head.appendChild(tag);})();`;
}
