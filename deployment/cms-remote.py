"""D-179 operator for the two existing staging applications. No new listener.
Invoke only over the established pinned SSH connection. Output is aggregate only.
"""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import secrets
import shutil
import subprocess
import sys
import tarfile

PUBLIC = "savinggrace-staging-app-1"
PROTECTED = "savinggrace-d167-protected-app-1"
DB = "savinggrace-d167-protected-db-1"
NETWORK = "savinggrace-d167-protected_private"
ASSETS = pathlib.Path("/var/lib/savinggrace-cms-assets")
HELPER_COMMIT = "c919ae038d0bbcefff31eb10e3013d61cc27ca82"
HELPER_SHA = "43dd96fc79b98944f5aed7089c5e520e5c4c025c3522a985d359dd8162b00b14"
PREVIOUS_COMMIT = "e17b5f487eca77bb1e8496be91e0382aca746b47"
PREVIOUS_IMAGE = "sha256:5d80b6959ab5c2adab3db31b58f70317bb4a62e513ac44cd504ce128c9e2f381"
CMS_TABLES = ("cms_entities", "cms_revisions", "cms_routes")


def fail(code):
    raise RuntimeError(code)


def run(args, data=None, output=None, timeout=180):
    result = subprocess.run(args, input=data, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        fail("cms_command_failed")
    return result.stdout


def checked(path):
    if path.is_symlink() or not path.is_file():
        fail("cms_file_refused")
    return path


def sha(path):
    return hashlib.sha256(checked(path).read_bytes()).hexdigest()


def load(path):
    return json.loads(checked(path).read_text())


def save(path, value):
    with path.open("x", encoding="utf8") as stream:
        json.dump(value, stream, sort_keys=True)
    path.chmod(0o600)


def retained():
    path = pathlib.Path("/home/ec2-user/.d175-transfer") / HELPER_COMMIT / "operator.py"
    if sha(path) != HELPER_SHA:
        fail("cms_retained_verifier_changed")
    spec = importlib.util.spec_from_file_location("retained_d175_verifier", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.verify_host()
    return module


def sql(statement):
    command = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='30s';" + statement + ";COMMIT;"
    return run(["docker", "exec", DB, "psql", "-X", "-qAt", "-U", "postgres", "-d", "savinggrace_staging", "-v", "ON_ERROR_STOP=1", "-c", command])


def verify_database(helper):
    info = helper.inspect(DB)
    if info["HostConfig"]["PortBindings"] or sorted(info["NetworkSettings"]["Networks"]) != [NETWORK]:
        fail("cms_database_network_changed")
    if not json.loads(run(["docker", "network", "inspect", NETWORK]))[0]["Internal"]:
        fail("cms_database_not_private")
    identity = json.loads(sql("SELECT json_build_object('name',current_database(),'version',current_setting('server_version_num')::int)"))
    if identity["name"] != "savinggrace_staging" or not 160000 <= identity["version"] < 170000:
        fail("cms_database_identity_changed")


def configuration(helper, container):
    info = helper.inspect(container)
    path = pathlib.Path(info["Config"]["Labels"]["com.docker.compose.project.config_files"])
    value = load(path)
    if set(value["services"]) != {"app"}:
        fail("cms_application_configuration_scope")
    app = value["services"]["app"]
    # D-166 already exposes the visitor port. Freeze, never add or widen it.
    bindings = info["HostConfig"].get("PortBindings") or {}
    for values in bindings.values():
        for binding in values or []:
            if container == PROTECTED and binding.get("HostIp") not in ("127.0.0.1", "::1"):
                fail("cms_protected_binding_not_loopback")
            if binding.get("HostPort") != ("8080" if container == PUBLIC else "8082"):
                fail("cms_incumbent_port_unexpected")
    attached = sorted(info["NetworkSettings"]["Networks"])
    if NETWORK not in attached or (container == PROTECTED and attached != [NETWORK]):
        fail("cms_application_network_changed")
    return info, path, value


def inventory(helper):
    runtimes = {}
    for name, container in (("public", PUBLIC), ("protected", PROTECTED)):
        info, path, value = configuration(helper, container)
        runtimes[name] = {"release": value["services"]["app"]["environment"]["RELEASE_COMMIT"],
                          "image": info["Image"], "configurationSha256": sha(path),
                          "healthy": info["State"].get("Health", {}).get("Status") == "healthy",
                          "readonlyRoot": info["HostConfig"]["ReadonlyRootfs"],
                          "networkCount": len(info["NetworkSettings"]["Networks"]),
                          "networkNamesSha256": hashlib.sha256(json.dumps(sorted(info["NetworkSettings"]["Networks"])).encode()).hexdigest(),
                          "capabilitiesDropped": info["HostConfig"].get("CapDrop") == ["ALL"],
                          "semanticVisitorEnabled": value["services"]["app"]["environment"].get("RELATED_THEMES_VISITOR_ENABLED") == "1",
                          "publishedPorts": [{"port": int(binding["HostPort"]), "scope": "loopback" if binding.get("HostIp") in ("127.0.0.1", "::1") else "existing-public"} for values in (info["HostConfig"].get("PortBindings") or {}).values() for binding in values or []]}
    counts = json.loads(sql("SELECT json_build_object('ledger',(SELECT count(*) FROM schema_migrations),'sermons',(SELECT count(*) FROM sermons),'publishedSermons',(SELECT count(*) FROM sermons WHERE status='published'))"))
    return {"outcome": "cms_readonly_inventory", "runtimes": runtimes, "counts": counts, "storage": {"availableBytes": shutil.disk_usage("/var/lib").free, "cmsDirectoryExists": ASSETS.exists()}}


def preservation():
    names = sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").decode().splitlines()
    results = []
    for name in names:
        if name in CMS_TABLES:
            continue
        if not re.fullmatch(r"[a-z_][a-z0-9_]*", name):
            fail("cms_table_identifier_refused")
        where = (" WHERE storage_provider NOT IN ('cms_local','cms_embedded')" if name == "media_assets" else
                 " WHERE entity_type NOT IN ('cms_entity','cms_asset')" if name == "audit_events" else
                 " WHERE migration_order<=26" if name == "schema_migrations" else "")
        result = sql("SELECT count(*),encode(digest(COALESCE(string_agg(h,'' ORDER BY h COLLATE \"C\"),''),'sha256'),'hex') FROM (SELECT encode(digest(to_jsonb(t)::text,'sha256'),'hex') h FROM \"" + name + "\" t" + where + ") hashes").decode().strip()
        results.append([name, result])
    sequence = sql("SELECT COALESCE(json_agg(t ORDER BY sequencename),'[]'::json) FROM (SELECT sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text,last_value::text FROM pg_sequences WHERE schemaname='public' AND sequencename NOT LIKE 'cms_%') t")
    return hashlib.sha256(json.dumps(results, sort_keys=True).encode() + sequence).hexdigest()


def safe_archive(archive):
    for item in archive.getmembers():
        path = pathlib.PurePosixPath(item.name)
        if path.is_absolute() or ".." in path.parts or not (item.isfile() or item.isdir()):
            fail("cms_archive_path_refused")
        if any(part in {"private", "development-data", ".git", "node_modules"} for part in path.parts) or re.search(r"(?:\.private\.|\.(?:pem|key)$|(?:^|/)\.env)", item.name):
            fail("cms_archive_private_content_refused")


def assets_manifest():
    if not ASSETS.exists():
        return {}
    if ASSETS.is_symlink() or not ASSETS.is_dir():
        fail("cms_asset_root_refused")
    result = {}
    for path in ASSETS.iterdir():
        if not re.fullmatch(r"[a-f0-9]{64}\.(png|jpg|gif|webp|pdf)", path.name) or sha(path) != path.stem:
            fail("cms_asset_integrity_refused")
        result[path.name] = path.stat().st_size
    return result


def candidate(original, image, commit, root, runtime, enabled):
    result = copy.deepcopy(original)
    app = result["services"]["app"]
    app["image"] = image
    env = app["environment"]
    env.update({"RELEASE_COMMIT": commit, "CMS_SITE_ENABLED": "1" if enabled else "0"})
    if enabled:
        env["CMS_STORAGE_DIRECTORY"] = "/var/lib/savinggrace/cms-assets"
        mounts = app.setdefault("volumes", [])
        mounts.append({"type": "bind", "source": str(ASSETS), "target": env["CMS_STORAGE_DIRECTORY"], "read_only": runtime == "public"})
    if runtime == "protected" and enabled:
        env.update({"STAGING_CMS_ENABLED": "1", "CMS_ACCESS": "protected_tunnel", "CMS_ORIGIN": "http://127.0.0.1:4396"})
        for name in ("cms_writer_password", "cms_session_secret"):
            app.setdefault("secrets", []).append(name)
            result.setdefault("secrets", {})[name] = {"file": str(root / name)}
    else:
        for name in ("STAGING_CMS_ENABLED", "CMS_ACCESS", "CMS_ORIGIN"):
            env.pop(name, None)
    if app.get("ports") != original["services"]["app"].get("ports") or app.get("networks") != original["services"]["app"].get("networks"):
        fail("cms_network_difference_refused")
    return result


def canary(configuration, commit, runtime):
    value = copy.deepcopy(configuration)
    value["name"] = "cms-canary-" + commit[:10] + "-" + runtime
    app = value["services"]["app"]
    app.pop("container_name", None)
    app.pop("depends_on", None)
    app.pop("hostname", None)
    app.pop("ports", None)
    app["networks"] = {key: {} for key in app["networks"]}
    app["restart"] = "no"
    return value


def prepare(helper, root, incoming, commit, archive_hash, inventory_hash):
    if root.exists():
        fail("cms_release_exists")
    if sha(incoming / "release.tar") != archive_hash or sha(incoming / "inventory.private.json") != inventory_hash:
        fail("cms_transfer_hash_mismatch")
    expected = load(incoming / "inventory.private.json")
    actual = inventory(helper)
    if expected["runtimes"] != actual["runtimes"] or expected["counts"] != actual["counts"] or actual["counts"]["ledger"] != 26 or actual["storage"]["availableBytes"] < 2 * 1024**3:
        fail("cms_inventory_drift")
    for runtime in actual["runtimes"].values():
        if runtime["release"] != PREVIOUS_COMMIT or runtime["image"] != PREVIOUS_IMAGE or not runtime["healthy"]:
            fail("cms_incumbent_changed")
    root.mkdir(parents=True, mode=0o700)
    before = preservation()
    originals = {}
    for name, container in (("public", PUBLIC), ("protected", PROTECTED)):
        originals[name] = configuration(helper, container)[2]
        save(root / (name + "-previous.json"), originals[name])
    save(root / "uploads-before.private.json", assets_manifest())
    if ASSETS.exists():
        with tarfile.open(root / "uploads-before.tar", "x") as archive:
            for name in assets_manifest():
                archive.add(ASSETS / name, arcname=name, recursive=False)
        (root / "uploads-before.tar").chmod(0o600)
    existing = sql("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('cms_entities','cms_revisions','cms_routes')").decode().splitlines()
    recovery = {name: json.loads(sql("SELECT COALESCE(json_agg(to_jsonb(t)),'[]'::json) FROM \"" + name + "\" t")) for name in existing}
    recovery["media_assets"] = json.loads(sql("SELECT COALESCE(json_agg(to_jsonb(t)),'[]'::json) FROM media_assets t WHERE storage_provider IN ('cms_local','cms_embedded')"))
    recovery["audit_events"] = json.loads(sql("SELECT COALESCE(json_agg(to_jsonb(t)),'[]'::json) FROM audit_events t WHERE entity_type IN ('cms_entity','cms_asset')"))
    save(root / "cms-before.private.json", recovery)
    (root / "release.tar").write_bytes((incoming / "release.tar").read_bytes())
    (root / "release.tar").chmod(0o600)
    source = root / "release"; source.mkdir(mode=0o700)
    with tarfile.open(root / "release.tar") as archive:
        safe_archive(archive); archive.extractall(source)
    digests = [item for item in helper.inspect("node:24-bookworm-slim")["RepoDigests"] if item.startswith("node@sha256:")]
    if len(digests) != 1:
        fail("cms_immutable_base_required")
    image = "savinggrace-cms:" + commit
    with (root / "build.log").open("xb") as output:
        run(["docker", "build", "--pull=false", "--network=none", "--build-arg", "NODE_IMAGE=" + digests[0], "--build-arg", "RELEASE_COMMIT=" + commit, "-t", image, str(source)], output=output, timeout=900)
    for name in ("cms_writer_password", "cms_session_secret"):
        path = root / name
        with path.open("x") as stream:
            stream.write(secrets.token_hex(32))
        os.chown(path, 1000, 1000); path.chmod(0o400)
    if not ASSETS.exists():
        ASSETS.mkdir(mode=0o700); os.chown(ASSETS, 1000, 1000)
    for runtime, original in originals.items():
        for phase, enabled in (("bridge", False), ("candidate", True)):
            config = candidate(original, image, commit, root, runtime, enabled)
            save(root / (runtime + "-" + phase + ".json"), config)
            save(root / (runtime + "-" + phase + "-canary.json"), canary(config, commit, runtime))
    db = helper.inspect(DB)
    owner_mount = next((m for m in db["Mounts"] if m["Destination"] == "/run/secrets/db_owner_password"), None)
    if not owner_mount or owner_mount["RW"]:
        fail("cms_owner_mount_refused")
    maintenance = copy.deepcopy(originals["protected"])
    app = maintenance["services"]["app"]
    app["image"] = image; app["entrypoint"] = ["node", "cms-maintenance.cjs"]
    app["user"] = "0:0"; app["volumes"] = []
    maintenance["name"] = "savinggrace-cms-maintenance-" + commit[:12]
    app["networks"] = {key: {} for key in app["networks"]}
    app.pop("container_name", None); app.pop("healthcheck", None); app.pop("depends_on", None); app.pop("ports", None)
    app["secrets"] = ["db_owner_password"]
    maintenance["secrets"] = {"db_owner_password": {"file": owner_mount["Source"]}}
    app["environment"].update({"RELEASE_COMMIT": commit, "ALLOW_STAGING_CMS_SYNC": "1", "CMS_TARGET": "existing-protected"})
    save(root / "maintenance.json", maintenance)
    if preservation() != before:
        fail("cms_preservation_failed")
    bound = {path.name: sha(path) for path in root.iterdir() if path.suffix == ".json" or path.name == "uploads-before.tar"}
    save(root / "recovery.json", {"commit": commit, "before": before, "image": helper.inspect(image)["Id"], "previous": actual, "archiveSha256": archive_hash, "boundFiles": bound})
    return {"outcome": "cms_prepared", "commit": commit, "image": helper.inspect(image)["Id"], "unrelatedPreserved": True}


def grant_writer(root):
    # Credentials enter only psql stdin over the existing local container boundary.
    password = checked(root / "cms_writer_password").read_text().strip()
    if not re.fullmatch(r"[a-f0-9]{64}", password):
        fail("cms_writer_secret_refused")
    role_exists = sql("SELECT count(*) FROM pg_roles WHERE rolname='staging_cms_writer'").decode().strip()
    if role_exists != "0":
        fail("cms_writer_already_exists")
    command = "BEGIN; CREATE ROLE staging_cms_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '" + password + "'; GRANT CONNECT ON DATABASE savinggrace_staging TO staging_cms_writer; GRANT USAGE ON SCHEMA public TO staging_cms_writer; GRANT SELECT ON cms_entities,cms_revisions,cms_routes,media_assets TO staging_cms_writer; GRANT INSERT,UPDATE ON cms_entities,cms_routes TO staging_cms_writer; GRANT INSERT ON cms_revisions,media_assets,audit_events TO staging_cms_writer; GRANT SELECT ON cms_entities,cms_revisions,cms_routes TO staging_reader; COMMIT;"
    run(["docker", "exec", "-i", DB, "psql", "-X", "-q", "-U", "postgres", "-d", "savinggrace_staging", "-v", "ON_ERROR_STOP=1"], data=command.encode())
    save(root / "writer-created.receipt.json", {"outcome": "cms_writer_created"})


def verify_frozen(root, recovery):
    if any(sha(root / name) != digest for name, digest in recovery["boundFiles"].items()):
        fail("cms_frozen_configuration_changed")
    for name in load(root / "uploads-before.private.json"):
        if sha(ASSETS / name) != pathlib.Path(name).stem:
            fail("cms_prior_upload_changed")


def main():
    if os.geteuid() != 0 or len(sys.argv) < 2:
        fail("cms_operator_arguments_refused")
    operation = sys.argv[1]
    helper = retained(); verify_database(helper)
    if operation == "inventory":
        print(json.dumps(inventory(helper))); return
    if len(sys.argv) < 3 or not re.fullmatch(r"[a-f0-9]{40}", sys.argv[2]):
        fail("cms_commit_refused")
    commit = sys.argv[2]
    root = pathlib.Path("/opt/savinggrace-cms") / commit
    incoming = pathlib.Path("/home/ec2-user/.cms-transfer") / commit
    if operation == "prepare":
        if len(sys.argv) != 5:
            fail("cms_prepare_arguments_refused")
        print(json.dumps(prepare(helper, root, incoming, commit, sys.argv[3], sys.argv[4]))); return
    recovery = load(root / "recovery.json")
    verify_frozen(root, recovery)
    if recovery["commit"] != commit or sha(root / "release.tar") != recovery["archiveSha256"] or preservation() != recovery["before"]:
        fail("cms_recovery_or_preservation_changed")
    if operation in ("bridge-canary", "canary"):
        phase = "bridge" if operation == "bridge-canary" else "candidate"
        for runtime in ("public", "protected"):
            path = root / (runtime + "-" + phase + "-canary.json")
            try:
                run(["docker", "compose", "-f", str(path), "up", "-d", "--no-deps", "--wait", "--wait-timeout", "120", "app"])
            finally:
                run(["docker", "compose", "-f", str(path), "down", "--remove-orphans"])
        save(root / (operation + ".receipt.json"), {"outcome": operation})
    elif operation in ("activate-bridge", "activate", "rollback", "reactivate"):
        phase = "bridge" if operation in ("activate-bridge", "rollback") else "candidate"
        required = "bridge-canary.receipt.json" if phase == "bridge" else "canary.receipt.json"
        checked(root / required)
        for runtime, port in (("public", 8080), ("protected", 8082)):
            helper.compose(root / (runtime + "-" + phase + ".json")); helper.ready(port, commit)
    elif operation == "initialize":
        for container in (PUBLIC, PROTECTED):
            app = helper.inspect(container)
            if app["Image"] != recovery["image"]:
                fail("cms_bridge_not_active")
        output = run(["docker", "compose", "-f", str(root / "maintenance.json"), "run", "--rm", "--no-deps", "app", "initialize"])
        result = json.loads(output)
        if not (root / "writer-created.receipt.json").exists():
            grant_writer(root)
        print(json.dumps(result))
    elif operation == "verify":
        print(json.dumps(inventory(helper)))
    else:
        fail("cms_operator_command_refused")
    if preservation() != recovery["before"]:
        fail("cms_preservation_failed")
    print(json.dumps({"outcome": "cms_" + operation.replace("-", "_"), "commit": commit, "unrelatedPreserved": True}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = str(error) if re.fullmatch(r"cms_[a-z_]+", str(error)) else "cms_operation_refused"
        print(json.dumps({"outcome": "stopped_safely", "code": code}))
        sys.exit(1)
