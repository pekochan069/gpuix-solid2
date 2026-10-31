"""Inspect fixtures/number-field-native.ts through Linux AT-SPI (python3-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX NumberField native verification"


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
assert title in nodes, "Start test:native:number-field with GPUIX_ARIA_INSPECT=1"
number = nodes["Amount"]
increase = nodes["Increase value"]
assert int(increase.GetRole(dbus_interface=interface)) == 43
assert description(number) == "Amount: 4"
click(increase)
assert description(number) == "Amount: 4.5", "OS Click must step controlled number state"
click(nodes["Decrease value"])
assert description(number) == "Amount: 4"
click(increase)
click(nodes["Increase disabled amount"])
click(nodes["Increase readonly amount"])
names = ["Amount", "Increase value", "Decrease value", "Disabled amount", "Increase disabled amount", "Readonly amount", "Increase readonly amount"]
report = {
    "platform": "Linux WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {name: int(nodes[name].GetRole(dbus_interface=interface)) for name in names},
    "os_click_steps_controlled_number": True,
    "number_description_tracks_value": True,
    "numeric_value_interface": "org.a11y.atspi.Value" in list(number.GetInterfaces(dbus_interface=interface)),
    "disabled_button_reported_enabled": bool(int(nodes["Increase disabled amount"].GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "readonly_button_reported_enabled": bool(int(nodes["Increase readonly amount"].GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "number_relationships": list(number.GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
