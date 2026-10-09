import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('source_capture',Path(__file__).parents[1]/'scripts/seo-source-capture.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
ORIGIN='https://www.savinggrace.org.au/'

class SourceCaptureTests(unittest.TestCase):
    def test_preserves_empty_sermon_body_without_borrowing_other_content(self):
        document='''<html lang="en-AU"><head><title>Anonymous source title</title><meta property="article:published_time" content="2026-02-09T10:00:00+00:00"></head><body class="single-sermons postid-52"><h1>Anonymous source heading</h1><div class="sermon-container_inner"><div class="sermon-header-details">8 February, 2026</div><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><div class="sermon-main-content"> </div></div><footer><a href="https://www.youtube.com/@example">Channel</a></footer><div class="asp-related-sermons-holder"><p>Unrelated example text</p></div></body></html>'''
        result=capture.extract(document,ORIGIN+'sermons/anonymous/')
        self.assertTrue(result['mainFound']);self.assertEqual(result['mainText'],'')
        self.assertNotIn('Unrelated example',result['mainHtml'])
        self.assertEqual(result['sourcePostId'],52);self.assertEqual(result['serviceDate'],'2026-02-08')
        self.assertEqual(result['publishedAt'],'2026-02-09T10:00:00+00:00')
        self.assertEqual(len(result['primaryMediaReferences']),1)
        self.assertEqual(result['primaryMediaReferences'][0]['tag'],'iframe')
        self.assertEqual(len(result['mediaReferences']),2)

    def test_source_tree_preserves_content_and_removes_executable_markup(self):
        document='''<html><body class="page page-id-7"><h1>Example</h1><div class="page-content"><h1>Example</h1><p>First <em>approved</em> words &amp; text.</p><a href="javascript:alert(1)">Unsafe link</a><img src="/wp-content/uploads/example.jpg" alt="A synthetic image" onerror="alert(1)" width="240"><script>private_script()</script><form><p>Form-only text</p></form><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe></div></body></html>'''
        result=capture.extract(document,ORIGIN)
        import json
        encoded=json.dumps(result['contentTree'])
        self.assertNotIn('private_script',encoded);self.assertNotIn('javascript:',encoded)
        self.assertNotIn('onerror',encoded);self.assertNotIn('Form-only',encoded)
        self.assertNotIn('iframe',encoded);self.assertNotIn('"tag": "h1"',encoded)
        self.assertIn('https://www.savinggrace.org.au/wp-content/uploads/example.jpg',encoded)
        self.assertIn('approved',encoded);self.assertIn('A synthetic image',encoded)

    def test_archive_does_not_inherit_first_card_source_identity(self):
        article='<article id="post-9"><div class="post-content">Anonymous post</div></article>'
        archive=capture.extract('<body class="archive category"><main>'+article+'</main></body>',ORIGIN)
        self.assertIsNone(archive['sourcePostId'])
        page=capture.extract('<body class="page page-id-7"><main>'+article+'</main></body>',ORIGIN)
        self.assertEqual(page['sourcePostId'],7)
        single=capture.extract('<body class="single single-post">'+article+'</body>',ORIGIN)
        self.assertEqual(single['sourcePostId'],9)

    def test_listing_preserves_all_cards_while_single_post_uses_own_body(self):
        cards='<article><div class="post-content"><p>First card</p></div></article><article><div class="post-content"><p>Second card</p></div></article>'
        for body in ['archive category','page page-id-8']:
            result=capture.extract('<body class="'+body+'"><h1>Example list</h1><div id="main-content"><div class="page-content">'+cards+'</div></div></body>',ORIGIN)
            self.assertIn('First card',result['mainText']);self.assertIn('Second card',result['mainText'])
        post=capture.extract('<body class="single-post"><div id="main-content">'+cards+'</div></body>',ORIGIN)
        self.assertEqual(post['mainText'],'First card')

    def test_missing_or_ambiguous_service_date_is_not_publication_date(self):
        for detail in ['', '1 January, 2026 and 2 January, 2026']:
            result=capture.extract('<body class="single-sermons"><meta property="article:published_time" content="2026-02-09T10:00:00Z"><div class="sermon-header-details">'+detail+'</div><div class="sermon-main-content"></div></body>',ORIGIN)
            self.assertIsNone(result['serviceDate'])
            self.assertEqual(result['publishedAt'],'2026-02-09T10:00:00Z')

    def test_unknown_content_region_is_explicit_not_whole_page_fallback(self):
        result=capture.extract('<body><header>Global navigation</header><div>Unidentified body</div></body>',ORIGIN)
        self.assertFalse(result['mainFound']);self.assertEqual(result['mainText'],'')
        self.assertEqual(result['extractionWarning'],'main_content_region_not_identified')

    def test_xml_feeds_inventory_authored_links_without_fetching_recordings(self):
        raw='<rss><channel><link>'+ORIGIN+'</link><item><link>'+ORIGIN+'event/example/</link><guid>'+ORIGIN+'?p=5</guid><enclosure url="https://outside.example/recording.mp3"/></item></channel></rss>'
        metadata=capture.xml_metadata(raw,ORIGIN+'feed/')
        self.assertEqual(metadata['xmlRoot'],'rss')
        self.assertIn({'url':ORIGIN+'event/example/','kind':'feed_item'},metadata['feedUrls'])
        self.assertIn({'url':ORIGIN+'?p=5','kind':'feed_guid'},metadata['feedUrls'])
        self.assertFalse(any('recording' in item['url'] for item in metadata['feedUrls']))

    def test_host_probe_is_four_bounded_independent_requests_and_preserves_ledger(self):
        import json
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/'private';folder.mkdir()
            ledger={'pages':{},'marker':'immutable baseline'};(folder/'ledger.private.json').write_text(json.dumps(ledger))
            old=(folder/'ledger.private.json').read_bytes();requests=[]
            def response(job,url):
                requests.append(url);body=b'<html><head></head><body><main>Example</main></body></html>'
                return {'url':url,'status':200,'headers':{},'bodySha256':capture.digest(body)},body
            with patch.object(capture.Capture,'get',response),patch('builtins.print'):capture.verify_host_variants(folder)
            self.assertEqual(len(requests),4);self.assertEqual(len(set(requests)),4)
            self.assertEqual((folder/'ledger.private.json').read_bytes(),old)
            receipt=json.loads((folder/'host-checks.private.json').read_text())
            self.assertFalse(receipt['redirectsFollowed']);self.assertEqual(len(receipt['responses']),4)
            self.assertTrue(all(len(Path(r['responsePath']).name)<=64 for r in receipt['responses']))

    def test_measurement_tags_are_evidence_only(self):
        result=capture.extract('''<head><script src="https://www.googletagmanager.com/gtag/js?id=G-ABC12345"></script><script>gtag('config','G-ABC12345');var container='GTM-ABCD123';</script><meta name="google-site-verification" content="anonymous-verification-fixture"></head><body><main>Example</main></body>''',ORIGIN)
        signals=result['measurementSignals']
        self.assertEqual(signals['googleAnalyticsIds'],['G-ABC12345'])
        self.assertEqual(signals['googleTagManagerIds'],['GTM-ABCD123'])
        self.assertEqual(signals['verificationMetaNames'],['google-site-verification'])
        self.assertEqual(len(signals['scriptUrls']),1)

    def test_discovery_never_requests_recordings_admin_or_external_assets(self):
        with tempfile.TemporaryDirectory() as root:
            job=capture.Capture(Path(root)/'private',20,0,20)
            for path in ['/recording.mp3','/wp-admin/','/image.jpg','/?action=delete','https://outside.example/page/']:
                job.enqueue(path,'anonymous_test',ORIGIN)
            self.assertEqual(job.delay,1);self.assertEqual(job.retries,2)
            self.assertEqual(job.state['excluded'][ORIGIN+'recording.mp3'],'recording_not_requested')
            self.assertEqual(job.state['excluded'][ORIGIN+'wp-admin/'],'administrative_endpoint')
            self.assertEqual(job.state['excluded'][ORIGIN+'image.jpg'],'asset_reference_only')
            self.assertEqual(job.state['excluded'][ORIGIN+'?action=delete'],'stateful_or_unbounded_parameter')
            self.assertFalse(any('outside.example' in url for url in job.state['discovered']))

    def test_url_boundaries_reject_userinfo_nonweb_and_nonstandard_ports(self):
        for value in ['javascript:alert(1)','https://user:secret@www.savinggrace.org.au/','https://www.savinggrace.org.au:8443/']:
            self.assertIsNone(capture.address(value,ORIGIN))
        self.assertFalse(capture.allowed('https://www.savinggrace.org.au.evil.example/'))
        self.assertFalse(capture.allowed('https://outside.example/'))
        self.assertEqual(capture.address('/a/#part',ORIGIN),ORIGIN+'a/')

    def test_changed_response_preserves_old_bytes_with_short_collision_path(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/'private';job=capture.Capture(folder,20,1,0)
            bodies=[b'<html><body><main>First snapshot</main></body></html>',b'<html><body><main>Second snapshot</main></body></html>']
            def response(url):
                body=bodies.pop(0)
                return {'url':url,'status':200,'headers':{'content-type':'text/html'},'capturedAt':'2026-01-01T00:00:00Z','bodySha256':capture.digest(body)},body
            with patch.object(job,'get',response):
                first,raw_first=job.capture(ORIGIN);second,raw_second=job.capture(ORIGIN)
            self.assertNotEqual(first['responsePath'],second['responsePath'])
            self.assertEqual((folder/first['responsePath']).read_bytes(),raw_first)
            self.assertEqual((folder/second['responsePath']).read_bytes(),raw_second)
            self.assertLessEqual(len(Path(second['responsePath']).name),64)

    def test_url_cap_keeps_remaining_queue_explicit(self):
        with tempfile.TemporaryDirectory() as root:
            job=capture.Capture(Path(root)/'private',2,1,0)
            for path in ['/first/','/second/','/third/']:job.enqueue(path,'anonymous_test',ORIGIN)
            job.state['pages']={ORIGIN+'first/':{},ORIGIN+'second/':{}}
            job.checkpoint(done=True)
            self.assertTrue(job.state['capReached']);self.assertFalse(job.state['completed'])
            self.assertEqual(job.state['pendingUrls'],[ORIGIN+'third/'])


    def test_event_metadata_preserves_source_labels_without_invented_dates(self):
        result=capture.extract('<body class="single-tribe_events postid-11"><h1>Example event</h1><div class="tribe-events-single-event-description"><p>Original description</p></div><div class="tribe-events-event-meta"><dl><dt>Start:</dt><dd><time datetime="2026-03-01">Sunday afternoon</time></dd><dt>Venue:</dt><dd><a href="/venue/example/">Example place</a></dd></dl><script>excluded()</script></div></body>',ORIGIN+'event/example/')
        import json
        value=json.dumps(result['eventMetadataTree'])
        self.assertIn('Sunday afternoon',value);self.assertIn('Example place',value)
        self.assertNotIn('excluded()',value);self.assertNotIn('Original description',value)
        self.assertIsNone(result['serviceDate']);self.assertEqual(result['eventMetadataSelector'],'tribe-events-event-meta')
        fallback=capture.extract('<body class="single-tribe_events"><main><div class="tribe-events-event-meta"><p>Example venue</p></div></main></body>',ORIGIN)
        self.assertTrue(fallback['eventMetadataIncludedInMain']);self.assertEqual(fallback['eventMetadataTree'],[])
        self.assertIn('Example venue',json.dumps(fallback['contentTree']))
        themed=capture.extract('<body class="single-tribe_events"><div class="wpv-single-event-schedule"><p>Sunday at example address</p></div><div class="tribe-events-single-event-description">Description</div><div class="wpv-tribe-events-meta"><h2>Details</h2><p>Original date</p><h2 class="tribe-events-related-events-title">Related events</h2><ul class="tribe-related-events"><li>Another event</li></ul></div></body>',ORIGIN)
        themed_text=json.dumps(themed['eventMetadataTree'])
        self.assertIn('Sunday at example address',themed_text);self.assertIn('Original date',themed_text)
        self.assertNotIn('Another event',themed_text);self.assertNotIn('Related events',themed_text)

    def test_noncanonical_and_duplicate_hosts_do_not_recursively_expand(self):
        self.assertEqual(capture.expansion_policy({'url':ORIGIN+'sermons/?sermon_series=example/','canonicalUrls':[ORIGIN+'sermons/?sermon_series=example']}),'noncanonical_no_recursive_expansion')
        self.assertEqual(capture.expansion_policy({'url':'https://savinggrace.org.au/','canonicalUrls':['https://savinggrace.org.au/']}),'duplicate_host_no_recursive_expansion')
        with tempfile.TemporaryDirectory() as root:
            job=capture.Capture(Path(root)/'private',20,1,0)
            alias=ORIGIN+'alias/';job.source_expansion[alias]='noncanonical_no_recursive_expansion'
            job.enqueue('/observed/','link',alias);job.enqueue('/canonical/','canonical',alias)
            self.assertEqual(job.pending(),[ORIGIN+'canonical/'])
            self.assertIn(ORIGIN+'observed/',job.state['discovered']);self.assertIn(ORIGIN+'observed/',job.state['deferred'])
            job.enqueue('/observed/','sitemap',ORIGIN+'sitemap.xml')
            self.assertIn(ORIGIN+'observed/',job.pending())

    def test_generated_calendar_remains_visible_without_endless_navigation(self):
        with tempfile.TemporaryDirectory() as root:
            job=capture.Capture(Path(root)/'private',20,1,0)
            for value in ['/events/2029-01-01/','/event/example/2029-01-01/','/events/?tribe-bar-date=2029-01-01']:
                job.enqueue(value,'link',ORIGIN+'events/')
            job.enqueue('/event/authored/','link',ORIGIN+'events/')
            job.enqueue('/event/example/2029-01-01/','sitemap',ORIGIN+'sitemap.xml')
            self.assertEqual(set(job.pending()),{ORIGIN+'event/authored/',ORIGIN+'event/example/2029-01-01/'})
            job.state['pages']={url:{} for url in job.pending()};job.checkpoint(done=True)
            self.assertTrue(job.state['htmlPhaseComplete']);self.assertTrue(job.state['htmlPhaseFrozen'])
            self.assertFalse(job.state['completed']);self.assertEqual(len(job.state['deferred']),2)

    def test_network_lease_refuses_second_worker_and_releases(self):
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/'private'
            with capture.network_lease(folder):
                with self.assertRaisesRegex(ValueError,'capture_network_worker_already_running'):
                    with capture.network_lease(folder):pass
            with capture.network_lease(folder):pass

    def test_source_url_spaces_and_unicode_are_request_safe(self):
        self.assertEqual(capture.address('/some words/?name=R\u00e9sum\u00e9',ORIGIN),ORIGIN+'some%20words/?name=R%C3%A9sum%C3%A9')


class AssetCaptureTests(unittest.TestCase):
    def test_jetpack_mapping_requires_exact_approved_embedded_origin(self):
        value=capture.church_original_image('https://i0.wp.com/savinggrace.org.au/wp-content/uploads/example.jpg?resize=300%2C200')
        self.assertEqual(value,'https://savinggrace.org.au/wp-content/uploads/example.jpg')
        for value in ['https://i0.wp.com/evil.example/wp-content/uploads/example.jpg','https://i0.wp.com/savinggrace.org.au/wp-admin/example.jpg','https://evil.example/savinggrace.org.au/wp-content/uploads/example.jpg','https://i0.wp.com/savinggrace.org.au/wp-content/uploads/recording.mp3']:
            self.assertIsNone(capture.church_original_image(value))

    def test_mime_and_magic_must_agree(self):
        with tempfile.TemporaryDirectory() as root:
            file=Path(root)/'synthetic.png';file.write_bytes(b'\x89PNG\r\n\x1a\n' + b'anonymous fixture')
            self.assertTrue(capture.inspect_asset_magic(file,'image/png')['valid'])
            self.assertEqual(capture.inspect_asset_magic(file,'image/jpeg')['reason'],'mime_magic_mismatch')
            file.write_bytes(b'<html>not an image</html>')
            self.assertFalse(capture.inspect_asset_magic(file,'image/png')['valid'])

    def test_active_svg_is_retained_for_review_not_accepted(self):
        with tempfile.TemporaryDirectory() as root:
            file=Path(root)/'synthetic.svg';file.write_text('<svg xmlns="http://www.w3.org/2000/svg" onload="fixture()"></svg>')
            self.assertEqual(capture.inspect_asset_magic(file,'image/svg+xml')['reason'],'active_svg_requires_review')

    def test_document_package_requires_actual_office_structure(self):
        import zipfile
        with tempfile.TemporaryDirectory() as root:
            file=Path(root)/'synthetic.docx'
            with zipfile.ZipFile(file,'w') as package:package.writestr('unrelated.txt','fixture')
            mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            self.assertEqual(capture.inspect_asset_magic(file,mime)['reason'],'document_package_structure_invalid')
            with zipfile.ZipFile(file,'w') as package:package.writestr('word/document.xml','<document/>')
            self.assertTrue(capture.inspect_asset_magic(file,mime)['valid'])

    def test_captured_feed_is_manifested_without_reserializing_or_requesting(self):
        import json
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/'private';folder.mkdir();(folder/'responses').mkdir();(folder/'pages').mkdir()
            raw=b'<?xml version="1.0"?><rss version="2.0"><channel><title>Anonymous</title></channel></rss>'
            (folder/'responses/feed.body').write_bytes(raw)
            feed={'url':ORIGIN+'feed/','status':200,'xmlRoot':'rss','responsePath':'responses/feed.body','bodySha256':capture.digest(raw),'capturedAt':'2026-01-01T00:00:00Z','attempts':1,'headers':{'content-type':'application/rss+xml; charset=UTF-8'}}
            (folder/'pages/feed.json').write_text(json.dumps(feed))
            pages={feed['url']:{'recordPath':'pages/feed.json'}}
            for index,origin in enumerate(capture.ORIGINS):
                path='pages/robots'+str(index)+'.json';(folder/path).write_text(json.dumps({'status':404}))
                pages[origin+'/robots.txt']={'recordPath':path}
            (folder/'ledger.private.json').write_text(json.dumps({'htmlPhaseFrozen':True,'pages':pages}))
            with patch.object(capture,'build_opener') as opener,patch('builtins.print'):
                capture.capture_assets(folder)
                opener.return_value.open.assert_not_called()
            manifest=json.loads((folder/'assets-capture.private.json').read_text())
            entry=manifest['assets'][feed['url']]
            self.assertEqual(entry['kind'],'feed');self.assertEqual(entry['sha256'],capture.digest(raw))
            self.assertEqual((folder/entry['relativePath']).read_bytes(),raw)
            self.assertEqual(entry['mime'],'application/rss+xml');self.assertTrue(entry['validation']['valid'])

    def test_assets_refuse_concurrent_unfinished_html_phase(self):
        import json
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/'private';folder.mkdir()
            (folder/'ledger.private.json').write_text(json.dumps({'completed':False,'capReached':False,'paused':False}))
            with self.assertRaisesRegex(ValueError,'asset_phase_requires_stopped_html_capture'):capture.capture_assets(folder)

if __name__=='__main__':unittest.main()

