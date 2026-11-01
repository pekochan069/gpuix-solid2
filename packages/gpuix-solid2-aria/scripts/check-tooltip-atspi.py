"""Inspect fixtures/tooltip-native.ts through Linux AT-SPI (python-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX Tooltip native verification"


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
assert title in nodes, "Start test:native:tooltip with both inspection flags set to 1"
assert "Save help" not in nodes
trigger = nodes["Save"]
assert description(trigger) == "Help open: false. Actions: 0"
# This fixture control opens state explicitly, so the audit can inspect content
# without relying on X11 keyboard simulation. Wayland verifies focus and hover.
click(nodes["Show Save help"])
opened = snapshot()
assert "Save help" in opened
tooltip = opened["Save help"]
tooltip_description = description(tooltip)
assert tooltip_description == "Keyboard focus or hover shows this description."
assert description(trigger) == "Help open: true. Actions: 0"
roles = {
    name: {
        "role": int(opened[name].GetRole(dbus_interface=interface)),
    }
    for name in ["Save", "Focus only", "Help disabled", "Save help"]
}
tooltip_states = list(map(int, tooltip.GetState(dbus_interface=interface)))
trigger_relationships = list(trigger.GetRelationSet(dbus_interface=interface))
tooltip_relationships = list(tooltip.GetRelationSet(dbus_interface=interface))
click(trigger)
assert "Save help" not in snapshot(), "OS Click must dismiss and unmount the tooltip"
assert description(trigger) == "Help open: false. Actions: 1"
click(nodes["Help disabled"])
assert "Help disabled help" not in snapshot()
assert description(nodes["Help disabled"]) == "Help open: false. Actions: 2"
click(nodes["Show Save help"])
assert "Save help" in snapshot()
assert description(trigger) == "Help open: true. Actions: 2"
report = {
    "platform": "Linux WSL2 WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": roles,
    "tooltip_description": tooltip_description,
    "tooltip_states": tooltip_states,
    "os_click_dismisses_and_unmounts": True,
    "os_click_preserves_trigger_action": True,
    "disabled_help_preserves_button_action": True,
    "fixture_control_reopens_content": True,
    "trigger_relationships": trigger_relationships,
    "tooltip_relationships": tooltip_relationships,
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
