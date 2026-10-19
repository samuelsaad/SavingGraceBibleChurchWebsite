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
