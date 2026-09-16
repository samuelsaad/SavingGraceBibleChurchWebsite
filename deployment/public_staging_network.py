"""Read-only network guards for the separately authorized public staging mode.

The sealed restore guard remains unchanged. This mode never restores or writes
data, enables administrator authentication, or builds a new application image.
"""
import copy
import re


def verify_public_config(config, original, mode):
    if mode != "public-staging":
        raise RuntimeError("explicit_public_staging_mode_required")
    services = config.get("services", {})
    if set(services) != {"app", "db", "maintenance"}:
        raise RuntimeError("unexpected_service_refused")
    if config.get("name") != original.get("name") or config.get("name") != "savinggrace-staging":
        raise RuntimeError("staging_project_mismatch")
    for name in ("db", "maintenance"):
        if services[name] != original["services"][name] or services[name].get("ports"):
            raise RuntimeError("private_service_change_refused")
        if set(services[name]["networks"]) != {"private"}:
            raise RuntimeError("private_service_network_refused")
    if config.get("secrets") != original.get("secrets") or config.get("volumes") != original.get("volumes"):
        raise RuntimeError("storage_or_secret_change_refused")
    networks = config["networks"]
    if set(networks) != {"private", "frontend"} or networks["private"] != original["networks"]["private"] or not networks["private"].get("internal"):
        raise RuntimeError("private_network_change_refused")
    front = networks["frontend"]
    if front.get("driver") != "bridge" or front.get("internal") or front.get("enable_ipv6") or front.get("external"):
        raise RuntimeError("frontend_network_refused")
    if str(front.get("driver_opts", {}).get("com.docker.network.bridge.enable_ip_masquerade")).lower() != "false":
        raise RuntimeError("frontend_masquerading_refused")
    app = services["app"]
    ports = app.get("ports", [])
    if len(ports) != 1 or ports[0].get("host_ip") != "0.0.0.0" or str(ports[0].get("published")) != "8080" or ports[0].get("target") != 8080 or ports[0].get("protocol") != "tcp":
        raise RuntimeError("public_port_mapping_refused")
    if set(app["networks"]) != {"private", "frontend"} or app["networks"]["private"] != original["services"]["app"]["networks"]["private"]:
        raise RuntimeError("application_network_change_refused")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", app.get("image", "")):
        raise RuntimeError("immutable_image_required")
    if not app.get("read_only") or app.get("privileged") or app.get("cap_drop") != ["ALL"]:
        raise RuntimeError("application_hardening_refused")
    env = app.get("environment", {})
    if env.get("NODE_ENV") != "production" or env.get("STAGING_SEALED") != "1" or any(env.get(k) for k in ("ENABLE_LOCAL_TEST_IDENTITIES", "ENABLE_LOCAL_DASHBOARD")):
        raise RuntimeError("private_authentication_guard_refused")
    wanted_labels = {**original["services"]["app"].get("labels", {}), "org.savinggrace.access-mode": "public-staging"}
    if app.get("labels") != wanted_labels:
        raise RuntimeError("access_mode_label_refused")
    before, after = copy.deepcopy(original["services"]["app"]), copy.deepcopy(app)
    for item in (before, after):
        for key in ("ports", "networks", "labels"):
            item.pop(key, None)
    if before != after:
        raise RuntimeError("application_change_beyond_network_refused")
    return {"mode": mode, "mapping": "0.0.0.0:8080:8080/tcp", "image": app["image"]}


def verify_public_runtime(app, database, original_app, original_database, private_network_id):
    if app["Image"] != original_app["Image"]:
        raise RuntimeError("deployed_image_change_refused")
    if database["Id"] != original_database["Id"] or database["State"]["StartedAt"] != original_database["State"]["StartedAt"] or database["Mounts"] != original_database["Mounts"]:
        raise RuntimeError("database_container_change_refused")
    if database["HostConfig"].get("PortBindings") or set(database["NetworkSettings"]["Networks"]) != {"savinggrace-staging_private"}:
        raise RuntimeError("database_exposure_refused")
    expected = {"8080/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]}
    if app["HostConfig"].get("PortBindings") != expected or app["NetworkSettings"].get("Ports") != expected:
        raise RuntimeError("runtime_port_mapping_refused")
    if app["Config"].get("User") != "node" or not app["HostConfig"].get("ReadonlyRootfs") or app["HostConfig"].get("Privileged") or app["HostConfig"].get("CapDrop") != ["ALL"] or app["Mounts"] != original_app["Mounts"]:
        raise RuntimeError("runtime_hardening_change_refused")
    # Compose may reorder its environment map when recreating the same service.
    # Values must still match exactly; ordering has no runtime meaning.
    def environment(container):
        values = container["Config"].get("Env", [])
        pairs = [value.split("=", 1) for value in values]
        if any(len(pair) != 2 for pair in pairs) or len({pair[0] for pair in pairs}) != len(pairs):
            raise RuntimeError("duplicate_or_invalid_environment_refused")
        return dict(pairs)
    if environment(app) != environment(original_app):
        raise RuntimeError("runtime_environment_change_refused")
    if app["HostConfig"].get("RestartPolicy") != original_app["HostConfig"].get("RestartPolicy"):
        raise RuntimeError("restart_policy_change_refused")
    if set(app["NetworkSettings"]["Networks"]) != {"savinggrace-staging_private", "savinggrace-staging_frontend"}:
        raise RuntimeError("runtime_networks_refused")
    if app["NetworkSettings"]["Networks"]["savinggrace-staging_private"]["NetworkID"] != private_network_id:
        raise RuntimeError("private_network_replacement_refused")
    if app["State"].get("Health", {}).get("Status") != "healthy" or database["State"].get("Health", {}).get("Status") != "healthy":
        raise RuntimeError("unhealthy_container_refused")
