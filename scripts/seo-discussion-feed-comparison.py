"""Exact retained zero-item discussion feed comparison; never a live-calendar waiver."""
import hashlib,re,xml.etree.ElementTree as ET
from urllib.parse import urlsplit
ORIGIN='https://www.savinggrace.org.au'
def digest(raw):return hashlib.sha256(raw).hexdigest()
def own(value):
 try:
  u=urlsplit(value)
  return ORIGIN+u.path+('?' +u.query if u.query else '')+('#'+u.fragment if u.fragment else '')if u.scheme in('http','https')and u.hostname in('savinggrace.org.au','www.savinggrace.org.au')and not(u.username or u.password or u.port)else None
 except (ValueError,TypeError):return None
def compare(source,source_body,candidate,candidate_body):
 failure=lambda code:{'equivalent':False,'issues':[code]}
 a=own(source.get('url',''));b=own(candidate.get('url',''))
 if not a or a!=b or not re.fullmatch(re.escape(ORIGIN)+r'/event/[a-z0-9-]+/20[0-9]{2}-[0-9]{2}-[0-9]{2}/feed/',a):return failure('not_same_observed_event_discussion_feed')
 for record,body in((source,source_body),(candidate,candidate_body)):
  mime=record.get('headers',{}).get('content-type',record.get('mime','')).split(';')[0].strip().lower()
  if record.get('status')!=200 or mime!='application/rss+xml'or digest(body)!=record.get('bodySha256'):return failure('discussion_source_or_response_not_bound')
  if b'<!DOCTYPE'in body.upper()or b'<!ENTITY'in body.upper():return failure('discussion_external_declaration_refused')
 def parsed(body):
  root=ET.fromstring(body);channels=root.findall('channel')
  if root.tag!='rss'or len(channels)!=1:raise ValueError('rss_shape')
  channel=channels[0]
  if any(node.tag.rsplit('}',1)[-1]=='item'for node in channel)or not(channel.findtext('title')or'').strip().startswith('Comments on:'):raise ValueError('not_zero_item_discussion')
  link=own((channel.findtext('link')or'').strip())
  if not link or urlsplit(link).path!=urlsplit(a).path[:-5]:raise ValueError('discussion_parent_changed')
  def value(text):
   raw=(text or'').strip();return own(raw)or raw
  def tree(node):return[node.tag,sorted((key,value(v))for key,v in node.attrib.items()),value(node.text),[tree(child)for child in node]]
  return tree(root)
 try:old=parsed(source_body);new=parsed(candidate_body)
 except(ET.ParseError,ValueError):return failure('discussion_structure_or_parent_invalid')
 if old!=new:return failure('discussion_original_fields_changed')
 import json
 return{'equivalent':True,'issues':[],'sourceBodySha256':digest(source_body),'candidateBodySha256':digest(candidate_body),'normalizedTreeSha256':digest(json.dumps(old,ensure_ascii=False,separators=(',',':')).encode()),'parentPath':urlsplit(a).path[:-5],'items':0,'reason':'exact_original_zero_item_discussion_archive_with_only_owned_origin_normalization','liveCalendarBehaviorProven':False}
