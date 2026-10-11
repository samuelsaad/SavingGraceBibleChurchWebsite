import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('capture',pathlib.Path(__file__).parents[1]/'scripts/seo-source-capture.py');capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
class PrimaryCards(unittest.TestCase):
    def test_nested_headers_dates_and_pagination_survive_but_global_chrome_does_not(self):
        doc='<html><body><header><h2>Global navigation</h2></header><main><article><header><h3>Original event</h3><p>11 October 2026</p></header><p>Event body</p><footer><a href="/event/original/">Details</a></footer></article><nav><a href="/events/page/2/">Next events</a></nav><script>private()</script></main></body></html>'
        result=capture.extract(doc,'https://www.savinggrace.org.au/events/')
        tree=str(result['contentTree'])
        for value in ('Original event','11 October 2026','Event body','Details','Next events'):self.assertIn(value,tree)
        for value in ('Global navigation','private()'):self.assertNotIn(value,tree)
    def test_fragment_targets_language_direction_and_table_spans_are_retained(self):
        doc='<html><body><main><h1 id="original-heading">Original</h1><section id="original-section" lang="ar" dir="rtl"><a href="/about/#original-heading">Original link</a><table><tr><td colspan="2" rowspan="3">Original cell</td></tr></table></section></main></body></html>'
        result=capture.extract(doc,'https://www.savinggrace.org.au/about/');tree=str(result['contentTree'])
        for value in ['original-heading','original-section',"'lang': 'ar'","'dir': 'rtl'",'/about/#original-heading',"'colspan': 2","'rowspan': 3"]:self.assertIn(value,tree)
if __name__=='__main__':unittest.main()
