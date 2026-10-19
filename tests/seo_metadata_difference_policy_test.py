import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('metadata_policy', pathlib.Path(__file__).parents[1] / 'scripts/seo-metadata-difference-policy.py')
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)
ORIGIN = 'https://www.savinggrace.org.au'

class MetadataDifferencePolicyTest(unittest.TestCase):
    def test_optional_defaults_require_original_unchanged_title(self):
        source = {'template':'archive','title':'Anonymous archive','meta':{}}
        candidate = {'title':'Anonymous archive','meta':{'og:title':['Anonymous archive'],'og:type':['website'],'twitter:card':['summary']}}
        for field in candidate['meta']:
            self.assertTrue(P.additive_archive_signal(source,candidate,field))
        self.assertFalse(P.additive_archive_signal(source,{**candidate,'title':'Changed'},'og:title'))
        self.assertFalse(P.additive_archive_signal({**source,'meta':{'og:title':['Original social title']}},candidate,'og:title'))
        self.assertFalse(P.additive_archive_signal(source,candidate,'og:image'))

    def test_facet_correction_requires_same_single_term_and_self_canonical(self):
        url = ORIGIN + '/sermons/?sermon_book=anonymous'
        source = {'template':'archive','url':url,'title':'Anonymous','primaryHeading':'Book: Anonymous','meta':{'og:url':[ORIGIN+'/sermons/?sermon_book=/anonymous']}}
        candidate = {'title':'Anonymous','primaryHeading':'Book: Anonymous','meta':{'og:url':[url]},'canonicalUrls':[url]}
        self.assertTrue(P.corrected_facet_social_url(source,candidate,ORIGIN))
        for other in [ORIGIN+'/sermons/',url+'&utm_source=test',url.replace('anonymous','other')]:
            self.assertFalse(P.corrected_facet_social_url(source,{**candidate,'meta':{'og:url':[other]}},ORIGIN))
        self.assertFalse(P.corrected_facet_social_url(source,{**candidate,'canonicalUrls':[]},ORIGIN))

    def test_optional_social_description_keeps_the_original_primary_description(self):
        source={'template':'archive','title':'Original','meta':{'description':['Original description.']}}
        candidate={'title':'Original','meta':{'description':['Original description.'],'og:description':['Original description.']}}
        self.assertTrue(P.additive_archive_signal(source,candidate,'og:description'))
        self.assertFalse(P.additive_archive_signal(source,{**candidate,'meta':{'description':['Changed.'],'og:description':['Changed.']}},'og:description'))

    def test_pagination_keeps_the_same_facet_instead_of_the_unfiltered_page(self):
        url=ORIGIN+'/sermons/page/3/?sermon_book=anonymous'
        source={'template':'archive','url':url,'title':'Original page three','meta':{'og:url':[ORIGIN+'/sermons/?sermon_book=/anonymous']}}
        candidate={'title':source['title'],'meta':{'og:url':[url]},'canonicalUrls':[url]}
        self.assertTrue(P.corrected_facet_social_url(source,candidate,ORIGIN))
        self.assertFalse(P.corrected_facet_social_url(source,{**candidate,'meta':{'og:url':[ORIGIN+'/sermons/page/3/']}},ORIGIN))

    def test_calendar_correction_never_crosses_event_scope_or_changes_existing_copy(self):
        url=ORIGIN+'/events/tag/anonymous/list/page/2/'
        source={'template':'archive','url':url,'title':'Original page two','meta':{'og:url':[ORIGIN+'/tag/anonymous/']}}
        candidate={'title':source['title'],'meta':{'og:url':[url]},'canonicalUrls':[url]}
        self.assertTrue(P.corrected_calendar_social_url(source,candidate,ORIGIN))
        for path in ['/tag/other/','/events/','/events/tag/other/']:
            self.assertFalse(P.corrected_calendar_social_url({**source,'meta':{'og:url':[ORIGIN+path]}},candidate,ORIGIN))
        self.assertFalse(P.corrected_calendar_social_url(source,{**candidate,'title':'Changed'},ORIGIN))
        self.assertFalse(P.corrected_calendar_social_url(source,{**candidate,'canonicalUrls':[ORIGIN+'/events/']},ORIGIN))

if __name__ == '__main__':
    unittest.main()

class OriginVariantDispositionTest(unittest.TestCase):
 def test_only_same_original_identity_text_dates_metadata_and_media_can_share_disposition(self):
  source={'url':'https://savinggrace.org.au/sermons/anonymous/','status':200,'sourcePostId':77,'mainText':'Complete anonymous source text.','title':'Original title','primaryHeading':'Original title','bodySha256':'a'*64,'meta':{'og:url':['https://savinggrace.org.au/sermons/anonymous/']},'canonicalUrls':['https://savinggrace.org.au/sermons/anonymous/'],'primaryMediaReferences':[{'url':'https://www.youtube.com/watch?v=anonymous01'}]};canonical={**source,'url':source['url'].replace('https://savinggrace','https://www.savinggrace'),'bodySha256':'b'*64,'meta':{'og:url':['https://www.savinggrace.org.au/sermons/anonymous/']},'canonicalUrls':['https://www.savinggrace.org.au/sermons/anonymous/']}
  self.assertTrue(P.same_original_origin_variant(source,canonical,'b'*64))
  for changed in [{'sourcePostId':78},{'mainText':'Different source text.'},{'modifiedAt':'2026-10-20'},{'title':'Different original title'},{'url':'https://savinggrace.org.au/sermons/unrelated/'},{'url':source['url']+'?page=2'},{'meta':{'description':['Different source metadata.']}},{'primaryMediaReferences':[]}]:self.assertFalse(P.same_original_origin_variant({**source,**changed},canonical,'b'*64))
  self.assertFalse(P.same_original_origin_variant(source,canonical,'c'*64))
  tile='https://i0.wp.com/savinggrace.org.au/wp-content/uploads/anonymous.jpg?fit=270%2C270&ssl=1';a={**source,'meta':{**source['meta'],'msapplication-tileimage':[tile]}};b={**canonical,'meta':{**canonical['meta'],'msapplication-tileimage':[tile.replace('wp.com/savinggrace','wp.com/www.savinggrace')]}};self.assertTrue(P.same_original_origin_variant(a,b,'b'*64));b['meta']['msapplication-tileimage']=[b['meta']['msapplication-tileimage'][0].replace('270%2C270','271%2C270')];self.assertFalse(P.same_original_origin_variant(a,b,'b'*64))

 def test_original_media_only_page_requires_matching_source_tree_and_actual_media(self):
  a={'url':'https://savinggrace.org.au/sermons/anonymous/','status':200,'sourcePostId':77,'title':'Original title','primaryHeading':'Original title','mainFound':True,'mainText':'','contentTree':[{'tag':'div','children':[]}],'primaryMediaReferences':[{'url':'https://www.youtube.com/watch?v=anonymous01'}],'bodySha256':'a'*64};b={**a,'url':'https://www.savinggrace.org.au/sermons/anonymous/','bodySha256':'b'*64};self.assertTrue(P.same_original_origin_variant(a,b,'b'*64));self.assertFalse(P.same_original_origin_variant({**a,'primaryMediaReferences':[]},b,'b'*64));self.assertFalse(P.same_original_origin_variant({**a,'contentTree':[{'tag':'p','text':'Different source copy.'}]},b,'b'*64))


class AdditionalSocialUrlConsequences(unittest.TestCase):
    def test_absent_archive_social_url_only_adds_its_exact_canonical(self):
        source={'template':'archive','url':'https://savinggrace.org.au/tag/example/','title':'Example','meta':{}};candidate={'title':'Example','meta':{'og:url':['https://www.savinggrace.org.au/tag/example/']},'canonicalUrls':['https://www.savinggrace.org.au/tag/example/']}
        self.assertTrue(P.additive_archive_signal(source,candidate,'og:url'));candidate['meta']['og:url']=['https://www.savinggrace.org.au/'];self.assertFalse(P.additive_archive_signal(source,candidate,'og:url'))
    def test_social_move_requires_actual_direct_permanent_page_move(self):
        a='https://www.savinggrace.org.au/old-example/';b='https://www.savinggrace.org.au/new-example/';source={'url':a,'canonicalUrls':[a],'meta':{'og:url':[a]}};candidate={'url':b,'canonicalUrls':[b],'meta':{'og:url':[b]}};chain=[{'url':a,'status':301},{'url':b,'status':200}]
        self.assertTrue(P.corrected_reviewed_redirect_social_url(source,candidate,chain,'https://www.savinggrace.org.au'));chain[0]['status']=302;self.assertFalse(P.corrected_reviewed_redirect_social_url(source,candidate,chain,'https://www.savinggrace.org.au'));chain[0]['status']=301;chain.append(chain[-1]);self.assertFalse(P.corrected_reviewed_redirect_social_url(source,candidate,chain,'https://www.savinggrace.org.au'))

    def test_calendar_query_keeps_the_exact_scope_and_all_meaningful_parameters(self):
        url=ORIGIN+'/?post_type=tribe_events&eventDisplay=day&tribe_events_cat=example&paged=2';source={'template':'archive','title':'Example date','url':url,'meta':{'og:url':[ORIGIN+'/events/category/example/']}};candidate={'title':'Example date','url':url,'canonicalUrls':[url],'meta':{'og:url':[url]}}
        self.assertTrue(P.corrected_calendar_social_url(source,candidate,ORIGIN));source['meta']['og:url']=[ORIGIN+'/events/category/unrelated/'];self.assertFalse(P.corrected_calendar_social_url(source,candidate,ORIGIN));source['url']=url+'&unknown=value';self.assertFalse(P.corrected_calendar_social_url(source,candidate,ORIGIN))
    def test_venue_and_date_collection_social_defaults_do_not_accept_another_collection(self):
        for path in('/venue/example/?eventDisplay=past','/events/list/?tribe-bar-date=2026-10-25'):
            url=ORIGIN+path;base=url.split('?')[0];source={'template':'archive','title':'Example','url':url,'meta':{'og:url':[base]}};candidate={'title':'Example','url':url,'canonicalUrls':[url],'meta':{'og:url':[url]}};self.assertTrue(P.corrected_calendar_social_url(source,candidate,ORIGIN));source['meta']['og:url']=[ORIGIN+'/events/tag/unrelated/'];self.assertFalse(P.corrected_calendar_social_url(source,candidate,ORIGIN))


class AllOccurrenceSocialUrlTest(unittest.TestCase):
    def test_collection_social_url_needs_multiple_observed_dates_and_the_same_series(self):
        parent=ORIGIN+'/event/example/';url=parent+'all/';old=parent+'2026-10-20/';source={'title':'Example','primaryHeading':'Example','url':url,'meta':{'og:url':[old]},'contentTree':[{'tag':'a','href':old},{'tag':'a','href':parent+'2026-10-27/'}]};candidate={'title':'Example','primaryHeading':'Example','url':url,'meta':{'og:url':[url]},'canonicalUrls':[url]}
        self.assertTrue(P.corrected_all_occurrences_social_url(source,candidate,ORIGIN));source['contentTree']=source['contentTree'][:1];self.assertFalse(P.corrected_all_occurrences_social_url(source,candidate,ORIGIN));source['contentTree'].append({'tag':'a','href':ORIGIN+'/event/unrelated/2026-10-27/'});self.assertFalse(P.corrected_all_occurrences_social_url(source,candidate,ORIGIN))


class ObservedCalendarControlIdentityTest(unittest.TestCase):
 def test_empty_tag_taxonomy_error_requires_the_same_real_calendar_navigation(self):
  url=ORIGIN+'/events/tag/example/month/';source={'template':'archive','url':url,'title':'Example','meta':{'og:url':[ORIGIN+'/?taxonomy=&term=']},'contentTree':[{'tag':'a','href':ORIGIN+'/events/tag/example/2026-11/'}]};candidate={'url':url,'title':'Example','meta':{'og:url':[url]},'canonicalUrls':[url]}
  self.assertTrue(P.corrected_calendar_social_url(source,candidate,ORIGIN));source['contentTree'][0]['href']=ORIGIN+'/events/tag/other/2026-11/';self.assertFalse(P.corrected_calendar_social_url(source,candidate,ORIGIN))
 def test_venue_pagination_preserves_its_own_scope(self):
  url=ORIGIN+'/venue/example/page/3/';source={'template':'archive','url':url,'title':'Venue','meta':{'og:url':[ORIGIN+'/venue/example/']}};candidate={'url':url,'title':'Venue','meta':{'og:url':[url]},'canonicalUrls':[url]};self.assertTrue(P.corrected_calendar_social_url(source,candidate,ORIGIN));source['meta']['og:url']=[ORIGIN+'/venue/other/'];self.assertFalse(P.corrected_calendar_social_url(source,candidate,ORIGIN))
 def test_empty_all_collection_requires_both_scoped_navigation_and_subscription(self):
  url=ORIGIN+'/event/example/all/';source={'url':url,'title':'Example','meta':{'og:url':[ORIGIN+'/event/example/2026-10-20/']},'contentTree':[{'tag':'a','href':url},{'tag':'a','href':url+'?eventDisplay=past'},{'tag':'a','href':url+'?ical=1'}]};candidate={'url':url,'title':'Example','meta':{'og:url':[url]},'canonicalUrls':[url]};self.assertTrue(P.corrected_all_occurrences_social_url(source,candidate,ORIGIN));source['contentTree'].pop();self.assertFalse(P.corrected_all_occurrences_social_url(source,candidate,ORIGIN))
