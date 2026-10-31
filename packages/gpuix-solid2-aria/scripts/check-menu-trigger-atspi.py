"""Inspect fixtures/menu-trigger-native.ts through Linux AT-SPI (python-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX MenuTrigger native verification"


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
assert title in nodes, "Start test:native:menu-trigger with both inspection flags set to 1"
trigger = nodes["Actions"]
assert "Open: false" in description(trigger)
closed_states = list(map(int, trigger.GetState(dbus_interface=interface)))
click(trigger)
opened = snapshot()
assert "Available actions" in opened
assert "Open: true" in description(trigger)
open_states = list(map(int, trigger.GetState(dbus_interface=interface)))
click(opened["Cherry"])
assert "Available actions" not in snapshot()
assert "Open: false. Action: Cherry" == description(trigger)
click(nodes["Disabled actions"])
assert "Available actions" not in snapshot(), "Disabled OS Click must not open a menu"
click(trigger)
opened = snapshot()
assert "Available actions" in opened, "OS Click must reopen after activation"
report = {
    "platform": "Linux WSL2 Xvfb X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {
        name: int(opened[name].GetRole(dbus_interface=interface))
        for name in ["Actions", "Disabled actions", "Available actions", "Apple", "Banana", "Cherry"]
    },
    "os_click_opens_menu": True,
    "os_action_closes_and_unmounts_menu": True,
    "disabled_click_does_not_open": True,
    "os_click_reopens_menu": True,
    "trigger_closed_states": closed_states,
    "trigger_open_states": open_states,
    "expanded_reported": bool(open_states[0] & (1 << 10)),
    "disabled_trigger_reported_enabled": bool(int(nodes["Disabled actions"].GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "trigger_relationships": list(trigger.GetRelationSet(dbus_interface=interface)),
    "menu_relationships": list(opened["Available actions"].GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
