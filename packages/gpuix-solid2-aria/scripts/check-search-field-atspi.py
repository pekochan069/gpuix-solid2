"""Inspect fixtures/search-field-native.ts through Linux AT-SPI (python3-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX SearchField native verification"


def walk(name, path, nodes, include=False):
    node = bus.get_object(name, path, introspect=False)
    props = node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)
    include = include or str(props["Name"]) == title
    if include:
        nodes[str(props["Name"])] = node
    for child in node.GetChildren(dbus_interface=interface, timeout=3):
        walk(*child, nodes, include=include)


def snapshot():
    nodes = {}
    for application in registry.GetChildren(dbus_interface=interface, timeout=3):
        walk(*application, nodes)
    return nodes


def description(node):
    return str(node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)["Description"])


def click(node):
    assert node.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
    time.sleep(0.25)


nodes = snapshot()
assert title in nodes, "Start test:native:search-field with GPUIX_ARIA_INSPECT=1"
search = nodes["Search documents"]
clear = nodes["Clear search"]
disabled = nodes["Disabled search"]
readonly = nodes["Readonly search"]
assert int(clear.GetRole(dbus_interface=interface)) == 43  # ATSPI_ROLE_PUSH_BUTTON
assert description(search) == "Query: OS query"
click(clear)
assert description(search) == "Query: ", "OS Click must update controlled search state"
click(nodes["Clear disabled search"])
click(nodes["Clear readonly search"])
names = ["Search documents", "Clear search", "Disabled search", "Clear disabled search", "Readonly search", "Clear readonly search"]
report = {
    "platform": "Linux WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in names},
    "os_click_clears_controlled_search": True,
    "search_description_tracks_value": True,
    "disabled_clear_reported_enabled": bool(int(nodes["Clear disabled search"].GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "readonly_clear_reported_enabled": bool(int(nodes["Clear readonly search"].GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "disabled_editor_states": list(map(int, disabled.GetState(dbus_interface=interface))),
    "readonly_editor_states": list(map(int, readonly.GetState(dbus_interface=interface))),
    "search_relationships": list(search.GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
