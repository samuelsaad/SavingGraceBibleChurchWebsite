import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from urllib.parse import urlsplit

spec=importlib.util.spec_from_file_location('candidate_verify',Path(__file__).parents[1]/'scripts/seo-verify-candidate.py')
verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
ORIGIN=verify.CANONICAL

class Response:
    def __init__(self,status=200,headers=None,body=b''):
        self.status=status;self.headers=headers or {'content-type':'text/plain'};self.body=io.BytesIO(body);self.reads=0
    def read(self,count): self.reads+=1;return self.body.read(count)
    def close(self): pass

class Opener:
    def __init__(self,responses): self.responses=list(responses);self.requests=[]
    def open(self,request,timeout):
        self.requests.append(request)
        if not self.responses: raise AssertionError('unexpected_request')
        return self.responses.pop(0)

class CandidateVerifyTests(unittest.TestCase):
    def test_parallel_loopback_budget_and_identity_are_not_weakened(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Lock
        with tempfile.TemporaryDirectory() as root:
            opener=Opener([Response(headers={'x-seo-candidate':'frozen'}) for _ in range(5)])
            original_open=opener.open;lock=Lock()
            def guarded_open(*args,**kwargs):
                with lock:return original_open(*args,**kwargs)
            opener.open=guarded_open
            client=verify.LoopbackClient('http://127.0.0.1:4440',Path(root),opener=opener,expected_label='frozen',request_limit=5)
            def request(i):
                try:return client.fetch(ORIGIN+'/anonymous-'+str(i)+'/')['status']
                except ValueError as e:return str(e)
            with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(request,range(12)))
            self.assertEqual(results.count(200),5);self.assertEqual(results.count('candidate_request_budget_exhausted'),7)
            self.assertEqual(client.requests,5);self.assertEqual(len(opener.requests),5)
            self.assertTrue(all(urlsplit(r.full_url).hostname=='127.0.0.1' for r in opener.requests))

    def test_timeout_is_bounded_and_bound_to_verification_evidence(self):
        with tempfile.TemporaryDirectory() as root:
            base=Path(root);baseline=base/'ledger.json';baseline.write_text('{}')
            run=verify.Verification(baseline,'http://127.0.0.1:4440',base/'private'/'valid',timeout=60)
            self.assertEqual(run.client.timeout,60)
            self.assertEqual(json.loads((run.output/'bindings.private.json').read_text())['httpTimeoutSeconds'],60)
            for i,value in enumerate((0,61)):
                with self.assertRaisesRegex(ValueError,'request_limits_invalid'):
                    verify.Verification(baseline,'http://127.0.0.1:4440',base/'private'/str(i),timeout=value)

    def test_concurrency_refuses_unbounded_or_noninteger_values(self):
        with tempfile.TemporaryDirectory() as root:
            base=Path(root);baseline=base/'ledger.json';baseline.write_text('{}')
            for value in (0,5,True,1.5):
                with self.assertRaisesRegex(ValueError,'concurrency_invalid'):
                    verify.Verification(baseline,'http://127.0.0.1:4440',base/'private'/'run',concurrency=value)

    def test_only_literal_loopback_with_explicit_port(self):
        with tempfile.TemporaryDirectory() as root:
            for candidate in ['https://127.0.0.1:4440','http://localhost:4440','http://192.168.1.1:4440','http://127.0.0.1','http://127.0.0.1:4440/path','http://user@127.0.0.1:4440','http://www.savinggrace.org.au:4440']:
                with self.assertRaises(ValueError): verify.LoopbackClient(candidate,Path(root))
            verify.LoopbackClient('http://[::1]:4440',Path(root))

    def test_redirects_rewrite_only_church_origins_and_preserve_logical_origin(self):
        with tempfile.TemporaryDirectory() as root:
            opener=Opener([Response(301,{'location':ORIGIN+'/sermons/example/'}),Response(301,{'location':'https://outside.example/forbidden'})])
            client=verify.LoopbackClient('http://127.0.0.1:4440',Path(root),opener=opener)
            result=client.follow('http://savinggrace.org.au/old/?campaign=a%20b')
            self.assertIn('external_or_invalid_redirect_not_followed',result['issues'])
            self.assertEqual(len(opener.requests),2)
            self.assertEqual(opener.requests[0].full_url,'http://127.0.0.1:4440/old/?campaign=a%20b')
            self.assertEqual(opener.requests[0].get_header('X-seo-rehearsal-origin'),'http://savinggrace.org.au')
            self.assertEqual(opener.requests[1].get_header('X-seo-rehearsal-origin'),ORIGIN)
            self.assertTrue(all(urlsplit(request.full_url).hostname=='127.0.0.1' for request in opener.requests))

    def test_recording_extensions_and_media_mimes_are_never_read(self):
        with tempfile.TemporaryDirectory() as root:
            response=Response(200,{'content-type':'audio/mpeg'},b'not-to-be-read')
            opener=Opener([response]);client=verify.LoopbackClient('http://127.0.0.1:4440',Path(root),opener=opener)
            self.assertEqual(client.fetch(ORIGIN+'/recording.mp3')['error'],'recording_not_requested')
            self.assertEqual(len(opener.requests),0)
            self.assertEqual(client.fetch(ORIGIN+'/audio-endpoint/')['error'],'recording_body_not_requested')
            self.assertEqual(response.reads,0)

    def test_runtime_change_and_budget_fail_closed(self):
        with tempfile.TemporaryDirectory() as root:
            opener=Opener([Response(headers={'x-seo-candidate':'one'}),Response(headers={'x-seo-candidate':'two'})])
            client=verify.LoopbackClient('http://127.0.0.1:4440',Path(root),opener=opener,expected_label='one')
            client.fetch(ORIGIN+'/a/')
            with self.assertRaisesRegex(ValueError,'runtime_label_mismatch'): client.fetch(ORIGIN+'/b/')
            client=verify.LoopbackClient('http://127.0.0.1:4440',Path(root),opener=Opener([Response()]),request_limit=1)
            client.fetch(ORIGIN+'/c/')
            with self.assertRaisesRegex(ValueError,'budget_exhausted'): client.fetch(ORIGIN+'/d/')

    def test_campaign_canonical_preserves_meaningful_query_parameters(self):
        self.assertEqual(verify.expected_canonical(ORIGIN+'/page/?utm_source=rss&utm_campaign=one'),ORIGIN+'/page/')
        self.assertEqual(verify.expected_canonical(ORIGIN+'/sermons/?sermon_book=romans&utm_source=rss'),ORIGIN+'/sermons/?sermon_book=romans')

    def test_error_pages_and_fragment_links_do_not_create_crawl_targets(self):
        with tempfile.TemporaryDirectory() as root:
            base=Path(root);baseline=base/'source.json';baseline.write_text(json.dumps({'pages':{},'completed':False}),encoding='utf8')
            run=verify.Verification(baseline,'http://127.0.0.1:4440',base/'private'/'run')
            run.robots.parse(['User-agent: *','Allow: /'])
            extracted={'canonicalUrls':[],'links':[{'href':'#main-content'},{'href':ORIGIN+'/actual-page/'}]}
            run.inspect_page({'url':ORIGIN+'/missing/','status':404,'headers':{'x-robots-tag':'noindex'},'extracted':extracted},{})
            self.assertEqual(run.internal_targets,set())
            run.inspect_page({'url':ORIGIN+'/existing/','status':200,'headers':{'x-robots-tag':'noindex'},'extracted':extracted},{})
            self.assertEqual(run.internal_targets,{ORIGIN+'/actual-page/'})

    def test_inventory_keeps_pending_excluded_assets_external_dependencies(self):
        ledger={'pages':{ORIGIN+'/a/':{}},'discovered':{ORIGIN+'/b/':{}},'pendingUrls':[ORIGIN+'/b/'],'assets':{ORIGIN+'/image.jpg':{}},'excluded':{ORIGIN+'/recording.mp3':'recording_not_requested'}}
        assets={'assets':{ORIGIN+'/image.jpg':{}},'remainingDependencies':{'https://outside.example/font.woff':{}},'excludedResources':{ORIGIN+'/old.zip':{}}}
        rows=verify.inventory(ledger,assets)
        self.assertEqual(len(rows),6);self.assertEqual(rows[ORIGIN+'/b/'],'pending');self.assertEqual(rows[ORIGIN+'/image.jpg'],'asset_captured')
        self.assertTrue(verify.safe_url('https://outside.example/x?key=sensitive').startswith('external-reference:'))
        self.assertNotIn('sensitive',verify.safe_url('https://outside.example/x?key=sensitive'))

    def test_source_evidence_hash_and_path_are_independently_bound(self):
        with tempfile.TemporaryDirectory() as root:
            base=Path(root);body=b'<main><p>Anonymous source text.</p></main>'
            (base/'body').write_bytes(body)
            record={'url':ORIGIN+'/example/','responsePath':'body','bodySha256':verify.digest(body),'headers':{'content-type':'text/html'}}
            (base/'record.json').write_text(json.dumps(record),encoding='utf8')
            summary={'recordPath':'record.json','bodySha256':verify.digest(body)}
            self.assertTrue(verify.source_record(base,summary)['mainFound'])
            (base/'body').write_bytes(body+b'x')
            with self.assertRaisesRegex(ValueError,'digest_mismatch'): verify.source_record(base,summary)
            with self.assertRaisesRegex(ValueError,'path_invalid'): verify.confined_file(base,'../outside')

    def test_content_counts_duplicate_blocks_and_preserves_explicit_media_relationship(self):
        source_html='<html lang="en"><title>Example</title><body class="single-sermons"><h1>Example</h1><div class="sermon-container_inner"><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><div class="sermon-main-content"><p>Repeated wording.</p><p>Repeated wording.</p><img src="/image.jpg" alt="Anonymous image"></div></div></body></html>'
        target='<html lang="en"><title>Example</title><main><h1>Example</h1><p>Repeated wording.</p><img src="/image.jpg" alt="Anonymous image"><button data-load-youtube data-video-id="abcdefghijk"></button></main></html>'
        source=verify.parser.extract(source_html,ORIGIN+'/sermons/example/')
        candidate=verify.parser.extract(target,ORIGIN+'/sermons/example/')
        diff=verify.compare_content(source,candidate,target)
        self.assertEqual(diff['missingBlockCount'],1);self.assertEqual(diff['missingMediaCount'],0);self.assertEqual(diff['missingImageCount'],0)
        self.assertNotIn('Repeated wording',json.dumps(diff));self.assertNotIn('abcdefghijk',json.dumps(diff))
        bad=target.replace('data-load-youtube','data-unrelated-card')
        self.assertEqual(verify.compare_content(source,verify.parser.extract(bad,ORIGIN),bad)['missingMediaCount'],1)

    def test_empty_source_main_does_not_borrow_related_text(self):
        source=verify.parser.extract('<body class="single-sermons"><h1>Example</h1><div class="sermon-main-content"></div><aside><p>Unrelated.</p></aside></body>',ORIGIN)
        candidate=verify.parser.extract('<main><h1>Example</h1><p>Additional page controls.</p></main>',ORIGIN)
        diff=verify.compare_content(source,candidate)
        self.assertTrue(diff['emptySourceMain']);self.assertEqual(diff['missingBlockCount'],0)

    def test_incomplete_run_still_reports_each_frozen_inventory_row(self):
        with tempfile.TemporaryDirectory() as root:
            base=Path(root);baseline=base/'ledger.json';baseline.write_text(json.dumps({'pages':{},'pendingUrls':[ORIGIN+'/pending/'],'completed':False}),encoding='utf8')
            run=verify.Verification(baseline,'http://127.0.0.1:4440',base/'private'/'run')
            summary=run.reports('candidate_unreachable')
            self.assertEqual(summary['inventoryReportRows'],1);self.assertEqual(summary['checkedInventoryRows'],0)
            self.assertFalse(summary['passed']);self.assertEqual(run.rows[0]['issues'],'candidate_not_checked')
            with self.assertRaisesRegex(ValueError,'already_used'): verify.Verification(baseline,'http://127.0.0.1:4440',base/'private'/'run')

    def test_event_detail_blocks_are_compared_independently(self):
        source=verify.parser.extract('<main><h1>Example</h1><p>Event introduction.</p></main>',ORIGIN)
        source['eventMetadataTree']=[{'tag':'p','children':[{'tag':'text','text':'Venue information.'}]}]
        target=verify.parser.extract('<main><h1>Example</h1><p>Event introduction.</p></main>',ORIGIN)
        self.assertEqual(verify.compare_content(source,target)['missingBlockCount'],1)
        target=verify.parser.extract('<main><h1>Example</h1><p>Event introduction.</p><p>Venue information.</p></main>',ORIGIN)
        self.assertEqual(verify.compare_content(source,target)['missingBlockCount'],0)

    def test_deferred_rows_remain_explicit_even_if_not_in_discovered(self):
        rows=verify.inventory({'deferred':{ORIGIN+'/deferred/':{'reason':'observed_unverified'}}})
        self.assertEqual(rows[ORIGIN+'/deferred/'],'deferred:observed_unverified')

    def test_redirect_loops_and_multi_hops_are_reported_without_automatic_follow(self):
        with tempfile.TemporaryDirectory() as root:
            opener=Opener([Response(301,{'location':'/b/'}),Response(302,{'location':'/c/'}),Response(301,{'location':'/a/'})])
            client=verify.LoopbackClient('http://127.0.0.1:4440',Path(root),opener=opener)
            result=client.follow(ORIGIN+'/a/')
            self.assertEqual(len(opener.requests),3)
            for issue in ['redirect_loop','redirect_not_permanent_301','redirect_not_one_hop']: self.assertIn(issue,result['issues'])

    def test_end_to_end_anonymous_frozen_source_and_candidate(self):
        with tempfile.TemporaryDirectory() as root:
            base=Path(root);url=ORIGIN+'/example/'
            html=('<html lang="en"><head><title>Example</title><link rel="canonical" href="'+url+'"><meta name="robots" content="index, follow"></head><body><main><h1>Example</h1><p>Anonymous preserved wording.</p></main></body></html>').encode()
            (base/'body').write_bytes(html)
            record={'url':url,'status':200,'responsePath':'body','bodySha256':verify.digest(html),'headers':{'content-type':'text/html'}}
            (base/'record.json').write_text(json.dumps(record),encoding='utf8')
            baseline=base/'ledger.json';baseline.write_text(json.dumps({'pages':{url:{'recordPath':'record.json','bodySha256':verify.digest(html)}},'pendingUrls':[],'completed':True}),encoding='utf8')
            run=verify.Verification(baseline,'http://127.0.0.1:4440',base/'private'/'run')
            run.client.opener=Opener([Response(body=b'User-agent: *\nAllow: /\n'),Response(headers={'content-type':'application/xml'},body=('<urlset><url><loc>'+url+'</loc></url></urlset>').encode()),Response(headers={'content-type':'text/html'},body=html)])
            summary=run.run();self.assertTrue(summary['passed'],summary['issueCounts']);self.assertEqual(summary['candidateRequests'],3)
            self.assertTrue(summary['unverifiedRuntimeIdentity'])

class DateComparisonTests(unittest.TestCase):
    def test_equal_instants_do_not_hide_missing_or_changed_dates(self):
        source={'mainFound':True,'mainText':'','publishedAt':'2020-01-01T11:00:00+11:00'}
        candidate={'mainFound':True,'mainText':'','publishedAt':'2020-01-01T00:00:00Z'}
        self.assertNotIn('publishedAt', verify.compare_content(source,candidate)['metadataChanges'])
        self.assertIn('publishedAt', verify.compare_content(source,{**candidate,'publishedAt':None})['metadataChanges'])

if __name__=='__main__': unittest.main()
