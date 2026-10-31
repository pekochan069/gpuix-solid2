"""Inspect fixtures/select-native.ts through Linux AT-SPI (python-dbus)."""
import json
import os
import time

import dbus

bus = dbus.bus.BusConnection(os.environ["AT_SPI_BUS_ADDRESS"])
interface = "org.a11y.atspi.Accessible"
registry = bus.get_object(
    "org.a11y.atspi.Registry", "/org/a11y/atspi/accessible/root", introspect=False
)
title = "GPUIX Select native verification"


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
assert title in nodes, "Start test:native:select with both inspection flags set to 1"
trigger = nodes["Fruit"]
closed_states = list(map(int, trigger.GetState(dbus_interface=interface)))
assert description(trigger) == 'Open: false. Value: "Apple"'
click(trigger)
opened = snapshot()
assert "Fruit choices" in opened
open_states = list(map(int, trigger.GetState(dbus_interface=interface)))
apple_states = list(map(int, opened["Apple"].GetState(dbus_interface=interface)))
cherry_states_before = list(map(int, opened["Cherry"].GetState(dbus_interface=interface)))
click(opened["Banana"])
assert description(trigger) == 'Open: true. Value: "Apple"', "Disabled option must not select or close"
click(opened["Apple"])
assert "Fruit choices" not in snapshot(), "Reselecting the current value must close"
assert description(trigger) == 'Open: false. Value: "Apple"'
click(trigger)
opened = snapshot()
click(opened["Cherry"])
assert "Fruit choices" not in snapshot()
assert description(trigger) == 'Open: false. Value: "Cherry"'
click(nodes["Disabled fruit"])
assert "Fruit choices" not in snapshot()
assert description(nodes["Disabled fruit"]) == 'Open: false. Value: "Apple"'
click(nodes["Toppings"])
multiple = snapshot()
assert "Toppings choices" in multiple
click(multiple["Apple"])
click(multiple["Cherry"])
assert description(nodes["Toppings"]) == 'Open: true. Value: ["Apple","Cherry"]'
assert "Toppings choices" in snapshot(), "Multiple selection stays open"
# The fixture's explicit close action dismisses the popup before reopening Fruit.
click(nodes["Close choices"])
assert "Toppings choices" not in snapshot()
click(trigger)
opened = snapshot()
assert "Fruit choices" in opened
assert description(trigger) == 'Open: true. Value: "Cherry"'
cherry_states_after = list(map(int, opened["Cherry"].GetState(dbus_interface=interface)))
report = {
    "platform": "Linux WSL2 WSLg X11, GPUIX 0.11.0, AT-SPI",
    "roles_and_names": {
        name: int(opened[name].GetRole(dbus_interface=interface))
        for name in ["Fruit", "Disabled fruit", "Toppings", "Fruit choices", "Apple", "Banana", "Cherry"]
    },
    "os_click_opens_listbox": True,
    "os_option_selects_closes_and_unmounts": True,
    "os_reselection_closes": True,
    "disabled_option_and_trigger_reject_os_click": True,
    "multiple_selection_stays_open": True,
    "multiple_value": ["Apple", "Cherry"],
    "os_click_reopens_with_selected_value": True,
    "trigger_closed_states": closed_states,
    "trigger_open_states": open_states,
    "expanded_reported": bool(open_states[0] & (1 << 10)),
    "selected_apple_states": apple_states,
    "cherry_states_before_selection": cherry_states_before,
    "cherry_states_after_selection": cherry_states_after,
    "option_selected_reported": bool(cherry_states_after[0] & (1 << 23)),
    "disabled_trigger_reported_enabled": bool(int(nodes["Disabled fruit"].GetState(dbus_interface=interface)[0]) & (1 << 8)),
    "trigger_relationships": list(trigger.GetRelationSet(dbus_interface=interface)),
    "listbox_relationships": list(opened["Fruit choices"].GetRelationSet(dbus_interface=interface)),
}
print(json.dumps(report, indent=2))
if os.environ.get("GPUIX_ARIA_AUDIT_OUTPUT"):
    with open(os.environ["GPUIX_ARIA_AUDIT_OUTPUT"], "w") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
