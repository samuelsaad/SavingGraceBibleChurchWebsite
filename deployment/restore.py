"""Guarded empty-target restore. Never drops a database or deletes a volume.

Run from the exact release directory as root, with absolute --environment,
--dump and --snapshot paths outside that directory. All output is sanitized.
"""
import argparse
import hashlib
import json
import os
import pathlib
import stat
import subprocess
import sys


def run(command, *, data=None):
    result = subprocess.run(command, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError("guarded_restore_command_failed")
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    for name in ("environment", "dump", "snapshot"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    release = pathlib.Path.cwd().resolve()
    inputs = [pathlib.Path(getattr(args, name)) for name in ("environment", "dump", "snapshot")]
    for path in inputs:
        if not path.is_absolute() or path.is_symlink() or not path.is_file() or path.resolve().is_relative_to(release):
            raise RuntimeError("restore_private_path_refused")
        if stat.S_IMODE(path.stat().st_mode) & 0o077:
            raise RuntimeError("restore_private_permissions_refused")
    environment, dump, snapshot = inputs
    expected = json.loads(snapshot.read_text())
    digest = hashlib.sha256()
    with dump.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != expected["dumpSha256"]:
        raise RuntimeError("restore_dump_hash_mismatch")
    compose = ["docker", "compose", "--env-file", str(environment), "-f", "deployment/compose.yaml"]
    config = json.loads(run(compose + ["config", "--format", "json"]))
    if config["services"]["db"].get("ports"):
        raise RuntimeError("database_port_exposure_refused")
    if not config["networks"]["private"].get("internal"):
        raise RuntimeError("nonprivate_network_refused")
    ports = config["services"]["app"].get("ports", [])
    if len(ports) != 1 or ports[0].get("host_ip") != "127.0.0.1" or str(ports[0].get("published")) != "8080":
        raise RuntimeError("application_port_exposure_refused")
    running = run(compose + ["ps", "--status", "running", "--services"]).decode().splitlines()
    if "app" in running:
        raise RuntimeError("stop_candidate_before_restore")
    run(compose + ["run", "--rm", "--no-deps", "maintenance", "assert-empty"])
    # The dump is streamed over stdin, not copied into an image or DB data directory.
    with dump.open("rb") as stream:
        restored = subprocess.run(compose + ["exec", "-T", "db", "pg_restore", "--username=postgres",
            "--dbname=savinggrace_staging", "--single-transaction", "--exit-on-error", "--no-owner", "--no-acl"],
            stdin=stream, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if restored.returncode:
        raise RuntimeError("atomic_restore_failed")
    verification = json.loads(run(compose + ["run", "--rm", "--no-deps", "maintenance", "verify"]))
    if verification["sha256"] != expected["sha256"]:
        raise RuntimeError("restore_fingerprint_mismatch")
    print(json.dumps({"status": "restored_and_verified", "sha256": verification["sha256"],
        "dumpSha256": digest.hexdigest(), "counts": verification["counts"], "migrations": verification["migrations"], "pending": verification["pending"]}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        known = str(error)
        if known not in {"guarded_restore_command_failed", "restore_private_path_refused",
            "restore_private_permissions_refused", "restore_dump_hash_mismatch", "database_port_exposure_refused",
            "nonprivate_network_refused", "application_port_exposure_refused", "stop_candidate_before_restore",
            "atomic_restore_failed", "restore_fingerprint_mismatch"}:
            known = "guarded_restore_failed"
        print(json.dumps({"status": "failed", "code": known}), file=sys.stderr)
        sys.exit(1)
