"""Strict iCalendar property preservation; callers bind published facts and HTTP bodies.

This does not approve events or infer recurrence. Unexplained changes remain open.
"""
import collections,datetime,hashlib,re,unicodedata

def sha(value):return hashlib.sha256(value.encode('utf8')).hexdigest()
def unfold(value):return re.sub(r'\r?\n[ \t]','',value)
def unescape(value):return re.sub(r'\\([nN,;\\])',lambda m:'\n'if m[1]in'nN'else m[1],value)
def words(value):return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',unescape(value)).replace('’',"'").replace('‘',"'")).strip()
def parse(value):
 value=unfold(value.lstrip('\ufeff'));assert value.startswith('BEGIN:VCALENDAR')and value.rstrip().endswith('END:VCALENDAR'),'invalid_calendar_envelope'
 result={};duplicates=[]
 for part in value.split('BEGIN:VEVENT')[1:]:
  assert 'END:VEVENT'in part,'unclosed_calendar_event';props=collections.defaultdict(list)
  for line in part.split('END:VEVENT',1)[0].strip().splitlines():
   assert ':'in line,'invalid_calendar_property';key,item=line.split(':',1);props[key.split(';',1)[0]].append((key,item))
  assert len(props['UID'])==1 and props['UID'][0][1],'calendar_uid_required';uid=props['UID'][0][1]
  if uid in result:duplicates.append(sha(uid))
  result[uid]=dict(props)
 return result,duplicates

def compare(source,candidate,published_facts=None):
 old,old_duplicates=parse(source);new,new_duplicates=parse(candidate);facts=published_facts or {};missing=sorted(sha(uid)for uid in set(old)-set(new));differences=[];explained=[]
 for uid in sorted(set(old)&set(new)):
  before=old[uid];after=new[uid];fact=facts.get(uid,{})
  for key in sorted(set(before)|set(after)):
   a=before.get(key,[]);b=after.get(key,[])
   if a==b:continue
   reason=None
   if key=='DTSTAMP'and len(b)==1 and b[0][0]=='DTSTAMP'and re.fullmatch(r'\d{8}T\d{6}Z',b[0][1]):
    try:datetime.datetime.strptime(b[0][1],'%Y%m%dT%H%M%SZ');reason='valid_export_generation_timestamp'
    except ValueError:pass
   elif key=='DESCRIPTION'and len(a)==len(b)==1 and a[0][0]==b[0][0]and words(a[0][1])==words(b[0][1]):reason='rfc_text_whitespace_and_apostrophe_formatting'
   elif key=='SEQUENCE'and len(b)==1 and b[0][0]=='SEQUENCE'and isinstance(fact.get('sequence'),int)and b[0][1]==str(fact['sequence'])and(not a or len(a)==1 and a[0][1].isdigit()and int(a[0][1])<=fact['sequence']):reason='exact_current_published_revision_sequence'
   elif key=='STATUS'and not a and len(b)==1 and b[0][0]=='STATUS'and isinstance(fact.get('cancelled'),bool)and b[0][1]==('CANCELLED'if fact['cancelled']else'CONFIRMED'):reason='exact_current_published_cancellation_state'
   elif key=='LAST-MODIFIED'and len(b)==1 and b[0][0]=='LAST-MODIFIED'and b[0][1]==fact.get('modifiedUtc')and fact.get('auditBound')is True:reason='exact_audited_published_modification_time'
   entry={'uidSha256':sha(uid),'property':key,'sourceSha256':sha(repr(a)),'candidateSha256':sha(repr(b))}
   if reason:explained.append({**entry,'reason':reason})
   else:differences.append(entry)
 return {'sourceEvents':len(old),'candidateEvents':len(new),'matchedEvents':len(set(old)&set(new)),'missingOriginalUIDHashes':missing,'sourceDuplicateUIDHashes':old_duplicates,'candidateDuplicateUIDHashes':new_duplicates,'unexplainedProperties':differences,'explainedProperties':explained,'fullyEquivalent':not(missing or old_duplicates or new_duplicates or differences)}
