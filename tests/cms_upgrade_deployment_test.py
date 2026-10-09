"""Anonymous offline upgrade checks. No Docker, staging or database access."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("cms_upgrade_fixture", ROOT / "deployment/cms-upgrade-remote.py")
OP = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(OP)
BASE_SPEC = importlib.util.spec_from_file_location("cms_base_fixture", ROOT / "deployment/cms-remote.py")
BASE = importlib.util.module_from_spec(BASE_SPEC); BASE_SPEC.loader.exec_module(BASE)
ASSETS = pathlib.Path("/fixture/persistent-assets")
CANDIDATE_IMAGE = "sha256:" + "c" * 64
PREVIOUS_IMAGE = "sha256:" + "a" * 64


def switch_fixture():
    base = Mock(); helper = Mock(); root = pathlib.Path("/fixture/upgrade")
    base.load.side_effect = lambda path: {"services": {"app": {"image": PREVIOUS_IMAGE if "previous" in str(path) else CANDIDATE_IMAGE, "environment": {"RELEASE_COMMIT": "1" * 40}}}}
    helper.inspect.side_effect = lambda image: {"Id": image}
    recovery = {"image": CANDIDATE_IMAGE, "previous": {"runtimes": {runtime: {"image": PREVIOUS_IMAGE} for runtime in ("public", "protected")}}}
    return base, helper, root, recovery


def original(runtime="protected"):
    config = {"name": "incumbent-fixture", "services": {"app": {
        "image": "incumbent-image", "read_only": True, "cap_drop": ["ALL"],
        "environment": {"RELEASE_COMMIT": OP.PREVIOUS_COMMIT, "CMS_SITE_ENABLED": "1", "CMS_STORAGE_DIRECTORY": OP.CMS_MOUNT, "RELATED_THEMES_VISITOR_ENABLED": "0"},
        "networks": {"private": {"ipv4_address": "192.0.2.10"}},
        "secrets": ["db_reader_password"], "volumes": [{"type": "bind", "source": str(ASSETS), "target": OP.CMS_MOUNT, "read_only": runtime == "public"}]
    }}, "networks": {"private": {"external": True, "name": "fixture-existing-network"}}, "secrets": {"db_reader_password": {"file": "/fixture/reader"}}}
    app = config["services"]["app"]
    if runtime == "protected":
        app["environment"].update({"STAGING_CMS_ENABLED": "1", "CMS_ACCESS": "protected_tunnel", "CMS_ORIGIN": "http://127.0.0.1:4396"})
        app["secrets"] += list(OP.CMS_SECRETS)
        config["secrets"].update({name: {"file": "/fixture/original-release/" + name} for name in OP.CMS_SECRETS})
    else:
        app["ports"] = [{"host_ip": "127.0.0.1", "published": 8080, "target": 8080}]
    return config


def snapshot():
    return {"cms_entities": [{"id": "fixture-page", "draft_revision_id": "fixture-r1", "published_revision_id": "fixture-r1"}],
            "cms_revisions": [{"id": "fixture-r1", "content": {"title": "Anonymous page"}}],
            "cms_routes": [{"path": "/fixture/", "entity_id": "fixture-page"}],
            "media_assets": [{"id": "fixture-asset", "checksum": "a" * 64}],
            "audit_events": [{"id": "fixture-audit", "action": "cms_published"}],
            "schema_migrations": [{"migration_order": 27, "migration_id": "0027_fixture", "checksum_sha256": "b" * 64}]}


class CmsUpgradeTest(unittest.TestCase):
    def test_only_image_and_release_change_for_both_applications(self):
        for runtime in ("public", "protected"):
            with self.subTest(runtime=runtime):
                incumbent = original(runtime); before = copy.deepcopy(incumbent)
                candidate = OP.candidate(incumbent, CANDIDATE_IMAGE, "1" * 40, runtime, ASSETS)
                self.assertEqual(incumbent, before)
                candidate["services"]["app"]["image"] = incumbent["services"]["app"]["image"]
                candidate["services"]["app"]["environment"]["RELEASE_COMMIT"] = OP.PREVIOUS_COMMIT
                self.assertEqual(candidate, incumbent)

    def test_existing_credential_references_and_upload_mount_reused_once(self):
        incumbent = original()
        config = OP.candidate(incumbent, CANDIDATE_IMAGE, "1" * 40, "protected", ASSETS)
        self.assertEqual(config["secrets"], incumbent["secrets"])
        self.assertEqual(config["services"]["app"]["secrets"], incumbent["services"]["app"]["secrets"])
        self.assertEqual(config["services"]["app"]["volumes"], incumbent["services"]["app"]["volumes"])

    def test_missing_duplicate_or_widened_asset_mount_refused(self):
        for defect in ("missing", "duplicate", "source", "public-write", "protected-read"):
            runtime = "public" if defect == "public-write" else "protected"
            config = original(runtime); mounts = config["services"]["app"]["volumes"]
            if defect == "missing": mounts.clear()
            elif defect == "duplicate": mounts.append(copy.deepcopy(mounts[0]))
            elif defect == "source": mounts[0]["source"] = "/another/storage"
            else: mounts[0]["read_only"] = not mounts[0]["read_only"]
            with self.subTest(defect=defect), self.assertRaisesRegex(RuntimeError, "cms_upgrade_asset_mount_refused"):
                OP.assert_cms_config(config, runtime, ASSETS)

    def test_public_administration_cannot_be_added(self):
        for kind in ("secret", "enabled", "origin", "access"):
            config = original("public"); app = config["services"]["app"]
            if kind == "secret": app["secrets"].append("cms_session_secret")
            else: app["environment"][{"enabled": "STAGING_CMS_ENABLED", "origin": "CMS_ORIGIN", "access": "CMS_ACCESS"}[kind]] = "1"
            with self.subTest(kind=kind), self.assertRaisesRegex(RuntimeError, "cms_upgrade_public_admin_refused"):
                OP.assert_cms_config(config, "public", ASSETS)

    def test_protected_scope_development_identity_and_semantic_flags_refused(self):
        for key, value in (("CMS_ORIGIN", "https://external.invalid"), ("CMS_ACCESS", "public"), ("STAGING_CMS_ENABLED", "0"), ("ENABLE_LOCAL_TEST_IDENTITIES", "1"), ("NODE_PG_FORCE_NATIVE", "1"), ("RELATED_THEMES_VISITOR_ENABLED", "1")):
            config = original(); config["services"]["app"]["environment"][key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): OP.assert_cms_config(config, "protected", ASSETS)

    def test_missing_or_duplicate_existing_secrets_refused(self):
        for defect in ("missing", "duplicate", "undefined"):
            config = original()
            if defect == "missing": config["services"]["app"]["secrets"].remove("cms_writer_password")
            elif defect == "duplicate": config["services"]["app"]["secrets"].append("cms_writer_password")
            else: del config["secrets"]["cms_session_secret"]
            with self.subTest(defect=defect), self.assertRaisesRegex(RuntimeError, "cms_upgrade_existing_secrets_required"):
                OP.assert_cms_config(config, "protected", ASSETS)

    def test_canary_preserves_secrets_and_assets_but_has_no_listener_or_reserved_ip(self):
        config = OP.candidate(original("public"), CANDIDATE_IMAGE, "1" * 40, "public", ASSETS)
        canary = BASE.canary(config, "1" * 40, "public")
        self.assertNotIn("ports", canary["services"]["app"])
        self.assertEqual(canary["services"]["app"]["networks"], {"private": {}})
        self.assertEqual(canary["services"]["app"]["secrets"], config["services"]["app"]["secrets"])
        self.assertEqual(canary["services"]["app"]["volumes"], config["services"]["app"]["volumes"])

    def test_history_check_allows_new_edits_without_resetting_old_records(self):
        before = snapshot(); after = copy.deepcopy(before)
        after["cms_entities"][0]["draft_revision_id"] = "fixture-r2"
        after["cms_revisions"].append({"id": "fixture-r2", "content": {"title": "New anonymous title"}})
        after["media_assets"].append({"id": "new-asset", "checksum": "c" * 64})
        after["audit_events"].append({"id": "new-audit", "action": "cms_saved"})
        OP.immutable_preserved(before, after)
        self.assertNotEqual(OP.snapshot_hash(before), OP.snapshot_hash(after))

    def test_immutable_history_asset_audit_schema_or_entity_loss_refused(self):
        before = snapshot()
        for name in ("cms_revisions", "media_assets", "audit_events", "schema_migrations", "cms_entities"):
            after = copy.deepcopy(before); after[name].clear()
            with self.subTest(table=name), self.assertRaises(RuntimeError): OP.immutable_preserved(before, after)
        after = copy.deepcopy(before); after["schema_migrations"].append({"migration_order": 28})
        with self.assertRaisesRegex(RuntimeError, "cms_upgrade_retained_history_changed"): OP.immutable_preserved(before, after)
        after = copy.deepcopy(before); after["cms_revisions"][0]["content"]["title"] = "Overwritten history"
        with self.assertRaisesRegex(RuntimeError, "cms_upgrade_retained_history_changed"): OP.immutable_preserved(before, after)

    def test_snapshot_hash_is_order_independent_but_content_sensitive(self):
        before = snapshot(); before["cms_entities"].append({"id": "fixture-other"})
        shuffled = copy.deepcopy({name: list(reversed(rows)) for name, rows in reversed(list(before.items()))})
        self.assertEqual(OP.snapshot_hash(before), OP.snapshot_hash(shuffled))
        shuffled["cms_entities"][0]["title"] = "Changed"
        self.assertNotEqual(OP.snapshot_hash(before), OP.snapshot_hash(shuffled))

    def test_changed_inventory_refuses_preparation_before_writes(self):
        with tempfile.TemporaryDirectory(prefix="cms-upgrade-") as directory:
            root = pathlib.Path(directory) / "new"; incoming = pathlib.Path(directory) / "incoming"
            actual = {"runtimes": {}, "counts": {"ledger": 27}, "cmsCounts": {}, "cmsSha256": "new"}
            base = Mock(); base.sha.return_value = "a" * 64; base.load.return_value = {"counts": {"ledger": 27}, "cmsSha256": "old"}
            with patch.object(OP, "inventory", return_value=actual):
                with self.assertRaises(RuntimeError): OP.prepare(base, Mock(), root, incoming, "1" * 40, *("a" * 64,) * 3)
            self.assertFalse(root.exists())
            base.save.assert_not_called()

    def test_existing_release_is_never_overwritten(self):
        with tempfile.TemporaryDirectory(prefix="cms-upgrade-") as directory:
            root = pathlib.Path(directory)
            with self.assertRaisesRegex(RuntimeError, "cms_upgrade_release_exists"):
                OP.prepare(Mock(), Mock(), root, root, "1" * 40, *("a" * 64,) * 3)

    def test_schema_files_match_all_current_ledger_rows_without_extra_migration(self):
        with tempfile.TemporaryDirectory(prefix="cms-schema-") as directory:
            root = pathlib.Path(directory); migrations = root / "db/migrations"; migrations.mkdir(parents=True)
            rows = []
            for number in range(1, 28):
                name = f"{number:04d}_fixture"; up = "BEGIN;\nSELECT 1;\nCOMMIT;\n"; down = "BEGIN;\nSELECT 2;\nCOMMIT;\n"
                (migrations / (name + ".sql")).write_text(up, encoding="utf-8")
                (migrations / (name + ".down.sql")).write_text(down, encoding="utf-8")
                digest = hashlib.sha256("\n".join(("saving-grace-schema-migration-v1", "-- up", up, "-- down", down)).encode()).hexdigest()
                rows.append({"migration_order": number, "migration_id": name, "checksum_sha256": digest})
            data = {"schema_migrations": rows}
            OP.verify_schema_source(root, data)
            (migrations / "0027_fixture.sql").write_text("changed", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "cms_upgrade_schema_source_changed"): OP.verify_schema_source(root, data)
            (migrations / "0027_fixture.sql").write_text(up, encoding="utf-8")
            (migrations / "0028_extra.sql").write_text("SELECT 1;", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "cms_upgrade_schema_file_scope"): OP.verify_schema_source(root, data)

    def test_switch_uses_current_content_and_retains_it_through_rollback(self):
        for phase in ("candidate", "previous"):
            with self.subTest(phase=phase):
                data = snapshot(); data["cms_entities"][0]["title"] = "Later administrator edit"
                base, helper, root, recovery = switch_fixture()
                base.assets_manifest.return_value = {"new-upload.pdf": 21}
                with patch.object(OP, "active_phases", side_effect=[{"public": "previous", "protected": "previous"}, {"public": phase, "protected": phase}]), patch.object(OP, "cms_snapshot", return_value=data), patch.object(OP, "verify_frozen"):
                    OP.switch(base, helper, root, recovery, phase)
                self.assertEqual(base.run.call_count, 2)
                self.assertEqual(helper.ready.call_count, 2)
                self.assertTrue(all(phase in call.args[0][3] for call in base.run.call_args_list))
                self.assertTrue(all(call.args[0][5:7] == ["--pull", "never"] for call in base.run.call_args_list))
                self.assertTrue(base.save.call_args.args[1]["uploadsPreserved"])

    def test_failed_second_application_restores_both_observed_incumbents(self):
        base, helper, root, recovery = switch_fixture()
        base.assets_manifest.return_value = {}; base.run.side_effect = [None, RuntimeError("fixture failure"), None, None]
        with patch.object(OP, "active_phases", return_value={"public": "previous", "protected": "previous"}), patch.object(OP, "cms_snapshot", return_value=snapshot()), patch.object(OP, "verify_frozen"):
            with self.assertRaisesRegex(RuntimeError, "cms_upgrade_activation_restored_previous_apps"):
                OP.switch(base, helper, root, recovery, "candidate")
        self.assertEqual(base.run.call_count, 4)
        self.assertTrue(all("previous" in call.args[0][3] for call in base.run.call_args_list[-2:]))
        base.save.assert_not_called()

    def test_data_change_during_switch_stops_instead_of_claiming_persistence(self):
        base, helper, root, recovery = switch_fixture()
        before = snapshot(); after = copy.deepcopy(before); after["cms_entities"][0]["title"] = "Concurrent edit"
        with patch.object(OP, "active_phases", return_value={"public": "previous", "protected": "previous"}), patch.object(OP, "cms_snapshot", side_effect=[before, after]), patch.object(OP, "verify_frozen"):
            with self.assertRaisesRegex(RuntimeError, "cms_upgrade_activation_restored_previous_apps"):
                OP.switch(base, helper, root, recovery, "candidate")
        base.save.assert_not_called()

    def test_candidate_refuses_mutable_image_tags(self):
        for image in ("savinggrace-cms:latest", "savinggrace-cms:" + "1" * 40, "sha256:short"):
            with self.subTest(image=image), self.assertRaisesRegex(RuntimeError, "cms_upgrade_immutable_image_required"):
                OP.candidate(original(), image, "1" * 40, "protected", ASSETS)

    def test_image_drift_stops_before_any_switch_compose(self):
        for drift in ("candidate", "previous"):
            base, helper, root, recovery = switch_fixture()
            helper.inspect.side_effect = lambda image: {"Id": "sha256:" + "f" * 64 if image == (CANDIDATE_IMAGE if drift == "candidate" else PREVIOUS_IMAGE) else image}
            with self.subTest(drift=drift), patch.object(OP, "active_phases", return_value={"public": "previous", "protected": "previous"}):
                with self.assertRaisesRegex(RuntimeError, "cms_upgrade_image_drift"):
                    OP.switch(base, helper, root, recovery, "candidate")
            base.run.assert_not_called()
            helper.ready.assert_not_called()

    def test_image_drift_stops_before_any_canary_compose(self):
        for drift in (CANDIDATE_IMAGE, PREVIOUS_IMAGE):
            base, helper, root, recovery = switch_fixture()
            helper.inspect.side_effect = lambda image: {"Id": "sha256:" + "f" * 64 if image == drift else image}
            with self.subTest(image=drift), self.assertRaisesRegex(RuntimeError, "cms_upgrade_image_drift"):
                OP.run_canaries(base, helper, root, recovery)
            base.run.assert_not_called()

    def test_canary_forbids_pulls_and_preserves_current_state(self):
        base, helper, root, recovery = switch_fixture(); recovery["commit"] = "1" * 40
        base.assets_manifest.return_value = {}
        with patch.object(OP, "cms_snapshot", return_value=snapshot()):
            OP.run_canaries(base, helper, root, recovery)
        up = [call.args[0] for call in base.run.call_args_list if "up" in call.args[0]]
        self.assertEqual(len(up), 2)
        self.assertTrue(all(command[5:7] == ["--pull", "never"] for command in up))
        self.assertEqual(len([call for call in base.run.call_args_list if "down" in call.args[0]]), 2)

    def test_post_start_image_or_configuration_failure_restores_both_apps(self):
        base, helper, root, recovery = switch_fixture(); base.assets_manifest.return_value = {}
        previous = {"public": "previous", "protected": "previous"}
        with patch.object(OP, "active_phases", side_effect=[previous, RuntimeError("cms_upgrade_active_configuration_drift"), previous]), patch.object(OP, "cms_snapshot", return_value=snapshot()), patch.object(OP, "verify_frozen"):
            with self.assertRaisesRegex(RuntimeError, "cms_upgrade_activation_restored_previous_apps"):
                OP.switch(base, helper, root, recovery, "candidate")
        self.assertEqual(base.run.call_count, 4)
        self.assertTrue(all("previous" in call.args[0][3] for call in base.run.call_args_list[-2:]))
        base.save.assert_not_called()

    def test_readonly_snapshot_never_emits_mutation_sql(self):
        base = Mock(); base.sql.return_value = b"[]"
        OP.cms_snapshot(base)
        self.assertEqual(base.sql.call_count, 6)
        for call in base.sql.call_args_list:
            statement = call.args[0]
            self.assertTrue(statement.startswith("SELECT "))
            self.assertNotIn("PASSWORD", statement)

    def test_secret_rotation_is_refused_before_activating(self):
        base = Mock(); root = pathlib.Path("/fixture/upgrade")
        base.load.return_value = {"protected:cms_session_secret": {"path": "/fixture/key", "sha256": "a" * 64, "mode": 0o400, "uid": 1000, "gid": 1000}}
        base.checked.return_value.stat.return_value = SimpleNamespace(st_mode=0o400, st_uid=1000, st_gid=1000)
        base.sha.return_value = "b" * 64
        with self.assertRaisesRegex(RuntimeError, "cms_upgrade_secret_changed"):
            OP.verify_frozen(base, root, {"previous": {"unrelatedSha256": "unchanged"}})
        base.preservation.assert_not_called()


if __name__ == "__main__":
    unittest.main()
