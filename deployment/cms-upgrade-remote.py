"""D-180: upgrade only the existing CMS applications through pinned SSH.
No migrations, imports, role/secret replacement, new listeners or database writes.
Private recovery is retained; every application switch preserves current content.
"""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tarfile
import time

BASE_SHA = "11e7be6d7a53fd92978cb6d277274109e268344510aa93c264d84748134be3c5"
PREVIOUS_COMMIT = "7b411d957d6b468f6d9b1bffa8e21efe40d4de2d"
PREVIOUS_IMAGE = "sha256:53bef03bba2c58e5e88c3415c7a41dc584e2336c91bebdb4121e9d4e55f848fd"
SCHEMA_ORDER = 27
CMS_MOUNT = "/var/lib/savinggrace/cms-assets"
CMS_SECRETS = ("cms_writer_password", "cms_session_secret")


def fail(code):
    raise RuntimeError(code)


def base_operator():
    path = pathlib.Path(__file__).with_name("cms-remote.py")
    if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != BASE_SHA:
        fail("cms_upgrade_helper_changed")
    spec = importlib.util.spec_from_file_location("cms_upgrade_verified_base", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def assert_cms_config(config, runtime, assets):
    if runtime not in ("public", "protected") or set(config.get("services", {})) != {"app"}:
        fail("cms_upgrade_configuration_scope")
    app = config["services"]["app"]
    env = app.get("environment", {})
    if env.get("CMS_SITE_ENABLED") != "1" or env.get("CMS_STORAGE_DIRECTORY") != CMS_MOUNT:
        fail("cms_upgrade_existing_cms_required")
    if env.get("ENABLE_LOCAL_TEST_IDENTITIES") or env.get("NODE_PG_FORCE_NATIVE") or env.get("RELATED_THEMES_VISITOR_ENABLED") == "1":
        fail("cms_upgrade_runtime_flags_refused")
    mounts = [mount for mount in app.get("volumes", []) if isinstance(mount, dict) and mount.get("target") == CMS_MOUNT]
    if len(mounts) != 1 or mounts[0].get("type") != "bind" or mounts[0].get("source") != str(assets) or mounts[0].get("read_only") != (runtime == "public"):
        fail("cms_upgrade_asset_mount_refused")
    names = [secret if isinstance(secret, str) else secret.get("source") for secret in app.get("secrets", [])]
    if runtime == "protected":
        if any(names.count(name) != 1 for name in CMS_SECRETS) or any(name not in config.get("secrets", {}) for name in CMS_SECRETS):
            fail("cms_upgrade_existing_secrets_required")
        if env.get("STAGING_CMS_ENABLED") != "1" or env.get("CMS_ACCESS") != "protected_tunnel" or env.get("CMS_ORIGIN") != "http://127.0.0.1:4396":
            fail("cms_upgrade_protected_access_refused")
    elif any(name in names for name in CMS_SECRETS) or any(name in env for name in ("STAGING_CMS_ENABLED", "CMS_ACCESS", "CMS_ORIGIN")):
        fail("cms_upgrade_public_admin_refused")


def candidate(original, image, commit, runtime, assets):
    assert_cms_config(original, runtime, assets)
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image):
        fail("cms_upgrade_immutable_image_required")
    value = copy.deepcopy(original)
    value["services"]["app"]["image"] = image
    value["services"]["app"]["environment"]["RELEASE_COMMIT"] = commit
    # Exactly these two scalar changes are authorized. All mounts, secrets,
    # addresses, ports, networks and hardening settings remain byte-equivalent.
    unchanged = copy.deepcopy(value)
    unchanged["services"]["app"]["image"] = original["services"]["app"]["image"]
    unchanged["services"]["app"]["environment"]["RELEASE_COMMIT"] = original["services"]["app"]["environment"]["RELEASE_COMMIT"]
    if unchanged != original:
        fail("cms_upgrade_configuration_difference")
    return value


def cms_snapshot(base):
    result = {}
    selectors = {"cms_entities": "", "cms_revisions": "", "cms_routes": "",
                 "media_assets": " WHERE storage_provider IN ('cms_local','cms_embedded')",
                 "audit_events": " WHERE entity_type IN ('cms_entity','cms_asset')"}
    for name, condition in selectors.items():
        result[name] = json.loads(base.sql("SELECT COALESCE(json_agg(to_jsonb(t)),'[]'::json) FROM " + name + " t" + condition))
    result["schema_migrations"] = json.loads(base.sql("SELECT COALESCE(json_agg(to_jsonb(t)),'[]'::json) FROM schema_migrations t"))
    return result


def verify_schema_source(source, snapshot):
    rows = snapshot["schema_migrations"]
    if len(rows) != SCHEMA_ORDER or sorted(row["migration_order"] for row in rows) != list(range(1, SCHEMA_ORDER + 1)):
        fail("cms_upgrade_schema_prefix_refused")
    migrations = source / "db/migrations"
    expected = set()
    for row in rows:
        name = row["migration_id"]
        if not re.fullmatch(r"[0-9]{4}_[a-z0-9_]+", name):
            fail("cms_upgrade_schema_identifier_refused")
        paths = [migrations / (name + suffix) for suffix in (".sql", ".down.sql")]
        if any(path.is_symlink() or not path.is_file() for path in paths):
            fail("cms_upgrade_schema_source_missing")
        values = [path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").rstrip("\n") + "\n" for path in paths]
        value = "\n".join(("saving-grace-schema-migration-v1", "-- up", values[0], "-- down", values[1]))
        if hashlib.sha256(value.encode()).hexdigest() != row["checksum_sha256"]:
            fail("cms_upgrade_schema_source_changed")
        expected.update(path.name for path in paths)
    if {path.name for path in migrations.iterdir()} != expected:
        fail("cms_upgrade_schema_file_scope")


def snapshot_hash(snapshot):
    normalized = {name: sorted(json.dumps(row, sort_keys=True, separators=(",", ":")) for row in rows) for name, rows in snapshot.items()}
    return hashlib.sha256(json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def immutable_preserved(before, current):
    for name in ("cms_revisions", "media_assets", "audit_events", "schema_migrations"):
        old_rows = {json.dumps(row, sort_keys=True, separators=(",", ":")) for row in before[name]}
        new_rows = {json.dumps(row, sort_keys=True, separators=(",", ":")) for row in current[name]}
        if not old_rows <= new_rows or (name == "schema_migrations" and old_rows != new_rows):
            fail("cms_upgrade_retained_history_changed")
    if not {row["id"] for row in before["cms_entities"]} <= {row["id"] for row in current["cms_entities"]}:
        fail("cms_upgrade_prior_entity_removed")


def secret_receipt(base, originals):
    result = {}
    for runtime, config in originals.items():
        app = config["services"]["app"]
        for entry in app.get("secrets", []):
            name = entry if isinstance(entry, str) else entry["source"]
            definition = config.get("secrets", {}).get(name, {})
            path = pathlib.Path(definition.get("file", ""))
            if not path.is_absolute() or path.is_symlink() or not path.is_file():
                fail("cms_upgrade_secret_file_refused")
            stat = path.stat()
            if stat.st_mode & 0o077:
                fail("cms_upgrade_secret_permissions_refused")
            if name in CMS_SECRETS and not re.fullmatch(r"[a-f0-9]{64}", path.read_text().strip()):
                fail("cms_upgrade_secret_format_refused")
            result[runtime + ":" + name] = {"path": str(path), "sha256": base.sha(path), "mode": stat.st_mode & 0o777, "uid": stat.st_uid, "gid": stat.st_gid}
    return result


def inventory(base, helper):
    result = base.inventory(helper)
    originals = {runtime: base.configuration(helper, container)[2] for runtime, container in (("public", base.PUBLIC), ("protected", base.PROTECTED))}
    for runtime, config in originals.items():
        assert_cms_config(config, runtime, base.ASSETS)
    current = cms_snapshot(base)
    result["outcome"] = "cms_upgrade_readonly_inventory"
    result["cmsCounts"] = {name: len(rows) for name, rows in current.items()}
    result["cmsSha256"] = snapshot_hash(current)
    result["uploadsSha256"] = hashlib.sha256(json.dumps(base.assets_manifest(), sort_keys=True).encode()).hexdigest()
    result["unrelatedSha256"] = base.preservation()
    result["secretFilesSha256"] = hashlib.sha256(json.dumps(secret_receipt(base, originals), sort_keys=True).encode()).hexdigest()
    return result


def prepare(base, helper, root, incoming, commit, source_hash, inventory_hash, runtime_hash):
    if root.exists():
        fail("cms_upgrade_release_exists")
    if base.sha(incoming / "release.tar") != source_hash or base.sha(incoming / "inventory.private.json") != inventory_hash or base.sha(incoming / "runtime.tar") != runtime_hash:
        fail("cms_upgrade_transfer_hash_mismatch")
    expected = base.load(incoming / "inventory.private.json")
    actual = inventory(base, helper)
    stable = ("runtimes", "counts", "cmsCounts", "cmsSha256", "uploadsSha256", "unrelatedSha256", "secretFilesSha256")
    if any(expected.get(key) != actual[key] for key in stable) or actual["counts"]["ledger"] != SCHEMA_ORDER or actual["storage"]["availableBytes"] < 2 * 1024**3:
        fail("cms_upgrade_inventory_drift")
    for runtime in actual["runtimes"].values():
        if runtime["release"] != PREVIOUS_COMMIT or runtime["image"] != PREVIOUS_IMAGE or not runtime["healthy"] or not runtime["readonlyRoot"] or not runtime["capabilitiesDropped"]:
            fail("cms_upgrade_incumbent_changed")
    root.mkdir(parents=True, mode=0o700)
    originals = {runtime: base.configuration(helper, container)[2] for runtime, container in (("public", base.PUBLIC), ("protected", base.PROTECTED))}
    for runtime, config in originals.items():
        base.save(root / (runtime + "-incumbent.json"), config)
        previous = candidate(config, actual["runtimes"][runtime]["image"], actual["runtimes"][runtime]["release"], runtime, base.ASSETS)
        base.save(root / (runtime + "-previous.json"), previous)
    base.save(root / "secrets-before.private.json", secret_receipt(base, originals))
    before = cms_snapshot(base)
    if snapshot_hash(before) != actual["cmsSha256"]:
        fail("cms_upgrade_content_changed_during_prepare")
    base.save(root / "cms-before.private.json", before)
    assets = base.assets_manifest()
    base.save(root / "uploads-before.private.json", assets)
    with tarfile.open(root / "uploads-before.tar", "x") as archive:
        for name in assets:
            archive.add(base.ASSETS / name, arcname=name, recursive=False)
    (root / "uploads-before.tar").chmod(0o600)
    for name in ("release.tar", "runtime.tar"):
        shutil.copyfile(base.checked(incoming / name), root / name)
        (root / name).chmod(0o600)
    source = root / "release"; source.mkdir(mode=0o700)
    with tarfile.open(root / "release.tar") as archive:
        base.safe_archive(archive)
        if archive.pax_headers.get("comment") != commit:
            fail("cms_upgrade_source_commit_mismatch")
        archive.extractall(source)
    verify_schema_source(source, before)
    digests = [item for item in helper.inspect("node:24-bookworm-slim")["RepoDigests"] if item.startswith("node@sha256:")]
    if len(digests) != 1:
        fail("cms_upgrade_immutable_base_required")
    manifest = base.unpack_runtime(root / "runtime.tar", root / "runtime", source, commit, source_hash)
    base.save(root / "runtime-manifest.receipt.json", manifest)
    image = "savinggrace-cms:" + commit
    with (root / "build.log").open("xb") as output:
        result = subprocess.run(["docker", "build", "--pull=false", "--network=none", "--build-arg", "NODE_IMAGE=" + digests[0], "--build-arg", "RELEASE_COMMIT=" + commit, "-t", image, str(root / "runtime")], stdout=output, stderr=subprocess.STDOUT, timeout=900)
        if result.returncode:
            fail("cms_upgrade_offline_image_build_failed")
    image_id = helper.inspect(image)["Id"]
    for runtime, original in originals.items():
        config = candidate(original, image_id, commit, runtime, base.ASSETS)
        base.save(root / (runtime + "-candidate.json"), config)
        base.save(root / (runtime + "-canary.json"), base.canary(config, commit, runtime))
    # Available disk naturally changes during packaging; compare only the
    # frozen application, data and credential observations.
    current = inventory(base, helper)
    if any(current[key] != actual[key] for key in stable):
        fail("cms_upgrade_preservation_failed")
    bound = {path.name: base.sha(path) for path in root.iterdir() if path.suffix == ".json" or path.name in ("uploads-before.tar", "release.tar", "runtime.tar")}
    recovery = {"version": 1, "commit": commit, "image": image_id, "previous": actual, "boundFiles": bound}
    base.save(root / "recovery.json", recovery)
    return {"outcome": "cms_upgrade_prepared", "commit": commit, "image": recovery["image"], "schema": SCHEMA_ORDER, "contentPreserved": True, "credentialsRetained": True}


def verify_frozen(base, root, recovery):
    base.verify_frozen(root, recovery)
    for receipt in base.load(root / "secrets-before.private.json").values():
        path = pathlib.Path(receipt["path"])
        stat = base.checked(path).stat()
        if base.sha(path) != receipt["sha256"] or (stat.st_mode & 0o777, stat.st_uid, stat.st_gid) != (receipt["mode"], receipt["uid"], receipt["gid"]):
            fail("cms_upgrade_secret_changed")
    if base.preservation() != recovery["previous"]["unrelatedSha256"]:
        fail("cms_upgrade_unrelated_changed")
    immutable_preserved(base.load(root / "cms-before.private.json"), cms_snapshot(base))


def active_phases(base, helper, root, recovery):
    result = {}
    for runtime, container in (("public", base.PUBLIC), ("protected", base.PROTECTED)):
        info, _, config = base.configuration(helper, container)
        for phase in ("previous", "candidate"):
            expected = base.load(root / (runtime + "-" + phase + ".json"))
            image = recovery["image"] if phase == "candidate" else recovery["previous"]["runtimes"][runtime]["image"]
            incumbent = base.load(root / (runtime + "-incumbent.json")) if phase == "previous" else None
            if (config == expected or config == incumbent) and info["Image"] == image:
                result[runtime] = phase
                break
        if runtime not in result:
            fail("cms_upgrade_active_configuration_drift")
    return result


def expected_image(recovery, runtime, phase):
    return recovery["image"] if phase == "candidate" else recovery["previous"]["runtimes"][runtime]["image"]


def verify_image(base, helper, path, expected):
    image = base.load(path)["services"]["app"]["image"]
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image) or image != expected or helper.inspect(image)["Id"] != expected:
        fail("cms_upgrade_image_drift")


def verify_phase_images(base, helper, root, recovery, phases):
    for runtime, phase in phases.items():
        verify_image(base, helper, root / (runtime + "-" + phase + ".json"), expected_image(recovery, runtime, phase))


def compose_up(base, helper, path, image):
    verify_image(base, helper, path, image)
    base.run(["docker", "compose", "-f", str(path), "up", "--pull", "never", "-d", "--no-deps", "--wait", "--wait-timeout", "120", "app"])


def run_canaries(base, helper, root, recovery):
    # Validate immutable candidate and rollback availability before either canary.
    verify_phase_images(base, helper, root, recovery, {runtime: "previous" for runtime in ("public", "protected")})
    for runtime in ("public", "protected"):
        verify_image(base, helper, root / (runtime + "-canary.json"), recovery["image"])
    before = snapshot_hash(cms_snapshot(base)); uploads = base.assets_manifest()
    for runtime in ("public", "protected"):
        path = root / (runtime + "-canary.json")
        try:
            compose_up(base, helper, path, recovery["image"])
        finally:
            base.run(["docker", "compose", "-f", str(path), "down", "--remove-orphans"])
    if snapshot_hash(cms_snapshot(base)) != before or base.assets_manifest() != uploads:
        fail("cms_upgrade_canary_changed_content")
    receipt = root / "canary.receipt.json"
    if not receipt.exists():
        base.save(receipt, {"commit": recovery["commit"], "image": recovery["image"], "contentPreserved": True})


def switch(base, helper, root, recovery, phase):
    if phase not in ("previous", "candidate"):
        fail("cms_upgrade_phase_refused")
    if phase == "candidate":
        base.checked(root / "canary.receipt.json")
    current = active_phases(base, helper, root, recovery)
    # Verify candidate and recovery availability before changing either app.
    verify_phase_images(base, helper, root, recovery, {runtime: phase for runtime in ("public", "protected")})
    verify_phase_images(base, helper, root, recovery, current)
    before = snapshot_hash(cms_snapshot(base)); uploads = base.assets_manifest()
    try:
        for runtime, port in (("public", 8080), ("protected", 8082)):
            path = root / (runtime + "-" + phase + ".json")
            commit = base.load(path)["services"]["app"]["environment"]["RELEASE_COMMIT"]
            compose_up(base, helper, path, expected_image(recovery, runtime, phase)); helper.ready(port, commit)
        if snapshot_hash(cms_snapshot(base)) != before or base.assets_manifest() != uploads:
            fail("cms_upgrade_content_changed_during_switch")
        if any(value != phase for value in active_phases(base, helper, root, recovery).values()):
            fail("cms_upgrade_activation_not_current")
        verify_frozen(base, root, recovery)
    except Exception:
        # Recover only the application configurations observed before this switch.
        # Post-start image/config/content checks are covered by this same path.
        # Database rows, upload bytes and credentials are never rolled back.
        verify_phase_images(base, helper, root, recovery, current)
        for runtime, port in (("public", 8080), ("protected", 8082)):
            path = root / (runtime + "-" + current[runtime] + ".json")
            commit = base.load(path)["services"]["app"]["environment"]["RELEASE_COMMIT"]
            compose_up(base, helper, path, expected_image(recovery, runtime, current[runtime])); helper.ready(port, commit)
        if active_phases(base, helper, root, recovery) != current:
            fail("cms_upgrade_recovery_not_current")
        verify_frozen(base, root, recovery)
        fail("cms_upgrade_activation_restored_previous_apps")
    base.save(root / ("switch-" + str(time.time_ns()) + ".receipt.json"), {"phase": phase, "contentSha256": before, "uploadsPreserved": True})


def main():
    if os.geteuid() != 0 or len(sys.argv) < 2:
        fail("cms_upgrade_arguments_refused")
    base = base_operator(); helper = base.retained(); base.verify_database(helper)
    operation = sys.argv[1]
    if operation == "inventory" and len(sys.argv) == 2:
        print(json.dumps(inventory(base, helper))); return
    if len(sys.argv) < 3 or not re.fullmatch(r"[a-f0-9]{40}", sys.argv[2]):
        fail("cms_upgrade_commit_refused")
    commit = sys.argv[2]
    root = pathlib.Path("/opt/savinggrace-cms-upgrade") / commit
    incoming = pathlib.Path("/home/ec2-user/.cms-upgrade-transfer") / commit
    if operation == "prepare" and len(sys.argv) == 6:
        if not all(re.fullmatch(r"[a-f0-9]{64}", value) for value in sys.argv[3:]):
            fail("cms_upgrade_hash_refused")
        print(json.dumps(prepare(base, helper, root, incoming, commit, *sys.argv[3:]))); return
    if len(sys.argv) != 3:
        fail("cms_upgrade_operation_arguments_refused")
    recovery = base.load(root / "recovery.json")
    if recovery.get("version") != 1 or recovery.get("commit") != commit:
        fail("cms_upgrade_recovery_binding")
    verify_frozen(base, root, recovery)
    active_phases(base, helper, root, recovery)
    if operation == "canary":
        run_canaries(base, helper, root, recovery)
    elif operation in ("activate", "reactivate", "rollback"):
        switch(base, helper, root, recovery, "previous" if operation == "rollback" else "candidate")
    elif operation == "verify":
        current = inventory(base, helper)
        if current["counts"]["ledger"] != SCHEMA_ORDER or any(not runtime["healthy"] or not runtime["readonlyRoot"] or not runtime["capabilitiesDropped"] for runtime in current["runtimes"].values()):
            fail("cms_upgrade_runtime_not_ready")
        for runtime, port in (("public", 8080), ("protected", 8082)):
            helper.ready(port, current["runtimes"][runtime]["release"])
        print(json.dumps(current))
    else:
        fail("cms_upgrade_operation_refused")
    verify_frozen(base, root, recovery)
    print(json.dumps({"outcome": "cms_upgrade_" + operation, "commit": commit, "schema": SCHEMA_ORDER, "historyPreserved": True, "credentialsRetained": True}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = str(error) if re.fullmatch(r"cms_[a-z_]+", str(error)) else "cms_upgrade_operation_refused"
        print(json.dumps({"outcome": "stopped_safely", "code": code}))
        sys.exit(1)
