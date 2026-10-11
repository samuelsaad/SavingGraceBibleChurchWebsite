import copy, csv, importlib.util, json, tempfile, unittest
from pathlib import Path
ROOT=Path(__file__).parents[1]
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
F=module('frontier_delta','seo-frontier-delta.py');R=module('reconcile_continuation','seo-reconcile-continuation.py')

class FrontierDeltaTests(unittest.TestCase):
 def test_selection_keeps_new_uncaptured_and_later_capture_without_generating_urls(self):
  a='https://www.savinggrace.org.au/example/';b=a+'?page=2';c='https://www.savinggrace.org.au/other/'
  old={'pages':{a:{'bodySha256':'a'*64}},'discovered':{b:{}}}
  current={'pages':{a:{'bodySha256':'a'*64},b:{'bodySha256':'b'*64}},'discovered':{c:{}}}
  selected,new,later=F.selected_urls(old,current,{})
  self.assertEqual(selected,{b,c});self.assertEqual(new,{c});self.assertEqual(later,{b})
 def test_later_robots_disposition_is_retained_even_without_a_response(self):
  url='https://www.savinggrace.org.au/example/'
  old={'deferred':{url:{'reason':'pending'}}}
  current={'excluded':{url:'robots_disallow'}}
  selected,new,later=F.selected_urls(old,current,{})
  self.assertEqual(selected,{url});self.assertEqual(new,set());self.assertEqual(later,{url})
 def test_incomplete_queue_refuses_before_creating_output(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t)/'private';root.mkdir();paths=[]
   for name,value in [('old',{'htmlPhaseFrozen':True}),('current',{'frontierComplete':False}),('assets',{}),('bundle',{})]:
    d=root/name;d.mkdir();p=d/'input.json';p.write_text(json.dumps(value));paths.append(p)
   out=root/'delta'
   with self.assertRaisesRegex(ValueError,'finite_queue_not_complete'):F.freeze(*paths,out)
   self.assertFalse(out.exists())
 def test_freeze_validates_source_hash_and_preserves_uncaptured_discovery(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t)/'private';root.mkdir();a='https://www.savinggrace.org.au/example/';b='https://www.savinggrace.org.au/events/?page=2'
   current={'htmlPhaseFrozen':True,'frontierComplete':True,'pendingUrls':[], 'fixedFrontier':{a:{}},'fixedFrontierOutcomes':{a:{}},'pages':{},'discovered':{b:{}},'updatedAt':'2026-10-11T00:00:00Z'}
   paths=[]
   for name,value in [('old',{'htmlPhaseFrozen':True}),('current',current),('assets',{}),('bundle',{'pages':[],'expectedVersions':{}})]:
    d=root/name;d.mkdir();p=d/'input.json';p.write_text(json.dumps(value));paths.append(p)
   proof=F.freeze(*paths,root/'delta');self.assertEqual(proof['deltaRows'],1);self.assertEqual(proof['uncapturedDeltaUrls'],1)
   self.assertEqual(proof['sourceRequests'],0);self.assertFalse(proof['authoritativeSourceCoverageProven'])

def report(folder,rows,bindings):
 folder.mkdir()
 for name,fields in [('seo-url-migration-map.csv',R.E.MAP_FIELDS),('seo-content-metadata-diff.csv',R.E.DIFF_FIELDS)]:
  with (folder/name).open('w',encoding='utf8',newline='') as f:
   w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
 counts={d:sum(r['disposition']==d for r in rows) for d in R.E.DISPOSITIONS}
 (folder/'seo-acceptance-summary.json').write_text(json.dumps({'format':'sgbc-seo-safe-acceptance-v1','bindings':bindings,'inventoryCount':len(rows),'dispositionCounts':counts}))

class ContinuationReconciliationTests(unittest.TestCase):
 def setup_reports(self,root):
  old=[{'source_url_sha256':'a'*64,'disposition':'preserved'},{'source_url_sha256':'b'*64,'disposition':'unresolved'}]
  new=[{'source_url_sha256':'b'*64,'disposition':'preserved'},{'source_url_sha256':'c'*64,'disposition':'unresolved'}]
  report(root/'old',old,{'baselineSha256':'1'*64});report(root/'new',new,{'baselineSha256':'2'*64,'assetsSha256':'3'*64,'bundleSha256':'4'*64})
  proof={'format':'sgbc-seo-finite-frontier-delta-v1','candidateChecksPerformed':False,'previousBaselineSha256':'1'*64,'ledgerSha256':'2'*64,'assetsSha256':'3'*64,'bundleSha256':'4'*64,'deltaRows':2,'newObservedUrls':1,'laterEvidencePreviouslyObservedUrls':1}
  path=root/'proof.json';path.write_text(json.dumps(proof));return path,proof
 def test_all_previous_rows_retained_with_explicit_later_source_outcomes(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);path,proof=self.setup_reports(root);original=R.sha(root/'old/seo-url-migration-map.csv')
   result=R.reconcile(root/'old',root/'new',path,root/'out')
   self.assertEqual(result['inventoryCount'],3);self.assertEqual((result['previousRows'],result['newRows'],result['updatedRows']),(2,1,1))
   self.assertEqual(result['dispositionCounts']['unresolved'],1);self.assertEqual(R.sha(root/'old/seo-url-migration-map.csv'),original)
 def test_wrong_binding_or_denominator_fails_closed(self):
  with tempfile.TemporaryDirectory() as t:
   root=Path(t);path,proof=self.setup_reports(root);proof['ledgerSha256']='5'*64;path.write_text(json.dumps(proof))
   with self.assertRaisesRegex(ValueError,'binding_invalid'):R.reconcile(root/'old',root/'new',path,root/'out')
   self.assertFalse((root/'out').exists());proof['ledgerSha256']='2'*64;proof['newObservedUrls']=0;path.write_text(json.dumps(proof))
   with self.assertRaisesRegex(ValueError,'denominator_invalid'):R.reconcile(root/'old',root/'new',path,root/'out')

if __name__=='__main__':unittest.main()
