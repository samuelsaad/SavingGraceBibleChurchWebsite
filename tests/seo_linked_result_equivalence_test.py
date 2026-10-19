import hashlib,importlib.util,pathlib,unittest
p=pathlib.Path(__file__).parents[1];s=importlib.util.spec_from_file_location('linked',p/'scripts/seo-linked-result-equivalence.py');M=importlib.util.module_from_spec(s);s.loader.exec_module(M)
O=M.ORIGIN
class LinkedResultTest(unittest.TestCase):
 def fixtures(self):
  old='<main><article class="hentry post-77"><h2><a href="/anonymous/">Anonymous</a></h2><p>Original complete paragraph.</p><img src="/wp-content/uploads/a.jpg" alt="Original alt"></article></main>'
  current='<main><h2><a href="/anonymous/">Anonymous result</a></h2><p>Short current excerpt.</p></main>'
  target='<main><h1>Anonymous</h1><p>Original complete paragraph.</p><img src="/wp-content/uploads/a.jpg" alt="Original alt"></main>'
  def rec(url,doc,**kw):return {'url':url,'status':200,'bodySha256':hashlib.sha256(doc.encode()).hexdigest(),**kw}
  return rec(O+'/?s=anonymous',old,mainSelector='main'),old,rec(O+'/?s=anonymous',current),current,{'source':rec(O+'/anonymous/',target,sourcePostId=77,template='post'),'candidate':rec(O+'/anonymous/',target,extracted={'canonicalUrls':[O+'/anonymous/']}),'document':target}
 def test_image_needs_exact_original_object_real_result_link_canonical_indexability_and_file(self):
  source,old,view,current,ref=self.fixtures();url=O+'/wp-content/uploads/a.jpg';files={url:{'status':200,'mime':'image/jpeg','sha256':'a'*64}}
  self.assertIsNotNone(M.image_witness(source,old,view,current,ref,url,'Original alt','a'*64,files))
  for change in [{'source':{**ref['source'],'sourcePostId':78}},{'candidate':{**ref['candidate'],'status':404}},{'candidate':{**ref['candidate'],'headers':{'x-robots-tag':'noindex'}}},{'candidate':{**ref['candidate'],'extracted':{'canonicalUrls':[O+'/unrelated/']}}}]:self.assertIsNone(M.image_witness(source,old,view,current,{**ref,**change},url,'Original alt','a'*64,files))
  for changed in [{'status':404,'mime':'image/jpeg','sha256':'a'*64},{'status':200,'mime':'text/html','sha256':'a'*64},{'status':200,'mime':'image/jpeg','sha256':'b'*64}]:self.assertIsNone(M.image_witness(source,old,view,current,ref,url,'Original alt','a'*64,{url:changed}))
  self.assertIsNone(M.image_witness(source,old,{**view,'url':O+'/'},current,ref,url,'Original alt','a'*64,files))
  self.assertIsNone(M.image_witness(source,old,view,current.replace('/anonymous/','/unrelated/'),ref,url,'Original alt','a'*64,files))
 def test_original_text_needs_its_object_and_exact_paragraph_on_the_linked_target(self):
  source,old,view,current,ref=self.fixtures();missing=[M.P.sha('Original complete paragraph.')]
  self.assertTrue(M.block_witnesses(source,old,view,current,[ref],missing)['fullyEquivalent'])
  self.assertFalse(M.block_witnesses(source,old,view,current,[{**ref,'source':{**ref['source'],'sourcePostId':78}}],missing)['fullyEquivalent'])
  changed=ref['document'].replace('Original complete paragraph.','Incomplete.')
  self.assertFalse(M.block_witnesses(source,old,view,current,[{**ref,'document':changed,'candidate':{**ref['candidate'],'bodySha256':hashlib.sha256(changed.encode()).hexdigest()}}],missing)['fullyEquivalent'])
if __name__=='__main__':unittest.main()
