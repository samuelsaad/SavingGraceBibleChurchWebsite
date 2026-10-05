"""D-171 operator: fixed existing staging containers, append-only completed store.

Run as root on the already verified staging host. No credential values or row
bodies are emitted. Preparation preserves the previous app configurations and
an independently hashed logical backup. Application rollback selects the old
public app/database pair; it never erases imported review history.
"""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tarfile
import time
import urllib.request

PUBLIC = "savinggrace-staging-app-1"
PROTECTED = "savinggrace-d167-protected-app-1"
DB = "savinggrace-d167-protected-db-1"
OLD_IMAGE = "sha256:d2196335e1573d3258e8018af2ac52f7bcc22b609d4bf7e29449a1c47b264c5e"
MEMBERS = "4e3455c92d604f4e44999e56922e15359dc7bfa8a6d912c6d36e2a39a9f048c3"
def fail(code):
    raise RuntimeError(code)
def run(args, output=None):
    p = subprocess.run(args, stdout=output or subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        fail("command_failed_" + pathlib.Path(args[0]).name)
    return p.stdout
def inspect(name):
    return json.loads(run(["docker", "inspect", name]))[0]
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def database_hash(container):
    names = run(["docker","exec",container,"psql","-U","postgres","-d","savinggrace_staging","-At","-c","SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"]).decode().splitlines()
    if any(not re.fullmatch(r"[a-z_][a-z0-9_]*", n) for n in names):
        fail("table_name_refused")
    sql = "SET timezone='UTC';" + "".join("SELECT '%s',count(*),encode(digest(COALESCE(string_agg(h,'' ORDER BY h COLLATE \"C\"),''),'sha256'),'hex') FROM (SELECT encode(digest(to_jsonb(t)::text,'sha256'),'hex') h FROM \"%s\" t) hashes;" % (n,n) for n in names)
    return hashlib.sha256(run(["docker","exec",container,"psql","-U","postgres","-d","savinggrace_staging","-At","-c",sql])).hexdigest()
def save(path, obj):
    with path.open("x", encoding="utf-8") as f:
        json.dump(obj, f, sort_keys=True)
    path.chmod(0o600)
def ready(port, commit):
    for _ in range(30):
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/health/ready" % port, timeout=10) as r:
                body = json.loads(r.read())
                if commit in json.dumps(body):
                    return
        except Exception:
            pass
        time.sleep(2)
    fail("readiness_failed")
def compose(config):
    run(["docker", "compose", "-f", str(config), "up", "-d", "--no-deps", "app"])
def main():
    if os.geteuid() != 0 or len(sys.argv) < 3:
        fail("operator_arguments_refused")
    operation, commit = sys.argv[1:3]
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        fail("commit_refused")
    root = pathlib.Path("/opt/savinggrace-d171") / commit
    incoming = pathlib.Path("/home/ec2-user/.d171-transfer") / commit
    if operation == "prepare":
        if root.exists() or len(sys.argv) != 6:
            fail("existing_release_or_hash_arguments")
        for name, expected in zip(["release.tar", "001-source.private.json", "002-cohort.private.json"], sys.argv[3:]):
            p = incoming / name
            if p.is_symlink() or not p.is_file() or sha(p) != expected:
                fail("transfer_hash_mismatch")
        source = json.loads((incoming / "001-source.private.json").read_text())
        cohort = json.loads((incoming / "002-cohort.private.json").read_text())
        if source["membershipSha256"] != MEMBERS or source["ids"] != cohort["ids"]:
            fail("cohort_mismatch")
        public, protected, db = inspect(PUBLIC), inspect(PROTECTED), inspect(DB)
        if public["Image"] != OLD_IMAGE or protected["Image"] != OLD_IMAGE:
            fail("unexpected_running_image")
        if db["HostConfig"]["PortBindings"]:
            fail("database_port_exposed")
        network = list(db["NetworkSettings"]["Networks"])
        if network != ["savinggrace-d167-protected_private"]:
            fail("database_network_refused")
        if not json.loads(run(["docker", "network", "inspect", network[0]]))[0]["Internal"]:
            fail("database_network_not_private")
        configs = {}
        for name, info in [("public", public), ("protected", protected)]:
            old = pathlib.Path(info["Config"]["Labels"]["com.docker.compose.project.config_files"])
            configs[name] = json.loads(old.read_text())
            if set(configs[name]["services"]) != {"app"}:
                fail("configuration_scope_refused")
        root.mkdir(mode=0o700, parents=True)
        for name in ["release.tar", "001-source.private.json", "002-cohort.private.json"]:
            dest = root / name
            with dest.open("xb") as f:
                f.write((incoming / name).read_bytes())
            dest.chmod(0o600)
        # Reader can read only the explicit cohort mount; no private packet mount.
        (root / "002-cohort.private.json").chmod(0o644)
        for name, config in configs.items():
            save(root / (name + "-previous.json"), config)
        backup = root / "protected-before.dump"
        protected_before = database_hash(DB)
        with backup.open("xb") as f:
            run(["docker", "exec", DB, "pg_dump", "-U", "postgres", "-d", "savinggrace_staging", "--format=custom", "--no-owner", "--no-acl"], f)
        backup.chmod(0o600)
        with backup.open("rb") as f:
            check=subprocess.run(["docker","exec","-i",DB,"pg_restore","--list"],stdin=f,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            if check.returncode or b"TABLE DATA" not in check.stdout:
                fail("backup_verification_failed")
        if database_hash(DB) != protected_before:
            fail("concurrent_staging_change")
        source_dir = root / "release"
        source_dir.mkdir(mode=0o700)
        with tarfile.open(root / "release.tar") as archive:
            for item in archive.getmembers():
                p = pathlib.PurePosixPath(item.name)
                if p.is_absolute() or ".." in p.parts or not (item.isfile() or item.isdir()):
                    fail("unsafe_archive_member")
                if any(x in p.parts for x in ["private", "development-data", ".git", "youtube-oath"]):
                    fail("private_archive_member")
            archive.extractall(source_dir)
        # Use an already cached immutable Node 24 official base, not a floating tag.
        images = json.loads(run(["docker", "image", "inspect", "node:24-bookworm-slim"]))
        digests = [d for d in images[0]["RepoDigests"] if d.startswith("node@sha256:")]
        if len(digests) != 1:
            fail("immutable_node_base_unavailable")
        image = "savinggrace-impeccable:" + commit
        with (root / "build.log").open("xb") as log:
            run(["docker", "build", "--build-arg", "NODE_IMAGE="+digests[0], "--build-arg", "RELEASE_COMMIT="+commit, "-t", image, str(source_dir)], log)
        output = root / "output"
        output.mkdir(mode=0o700)
        # Maintenance runs as root, but the visitor container remains node/read-only.
        maintenance = {"name":"savinggrace-d171-maintenance", "services":{"maintenance":{
            "image":image,"user":"0:0","entrypoint":["node","completed-sync.cjs"],"read_only":True,
            "environment":{"NODE_ENV":"production","STAGING_SEALED":"1","DB_HOST":"db","DB_PORT":"5432","DB_NAME":"savinggrace_staging","RELEASE_COMMIT":commit,"ALLOW_STAGING_D171_SYNC":"1","D171_TARGET":"existing-protected"},
            "secrets":["db_owner_password"],"networks":["completed"],"cap_drop":["ALL"],"security_opt":["no-new-privileges:true"],
            "volumes":[str(root / "001-source.private.json")+":/verification/001-source.private.json:ro",str(output)+":/verification/output:rw"]}},
            "networks":{"completed":{"external":True,"name":network[0]}},"secrets":{"db_owner_password":configs["protected"]["secrets"]["db_owner_password"]}}
        save(root / "maintenance.json", maintenance)
        for name, original in configs.items():
            candidate = json.loads(json.dumps(original))
            app = candidate["services"]["app"]
            app["image"] = image
            app["environment"].update({"RELEASE_COMMIT":commit,"D171_COMPLETED_ENABLED":"1","D171_COHORT_FILE":"/verification/002-cohort.private.json"})
            app.setdefault("volumes",[]).append(str(root / "002-cohort.private.json")+":/verification/002-cohort.private.json:ro")
            if name == "public":
                candidate["networks"]["completed"] = {"external":True,"name":network[0]}
                app["networks"]["completed"] = {}
                address = db["NetworkSettings"]["Networks"][network[0]]["IPAddress"]
                app["extra_hosts"] = {"db":address}
                candidate["secrets"]["db_reader_password"] = configs["protected"]["secrets"]["db_reader_password"]
            save(root / (name + "-candidate.json"), candidate)
        save(root / "recovery.json", {"commit":commit,"previousImage":OLD_IMAGE,"backupSha256":sha(backup),"protectedBeforeHash":protected_before,"originalPublicHash":database_hash('savinggrace-staging-db-1'),"sourceFileSha256":sha(root/"001-source.private.json"),"releaseSha256":sha(root/"release.tar"),"membershipSha256":MEMBERS,"newImage":inspect(image)["Id"]})
        print(json.dumps({"outcome":"prepared","backupSha256":sha(backup),"image":inspect(image)["Id"],"writesToDatabase":False}))
    elif operation in ["baseline", "upgrade", "plan", "import", "verify"]:
        # Exact files/configuration created by prepare only; no arbitrary command.
        output = run(["docker","compose","-f",str(root/"maintenance.json"),"run","--rm","--no-deps","maintenance",operation])
        # The maintenance process emits only allowlisted aggregate JSON.
        for line in output.decode().splitlines():
            value=json.loads(line)
            if not isinstance(value,dict) or 'outcome' not in value:
                fail("maintenance_output_refused")
            print(json.dumps(value))
    elif operation in ["activate", "rollback-public", "reactivate-public"]:
        recovery=json.loads((root/"recovery.json").read_text())
        if database_hash('savinggrace-staging-db-1') != recovery['originalPublicHash']:
            fail("original_public_database_changed")
        if operation == "activate":
            compose(root/"protected-candidate.json");ready(8082,commit)
            compose(root/"public-candidate.json");ready(8080,commit)
        elif operation == "rollback-public":
            prior=json.loads((root/"public-previous.json").read_text())
            compose(root/"public-previous.json");ready(8080,prior['services']['app']['environment']['RELEASE_COMMIT'])
        else:
            compose(root/"public-candidate.json");ready(8080,commit)
        print(json.dumps({"outcome":operation,"healthy":True}))
    else:
        fail("operation_refused")
if __name__ == "__main__":
    try:
        os.umask(0o077)
        main()
    except Exception as e:
        code = str(e) if isinstance(e,RuntimeError) and re.fullmatch(r"[a-z_]+",str(e)) else "operator_failed_safely"
        print(json.dumps({"outcome":"stopped_safely","code":code}))
        sys.exit(1)
