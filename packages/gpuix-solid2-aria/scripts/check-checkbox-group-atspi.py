"""Inspect fixtures/checkbox-group-native.ts through Linux AT-SPI (python3-dbus)."""
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
    include = include or str(props["Name"]) == "GPUIX CheckboxGroup native verification"
    if include:
        nodes[str(props["Name"])] = node
    for child in node.GetChildren(dbus_interface=interface, timeout=3):
        walk(*child, include=include)


def props(node):
    return node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)


for application in registry.GetChildren(dbus_interface=interface, timeout=3):
    walk(*application)
assert "GPUIX CheckboxGroup native verification" in nodes, "Start test:native:checkbox-group with GPUIX_ARIA_INSPECT=1"
news = nodes["News"]
offers = nodes["Offers"]
unavailable = nodes["Unavailable"]
group = nodes["Topics"]
assert int(news.GetRole(dbus_interface=interface)) == 7  # ATSPI_ROLE_CHECK_BOX
assert int(offers.GetRole(dbus_interface=interface)) == 7
assert str(props(news)["Description"]) == "Unchecked"
assert str(props(offers)["Description"]) == "Checked"
assert news.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
assert unavailable.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
time.sleep(0.25)
assert str(props(news)["Description"]) == "Checked", "OS Click must update controlled Solid state"
assert str(props(group)["Description"]) == "Selected offers, news", "Disabled OS Click must not change selection"

report = {
    "platform": "Linux WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in ["Topics", "News", "Offers", "Unavailable"]},
    "checkbox_click_updates_controlled_solid_state": True,
    "disabled_click_preserves_selection": True,
    "checked_state_exposed": bool(int(news.GetState(dbus_interface=interface)[0]) & (1 << 4)),
    "disabled_reported_enabled": bool(int(unavailable.GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "native_states": {name: list(map(int, nodes[name].GetState(dbus_interface=interface))) for name in ["News", "Offers", "Unavailable"]},
    "checkbox_relationships": list(news.GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
