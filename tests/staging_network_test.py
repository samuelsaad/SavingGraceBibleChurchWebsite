"""Anonymized network/proxy contract tests; no Docker, network or DB access."""
import copy
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("staging_restore", ROOT / "deployment/restore.py")
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)


class SealedNetwork(unittest.TestCase):
    def test_inspection_includes_maintenance_without_starting_it(self):
        with patch.object(restore, "run", return_value=b'{"services": {}}') as command:
            self.assertEqual(restore.read_compose_config(["docker", "compose"]), {"services": {}})
            command.assert_called_once_with(["docker", "compose", "--profile", "maintenance", "config", "--format", "json"])

    def setUp(self):
        self.config = {
            "services": {
                "app": {"networks": {"private": {"ipv4_address": "192.168.250.10"}}},
                "db": {"networks": {"private": {}}},
                "maintenance": {"networks": {"private": {}}},
            },
            "networks": {"private": {"internal": True, "ipam": {"config": [{"subnet": "192.168.250.0/24"}]}}},
        }
        self.socket = (ROOT / "deployment/savinggrace-staging.socket").read_text()
        self.service = (ROOT / "deployment/savinggrace-staging.service").read_text().replace("@APP_PRIVATE_ADDRESS@", "192.168.250.10")

    def verify(self, config=None, socket=None, service=None):
        restore.verify_network(config or self.config, socket or self.socket, service or self.service, ROOT)

    def test_valid_internal_network_loopback_proxy(self):
        self.verify()

    def test_no_container_host_ports(self):
        for name in ("app", "db"):
            config = copy.deepcopy(self.config)
            config["services"][name]["ports"] = [{"host_ip": "127.0.0.1", "published": "8080"}]
            with self.assertRaises(RuntimeError):
                self.verify(config)

    def test_no_external_network(self):
        for name in ("app", "db", "maintenance"):
            config = copy.deepcopy(self.config)
            config["services"][name]["networks"]["external"] = {}
            with self.assertRaises(RuntimeError):
                self.verify(config)
        config = copy.deepcopy(self.config)
        config["networks"]["private"]["internal"] = False
        with self.assertRaises(RuntimeError):
            self.verify(config)

    def test_only_verified_internal_target(self):
        for address in ("8.8.8.8", "127.0.0.1", "192.168.251.10"):
            config = copy.deepcopy(self.config)
            config["services"]["app"]["networks"]["private"]["ipv4_address"] = address
            with self.assertRaises(RuntimeError):
                self.verify(config)

    def test_proxy_cannot_bind_publicly_or_add_listener(self):
        for text in (self.socket.replace("127.0.0.1", "0.0.0.0"), self.socket + "ListenStream=443\n"):
            with self.assertRaises(RuntimeError):
                self.verify(socket=text)

    def test_proxy_target_and_hardening_are_exact(self):
        for text in (self.service.replace("192.168.250.10", "192.168.250.11"), self.service.replace("DynamicUser=yes", "User=root")):
            with self.assertRaises(RuntimeError):
                self.verify(service=text)


if __name__ == "__main__":
    unittest.main()
