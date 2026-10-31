"""Inspect fixtures/menu-native.ts through Linux AT-SPI (python-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX Menu native verification"


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
assert title in nodes, "Start test:native:menu with both inspection flags set to 1"
single = nodes["single menu"]
multiple = nodes["multiple menu"]
assert description(single) == "Selected: Apple"
click(nodes["single-Cherry"])
assert description(single) == "Selected: Cherry", "OS Click must update controlled menu selection"
click(nodes["single-Banana"])
assert description(single) == "Selected: Cherry", "Disabled OS Click must preserve selection"
click(nodes["multiple-Apple"])
click(nodes["multiple-Cherry"])
assert description(multiple) == "Selected: Apple,Cherry"
click(nodes["multiple-Banana"])
assert description(multiple) == "Selected: Apple,Cherry"
click(nodes["Open actions"])
expanded = snapshot()
assert "none menu" in expanded
action_roles = {name: int(expanded[name].GetRole(dbus_interface=interface)) for name in ["none menu", "none-Cherry"]}
click(expanded["none-Cherry"])
assert "none menu" not in snapshot(), "An OS action must close and unmount the action menu"
names = ["single menu", "single-Apple", "single-Banana", "single-Cherry", "multiple menu", "multiple-Apple", "multiple-Cherry"]
report = {
    "platform": "Linux WSL2 Xvfb X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in names},
    "action_menu_roles": action_roles,
    "os_click_updates_controlled_single_selection": True,
    "os_click_updates_multiple_selection": True,
    "disabled_click_preserves_selection": True,
    "os_action_closes_and_unmounts_menu": True,
    "checked_radio_reported_checked": bool(int(nodes["single-Cherry"].GetState(dbus_interface=interface)[0]) & (1 << 4)),
    "checked_item_reported_checked": bool(int(nodes["multiple-Cherry"].GetState(dbus_interface=interface)[0]) & (1 << 4)),
    "disabled_item_reported_enabled": bool(int(nodes["single-Banana"].GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "menu_relationships": list(single.GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
