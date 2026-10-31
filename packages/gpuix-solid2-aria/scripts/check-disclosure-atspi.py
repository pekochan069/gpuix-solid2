"""Inspect fixtures/disclosure-native.ts through Linux AT-SPI (python3-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX Disclosure native verification"


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


def is_expanded(node):
    return bool(int(node.GetState(dbus_interface=interface)[0]) & (1 << 10))


def description(node):
    return str(node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)["Description"])


def click(node):
    assert node.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
    time.sleep(0.25)


nodes = snapshot()
assert title in nodes, "Start test:native:disclosure with GPUIX_ARIA_INSPECT=1"
trigger = nodes["Details"]
disabled = nodes["Unavailable details"]
assert int(trigger.GetRole(dbus_interface=interface)) == 43  # ATSPI_ROLE_PUSH_BUTTON
assert not is_expanded(trigger)
assert description(trigger) == "Collapsed"
collapsed_states = list(map(int, trigger.GetState(dbus_interface=interface)))
assert "Detail panel" not in nodes
assert "Panel action" not in nodes
click(trigger)
nodes = snapshot()
assert description(trigger) == "Expanded", "OS Click must update controlled Solid state"
expanded_state_exposed = is_expanded(trigger)
expanded_states = list(map(int, trigger.GetState(dbus_interface=interface)))
assert "Detail panel" in nodes
assert "Panel action" in nodes
click(trigger)
nodes = snapshot()
assert not is_expanded(trigger)
assert description(trigger) == "Collapsed"
assert "Detail panel" not in nodes, "Collapsed panels must leave the OS tree"
assert "Panel action" not in nodes
click(disabled)
assert not is_expanded(disabled)
click(trigger)
nodes = snapshot()
assert description(trigger) == "Expanded"
assert "Panel action" in nodes

report = {
    "platform": "Linux WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in ["Details", "Detail panel", "Panel action", "Unavailable details"]},
    "os_click_updates_controlled_expansion": True,
    "expanded_state_exposed": expanded_state_exposed,
    "collapsed_native_states": collapsed_states,
    "expanded_native_states": expanded_states,
    "collapsed_panel_and_children_removed_from_os_tree": True,
    "disabled_click_preserves_collapsed_state": True,
    "disabled_reported_enabled": bool(int(disabled.GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "trigger_relationships": list(trigger.GetRelationSet(dbus_interface=interface)),
    "panel_relationships": list(nodes["Detail panel"].GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
