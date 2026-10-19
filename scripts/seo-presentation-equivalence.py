"""Exact presentation witnesses. Raw comparator findings are never rewritten."""
import re, collections, hashlib, json, importlib.util
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl, unquote, urljoin
SPEC=importlib.util.spec_from_file_location('presentation_capture',Path(__file__).with_name('seo-source-capture.py'))
CAP=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(CAP)
BLOCKS={'p','h1','h2','h3','h4','h5','h6','li','blockquote','figcaption'}
def norm(value):return CAP.clean(value).replace('\u00a0',' ').strip()
def sha(value):return hashlib.sha256(value.encode()).hexdigest()
def walk(node):
 if not isinstance(node,dict):return
 yield node
 for child in node['children']:
  if isinstance(child,dict):yield from walk(child)
def tree(document):
 parser=CAP.Tree();parser.feed(document);return parser.root
def detail_path(href):
 p=urlsplit(href)
 if p.hostname and p.hostname not in ('www.savinggrace.org.au','savinggrace.org.au'):return None
 return p.path if re.fullmatch(r'/sermons/(?!page/)[^/]+/',p.path) and not p.query else None
def identities(node):
 return {path for item in walk(node) if item['tag']=='a' and (path:=detail_path(item['attrs'].get('href','')))}
def source_cards(root):
 result={}
 # Raw list/article boundaries identify a card even when a filter has one result.
 for node in walk(root):
  ids=identities(node)
  if node['tag']in ('li','article')and len(ids)==1 and any(n['tag']in ('h2','h3','h4')and identities(n)==ids for n in walk(node)):
   result.setdefault(next(iter(ids)),[]).append(node)
 if result:return result
 def visit(node):
  ids=identities(node)
  if len(ids)==1 and node['tag']in ('li','div','article'):
   result.setdefault(next(iter(ids)),[]).append(node);return
  for child in node['children']:
   if isinstance(child,dict):visit(child)
 visit(root);return result

def candidate_cards(document):
 result={}
 for node in walk(tree(document)):
  if node['tag']=='article' and 'journal__entry' in node['attrs'].get('class','').split():
   ids=identities(node)
   if len(ids)==1:result[next(iter(ids))]=node
 return result
def source_date(value):
 match=re.fullmatch(r'(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December),? (\d{4})',value)
 if not match:return None
 months='January February March April May June July August September October November December'.split()
 return match[3]+'-'+str(months.index(match[2])+1).zfill(2)+'-'+match[1].zfill(2)
def whole_text(haystack,needle):
 return bool(needle and re.search(r'(?<!\w)'+re.escape(needle)+r'(?!\w)',haystack))
def taxonomy_identity(href):
 p=urlsplit(href)
 if p.hostname and p.hostname not in ('www.savinggrace.org.au','savinggrace.org.au'):return None
 native=re.fullmatch(r'/(series|speakers|books)/([a-z0-9-]+)/',p.path)
 if native and not p.query:return native[1],native[2]
 pairs=parse_qsl(p.query)
 mapping={'sermon_series':'series','sermon_speaker':'speakers','sermon_book':'books'}
 if p.path=='/sermons/'and len(pairs)==1 and pairs[0][0]in mapping:
  slug=unquote(pairs[0][1]).strip('/')
  if re.fullmatch('[a-z0-9-]+',slug):return mapping[pairs[0][0]],slug
 return None

def metadata_field_witness(node,candidate):
 value=norm(CAP.text(node))
 if node['tag']=='p'and value.startswith('Passage: '):
  reference=re.sub('[‐‑‒–—−]','-',value.removeprefix('Passage: ')).strip()
  if not reference:return False
  for area in walk(candidate):
   classes=area['attrs'].get('class','').split()
   if area['tag']=='p'and any(c in classes for c in('journal__passage','entry__stamp')):
    actual=re.sub('[‐‑‒–—−]','-',norm(CAP.text(area)))
    if actual in ('Passage: '+reference,'Preached from '+reference):return True
  return False
 match=re.match(r'^(Series|Preacher|Book):\s*(.*)$',value)
 if not match:return False
 kind={'Series':'series','Preacher':'speakers','Book':'books'}[match[1]]
 anchors=[n for n in walk(node)if n['tag']=='a'];wanted=[(taxonomy_identity(n['attrs'].get('href','')),norm(CAP.text(n)))for n in anchors]
 if not anchors:return not match[2] # Exact empty legacy metadata label, no fact lost.
 if any(not identity or identity[0]!=kind for identity,name in wanted):return False
 if norm(match[2].replace(',',' '))!=norm(' '.join(name for identity,name in wanted)):return False
 classes={'series':'journal__series','speakers':'journal__speaker','books':'journal__tab'}
 areas=[n for n in walk(candidate)if classes[kind]in n['attrs'].get('class','').split()or kind=='books'and 'journal__books'in n['attrs'].get('class','').split()]
 actual=[(taxonomy_identity(n['attrs'].get('href','')),norm(CAP.text(n)))for area in areas for n in walk(area)if n['tag']=='a']
 whole=norm(CAP.text(candidate))
 return all(any(a==identity and (text==name or whole_text(whole,name))for a,text in actual)for identity,name in wanted)

def original_main(source,document):
 root=tree(document);selector=source.get('mainSelector')
 if selector=='main':return CAP.first(root,lambda n:n['tag']=='main')
 if selector=='main-content':return CAP.first(root,lambda n:n['attrs'].get('id')=='main-content')
 if selector in ('sermon-main-content','tribe-events-single-event-description','entry-content','post-content','page-content'):
  return CAP.first(root,lambda n:selector in CAP.classes(n))
 return None

def card_witness(original,candidate,path):
 actual=norm(CAP.text(candidate));dates={item['attrs'].get('datetime','').split('T')[0]for item in walk(candidate)if item['tag']=='time'}
 series=[norm(CAP.text(item)) for item in walk(candidate)if 'journal__series'in item['attrs'].get('class','').split()]
 def exact_node(node):
  value=norm(CAP.text(node))
  if not value:return True
  if node['tag']=='img':return True # image identity/alt is checked separately.
  if node['tag']=='p':
   if metadata_field_witness(node,candidate):return True
   date=source_date(value)
   if date:return date in dates
   if value.startswith('Series: '):return 'Series '+value[8:] in series
  if whole_text(actual,value):return True
  if node['tag']=='a' and detail_path(node['attrs'].get('href',''))==path and value.lower() in ('read more','view sermon','open sermon'):return True
  if node['tag'] in ('text',):return False
  for child in node['children']:
   if isinstance(child,str):
    if norm(child) and not whole_text(actual,norm(child)):return False
   elif not exact_node(child):return False
  return True
 return exact_node(original)
def archive_group(url):
 p=urlsplit(url)
 if p.hostname and p.hostname not in ('www.savinggrace.org.au','savinggrace.org.au'):return None
 match=re.fullmatch(r'/sermons/(?:page/([1-9][0-9]*)/)?',p.path)
 if not match:return None
 pairs=parse_qsl(p.query)
 if len(pairs)>1 or any(k not in ('sermon_series','sermon_speaker','sermon_book','sermon_topics')or not re.fullmatch(r'[a-z0-9-]+',unquote(v).strip('/'))for k,v in pairs):return None
 return tuple((k,unquote(v).strip('/'))for k,v in pairs)

def archive_page(url):
 p=urlsplit(url);group=archive_group(url)
 if group is None:return None
 match=re.search(r'/page/([1-9][0-9]*)/',p.path)
 return group,int(match[1])if match else 1

def archive_card_pool(start,documents):
 group=archive_group(start);pages={};cards={};missing=set()
 if group is None:return None
 for url,document in documents.items():
  key=archive_page(url)
  if key and key[0]==group:pages[key]=(url,document)
 first=archive_page(start)
 if first not in pages:return None
 queue=[first];seen=set();proof=[]
 while queue:
  key=queue.pop()
  if key in seen:continue
  seen.add(key)
  if key not in pages:missing.add(key);continue
  url,document=pages[key];root=tree(document);proof.append({'url':url,'responseSha256':sha(document)})
  for path,node in candidate_cards(document).items():cards.setdefault(path,[]).append({'node':node,'page':url,'responseSha256':sha(document)})
  for area in walk(root):
   if area['tag']=='nav'and 'pagination'in area['attrs'].get('class','').split():
    for node in walk(area):
     if node['tag']=='a'and(nodekey:=archive_page(urljoin(url,node['attrs'].get('href',''))))and nodekey[0]==group:queue.append(nodekey)
 return {'group':group,'cards':cards,'pages':proof,'completePagination':not missing,'missingPages':[key[1]for key in sorted(missing)]}

def active_filter_witness(source,document):
 group=archive_group(source['url'])
 if not group:return False
 root=tree(document);selected={};labels={}
 def option_text(node):return node if isinstance(node,str)else' '.join(option_text(child)for child in node['children'])
 for node in walk(root):
  if node['tag']=='select':
   values=[x for x in walk(node)if x['tag']=='option'and 'selected'in x['attrs']]
   if len(values)==1:
    key=node['attrs'].get('name');selected[key]=values[0]['attrs'].get('value');labels[key]=norm(option_text(values[0]));labels[key]=re.sub(r' \([0-9]+\)$','',labels[key])
 tokens=' '.join(norm(CAP.text(n))for n in walk(root)if n['attrs'].get('aria-label')=='Active filters')
 prefixes={'sermon_book':'Book','sermon_series':'Series','sermon_speaker':'Speaker','sermon_topics':'Reference'}
 return bool(tokens)and all(selected.get(key)==value and labels.get(key)and whole_text(tokens,prefixes[key]+': '+labels[key])for key,value in group)

def individual_card_block_witness(node,candidate,path):
 # Resolve only this exact block. A missing excerpt keeps its own finding open.
 if node['tag']in ('h1','h2','h3','h4','h5','h6'):
  expected=norm(CAP.text(node))
  return bool(expected)and any(n['tag']in ('h1','h2','h3','h4','h5','h6')and identities(n)=={path}and norm(CAP.text(n))==expected for n in walk(candidate))
 return card_witness(node,candidate,path)

def pagination_control_witnesses(root,source,candidate,document,related_archive,remaining):
 group=archive_group(source['url'])
 if group is None or archive_group(candidate['url'])!=group:return []
 current=archive_page(candidate['url']);candidate_root=tree(document);direct=set();current_visible=False
 for area in walk(candidate_root):
  if area['tag']!='nav'or 'pagination'not in area['attrs'].get('class','').split():continue
  for node in walk(area):
   if node['tag']=='a':
    key=archive_page(urljoin(candidate['url'],node['attrs'].get('href','')))
    if key and key[0]==group:direct.add(key)
   if node['attrs'].get('aria-current')=='page'and norm(CAP.text(node))==str(current[1]):current_visible=True
 pooled={archive_page(p['url']):p for p in related_archive['pages']}if related_archive and related_archive.get('completePagination')and related_archive.get('group')==group else {}
 result=[]
 for node in walk(root)if root else []:
  value=norm(CAP.text(node));key=sha(value)
  if node['tag']not in BLOCKS or not value.isdecimal()or not remaining.get(key):continue
  target=(group,int(value));anchors=[n for n in walk(node)if n['tag']=='a'];source_link=any(archive_page(urljoin(source['url'],n['attrs'].get('href','')))==target and norm(CAP.text(n))==value for n in anchors)
  source_current=archive_page(source['url'])==target and any(n['attrs'].get('aria-current')=='page'or 'current'in n['attrs'].get('class','').split()for n in walk(node))
  if not(source_link or source_current):continue
  witness=None
  if target==current and current_visible:witness={'candidatePage':candidate['url'],'candidateResponseSha256':sha(document),'reason':'same_archive_pagination_control_in_rendered_navigation'}
  elif target in pooled:witness={'candidatePage':pooled[target]['url'],'candidateResponseSha256':pooled[target]['responseSha256'],'reason':'same_archive_pagination_control_with_verified_target'if target in direct else'same_archive_page_in_complete_connected_navigation','navigationPoolSha256':sha(json.dumps(related_archive['pages'],sort_keys=True))}
  if witness:remaining[key]-=1;result.append({'blockSha256':key,'page':int(value),**witness})
 return result

def block_witnesses(source,candidate,document,missing,source_document=None,related_archive=None):
 """Require the same card URL and every original leaf, never a bag of words."""
 remaining=collections.Counter(missing);witnesses=[]
 actual=norm(candidate.get('mainText',''));root=original_main(source,source_document)if source_document is not None else tree(source.get('mainHtml',''));cards=source_cards(root)if root else {};current=candidate_cards(document)
 card_nodes={}
 for path,groups in cards.items():
  options=[{'node':current[path],'page':candidate['url'],'responseSha256':sha(document)}]if path in current else []
  if related_archive and related_archive.get('completePagination')and related_archive.get('group')==archive_group(source['url'])==archive_group(candidate['url']):options+=related_archive['cards'].get(path,[])
  for node in groups:
   complete=next((item for item in options if card_witness(node,item['node'],path)),None)
   for child in walk(node):
    if child['tag']not in BLOCKS:continue
    value=norm(CAP.text(child));key=sha(value)
    if not remaining.get(key):continue
    matched=complete or next((item for item in options if individual_card_block_witness(child,item['node'],path)),None)
    if matched:
     remaining[key]-=1;witnesses.append({'blockSha256':key,'reason':'same_sermon_card_all_original_leaves_verified'if complete else'same_sermon_identity_exact_individual_block_verified','identity':path,'sourceCardSha256':sha(CAP.sanitize(node,source['url'])),'candidateCardSha256':sha(CAP.sanitize(matched['node'],matched['page'])),'candidatePage':matched['page'],'candidateResponseSha256':matched['responseSha256']})
 witnesses+=pagination_control_witnesses(root,source,candidate,document,related_archive,remaining)
 if remaining.get(sha('Filtered by:'))and active_filter_witness(source,document):
  remaining[sha('Filtered by:')]-=1;witnesses.append({'blockSha256':sha('Filtered by:'),'reason':'same_typed_selected_filters_and_visible_removable_tokens'})
 for block in source.get('semanticBlocks',[]):
  value=norm(block['text']);key=sha(value)
  if remaining.get(key) and whole_text(actual,value):
   remaining[key]-=1;witnesses.append({'blockSha256':key,'reason':'exact_visible_text_reflow','sourceTag':block['tag']})
 remaining=+remaining
 return {'resolvedBlocks':len(witnesses),'remainingBlocks':sum(remaining.values()),'remainingBlockHashes':dict(remaining),'witnesses':witnesses,'fullyEquivalent':not remaining}
def owned_original(url):
 p=urlsplit(url)
 if p.scheme not in ('https','http') or p.username or p.password:return None
 if p.hostname in ('www.savinggrace.org.au','savinggrace.org.au'):return p.path
 if p.hostname in ('i0.wp.com','i1.wp.com','i2.wp.com'):
  match=re.fullmatch(r'/(www\.savinggrace\.org\.au|savinggrace\.org\.au)(/wp-content/uploads/[^?#]+)',p.path)
  if match and all(k in ('resize','fit','crop','ssl','w','h','quality','strip')for k,v in parse_qsl(p.query)):return match[2]
 return None
def image_witnesses(expected,candidate_images,original_hashes,actual_hashes,reviewed_variants=()):
 witnesses=[];remaining=[]
 for url,alt in expected:
  path=owned_original(url);original=original_hashes.get(path) if path else None
  match=next((image for image in candidate_images if original and actual_hashes.get(image['url'])==original and (norm(image.get('alt',''))==norm(alt) or not norm(alt) and bool(norm(image.get('alt',''))))),None)
  variant=None
  if not match:
   for image in candidate_images:
    variant=next((row for row in reviewed_variants if row.get('visualIdentityVerified')is True and row.get('sourceUrl')==url and row.get('sourceSha256')==original and row.get('candidateUrl')==image['url'] and row.get('candidateSha256')==actual_hashes.get(image['url']) and row.get('sourceAltSha256')==sha(norm(alt)) and row.get('candidateAltSha256')==sha(norm(image.get('alt','')))and(norm(image.get('alt',''))==norm(alt)or not norm(alt)and norm(image.get('alt','')))),None)
    if variant:match=image;break
  if match:
   witness={'sourceUrlSha256':sha(url),'candidateUrlSha256':sha(match['url']),'fileSha256':actual_hashes[match['url']],'ownedOriginalSha256':original,'sourceAltSha256':sha(norm(alt)),'candidateAltSha256':sha(norm(match.get('alt',''))),'reason':'visually_verified_responsive_variant_with_exact_byte_bindings'if variant else'verified_same_original_image'+('_descriptive_alt_added'if norm(alt)!=norm(match.get('alt',''))else'')}
   witnesses.append(witness)
  else:remaining.append(sha(json.dumps([url,alt])))
 return {'fullyEquivalent':not remaining,'witnesses':witnesses,'remainingImageHashes':remaining}
