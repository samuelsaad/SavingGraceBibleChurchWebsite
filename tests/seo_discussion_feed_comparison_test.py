import importlib.util,pathlib,unittest,hashlib
S=importlib.util.spec_from_file_location('discussion',pathlib.Path(__file__).parents[1]/'scripts/seo-discussion-feed-comparison.py');M=importlib.util.module_from_spec(S);S.loader.exec_module(M)
URL=M.ORIGIN+'/event/anonymous/2026-10-20/feed/'
def xml(origin=M.ORIGIN,item='',date='Tue, 20 Oct 2026 00:00:00 +0000'):
 return('<rss version="2.0"><channel><title>Comments on: Anonymous</title><link>'+origin+'/event/anonymous/2026-10-20/</link><lastBuildDate>'+date+'</lastBuildDate>'+item+'</channel></rss>').encode()
def record(raw,url=URL):return{'url':url,'status':200,'bodySha256':hashlib.sha256(raw).hexdigest(),'headers':{'content-type':'application/rss+xml; charset=UTF-8'}}
class DiscussionFeedComparisonTests(unittest.TestCase):
 def test_exact_archive_and_verified_hostname_normalization_preserve_every_field(self):
  a=xml('https://savinggrace.org.au');b=xml();proof=M.compare(record(a,URL.replace('www.','')),a,record(b),b);self.assertTrue(proof['equivalent']);self.assertFalse(proof['liveCalendarBehaviorProven']);self.assertEqual(proof['items'],0)
 def test_changed_date_content_parent_or_item_is_never_explained(self):
  old=xml()
  for raw in[xml(date='Wed, 21 Oct 2026 00:00:00 +0000'),xml(item='<item><title>Added comment</title></item>'),old.replace(b'Comments on: Anonymous',b'Comments on: Other'),old.replace(b'/event/anonymous/',b'/event/other/')]:self.assertFalse(M.compare(record(old),old,record(raw),raw)['equivalent'])
 def test_empty_calendar_and_unbound_bytes_cannot_use_this_policy(self):
  body=xml();self.assertFalse(M.compare(record(body,M.ORIGIN+'/events/?ical=1'),body,record(body),body)['equivalent']);self.assertFalse(M.compare(record(body),body,record(body),b'changed')['equivalent']);self.assertFalse(M.compare(record(body),body,{**record(body),'status':404},body)['equivalent'])
