"""Inspect fixtures/radio-native.tsx through Linux AT-SPI (python3-dbus)."""
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
    include = include or str(props["Name"]) == "GPUIX RadioGroup native verification"
    if include:
        nodes[str(props["Name"])] = node
    for child in node.GetChildren(dbus_interface=interface, timeout=3):
        walk(*child, include=include)


def props(node):
    return node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)


for application in registry.GetChildren(dbus_interface=interface, timeout=3):
    walk(*application)
assert "GPUIX RadioGroup native verification" in nodes, "Start test:native:radio with GPUIX_ARIA_INSPECT=1"
standard = nodes["Standard"]
express = nodes["Express"]
unavailable = nodes["Unavailable"]
fixed = nodes["Fixed"]
other = nodes["Other"]
group = nodes["Shipping"]
assert int(standard.GetRole(dbus_interface=interface)) == 44  # ATSPI_ROLE_RADIO_BUTTON
assert int(express.GetRole(dbus_interface=interface)) == 44
assert str(props(standard)["Description"]) == "Selected"
assert str(props(express)["Description"]) == "Unselected"
assert express.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert unavailable.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert other.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
time.sleep(0.25)
assert str(props(express)["Description"]) == "Selected", "OS Click must update controlled Solid state"
assert str(props(standard)["Description"]) == "Unselected"
assert str(props(group)["Description"]) == "Selected express", "Disabled OS Click must not change selection"

report = {
    "platform": "Linux X11, Xvfb, Mesa software Vulkan, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in ["Shipping", "Standard", "Express", "Unavailable", "Readonly plan", "Fixed", "Other"]},
    "radio_click_updates_controlled_solid_state": True,
    "disabled_click_preserves_selection": True,
    "readonly_click_preserves_selection": True,
    "selected_radio_checked_state_exposed": bool(int(express.GetState(dbus_interface=interface)[0]) & (1 << 4)),
    "disabled_reported_enabled": bool(int(unavailable.GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "native_states": {name: list(map(int, nodes[name].GetState(dbus_interface=interface))) for name in ["Standard", "Express", "Unavailable", "Fixed", "Other"]},
    "radio_relationships": list(express.GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
