"""Read a running fixtures/native.tsx window through Linux AT-SPI (python3-dbus)."""
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
    include = include or str(props["Name"]) == "GPUIX Aria components native verification"
    if include:
        nodes[str(props["Name"])] = node
    for child in node.GetChildren(dbus_interface=interface, timeout=3):
        walk(*child, include=include)


for application in registry.GetChildren(dbus_interface=interface, timeout=3):
    walk(*application)
assert "GPUIX Aria components native verification" in nodes, "Start fixtures/native.tsx with GPUIX_ARIA_INSPECT=1"
save = nodes["Save"]
checkbox = nodes["Accept terms"]
disabled = nodes["Disabled"]
toggle = nodes["Bold"]
readonly = nodes["Readonly"]
mixed = nodes["Mixed"]
assert int(save.GetRole(dbus_interface=interface)) == 43  # ATSPI_ROLE_PUSH_BUTTON
assert int(checkbox.GetRole(dbus_interface=interface)) == 7  # ATSPI_ROLE_CHECK_BOX
assert int(toggle.GetRole(dbus_interface=interface)) == 43
assert int(readonly.GetRole(dbus_interface=interface)) == 7
assert int(mixed.GetRole(dbus_interface=interface)) == 7


def props(node):
    return node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)


assert str(props(save)["Description"]) == "Activated 3 times"
assert toggle.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert readonly.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert save.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert checkbox.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert disabled.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
time.sleep(0.25)
assert str(props(save)["Description"]) == "Activated 4 times", "OS action must reach Solid state"
assert str(props(checkbox)["Description"]) == "Checked"
assert str(props(toggle)["Description"]) == "Selected"

report = {
    "platform": "Linux X11, Xvfb, Mesa software Vulkan, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in ["Save", "Bold", "Accept terms", "Disabled", "Readonly", "Mixed"]},
    "click_action_updates_solid_state": True,
    "checkbox_click_toggles_solid_state": True,
    "checkbox_checked_state_exposed": bool(int(checkbox.GetState(dbus_interface=interface)[0]) & (1 << 4)),
    "disabled_reported_enabled": bool(int(disabled.GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "toggle_click_updates_solid_state": True,
    "native_states": {name: list(map(int, nodes[name].GetState(dbus_interface=interface))) for name in ["Bold", "Accept terms", "Disabled", "Readonly", "Mixed"]},
    "checkbox_relationships": list(checkbox.GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
