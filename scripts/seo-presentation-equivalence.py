"""Exact presentation witnesses. Raw comparator findings are never rewritten."""
import re, collections, hashlib, json, importlib.util
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl, unquote
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
 def visit(node):
  ids=identities(node)
  if len(ids)==1 and node['tag'] in ('li','div','article'):
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
def card_witness(original,candidate,path):
 actual=norm(CAP.text(candidate));dates={item['attrs'].get('datetime','').split('T')[0]for item in walk(candidate)if item['tag']=='time'}
 series=[norm(CAP.text(item)) for item in walk(candidate)if 'journal__series'in item['attrs'].get('class','').split()]
 def exact_node(node):
  value=norm(CAP.text(node))
  if not value:return True
  if node['tag']=='img':return True # image identity/alt is checked separately.
  if node['tag']=='p':
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
def block_witnesses(source,candidate,document,missing):
 """Require the same card URL and every original leaf, never a bag of words."""
 remaining=collections.Counter(missing);witnesses=[]
 actual=norm(candidate.get('mainText',''));root=tree(source.get('mainHtml',''));cards=source_cards(root);current=candidate_cards(document)
 card_nodes={}
 for path,groups in cards.items():
  if path not in current:continue
  for node in groups:
   if card_witness(node,current[path],path):
    for child in walk(node):
     if child['tag']in BLOCKS:
      value=norm(CAP.text(child));key=sha(value)
      if remaining.get(key):
       remaining[key]-=1;witnesses.append({'blockSha256':key,'reason':'same_sermon_card_all_original_leaves_verified','identity':path,'sourceCardSha256':sha(CAP.sanitize(node,source['url'])),'candidateCardSha256':sha(CAP.sanitize(current[path],candidate['url']))})
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
def image_witnesses(expected,candidate_images,original_hashes,actual_hashes):
 witnesses=[];remaining=[]
 for url,alt in expected:
  path=owned_original(url);original=original_hashes.get(path) if path else None
  match=next((image for image in candidate_images if original and actual_hashes.get(image['url'])==original and (norm(image.get('alt',''))==norm(alt) or not norm(alt) and bool(norm(image.get('alt',''))))),None)
  if match:witnesses.append({'sourceUrlSha256':sha(url),'candidateUrlSha256':sha(match['url']),'fileSha256':original,'sourceAltSha256':sha(norm(alt)),'candidateAltSha256':sha(norm(match.get('alt',''))),'reason':'verified_same_original_image'+('_descriptive_alt_added' if norm(alt)!=norm(match.get('alt','')) else '')})
  else:remaining.append(sha(json.dumps([url,alt])))
 return {'fullyEquivalent':not remaining,'witnesses':witnesses,'remainingImageHashes':remaining}
