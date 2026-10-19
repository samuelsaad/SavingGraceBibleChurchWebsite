import pathlib,tempfile,json,hashlib,importlib.util,unittest
p=pathlib.Path(__file__).parents[1];s=importlib.util.spec_from_file_location('identity_export',p/'scripts/seo-export-acceptance.py');E=importlib.util.module_from_spec(s);s.loader.exec_module(E)
class IdentitySupplementTest(unittest.TestCase):
 def fixture(self,root):
  url='https://www.savinggrace.org.au/anonymous/';body=b'anonymous retained resource';(root/'response.body').write_bytes(body);record={'url':url,'status':200,'sourcePostId':77,'bodySha256':E.digest(body),'responsePath':'response.body','headers':{'content-type':'application/pdf'}};raw=json.dumps(record).encode();(root/'record.json').write_bytes(raw);summary={'recordPath':'record.json','bodySha256':record['bodySha256'],'sourcePostId':None};ledger={'pages':{url:summary}};base=root/'baseline.json';base.write_text(json.dumps(ledger));row={'sourceUrlSha256':E.digest(url),'sourceId':77,'sourceRecordSha256':E.digest(raw),'sourceResponseSha256':record['bodySha256']};manifest={'format':'sgbc-missing-inventory-identities-v1','sourceLedgerSha256':E.digest(base.read_bytes()),'parserSha256':E.digest(pathlib.Path(E.VERIFY.parser.__file__).read_bytes()),'rows':[row]};return url,record,summary,ledger,base,row,manifest
 def test_exact_missing_summary_id_is_recovered_without_changing_inventory(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);url,record,summary,ledger,base,row,manifest=self.fixture(root);supp=root/'supplement.json';supp.write_text(json.dumps(manifest));identities=E.source_identity_supplements(supp,base,ledger);self.assertIsNone(summary['sourcePostId']);E.verify_source_identity(url,summary,record,identities);self.assertEqual(E.source_records(root,ledger,identities)[url]['sourcePostId'],77)
 def test_known_conflicting_id_is_never_overridden(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);url,record,summary,ledger,base,row,manifest=self.fixture(root);summary['sourcePostId']=78;supp=root/'supplement.json';supp.write_text(json.dumps(manifest))
   with self.assertRaisesRegex(ValueError,'existing_identity'):E.source_identity_supplements(supp,base,ledger)
   with self.assertRaisesRegex(ValueError,'identity_mismatch'):E.verify_source_identity(url,summary,record,{E.digest(url):row})
 def test_raw_record_source_body_and_parser_are_hash_bound(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);url,record,summary,ledger,base,row,manifest=self.fixture(root);supp=root/'supplement.json'
   for changed in [{**manifest,'parserSha256':'a'*64},{**manifest,'rows':[{**row,'sourceRecordSha256':'a'*64}]},{**manifest,'rows':[{**row,'sourceResponseSha256':'a'*64}]},{**manifest,'rows':[{**row,'sourceId':78}]}]:
    supp.write_text(json.dumps(changed))
    with self.assertRaises(ValueError):E.source_identity_supplements(supp,base,ledger)
 def test_missing_supplement_and_duplicate_or_unknown_scope_fail(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);url,record,summary,ledger,base,row,manifest=self.fixture(root);supp=root/'supplement.json'
   with self.assertRaisesRegex(ValueError,'identity_mismatch'):E.verify_source_identity(url,summary,record)
   for rows in [[row,row],[{**row,'sourceUrlSha256':'a'*64}],[{**row,'sourceId':True}]]:
    supp.write_text(json.dumps({**manifest,'rows':rows}))
    with self.assertRaises(ValueError):E.source_identity_supplements(supp,base,ledger)
if __name__=='__main__':unittest.main()
