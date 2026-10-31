"""Inspect fixtures/toggle-button-group-native.ts through Linux AT-SPI (python3-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
nodes = {}


def walk(name, path, include=False):
    node = bus.get_object(name, path, introspect=False)
    props = node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)
    include = include or str(props["Name"]) == "GPUIX ToggleButtonGroup native verification"
    if include:
        nodes[str(props["Name"])] = node
    for child in node.GetChildren(dbus_interface=interface, timeout=3):
        walk(*child, include=include)


def props(node):
    return node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)


for application in registry.GetChildren(dbus_interface=interface, timeout=3):
    walk(*application)
assert "GPUIX ToggleButtonGroup native verification" in nodes, "Start test:native:toggle-button-group with GPUIX_ARIA_INSPECT=1"
right = nodes["Right"]
italic = nodes["Italic"]
unavailable = nodes["Unavailable"]
assert int(right.GetRole(dbus_interface=interface)) == 44  # ATSPI_ROLE_RADIO_BUTTON
assert int(italic.GetRole(dbus_interface=interface)) == 43  # ATSPI_ROLE_PUSH_BUTTON
assert str(props(right)["Description"]) == "Unselected"
assert str(props(italic)["Description"]) == "Unselected"
assert right.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert italic.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert unavailable.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
time.sleep(0.25)
assert str(props(right)["Description"]) == "Selected", "OS Click must update controlled Solid state"
assert str(props(italic)["Description"]) == "Selected", "OS Click must update multiple selection"
assert str(props(nodes["Alignment"])["Description"]) == "Selected Right", "Disabled OS Click must preserve selection"
assert str(props(nodes["Formatting"])["Description"]) == "Selected Bold, Italic"

names = ["Alignment", "Left", "Right", "Unavailable", "Formatting", "Bold", "Italic"]
report = {
    "platform": "Linux WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in names},
    "click_updates_controlled_single_selection": True,
    "click_updates_multiple_selection": True,
    "disabled_click_preserves_selection": True,
    "checked_state_exposed": bool(int(right.GetState(dbus_interface=interface)[0]) & (1 << 4)),
    "pressed_state_exposed": bool(int(italic.GetState(dbus_interface=interface)[0]) & (1 << 20)),
    "disabled_reported_enabled": bool(int(unavailable.GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "native_states": {name: list(map(int, nodes[name].GetState(dbus_interface=interface))) for name in names},
    "item_relationships": list(right.GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
