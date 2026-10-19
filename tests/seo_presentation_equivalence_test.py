import importlib.util,pathlib,unittest
P=pathlib.Path(__file__).resolve().parents[1]
S=importlib.util.spec_from_file_location('policy',P/'scripts/seo-presentation-equivalence.py');M=importlib.util.module_from_spec(S);S.loader.exec_module(M)
class PresentationProofTests(unittest.TestCase):
 def test_same_card_identity_and_all_original_fields_are_required(self):
  source=M.tree('<div><h3><a href="/sermons/anonymous/">Anonymous title</a></h3><p>4 October, 2026</p><p>Series: Anonymous series</p></div>')['children'][0]
  document='<article class="journal__entry"><h3><a href="/sermons/anonymous/">Anonymous title</a></h3><time datetime="2026-10-04">4 Oct</time><p class="journal__series"><span>Series</span> Anonymous series</p></article>'
  candidate=M.candidate_cards(document)['/sermons/anonymous/']
  self.assertTrue(M.card_witness(source,candidate,'/sermons/anonymous/'))
  self.assertFalse(M.card_witness(source,M.tree(document.replace('2026-10-04','2026-10-11')),'/sermons/anonymous/'))
  self.assertFalse(M.card_witness(source,M.tree(document.replace('Anonymous series','Other series')),'/sermons/anonymous/'))
  self.assertEqual(M.block_witnesses({'url':'https://www.savinggrace.org.au/archive/','mainHtml':M.CAP.sanitize(source,'https://www.savinggrace.org.au'),'semanticBlocks':[]},{'url':'https://www.savinggrace.org.au/archive/','mainText':''},document.replace('/sermons/anonymous/','/sermons/other/'),{M.sha('4 October, 2026'):1})['remainingBlocks'],1)
 def test_arbitrary_missing_paragraphs_are_never_inferred(self):
  original=M.tree('<div><a href="/sermons/anonymous/">Anonymous title</a><p>Important original paragraph.</p></div>')
  current=M.tree('<article><a href="/sermons/anonymous/">Anonymous title</a></article>')
  self.assertFalse(M.card_witness(original,current,'/sermons/anonymous/'))
 def test_image_relationship_requires_verified_bytes_and_meaningful_alt(self):
  url='https://i0.wp.com/www.savinggrace.org.au/wp-content/uploads/a.jpg?resize=300%2C200&ssl=1';candidate=[{'url':'https://www.savinggrace.org.au/new.jpg','alt':'Meaningful caption'}];original={'/wp-content/uploads/a.jpg':'a'*64};actual={candidate[0]['url']:'a'*64}
  self.assertTrue(M.image_witnesses([(url,'')],candidate,original,actual)['fullyEquivalent'])
  self.assertFalse(M.image_witnesses([(url,'Original meaningful alternative')],candidate,original,actual)['fullyEquivalent'])
  self.assertFalse(M.image_witnesses([(url,'')],candidate,original,{candidate[0]['url']:'b'*64})['fullyEquivalent'])
  self.assertIsNone(M.owned_original('https://other.example/wp-content/uploads/a.jpg'))
 def test_real_label_anchor_structure_requires_the_same_typed_value_and_identity(self):
  source=M.tree('<li><h2><a href="/sermons/anonymous/">Anonymous title</a></h2><p>4 October, 2026</p><p>Series: <a href="/sermons/?sermon_series=anonymous">Anonymous series</a></p><p>Preacher: <a href="/sermons/?sermon_speaker=anonymous">Anonymous speaker</a></p><p>Book: <a href="/sermons/?sermon_book=acts">Acts</a></p><a href="/sermons/anonymous/"><p>View Sermon</p></a></li>')['children'][0]
  body='<article class="journal__entry"><h3><a href="/sermons/anonymous/">Anonymous title</a></h3><time datetime="2026-10-04">4 Oct</time><div class="journal__tab"><a href="/books/acts/">Acts</a></div><p class="journal__series"><span>Series</span> <a href="/series/anonymous/">Anonymous series</a></p><div class="journal__speaker"><a href="/speakers/anonymous/">Anonymous speaker</a></div><a href="/sermons/anonymous/">Open sermon</a></article>'
  candidate=M.candidate_cards(body)['/sermons/anonymous/']
  self.assertTrue(M.card_witness(source,candidate,'/sermons/anonymous/'))
  for wrong in [body.replace('/speakers/anonymous/','/series/anonymous/'),body.replace('Anonymous speaker','Different speaker'),body.replace('/books/acts/','/books/romans/'),body.replace('2026-10-04','2026-10-11')]:
   self.assertFalse(M.card_witness(source,M.candidate_cards(wrong)['/sermons/anonymous/'],'/sermons/anonymous/'))
 def test_raw_source_region_preserves_exact_inline_block_spacing(self):
  original='<main><ul><li><h2><a href="/sermons/anonymous/">Anonymous title</a></h2><p>Series: <a href="/sermons/?sermon_series=anonymous">Anonymous series</a></p></li></ul></main>'
  candidate='<article class="journal__entry"><a href="/sermons/anonymous/">Anonymous title</a><p class="journal__series">Series <a href="/series/anonymous/">Anonymous series</a></p></article>'
  missing={M.sha('Series: Anonymous series'):1}
  proof=M.block_witnesses({'url':'https://www.savinggrace.org.au/sermons/','mainSelector':'main','semanticBlocks':[]},{'url':'https://www.savinggrace.org.au/sermons/','mainText':''},candidate,missing,original)
  self.assertTrue(proof['fullyEquivalent']);self.assertEqual(proof['resolvedBlocks'],1)
if __name__=='__main__':unittest.main()
