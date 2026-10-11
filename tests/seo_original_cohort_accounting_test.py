import csv,importlib.util,json,pathlib,tempfile,unittest
spec=importlib.util.spec_from_file_location('cohort',pathlib.Path(__file__).parents[1]/'scripts/seo-original-cohort-accounting.py')
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
def row(raw=(),reviewed=(),status='unresolved'):
    return {'raw_verification_issues':json.dumps(list(raw)),'unreviewed_issue_codes':json.dumps(list(set(raw)-set(reviewed))),'reviewed_issue_codes':json.dumps(list(reviewed)),'disposition':status,'source_type':'page','source_wordpress_id':'900001','source_route_family':'other_path'}
class OriginalCohortAccountingTest(unittest.TestCase):
    def test_overlapping_categories_keep_every_original_row_and_new_inventory_separate(self):
        a,b=M.CATEGORIES[:2];original={'a'*64:row([a,b]),'b'*64:row([a]),'c'*64:row([b])}
        candidate={'a'*64:row([a],[a],'preserved'),'b'*64:row([a]),'c'*64:row([],[],'preserved'),'d'*64:row([a])}
        result,details=M.account(original,candidate,3)
        self.assertEqual(result['categories'][a],{'original':2,'fixed':0,'reclassified':1,'remaining':1})
        self.assertEqual(result['categories'][b],{'original':2,'fixed':2,'reclassified':0,'remaining':0})
        self.assertEqual(result['newInventoryRows'],1);self.assertEqual(len(details),4)
    def test_missing_original_urls_and_changed_denominator_fail_closed(self):
        with self.assertRaisesRegex(ValueError,'denominator_changed'):M.account({'a'*64:row()},{'a'*64:row()},2)
        with self.assertRaisesRegex(ValueError,'original_urls_missing'):M.account({'a'*64:row()}, {},1)
    def test_originally_explained_findings_do_not_inflate_outstanding_cohort(self):
        code=M.CATEGORIES[0];original={'a'*64:row([code],[code],'preserved')}
        result,_=M.account(original,original,1)
        self.assertEqual(result['categories'][code]['original'],0)
        self.assertEqual(result['originalRawCategoryCounts'][code],1)
    def test_original_broken_targets_are_not_dropped_when_discovery_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            a,b=pathlib.Path(directory)/'old.csv',pathlib.Path(directory)/'new.csv'
            def write(path,rows):
                with path.open('w',newline='') as f:
                    w=csv.DictWriter(f,fieldnames=['urlSha256','status']);w.writeheader();w.writerows(rows)
            write(a,[{'urlSha256':k*64,'status':'404'} for k in 'abcd'])
            write(b,[{'urlSha256':'a'*64,'status':'200'},{'urlSha256':'b'*64,'status':'410'},{'urlSha256':'c'*64,'status':'404'}])
            result=M.internal_account(a,b,{'b'*64:{'disposition':'intentionally_removed'}})
            self.assertEqual((result['originalNon200Targets'],result['fixed'],result['reclassified'],result['remaining']),(4,1,1,2))
            self.assertEqual(result['remainingTargets'][-1]['reason'],'not_in_final_discovery_requires_direct_verification')
if __name__=='__main__':unittest.main()
