"""Inspect fixtures/toolbar-native.ts through Linux AT-SPI (python-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX Toolbar native verification"


def walk(name, path, nodes, include=False):
    node = bus.get_object(name, path, introspect=False)
    props = node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)
    include = include or str(props["Name"]) == title
    if include:
        nodes[str(props["Name"])] = node
    for child in node.GetChildren(dbus_interface=interface, timeout=3):
        walk(*child, nodes, include=include)


nodes = {}
for application in registry.GetChildren(dbus_interface=interface, timeout=3):
    walk(*application, nodes)
assert title in nodes, "Start test:native:toolbar with both inspection flags set to 1"
toolbar = nodes["Editing commands"]
assert int(toolbar.GetRole(dbus_interface=interface)) == 63


def description(node):
    return str(node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)["Description"])


def click(node):
    assert node.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
    time.sleep(0.25)


assert description(toolbar) == "Arrow keys move between editing controls."
assert description(nodes["Copy"]) == "Actions: 0. Bold: false."
click(nodes["Copy"])
assert description(nodes["Copy"]) == "Actions: 1. Bold: false."
click(nodes["Bold"])
assert description(nodes["Bold"]) == "Actions: 2. Bold: true."
click(nodes["Unavailable"])
assert description(nodes["Copy"]) == "Actions: 2. Bold: true."
report = {
    "platform": "Linux WSL2 WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {
        name: {
            "role": int(nodes[name].GetRole(dbus_interface=interface)),
        }
        for name in ["Editing commands", "Copy", "Bold", "Unavailable", "Paste"]
    },
    "toolbar_description": description(toolbar),
    "toolbar_states": list(map(int, toolbar.GetState(dbus_interface=interface))),
    "toolbar_relationships": list(toolbar.GetRelationSet(dbus_interface=interface)),
    "bold_states": list(map(int, nodes["Bold"].GetState(dbus_interface=interface))),
    "disabled_states": list(map(int, nodes["Unavailable"].GetState(dbus_interface=interface))),
    "os_click_preserves_button_and_toggle_actions": True,
    "disabled_os_click_is_ignored": True,
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
