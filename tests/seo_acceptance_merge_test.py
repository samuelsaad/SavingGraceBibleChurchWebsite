import csv,importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('merge',Path(__file__).parents[1]/'scripts/seo-merge-acceptance.py');M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
def report(path,key,disposition):
 path.mkdir()
 for name in ('seo-url-migration-map.csv','seo-content-metadata-diff.csv'):
  with (path/name).open('w',newline='',encoding='utf8') as stream:w=csv.DictWriter(stream,fieldnames=M.EXPECTED[name]);w.writeheader();w.writerow({'source_url_sha256':key,'disposition':disposition})
 (path/'seo-acceptance-summary.json').write_text(json.dumps({'format':'sgbc-seo-safe-acceptance-v1','bindings':{'anonymous':'fixture'},'inventoryCount':1,'dispositionCounts':{disposition:1}}),encoding='utf8')
class MergeTests(unittest.TestCase):
 def test_union_retains_unresolved_and_binds_outputs(self):
  with tempfile.TemporaryDirectory() as root:
   root=Path(root);report(root/'a','a'*64,'preserved');report(root/'b','b'*64,'unresolved');v=M.merge([root/'a',root/'b'],root/'out');self.assertEqual(v['inventoryCount'],2);self.assertEqual(v['dispositionCounts']['unresolved'],1);self.assertEqual(v['verdict'],'NOT_READY');self.assertEqual(v['outputHashes']['seo-url-migration-map.csv'],M.sha(root/'out/seo-url-migration-map.csv'))
 def test_duplicate_or_count_mismatch_refuses(self):
  with tempfile.TemporaryDirectory() as root:
   root=Path(root);report(root/'a','a'*64,'preserved');report(root/'b','a'*64,'unresolved')
   with self.assertRaisesRegex(ValueError,'duplicate_identity'):M.merge([root/'a',root/'b'],root/'out')
   p=root/'a/seo-acceptance-summary.json';v=json.loads(p.read_text());v['inventoryCount']=2;p.write_text(json.dumps(v))
   with self.assertRaisesRegex(ValueError,'count_mismatch'):M.merge([root/'a'],root/'out')
 def test_disposition_summary_or_diff_tampering_refuses(self):
  with tempfile.TemporaryDirectory() as root:
   root=Path(root);report(root/'a','a'*64,'unresolved');p=root/'a/seo-acceptance-summary.json';v=json.loads(p.read_text(encoding='utf8'));v['dispositionCounts']={'preserved':1};p.write_text(json.dumps(v),encoding='utf8')
   with self.assertRaisesRegex(ValueError,'disposition_counts_mismatch'):M.merge([root/'a'],root/'out')
   v['dispositionCounts']={'unresolved':1};p.write_text(json.dumps(v),encoding='utf8')
   with (root/'a/seo-content-metadata-diff.csv').open('w',newline='',encoding='utf8') as stream:w=csv.DictWriter(stream,fieldnames=M.EXPECTED['seo-content-metadata-diff.csv']);w.writeheader();w.writerow({'source_url_sha256':'a'*64,'disposition':'preserved'})
   with self.assertRaisesRegex(ValueError,'diff_disposition_mismatch'):M.merge([root/'a'],root/'out')
if __name__=='__main__':unittest.main()
