"""Exact recording evidence kept separate from the original metadata-only crawl."""
import json,hashlib
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit,urljoin

def sha(data):return hashlib.sha256(data).hexdigest()

def load_recording_evidence(path,bundle,bindings):
 if not path:return {},{}
 p=Path(path);v=json.loads(p.read_bytes());proof_path=p.parent/'full-body-http.private.json';raw=proof_path.read_bytes();proof=json.loads(raw)
 if v.get('format')!='sgbc-recording-supplement-v1' or v.get('sourceBundleSha256')!=bindings['bundleSha256'] or v.get('expectedRuntimeLabel')!=bindings.get('expectedRuntimeLabel') or sha(raw)!=v.get('fullBodyProofSha256') or proof.get('expectedRuntimeLabel')!=v['expectedRuntimeLabel'] or proof.get('checked')!=118 or proof.get('failed')!=0:raise ValueError('recording_supplement_binding')
 source={};files={};pages={page['sourceUrl']:page for page in bundle['pages']if page.get('asset')and page['asset']['contentType']in ('audio/mpeg','video/mp4')};full={row['path']:row for row in proof['rows']}
 if len(v.get('sourceRows',[]))!=118 or len(pages)!=118 or len(full)!=118 or Counter(p['asset']['contentType']for p in pages.values())!={'audio/mpeg':117,'video/mp4':1}:raise ValueError('recording_supplement_scope')
 for row in v['sourceRows']:
  url=row['url'];page=pages.get(url);asset=page.get('asset')if page else None;parsed=urlsplit(url);observed=full.get(parsed.path,{})
  if url in source or not asset or row.get('status')!=200 or row.get('sourcePostId')!=page['sourceId'] or row.get('bodySha256')!=asset['sha256'] or row.get('bodyBytes')!=asset['bytes'] or row.get('headers',{}).get('content-type')!=asset['contentType'] or observed.get('sha256')!=asset['sha256'] or observed.get('bytes')!=asset['bytes'] or observed.get('mime','').split(';')[0]!=asset['contentType']or observed.get('issues')!=[] or observed.get('rangeVerified')is not True:raise ValueError('recording_supplement_file_identity')
  source[url]=row;files[parsed.path]=asset
 responses={}
 for row in v.get('responses',[]):
  url=row['url'];u=urlsplit(url);headers=row.get('headers',{});status=row.get('status')
  if url in responses or u.hostname not in ('savinggrace.org.au','www.savinggrace.org.au')or u.scheme not in ('http','https')or u.username or u.password or u.port or headers.get('x-seo-candidate')!=v['expectedRuntimeLabel']:raise ValueError('recording_supplement_response_identity')
  if status==200:
   asset=files.get(u.path)
   if not asset or row.get('bodySha256')!=asset['sha256']or row.get('byteCount')!=asset['bytes']or headers.get('content-type','').split(';')[0]!=asset['contentType']or headers.get('content-length')!=str(asset['bytes'])or headers.get('etag')!='"'+asset['sha256']+'"'or row.get('rangeContentRange')!='bytes 0-1023/'+str(asset['bytes'])or row.get('rangePrefixSha256')!=row.get('verifiedSourcePrefixSha256')or len(row.get('rangePrefixSha256',''))!=64:raise ValueError('recording_supplement_response_file')
  elif status==301:
   target=urlsplit(urljoin(url,headers.get('location','')))
   if target.scheme!='https'or target.hostname!='www.savinggrace.org.au'or target.path not in files or target.username or target.password or target.port:raise ValueError('recording_supplement_redirect_target')
  else:raise ValueError('recording_supplement_response_status')
  responses[url]=row
 return source,responses

def source_with_recording_observation(record,url,sources):
 if not record:return record
 u=urlsplit(url);preferred='https://www.savinggrace.org.au'+u.path;observed=sources.get(preferred)
 if not observed or u.scheme not in ('http','https')or u.hostname not in ('savinggrace.org.au','www.savinggrace.org.au'):return record
 if record.get('metadataOnly')is not True or record.get('status')!=200:return record
 headers=record.get('headers',{});new_headers=observed['headers']
 if record.get('sourcePostId')not in (None,observed['sourcePostId'])or record.get('bodyBytes')!=0 or record.get('bodySha256')!=sha(b'')or headers.get('content-type','').split(';')[0]!=new_headers['content-type']or headers.get('content-length')!=new_headers['content-length']:raise ValueError('recording_source_metadata_conflict')
 return {**record,**observed,'url':url,'earlierMetadataOnlyResponseSha256':record['bodySha256'],'earlierCapturedAt':record.get('capturedAt'),'recordingSourceObservationUrl':preferred,'metadataOnly':False}
