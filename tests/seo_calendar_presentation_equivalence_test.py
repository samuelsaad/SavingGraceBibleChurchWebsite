import importlib.util,hashlib,pathlib,unittest
s=importlib.util.spec_from_file_location('calendar',pathlib.Path(__file__).parents[1]/'scripts/seo-calendar-presentation-equivalence.py');M=importlib.util.module_from_spec(s);s.loader.exec_module(M)
class CalendarControlsTest(unittest.TestCase):
 def fixtures(self):
  url=M.L.ORIGIN+'/events/category/anonymous/day/2026-11-17/'
  old='<main><h2 class="tribe-common-a11y-visual-hide">Events Search and Views Navigation</h2><h3 class="tribe-common-a11y-visual-hide">Event Views Navigation</h3><li class="tribe-events-c-view-selector__list-item"><a href="/events/category/anonymous/list/">List</a></li><p>Important original paragraph.</p></main>'
  new='<main><nav aria-label="Calendar views">'+''.join('<a href="/events/category/anonymous/?eventDisplay='+v.lower()+'">'+v+'</a>'for v in ['List','Month','Day'])+'</nav><form method="get" action="/events/category/anonymous/" aria-label="Search church events"><input type="search" name="tribe-bar-search"><input type="text" name="tribe-bar-location"><input type="date" name="tribe-bar-date"><button type="submit">View dates</button></form></main>'
  def rec(doc):return {'url':url,'status':200,'mainSelector':'main','bodySha256':hashlib.sha256(doc.encode()).hexdigest()}
  return rec,old,new
 def test_equivalence_is_for_exact_controls_and_keeps_missing_copy_open(self):
  rec,old,new=self.fixtures();missing=[M.P.sha(v)for v in ['Events Search and Views Navigation','Event Views Navigation','List','Important original paragraph.']];r=M.calendar_controls(rec(old),old,rec(new),new,missing);self.assertEqual(len(r['witnesses']),3);self.assertEqual(r['remainingBlockHashes'],{missing[-1]:1});self.assertFalse(r['fullyEquivalent'])
 def test_status_or_changed_identity_cannot_clear_control_findings(self):
  rec,old,new=self.fixtures();missing=[M.P.sha('Event Views Navigation')]
  for patch in [{'url':M.L.ORIGIN+'/events/'},{'status':404},{'bodySha256':'a'*64}]:self.assertFalse(M.calendar_controls(rec(old),old,{**rec(new),**patch},new,missing)['fullyEquivalent'])
 def test_unrelated_scope_or_missing_view_or_search_field_fails(self):
  rec,old,new=self.fixtures();key=M.P.sha('Events Search and Views Navigation')
  for doc in [new.replace('/events/category/anonymous/','/events/'),new.replace('eventDisplay=month','eventDisplay=list'),new.replace('name="tribe-bar-location"','name="unrelated"')]:self.assertFalse(M.calendar_controls(rec(old),old,rec(doc),doc,[key])['fullyEquivalent'])
if __name__=='__main__':unittest.main()
class LinkedCalendarTest(unittest.TestCase):
 def fixtures(self):
  origin=M.L.ORIGIN;sentence='This complete original public event paragraph contains enough words to demonstrate its exact source excerpt.'
  old='<main><article class="hentry post-77"><h3><a href="/event/anonymous/2026-11-17/">Anonymous study</a></h3><p>'+sentence+'...</p><img src="/wp-content/uploads/anonymous.jpg" alt="Original image"></article></main>'
  view='<main><h2><a href="/events/anonymous/">Anonymous study</a></h2></main>';native='<main><h1>Anonymous study</h1><p>'+sentence+' More original detail.</p><img src="/wp-content/uploads/anonymous.jpg" alt="Original image"></main>'
  def rec(url,doc,**kw):return {'url':origin+url,'status':200,'mainSelector':'main','bodySha256':hashlib.sha256(doc.encode()).hexdigest(),**kw}
  ref={'source':rec('/event/anonymous/2026-11-17/',old,sourcePostId=77),'candidate':rec('/events/anonymous/',native,extracted={'canonicalUrls':[origin+'/events/anonymous/'],'images':[{'url':origin+'/wp-content/uploads/anonymous.jpg','alt':'Original image'}]}),'document':native};bindings=[{'nativeUrl':origin+'/events/anonymous/','legacyPaths':['/event/anonymous/'],'dependencySha256':'a'*64}]
  return rec,old,view,ref,bindings,sentence
 def test_exact_excerpt_on_identity_bound_linked_detail(self):
  rec,old,view,ref,bindings,sentence=self.fixtures();url='/events/category/anonymous/day/2026-11-17/';key=M.P.sha(sentence+'...');result=M.linked_calendar_blocks(rec(url,old),old,rec(url,view),view,[ref],bindings,[key]);self.assertTrue(result['fullyEquivalent']);self.assertEqual(len(result['witnesses']),1)
  for wrong in [[],bindings+bindings,[{**bindings[0],'legacyPaths':['/event/unrelated/']}]]:self.assertFalse(M.linked_calendar_blocks(rec(url,old),old,rec(url,view),view,[ref],wrong,[key])['fullyEquivalent'])
  self.assertFalse(M.linked_calendar_blocks(rec(url,old),old,rec(url,view),view,[{**ref,'source':{**ref['source'],'sourcePostId':78}}],bindings,[key])['fullyEquivalent'])
 def test_canonical_link_and_all_external_links_are_required(self):
  rec,old,view,ref,bindings,sentence=self.fixtures();url='/events/category/anonymous/day/2026-11-17/';key=M.P.sha(sentence+'...')
  for change in [{'status':404},{'headers':{'x-robots-tag':'noindex'}},{'extracted':{'canonicalUrls':[M.L.ORIGIN+'/unrelated/']}}]:self.assertFalse(M.linked_calendar_blocks(rec(url,old),old,rec(url,view),view,[{**ref,'candidate':{**ref['candidate'],**change}}],bindings,[key])['fullyEquivalent'])
  altered=old.replace(sentence+'...',sentence+' <a href="https://example.org/resource">Resource</a>');self.assertFalse(M.linked_calendar_blocks(rec(url,altered),altered,rec(url,view),view,[ref],bindings,[M.P.sha(sentence+' Resource')])['fullyEquivalent'])
 def test_image_needs_verified_bytes_mime_alt_and_correspondence(self):
  rec,old,view,ref,bindings,sentence=self.fixtures();url='/events/category/anonymous/day/2026-11-17/';image=M.L.ORIGIN+'/wp-content/uploads/anonymous.jpg';args=(rec(url,old),old,rec(url,view),view,ref,bindings,image,'Original image','b'*64)
  self.assertIsNotNone(M.linked_calendar_image(*args,{image:{'status':200,'mime':'image/jpeg','sha256':'b'*64}},[]))
  for file in [{'status':200,'mime':'text/html','sha256':'b'*64},{'status':200,'mime':'image/jpeg','sha256':'c'*64}]:self.assertIsNone(M.linked_calendar_image(*args,{image:file},[]))
