"""Anonymized public-staging configuration checks. No network or database writes."""
import copy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("public_network", ROOT / "deployment/public_staging_network.py")
network = importlib.util.module_from_spec(spec)
spec.loader.exec_module(network)


class PublicStagingNetwork(unittest.TestCase):
    def setUp(self):
        self.before = {"name": "savinggrace-staging", "services": {
            "app": {"image": "sha256:" + "a" * 64, "environment": {"NODE_ENV": "production", "STAGING_SEALED": "1"}, "read_only": True, "cap_drop": ["ALL"], "networks": {"private": {"ipv4_address": "192.168.250.10"}}},
            "db": {"networks": {"private": {}}}, "maintenance": {"networks": {"private": {}}}},
            "networks": {"private": {"internal": True}}, "secrets": {"reader": {}}, "volumes": {"data": {}}}
        self.after = copy.deepcopy(self.before)
        app = self.after["services"]["app"]
        app["ports"] = [{"target": 8080, "published": "8080", "host_ip": "0.0.0.0", "protocol": "tcp"}]
        app["networks"]["frontend"] = {}
        app["labels"] = {"org.savinggrace.access-mode": "public-staging"}
        self.after["networks"]["frontend"] = {"driver": "bridge", "internal": False, "enable_ipv6": False, "driver_opts": {"com.docker.network.bridge.enable_ip_masquerade": "false"}}

    def verify(self, mode="public-staging"):
        return network.verify_public_config(self.after, self.before, mode)

    def test_exact_authorized_mode(self):
        self.assertEqual(self.verify()["mapping"], "0.0.0.0:8080:8080/tcp")
        for mode in (None, "sealed", "production"):
            with self.assertRaises(RuntimeError): self.verify(mode)

    def test_no_extra_ports_or_changed_target(self):
        original = copy.deepcopy(self.after)
        for change in ({"published": "4380"}, {"target": 80}, {"host_ip": "::"}, {"protocol": "udp"}):
            self.after = copy.deepcopy(original)
            self.after["services"]["app"]["ports"][0].update(change)
            with self.assertRaises(RuntimeError): self.verify()
        self.after = copy.deepcopy(original)
        self.after["services"]["app"]["ports"] *= 2
        with self.assertRaises(RuntimeError): self.verify()

    def test_database_and_storage_are_immutable(self):
        for name in ("db", "maintenance"):
            candidate = copy.deepcopy(self.after)
            candidate["services"][name]["ports"] = [{"published": "5432"}]
            with self.assertRaises(RuntimeError): network.verify_public_config(candidate, self.before, "public-staging")
        self.after["volumes"]["data"] = {"name": "replacement"}
        with self.assertRaises(RuntimeError): self.verify()

    def test_no_new_image_or_development_identity(self):
        original = copy.deepcopy(self.after)
        for change in ({"image": "sha256:" + "b" * 64}, {"read_only": False}, {"privileged": True}, {"cap_drop": []}, {"environment": {"NODE_ENV": "production", "STAGING_SEALED": "1", "ENABLE_LOCAL_TEST_IDENTITIES": "1"}}):
            self.after = copy.deepcopy(original)
            self.after["services"]["app"].update(change)
            with self.assertRaises(RuntimeError): self.verify()

    def test_private_network_cannot_be_exposed(self):
        self.after["networks"]["private"]["internal"] = False
        with self.assertRaises(RuntimeError): self.verify()

    def test_no_ipv6_or_masquerading(self):
        for change in ({"enable_ipv6": True}, {"driver_opts": {}}, {"external": True}):
            candidate = copy.deepcopy(self.after)
            candidate["networks"]["frontend"].update(change)
            with self.assertRaises(RuntimeError): network.verify_public_config(candidate, self.before, "public-staging")

    def test_runtime_environment_order_is_irrelevant_but_values_and_duplicates_are_not(self):
        ports = {"8080/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]}
        app = {"Image": "same-image", "Config": {"User": "node", "Env": ["NODE_ENV=production", "STAGING_SEALED=1"]},
               "HostConfig": {"PortBindings": ports, "ReadonlyRootfs": True, "CapDrop": ["ALL"]}, "Mounts": [],
               "State": {"Health": {"Status": "healthy"}}, "NetworkSettings": {"Ports": ports, "Networks": {
                   "savinggrace-staging_private": {"NetworkID": "private-id"}, "savinggrace-staging_frontend": {}}}}
        db = {"Id": "same-db", "State": {"StartedAt": "unchanged", "Health": {"Status": "healthy"}}, "Mounts": [],
              "HostConfig": {}, "NetworkSettings": {"Networks": {"savinggrace-staging_private": {}}}}
        original = copy.deepcopy(app)
        app["Config"]["Env"].reverse()
        network.verify_public_runtime(app, db, original, db, "private-id")
        app["Config"]["Env"][0] = "STAGING_SEALED=0"
        with self.assertRaises(RuntimeError): network.verify_public_runtime(app, db, original, db, "private-id")
        app["Config"]["Env"] = original["Config"]["Env"] + ["STAGING_SEALED=1"]
        with self.assertRaises(RuntimeError): network.verify_public_runtime(app, db, original, db, "private-id")


if __name__ == "__main__":
    unittest.main()
