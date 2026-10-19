"""Freeze observed one-to-one HTML aliases from an existing private capture; no network.
Only safe paths, identities, response hashes and redirect statuses enter the output.
"""
import argparse, hashlib, json, re, urllib.parse
from pathlib import Path
HOSTS={'www.savinggrace.org.au','savinggrace.org.au'}
REDIRECTS={301,302,303,307,308}
PRIVATE=re.compile(r'^/(?:admin|api|frontend-preview|draft-preview|cms-preview|cms-editor-frame|health|__local)(?:/|$)')
def path(url):
 u=urllib.parse.urlsplit(url)
 if u.scheme not in ('https','http') or u.hostname not in HOSTS or u.username or u.password or u.fragment:return None
 value=u.path+('?' +u.query if u.query else '')
 if len(value)>2000 or PRIVATE.match(urllib.parse.unquote(u.path)) or re.search(r'[\\\x00-\x20]|%(?:2f|5c|00|0[ad])',u.path,re.I):return None
 return value

def generate(root,bundle):
 ledger=json.loads((root/'ledger.private.json').read_text(encoding='utf8'));pages={p['path']:p for p in bundle['pages']};out={};cache={}
 def record(url):
  if url not in cache:
   item=ledger['pages'].get(url)
   if not item:return None
   p=(root/item['recordPath']).resolve()
   if not p.is_relative_to(root.resolve()) or p.is_symlink():raise ValueError('source_record_path_refused')
   raw=p.read_bytes();r=json.loads(raw)
   if r['url']!=url or r.get('bodySha256')!=item.get('bodySha256'):raise ValueError('source_record_binding_invalid')
   cache[url]=(r,hashlib.sha256(raw).hexdigest())
  return cache[url]
 for original,summary in sorted(ledger['pages'].items()):
  alias=path(original)
  if not alias or summary['status'] not in REDIRECTS:continue
  current=original;seen=set();chain=[]
  while current not in seen and len(seen)<8:
   seen.add(current);pair=record(current)
   if not pair:break
   r,sha=pair;chain.append({'urlSha256':hashlib.sha256(current.encode()).hexdigest(),'recordSha256':sha,'status':r['status']})
   if r['status'] not in REDIRECTS:break
   current=r.get('redirectTarget')or urllib.parse.urljoin(current,r['headers'].get('location',''))
   if not path(current):break
  target=path(current);page=pages.get(target)
  if not pair or r['status']!=200 or not page or page['issues'] or page['kind'] in ('asset','feed') or page['sourceId'] is None or target=='/' or alias==target or page['responseSha256']!=r['bodySha256']:continue
  q=urllib.parse.parse_qs(urllib.parse.urlsplit(original).query,keep_blank_values=True)
  identities=[q[k] for k in ('p','page_id','related_series') if k in q]
  if identities and (len(identities)!=1 or identities[0]!=[str(page['sourceId'])]):continue
  value={'alias':alias,'target':target,'sourceId':page['sourceId'],'kind':page['kind'],'responseSha256':page['responseSha256'],'chain':chain}
  prior=out.get(alias)
  if prior and any(prior[k]!=value[k] for k in ('target','sourceId','kind','responseSha256')):raise ValueError('source_alias_conflict')
  if not prior:out[alias]=value
 return list(out.values())

def render(rows):
 parts=[];names=[]
 for i in range(0,len(rows),50):
  name='part'+str(i//50);names.append(name)
  parts.append('const '+name+': readonly ObservedSourceAlias[] = [\n'+',\n'.join(json.dumps(row,separators=(',',':'))for row in rows[i:i+50])+'\n];')
 return '/** Frozen observed aliases, D-183. Regenerate with scripts/seo-generate-observed-aliases.py. */\nimport type {ObservedSourceAlias} from "./source-observed-aliases";\n'+'\n'.join(parts)+'\nexport const observedSourceAliases: readonly ObservedSourceAlias[] = Object.freeze(['+','.join('...'+name for name in names)+']);\n'

def main():
 a=argparse.ArgumentParser();a.add_argument('--baseline',type=Path,required=True);a.add_argument('--bundle',type=Path,required=True);a.add_argument('--output',type=Path,required=True);v=a.parse_args()
 rows=generate(v.baseline,json.loads(v.bundle.read_text(encoding='utf8')))
 v.output.write_text(render(rows),encoding='utf8')
 print(json.dumps({'observedAliases':len(rows),'sha256':hashlib.sha256(v.output.read_bytes()).hexdigest()}))
if __name__=='__main__':main()
