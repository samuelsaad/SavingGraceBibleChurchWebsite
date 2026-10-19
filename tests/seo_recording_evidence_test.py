import unittest,tempfile,pathlib,json,importlib.util,copy
s=importlib.util.spec_from_file_location('recording',pathlib.Path(__file__).parents[1]/'scripts/seo-recording-evidence.py');M=importlib.util.module_from_spec(s);s.loader.exec_module(M)
class RecordingEvidenceTest(unittest.TestCase):
 def fixture(self,root):
  label='a'*64;bundle={'pages':[]};sources=[];full=[]
  for i in range(118):
   ext='mp3'if i<117 else'mp4';mime='audio/mpeg'if i<117 else'video/mp4';path='/wp-content/uploads/anonymous-'+str(i)+'.'+ext;url='https://www.savinggrace.org.au'+path;digest=f'{i:064x}';bundle['pages'].append({'sourceUrl':url,'sourceId':i+1,'asset':{'contentType':mime,'sha256':digest,'bytes':2048}});sources.append({'url':url,'sourcePostId':i+1,'status':200,'bodySha256':digest,'bodyBytes':2048,'headers':{'content-type':mime,'content-length':'2048'}});full.append({'path':path,'sha256':digest,'bytes':2048,'mime':mime,'issues':[],'rangeVerified':True})
  raw=json.dumps({'expectedRuntimeLabel':label,'checked':118,'failed':0,'rows':full}).encode();(root/'full-body-http.private.json').write_bytes(raw);first=sources[0];response={'url':first['url'],'status':200,'bodySha256':first['bodySha256'],'byteCount':2048,'headers':{'x-seo-candidate':label,'content-type':'audio/mpeg','content-length':'2048','etag':'"'+first['bodySha256']+'"'},'rangeContentRange':'bytes 0-1023/2048','rangePrefixSha256':'c'*64,'verifiedSourcePrefixSha256':'c'*64};value={'format':'sgbc-recording-supplement-v1','sourceBundleSha256':'b'*64,'expectedRuntimeLabel':label,'fullBodyProofSha256':M.sha(raw),'sourceRows':sources,'responses':[response]};bindings={'bundleSha256':'b'*64,'expectedRuntimeLabel':label};return bundle,value,bindings
 def test_full_body_head_range_and_original_identity_are_required(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);bundle,v,bindings=self.fixture(root);p=root/'recording-evidence.private.json';p.write_text(json.dumps(v));sources,responses=M.load_recording_evidence(p,bundle,bindings);self.assertEqual(len(sources),118);self.assertEqual(len(responses),1)
   for changed in [{**v,'expectedRuntimeLabel':'d'*64},{**v,'sourceRows':v['sourceRows'][:-1]},{**v,'sourceBundleSha256':'d'*64},{**v,'fullBodyProofSha256':'d'*64}]:
    p.write_text(json.dumps(changed))
    with self.assertRaises(ValueError):M.load_recording_evidence(p,bundle,bindings)
 def test_changed_range_etag_or_source_object_cannot_be_accepted(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);bundle,v,bindings=self.fixture(root);p=root/'recording-evidence.private.json'
   for patch in [{'rangePrefixSha256':'d'*64},{'rangeContentRange':'bytes 0-511/2048'},{'headers':{**v['responses'][0]['headers'],'etag':'"wrong"'}},{'url':'https://example.org/recording.mp3'}]:
    changed={**v,'responses':[{**v['responses'][0],**patch}]};p.write_text(json.dumps(changed))
    with self.assertRaises(ValueError):M.load_recording_evidence(p,bundle,bindings)
   changed=copy.deepcopy(v);changed['sourceRows'][0]['sourcePostId']=999;p.write_text(json.dumps(changed))
   with self.assertRaises(ValueError):M.load_recording_evidence(p,bundle,bindings)
 def test_backfill_requires_metadata_only_and_retains_the_original_observation(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);bundle,v,bindings=self.fixture(root);source=v['sourceRows'][0];old={'url':source['url'],'status':200,'sourcePostId':None,'metadataOnly':True,'bodyBytes':0,'bodySha256':M.sha(b''),'capturedAt':'earlier','headers':source['headers']};result=M.source_with_recording_observation(old,old['url'],{source['url']:source});self.assertEqual(result['bodySha256'],source['bodySha256']);self.assertEqual(result['earlierCapturedAt'],'earlier');self.assertTrue(old['metadataOnly'])
   for patch in [{'sourcePostId':999},{'bodyBytes':5},{'bodySha256':'x'*64},{'headers':{**old['headers'],'content-length':'999'}}]:
    with self.assertRaises(ValueError):M.source_with_recording_observation({**old,**patch},old['url'],{source['url']:source})
   captured={**old,'metadataOnly':False,'bodySha256':'existing'};self.assertEqual(M.source_with_recording_observation(captured,old['url'],{source['url']:source}),captured)
 def test_external_or_unrelated_redirect_is_rejected(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);bundle,v,bindings=self.fixture(root);p=root/'recording-evidence.private.json'
   for location in ['https://example.org/file.mp3','https://www.savinggrace.org.au/unrelated.mp3']:
    p.write_text(json.dumps({**v,'responses':[{'url':'http://savinggrace.org.au/wp-content/uploads/anonymous-0.mp3','status':301,'headers':{'x-seo-candidate':'a'*64,'location':location}}]}))
    with self.assertRaises(ValueError):M.load_recording_evidence(p,bundle,bindings)
 def test_relative_redirect_resolves_to_the_exact_verified_recording(self):
  with tempfile.TemporaryDirectory()as d:
   root=pathlib.Path(d);bundle,v,bindings=self.fixture(root);p=root/'recording-evidence.private.json'
   row={'url':'https://www.savinggrace.org.au/?attachment_id=1','status':301,'headers':{'x-seo-candidate':'a'*64,'location':'/wp-content/uploads/anonymous-0.mp3'}}
   p.write_text(json.dumps({**v,'responses':[row]}));sources,responses=M.load_recording_evidence(p,bundle,bindings);self.assertEqual(len(responses),1)
   for location in ['//example.org/wp-content/uploads/anonymous-0.mp3','/unrelated.mp3','http://www.savinggrace.org.au/wp-content/uploads/anonymous-0.mp3']:
    p.write_text(json.dumps({**v,'responses':[{**row,'headers':{**row['headers'],'location':location}}]}))
    with self.assertRaises(ValueError):M.load_recording_evidence(p,bundle,bindings)
if __name__=='__main__':unittest.main()
