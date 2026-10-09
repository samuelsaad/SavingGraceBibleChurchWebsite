/** Human-facing CMS field labels and supported module defaults. No raw JSON editor. */
export type CmsValue = string | number | boolean | null | CmsValue[] | { [key: string]: CmsValue };
export type CmsObject = { [key: string]: CmsValue };
export const moduleNames: Record<string, string> = {
  'home-arrival':'Welcome & service information', 'home-welcome':'Welcome & ministry links', 'home-about':'About & giving', 'home-sermons':'Latest sermons', 'home-events':'Upcoming gatherings',
  'blog-list':'Blog listing','sitemap-list':'Site map',paragraph:'Text', heading:'Section heading', list:'List', quote:'Quotation', figure:'Image', callout:'Highlighted text', panel:'Grouped content', tiles:'Linked cards', people:'People', timeline:'History timeline', 'next-event':'Next gathering', video:'YouTube video', playlist:'YouTube playlist', downloads:'Document downloads', hymns:'Hymns', index:'Page links', 'sermon-cards':'Sermon collection', 'external-plate':'External resource', book:'Book & description', 'contact-panel':'Contact information', 'giving-methods':'Giving methods', 'events-calendar':'Events calendar'
};
export const labels: Record<string,string> = {
 seo:'Search and sharing',socialTitle:'Sharing title',socialDescription:'Sharing description',image:'Sharing image',imageAlt:'Sharing image alternative text',noindex:'Exclude this page from search engines',
 blocks:'Content sections',sub:'Indent this link',home:'Home link accessibility label',addressLine1:'Street address',addressLine2:'Suburb and postcode',emailAddress:'Email destination',directions:'Directions link label',directionsHref:'Directions destination',morning:'Morning service time',evening:'Evening service time',morningLink:'Morning service link label',eveningLink:'Evening service link label',backToTop:'Back to top label',followUs:'Social links heading',
 headerAction:'Header giving link',archiveAbout:'About the sermon archive',footerExtraMenu:'Footer utility navigation',moreLabel:'Visitor link text',moreHref:'Visitor page',morningHref:'Morning service page',eveningHref:'Evening service page',upcomingHeading:'Upcoming events heading',regularHeading:'Regular gatherings heading',pastHeading:'Past events heading',subscribeLabel:'Calendar subscription label',showUpcoming:'Show upcoming events',showRegular:'Show regular gatherings',showPast:'Show past events',focalPoint:'Image focal point',x:'Horizontal position (%)',y:'Vertical position (%)',title:'Title',path:'Page address',heading:'Heading',description:'Search description',section:'Website section',parent:'Parent page',eyebrow:'Small introductory label',lede:'Introduction',hero:'Heading image',media:'Image',treatment:'Image layout',text:'Text',caption:'Caption',alt:'Alternative text',focalX:'Horizontal focal point (%)',focalY:'Vertical focal point (%)',columns:'Columns',level:'Heading size',ordered:'Numbered list',items:'Items',label:'Link label',href:'Destination',linkLabel:'Link label',name:'Name',role:'Role',email:'Email address',when:'Date or period',cite:'Attribution',event:'Gathering',videoId:'YouTube video',listId:'YouTube playlist',size:'Image size',intro:'Introduction',button:'Main link',methods:'Ways to give',bank:'Bank transfer',account:'Account name',lines:'Details',online:'Online giving',links:'Links',addressLines:'Address',telephone:'Telephone',map:'Map link',related:'Related pages',date:'Date',schedule:'Recurrence',kind:'Repeat',weekday:'Day of week',from:'Starts on',until:'Ends on',exclusions:'Excluded dates',start:'Start time',end:'End time',venue:'Venue',page:'Ministry page',address:'Street address',locality:'Suburb and postcode',phone:'Telephone',mapHref:'Map destination',primaryMenu:'Header navigation',footerMenu:'Footer navigation',navigationCopy:'Navigation labels',contactCopy:'Contact details',footerServicesCopy:'Footer service times',getInvolvedHeading:'Footer navigation heading',sermonFooterHeading:'Footer sermon heading',bottomBarCopy:'Footer bottom line',socialPlatforms:'Social links',notice:'Announcement banner',branding:'Church branding',logoAsset:'Header logo',footerLogoAsset:'Footer logo',faviconAsset:'Browser icon',touchIconAsset:'Home screen icon',logoAlt:'Logo alternative text',footerVisibility:'Visible footer sections',siteName:'Website name',enabled:'Visible',children:'Nested links',nameLine1:'Church name, first line',nameLine2:'Church name, second line',newHere:'Welcome label',serviceTime:'Service time',join:'Visit link label',joinHref:'Visit page',place:'Location label',services:'Services',paragraph:'Welcome text',pillars:'Ministry links',readMore:'Link label',learnMore:'About link label',learnMoreHref:'About page',giving:'Giving information',link:'Link label',quote:'Quotation',attribution:'Attribution',viewAll:'Archive link label',limit:'Number to show',order:'Sermon order',sermonIds:'Selected sermons',viewCalendar:'Calendar link label',viewCalendarHref:'Calendar page',days:'Days ahead',contact:'Contact details',navigation:'Navigation',recentSermon:'Recent sermon',social:'Social links',archiveLinks:'Sermon archive links',headingText:'Heading',body:'Content',url:'Destination',gatherings:'Gatherings',greeting:'Greeting',copyright:'Copyright',privacy:'Privacy link',allSermons:'All sermons',newHereHref:'Welcome page',welcome:'Welcome',service:'Service',joinUs:'Join us',telephoneLabel:'Telephone label',telephoneHref:'Telephone link',emailLabel:'Email label',addressLabel:'Address label',contactHeading:'Contact heading',getInvolved:'Get involved',time:'Time',type:'Type',main:'Main content',asideModules:'Side content',serviceLabel:'Service label'
};
const blankLink=()=>({label:'Read more',href:'/'});
export function newBlock(kind: string): CmsObject {
  const defaults: Record<string,CmsObject> = {
    paragraph:{kind,text:'Add your text here.',lede:false}, heading:{kind,level:2,text:'New section'},list:{kind,ordered:false,items:['First item']},quote:{kind,text:'Add a quotation.',cite:''},figure:{kind,media:'',caption:'',size:'full',alt:'',focalPoint:{x:50,y:50}},callout:{kind,title:'A note',text:'Add your text here.'},panel:{kind,title:'Section',blocks:[{kind:'paragraph',text:'Add your text here.'}]},tiles:{kind,columns:3,items:[{title:'New card',text:'Add a description.',href:'/',media:'',linkLabel:'Read more'}]},people:{kind,items:[{name:'Name',role:'Role',media:'',email:'',text:['Add a biography.']}]},timeline:{kind,items:[{when:'Date',title:'Milestone',text:'Add the story.'}]},'next-event':{kind,event:'',label:'Next gathering'},video:{kind,videoId:'',title:'Video'},playlist:{kind,listId:'',title:'Playlist'},downloads:{kind,items:[{title:'Document',text:'Document description.',href:'',label:'Download'}]},hymns:{kind,items:[{title:'Hymn',text:'Description',href:''}]},index:{kind,items:[{title:'Page',text:'Description',href:'/'}]},'sermon-cards':{kind,heading:'Sermons',text:'',linkLabel:'All sermons',limit:3,order:'DESC',sermonIds:[]},'external-plate':{kind,title:'Resource',text:'Description',href:'https://',label:'Visit website'},book:{kind,media:'',text:'Book description.'},'contact-panel':{kind,name:'Saving Grace Bible Church',addressLines:[''],telephone:{label:'',href:'tel:'},email:'',map:blankLink()},'giving-methods':{kind,heading:'Ways to make an offering',intro:'',button:blankLink(),methods:[{title:'Give',text:''}],bank:{title:'Bank transfer',account:'',lines:['']},online:{title:'Online giving',links:[blankLink()]}},'events-calendar':{kind,upcomingHeading:'Coming up',regularHeading:'Regular gatherings',pastHeading:'Past events',subscribeLabel:'Subscribe to calendar',days:120,limit:12,showUpcoming:true,showRegular:true,showPast:true},'blog-list':{kind,heading:'From the church',limit:12,order:'DESC'},'sitemap-list':{kind},
    'home-arrival':{kind,hero:{nameLine1:'Saving Grace',nameLine2:'Bible Church',newHere:'New here?',serviceTime:'',address:'',join:'Plan your visit',joinHref:'/contact/',place:''},media:'',services:{heading:'Gather with us',items:[{id:crypto.randomUUID(),enabled:true,title:'Service',text:'',href:'/'}]}},
    'home-welcome':{kind,heading:'Welcome',paragraph:'',pillars:[{id:crypto.randomUUID(),enabled:true,title:'Ministry',text:'',href:'/',readMore:'Read more'}],media:''},'home-about':{kind,heading:'About our church',paragraph:'',learnMore:'Learn more',learnMoreHref:'/about/',giving:{heading:'Giving',link:'Give',href:'/support-saving-grace-church-offering/',quote:'',attribution:'',enabled:true}},'home-sermons':{kind,heading:'Sermons',viewAll:'All sermons',limit:3,order:'DESC',sermonIds:[]},'home-events':{kind,heading:'Upcoming gatherings',viewCalendar:'View calendar',viewCalendarHref:'/events/',days:60,limit:3}
  };
  return structuredClone(defaults[kind] ?? defaults.paragraph!);
}
export function newModule(kind:string):CmsObject { return {id:crypto.randomUUID(),enabled:true,block:newBlock(kind)}; }
export function titleCase(value:string):string { return labels[value] ?? value.replace(/([A-Z])/g,' $1').replace(/[-_]/g,' ').replace(/^./,s=>s.toUpperCase()); }
/** Keep the browser's link feedback aligned with the authoritative server validator. */
export function safeHref(value:string):boolean {
 if(!value||/[\u0000-\u0020\u007f\\]/u.test(value)||value.startsWith('//'))return false;
 if(value.startsWith('/'))return !/%(?:2f|5c|00|0a|0d)/iu.test(value)&&!value.split(/[?#]/u)[0]!.split('/').includes('..');
 if(value.startsWith('#'))return /^#[A-Za-z][\w:.-]*$/u.test(value);
 if(/^mailto:/iu.test(value))return /^mailto:[^\s@?]+@[^\s@?]+(?:\?[^\r\n]*)?$/u.test(value);
 if(/^tel:/iu.test(value))return /^tel:\+?[0-9().-]+$/u.test(value);
 try{const parsed=new URL(value);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password;}catch{return false;}
}
export function escape(value:unknown):string { return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
export function markupHtml(value:string):string {
  return escape(value).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_all,label,href)=>safeHref(href)?`<a href="${href}">${label}</a>`:label).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;!?])/g,'$1<em>$2</em>').replaceAll('\n','<br>');
}
export function richTextValue(root:Node):string {
  return Array.from(root.childNodes).map(node=>{
    if(node.nodeType===Node.TEXT_NODE)return node.textContent??'';
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    const element=node as HTMLElement;
    if(element.tagName==='BR')return '\n';
    const content=richTextValue(node);
    if(element.tagName==='STRONG'||element.tagName==='B')return `**${content}**`;
    if(element.tagName==='EM'||element.tagName==='I')return `_${content}_`;
    if(element.tagName==='A'){const href=element.getAttribute('href')??'';return safeHref(href)?`[${content}](${href})`:content;}
    return ['DIV','P','LI'].includes(element.tagName)?content+'\n':content;
  }).join('');
}


export interface OptionalField { key:string; value:CmsValue; present:boolean }
const isObject=(value:CmsValue|undefined):value is CmsObject=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const valueAt=(content:CmsObject,path:string):CmsValue|undefined=>path?path.split('.').reduce<CmsValue|undefined>((value,key)=>isObject(value)||Array.isArray(value)?(value as CmsObject)[key]:undefined,content):content;
const menuPath=(path:string)=>/^(?:primaryMenu|footerMenu|footerExtraMenu)\.\d+(?:\.children\.\d+)*$/.test(path);

/** Describe controls without adding defaults to the loaded draft. Each change requires an explicit action. */
export function optionalFieldsFor(object:CmsObject,path:string,contentKind:string,content:CmsObject):OptionalField[] {
 const fields:CmsObject={};
 if(!path){
  if(['page','post','event','home'].includes(contentKind))fields.seo={};
  if(contentKind==='page')Object.assign(fields,{heading:String(object.title??'Page heading'),parent:'',eyebrow:'',lede:'',hero:{media:'',treatment:'banner',enabled:true},asideModules:[],related:[]});
  if(contentKind==='post')fields.media='';
  if(contentKind==='event')Object.assign(fields,{page:'',media:'',tag:''});
  if(contentKind==='venue')Object.assign(fields,{phone:'',href:'/',mapHref:'/'});
  if(contentKind==='settings')Object.assign(fields,{headerAction:{enabled:true,label:'Give',href:'/support-saving-grace-church-offering/'},archiveAbout:{enabled:true,heading:'About the sermon archive',text:''},footerExtraMenu:[]});
 }
 if(path==='seo')Object.assign(fields,{title:'',description:'',socialTitle:'',socialDescription:'',image:'',imageAlt:'',noindex:false,replaceSourceContent:false});
 if(path==='hero'&&contentKind==='page')Object.assign(fields,{enabled:true,alt:'',focalPoint:{x:50,y:50}});
 if(path==='schedule'&&['weekly','monthly-first'].includes(String(object.kind)))Object.assign(fields,{until:'',exclusions:[]});
 if(menuPath(path))Object.assign(fields,{children:[],enabled:true,sub:false});
 if(path==='footerServicesCopy')Object.assign(fields,{morningHref:'/lords-day-service/',eveningHref:'/evening-service/'});
 if(/\.hero$/.test(path)&&'nameLine1'in object)Object.assign(fields,{moreLabel:'Find out more',moreHref:'/about/'});
 const kind=String(object.kind??'');
 if(kind==='paragraph')fields.lede=false;
 if(kind==='list')fields.ordered=false;
 if(kind==='quote')fields.cite='';
 if(kind==='figure')Object.assign(fields,{caption:'',alt:'',focalPoint:{x:50,y:50},size:'full'});
 if(kind==='callout'||kind==='panel')fields.title='Section heading';
 if(kind==='tiles')fields.columns=3;
 if(kind==='panel')fields.columns=1;
 if(kind==='sermon-cards')Object.assign(fields,{text:'',limit:3,order:'DESC',sermonIds:[]});
 if(kind==='events-calendar')Object.assign(fields,{upcomingHeading:'Coming up',regularHeading:'Regular gatherings',pastHeading:'Past events',subscribeLabel:'Subscribe to calendar',days:120,limit:12,showUpcoming:true,showRegular:true,showPast:true});
 if(kind==='blog-list')Object.assign(fields,{heading:'From the church',limit:12,order:'DESC'});
 // Tile/person object contracts are distinguishable from menu and collection rows.
 const itemOwner=valueAt(content,path.replace(/\.items\.\d+$/,''));
 if(/\.items\.\d+$/.test(path)&&isObject(itemOwner)&&itemOwner.kind==='tiles')Object.assign(fields,{text:'',media:'',eyebrow:'',linkLabel:''});
 if(/\.items\.\d+$/.test(path)&&'name'in object&&'role'in object)Object.assign(fields,{media:'',email:''});
 if(object.kind==='giving-methods')fields.heading='Ways to make an offering';
 return Object.entries(fields).map(([key,value])=>({key,value:structuredClone(value),present:Object.hasOwn(object,key)}));
}

/** Stored compatibility labels remain intact; only the home accessibility label is used directly. */
export function shouldShowField(key:string,path:string):boolean {return path!=='navigationCopy'||key==='home';}

/** Restore the correct item shape even after an administrator removes every item in a collection. */
export function newArrayItem(content:CmsObject,path:string):CmsValue {
 const parts=path.split('.'),key=parts.at(-1)!,parent=valueAt(content,parts.slice(0,-1).join('.'));
 const owner=isObject(parent)?parent:{};
 if(['primaryMenu','footerMenu','footerExtraMenu','children'].includes(key))return {label:'New link',href:'/',enabled:true};
 if(key==='blocks')return newBlock('paragraph');
 if(key==='modules'||key==='asideModules')return newModule('paragraph');
 if(key==='pillars')return {id:crypto.randomUUID(),enabled:true,title:'Ministry',text:'',href:'/',readMore:'Read more'};
 if(key==='methods')return {title:'Giving method',text:''};
 if(key==='links')return blankLink();
 if(key==='exclusions')return String(owner.from??new Date().toISOString().slice(0,10));
 if(key==='socialPlatforms'){
  const existing=(valueAt(content,path)??[])as CmsObject[];
  const platform=[['facebook','Facebook'],['youtube','YouTube'],['instagram','Instagram'],['podcast','Podcast']].find(([id])=>!existing.some(item=>item.id===id));
  if(!platform)throw new Error('All supported social platforms have already been added.');
  return {id:platform[0]!,name:platform[1]!,href:null,enabled:false};
 }
 if(key==='items'){
  if(parts.at(-2)==='services')return {id:crypto.randomUUID(),enabled:true,title:'Service',text:'',href:'/'};
  if(owner.kind==='list')return '';
  const example=(newBlock(String(owner.kind)).items as CmsValue[]|undefined)?.[0];
  if(example!==undefined){const item=structuredClone(example);if(isObject(item)&&item.href==='')item.href='/';return item;}
 }
 // Remaining editable arrays contain text, dates, or page/sermon identifiers.
 return '';
}
