"""Offline delta comparison must use retained fields, not raw object shape."""
import importlib.util,pathlib,unittest
spec=importlib.util.spec_from_file_location('delta',pathlib.Path(__file__).parents[1]/'scripts/seo-public-delta.py');D=importlib.util.module_from_spec(spec);spec.loader.exec_module(D)
class SourceDelta(unittest.TestCase):
    def test_extra_rest_fields_do_not_fabricate_changes_but_identity_and_status_changes_remain(self):
        old={'pages':[{'id':1,'slug':'same','status':'publish'},{'id':2,'slug':'old','status':'publish'}]}
        new={'pages':[{'id':1,'slug':'same','status':'publish','content':{'rendered':'Uncompared body'}},{'id':2,'slug':'old','status':'draft'},{'id':3,'slug':'new','status':'publish'}]}
        result=D.compare_records(old,new,{'pages':3})['pages']
        self.assertEqual(result['changedRetainedFieldIds'],['2']);self.assertEqual(result['addedIds'],['3']);self.assertFalse(result['rawBodyChangeComparisonAvailable'])
    def test_absence_is_unexposed_evidence_not_an_inferred_deletion(self):
        result=D.compare_records({'media':[{'id':1},{'id':2}]},{'media':[{'id':1}]},{'media':2})['media']
        self.assertEqual(result['notExposedPreviouslyObservedIds'],['2']);self.assertEqual(result['readable'],1);self.assertEqual(result['headerTotal'],2)
if __name__=='__main__':unittest.main()
