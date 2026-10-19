"""Anonymous offline operator checks. No database, network or Docker calls."""
import copy
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import tarfile
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("seo_operator_fixture", ROOT / "deployment/seo-remote.py")
OP = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(OP)
COMMIT = "a" * 40; IMAGE = "sha256:" + "b" * 64


def base(root):
    def sha(path):
        if path.is_symlink() or not path.is_file(): raise RuntimeError("cms_file_refused")
        return hashlib.sha256(path.read_bytes()).hexdigest()
    return SimpleNamespace(ASSETS=root, sha=sha, load=lambda path: json.loads(path.read_text()))


def asset(data=b"anonymous asset", suffix="pdf"):
    digest = hashlib.sha256(data).hexdigest()
    return {"storageKey": digest + "." + suffix, "sha256": digest, "contentType": "application/pdf", "bytes": len(data)}


def archive(path, records):
    with tarfile.open(path, "w") as output:
        for name, data, kind in records:
            info = tarfile.TarInfo(name); info.size = len(data); info.type = kind
            output.addfile(info, io.BytesIO(data) if kind == tarfile.REGTYPE else None)


class SeoDeploymentTest(unittest.TestCase):
    def test_digest_snapshot_hashes_every_complete_row_without_retaining_duplicate_decoded_payloads(self):
        row={'version_sha256':'one','payload':{'text':'Anonymous complete payload','other':[1,2,3]}}
        def sql(statement):return b'3' if 'pg_tables' in statement else b'1' if statement.endswith('source_public_versions') else b'0'
        fake=SimpleNamespace(sql=sql,_seo_streaming_source_reader=True,stream_source_batches=lambda name,key,count:iter([[row]]if count else[]))
        full=OP.source_snapshot(fake);digests=OP.source_snapshot(fake,digest_only=True)
        self.assertEqual(digests,{name:[hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()for value in rows]for name,rows in full.items()})
        calls=[]
        def changed(name,key,count):
            if count:
                calls.append(name);yield [{**row,'payload':{'text':'Changed complete payload'if len(calls)>1 else'Anonymous complete payload'}}]
        fake.stream_source_batches=changed
        with self.assertRaisesRegex(RuntimeError,'seo_source_snapshot_changed'):OP.source_snapshot(fake,digest_only=True)


    def test_streamed_source_packets_keep_scope_guards_and_full_identity_checks(self):
        def process(output):
            value=Mock(stdout=io.BytesIO(output));value.poll.return_value=0;value.wait.return_value=0;return value
        rows=[{'version_sha256':'one','payload':{'text':'Anonymous complete row'}}]
        transport=process(b'1\n'+json.dumps(rows).encode()+b'\n1\n')
        def launch(command,**kwargs):
            self.assertEqual(command[:4],['docker','exec','-i','anonymous-db'])
            statement=kwargs['stdin'].read().decode();self.assertIn('REPEATABLE READ READ ONLY',statement);self.assertIn('statement_timeout',statement);self.assertIn('LIMIT 128 OFFSET 0',statement);self.assertNotRegex(statement,r'(?i)\b(?:insert|update|delete|grant|alter|drop)\b');return transport
        with patch.object(OP.subprocess,'Popen',side_effect=launch):self.assertEqual(list(OP.stream_source_batches(SimpleNamespace(DB='anonymous-db'),'source_public_versions','version_sha256',1)),[rows])
        transport.kill.assert_not_called()
        for name,key,count in [('other','id',1),('source_public_versions','wrong',1),('source_public_versions','version_sha256',-1)]:
            with patch.object(OP.subprocess,'Popen') as launch,self.assertRaisesRegex(RuntimeError,'seo_source_batch_scope'):list(OP.stream_source_batches(SimpleNamespace(DB='anonymous-db'),name,key,count))
            launch.assert_not_called()

    def test_streamed_source_packets_refuse_counts_truncation_extra_output_and_database_errors(self):
        rows=json.dumps([{'version_sha256':'one'}]).encode()
        for output,returncode in [(b'true\n'+rows+b'\n1\n',0),(b'2\n',0),(b'1\n'+rows+b'\n2\n',0),(b'1\n[]\n1\n',0),(b'1\n'+rows+b'\n1\nextra',0),(b'1\n'+rows+b'\n1\n',1),(b'1\n[',0)]:
            process=Mock(stdout=io.BytesIO(output));process.poll.return_value=0;process.wait.return_value=returncode
            with patch.object(OP.subprocess,'Popen',return_value=process),self.assertRaisesRegex(RuntimeError,'seo_source_(?:snapshot_changed|batch_transport)'):list(OP.stream_source_batches(SimpleNamespace(DB='anonymous-db'),'source_public_versions','version_sha256',1))

    def test_streamed_snapshot_still_reads_two_separate_complete_passes_and_refuses_same_count_changes(self):
        rows=[{'version_sha256':'one','payload':{'version':1}}];calls=[]
        def sql(statement):return b'3' if 'pg_tables' in statement else b'1' if statement.endswith('source_public_versions') else b'0'
        def stream(name,key,count):
            calls.append(name)
            if count:yield rows
        fake=SimpleNamespace(sql=sql,_seo_streaming_source_reader=True,stream_source_batches=stream)
        self.assertEqual(OP.source_snapshot(fake)['source_public_versions'],rows);self.assertEqual(calls.count('source_public_versions'),2)
        def changed(name,key,count):
            if count:yield [{'version_sha256':'one','payload':{'version':len(calls)}}];calls.append(name)
        fake.stream_source_batches=changed
        with self.assertRaisesRegex(RuntimeError,'seo_source_snapshot_changed'):OP.source_snapshot(fake)


    def test_resource_receipt_rerun_retains_original_counts_and_refuses_different_identity(self):
        result=lambda inserted:{'result':{'manifestSha256':'d'*64,'inserted':inserted,'unchanged':534-inserted,'held':[]}}
        previous={'outcome':'seo_resource_redirects_imported','commit':COMMIT,'image':IMAGE,'priorRowsPreserved':True,'result':result(236),'replay':result(0)}
        current={**previous,'result':result(0)}
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/'receipt.json';path.write_text(json.dumps(previous));initial=path.read_bytes();fake=SimpleNamespace(load=lambda _:previous,save=Mock())
            OP.retain_resource_receipt(fake,path,current);fake.save.assert_not_called();self.assertEqual(path.read_bytes(),initial)
            for altered in ({**previous,'commit':'c'*40},{**previous,'replay':result(1)},{**previous,'result':{'result':{'manifestSha256':'e'*64,'inserted':236,'unchanged':298,'held':[]}}}):
                fake.load=lambda _,value=altered:value
                with self.assertRaisesRegex(RuntimeError,'seo_resource_receipt_binding'):OP.retain_resource_receipt(fake,path,current)


    def test_new_resource_audit_is_bound_to_the_frozen_manifest_not_an_older_release(self):
        manifest={'format':'sgbc-original-resource-redirects-v1','sourceInventorySha256':'a'*64,'rows':[{'oldPath':'/anonymous-old/','newPath':'/wp-content/uploads/anonymous.pdf','assetSha256':'b'*64}]}
        correlation='d182-resource-redirects:'+hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
        redirect={'id':'one','old_path':'/anonymous-old/','new_path':'/wp-content/uploads/anonymous.pdf','source_sermon_id':None,'status_code':301,'reason':'verified_original_attachment_resource','verified_at':'2026-10-19'}
        audit={'id':'audit-one','entity_type':'redirect','entity_id':'one','actor_role':'system','actor_subject':'source-public-migration','action':'seo.original_resource_redirect','request_correlation_id':correlation,'outcome':'succeeded','changed_fields':['assetSha256:'+'b'*64,'newPath:/wp-content/uploads/anonymous.pdf']}
        fake=SimpleNamespace(load=lambda path:manifest if path.name=='source-resource-redirects.private.json'else{'redirects':[],'audit':[]})
        with patch.object(OP,'resource_history_snapshot',return_value={'redirects':[redirect],'audit':[audit]}):OP.verify_resource_history(fake,pathlib.Path('/anonymous'))
        for altered in ({**audit,'request_correlation_id':'d182-resource-redirects:'+'c'*64},{**audit,'actor_subject':'other'},{**audit,'changed_fields':[]}):
            with patch.object(OP,'resource_history_snapshot',return_value={'redirects':[redirect],'audit':[altered]}),self.assertRaisesRegex(RuntimeError,'seo_unscoped_audit_added'):OP.verify_resource_history(fake,pathlib.Path('/anonymous'))


    def test_complete_hash_streams_without_whole_backup_allocation(self):
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/'backup.tar';data=b'Anonymous binary fixture.'*100000
            path.write_bytes(data)
            with patch.object(pathlib.Path,'read_bytes',side_effect=AssertionError('whole-file read refused')):
                self.assertEqual(OP.streaming_sha(path),hashlib.sha256(data).hexdigest())
            with self.assertRaisesRegex(RuntimeError,'cms_file_refused'):
                OP.streaming_sha(path.parent)


    def test_preservation_hashes_all_assets_once_and_checks_every_original(self):
        manifest=Mock(return_value={'one.pdf':3,'two.mp3':9,'new.png':4})
        target=SimpleNamespace(assets_manifest=manifest)
        self.assertTrue(OP.prior_assets_preserved(target,{'one.pdf':3,'two.mp3':9}))
        manifest.assert_called_once_with()
        for original in ({'one.pdf':4},{'missing.pdf':3}):
            self.assertFalse(OP.prior_assets_preserved(target,original))
        manifest.side_effect=RuntimeError('seo_source_asset_integrity')
        with self.assertRaisesRegex(RuntimeError,'seo_source_asset_integrity'):
            OP.prior_assets_preserved(target,{'one.pdf':3})

    def test_separate_hashed_operator_keeps_the_frozen_application_transfer_scope(self):
        root = pathlib.Path("/home/ec2-user/.seo-upgrade-transfer")
        for name in (COMMIT, COMMIT + "-operator-123abcd"):
            self.assertEqual(OP.transfer_directory(COMMIT, root / name / "seo-remote.py"), root / name)
        for path in (root / ("b" * 40) / "seo-remote.py", root / (COMMIT + "-operator-other") / "seo-remote.py", pathlib.Path("/unapproved") / COMMIT / "seo-remote.py"):
            with self.assertRaisesRegex(RuntimeError, "seo_transfer_directory_scope"):
                OP.transfer_directory(COMMIT, path)


    def test_inventory_memory_settles_without_lowering_the_required_capacity(self):
        threshold = 2 * 1024**3
        with patch.object(OP, "release_inventory_memory") as release, patch.object(OP, "available_source_memory", side_effect=[threshold - 1, threshold]), patch.object(OP.time, "monotonic", side_effect=[0, 1]), patch.object(OP.time, "sleep") as sleep:
            OP.verify_source_memory()
        release.assert_called_once_with()
        sleep.assert_called_once_with(2)

    def test_memory_capacity_still_refuses_a_host_that_does_not_recover(self):
        with patch.object(OP, "release_inventory_memory"), patch.object(OP, "available_source_memory", return_value=2 * 1024**3 - 1), patch.object(OP.time, "monotonic", side_effect=[0, 31]), patch.object(OP.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "seo_source_memory_insufficient"):
                OP.verify_source_memory()
        sleep.assert_not_called()

    def test_allocator_release_touches_only_own_process_allocations(self):
        trim = Mock()
        with patch.object(OP.gc, "collect") as collect, patch.object(OP.ctypes, "CDLL", return_value=SimpleNamespace(malloc_trim=trim)) as library, patch.object(OP.sys, "platform", "linux"):
            OP.release_inventory_memory()
        collect.assert_called_once_with()
        library.assert_called_once_with(None)
        trim.assert_called_once_with(0)


    def test_source_snapshot_batches_preserve_all_complete_rows_and_identity(self):
        rows = [{"version_sha256":str(n),"payload":{"text":"anonymous "*10}} for n in range(260)]
        calls = []
        def sql(statement):
            calls.append(statement)
            if "pg_tables" in statement: return b"3"
            if statement.startswith("SELECT count(*) FROM "):
                return str(260 if statement.endswith("source_public_versions") else 0).encode()
            offset=int(statement.split(" OFFSET ")[1].split(")")[0])
            return json.dumps(rows[offset:offset+128]).encode()
        result=OP.source_snapshot(SimpleNamespace(sql=sql))
        self.assertEqual(result['source_public_versions'],rows)
        self.assertEqual(result['source_public_routes'],[])
        self.assertEqual(result['source_public_imports'],[])
        self.assertEqual(sum(" LIMIT 128 OFFSET " in x for x in calls),6)

    def test_source_snapshot_refuses_same_count_payload_changes(self):
        reads=0
        def sql(statement):
            nonlocal reads
            if "pg_tables" in statement:return b"3"
            if statement.startswith("SELECT count(*) FROM "):return b"1" if statement.endswith("source_public_versions") else b"0"
            reads+=1
            return json.dumps([{"version_sha256":"one","payload":{"version":reads}}]).encode()
        with self.assertRaisesRegex(RuntimeError,"seo_source_snapshot_changed"):
            OP.source_snapshot(SimpleNamespace(sql=sql))

    def test_source_snapshot_refuses_truncated_or_repeated_batch_identity(self):
        for rows in ([{"version_sha256":"same"}]*2,[{"version_sha256":"one"}]):
            def sql(statement):
                if "pg_tables" in statement:return b"3"
                if statement.startswith("SELECT count(*) FROM "):return b"2" if statement.endswith("source_public_versions") else b"0"
                return json.dumps(rows).encode()
            with self.assertRaisesRegex(RuntimeError,"seo_source_snapshot_changed"):
                OP.source_snapshot(SimpleNamespace(sql=sql))

    def test_existing_source_retry_refuses_unknown_history_or_bundle(self):
        valid={'sourceCounts':{'source_public_versions':8033,'source_public_routes':6141,'source_public_imports':8},'sourceSha256':OP.EXISTING_SOURCE_SHA}
        OP.verify_existing_source(valid,OP.INCOMING_BUNDLE_SHA)
        with self.assertRaisesRegex(RuntimeError,'seo_existing_source_drift'):OP.verify_existing_source(valid,OP.EXISTING_BUNDLE_SHA)
        for changed,bundle in (({**valid,'sourceSha256':'0'*64},OP.INCOMING_BUNDLE_SHA),(valid,'0'*64),({**valid,'sourceCounts':{}},OP.INCOMING_BUNDLE_SHA)):
            with self.assertRaisesRegex(RuntimeError,'seo_existing_source_drift'):OP.verify_existing_source(changed,bundle)

    def test_bulk_worker_memory_is_bounded_and_does_not_change_visitor_configuration(self):
        original={"name":"anonymous", "services":{"app":{"read_only":True,"cap_drop":["ALL"],"mem_limit":768*1024**2,"ports":["127.0.0.1:8082:8080"],"networks":{"private":{}},"environment":{"NODE_OPTIONS":"--max-old-space-size=384"}}},"secrets":{}}
        retained=copy.deepcopy(original)
        worker=OP.maintenance_configuration(original,IMAGE,COMMIT,"/anonymous/owner",pathlib.Path("/anonymous/release"),"b"*64)
        self.assertEqual(original,retained)
        app=worker["services"]["app"]
        self.assertEqual(app["mem_limit"],1536*1024**2)
        self.assertEqual(app["environment"]["NODE_OPTIONS"],"--max-old-space-size=768")
        self.assertNotIn("ports",app)
        self.assertTrue(app["read_only"])
        self.assertEqual(app["cap_drop"],["ALL"])
        self.assertEqual(app["entrypoint"],["node","source-public-sync.cjs"])

    def test_visitor_heap_is_explicit_within_retained_container_and_socket_bounds(self):
        source = (ROOT / "deployment/seo-remote.py").read_text()
        self.assertIn('result["services"]["app"]["environment"]["NODE_OPTIONS"] = "--max-old-space-size=512"', source)
        # Only the maintenance configuration assigns a container memory bound.
        bridge = source[source.index("    def bridge("):source.index("    upgrade.candidate = bridge")]
        self.assertNotIn('mem_limit', bridge)
        self.assertNotIn('ports', bridge)
        self.assertNotIn('networks', bridge)

    def test_helpers_remain_checksum_pinned_and_only_extend_exact_runtime_scope(self):
        original = (ROOT / "deployment/cms-upgrade-remote.py").read_text(encoding="utf-8").replace("\r\n", "\n").encode()
        self.assertEqual(hashlib.sha256(original).hexdigest(), OP.UPGRADE_SHA)
        self.assertIn("source-public-sync", (ROOT / "deployment/package-cms-runtime.mjs").read_text())

    def test_asset_archive_rejects_links_traversal_duplicates_missing_and_tampered_bytes(self):
        value = asset(); bundle = {"pages": [{"kind": "asset", "asset": value}]}; name = "source-public/" + value["storageKey"]
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); path = root / "assets.tar"
            archive(path, [(name, b"anonymous asset", tarfile.REGTYPE)])
            self.assertEqual(OP.verify_asset_archive(base(root), path, bundle), {value["storageKey"]: value})
            for records in [[], [(name, b"anonymous asset", tarfile.SYMTYPE)], [("../" + name, b"anonymous asset", tarfile.REGTYPE)], [(name, b"anonymous asset", tarfile.REGTYPE)] * 2, [(name, b"changed content", tarfile.REGTYPE)]]:
                archive(path, records)
                with self.subTest(records=len(records)), self.assertRaises(RuntimeError): OP.verify_asset_archive(base(root), path, bundle)

    def test_asset_manifest_refuses_recordings_arbitrary_paths_oversize_and_digest_mismatch(self):
        for field, value in [("storageKey", "../outside.pdf"), ("storageKey", "a" * 64 + ".mp3"), ("bytes", 52428801), ("bytes", True), ("sha256", "0" * 64)]:
            item = asset(); item[field] = value
            with self.subTest(field=field), self.assertRaisesRegex(RuntimeError, "seo_asset_manifest_refused"):
                OP.asset_expectations({"pages": [{"kind": "asset", "asset": item}]})

    def test_original_feed_assets_are_confined_to_content_addressed_source_storage(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            for suffix, content_type in [("rss", "application/rss+xml"), ("atom", "application/atom+xml")]:
                data = b"<rss><channel><title>Anonymous feed</title></channel></rss>" if suffix == "rss" else b'<feed xmlns="http://www.w3.org/2005/Atom"><title>Anonymous feed</title></feed>'
                item = asset(data, suffix); item["contentType"] = content_type
                archive(root / "feed.tar", [("source-public/" + item["storageKey"], data, tarfile.REGTYPE)])
                self.assertEqual(OP.verify_asset_archive(base(root), root / "feed.tar", {"pages": [{"kind": "asset", "asset": item}]}), {item["storageKey"]: item})

    def test_source_asset_directory_does_not_relax_existing_cms_root_rules(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); item = asset(); (root / item["storageKey"]).write_bytes(b"anonymous asset")
            (root / "source-public").mkdir(); source = asset(b"other source", "docx"); (root / "source-public" / source["storageKey"]).write_bytes(b"other source")
            result = OP.assets_manifest(base(root)); self.assertEqual(len(result), 2)
            (root / "outside.txt").write_text("anonymous")
            with self.assertRaisesRegex(RuntimeError, "seo_cms_asset_integrity"): OP.assets_manifest(base(root))

    def test_asset_install_is_idempotent_and_never_overwrites_a_conflict(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); storage = root / "storage"; storage.mkdir(); item = asset()
            (root / "source-public.bundle.private.json").write_text(json.dumps({"pages": [{"kind": "asset", "asset": item}]}))
            archive(root / "source-public-assets.private.tar", [("source-public/" + item["storageKey"], b"anonymous asset", tarfile.REGTYPE)])
            with patch.object(OP.os, "chown", create=True):
                self.assertEqual(OP.install_assets(base(storage), root), 1); self.assertEqual(OP.install_assets(base(storage), root), 0)
                target = storage / "source-public" / item["storageKey"]; target.write_bytes(b"conflicting bytes")
                with self.assertRaisesRegex(RuntimeError, "seo_asset_collision"): OP.install_assets(base(storage), root)
                self.assertEqual(target.read_bytes(), b"conflicting bytes")

    def test_maintenance_reuses_only_owner_secret_existing_network_and_readonly_bundle(self):
        original = {"name": "fixture", "services": {"app": {"image": "old", "user": "1000:1000", "read_only": True, "cap_drop": ["ALL"], "ports": ["127.0.0.1:8082:8080"], "networks": {"existing": {"ipv4_address": "192.0.2.1"}}, "environment": {"DB_HOST": "db"}, "volumes": ["old"], "secrets": ["cms_writer_password"]}}, "networks": {"existing": {"external": True}}, "secrets": {"cms_writer_password": {"file": "/fixture/private"}}}
        before = copy.deepcopy(original)
        config = OP.maintenance_configuration(original, IMAGE, COMMIT, "/fixture/owner", pathlib.Path("/fixture/release"), "c" * 64)
        app = config["services"]["app"]
        self.assertEqual(original, before); self.assertNotIn("ports", app); self.assertEqual(app["networks"], {"existing": {}})
        self.assertEqual(config["networks"], before["networks"]); self.assertEqual(app["secrets"], ["db_owner_password"])
        self.assertEqual(app["volumes"], [{"type": "bind", "source": str(pathlib.Path("/fixture/release") / "source-public.bundle.private.json"), "target": "/run/source-public/bundle.json", "read_only": True}])
        self.assertEqual(app["environment"]["SOURCE_PUBLIC_TARGET"], "existing-protected"); self.assertEqual(app["image"], IMAGE)

    def test_migration_refuses_before_verified_bridge_without_invoking_any_write(self):
        base_mock = Mock()
        with patch.object(OP, "active_phases", return_value={"public": "previous", "protected": "bridge"}), self.assertRaisesRegex(RuntimeError, "seo_bridge_required"):
            OP.migrate(base_mock, Mock(), Mock(), pathlib.Path("/fixture"), {"commit": COMMIT, "image": IMAGE})
        base_mock.run.assert_not_called()

    def test_post_migration_switch_never_recovers_to_incompatible_old_image(self):
        base_mock = Mock(); upgrade = Mock(); helper = Mock(); root = pathlib.Path("/fixture")
        recovery = {"commit": COMMIT, "image": IMAGE}
        base_mock.load.side_effect = lambda path: {"commit": COMMIT, "image": IMAGE} if "receipt" in path.name else {"services": {"app": {"environment": {"RELEASE_COMMIT": COMMIT}}}}
        base_mock.sql.return_value = b"28\n"; upgrade.compose_up.side_effect = RuntimeError("failed_start")
        with patch.object(OP, "BASE_SCHEMA_ORDER", 27), patch.object(OP, "verify_source_ready"), patch.object(OP, "active_phases", return_value={"public": "previous", "protected": "previous"}), patch.object(OP, "state_hash", return_value=("cms", "source", {})), self.assertRaisesRegex(RuntimeError, "seo_incompatible_rollback_refused"):
            OP.switch(base_mock, upgrade, helper, root, recovery, "candidate")
        self.assertEqual(upgrade.compose_up.call_count, 1)

    def test_candidate_cannot_start_after_incomplete_source_import(self):
        base_mock = Mock(); base_mock.load.side_effect = RuntimeError("cms_file_refused"); upgrade = Mock()
        for operation in (OP.switch, OP.canaries):
            with self.subTest(operation=operation.__name__), self.assertRaisesRegex(RuntimeError, "cms_file_refused"):
                operation(base_mock, upgrade, Mock(), pathlib.Path("/fixture"), {"commit": COMMIT, "image": IMAGE}, "candidate")
        upgrade.compose_up.assert_not_called(); base_mock.run.assert_not_called()

    def test_source_canary_requires_real_render_and_cleans_up_on_render_failure(self):
        root = pathlib.Path("/fixture")
        for failed in (False, True):
            with self.subTest(failed=failed):
                fixture = Mock(); upgrade = Mock(); calls = []
                def run(command, **kwargs):
                    calls.append(command)
                    if command[-3:] == ["ps", "-q", "app"]: return b"anonymous-canary\n"
                    if command[:3] == ["docker", "exec", "anonymous-canary"]:
                        self.assertIn("for(let n=0;n<12;n++)", command[-1])
                        self.assertIn("x-seo-candidate", command[-1])
                        if failed: raise RuntimeError("anonymous_render_failed")
                    return b""
                fixture.run.side_effect = run
                fixture.load.return_value = {}
                with patch.object(OP, "verify_source_ready"), patch.object(OP, "state_hash", return_value=("cms", "source", {})):
                    if failed:
                        with self.assertRaisesRegex(RuntimeError, "anonymous_render_failed"):
                            OP.canaries(fixture, upgrade, Mock(), root, {"commit": COMMIT, "image": IMAGE}, "candidate")
                    else: OP.canaries(fixture, upgrade, Mock(), root, {"commit": COMMIT, "image": IMAGE}, "candidate")
                self.assertEqual(sum(command[-2:] == ["down", "--remove-orphans"] for command in calls), 1 if failed else 2)
                if failed: fixture.save.assert_not_called()

    def test_cms_configuration_retry_reuses_exact_bytes_and_refuses_drift(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "configuration.json"
            value = {"services": {"app": {"environment": {"SOURCE_CMS_ADOPTION": "1"}}}}
            writes = []
            def save(target, content):
                with target.open("x") as stream: json.dump(content, stream)
                writes.append(target)
            fixture = SimpleNamespace(load=lambda target: json.loads(target.read_text()), save=save)
            OP.save_verified_configuration(fixture, path, value)
            before = path.read_bytes()
            OP.save_verified_configuration(fixture, path, value)
            self.assertEqual(writes, [path]); self.assertEqual(path.read_bytes(), before)
            with self.assertRaisesRegex(RuntimeError, "seo_cms_configuration_drift"):
                OP.save_verified_configuration(fixture, path, {"changed": True})
            self.assertEqual(path.read_bytes(), before)

    def test_cms_adoption_passes_bound_configuration_to_write_and_replay(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            config = {"services": {"app": {"environment": {}, "volumes": []}}}
            (root / "source-maintenance.json").write_text(json.dumps(config))
            fixture = base(root)
            def save(path, value):
                with path.open("x") as stream: json.dump(value, stream)
            fixture.save = save; fixture.assets_manifest = lambda: {}
            calls = []
            def run(command, timeout):
                cfg = fixture.load(pathlib.Path(command[3])); operation = command[-1]
                self.assertEqual(cfg["services"]["app"]["user"], "1000:0")
                calls.append(operation)
                if operation == "cms-plan":
                    self.assertNotIn("SOURCE_CMS_PLAN_SHA256", cfg["services"]["app"]["environment"])
                    return json.dumps({"planned": 1, "held": 1223, "planSha256": "7dce063d0c26a45f0a1653152a964f749581b8741c69357403eb7075b9731969"})
                self.assertEqual(cfg["services"]["app"]["environment"]["SOURCE_CMS_PLAN_SHA256"], "7dce063d0c26a45f0a1653152a964f749581b8741c69357403eb7075b9731969")
                return json.dumps({"result": {"inserted": 0}, "assets": {"inserted": 0}})
            fixture.run = run
            upgrade = SimpleNamespace(cms_snapshot=lambda _: {name: [] for name in ("cms_entities", "cms_revisions", "cms_routes", "media_assets", "audit_events", "schema_migrations")})
            with patch.object(OP, "active_phases", return_value={"public": "bridge", "protected": "bridge"}), patch.object(OP, "verify_source_ready"), patch.object(OP, "source_snapshot", return_value={}), patch.object(OP, "verify_frozen"):
                result = OP.adopt_cms(fixture, upgrade, Mock(), root, {"commit": COMMIT, "image": IMAGE})
            self.assertTrue(result["priorRowsPreserved"])
            self.assertEqual(calls, ["cms-plan", "adopt-cms", "adopt-cms"])

    def test_cms_adoption_refuses_without_the_compatible_bridge_before_any_write(self):
        base_mock = Mock()
        with patch.object(OP, "active_phases", return_value={"public": "previous", "protected": "bridge"}), self.assertRaisesRegex(RuntimeError, "seo_bridge_required"):
            OP.adopt_cms(base_mock, Mock(), Mock(), pathlib.Path("/fixture"), {"commit": COMMIT, "image": IMAGE})
        base_mock.run.assert_not_called(); base_mock.save.assert_not_called()

    def test_cms_adoption_blocks_incompatible_old_image_recovery(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); (root / "source-cms-adoption.receipt.json").write_text("{}")
            base_mock = Mock(); upgrade = Mock(); recovery = {"commit": COMMIT, "image": IMAGE}
            base_mock.load.return_value = {"commit": COMMIT, "image": IMAGE}
            with patch.object(OP, "active_phases", return_value={"public": "previous", "protected": "bridge"}), patch.object(OP, "state_hash", return_value=("cms", "source", {})), self.assertRaisesRegex(RuntimeError, "seo_incompatible_cms_image_refused"):
                OP.switch(base_mock, upgrade, Mock(), root, recovery, "bridge")
            upgrade.compose_up.assert_not_called()

    def test_full_database_backup_is_exact_target_private_verified_and_bound(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); base_mock = Mock(); base_mock.DB = "anonymous-staging-db"
            base_mock.sha.side_effect = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
            def dump(args, output, timeout):
                self.assertEqual(args, ["docker", "exec", "anonymous-staging-db", "pg_dump", "-U", "postgres", "-d", "savinggrace_staging", "--format=custom"])
                output.write(b"PGDMPanonymous fixture")
            base_mock.run.side_effect = dump
            listing = b"; dbname: savinggrace_staging\n1; 1 1 TABLE public sermons postgres\n2; 1 2 TABLE public cms_entities postgres\n"
            def inspect_descriptor(*args, **kwargs):
                # subprocess consumes the underlying FD, not Python's read buffer.
                self.assertEqual(os.read(kwargs['stdin'].fileno(),5), b'PGDMP')
                return SimpleNamespace(returncode=0, stdout=listing)
            with patch.object(OP.subprocess, "run", side_effect=inspect_descriptor) as restore:
                receipt = OP.database_recovery(base_mock, Mock(), root)
            base_mock.verify_database.assert_called_once(); self.assertTrue(receipt["listingVerified"])
            self.assertEqual(receipt["bytes"], 22); self.assertEqual(receipt["sha256"], hashlib.sha256(b"PGDMPanonymous fixture").hexdigest())
            self.assertEqual(restore.call_args.args[0][-2:], ["pg_restore", "--list"])
            self.assertEqual(base_mock.save.call_args.args[0].name, "database-backup.receipt.json")


if __name__ == "__main__": unittest.main()

class ExactEmptyCalendarAssetTests(unittest.TestCase):
    def test_only_verified_nonindexable_calendar_zero_byte_members_are_allowed(self):
        value=asset(b"", "ics");value.update(contentType="text/html; charset=UTF-8", emptySourceCalendar=True)
        page={"kind":"asset", "path":"/events/?ical=1", "indexable":False, "asset":value}
        self.assertEqual(len(OP.asset_expectations({"pages":[page]})),1)
        for changed in ({**page,"indexable":True},{**page,"path":"/ordinary-page/"},{**page,"asset":{**value,"emptySourceCalendar":False}},{**page,"asset":{**value,"contentType":"application/javascript"}}):
            with self.assertRaisesRegex(RuntimeError,"seo_asset_empty_calendar_refused"):OP.asset_expectations({"pages":[changed]})

class ResourceRedirectHistoryTests(unittest.TestCase):
    def test_changed_prior_or_unscoped_extra_redirects_are_rejected(self):
        old={"id":"anonymous-old","old_path":"/old/","new_path":"/known/","reason":"existing-human"};before={"redirects":[old],"audit":[]};fake=SimpleNamespace(load=lambda _:before)
        with patch.object(OP,"resource_history_snapshot",return_value={"redirects":[{**old,"new_path":"/other/"}],"audit":[]}):
            with self.assertRaisesRegex(RuntimeError,"seo_original_redirect_or_audit_changed"):OP.verify_resource_history(fake,pathlib.Path("/anonymous"))
        extra={"id":"anonymous-extra","old_path":"/unscoped/","new_path":"/wrong/","status_code":301,"reason":"verified_original_attachment_resource","verified_at":"anonymous","source_sermon_id":None}
        fake.load=lambda path:before if path.name=="resource-history-before.private.json" else {"rows":[]}
        with patch.object(OP,"resource_history_snapshot",return_value={"redirects":[old,extra],"audit":[]}):
            with self.assertRaisesRegex(RuntimeError,"seo_unscoped_redirect_added"):OP.verify_resource_history(fake,pathlib.Path("/anonymous"))


class PreinstalledRecordingTests(unittest.TestCase):
    def test_empty_transfer_archive_requires_every_exact_preinstalled_recording(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);(root/'source-public').mkdir()
            pages=[]
            for n in range(118):
                data=('ID3anonymous recording '+str(n)).encode();value=asset(data,'mp4' if n==117 else 'mp3');value['contentType']='video/mp4' if n==117 else 'audio/mpeg'
                (root/'source-public'/value['storageKey']).write_bytes(data)
                pages.append({'kind':'asset','path':'/wp-content/uploads/'+str(n)+'.mp3','asset':value})
            transfer=root/'empty.tar'
            with tarfile.open(transfer,'w'):pass
            self.assertEqual(len(OP.verify_asset_archive(base(root),transfer,{'pages':pages})),118)
            (root/'source-public'/pages[0]['asset']['storageKey']).write_bytes(b'wrong')
            with self.assertRaisesRegex(RuntimeError,'seo_preinstalled_recording_integrity'):
                OP.verify_asset_archive(base(root),transfer,{'pages':pages})
            with self.assertRaisesRegex(RuntimeError,'seo_asset_archive_scope'):
                OP.verify_asset_archive(base(root),transfer,{'pages':pages[:117]})

class CompositeRecordingBackupTests(unittest.TestCase):
    def test_complete_two_part_backup_and_refusal_of_unverified_recording(self):
        with tempfile.TemporaryDirectory() as folder:
            assets_root=pathlib.Path(folder)/'assets';assets_root.mkdir();(assets_root/'source-public').mkdir()
            pages=[];rows=[];manifest={}
            for n in range(118):
                data=('ID3anonymous recording '+str(n)).encode();value=asset(data,'mp4' if n==117 else 'mp3');value['contentType']='video/mp4' if n==117 else 'audio/mpeg'
                (assets_root/'source-public'/value['storageKey']).write_bytes(data)
                pages.append({'kind':'asset','path':'/wp-content/uploads/'+str(n)+'.mp3','asset':value})
                rows.append({'file':value['storageKey'],'outcome':'verified','sourceRangeVerified':True,**{k:value[k] for k in ('sha256','bytes','contentType')}})
                manifest['source-public/'+value['storageKey']]=len(data)
            data=b'anonymous ordinary image';key=hashlib.sha256(data).hexdigest()+'.png';(assets_root/key).write_bytes(data);manifest[key]=len(data)
            fixture=base(assets_root);fixture.checked=lambda path:path
            fixture.save=lambda path,value:path.write_text(json.dumps(value))
            receipt={'format':'sgbc-original-recording-backup-result-v1','manifestSha256':'10833a17ef8adb0acde739b765340a1b677463ec6b3ec5fcf4c82e945e1b46db','rows':rows}
            backup=pathlib.Path(folder)/'backup';backup.mkdir()
            OP.composite_recording_backup(fixture,backup,manifest,{'pages':pages},receipt)
            coverage=json.loads((backup/'asset-backup-coverage.private.json').read_text())
            self.assertTrue(coverage['completeCoverage']);self.assertTrue(coverage['restoreRequiresBothParts'])
            self.assertEqual((coverage['files'],coverage['ordinaryFiles'],len(coverage['externalRecordings'])),(119,1,118))
            restored=pathlib.Path(folder)/'restored';restored.mkdir()
            with tarfile.open(backup/'uploads-before.tar')as archive:
                self.assertEqual(archive.getnames(),[key]);archive.extractall(restored,filter='data')
            for name,value in coverage['externalRecordings'].items():
                path=restored/name;path.parent.mkdir(exist_ok=True);path.write_bytes((assets_root/name).read_bytes())
            self.assertEqual({p.relative_to(restored).as_posix():p.stat().st_size for p in restored.rglob('*')if p.is_file()},manifest)
            receipt['rows'][0]['sourceRangeVerified']=False
            rejected=pathlib.Path(folder)/'rejected';rejected.mkdir()
            with self.assertRaisesRegex(RuntimeError,'seo_recording_backup_integrity'):OP.composite_recording_backup(fixture,rejected,manifest,{'pages':pages},receipt)
            self.assertFalse((rejected/'uploads-before.tar').exists())


class InventoryDriftDiagnosticsTests(unittest.TestCase):
    def test_all_preservation_fields_remain_gated_without_exposing_values(self):
        expected={key:"anonymous frozen value"for key in ("runtimes","counts","cmsCounts","cmsSha256","uploadsSha256","unrelatedSha256","secretFilesSha256")}
        OP.verify_inventory_match(expected,dict(expected))
        for key in expected:
            actual={**expected,key:"private changed value must never enter error"}
            with self.assertRaisesRegex(RuntimeError,"^seo_inventory_drift_"+key.lower()+"$"):
                OP.verify_inventory_match(expected,actual)
