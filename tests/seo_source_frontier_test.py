"""Synthetic fixed-frontier controls; no public network or original content."""
import importlib.util,json,tempfile,unittest,threading
from pathlib import Path
from unittest.mock import patch
SPEC=importlib.util.spec_from_file_location('frontier',Path(__file__).parents[1]/'scripts/seo-source-frontier.py');F=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(F)
O='https://www.savinggrace.org.au/'
class FixedFrontierTests(unittest.TestCase):
 def test_fixed_queue_preserves_requested_priority_and_excludes_known(self):
  source={'pages':{O+'old/':{}},'excluded':{O+'excluded/':'reason'},'deferred':{O+'old/':{},O+'excluded/':{},O+'?p=1':{'reason':'source_declared_shortlink_unverified'},O+'feed/':{'reason':'source_declared_feed_variant_unverified'},O+'secondary/':{'reason':'observed_only_on_nonexpanding_response_unverified'}}}
  self.assertEqual(list(F.frontier(source)),[O+'secondary/',O+'feed/',O+'?p=1'])
 def test_forbidden_targets_fail_closed_and_calendar_exports_permitted(self):
  for url in [O+'x.mp3',O+'x.mp4',O+'wp-admin/',O+'?action=edit',O+'?_wpnonce=secret','https://elsewhere.example/a/',O+'file.zip']:
   self.assertFalse(F.safe_target(url))
   with self.assertRaisesRegex(ValueError,'forbidden_target'):F.frontier({'pages':{},'deferred':{url:{}}})
  self.assertTrue(F.safe_target(O+'events/?ical=1'))
 def test_capture_keeps_new_links_without_requesting_them(self):
  with tempfile.TemporaryDirectory() as root:
   job=F.FixedCapture(Path(root)/'private',F.RateLimiter())
   raw=b'<html><body class="page"><main><p>Example only</p><a href="/new/">Next</a></main></body></html>'
   metadata={'url':O+'fixed/','status':200,'headers':{'content-type':'text/html'},'capturedAt':'2026-01-01T00:00:00Z','attempts':1,'bodySha256':F.CAP.digest(raw)}
   with patch.object(job,'get',return_value=(metadata,raw)) as get:
    job.capture(O+'fixed/')
   get.assert_called_once_with(O+'fixed/');self.assertIn(O+'new/',job.state['discovered']);self.assertNotIn(O+'new/',job.state['pages'])
 def test_shared_limiter_serializes_request_starts(self):
  clock=[100.];sleeps=[]
  def sleep(duration):sleeps.append(duration);clock[0]+=duration
  limiter=F.RateLimiter(1)
  with patch.object(F.time,'monotonic',side_effect=lambda:clock[0]),patch.object(F.time,'sleep',side_effect=sleep):
   limiter.acquire();limiter.acquire();limiter.acquire()
  self.assertEqual(sleeps,[0,1,1]);self.assertEqual(limiter.last,102.)
 def test_parent_state_is_deep_copied_and_hash_bound(self):
  with tempfile.TemporaryDirectory() as root:
   parent=Path(root)/'private'/'original';parent.mkdir(parents=True);source_file=parent/'ledger.private.json';source={'pages':{O:{'recordPath':'pages/one.json'}},'deferred':{O+'next/':{'reason':'source_declared_feed_variant_unverified'}},'excluded':{},'discovered':{}};source_file.write_text(json.dumps(source),encoding='utf-8')
   output=parent.parent/'extension';state=F.create_state(source,source_file,output);state['pages'][O]['recordPath']='changed'
   self.assertEqual(source['pages'][O]['recordPath'],'pages/one.json');self.assertEqual(state['parentLedgerSha256'],F.CAP.digest(source_file.read_bytes()));self.assertFalse(state['completed'])
 def test_parent_response_hash_is_checked(self):
  with tempfile.TemporaryDirectory() as root:
   p=Path(root);(p/'body').write_bytes(b'changed');(p/'record.json').write_text(json.dumps({'responsePath':'body','bodySha256':F.CAP.digest(b'original')}),encoding='utf-8')
   with self.assertRaisesRegex(ValueError,'hash_mismatch'):F.verified_record(p,{'recordPath':'record.json'})
if __name__=='__main__':unittest.main()
