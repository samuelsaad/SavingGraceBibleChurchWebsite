"""Anonymous offline CMS operator checks. No staging or database connection."""
import copy
import importlib.util
import io
import json
import hashlib
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch
SOURCE = pathlib.Path(__file__).resolve().parents[1] / "deployment" / "cms-remote.py"
SPEC = importlib.util.spec_from_file_location("cms_operator_fixture", SOURCE)
OP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OP)

def original():
    return {"name": "existing-fixture", "services": {"app": {
        "image": "previous-image", "read_only": True,
        "ports": [{"host_ip": "127.0.0.1", "published": 8080, "target": 8080}],
        "environment": {"RELEASE_COMMIT": OP.PREVIOUS_COMMIT, "RELATED_THEMES_VISITOR_ENABLED": "0", "UNRELATED_GUARD": "preserved"},
        "networks": {"private": {"ipv4_address": "192.0.2.10"}},
        "secrets": ["db_reader_password"], "volumes": ["existing-fixture:/verification/cohort:ro"]
    }}, "networks": {"private": {"external": True, "name": "fixture-network"}}}

class CmsOperatorTest(unittest.TestCase):
    def test_candidate_preserves_original_network_and_public_admin_denial(self):
        source = original(); saved = copy.deepcopy(source)
        public = OP.candidate(source, "new-image", "1"*40, pathlib.Path("/fixture"), "public", True)
        self.assertEqual(source, saved)
        app = public["services"]["app"]
        self.assertEqual(app["ports"], source["services"]["app"]["ports"])
        self.assertEqual(app["networks"], source["services"]["app"]["networks"])
        self.assertNotIn("STAGING_CMS_ENABLED", app["environment"])
        self.assertNotIn("CMS_ACCESS", app["environment"])
        self.assertNotIn("cms_session_secret", app["secrets"])
        self.assertTrue(app["volumes"][-1]["read_only"])
        self.assertEqual(app["environment"]["RELATED_THEMES_VISITOR_ENABLED"], "0")

    def test_protected_candidate_has_only_bounded_secret_and_asset_mount(self):
        candidate = OP.candidate(original(), "new", "1"*40, pathlib.Path("/fixture"), "protected", True)
        app = candidate["services"]["app"]
        self.assertEqual(app["environment"]["CMS_ACCESS"], "protected_tunnel")
        self.assertEqual(app["environment"]["CMS_ORIGIN"], "http://127.0.0.1:4396")
        self.assertFalse(app["volumes"][-1]["read_only"])
        self.assertEqual(app["secrets"], ["db_reader_password", "cms_writer_password", "cms_session_secret"])
        self.assertNotIn("ENABLE_LOCAL_TEST_IDENTITIES", app["environment"])

    def test_bridge_and_canary_never_add_bindings_or_remove_old_data_mounts(self):
        source = original()
        bridge = OP.candidate(source, "new", "1"*40, pathlib.Path("/fixture"), "protected", False)
        self.assertEqual(bridge["services"]["app"]["volumes"], source["services"]["app"]["volumes"])
        self.assertEqual(bridge["services"]["app"]["environment"]["CMS_SITE_ENABLED"], "0")
        canary = OP.canary(bridge, "1"*40, "protected")
        self.assertNotIn("ports", canary["services"]["app"])
        self.assertEqual(canary["services"]["app"]["networks"], {"private": {}})
        self.assertEqual(canary["networks"], source["networks"])
        self.assertNotEqual(canary["name"], source["name"])

    def test_archive_rejects_private_paths_traversal_and_symlinks(self):
        for name,kind in [("../escape",None),("/absolute",None),("private/item.json",None),("src/item.private.ts",None),("key.pem",None),(".env",None),("src/link",tarfile.SYMTYPE)]:
            buffer=io.BytesIO()
            with tarfile.open(fileobj=buffer,mode="w") as archive:
                item=tarfile.TarInfo(name);item.size=0
                if kind:item.type=kind;item.linkname="/elsewhere"
                archive.addfile(item)
            buffer.seek(0)
            with tarfile.open(fileobj=buffer) as archive:
                with self.assertRaises(RuntimeError):OP.safe_archive(archive)

    def test_runtime_archive_requires_exact_hash_bound_scope(self):
        for defect in (None, "duplicate", "extra", "hash", "commit", "migration"):
            with self.subTest(defect=defect), tempfile.TemporaryDirectory(prefix="cms-runtime-") as directory:
                root=pathlib.Path(directory); source=root/"source"; migrations=source/"db/migrations"; migrations.mkdir(parents=True)
                (migrations/"0001_fixture.sql").write_bytes(b"SELECT 1;")
                deployment=source/"deployment"; deployment.mkdir(); (deployment/"Dockerfile.cms-runtime").write_text("ARG NODE_IMAGE\nFROM ${NODE_IMAGE}\nCOPY app/ /app/\n")
                values={"app/"+name+".cjs":b"fixture bundled JavaScript" for name in OP.RUNTIME_ENTRIES}
                values.update({"app/admin/index.html":b"fixture", "app/admin/_astro/cms-admin.js":b"fixture", "app/admin/_astro/cms-admin.css":b"fixture", "app/db/migrations/0001_fixture.sql":b"SELECT 1;"})
                if defect=="migration":values["app/db/migrations/0001_fixture.sql"]=b"SELECT 2;"
                manifest={"version":1,"commit":"1"*40,"sourceArchiveSha256":"2"*64,"scanManifestSha256":"3"*64,"provenanceSha256":"4"*64,"files":[{"path":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in values.items()]}
                if defect=="hash":manifest["files"][0]["sha256"]="0"*64
                if defect=="commit":manifest["commit"]="0"*40
                archive_path=root/"runtime.tar"
                with tarfile.open(archive_path,"w") as archive:
                    records=[("runtime-manifest.json",json.dumps(manifest).encode()),*values.items()]
                    if defect=="duplicate":records.append(records[1])
                    if defect=="extra":records.append(("app/unlisted.js",b"fixture"))
                    for name,data in records:
                        item=tarfile.TarInfo(name);item.size=len(data);archive.addfile(item,io.BytesIO(data))
                if defect:
                    with self.assertRaises(RuntimeError):OP.unpack_runtime(archive_path,root/"output",source,"1"*40,"2"*64)
                    self.assertFalse((root/"output").exists())
                else:
                    result=OP.unpack_runtime(archive_path,root/"output",source,"1"*40,"2"*64)
                    self.assertEqual(result["commit"],"1"*40)
                    self.assertEqual((root/"output/app/server.cjs").read_bytes(),values["app/server.cjs"])
                    self.assertTrue((root/"output/Dockerfile").is_file())

    def test_native_postgres_environment_is_refused(self):
        config=original();config["services"]["app"]["environment"]["NODE_PG_FORCE_NATIVE"]="1"
        with self.assertRaisesRegex(RuntimeError,"cms_native_pg_environment_refused"):
            OP.candidate(config,"new","1"*40,pathlib.Path("/fixture"),"protected",True)

    def test_writer_secret_is_stdin_only_and_existing_role_is_not_replaced(self):
        with tempfile.TemporaryDirectory(prefix="cms-operator-") as directory:
            root=pathlib.Path(directory)
            (root/"cms_writer_password").write_text("a"*64)
            with patch.object(OP,"sql",return_value=b"0\n"),patch.object(OP,"run",return_value=b"") as run:
                OP.grant_writer(root)
                args=run.call_args.args[0];command=run.call_args.kwargs["data"].decode()
                self.assertNotIn("a"*64," ".join(args))
                self.assertIn("NOCREATEDB NOCREATEROLE",command)
                self.assertNotIn("GRANT ALL",command)
                self.assertNotIn("GRANT UPDATE ON audit_events",command)
                self.assertTrue((root/"writer-created.receipt.json").is_file())
            with patch.object(OP,"sql",return_value=b"1\n"):
                with self.assertRaisesRegex(RuntimeError,"cms_writer_already_exists"):OP.grant_writer(root)

    def test_frozen_configuration_rejects_drift_before_an_operation(self):
        with tempfile.TemporaryDirectory(prefix="cms-frozen-") as directory:
            root=pathlib.Path(directory)
            configuration=root/"candidate.json";configuration.write_text('{"ports":[]}')
            manifest=root/"uploads-before.private.json";manifest.write_text("{}")
            recovery={"boundFiles":{configuration.name:OP.sha(configuration),manifest.name:OP.sha(manifest)}}
            OP.verify_frozen(root,recovery)
            configuration.write_text('{"ports":[8081]}')
            with self.assertRaisesRegex(RuntimeError,"cms_frozen_configuration_changed"):
                OP.verify_frozen(root,recovery)

if __name__ == "__main__":
    unittest.main()
