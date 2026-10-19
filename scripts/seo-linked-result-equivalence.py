"""Exact WordPress result-to-canonical-content witnesses; no HTTP/status-only waiver."""
import hashlib,importlib.util,re
from pathlib import Path
from urllib.parse import urlsplit,urljoin,parse_qsl
S=importlib.util.spec_from_file_location('linked_presentation',Path(__file__).with_name('seo-presentation-equivalence.py'));P=importlib.util.module_from_spec(S);S.loader.exec_module(P)
ORIGIN='https://www.savinggrace.org.au'
def own(value,base=ORIGIN):
 try:
  u=urlsplit(urljoin(base,value))
  if u.scheme not in ('http','https')or u.hostname not in ('www.savinggrace.org.au','savinggrace.org.au')or u.username or u.password or u.port or u.fragment:return None
  if re.match(r'^/(?:admin|api|frontend-preview|draft-preview|cms-preview)(?:/|$)',u.path):return None
  return ORIGIN+u.path+('?' +u.query if u.query else '')
 except ValueError:return None

def bound(record,document):return hashlib.sha256(document.encode('utf8')).hexdigest()==record.get('bodySha256')
def indexable(record):
 directives=[record.get('headers',{}).get('x-robots-tag',''),*record.get('extracted',{}).get('robots',[]),*record.get('robots',[])]
 return not any(re.search(r'\b(?:noindex|none)\b',v,re.I)for v in directives)
def main(document):return P.CAP.first(P.tree(document),lambda n:n['tag']=='main')
def result_link(document,target):
 root=main(document)
 if not root:return None
 for n in P.walk(root):
  if n['tag']in ('h1','h2','h3','h4'):
   for a in P.walk(n):
    if a['tag']=='a'and own(a['attrs'].get('href',''))==target and P.norm(P.CAP.text(a)):return P.sha(P.CAP.sanitize(a,ORIGIN))
 return None

def context_identity(node,source_url,source_target):
 classes=node['attrs'].get('class','').split()
 if 'hentry'not in classes:return False
 ids={int(v[5:])for v in classes if re.fullmatch(r'post-[1-9][0-9]*',v)}
 value=node['attrs'].get('id','')
 if re.fullmatch(r'post-[1-9][0-9]*',value):ids.add(int(value[5:]))
 if ids!={source_target.get('sourcePostId')}:return False
 target=own(source_target.get('url',''))
 for h in P.walk(node):
  if h['tag']in ('h1','h2','h3','h4'):
   for a in P.walk(h):
    if a['tag']=='a'and own(a['attrs'].get('href',''),source_url)==target and P.norm(P.CAP.text(a)):return True
 return False

def prepare(source,source_document,view,view_document,reference):
 address=urlsplit(source.get('url',''));query=parse_qsl(address.query,keep_blank_values=True)
 search=address.path=='/'and len(query)==1 and query[0][0]=='s'and 0<len(query[0][1])<=120
 empty_taxonomy=address.path=='/'and sorted(query)==[('taxonomy',''),('term','')]
 if not(search and own(view.get('url',''))==own(source.get('url',''))or empty_taxonomy and own(view.get('url',''))in (ORIGIN+'/blog/',ORIGIN+'/blogs/')):return None
 original=reference['source'];target=reference['candidate'];document=reference['document'];url=own(original.get('url',''))
 if not all([bound(source,source_document),bound(view,view_document),bound(target,document)]):return None
 if source.get('status')!=200 or view.get('status')!=200 or original.get('status')!=200 or target.get('status')!=200 or original.get('template')not in ('page','post')or not original.get('sourcePostId'):return None
 if not url or target.get('url')!=url or target.get('extracted',{}).get('canonicalUrls')!=[url]or not indexable(target)or not indexable(original):return None
 link=result_link(view_document,url)
 if not link:return None
 return {'targetUrl':url,'sourceObjectId':original['sourcePostId'],'sourceTargetResponseSha256':original['bodySha256'],'candidateTargetResponseSha256':target['bodySha256'],'candidateViewResponseSha256':view['bodySha256'],'candidateResultLinkSha256':link}

def contexts(root):
 def visit(node,parent):
  if 'hentry'in node['attrs'].get('class','').split():parent=node
  yield node,parent
  for child in node['children']:
   if isinstance(child,dict):yield from visit(child,parent)
 return visit(root,None)

def image_witness(source,source_document,view,view_document,reference,image_url,alt,original_file_sha256,actual_files):
 proof=prepare(source,source_document,view,view_document,reference)
 if not proof:return None
 root=P.original_main(source,source_document)
 if not root:return None
 relation=None
 for node,parent in contexts(root):
  if node['tag']=='img'and parent is not None and P.owned_original(urljoin(source['url'],node['attrs'].get('src','')))==P.owned_original(image_url)and P.norm(node['attrs'].get('alt',''))==P.norm(alt)and context_identity(parent,source['url'],reference['source']):relation=P.sha(P.CAP.sanitize(parent,source['url']));break
 if not relation or not original_file_sha256:return None
 target_main=main(reference['document'])
 if not target_main:return None
 for node in P.walk(target_main):
  if node['tag']!='img':continue
  url=own(node['attrs'].get('src',''),proof['targetUrl']);record=actual_files.get(url,{})
  candidate_alt=P.norm(node['attrs'].get('alt',''))
  if url and record.get('status')==200 and record.get('mime','').startswith('image/')and record.get('sha256')==original_file_sha256 and (candidate_alt==P.norm(alt)or not P.norm(alt)and candidate_alt):
   return {**proof,'sourceResultSha256':relation,'sourceViewResponseSha256':source['bodySha256'],'fileSha256':original_file_sha256,'candidateImageUrlSha256':P.sha(url),'sourceAltSha256':P.sha(P.norm(alt)),'candidateAltSha256':P.sha(candidate_alt),'reason':'same_original_result_image_preserved_on_its_verified_linked_canonical_content_page'}
 return None

def block_witnesses(source,source_document,view,view_document,references,missing,redirects=None):
 remaining=__import__('collections').Counter(missing);witnesses=[];root=P.original_main(source,source_document);redirects=redirects or {}
 if not root:return {'fullyEquivalent':False,'remainingBlockHashes':dict(remaining),'witnesses':[]}
 def link_key(value,base):
  url=own(value,base)
  return redirects.get(url,url)if url else urljoin(base,value)
 for reference in references:
  proof=prepare(source,source_document,view,view_document,reference)
  if not proof:continue
  target=main(reference['document'])
  if not target:continue
  actual=P.norm(P.CAP.text(target));links={(link_key(n['attrs'].get('href',''),proof['targetUrl']),P.norm(P.CAP.text(n)))for n in P.walk(target)if n['tag']=='a'}
  for node,parent in contexts(root):
   value=P.norm(P.CAP.text(node));key=P.sha(value)
   if node['tag']not in P.BLOCKS or not remaining.get(key)or parent is None or not context_identity(parent,source['url'],reference['source']):continue
   expected=[(link_key(n['attrs'].get('href',''),source['url']),P.norm(P.CAP.text(n)))for n in P.walk(node)if n['tag']=='a']
   if P.whole_text(actual,value)and all(link in links for link in expected):
    remaining[key]-=1;witnesses.append({**proof,'sourceViewResponseSha256':source['bodySha256'],'blockSha256':key,'sourceResultSha256':P.sha(P.CAP.sanitize(parent,source['url'])),'reason':'exact_original_result_text_and_links_preserved_on_its_verified_canonical_content_page'})
 return {'fullyEquivalent':not +remaining,'remainingBlockHashes':dict(+remaining),'witnesses':witnesses}
