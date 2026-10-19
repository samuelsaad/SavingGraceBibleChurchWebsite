"""Bound witnesses for replacement calendar controls, never event-copy waivers."""
import collections,hashlib,importlib.util
from pathlib import Path
from urllib.parse import urlsplit,parse_qs,urljoin
S=importlib.util.spec_from_file_location('calendar_linked',Path(__file__).with_name('seo-linked-result-equivalence.py'));L=importlib.util.module_from_spec(S);S.loader.exec_module(L);P=L.P

def calendar_controls(source,source_document,view,document,missing):
 remaining=collections.Counter(missing);witnesses=[]
 if not(L.bound(source,source_document)and L.bound(view,document))or source.get('status')!=200 or view.get('status')!=200 or L.own(source.get('url',''))!=L.own(view.get('url','')):return {'fullyEquivalent':False,'remainingBlockHashes':dict(remaining),'witnesses':[]}
 address=urlsplit(source['url']);scope=__import__('re').fullmatch(r'(/events/(?:(?:category|tag)/[a-z0-9-]+/)?)(?:.*)',address.path)
 if not scope:return {'fullyEquivalent':False,'remainingBlockHashes':dict(remaining),'witnesses':[]}
 scope=scope[1];root=P.original_main(source,source_document);target=L.main(document)
 if not root or not target:return {'fullyEquivalent':False,'remainingBlockHashes':dict(remaining),'witnesses':[]}
 def scoped(href):
  value=L.own(href,view['url'])
  if not value:return None
  u=urlsplit(value)
  # The exact category/tag must survive; no unrelated base calendar is a witness.
  if not(u.path==scope or u.path.startswith(scope)and(scope!='/events/'or not u.path.startswith(('/events/category/','/events/tag/')))):return None
  return u
 controls={};form=None;day_links={}
 for n in P.walk(target):
  if n['tag']=='nav'and n['attrs'].get('aria-label')=='Calendar views':
   for a in P.walk(n):
    if a['tag']=='a'and(u:=scoped(a['attrs'].get('href',''))):
     text=P.norm(P.CAP.text(a));query=parse_qs(u.query)
     if text in ('List','Month','Day')and query.get('eventDisplay')==[text.lower()]and not any(query.get(k)!=v for k,v in parse_qs(address.query).items()if k not in ('eventDisplay','paged','page','tribe-bar-date','eventDate')):controls[text]=a
  if n['tag']=='form'and n['attrs'].get('method','').lower()=='get'and n['attrs'].get('aria-label')=='Search church events'and(u:=scoped(n['attrs'].get('action','')))and u.path==scope:
   fields={(c['attrs'].get('name'),c['attrs'].get('type'))for c in P.walk(n)if c['tag']=='input'}
   if {('tribe-bar-search','search'),('tribe-bar-location','text'),('tribe-bar-date','date')}<=fields and any(c['tag']=='button'and c['attrs'].get('type')=='submit'for c in P.walk(n)):form=n
  if n['tag']=='nav'and n['attrs'].get('aria-label')=='Calendar days':
   for a in P.walk(n):
    if a['tag']=='a'and L.own(a['attrs'].get('href',''),view['url']):day_links[P.norm(P.CAP.text(a))]=a
 for n in P.walk(root):
  value=P.norm(P.CAP.text(n));key=P.sha(value);classes=n['attrs'].get('class','').split();reason=None;actual=None
  if n['tag']not in P.BLOCKS or not remaining.get(key):continue
  if 'tribe-common-a11y-visual-hide'in classes and value=='Event Views Navigation'and set(controls)=={'List','Month','Day'}:reason='same_three_scoped_calendar_views_in_accessible_server_navigation';actual=''.join(P.CAP.sanitize(controls[k],view['url'])for k in sorted(controls))
  elif 'tribe-common-a11y-visual-hide'in classes and value=='Events Search and Views Navigation'and set(controls)=={'List','Month','Day'}and form is not None:reason='same_scoped_search_date_location_form_and_calendar_views';actual=P.CAP.sanitize(form,view['url'])
  elif 'tribe-events-c-view-selector__list-item'in classes and value in controls:reason='same_typed_scoped_calendar_view_link';actual=P.CAP.sanitize(controls[value],view['url'])
  elif 'tribe-events-c-nav__list-item'in classes and value in ('Previous Day','Next Day')and value in day_links:
   old=[L.own(a['attrs'].get('href',''),source['url'])for a in P.walk(n)if a['tag']=='a'];new=L.own(day_links[value]['attrs'].get('href',''),view['url'])
   if old==[new]:reason='same_exact_adjacent_day_destination_in_server_navigation';actual=P.CAP.sanitize(day_links[value],view['url'])
  if reason:
   remaining[key]-=1;witnesses.append({'blockSha256':key,'sourceControlSha256':P.sha(P.CAP.sanitize(n,source['url'])),'candidateControlSha256':P.sha(actual),'sourceResponseSha256':source['bodySha256'],'candidateResponseSha256':view['bodySha256'],'reason':reason})
 return {'fullyEquivalent':not +remaining,'remainingBlockHashes':dict(+remaining),'witnesses':witnesses}

def linked_calendar_reference(source,source_document,view,document,reference,bindings):
 """A captured WP event object, its existing native alias and an actual view link."""
 import re
 if not(L.bound(source,source_document)and L.bound(view,document))or source.get('status')!=200 or view.get('status')!=200 or L.own(source.get('url',''))!=L.own(view.get('url',''))or not source.get('url','').startswith(L.ORIGIN+'/events/'):return None
 original=reference['source'];target=reference['candidate'];target_document=reference['document'];old=L.own(original.get('url',''));new=L.own(target.get('url',''))
 if not old or not new or original.get('status')!=200 or not isinstance(original.get('sourcePostId'),int)or target.get('status')!=200 or not L.bound(target,target_document)or not L.indexable(target)or target.get('extracted',{}).get('canonicalUrls')!=[new]:return None
 path=urlsplit(old).path;match=re.fullmatch(r'(/event/[^/]+/)(20[0-9]{2}-[0-9]{2}-[0-9]{2}/)?',path)
 if not match:return None
 matches=[item for item in bindings if item.get('nativeUrl')==new and match[1]in item.get('legacyPaths',[])and __import__('re').fullmatch('[a-f0-9]{64}',item.get('dependencySha256',''))]
 if len(matches)!=1:return None
 link=L.result_link(document,new)
 if not link:return None
 return {'sourceObjectId':original['sourcePostId'],'originalEventUrl':old,'nativeEventUrl':new,'bindingSha256':matches[0]['dependencySha256'],'sourceResponseSha256':source['bodySha256'],'candidateResponseSha256':view['bodySha256'],'originalEventResponseSha256':original['bodySha256'],'nativeEventResponseSha256':target['bodySha256'],'candidateResultLinkSha256':link}

def linked_calendar_blocks(source,source_document,view,document,references,bindings,missing,redirects=None):
 remaining=collections.Counter(missing);proofs=[];root=P.original_main(source,source_document);redirects=redirects or {}
 if not root:return {'fullyEquivalent':False,'remainingBlockHashes':dict(remaining),'witnesses':[]}
 for ref in references:
  proof=linked_calendar_reference(source,source_document,view,document,ref,bindings)
  if not proof:continue
  native=L.main(ref['document']);actual=P.norm(P.CAP.text(native))if native else '';links={(redirects.get(u,u),P.norm(P.CAP.text(a)))for a in P.walk(native)if a['tag']=='a'and(u:=(L.own(a['attrs'].get('href',''),proof['nativeEventUrl'])or urljoin(proof['nativeEventUrl'],a['attrs'].get('href',''))))}
  for node,parent in L.contexts(root):
   if parent is None or not L.context_identity(parent,source['url'],ref['source'])or node['tag']not in P.BLOCKS:continue
   value=P.norm(P.CAP.text(node));key=P.sha(value)
   if not remaining.get(key):continue
   expected=[(redirects.get(u,u),P.norm(P.CAP.text(a)))for a in P.walk(node)if a['tag']=='a'and(u:=(L.own(a['attrs'].get('href',''),source['url'])or urljoin(source['url'],a['attrs'].get('href',''))))]
   text=value;truncated=False
   if node['tag']=='p'and(value.endswith('...')or value.endswith('…')):
    text=value[:-3]if value.endswith('...')else value[:-1];text=text.rstrip();truncated=len(text)>=60 and len(text.split())>=12
    if not truncated:continue
   if P.whole_text(actual,text)and all(link in links for link in expected):
    remaining[key]-=1;proofs.append({**proof,'blockSha256':key,'sourceResultSha256':P.sha(P.CAP.sanitize(parent,source['url'])),'reason':'same_original_event_excerpt_prefix_preserved_on_verified_linked_event'if truncated else'same_original_event_block_and_links_on_verified_linked_event'})
 return {'fullyEquivalent':not +remaining,'remainingBlockHashes':dict(+remaining),'witnesses':proofs}

def linked_calendar_image(source,source_document,view,document,reference,bindings,url,alt,original_hash,actual_files,variants):
 proof=linked_calendar_reference(source,source_document,view,document,reference,bindings)
 if not proof or not original_hash:return None
 root=P.original_main(source,source_document);relation=None
 if not root:return None
 for node,parent in L.contexts(root):
  if node['tag']=='img'and parent is not None and P.owned_original(urljoin(source['url'],node['attrs'].get('src','')))==P.owned_original(url)and P.norm(node['attrs'].get('alt',''))==P.norm(alt)and L.context_identity(parent,source['url'],reference['source']):relation=P.sha(P.CAP.sanitize(parent,source['url']));break
 if not relation:return None
 result=P.image_witnesses([(url,alt)],reference['candidate'].get('extracted',{}).get('images',[]),{P.owned_original(url):original_hash},{u:item['sha256']for u,item in actual_files.items()if item.get('status')==200 and item.get('mime','').startswith('image/')},variants)
 if not result['fullyEquivalent']:return None
 return {**proof,'sourceResultSha256':relation,'image':result['witnesses'][0],'reason':'same_original_event_image_and_alt_on_its_verified_linked_event'}
