import type {SourcePrimaryStructuredData} from '../domain/source-content';
import {raw,type Html} from './html';
export interface PageStructuredData {language?:string;publishedAt?:string|null;modifiedAt?:string|null;primary?:SourcePrimaryStructuredData|undefined;breadcrumbs?:Array<{name:string;path:string}>|undefined}
export function pageStructuredData(url:string,name:string,description:string,source:PageStructuredData={},church?:{name:string;address:string;telephone:string;email:string;image:string;sameAs:string[]}):Html{
 const origin=new URL(url).origin;const page:Record<string,unknown>={'@context':'https://schema.org','@type':'WebPage','@id':url+'#webpage',url,name,inLanguage:source.language??'en-AU',...(description?{description}:{})};
 for(const [key,value]of Object.entries({datePublished:source.publishedAt,dateModified:source.modifiedAt}))if(value&&/^\d{4}-\d{2}-\d{2}T/u.test(value)&&Number.isFinite(Date.parse(value)))page[key]=value;
 const output:Record<string,unknown>[]=[page];
 if(source.primary){
  const value=source.primary;
  const image=value.imagePath?{image:origin+value.imagePath}:{};
  if(value.type==='Event')output.push({'@context':'https://schema.org','@type':'Event','@id':url+'#event',url,name:value.name,startDate:value.startDate,...(value.endDate?{endDate:value.endDate}:{}),...(value.description?{description:value.description}:{}),...image,...(value.location?{location:{'@type':'Place',name:value.location.name,...(value.location.address?{address:{'@type':'PostalAddress',...value.location.address}}:{})}}:{})});
  else output.push({'@context':'https://schema.org','@type':'BlogPosting','@id':url+'#article',mainEntityOfPage:url,headline:value.headline,...(value.datePublished?{datePublished:value.datePublished}:{}),...(value.dateModified?{dateModified:value.dateModified}:{}),...(value.inLanguage?{inLanguage:value.inLanguage}:{}),...image});
 }
 if(source.breadcrumbs?.length)output.push({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:source.breadcrumbs.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,item:origin+item.path}))});
 if(church)output.push({'@context':'https://schema.org','@type':'Church','@id':origin+'/#church',url:origin+'/',...church});
 return raw('<script type="application/ld+json">'+JSON.stringify(output).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026')+'</script>');
}
