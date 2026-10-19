import importlib.util,pathlib,unittest
P=pathlib.Path(__file__).resolve().parents[1]
S=importlib.util.spec_from_file_location('policy',P/'scripts/seo-presentation-equivalence.py');M=importlib.util.module_from_spec(S);S.loader.exec_module(M)
class PresentationProofTests(unittest.TestCase):
 def test_additional_book_labels_require_the_same_original_taxonomy_identity_and_name(self):
  source=next(n for n in M.walk(M.tree('<p>Book: <a href="/sermons/?sermon_book=selected-text">Selected Text</a></p>'))if n['tag']=='p')
  current='<article><p class="journal__books"><span>Book</span> <a href="/sermons/?sermon_book=selected-text">Selected Text</a></p></article>'
  self.assertTrue(M.metadata_field_witness(source,M.tree(current)))
  for wrong in [current.replace('sermon_book=selected-text','sermon_book=luke'),current.replace('>Selected Text<','>Luke<'),current.replace('journal__books','unrelated')]:self.assertFalse(M.metadata_field_witness(source,M.tree(wrong)))

 def test_selected_option_count_decoration_preserves_exact_typed_visible_filter(self):
  doc='<select name="sermon_book"><option value="acts" selected>Acts (1)</option></select><div aria-label="Active filters">Book: Acts</div>'
  source={'url':'https://www.savinggrace.org.au/sermons/?sermon_book=%2Facts%2F'}
  self.assertTrue(M.active_filter_witness(source,doc))
  for wrong in [doc.replace('Book: Acts','Book: Romans'),doc.replace('Acts (1)','Romans (1)'),doc.replace('value="acts"','value="romans"'),doc.replace('Acts (1)','Acts (one)')]:self.assertFalse(M.active_filter_witness(source,wrong))

 def test_individual_card_metadata_does_not_clear_a_missing_excerpt(self):
  original='<main><ul><li><h2><a href="/sermons/anonymous/">Anonymous title</a></h2><p>4 October, 2026</p><p>Original anonymous excerpt is absent.</p></li></ul></main>'
  current='<article class="journal__entry"><h3><a href="/sermons/anonymous/">Anonymous title</a></h3><time datetime="2026-10-04">4 Oct</time><p>Different anonymous excerpt.</p></article>'
  missing={M.sha('4 October, 2026'):1,M.sha('Original anonymous excerpt is absent.'):1}
  proof=M.block_witnesses({'url':'https://www.savinggrace.org.au/sermons/','mainSelector':'main','semanticBlocks':[]},{'url':'https://www.savinggrace.org.au/sermons/','mainText':''},current,missing,original)
  self.assertFalse(proof['fullyEquivalent']);self.assertEqual(proof['remainingBlocks'],1);self.assertIn(M.sha('Original anonymous excerpt is absent.'),proof['remainingBlockHashes'])
  self.assertEqual(proof['witnesses'][0]['reason'],'same_sermon_identity_exact_individual_block_verified')


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
 def test_filter_label_equivalence_requires_actual_selected_state_and_visible_tokens(self):
  doc='<select name="sermon_book"><option value="acts" selected>Acts</option></select><div aria-label="Active filters">Book: Acts</div>'
  source={'url':'https://www.savinggrace.org.au/sermons/?sermon_book=/acts/','mainHtml':'<p>Filtered by:</p>','semanticBlocks':[]};candidate={'url':'https://www.savinggrace.org.au/sermons/?sermon_book=acts','mainText':''};missing={M.sha('Filtered by:'):1}
  self.assertTrue(M.block_witnesses(source,candidate,doc,missing)['fullyEquivalent'])
  for bad in [doc.replace('value="acts"','value="romans"'),doc.replace(' selected',''),doc.replace('Active filters','Unrelated'),doc.replace('Book: Acts','Book: Romans')]:self.assertFalse(M.block_witnesses(source,candidate,bad,missing)['fullyEquivalent'])
 def test_repagination_proof_requires_real_links_and_the_same_filter_group(self):
  origin='https://www.savinggrace.org.au';first=origin+'/sermons/?sermon_book=acts';second=origin+'/sermons/page/2/?sermon_book=acts'
  card='<article class="journal__entry"><a href="/sermons/anonymous/">Anonymous title</a><time datetime="2026-10-04">4 Oct</time></article>'
  firstdoc='<nav class="pagination"><a href="/sermons/page/2/?sermon_book=acts">Next</a></nav>';docs={first:firstdoc,second:card}
  source={'url':first,'mainHtml':'<div><a href="/sermons/anonymous/">Anonymous title</a><p>4 October, 2026</p></div>','semanticBlocks':[]};candidate={'url':first,'mainText':''};missing={M.sha('4 October, 2026'):1}
  pool=M.archive_card_pool(first,docs);self.assertTrue(M.block_witnesses(source,candidate,firstdoc,missing,related_archive=pool)['fullyEquivalent'])
  for bad in [{first:firstdoc},{first:'',second:card},{first:firstdoc,second.replace('acts','romans'):card}]:self.assertFalse(M.block_witnesses(source,candidate,firstdoc,missing,related_archive=M.archive_card_pool(first,bad))['fullyEquivalent'])
 def test_visual_variant_resolution_requires_the_exact_reviewed_pair_alt_and_actual_bytes(self):
  url='https://www.savinggrace.org.au/wp-content/uploads/a.jpg';target='https://www.savinggrace.org.au/wp-content/uploads/a-200x300.jpg';row={'visualIdentityVerified':True,'sourceUrl':url,'sourceSha256':'a'*64,'candidateUrl':target,'candidateSha256':'b'*64,'sourceAltSha256':M.sha('Original alt'),'candidateAltSha256':M.sha('Original alt')};images=[{'url':target,'alt':'Original alt'}]
  self.assertTrue(M.image_witnesses([(url,'Original alt')],images,{'/wp-content/uploads/a.jpg':'a'*64},{target:'b'*64},[row])['fullyEquivalent'])
  for changed in [{'visualIdentityVerified':False},{'sourceSha256':'c'*64},{'candidateSha256':'c'*64},{'sourceAltSha256':M.sha('Other alt')}]:self.assertFalse(M.image_witnesses([(url,'Original alt')],images,{'/wp-content/uploads/a.jpg':'a'*64},{target:'b'*64},[{**row,**changed}])['fullyEquivalent'])
 def test_page_number_is_resolved_only_as_a_real_same_scope_navigation_control(self):
  origin='https://www.savinggrace.org.au';url=origin+'/sermons/?sermon_book=acts';original='<main><ul><li><a href="/sermons/page/2/?sermon_book=acts">2</a></li></ul></main>';document='<nav class="pagination"><a href="/sermons/page/2/?sermon_book=acts">2</a></nav>';source={'url':url,'mainSelector':'main','semanticBlocks':[]};candidate={'url':url,'mainText':''}
  proof=M.archive_card_pool(url,{url:document,origin+'/sermons/page/2/?sermon_book=acts':'<article>Second page</article>'})
  self.assertTrue(M.block_witnesses(source,candidate,document,[M.sha('2')],original,proof)['fullyEquivalent'])
  self.assertFalse(M.block_witnesses(source,candidate,document.replace('acts','romans'),[M.sha('2')],original)['fullyEquivalent'])
  self.assertFalse(M.block_witnesses(source,candidate,document,[M.sha('2')],'<main><p>2</p></main>')['fullyEquivalent'])
  second=origin+'/sermons/page/2/?sermon_book=acts';firstdoc='<nav class="pagination"><a href="/sermons/page/2/?sermon_book=acts">Next</a></nav>';pool=M.archive_card_pool(url,{url:firstdoc,second:'<nav class="pagination"><span aria-current="page">2</span></nav>'})
  self.assertTrue(M.block_witnesses(source,candidate,firstdoc,[M.sha('2')],original,pool)['fullyEquivalent'])
  self.assertFalse(M.block_witnesses(source,candidate,firstdoc,[M.sha('2')],original,M.archive_card_pool(url,{url:firstdoc}))['fullyEquivalent'])
if __name__=='__main__':unittest.main()
