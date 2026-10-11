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

if __name__ == '__main__':
    unittest.main()
