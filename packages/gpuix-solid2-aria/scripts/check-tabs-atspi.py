"""Inspect fixtures/tabs-native.ts through Linux AT-SPI (python3-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX Tabs native verification"


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


def states(node):
    return list(map(int, node.GetState(dbus_interface=interface)))


nodes = snapshot()
assert title in nodes, "Start test:native:tabs with GPUIX_ARIA_INSPECT=1"
overview = nodes["Overview"]
settings = nodes["Settings"]
disabled = nodes["Unavailable"]
assert description(overview) == "Selected"
assert description(settings) == "Not selected"
assert "Overview panel" in nodes
assert "Settings panel" not in nodes
initial_states = states(settings)
click(settings)
nodes = snapshot()
assert description(settings) == "Selected", "OS Click must update controlled Solid selection"
assert description(overview) == "Not selected"
assert "Settings panel" in nodes
assert "Overview panel" not in nodes, "Inactive panels must leave the OS tree"
selected_states = states(settings)
click(disabled)
assert description(disabled) == "Not selected"
assert description(settings) == "Selected"
click(overview)
nodes = snapshot()
assert "Overview panel" in nodes
assert "Settings panel" not in nodes
click(settings)
nodes = snapshot()

report = {
    "platform": "Linux WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: {
        "role": int(nodes[name].GetRole(dbus_interface=interface)),
    } for name in ["Workspace tabs", "Overview", "Settings", "Unavailable", "Settings panel"]},
    "os_click_updates_controlled_selection": True,
    "inactive_panels_removed_from_os_tree": True,
    "disabled_click_preserves_selection": True,
    "unselected_native_states": initial_states,
    "selected_native_states": selected_states,
    "selected_state_exposed": bool(selected_states[0] & (1 << 23)),
    "disabled_reported_enabled": bool(states(disabled)[0] & (1 << 8)),
    "tab_relationships": list(settings.GetRelationSet(dbus_interface=interface)),
    "panel_relationships": list(nodes["Settings panel"].GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
