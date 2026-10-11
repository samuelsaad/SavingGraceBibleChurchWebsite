"""Church-authorized, bounded GET-only SEO baseline. All captured content stays private."""
from __future__ import annotations
import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET
import zipfile
from contextlib import contextmanager
import os

HOSTS = frozenset({'savinggrace.org.au', 'www.savinggrace.org.au'})
ORIGINS = ('https://www.savinggrace.org.au', 'https://savinggrace.org.au')
USER_AGENT = 'SavingGrace-SEO-Migration-Audit/1.0 (church-authorized read-only baseline)'
VERSION = 1
VOID = frozenset('area base br col embed hr img input link meta param source track wbr'.split())
DROP = frozenset('script style noscript template iframe object embed form input button textarea select option svg canvas nav header footer'.split())
SAFE_TAGS = frozenset('div span section article p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd blockquote strong em b i u s a img figure figcaption br hr table thead tbody tfoot tr th td time address abbr code pre sup sub'.split())
MEDIA_EXT = re.compile(r'\.(?:mp3|mp4|m4a|m4v|wav|ogg|webm|mov|avi|aac|flac|m3u8)(?:$|[?#])',re.I)
ASSET_EXT = re.compile(r'\.(?:jpe?g|png|webp|gif|avif|svg|ico|pdf|docx?|xlsx?|pptx?|zip|woff2?|ttf|css|js)(?:$|[?#])',re.I)
ADMIN = re.compile(r'^/(?:wp-admin|wp-login\.php|wp-json|xmlrpc\.php|wp-cron\.php|admin|frontend-preview|draft-preview)(?:/|$)',re.I)

def stamp(): return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
def digest(value): return hashlib.sha256(value if isinstance(value,bytes) else value.encode()).hexdigest()
def text(node):
    if isinstance(node,str): return node
    if node['tag'] in DROP: return ''
    return ' '.join(text(child) for child in node['children'])
def clean(value): return re.sub(r'\s+',' ',value).strip()
def nodes(node):
    if isinstance(node,dict):
        yield node
        for child in node['children']: yield from nodes(child)
def classes(node): return node['attrs'].get('class','').split()
def first(root,predicate): return next((node for node in nodes(root) if predicate(node)),None)

def address(raw,base):
    try:
        u=urlsplit(urljoin(base,html.unescape(raw.strip())))
        if u.scheme not in ('http','https') or not u.hostname or u.username or u.password: return None
        if u.port is not None and u.port != (443 if u.scheme=='https' else 80): return None
        if any(ord(c)<32 for c in raw): return None
        return urlunsplit((u.scheme,u.hostname.lower(),quote(u.path or '/',safe="/%:@!$&'()*+,;=-._~"),quote(u.query,safe="%/?@!$&'()*+,;=:-._~"),''))
    except (ValueError,TypeError): return None

def allowed(url):
    u=urlsplit(url)
    return u.hostname in HOSTS and u.scheme in ('http','https') and not u.username and not u.password and not u.port

class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root={'tag':'root','attrs':{},'children':[]}; self.stack=[self.root]
    def handle_starttag(self,tag,attrs):
        node={'tag':tag,'attrs':{k:v or '' for k,v in attrs},'children':[]}
        self.stack[-1]['children'].append(node)
        if tag not in VOID: self.stack.append(node)
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID: self.handle_endtag(tag)
    def handle_endtag(self,tag):
        for index in range(len(self.stack)-1,0,-1):
            if self.stack[index]['tag']==tag:
                del self.stack[index:]; break
    def handle_data(self,value): self.stack[-1]['children'].append(value)

def sanitize(node,base):
    if isinstance(node,str): return html.escape(node)
    tag=node['tag']
    if tag in DROP: return ''
    content=''.join(sanitize(child,base) for child in node['children'])
    if tag not in SAFE_TAGS: return content
    attrs=[]
    for key in ('href','src','alt','title','datetime','width','height','colspan','rowspan','lang','dir'):
        if key not in node['attrs']: continue
        value=node['attrs'][key]
        if key in ('href','src'):
            if key=='href' and value.startswith(('mailto:','tel:','#')): pass
            else:
                value=address(value,base)
                if value is None: continue
        elif key in ('width','height','colspan','rowspan') and not re.fullmatch(r'\d{1,5}',value): continue
        elif key=='dir' and value not in ('rtl','ltr','auto'): continue
        attrs.append(' '+key+'="'+html.escape(value,quote=True)+'"')
    return '<'+tag+''.join(attrs)+'>'+('' if tag in VOID else content+'</'+tag+'>')

TREE_TAGS = frozenset('p h2 h3 h4 h5 h6 ul ol li strong em b i a blockquote br hr figure figcaption img table thead tbody tr th td div span'.split())
def content_tree(node,base,heading,preformatted=False):
    if isinstance(node,str):
        value=node if preformatted else re.sub(r"\s+"," ",node)
        return [{'tag':'text','text':value}] if value else []
    tag=node['tag']; a=node['attrs']
    # This function is called only inside the selected primary content region.
    # Nested card headers, footers and navigation carry real titles/dates/links;
    # unwrap their containers rather than dropping all their descendants.
    if (tag in DROP and tag not in ('header','footer','nav')) or any(value in classes(node) for value in ('asp-related-sermons-holder','asp-sermon-navigation','post-siblings','tribe-related-events','tribe-events-related-events-title')): return []
    attrs={}
    if a.get('id') and len(a['id'])<=512 and not re.search(r'[\s\x00-\x1f\x7f]',a['id']):attrs['id']=a['id']
    if re.fullmatch(r'[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*',a.get('lang','')):attrs['lang']=a['lang']
    if a.get('dir') in ('ltr','rtl','auto'):attrs['dir']=a['dir']
    if a.get('title') and len(a['title'])<=4000:attrs['title']=a['title']
    if tag=='h1' and clean(text(node))==heading: return [{'tag':'span',**attrs}] if attrs else []
    children=[item for child in node['children'] for item in content_tree(child,base,heading,preformatted or tag=='pre')]
    if tag=='h1': tag='h2'
    if tag not in TREE_TAGS:return [{'tag':'div',**attrs,'children':children}] if attrs else children
    result={'tag':tag,**attrs}
    if tag=='a' and a.get('href'):
        target=address(a['href'],base)
        if target:
            fragment=urlsplit(urljoin(base,a['href'])).fragment
            result['href']=target+('#'+fragment if fragment and not any(ord(c)<32 for c in fragment) else '')
        elif a['href'].startswith(('mailto:','tel:','#')) and not any(ord(c)<32 for c in a['href']): result['href']=a['href']
    if tag=='img':
        target=address(a.get('src','') or a.get('data-src',''),base)
        if not target: return []
        result['src']=target; result['alt']=a.get('alt','')
        for key in ('width','height'):
            if re.fullmatch(r'\d{1,5}',a.get(key,'')) and 0<int(a[key])<=20000: result[key]=int(a[key])
    if tag in ('td','th'):
        for key,limit in [('colspan',1000),('rowspan',65534)]:
            if re.fullmatch(r'\d{1,5}',a.get(key,'')) and 0<int(a[key])<=limit:result[key]=int(a[key])
    if children: result['children']=children
    return [result]

def schema_values(schema,key):
    found=[]
    def visit(value):
        if isinstance(value,list):
            for item in value: visit(item)
        elif isinstance(value,dict):
            if isinstance(value.get(key),str): found.append(value[key])
            for item in value.values():
                if isinstance(item,(dict,list)): visit(item)
    visit(schema)
    return list(dict.fromkeys(found))

def extract(source,url):
    parser=Tree(); parser.feed(source); root=parser.root; allnodes=list(nodes(root))
    primary_region=first(root,lambda n:'sermon-container_inner' in classes(n))
    primary_node_ids={id(n) for n in nodes(primary_region)} if primary_region else set()
    meta={}; links=[]; images=[]; resources=[]; media=[]; schema=[]; headings=[]; dates=[]
    for node in allnodes:
        tag,a=node['tag'],node['attrs']
        if tag=='meta':
            key=a.get('name') or a.get('property') or a.get('http-equiv')
            if key: meta.setdefault(key.lower(),[]).append(a.get('content',''))
        if tag=='link' and a.get('href'):
            resources.append({'tag':'link','rel':a.get('rel',''),'url':address(a['href'],url),'type':a.get('type',''),'hreflang':a.get('hreflang','')})
        if tag=='script' and a.get('src'): resources.append({'tag':'script','url':address(a['src'],url)})
        if tag=='script' and a.get('type','').lower()=='application/ld+json':
            raw=''.join(child for child in node['children'] if isinstance(child,str))
            try: schema.append(json.loads(raw))
            except ValueError: schema.append({'parseError':True,'sha256':digest(raw)})
        if tag=='a' and a.get('href'):
            target=address(a['href'],url)
            links.append({'href':target or a['href'],'text':clean(text(node)),'rel':a.get('rel','')})
            if target and (MEDIA_EXT.search(target) or any(x in urlsplit(target).hostname.lower() for x in ('youtube','youtu.be','sermonaudio','vimeo'))): media.append({'tag':'a','url':target,'scope':'primary_sermon' if id(node) in primary_node_ids else 'page'})
        if tag=='img':
            images.append({'url':address(a.get('src',''),url) if a.get('src') else None,'alt':a.get('alt'),'width':a.get('width'),'height':a.get('height'),'srcset':a.get('srcset'),'lazyUrl':address(a.get('data-src',''),url) if a.get('data-src') else None})
        if tag in ('iframe','audio','video','source'):
            if a.get('src'): media.append({'tag':tag,'url':address(a['src'],url),'type':a.get('type'),'scope':'primary_sermon' if id(node) in primary_node_ids else 'page'})
            if a.get('poster'): resources.append({'tag':'poster','url':address(a['poster'],url)})
        if re.fullmatch('h[1-6]',tag): headings.append({'level':int(tag[1]),'text':clean(text(node))})
        if tag=='time': dates.append({'datetime':a.get('datetime'),'text':clean(text(node))})
        for candidate in re.findall(r'url\([\s\'"]*([^\)\'"\s]+)',a.get('style','')):
            resources.append({'tag':'inline-style-image','url':address(candidate,url)})
    body=first(root,lambda n:n['tag']=='body')
    bodyclasses=classes(body) if body else []
    is_sermon='single-sermons' in bodyclasses
    region_choices={
        'sermon-main-content':lambda n:'sermon-main-content' in classes(n),
        'tribe-events-single-event-description':lambda n:'tribe-events-single-event-description' in classes(n),
        'entry-content':lambda n:'entry-content' in classes(n),
        'post-content':lambda n:'post-content' in classes(n),
        'page-content':lambda n:'page-content' in classes(n),
        'main':lambda n:n['tag']=='main',
        'main-content':lambda n:n['attrs'].get('id')=='main-content'}
    if is_sermon: labels=('sermon-main-content',)
    elif 'single-tribe_events' in bodyclasses: labels=('tribe-events-single-event-description','entry-content','page-content','main-content','main')
    elif 'single-post' in bodyclasses: labels=('entry-content','post-content','page-content','main-content','main')
    elif 'page' in bodyclasses: labels=('page-content','entry-content','main-content','main','post-content')
    else: labels=('main-content','main','page-content','entry-content','post-content')
    choices=[(label,region_choices[label]) for label in labels]
    main=None; selector=None
    for label,predicate in choices:
        main=first(root,predicate)
        if main is not None: selector=label; break
    main_html=''.join(sanitize(child,url) for child in main['children']) if main else ''
    main_text=clean(text(main)) if main else ''
    semantic=[{'tag':n['tag'],'text':clean(text(n))} for n in nodes(main) if n['tag'] in ('p','h1','h2','h3','h4','h5','h6','li','blockquote','figcaption') and clean(text(n))] if main else []
    postid=next((int(m.group(1)) for c in bodyclasses if (m:=re.fullmatch(r'(?:postid|page-id)-(\d+)',c))),None)
    if postid is None and 'single' in bodyclasses and 'archive' not in bodyclasses:
        article=first(root,lambda n:n['tag']=='article' and re.fullmatch(r'post-\d+',n['attrs'].get('id','')) is not None)
        if article: postid=int(article['attrs']['id'][5:])
    taxonomies=[]
    if is_sermon:
        for cls in ('sermon-series','sermon-topic','sermon-book','details-sermon-speaker','sermon-header-details'):
            node=first(root,lambda n:cls in classes(n))
            if node:
                taxonomies.append({'sourceClass':cls,'text':clean(text(node)),'links':[{'href':address(n['attrs']['href'],url),'text':clean(text(n))} for n in nodes(node) if n['tag']=='a' and n['attrs'].get('href')]})
    service_node=first(root,lambda n:'sermon-header-details' in classes(n)) if is_sermon else None
    service_candidates=list(dict.fromkeys(re.findall(r'\b(\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December),? \d{4})\b',clean(text(service_node)) if service_node else '')))
    service_date=None
    if len(service_candidates)==1:
        try: service_date=datetime.strptime(service_candidates[0].replace(',',''),'%d %B %Y').date().isoformat()
        except ValueError: pass
    canonicals=[x['url'] for x in resources if x.get('rel','').lower()=='canonical']
    title=first(root,lambda n:n['tag']=='title')
    primary_heading=next((item['text'] for item in headings if item['level']==1 and item['text']),None)
    html_node=first(root,lambda n:n['tag']=='html')
    published=meta.get('article:published_time',[]) or schema_values(schema,'datePublished')
    modified=meta.get('article:modified_time',[]) or schema_values(schema,'dateModified')
    tree=[item for child in main['children'] for item in content_tree(child,url,primary_heading)] if main else []
    event_regions=[]
    if 'single-tribe_events' in bodyclasses:
        for label in ('wpv-single-event-schedule','tribe-events-event-meta','wpv-tribe-events-meta'):
            region=first(root,lambda n:label in classes(n))
            if region is not None and not any(any(node is region for node in nodes(existing)) for _,existing in event_regions): event_regions.append((label,region))
    event_meta_in_main=bool(event_regions and main and all(any(node is region for node in nodes(main)) for _,region in event_regions))
    event_tree=[item for _,region in event_regions if not main or not any(node is region for node in nodes(main)) for item in content_tree(region,url,primary_heading)]
    return {'title':clean(text(title)) if title else '', 'meta':meta,'canonicalUrls':canonicals,
        'robots':meta.get('robots',[]),'headings':headings,'schema':schema,'dates':dates,'images':images,
        'links':links,'resources':resources,'mediaReferences':media,
        'primaryMediaReferences':[item for item in media if item['scope']=='primary_sermon'],
        'serviceDate':service_date,'serviceDateText':service_candidates[0] if len(service_candidates)==1 else None,
        'measurementSignals':{'scriptUrls':[item['url'] for item in resources if item['tag']=='script'],
            'googleTagManagerIds':sorted(set(re.findall(r'\bGTM-[A-Z0-9]+\b',source))),
            'googleAnalyticsIds':sorted(set(re.findall(r'\b(?:G-[A-Z0-9]{6,}|UA-\d+-\d+)\b',source))),
            'verificationMetaNames':[key for key in meta if 'verification' in key or key in ('msvalidate.01','p:domain_verify')]},
        'bodyClasses':bodyclasses,'sourcePostId':postid,
        'template':'sermon' if is_sermon else 'event' if 'single-tribe_events' in bodyclasses else 'page' if 'page' in bodyclasses else 'post' if 'single-post' in bodyclasses else 'archive',
        'mainSelector':selector,'mainFound':main is not None,'mainHtml':main_html,'mainText':main_text,
        'contentTree':tree,'eventMetadataTree':event_tree,'eventMetadataSelector':','.join(label for label,_ in event_regions) or None,'eventMetadataIncludedInMain':event_meta_in_main,'eventMetadataTextSha256':digest(' '.join(clean(text(region)) for _,region in event_regions)) if event_regions else None,'language':html_node['attrs'].get('lang') if html_node else None,'primaryHeading':primary_heading,
        'publishedAt':published[0] if published else None,'modifiedAt':modified[0] if modified else None,
        'mainTextSha256':digest(main_text),'semanticBlocks':semantic,'taxonomyRelationships':taxonomies,
        'extractionWarning':None if main is not None else 'main_content_region_not_identified',
        'extractionVersion':4}

def xml_metadata(content,url):
    tree=ET.fromstring(content);root=tree.tag.split('}')[-1]
    result={'sitemapUrls':[clean(n.text or '') for n in tree.iter() if n.tag.split('}')[-1]=='loc'],'xmlRoot':root}
    if root in ('rss','feed'):
        links=[]
        for node in tree.iter():
            name=node.tag.split('}')[-1]
            if name=='link': raw=node.attrib.get('href') or clean(node.text or '');kind='feed_relation' if node.attrib.get('rel') in ('self','next','previous') else 'feed_item'
            elif name=='guid' and node.attrib.get('isPermaLink','true')!='false': raw=clean(node.text or '');kind='feed_guid'
            else: continue
            target=address(raw,url) if raw else None
            if target and {'url':target,'kind':kind} not in links: links.append({'url':target,'kind':kind})
        result['feedUrls']=links
    return result


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

def save(path,value):
    temp=path.with_suffix(path.suffix+'.tmp'); temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    for attempt in range(10):
        try: temp.replace(path);return
        except PermissionError:
            if attempt==9: raise
            time.sleep(0.1*(attempt+1))

@contextmanager
def network_lease(output):
    """An OS lock prevents HTML/assets workers sharing an output from overlapping."""
    output=output.resolve()
    if 'private' not in output.parts: raise ValueError('capture_output_must_be_private')
    output.mkdir(parents=True,exist_ok=True)
    with (output/'network-worker.lock').open('a+b') as stream:
        stream.seek(0,2)
        if stream.tell()==0: stream.write(b'0');stream.flush()
        stream.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError as failure: raise ValueError('capture_network_worker_already_running') from failure
        try: yield
        finally:
            stream.seek(0)
            if os.name=='nt': msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else: fcntl.flock(stream.fileno(),fcntl.LOCK_UN)


def expansion_policy(record):
    """Retain every observed link, but aliases must not recursively enlarge the crawl."""
    url=record['url']; parsed=urlsplit(url)
    if parsed.hostname!='www.savinggrace.org.au': return 'duplicate_host_no_recursive_expansion'
    canonicals=list(dict.fromkeys(value for value in record.get('canonicalUrls',[]) if value))
    if canonicals and canonicals!=[url]: return 'noncanonical_no_recursive_expansion'
    if parsed.path.startswith('/events/') or (parsed.path=='/' and dict(parse_qsl(parsed.query)).get('post_type')=='tribe_events'):
        return 'generated_calendar_no_recursive_expansion'
    return None


def generated_calendar(url):
    parsed=urlsplit(url); query=dict(parse_qsl(parsed.query)); path=parsed.path
    return ((path.startswith('/events/') and (path not in ('/events/','/events/list/','/events/month/','/events/today/') or bool(query)))
        or bool(re.search(r'^/event/.+/\d{4}-\d{2}-\d{2}/?$',path))
        or any(key in query for key in ('tribe-bar-date','eventDisplay','related_series','shortcode','ical','outlook-ical'))
        or query.get('post_type')=='tribe_events')


class Capture:
    def __init__(self,output,max_urls,delay,retries):
        self.output=output.resolve(); self.output.mkdir(parents=True,exist_ok=True)
        if 'private' not in self.output.parts: raise ValueError('capture_output_must_be_private')
        self.pages=self.output/'pages'; self.pages.mkdir(exist_ok=True)
        self.responses=self.output/'responses'; self.responses.mkdir(exist_ok=True)
        self.state_path=self.output/'ledger.private.json'
        self.state=json.loads(self.state_path.read_text(encoding='utf-8')) if self.state_path.exists() else {'schemaVersion':VERSION,'tool':'scripts/seo-source-capture.py','startedAt':stamp(),'allowedOrigins':list(ORIGINS),'pages':{},'discovered':{},'assets':{},'excluded':{},'limitations':['http_html_capture_no_javascript_execution','no_authenticated_account_reports','no_wordpress_table_reads','asset_references_inventoried_not_downloaded']}
        self.state.setdefault('deferred',{})
        self.source_expansion={}
        self.max_urls=max_urls; self.delay=max(1,delay); self.retries=min(2,max(0,retries)); self.last=0.; self.opener=build_opener(NoRedirect); self.robots={}
    def enqueue(self,url,kind,referrer=None):
        target=address(url,referrer or ORIGINS[0]+'/')
        if not target or not allowed(target): return
        provenance={'kind':kind,'from':referrer}
        item=self.state['discovered'].setdefault(target,{'sources':[]})
        if provenance not in item['sources']: item['sources'].append(provenance)
        if MEDIA_EXT.search(target): self.state['excluded'][target]='recording_not_requested'
        elif ASSET_EXT.search(target) or kind in ('image','asset_resource'): self.state['assets'].setdefault(target,{'sources':[]})['sources'].append(provenance); self.state['excluded'][target]='asset_reference_only'
        elif ADMIN.search(urlsplit(target).path): self.state['excluded'][target]='administrative_endpoint'
        elif any(key.lower() in ('replytocom','add-to-cart','doing_wp_cron','_wpnonce','action','preview') for key,_ in parse_qsl(urlsplit(target).query)):
            self.state['excluded'][target]='stateful_or_unbounded_parameter'
    def defer_reason(self,url):
        sources=self.state['discovered'][url]['sources']; parsed=urlsplit(url)
        protected=any(source['kind'] in ('sitemap','robots_sitemap','control','retained_inventory','retained_wordpress_export','tracked_content_reference','feed_item') or source['kind'].startswith('retained_') for source in sources)
        if generated_calendar(url) and not protected: return 'generated_calendar_navigation_or_export_unverified'
        if parsed.hostname!='www.savinggrace.org.au' and not any(source['kind'] in ('control','robots_sitemap') for source in sources) and not parsed.path.endswith('.xml'):
            return 'duplicate_host_alias_unverified'
        if not protected and sources and all(source['kind']=='feed_relation' for source in sources) and (parsed.query or parsed.path not in ('/feed/','/comments/feed/','/sermons/feed/','/events/feed/')):
            return 'source_declared_feed_variant_unverified'
        if set(dict(parse_qsl(parsed.query)))=={'p'} and all(source['kind'] in ('resource','link_relation','feed_guid') for source in sources):
            return 'source_declared_shortlink_unverified'
        if not protected and sources and all(self.source_expansion.get(source.get('from')) and source['kind'] not in ('canonical','redirect') for source in sources):
            return 'observed_only_on_nonexpanding_response_unverified'
        return None
    def pending(self):
        pending=[];deferred={}
        for url in self.state['discovered']:
            if url in self.state['pages'] or url in self.state['excluded']: continue
            reason=self.defer_reason(url)
            if reason: deferred[url]={'reason':reason}
            else: pending.append(url)
        self.state['deferred']=deferred
        return pending
    def get(self,url):
        if not allowed(url): raise ValueError('source_origin_not_allowed')
        for attempt in range(self.retries+1):
            time.sleep(max(0,self.delay-(time.monotonic()-self.last))); self.last=time.monotonic()
            started=time.monotonic(); response=None
            try:
                try: response=self.opener.open(Request(url,headers={'User-Agent':USER_AGENT,'Accept':'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.8','Accept-Encoding':'identity'}),timeout=25)
                except HTTPError as failure: response=failure
                status=response.status; headers={key.lower():value for key,value in response.headers.items() if key.lower() in ('content-type','location','x-robots-tag','last-modified','etag','cache-control','content-length','link','retry-after')}
                content_type=headers.get('content-type','').split(';')[0].strip().lower()
                allowed_type=not content_type or any(t in content_type for t in ('html','xml','text/plain'))
                body=response.read(4_000_001) if allowed_type else b''
                result={'url':url,'status':status,'headers':headers,'capturedAt':stamp(),'attempts':attempt+1,'elapsedMs':round((time.monotonic()-started)*1000),'bodyBytes':len(body),'bodySha256':digest(body),'bodyLimitExceeded':len(body)>4_000_000,'unsupportedContentType':not allowed_type}
                if status in (429,502,503,504) and attempt<self.retries:
                    pause=headers.get('retry-after',''); time.sleep(min(120,max(2,int(pause))) if pause.isdigit() else 3*(attempt+1)); continue
                return result,body
            except (URLError,TimeoutError,OSError):
                if attempt==self.retries: return {'url':url,'status':None,'capturedAt':stamp(),'attempts':attempt+1,'error':'request_failed'},b''
            finally:
                if response is not None: response.close()
        raise RuntimeError('unreachable')
    def capture(self,url):
        key=digest(url); metadata,body=self.get(url)
        body_path=self.responses/(key+'.body')
        if body and body_path.exists() and digest(body_path.read_bytes())!=digest(body): body_path=self.responses/(key[:12]+'-'+digest(body)[:32]+'.body')
        if body and body_path.exists() and digest(body_path.read_bytes())!=digest(body): raise ValueError('response_capture_filename_collision')
        if body and not body_path.exists(): body_path.write_bytes(body)
        metadata['responsePath']=str(body_path.relative_to(self.output)) if body else None
        metadata['discoverySources']=self.state['discovered'].get(url,{}).get('sources',[])
        if not metadata.get('bodyLimitExceeded') and body:
            content=body.decode('utf-8','replace'); content_type=metadata['headers'].get('content-type','')
            if 'html' in content_type or content.lstrip().lower().startswith(('<!doctype html','<html')):
                metadata.update(extract(content,url))
                metadata['discoveryExpansionPolicy']=expansion_policy(metadata)
                self.source_expansion[url]=metadata['discoveryExpansionPolicy']
                for link in metadata['links']: self.enqueue(link['href'],'link',url)
                for resource in metadata['resources']:
                    if resource.get('url') and resource.get('rel')=='alternate' and resource.get('type') in ('application/rss+xml','application/atom+xml'):
                        self.enqueue(resource['url'],'feed_relation',url)
                    if resource.get('url') and resource.get('rel') not in ('canonical','alternate'):
                        asset=resource['tag'] in ('script','poster','inline-style-image') or any(value in resource.get('rel','').lower().split() for value in ('stylesheet','icon','preload','prefetch','dns-prefetch','preconnect'))
                        self.enqueue(resource['url'],'asset_resource' if asset else 'link_relation',url)
                for image in metadata['images']:
                    if image.get('url'): self.enqueue(image['url'],'image',url)
                for canonical in metadata['canonicalUrls']:
                    if canonical: self.enqueue(canonical,'canonical',url)
            elif 'xml' in content_type or content.lstrip().startswith('<?xml'):
                try:
                    metadata.update(xml_metadata(content,url))
                    for target in metadata['sitemapUrls']: self.enqueue(target,'sitemap',url)
                    for target in metadata.get('feedUrls',[]): self.enqueue(target['url'],target['kind'],url)
                except ET.ParseError: metadata['xmlParseError']=True
        if metadata.get('headers',{}).get('location'):
            metadata['redirectTarget']=address(metadata['headers']['location'],url)
            if metadata['redirectTarget']: self.enqueue(metadata['redirectTarget'],'redirect',url)
        page_path=self.pages/(key+'.json'); save(page_path,metadata)
        self.state['pages'][url]={'status':metadata.get('status'),'recordPath':str(page_path.relative_to(self.output)),'bodySha256':metadata.get('bodySha256'),'template':metadata.get('template'),'sourcePostId':metadata.get('sourcePostId'),'capturedAt':metadata['capturedAt']}
        return metadata,body
    def checkpoint(self,done=False):
        pending=self.pending()
        self.state.update({'paused':False,'updatedAt':stamp(),'maxUrls':self.max_urls,'requestIntervalSeconds':self.delay,'maxRetries':self.retries,'pendingUrls':pending,'completed':done and not pending and not self.state['deferred'],'htmlPhaseComplete':done and not pending,'htmlPhaseFrozen':done,'discoveryPolicyVersion':2,'capReached':len(self.state['pages'])>=self.max_urls and bool(pending)})
        save(self.state_path,self.state)
    def run(self,seeds):
        # Earlier snapshots may have classified extensionless combined styles/scripts as pages.
        # Their actual HTML resource relation is retained, so inventory them as assets on resume.
        for summary in list(self.state['pages'].values()):
            previous=json.loads((self.output/summary['recordPath']).read_text(encoding='utf-8'))
            self.source_expansion[previous['url']]=expansion_policy(previous) if 'mainFound' in previous else None
            if previous.get('xmlRoot') in ('rss','feed') and previous.get('responsePath'):
                raw=(self.output/previous['responsePath']).read_bytes()
                if digest(raw)!=previous['bodySha256']: raise ValueError('captured_feed_hash_mismatch')
                previous.update(xml_metadata(raw.decode('utf-8','replace'),previous['url']));save(self.output/summary['recordPath'],previous)
                for target in previous.get('feedUrls',[]): self.enqueue(target['url'],target['kind'],previous['url'])
            for resource in previous.get('resources',[]):
                if resource.get('url') and resource.get('rel')=='alternate' and resource.get('type') in ('application/rss+xml','application/atom+xml'):
                    self.enqueue(resource['url'],'feed_relation',previous['url'])
                asset=resource['tag'] in ('script','poster','inline-style-image') or any(value in resource.get('rel','').lower().split() for value in ('stylesheet','icon','preload','prefetch','dns-prefetch','preconnect'))
                if asset and resource.get('url'): self.enqueue(resource['url'],'asset_resource',previous['url'])
        self.state['discoveryPolicy']={'version':2,'primaryHost':'www.savinggrace.org.au','noncanonicalResponses':'retain_all_observed_urls_without_recursive_expansion','generatedCalendar':'sitemap_authored_events_and_root_list_month_today_representatives;_navigation_date_instances_and_export_variants_deferred','duplicateHost':'controls_and_sitemaps_only;other_observed_urls_retained_unverified','shortlinks':'source_declared_aliases_retained_unverified','coverageClaim':'finite_phase_only_not_complete_source_coverage'}
        for limitation in ('generated_calendar_query_space_not_exhausted','duplicate_host_aliases_not_all_verified','source_declared_shortlinks_not_all_verified','secondary_feed_variants_not_all_verified'):
            if limitation not in self.state['limitations']: self.state['limitations'].append(limitation)
        for origin in ORIGINS:
            self.enqueue(origin+'/robots.txt','control'); self.enqueue(origin+'/','control'); self.enqueue(origin+'/sitemap.xml','control')
        for value in seeds: self.enqueue(value['url'],value.get('kind','retained_inventory'),value.get('from'))
        for origin in ORIGINS:
            url=origin+'/robots.txt'
            if url in self.state['pages']:
                record=json.loads((self.output/self.state['pages'][url]['recordPath']).read_text(encoding='utf-8'))
                body=(self.output/record['responsePath']).read_bytes() if record.get('responsePath') else b''
            else: record,body=self.capture(url)
            rules=RobotFileParser(); rules.set_url(url)
            if record.get('status')==200:
                rules.parse(body.decode('utf-8','replace').splitlines())
                for sitemap in rules.site_maps() or []: self.enqueue(sitemap,'robots_sitemap',url)
                self.delay=max(self.delay,rules.crawl_delay(USER_AGENT) or rules.crawl_delay('*') or 1)
            elif record.get('status') in (401,403): rules.disallow_all=True
            elif record.get('status') is None or record.get('status',0)>=500:
                raise RuntimeError('robots_unavailable_capture_stopped')
            else: rules.allow_all=True
            self.robots[origin]=rules; self.checkpoint()
        while len(self.state['pages'])<self.max_urls:
            pending=self.pending()
            if not pending: break
            # Sitemap documents precede large HTML sets, to surface coverage early.
            def priority(value):
                u=urlsplit(value)
                if 'sitemap' in u.path and u.path.endswith('.xml'): return 0
                if u.hostname=='www.savinggrace.org.au' and not u.query: return 1
                if u.hostname=='www.savinggrace.org.au' and any(item['kind']=='canonical' for item in self.state['discovered'][value]['sources']): return 2
                if u.hostname=='www.savinggrace.org.au' and any(k.startswith('sermon_') for k,v in parse_qsl(u.query)): return 3
                if not u.query: return 4
                return 5
            url=min(pending,key=priority)
            origin=urlsplit(url).scheme+'://'+urlsplit(url).netloc
            rules=self.robots.get(origin)
            if rules and not rules.can_fetch(USER_AGENT,url): self.state['excluded'][url]='robots_disallow'; continue
            self.capture(url); self.checkpoint()
            if len(self.state['pages'])%25==0:
                print(json.dumps({'captured':len(self.state['pages']),'discovered':len(self.state['discovered']),'assets':len(self.state['assets']),'pending':len(self.state['pendingUrls'])}),flush=True)
        self.checkpoint(done=True)
        print(json.dumps({'captured':len(self.state['pages']),'discovered':len(self.state['discovered']),'assets':len(self.state['assets']),'pending':len(self.state['pendingUrls']),'completed':self.state['completed'],'capReached':self.state['capReached']}),flush=True)

DOCUMENT_EXT = frozenset(('.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.odt','.rtf','.txt'))
IMAGE_EXT = frozenset(('.jpg','.jpeg','.png','.gif','.webp','.avif','.svg','.ico'))

def asset_kind(url):
    suffix=Path(urlsplit(url).path).suffix.lower()
    return 'image' if suffix in IMAGE_EXT else 'document' if suffix in DOCUMENT_EXT else None

def church_original_image(url):
    """Jetpack embeds the explicit source host/path; transformed bytes remain unverified."""
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname!='i0.wp.com' or parsed.username or parsed.password: return None
    parts=parsed.path.lstrip('/').split('/',1)
    if len(parts)!=2 or parts[0] not in HOSTS or not parts[1].startswith('wp-content/uploads/'): return None
    original=address('https://'+parts[0]+'/'+parts[1],ORIGINS[0])
    return original if original and allowed(original) and asset_kind(original)=='image' else None


def inspect_asset_magic(path,mime):
    with path.open('rb') as stream: head=stream.read(8192)
    mime=mime.split(';')[0].strip().lower()
    expected=None
    if head.startswith(b'\xff\xd8\xff'): expected='image/jpeg'
    elif head.startswith(b'\x89PNG\r\n\x1a\n'): expected='image/png'
    elif head.startswith((b'GIF87a',b'GIF89a')): expected='image/gif'
    elif head.startswith(b'RIFF') and head[8:12]==b'WEBP': expected='image/webp'
    elif b'ftypavif' in head[:32] or b'ftypavis' in head[:32]: expected='image/avif'
    elif head.startswith(b'\x00\x00\x01\x00'): expected='image/x-icon'
    elif head.startswith(b'%PDF-'): expected='application/pdf'
    elif head.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'): expected='application/x-ole-document'
    elif head.startswith(b'PK\x03\x04'):
        required={'.docx':'word/document.xml','.xlsx':'xl/workbook.xml','.pptx':'ppt/presentation.xml','.odt':'content.xml'}.get(path.suffix.lower())
        try:
            with zipfile.ZipFile(path) as package:
                names=package.namelist()
                if required is None or required not in names or len(names)>10000: return {'valid':False,'reason':'document_package_structure_invalid'}
                if any(name.lower().endswith('vbaproject.bin') for name in names): return {'valid':False,'reason':'macro_document_requires_review'}
        except zipfile.BadZipFile: return {'valid':False,'reason':'document_package_invalid'}
        expected='application/zip-document'
    elif head.lstrip().startswith(b'{\\rtf'): expected='application/rtf'
    elif b'<svg' in head.lower():
        body=path.read_bytes().lower()
        if any(marker in body for marker in (b'<script',b'javascript:',b'<!entity',b'<foreignobject')) or re.search(rb'\bon[a-z]+\s*=',body): return {'valid':False,'reason':'active_svg_requires_review'}
        expected='image/svg+xml'
    elif mime=='text/plain' and b'\0' not in head: expected='text/plain'
    if expected is None: return {'valid':False,'reason':'unrecognized_asset_magic'}
    aliases={'image/jpeg':{'image/jpeg','image/jpg'},'image/x-icon':{'image/x-icon','image/vnd.microsoft.icon'},
        'application/x-ole-document':{'application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'},
        'application/zip-document':{'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.text'},
        'application/rtf':{'application/rtf','text/rtf'}}
    if mime not in aliases.get(expected,{expected}): return {'valid':False,'reason':'mime_magic_mismatch','detectedType':expected}
    return {'valid':True,'detectedType':expected}

def capture_assets(output,max_bytes=50_000_000):
    output=output.resolve()
    if 'private' not in output.parts: raise ValueError('capture_output_must_be_private')
    source_path=output/'ledger.private.json'; source=json.loads(source_path.read_text(encoding='utf-8'))
    if not source.get('htmlPhaseFrozen'):
        raise ValueError('asset_phase_requires_stopped_html_capture')
    asset_path=output/'assets-capture.private.json'; files=output/'asset-responses';files.mkdir(exist_ok=True)
    result=json.loads(asset_path.read_text(encoding='utf-8')) if asset_path.exists() else {'format':'sgbc-source-assets-v1','startedAt':stamp(),'assets':{},'remainingDependencies':{},'excludedResources':{},'sourceLedgerSha256':digest(source_path.read_bytes())}
    candidates={}
    for summary in source['pages'].values():
        record=json.loads((output/summary['recordPath']).read_text(encoding='utf-8'))
        if record.get('status')!=200: continue
        if record.get('xmlRoot') in ('rss','feed') and record.get('responsePath') and not record.get('bodyLimitExceeded'):
            raw=(output/record['responsePath']).read_bytes()
            if digest(raw)!=record['bodySha256']: raise ValueError('captured_feed_hash_mismatch')
            mime='application/rss+xml' if record['xmlRoot']=='rss' else 'application/atom+xml'
            result['assets'][record['url']]={'url':record['url'],'status':200,'mime':mime,'sourceMime':record.get('headers',{}).get('content-type',''),'capturedAt':record['capturedAt'],'attempts':record['attempts'],'sourcePages':sorted(set(item.get('from') for item in record.get('discoverySources',[]) if item.get('from'))),'byteCount':len(raw),'sha256':digest(raw),'relativePath':record['responsePath'],'kind':'feed','origin':'captured_http_response_bytes','validation':{'valid':True,'detectedType':mime}}
        if record.get('headers',{}).get('content-type','').split(';')[0].lower()=='text/calendar' and record.get('responsePath') and not record.get('bodyLimitExceeded'):
            raw=(output/record['responsePath']).read_bytes()
            valid=raw.lstrip().startswith(b'BEGIN:VCALENDAR') and b'END:VCALENDAR' in raw and b'\0' not in raw
            if digest(raw)!=record['bodySha256']:raise ValueError('captured_calendar_hash_mismatch')
            result['assets'][record['url']]={'url':record['url'],'status':200,'mime':'text/calendar','capturedAt':record['capturedAt'],'attempts':record['attempts'],'sourcePages':[],'byteCount':len(raw),'sha256':digest(raw),'relativePath':record['responsePath'],'kind':'calendar','origin':'captured_http_response_bytes','validation':{'valid':valid,'detectedType':'text/calendar'}}
        refs=[v.get('url') for v in record.get('images',[])]+[v.get('lazyUrl') for v in record.get('images',[])]+[v.get('url') for v in record.get('resources',[]) if v.get('tag') in ('inline-style-image','poster')]
        refs += [v.get('url') for v in record.get('resources',[]) if v.get('tag')=='link' and any('icon' in token for token in v.get('rel','').lower().split())]
        for key in ('og:image','og:image:url','og:image:secure_url','twitter:image','twitter:image:src'):
            refs += [address(value,record['url']) for value in record.get('meta',{}).get(key,[])]
        for key in ('image','thumbnailUrl','logo','contentUrl'):
            refs += [address(value,record['url']) for value in schema_values(record.get('schema',[]),key) if asset_kind(address(value,record['url']) or '')=='image']
        for image in record.get('images',[]):
            for candidate in (image.get('srcset') or '').split(','):
                value=candidate.strip().split()
                if value:
                    target=address(value[0],record['url'])
                    if target: refs.append(target)
        refs += [v['href'] for v in record.get('links',[]) if Path(urlsplit(v['href']).path).suffix.lower() in DOCUMENT_EXT]
        for url in refs:
            if url: candidates.setdefault(url,set()).add(record['url'])
    result.setdefault('sourceDerivedOriginals',{})
    for url,referrers in list(candidates.items()):
        original=church_original_image(url)
        if original:
            candidates.setdefault(original,set()).update(referrers)
            result['sourceDerivedOriginals'][url]={'originalUrl':original,'basis':'explicit_approved_church_host_and_upload_path_in_jetpack_url','transformedBytesVerified':False}
    robots={}
    for origin in ORIGINS:
        summary=source['pages'].get(origin+'/robots.txt')
        if not summary: raise ValueError('asset_phase_requires_captured_robots')
        record=json.loads((output/summary['recordPath']).read_text(encoding='utf-8'));rules=RobotFileParser()
        if record.get('status')==200:
            raw=(output/record['responsePath']).read_bytes()
            if digest(raw)!=record['bodySha256']: raise ValueError('captured_robots_hash_mismatch')
            rules.parse(raw.decode('utf-8','replace').splitlines())
        elif record.get('status') in (401,403): rules.disallow_all=True
        elif record.get('status') is None or record.get('status',0)>=500: raise ValueError('robots_unavailable_capture_stopped')
        else: rules.allow_all=True
        robots[origin]=rules
    opener=build_opener(NoRedirect);last=0.
    for url,referrers in candidates.items():
        if url in result['assets']: continue
        if not allowed(url):
            original=result['sourceDerivedOriginals'].get(url,{}).get('originalUrl')
            result['remainingDependencies'][url]={'reason':'external_transform_not_requested_original_candidate_recorded' if original else 'external_origin_not_requested','sourcePages':sorted(referrers),**({'originalCandidateUrl':original} if original else {})};continue
        parsed=urlsplit(url);rules=robots.get(parsed.scheme+'://'+parsed.netloc)
        if rules and not rules.can_fetch(USER_AGENT,url): result['remainingDependencies'][url]={'reason':'robots_disallow','sourcePages':sorted(referrers)};continue
        if not asset_kind(url): result['remainingDependencies'][url]={'reason':'unsupported_or_extensionless_asset','sourcePages':sorted(referrers)};continue
        if MEDIA_EXT.search(url): result['excludedResources'][url]='recording_not_requested';continue
        pending=files/(digest(url)+'.pending');entry=None
        for attempt in range(3):
            interval=max(1,(rules.crawl_delay(USER_AGENT) or rules.crawl_delay('*') or 1) if rules else 1)
            time.sleep(max(0,interval-(time.monotonic()-last)));last=time.monotonic();response=None
            try:
                try: response=opener.open(Request(url,headers={'User-Agent':USER_AGENT,'Accept-Encoding':'identity'}),timeout=30)
                except HTTPError as failure:response=failure
                status=response.status;mime=response.headers.get('Content-Type','').split(';')[0].strip().lower()
                entry={'url':url,'status':status,'mime':mime,'capturedAt':stamp(),'attempts':attempt+1,'sourcePages':sorted(referrers)}
                if status!=200:
                    location=response.headers.get('Location')
                    if location:entry['redirectTarget']=address(location,url)
                    entry['validation']={'valid':False,'reason':'asset_http_status'}
                    if status in (429,502,503,504) and attempt<2:time.sleep(3*(attempt+1));continue
                    break
                permitted=mime.startswith('image/') or mime in {'application/pdf','application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.text','application/rtf','text/rtf','text/plain'}
                if not permitted:entry['validation']={'valid':False,'reason':'asset_mime_not_permitted'};break
                size=0;hash_value=hashlib.sha256()
                with pending.open('wb') as stream:
                    while chunk:=response.read(min(1024*1024,max_bytes+1-size)):
                        stream.write(chunk);hash_value.update(chunk);size+=len(chunk)
                        if size>max_bytes:break
                entry.update({'byteCount':size,'sha256':hash_value.hexdigest()})
                filename=hash_value.hexdigest()+Path(urlsplit(url).path).suffix.lower();target=files/filename
                if target.exists():
                    if digest(target.read_bytes())!=hash_value.hexdigest():raise ValueError('asset_hash_collision')
                    pending.unlink()
                else:pending.replace(target)
                entry['relativePath']=str(target.relative_to(output))
                entry['validation']={'valid':False,'reason':'asset_size_limit_exceeded'} if size>max_bytes else inspect_asset_magic(target,mime)
                break
            except (URLError,TimeoutError,OSError):
                if attempt==2:entry={'url':url,'status':None,'capturedAt':stamp(),'attempts':3,'sourcePages':sorted(referrers),'validation':{'valid':False,'reason':'asset_request_failed'}}
            finally:
                if response is not None:response.close()
        result['assets'][url]=entry
        if not entry or not entry['validation']['valid']:result['remainingDependencies'][url]={'reason':entry['validation']['reason'] if entry else 'asset_request_failed','sourcePages':sorted(referrers)}
        result.update({'updatedAt':stamp(),'maxBytesPerFile':max_bytes,'requestIntervalSeconds':1,'maxRetries':2})
        save(asset_path,result)
        if len(result['assets'])%20==0:print(json.dumps({'assetsChecked':len(result['assets']),'remainingDependencies':len(result['remainingDependencies'])}),flush=True)
    result['completedAt']=stamp();result['candidateCount']=len(candidates);save(asset_path,result)
    print(json.dumps({'assetsChecked':len(result['assets']),'validAssets':sum(bool(x and x['validation']['valid']) for x in result['assets'].values()),'remainingDependencies':len(result['remainingDependencies'])}),flush=True)

def verify_host_variants(output):
    output=output.resolve(); job=Capture(output,10000,1,2)
    folder=output/'host-check-responses';folder.mkdir(exist_ok=True)
    results=[]
    for scheme in ('http','https'):
        for host in ('www.savinggrace.org.au','savinggrace.org.au'):
            url=scheme+'://'+host+'/'
            record,body=job.get(url)
            if body:
                path=folder/(digest(url)[:12]+'-'+digest(body)[:32]+'.body')
                if path.exists() and digest(path.read_bytes())!=digest(body): raise ValueError('host_capture_filename_collision')
                if not path.exists():path.write_bytes(body)
                record['responsePath']=str(path.relative_to(output))
            record['redirectTarget']=address(record.get('headers',{}).get('location',''),url) if record.get('headers',{}).get('location') else None
            record['canonicalUrls']=extract(body.decode('utf-8','replace'),url)['canonicalUrls'] if record.get('status')==200 and not record.get('bodyLimitExceeded') else []
            results.append(record)
    result={'purpose':'bounded_final_public_host_behavior_confirmation','capturedAt':stamp(),'requestIntervalSeconds':1,'maxRetries':2,'redirectsFollowed':False,'responses':results}
    save(output/'host-checks.private.json',result)
    print(json.dumps({'hostChecks':[{'origin':urlsplit(r['url']).scheme+'://'+urlsplit(r['url']).netloc,'status':r.get('status'),'redirectOrigin':urlsplit(r['redirectTarget']).scheme+'://'+urlsplit(r['redirectTarget']).netloc if r['redirectTarget'] else None,'canonicalOrigins':[urlsplit(u).scheme+'://'+urlsplit(u).netloc for u in r['canonicalUrls'] if u]} for r in results]}))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True); parser.add_argument('--max-urls',type=int,default=10000)
    parser.add_argument('--delay',type=float,default=1); parser.add_argument('--retries',type=int,default=2)
    parser.add_argument('--verify-hosts',action='store_true'); parser.add_argument('--freeze',action='store_true'); parser.add_argument('--seed-file'); parser.add_argument('--reextract',action='store_true'); parser.add_argument('--assets',action='store_true'); args=parser.parse_args()
    if not 2<=args.max_urls<=10000: parser.error('max-urls must be between2 and10000')
    if args.verify_hosts:
        with network_lease(Path(args.output)): verify_host_variants(Path(args.output))
        return
    if args.assets:
        with network_lease(Path(args.output)): capture_assets(Path(args.output))
        return
    if args.freeze:
        with network_lease(Path(args.output)):
            path=Path(args.output)/'ledger.private.json';state=json.loads(path.read_text(encoding='utf-8'))
            state.update({'paused':True,'htmlPhaseFrozen':True,'frozenAt':stamp(),'completed':False,'freezeReason':'explicit_checkpoint_with_unresolved_urls_retained'})
            save(path,state);print(json.dumps({'frozen':True,'captured':len(state['pages'])}))
        return
    seeds=json.loads(Path(args.seed_file).read_text(encoding='utf-8')) if args.seed_file else []
    if args.reextract:
        output=Path(args.output).resolve(); ledger=json.loads((output/'ledger.private.json').read_text(encoding='utf-8')); count=0
        for summary in ledger['pages'].values():
            path=output/summary['recordPath']; record=json.loads(path.read_text(encoding='utf-8'))
            if record.get('mainFound') is not None and record.get('responsePath'):
                raw=(output/record['responsePath']).read_bytes()
                if digest(raw)!=record['bodySha256']: raise RuntimeError('captured_response_hash_mismatch')
                record.update(extract(raw.decode('utf-8','replace'),record['url']))
                record['capturedAt']=datetime.fromisoformat(record['capturedAt'].replace('Z','+00:00')).astimezone(timezone.utc).isoformat().replace('+00:00','Z')
                save(path,record);count+=1
        print(json.dumps({'offlineReextracted':count})); return
    job=Capture(Path(args.output),args.max_urls,args.delay,args.retries)
    with network_lease(Path(args.output)):
        try: job.run(seeds)
        except KeyboardInterrupt:
            job.checkpoint();job.state.update({'paused':True,'htmlPhaseFrozen':True});save(job.state_path,job.state); print(json.dumps({'paused':True,'captured':len(job.state['pages']),'pending':len(job.state['pendingUrls'])}),flush=True)

if __name__=='__main__': main()
