"""Inspect fixtures/link-native.ts through Linux AT-SPI (python-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX Link and Breadcrumbs native verification"


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
assert title in nodes, "Start test:native:link with both inspection flags set to 1"


def description(node):
    return str(node.GetAll(interface, dbus_interface="org.freedesktop.DBus.Properties", timeout=3)["Description"])


def click(node):
    assert node.DoAction(0, dbus_interface="org.a11y.atspi.Action", timeout=3)
    time.sleep(0.25)


assert description(nodes["Breadcrumbs"]) == "Links to parent pages. Current page is inactive."
assert int(nodes["Breadcrumbs"].GetRole(dbus_interface=interface)) == 110
assert description(nodes["Home"]) == "Navigations: 0."
assert int(nodes["Home"].GetRole(dbus_interface=interface)) == 88
click(nodes["Home"])
assert description(nodes["Home"]) == "Navigations: 1."
click(nodes["Unavailable"])
click(nodes["Current page"])
assert description(nodes["Home"]) == "Navigations: 1."
report = {
    "platform": "Linux WSL2 Xvfb X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {
        name: {
            "role": int(nodes[name].GetRole(dbus_interface=interface)),
        }
        for name in ["Breadcrumbs", "Home", "Unavailable", "Current page"]
    },
    "navigation_description": description(nodes["Breadcrumbs"]),
    "current_states": list(map(int, nodes["Current page"].GetState(dbus_interface=interface))),
    "current_attributes": list(nodes["Current page"].GetAttributes(dbus_interface=interface)),
    "disabled_states": list(map(int, nodes["Unavailable"].GetState(dbus_interface=interface))),
    "current_relationships": list(nodes["Current page"].GetRelationSet(dbus_interface=interface)),
    "os_click_invokes_navigation_callback": True,
    "disabled_and_current_os_click_are_ignored": True,
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
