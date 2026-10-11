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
    def test_existing_source_retry_refuses_unknown_history_or_bundle(self):
        valid={'sourceCounts':{'source_public_versions':3424,'source_public_routes':3422,'source_public_imports':2},'sourceSha256':OP.EXISTING_SOURCE_SHA}
        OP.verify_existing_source(valid,OP.INCOMING_BUNDLE_SHA)
        with self.assertRaisesRegex(RuntimeError,'seo_existing_source_drift'):OP.verify_existing_source(valid,OP.EXISTING_BUNDLE_SHA)
        for changed,bundle in (({**valid,'sourceSha256':'0'*64},OP.INCOMING_BUNDLE_SHA),(valid,'0'*64),({**valid,'sourceCounts':{}},OP.INCOMING_BUNDLE_SHA)):
            with self.assertRaisesRegex(RuntimeError,'seo_existing_source_drift'):OP.verify_existing_source(changed,bundle)

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
                calls.append(operation)
                if operation == "cms-plan":
                    self.assertNotIn("SOURCE_CMS_PLAN_SHA256", cfg["services"]["app"]["environment"])
                    return json.dumps({"planned": 2126, "held": 239, "planSha256": "d6d594f037c524a80190ed7516a3d093f9c5547211100b6525b1e3c0e18b1154"})
                self.assertEqual(cfg["services"]["app"]["environment"]["SOURCE_CMS_PLAN_SHA256"], "d6d594f037c524a80190ed7516a3d093f9c5547211100b6525b1e3c0e18b1154")
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
