"""Guarded empty-target restore. Never drops a database or deletes a volume.

Run from the exact release directory as root, with absolute --environment,
--dump and --snapshot paths outside that directory. All output is sanitized.
"""
import argparse
import hashlib
import ipaddress
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


def read_compose_config(compose):
    # Compose omits inactive profiles from config; inspect maintenance as well.
    # This affects inspection only, not which services `up` starts.
    return json.loads(run(compose + ["--profile", "maintenance", "config", "--format", "json"]))


def verify_network(config, socket_text, service_text, release):
    if config["services"]["db"].get("ports"):
        raise RuntimeError("database_port_exposure_refused")
    if not config["networks"]["private"].get("internal"):
        raise RuntimeError("nonprivate_network_refused")
    for name in ("app", "db", "maintenance"):
        if set(config["services"][name]["networks"]) != {"private"}:
            raise RuntimeError("nonprivate_network_refused")
    if config["services"]["app"].get("ports"):
        raise RuntimeError("application_port_exposure_refused")
    address = ipaddress.IPv4Address(config["services"]["app"]["networks"]["private"]["ipv4_address"])
    subnet = ipaddress.IPv4Network(config["networks"]["private"]["ipam"]["config"][0]["subnet"])
    if not address.is_private or address.is_loopback or address not in subnet:
        raise RuntimeError("application_port_exposure_refused")
    expected_socket = (release / "deployment/savinggrace-staging.socket").read_text()
    expected_service = (release / "deployment/savinggrace-staging.service").read_text().replace("@APP_PRIVATE_ADDRESS@", str(address))
    if socket_text != expected_socket or service_text != expected_service:
        raise RuntimeError("loopback_proxy_configuration_refused")


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
    config = read_compose_config(compose)
    units = [pathlib.Path("/etc/systemd/system/savinggrace-staging." + suffix) for suffix in ("socket", "service")]
    for unit in units:
        if unit.is_symlink() or not unit.is_file() or unit.stat().st_uid != 0 or stat.S_IMODE(unit.stat().st_mode) & 0o022:
            raise RuntimeError("loopback_proxy_configuration_refused")
    verify_network(config, *(unit.read_text() for unit in units), release)
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
            "atomic_restore_failed", "restore_fingerprint_mismatch", "loopback_proxy_configuration_refused"}:
            known = "guarded_restore_failed"
        print(json.dumps({"status": "failed", "code": known}), file=sys.stderr)
        sys.exit(1)
