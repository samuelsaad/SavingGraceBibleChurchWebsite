import unittest,importlib.util,tempfile,json,hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location('aliases',Path(__file__).parents[1]/'scripts/seo-generate-observed-aliases.py');M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
class AliasExtraction(unittest.TestCase):
 def test_only_verified_same_identity_redirects_are_admitted(self):
  with tempfile.TemporaryDirectory()as d:
   root=Path(d);pages={};origin='https://www.savinggrace.org.au';digest='a'*64
   def add(path,status,target=None,sourceid=None):
    url=origin+path;name=hashlib.sha256(url.encode()).hexdigest()+'.json';r={'url':url,'status':status,'bodySha256':digest,'sourcePostId':sourceid,'headers':{}}
    if target:r['redirectTarget']=origin+target
    (root/name).write_text(json.dumps(r));pages[url]={'status':status,'bodySha256':digest,'recordPath':name}
   add('/?p=42',301,'/event/example/2024-01-14/');add('/?p=43',301,'/event/example/2024-01-14/');add('/bad',301,'/');add('/loop',301,'/loop');add('/event/example/2024-01-14/',200,sourceid=42);add('/',200)
   (root/'ledger.private.json').write_text(json.dumps({'pages':pages}));bundle={'pages':[{'path':'/event/example/2024-01-14/','sourceId':42,'kind':'event','issues':[],'responseSha256':digest}]}
   rows=M.generate(root,bundle);self.assertEqual([r['alias']for r in rows],['/?p=42']);self.assertEqual(rows[0]['chain'][-1]['status'],200)
   bundle['pages'][0]['responseSha256']='b'*64;self.assertEqual(M.generate(root,bundle),[])
 def test_non_numeric_archive_aliases_bind_the_exact_response_without_inventing_a_wordpress_id(self):
  with tempfile.TemporaryDirectory()as d:
   root=Path(d);origin='https://www.savinggrace.org.au';digest='a'*64;old=origin+'/?post_type=tribe_events&paged=2';target=origin+'/events/day/page/2/';records=[{'url':old,'status':301,'bodySha256':digest,'redirectTarget':target},{'url':target,'status':200,'bodySha256':digest}];pages={}
   for i,r in enumerate(records):
    name=str(i)+'.json';(root/name).write_text(json.dumps(r));pages[r['url']]={'status':r['status'],'bodySha256':digest,'recordPath':name}
   (root/'ledger.private.json').write_text(json.dumps({'pages':pages}));bundle={'pages':[{'path':'/events/day/page/2/','sourceId':None,'kind':'archive','issues':[],'responseSha256':digest}]};rows=M.generate(root,bundle);self.assertEqual(len(rows),1);self.assertIsNone(rows[0]['sourceId'])
 def test_private_external_and_encoded_paths_are_refused(self):
  for value in ['https://evil.example/x','https://www.savinggrace.org.au/admin/x','https://www.savinggrace.org.au/a%2Fb','https://user:pass@www.savinggrace.org.au/x']:
   self.assertIsNone(M.path(value))
if __name__=='__main__':unittest.main()
