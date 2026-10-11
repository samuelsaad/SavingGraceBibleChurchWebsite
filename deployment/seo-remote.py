"""D-181: additive source-public migration on the two existing sealed apps.
The compatible feature-off bridge precedes schema28; rollback preserves history.
Use only the retained pinned SSH transport. Source bodies stay in private files.
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

UPGRADE_SHA = "e41bbc7b36e883665a4f57c07ed1fbd9b222f018d07af9597f90cebfd4e62fb2"
PREVIOUS_COMMIT = "52dca271bef9e80c15ee76b9b46e2d85ae15de08"
PREVIOUS_IMAGE = "sha256:b11affa6ee5f919fea6796512d50f2cd43d0ca53a97133470b8658a172cce38f"
BASE_SCHEMA_ORDER = 28
EXISTING_SOURCE_SHA = "7a1a5ffca195eb99c587eec12bb8a0903269c94c49794034d38525967c1f6845"
EXISTING_BUNDLE_SHA = "846be1ce89d93c7b41c153c712cb7ec8f1f4d89244aa8cb9ed8b46f3c4d70442"
INCOMING_BUNDLE_SHA = "3f34acc4b850884c4fbb44bbb66fc0b42c23bb1dfa7f7416f5840cb80ffb1917"
SOURCE_TABLES = ("source_public_versions", "source_public_routes", "source_public_imports")
ASSET_KEY = re.compile(r"[a-f0-9]{64}\.(?:png|jpg|webp|gif|avif|svg|ico|pdf|doc|docx|xls|xlsx|ppt|pptx|rss|atom|ics|zip|otf)")
MIGRATION = "0028_source_public_migration"


def fail(code):
    raise RuntimeError(code)


def helpers():
    path = pathlib.Path(__file__).with_name("cms-upgrade-remote.py")
    if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != UPGRADE_SHA:
        fail("seo_helper_changed")
    spec = importlib.util.spec_from_file_location("seo_verified_cms_upgrade", path)
    upgrade = importlib.util.module_from_spec(spec); spec.loader.exec_module(upgrade)
    base = upgrade.base_operator()
    base.RUNTIME_ENTRIES = (*base.RUNTIME_ENTRIES, "source-public-sync")
    base.CMS_TABLES = (*base.CMS_TABLES, *SOURCE_TABLES)
    base.assets_manifest = lambda: assets_manifest(base)
    upgrade.SCHEMA_ORDER = BASE_SCHEMA_ORDER
    upgrade.PREVIOUS_COMMIT = PREVIOUS_COMMIT; upgrade.PREVIOUS_IMAGE = PREVIOUS_IMAGE
    upgrade.verify_schema_source = verify_schema_source
    original_candidate = upgrade.candidate
    def bridge(original, image, commit, runtime, assets):
        result = original_candidate(original, image, commit, runtime, assets)
        if commit != PREVIOUS_COMMIT:
            result["services"]["app"]["environment"]["SOURCE_PUBLIC_ENABLED"] = "0"
        return result
    upgrade.candidate = bridge
    return base, upgrade


def assets_manifest(base):
    root = base.ASSETS
    if root.is_symlink() or not root.is_dir(): fail("seo_asset_root_refused")
    result = {}
    for path in root.iterdir():
        if path.name == "source-public":
            if path.is_symlink() or not path.is_dir(): fail("seo_source_asset_root_refused")
            for asset in path.iterdir():
                if not ASSET_KEY.fullmatch(asset.name) or base.sha(asset) != asset.stem: fail("seo_source_asset_integrity")
                result["source-public/" + asset.name] = asset.stat().st_size
        else:
            if not re.fullmatch(r"[a-f0-9]{64}\.(png|jpg|gif|webp|pdf)", path.name) or base.sha(path) != path.stem: fail("seo_cms_asset_integrity")
            result[path.name] = path.stat().st_size
    return result


def verify_schema_source(source, snapshot):
    rows = snapshot["schema_migrations"]
    if sorted(row["migration_order"] for row in rows) != list(range(1, BASE_SCHEMA_ORDER + 1)): fail("seo_schema_prefix")
    directory = source / "db/migrations"; names = set()
    for row in rows:
        name = row["migration_id"]
        if not re.fullmatch(r"[0-9]{4}_[a-z0-9_]+", name): fail("seo_schema_identifier")
        files = [directory / (name + suffix) for suffix in (".sql", ".down.sql")]
        if any(path.is_symlink() or not path.is_file() for path in files): fail("seo_schema_source_missing")
        values = [path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").rstrip("\n") + "\n" for path in files]
        checksum = hashlib.sha256("\n".join(("saving-grace-schema-migration-v1", "-- up", values[0], "-- down", values[1])).encode()).hexdigest()
        if checksum != row["checksum_sha256"]: fail("seo_schema_source_changed")
        names.update(path.name for path in files)
    names.update(MIGRATION + suffix for suffix in (".sql", ".down.sql"))
    if {path.name for path in directory.iterdir()} != names: fail("seo_schema_file_scope")


def source_migration_checksum(root):
    paths = [root / "release/db/migrations" / (MIGRATION + suffix) for suffix in (".sql", ".down.sql")]
    if any(path.is_symlink() or not path.is_file() for path in paths): fail("seo_schema_source_missing")
    values = [path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").rstrip("\n") + "\n" for path in paths]
    return hashlib.sha256("\n".join(("saving-grace-schema-migration-v1", "-- up", values[0], "-- down", values[1])).encode()).hexdigest()


def source_snapshot(base):
    count = int(base.sql("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN('source_public_versions','source_public_routes','source_public_imports')").decode().strip())
    if count not in (0, 3): fail("seo_partial_source_schema")
    return {name: json.loads(base.sql("SELECT COALESCE(json_agg(to_jsonb(t)),'[]'::json) FROM " + name + " t")) if count else [] for name in SOURCE_TABLES}


def inventory(base, upgrade, helper):
    result = upgrade.inventory(base, helper); source = source_snapshot(base)
    result["outcome"] = "seo_readonly_inventory"
    result["sourceCounts"] = {name: len(rows) for name, rows in source.items()}
    result["sourceSha256"] = upgrade.snapshot_hash(source)
    return result


def asset_expectations(bundle):
    result = {}
    for page in bundle.get("pages", []):
        if page.get("kind") != "asset": continue
        asset = page.get("asset") or {}; key = asset.get("storageKey", "")
        if not ASSET_KEY.fullmatch(key) or asset.get("sha256") != key.split(".")[0] or type(asset.get("bytes")) is not int or not 0 < asset["bytes"] <= 52428800:
            fail("seo_asset_manifest_refused")
        if key in result and result[key] != asset: fail("seo_asset_manifest_conflict")
        result[key] = asset
    return result


def verify_asset_archive(base, archive_path, bundle):
    expected = asset_expectations(bundle)
    with tarfile.open(archive_path) as archive:
        members = archive.getmembers(); names = [member.name for member in members]
        if len(names) != len(set(names)) or any(not member.isfile() for member in members) or set(names) != {"source-public/" + key for key in expected}: fail("seo_asset_archive_scope")
        for member in members:
            asset = expected[member.name.removeprefix("source-public/")]
            if member.size != asset["bytes"]: fail("seo_asset_archive_size")
            if hashlib.sha256(archive.extractfile(member).read()).hexdigest() != asset["sha256"]: fail("seo_asset_archive_hash")
    return expected


def maintenance_configuration(original, image, commit, owner_file, root, bundle_hash):
    result = copy.deepcopy(original); app = result["services"]["app"]
    result["name"] = "savinggrace-seo-maintenance-" + commit[:12]
    app.update({"image": image, "entrypoint": ["node", "source-public-sync.cjs"], "user": "0:0", "restart": "no"})
    for name in ("container_name", "healthcheck", "depends_on", "ports", "hostname"): app.pop(name, None)
    app["networks"] = {name: {} for name in app["networks"]}
    app["volumes"] = [{"type": "bind", "source": str(root / "source-public.bundle.private.json"), "target": "/run/source-public/bundle.json", "read_only": True}]
    app["secrets"] = ["db_owner_password"]; result["secrets"] = {"db_owner_password": {"file": owner_file}}
    app["environment"].update({"RELEASE_COMMIT": commit, "ALLOW_STAGING_SOURCE_PUBLIC_SYNC": "1", "SOURCE_PUBLIC_TARGET": "existing-protected", "SOURCE_PUBLIC_BUNDLE_SHA256": bundle_hash})
    if not app.get("read_only") or app.get("cap_drop") != ["ALL"]: fail("seo_maintenance_hardening")
    return result


def database_recovery(base, helper, root):
    # Exact retained PostgreSQL instance/database; pg_dump reads only. The full
    # archive is private recovery, never release code or ordinary tool output.
    base.verify_database(helper)
    path = root / "staging-before.private.dump"
    with path.open("xb") as output:
        path.chmod(0o600)
        base.run(["docker", "exec", base.DB, "pg_dump", "-U", "postgres", "-d", "savinggrace_staging", "--format=custom"], output=output, timeout=900)
    with path.open("rb", buffering=0) as source:
        if source.read(5) != b"PGDMP": fail("seo_database_backup_header")
        source.seek(0)
        result = subprocess.run(["docker", "exec", "-i", base.DB, "pg_restore", "--list"], stdin=source, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
    listing = result.stdout
    if result.returncode or len(listing) > 10 * 1024 * 1024 or b"dbname: savinggrace_staging" not in listing or b"TABLE public sermons " not in listing or b"TABLE public cms_entities " not in listing: fail("seo_database_backup_listing")
    receipt = {"format": "postgres-custom", "database": "savinggrace_staging", "sha256": base.sha(path), "bytes": path.stat().st_size, "listingSha256": hashlib.sha256(listing).hexdigest(), "listingVerified": True}
    base.save(root / "database-backup.receipt.json", receipt)
    return receipt


def owner_secret_identity(base, path):
    if not path.is_absolute() or path.is_symlink() or not path.is_file() or any(parent.is_symlink() for parent in path.parents): fail("seo_owner_secret_file")
    stat = path.stat(); parent = path.parent.stat()
    if stat.st_mode & 0o007: fail("seo_owner_secret_permissions")
    return {"path": str(path), "sha256": base.sha(path), "mode": stat.st_mode & 0o777, "uid": stat.st_uid, "gid": stat.st_gid, "parent": {"mode": parent.st_mode & 0o777, "uid": parent.st_uid, "gid": parent.st_gid}}


def verify_existing_source(actual, bundle_hash):
    # Require the frozen incumbent history and the exact reviewed additive delta.
    expected={"source_public_versions":3424,"source_public_routes":3422,"source_public_imports":2}
    if actual.get("sourceCounts") != expected or actual.get("sourceSha256") != EXISTING_SOURCE_SHA or bundle_hash != INCOMING_BUNDLE_SHA:
        fail("seo_existing_source_drift")


def prepare(base, upgrade, helper, root, incoming, commit, source_hash, inventory_hash, runtime_hash, bundle_hash, assets_hash):
    expected = base.load(incoming / "inventory.private.json"); actual = inventory(base, upgrade, helper)
    for key in ("runtimes", "counts", "cmsCounts", "cmsSha256", "uploadsSha256", "unrelatedSha256", "secretFilesSha256"):
        if actual[key] != expected[key]: fail("seo_inventory_drift")
    verify_existing_source(actual, bundle_hash)
    if base.sha(incoming / "source-public.bundle.private.json") != bundle_hash or base.sha(incoming / "source-public-assets.private.tar") != assets_hash: fail("seo_private_transfer_hash")
    required_bytes = 2 * 1024**3 + 2 * sum((incoming / name).stat().st_size for name in ("source-public.bundle.private.json", "source-public-assets.private.tar"))
    if actual["storage"]["availableBytes"] < required_bytes: fail("seo_source_storage_insufficient")
    bundle = base.load(incoming / "source-public.bundle.private.json")
    verify_asset_archive(base, incoming / "source-public-assets.private.tar", bundle)
    upgrade.prepare(base, helper, root, incoming, commit, source_hash, inventory_hash, runtime_hash)
    recovery = base.load(root / "recovery.json")
    database_recovery(base, helper, root)
    if upgrade.snapshot_hash(upgrade.cms_snapshot(base)) != actual["cmsSha256"] or base.preservation() != actual["unrelatedSha256"]: fail("seo_content_changed_during_backup")
    for name in ("source-public.bundle.private.json", "source-public-assets.private.tar"):
        shutil.copyfile(base.checked(incoming / name), root / name); (root / name).chmod(0o600)
    base.save(root / "source-before.private.json", source_snapshot(base))
    for runtime in ("public", "protected"):
        config = base.load(root / (runtime + "-candidate.json"))
        config["services"]["app"]["environment"]["SOURCE_PUBLIC_ENABLED"] = "1"
        base.save(root / (runtime + "-source-candidate.json"), config)
        canary = base.canary(config, commit, runtime); canary["name"] += "-source"
        base.save(root / (runtime + "-source-canary.json"), canary)
    db = helper.inspect(base.DB); owner = next((mount for mount in db["Mounts"] if mount["Destination"] == "/run/secrets/db_owner_password"), None)
    if not owner or owner["RW"]: fail("seo_owner_mount_refused")
    base.save(root / "source-owner-secret.private.json", owner_secret_identity(base, pathlib.Path(owner["Source"])))
    base.save(root / "source-maintenance.json", maintenance_configuration(base.load(root / "protected-incumbent.json"), recovery["image"], commit, owner["Source"], root, bundle_hash))
    recovery["version"] = 2
    recovery["boundFiles"] = {path.name: base.sha(path) for path in root.iterdir() if path.suffix == ".json" or path.name.endswith((".tar", ".private.dump"))}
    base.save(root / "seo-recovery.json", recovery)
    return {"outcome": "seo_prepared", "commit": commit, "image": recovery["image"], "sourceAssets": len(asset_expectations(bundle)), "schema": BASE_SCHEMA_ORDER}


def verify_frozen(base, upgrade, root, recovery):
    base.verify_frozen(root, recovery)
    owner = base.load(root / "source-owner-secret.private.json")
    if owner_secret_identity(base, pathlib.Path(owner["path"])) != owner: fail("seo_owner_secret_changed")
    for key, receipt in base.load(root / "secrets-before.private.json").items():
        path = pathlib.Path(receipt["path"]); identity = upgrade.secret_file_identity(path, key.split(":", 1)[-1])
        if base.sha(path) != receipt["sha256"] or any(identity[name] != receipt[name] for name in ("mode", "uid", "gid", "parent")): fail("seo_secret_changed")
    if base.preservation() != recovery["previous"]["unrelatedSha256"]: fail("seo_unrelated_changed")
    before = base.load(root / "cms-before.private.json"); current = upgrade.cms_snapshot(base)
    extra = [row for row in current["schema_migrations"] if row["migration_order"] > BASE_SCHEMA_ORDER]
    if len(extra) > 1 or any(row["migration_order"] != 28 or row["migration_id"] != MIGRATION or row["checksum_sha256"] != source_migration_checksum(root) for row in extra): fail("seo_schema_suffix_changed")
    current["schema_migrations"] = [row for row in current["schema_migrations"] if row["migration_order"] <= BASE_SCHEMA_ORDER]
    upgrade.immutable_preserved(before, current)
    for name in ("source_public_versions", "source_public_imports"):
        old = {json.dumps(row, sort_keys=True) for row in base.load(root / "source-before.private.json")[name]}
        if not old <= {json.dumps(row, sort_keys=True) for row in source_snapshot(base)[name]}: fail("seo_source_history_changed")


def phase_file(root, runtime, phase):
    return root / (runtime + "-" + {"previous": "previous", "bridge": "candidate", "candidate": "source-candidate"}[phase] + ".json")


def active_phases(base, helper, root, recovery):
    result = {}
    for runtime, container in (("public", base.PUBLIC), ("protected", base.PROTECTED)):
        info, _, config = base.configuration(helper, container)
        for phase in ("previous", "bridge", "candidate"):
            expected = base.load(phase_file(root, runtime, phase)); image = PREVIOUS_IMAGE if phase == "previous" else recovery["image"]
            if info["Image"] == image and (config == expected or phase == "previous" and config == base.load(root / (runtime + "-incumbent.json"))): result[runtime] = phase; break
        if runtime not in result: fail("seo_active_configuration_drift")
    return result


def state_hash(base, upgrade):
    return upgrade.snapshot_hash(upgrade.cms_snapshot(base)), upgrade.snapshot_hash(source_snapshot(base)), base.assets_manifest()


def verify_source_ready(base, root, recovery):
    receipt = base.load(root / "source-import.receipt.json")
    expected = {"commit": recovery["commit"], "image": recovery["image"], "bundleSha256": base.sha(root / "source-public.bundle.private.json"), "assetArchiveSha256": base.sha(root / "source-public-assets.private.tar")}
    if any(receipt.get(key) != value for key, value in expected.items()) or not re.fullmatch(r"[a-f0-9]{64}", receipt.get("sourceImportSha256", "")): fail("seo_source_receipt_binding")
    if int(base.sql("SELECT count(*) FROM source_public_imports WHERE bundle_sha256='" + receipt["sourceImportSha256"] + "'").decode().strip()) != 1: fail("seo_source_import_required")
    assets = base.assets_manifest()
    if any(assets.get("source-public/" + key) != value["bytes"] for key, value in asset_expectations(base.load(root / "source-public.bundle.private.json")).items()): fail("seo_source_asset_required")


def canaries(base, upgrade, helper, root, recovery, phase):
    if phase == "candidate": verify_source_ready(base, root, recovery)
    before = state_hash(base, upgrade)
    for runtime in ("public", "protected"):
        path = root / (runtime + ("-canary.json" if phase == "bridge" else "-source-canary.json"))
        try: upgrade.compose_up(base, helper, path, recovery["image"])
        finally: base.run(["docker", "compose", "-f", str(path), "down", "--remove-orphans"])
    if state_hash(base, upgrade) != before: fail("seo_canary_changed_content")
    receipt = root / (phase + "-canary.receipt.json")
    if not receipt.exists(): base.save(receipt, {"commit": recovery["commit"], "image": recovery["image"]})


def switch(base, upgrade, helper, root, recovery, phase):
    if phase == "candidate": verify_source_ready(base, root, recovery)
    if base.load(root / (phase + "-canary.receipt.json")) != {"commit": recovery["commit"], "image": recovery["image"]}: fail("seo_canary_receipt_binding")
    current = active_phases(base, helper, root, recovery); before = state_hash(base, upgrade)
    if (root / "source-cms-adoption.receipt.json").exists() and "previous" in current.values():
        fail("seo_incompatible_cms_image_refused")
    for runtime, previous in current.items():
        for chosen in (previous, phase): upgrade.verify_image(base, helper, phase_file(root, runtime, chosen), PREVIOUS_IMAGE if chosen == "previous" else recovery["image"])
    def start(runtime, chosen):
        path = phase_file(root, runtime, chosen); config = base.load(path)
        upgrade.compose_up(base, helper, path, PREVIOUS_IMAGE if chosen == "previous" else recovery["image"])
        helper.ready(8080 if runtime == "public" else 8082, config["services"]["app"]["environment"]["RELEASE_COMMIT"])
    try:
        for runtime in ("public", "protected"): start(runtime, phase)
        if state_hash(base, upgrade) != before or set(active_phases(base, helper, root, recovery).values()) != {phase}: fail("seo_switch_preservation")
        verify_frozen(base, upgrade, root, recovery)
    except Exception:
        ledger = int(base.sql("SELECT count(*) FROM schema_migrations").decode().strip())
        if ledger == 28 and BASE_SCHEMA_ORDER < 28 and "previous" in current.values(): fail("seo_incompatible_rollback_refused")
        for runtime, chosen in current.items(): start(runtime, chosen)
        if active_phases(base, helper, root, recovery) != current: fail("seo_recovery_configuration")
        verify_frozen(base, upgrade, root, recovery); fail("seo_switch_restored")
    base.save(root / ("switch-" + str(time.time_ns()) + ".receipt.json"), {"phase": phase, "contentPreserved": True})


def install_assets(base, root):
    archive_path = root / "source-public-assets.private.tar"; expected = verify_asset_archive(base, archive_path, base.load(root / "source-public.bundle.private.json"))
    directory = base.ASSETS / "source-public"
    if directory.exists() and (directory.is_symlink() or not directory.is_dir()): fail("seo_asset_directory_refused")
    if not directory.exists(): directory.mkdir(mode=0o700); os.chown(directory, 1000, 1000)
    added = 0
    with tarfile.open(archive_path) as archive:
        for key, asset in expected.items():
            target = directory / key
            if target.exists():
                if base.sha(target) != asset["sha256"] or target.stat().st_size != asset["bytes"]: fail("seo_asset_collision")
                continue
            with target.open("xb") as output: shutil.copyfileobj(archive.extractfile("source-public/" + key), output)
            target.chmod(0o600); os.chown(target, 1000, 1000)
            if base.sha(target) != asset["sha256"]: fail("seo_asset_write_integrity")
            added += 1
    return added


def migrate(base, upgrade, helper, root, recovery):
    if set(active_phases(base, helper, root, recovery).values()) != {"bridge"}: fail("seo_bridge_required")
    for port in (8080, 8082): helper.ready(port, recovery["commit"])
    upgrade.verify_image(base, helper, root / "source-maintenance.json", recovery["image"])
    cms_before = upgrade.cms_snapshot(base); assets_before = base.assets_manifest()
    command = ["docker", "compose", "-f", str(root / "source-maintenance.json"), "run", "--rm", "--no-deps", "--pull", "never", "app"]
    apply_result = json.loads(base.run(command + ["apply"], timeout=600))
    apply_replay = json.loads(base.run(command + ["apply"], timeout=600))
    if apply_replay.get("result", {}).get("migration") != "unchanged": fail("seo_migration_not_idempotent")
    # Existing reader only; the protected CMS writer receives no new grants.
    grant = b"BEGIN; GRANT SELECT ON source_public_versions,source_public_routes,source_public_imports TO staging_reader; COMMIT;"
    base.run(["docker", "exec", "-i", base.DB, "psql", "-X", "-q", "-U", "postgres", "-d", "savinggrace_staging", "-v", "ON_ERROR_STOP=1"], data=grant)
    added = install_assets(base, root)
    result = json.loads(base.run(command + ["import"], timeout=600)); replay = json.loads(base.run(command + ["import"], timeout=600))
    after = upgrade.cms_snapshot(base); after["schema_migrations"] = [row for row in after["schema_migrations"] if row["migration_order"] <= BASE_SCHEMA_ORDER]
    cms_before["schema_migrations"] = [row for row in cms_before["schema_migrations"] if row["migration_order"] <= BASE_SCHEMA_ORDER]
    if upgrade.snapshot_hash(cms_before) != upgrade.snapshot_hash(after) or any(base.assets_manifest().get(name) != size for name, size in assets_before.items()): fail("seo_import_cms_changed")
    if replay.get("result", {}).get("inserted") != 0 or replay.get("result", {}).get("updated") != 0: fail("seo_import_not_idempotent")
    verify_frozen(base, upgrade, root, recovery)
    completion = {"commit": recovery["commit"], "image": recovery["image"], "bundleSha256": base.sha(root / "source-public.bundle.private.json"), "assetArchiveSha256": base.sha(root / "source-public-assets.private.tar"), "sourceImportSha256": result.get("result", {}).get("bundleSha256")}
    if not re.fullmatch(r"[a-f0-9]{64}", completion.get("sourceImportSha256") or ""): fail("seo_import_receipt_missing")
    marker = root / "source-import.receipt.json"
    if marker.exists():
        if base.load(marker) != completion: fail("seo_source_receipt_binding")
    else: base.save(marker, completion)
    verify_source_ready(base, root, recovery)
    receipt = {"outcome": "seo_migrated", "schema": 28, "assetsAdded": added, "apply": apply_result, "import": result, "replay": replay}
    base.save(root / ("migration-" + str(time.time_ns()) + ".receipt.json"), receipt)
    return receipt


def adopt_cms(base, upgrade, helper, root, recovery):
    """Freeze the source-backed plan before a separate additive CMS transaction.

    The compatible feature-off image is the only rollback target afterwards.
    No old entity, revision, route, review, resource or credential may change.
    """
    if set(active_phases(base, helper, root, recovery).values()) != {"bridge"}:
        fail("seo_bridge_required")
    verify_source_ready(base, root, recovery)
    before = upgrade.cms_snapshot(base); source_before = source_snapshot(base)
    assets_before = base.assets_manifest()
    config = base.load(root / "source-maintenance.json")
    config["services"]["app"]["environment"].update({"SOURCE_CMS_ADOPTION": "1", "CMS_STORAGE_DIRECTORY": "/run/cms-assets"})
    config["services"]["app"]["volumes"].append({"type": "bind", "source": str(base.ASSETS), "target": "/run/cms-assets", "read_only": False})
    path = root / "source-cms-maintenance.private.json"
    base.save(path, config)
    command = ["docker", "compose", "-f", str(path), "run", "--rm", "--no-deps", "--pull", "never", "app"]
    plan = json.loads(base.run(command + ["cms-plan"], timeout=600))
    marker = root / "source-cms-plan.receipt.json"
    if marker.exists():
        frozen = base.load(marker)
        if plan["planned"] and plan != frozen: fail("seo_cms_plan_changed")
    else:
        if plan.get("planned") != 2126 or plan.get("held") != 239 or plan.get("planSha256") != "d6d594f037c524a80190ed7516a3d093f9c5547211100b6525b1e3c0e18b1154":
            fail("seo_cms_plan_scope")
        frozen = plan; base.save(marker, frozen)
    config["services"]["app"]["environment"]["SOURCE_CMS_PLAN_SHA256"] = frozen["planSha256"]
    base.save(path, config)
    result = json.loads(base.run(command + ["adopt-cms"], timeout=900))
    replay = json.loads(base.run(command + ["adopt-cms"], timeout=900))
    if replay.get("result", {}).get("inserted") != 0 or replay.get("assets", {}).get("inserted") != 0:
        fail("seo_cms_not_idempotent")
    # The maintenance container owns only newly created managed copies. Restore
    # their established runtime ownership; never chmod/chown incumbent files.
    for name in set(base.assets_manifest()) - set(assets_before):
        if "/" in name or not re.fullmatch(r"[a-f0-9]{64}\.(png|jpg|gif|webp|pdf)", name):
            fail("seo_cms_new_asset_scope")
        asset = base.checked(base.ASSETS / name)
        os.chown(asset, 1000, 1000); asset.chmod(0o600)
    after = upgrade.cms_snapshot(base)
    for name in ("cms_entities", "cms_revisions", "cms_routes", "media_assets", "audit_events", "schema_migrations"):
        if not {json.dumps(row, sort_keys=True) for row in before[name]} <= {json.dumps(row, sort_keys=True) for row in after[name]}:
            fail("seo_cms_prior_rows_changed")
    if source_snapshot(base) != source_before or any(base.assets_manifest().get(name) != size for name, size in assets_before.items()):
        fail("seo_cms_source_or_assets_changed")
    receipt = {"outcome": "seo_cms_adopted", "commit": recovery["commit"], "image": recovery["image"], "plan": frozen, "result": result, "replay": replay, "priorRowsPreserved": True}
    base.save(root / "source-cms-adoption.receipt.json", receipt)
    verify_frozen(base, upgrade, root, recovery)
    return receipt


def repair_aliases(base, upgrade, helper, root, recovery):
    if set(active_phases(base, helper, root, recovery).values()) != {"bridge"} or not (root / "source-cms-adoption.receipt.json").exists():
        fail("seo_cms_adoption_required")
    before=upgrade.cms_snapshot(base); source=source_snapshot(base); assets=base.assets_manifest()
    command=["docker","compose","-f",str(root / "source-cms-maintenance.private.json"),"run","--rm","--no-deps","--pull","never","app","repair-aliases"]
    result=json.loads(base.run(command,timeout=600)); replay=json.loads(base.run(command,timeout=600))
    expected={"/venue/saving-grace-bible-church/","/organiser/saving-grace-bible-church/"}
    if {r["path"] for r in result.get("results",[])}!=expected or any(r["outcome"] not in ("repaired","already_repaired") for r in result["results"]) or any(r["outcome"]!="already_repaired" for r in replay.get("results",[])):
        fail("seo_alias_repair_scope")
    after=upgrade.cms_snapshot(base); allowed={r["entity_id"] for r in before["cms_routes"] if r["path"] in expected and r["status"]==301 and r["target_path"]=="/contact/"}
    for name in ("cms_entities","cms_routes"):
        new={r["id"] if name=="cms_entities" else r["path"]:r for r in after[name]}
        for row in before[name]:
            key=row["id"] if name=="cms_entities" else row["path"]
            if (name=="cms_entities" and key in allowed) or (name=="cms_routes" and key in expected):continue
            if new.get(key)!=row:fail("seo_alias_unrelated_rows_changed")
    upgrade.immutable_preserved(before,after)
    if source_snapshot(base)!=source or base.assets_manifest()!=assets:fail("seo_alias_source_or_assets_changed")
    receipt={"outcome":"seo_inherited_aliases_repaired","result":result,"replay":replay,"unrelatedRowsPreserved":True,"originalRevisionsPreserved":True}
    base.save(root / "source-alias-repair.receipt.json",receipt);verify_frozen(base,upgrade,root,recovery);return receipt


def main():
    if os.geteuid() != 0 or len(sys.argv) < 2: fail("seo_arguments")
    base, upgrade = helpers(); helper = base.retained(); base.verify_database(helper)
    operation = sys.argv[1]
    if operation == "inventory" and len(sys.argv) == 2: print(json.dumps(inventory(base, upgrade, helper))); return
    if len(sys.argv) < 3 or not re.fullmatch(r"[a-f0-9]{40}", sys.argv[2]): fail("seo_commit")
    commit = sys.argv[2]; root = pathlib.Path("/opt/savinggrace-seo-upgrade") / commit; incoming = pathlib.Path("/home/ec2-user/.seo-upgrade-transfer") / commit
    if operation == "prepare" and len(sys.argv) == 8:
        if not all(re.fullmatch(r"[a-f0-9]{64}", value) for value in sys.argv[3:]): fail("seo_hash")
        print(json.dumps(prepare(base, upgrade, helper, root, incoming, commit, *sys.argv[3:]))); return
    if len(sys.argv) != 3: fail("seo_operation_arguments")
    recovery = base.load(root / "seo-recovery.json")
    if recovery.get("version") != 2 or recovery.get("commit") != commit: fail("seo_recovery_binding")
    verify_frozen(base, upgrade, root, recovery); active_phases(base, helper, root, recovery)
    if operation in ("bridge-canary", "canary"):
        if operation == "canary" and int(base.sql("SELECT count(*) FROM schema_migrations").decode().strip()) != 28: fail("seo_candidate_schema_required")
        canaries(base, upgrade, helper, root, recovery, "bridge" if operation == "bridge-canary" else "candidate")
    elif operation in ("activate-bridge", "rollback", "activate", "reactivate"): switch(base, upgrade, helper, root, recovery, "bridge" if operation in ("activate-bridge", "rollback") else "candidate")
    elif operation == "migrate": print(json.dumps(migrate(base, upgrade, helper, root, recovery)))
    elif operation == "adopt-cms": print(json.dumps(adopt_cms(base, upgrade, helper, root, recovery)))
    elif operation == "repair-aliases": print(json.dumps(repair_aliases(base, upgrade, helper, root, recovery)))
    elif operation == "verify":
        current = inventory(base, upgrade, helper)
        if any(not runtime["healthy"] or not runtime["readonlyRoot"] or not runtime["capabilitiesDropped"] for runtime in current["runtimes"].values()): fail("seo_runtime_not_ready")
        print(json.dumps(current))
    else: fail("seo_operation_refused")
    verify_frozen(base, upgrade, root, recovery)
    print(json.dumps({"outcome": "seo_" + operation.replace("-", "_"), "commit": commit, "historyPreserved": True, "credentialsRetained": True}))


if __name__ == "__main__":
    try: main()
    except Exception as error:
        code = str(error) if re.fullmatch(r"(?:cms|seo)_[a-z_]+", str(error)) else "seo_operation_refused"
        print(json.dumps({"outcome": "stopped_safely", "code": code})); sys.exit(1)
