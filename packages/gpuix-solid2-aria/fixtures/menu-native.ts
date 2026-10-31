import assert from "node:assert/strict";

import { GpuixRenderer } from "@gpuix/native";
import { createRoot } from "gpuix-solid2";
import type { HostElement, HostProps, KeyEvent } from "gpuix-solid2";
import { createTreeState, Item } from "gpuix-solid2-stately";
import type { Key, SelectionMode } from "gpuix-solid2-stately/shared-types";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";

import { createButton } from "../src/controls.js";
import { createMenu, createMenuItem } from "../src/menu.js";
import { createOverlay } from "../src/overlays.js";

const title = "GPUIX Menu native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 610, title, width: 620 });

const app = createRoot(renderer, { keyboardFocusDim: false });
const nodes = new Map<string, HostElement>();
let trigger!: HostElement;
let outside!: HostElement;
let isOpen!: () => boolean;
let single!: () => Key[];
let multiple!: () => Key[];
let accept = true;
const requests: Key[][] = [];
const actions: Key[] = [];

app.render(() => {
  const [open, setOpen] = createSignal(false);
  const [selected, setSelected] = createSignal<Key[]>(["Apple"]);
  isOpen = open;
  single = selected;

  const state = createTreeState({
    children: (entry: { id: string }) =>
      Item({ children: entry.id, key: entry.id, textValue: entry.id }),
    disabledKeys: ["Banana"],
    items: [{ id: "Apple" }, { id: "Banana" }, { id: "Cherry" }],
    onSelectionChange(keys) {
      if (keys === "all") {
        throw new Error("Unexpected select-all");
      }

      const next = [...keys];
      requests.push(next);

      if (accept) {
        setSelected(next);
      }
    },
    get selectedKeys() {
      return selected();
    },
    selectionMode: "single",
  });

  const toggle = createButton(
    {
      "aria-label": "Open actions",
      onPress: () => {
        setOpen(!open());
      },
    },
    () => trigger
  );

  const next = createButton({ "aria-label": "Outside menu" }, () => outside);

  const renderMenu = (mode: SelectionMode) => {
    let menu!: HostElement;

    const tree =
      mode === "single"
        ? state
        : createTreeState({
            children: (entry: { id: string }) =>
              Item({ children: entry.id, key: entry.id, textValue: entry.id }),
            disabledKeys: ["Banana"],
            items: [{ id: "Apple" }, { id: "Banana" }, { id: "Cherry" }],
            selectionMode: mode,
          });

    if (mode === "multiple") {
      multiple = () => [...tree.selectionManager.selectedKeys];
    }

    const behavior = createMenu(
      {
        get "aria-description"() {
          return `Selected: ${[...tree.selectionManager.selectedKeys].join(",") || "none"}`;
        },
        "aria-label": `${mode} menu`,
        autoFocus: mode === "none",
        onAction: (key) => {
          actions.push(key);
        },
        onClose:
          mode === "none"
            ? () => {
                setOpen(false);
              }
            : undefined,
      },
      tree,
      () => menu
    );

    const overlay: HostProps =
      mode === "none"
        ? createOverlay(
            {
              isDismissable: true,
              isModal: true,
              isOpen: true,
              onClose: () => {
                setOpen(false);
              },
              triggerRef: () => trigger,
            },
            () => menu
          ).overlayProps
        : {};

    return jsx(
      "div",
      merge(overlay, behavior.menuProps, {
        children: For({
          children: (key: Key) => {
            const id = `${mode}-${key}`;

            const item = createMenuItem(
              { "aria-label": id, key },
              tree,
              () => nodes.get(id) ?? null
            );

            return jsx(
              "div",
              merge(item.menuItemProps, {
                children: String(key),
                ref: (node: HostElement) => nodes.set(id, node),
                get style() {
                  return {
                    backgroundColor: item.isSelected ? "#c4dfef" : "#edf2f6",
                    color: item.isDisabled ? "#7c8790" : "#102030",
                    height: 34,
                    padding: 6,
                    width: 360,
                  };
                },
              })
            );
          },
          get each() {
            return [...tree.collection.getKeys()];
          },
        }),
        onKeyDown(event: KeyEvent) {
          behavior.menuProps.onKeyDown(event);
          overlay.onKeyDown?.(event);
        },
        ref: (node: HostElement) => {
          menu = node;
        },
        style: { display: "flex", flexDirection: "column", gap: 4, padding: 4 },
      })
    );
  };

  return jsx("div", {
    children: [
      jsx("text", {
        children: "Native Solid 2 menus",
        style: { color: "#102030", fontSize: 22 },
      }),
      jsx("text", {
        children: "Single selection. Banana is disabled.",
        style: { color: "#102030" },
      }),
      renderMenu("single"),
      jsx("text", {
        children: "Multiple selection",
        style: { color: "#102030" },
      }),
      renderMenu("multiple"),
      jsx(
        "div",
        merge(toggle.buttonProps, {
          children: "Open actions",
          ref: (node: HostElement) => {
            trigger = node;
          },
          style: {
            backgroundColor: "#d9e8f2",
            height: 32,
            padding: 6,
            width: 360,
          },
        })
      ),
      For({
        children: () => renderMenu("none"),
        get each() {
          return open() ? [true] : [];
        },
      }),
      jsx(
        "div",
        merge(next.buttonProps, {
          children: "Outside menu",
          ref: (node: HostElement) => {
            outside = node;
          },
          style: {
            backgroundColor: "#d9e8f2",
            height: 32,
            padding: 6,
            width: 360,
          },
        })
      ),
    ],
    style: {
      backgroundColor: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      height: 610,
      padding: 16,
      width: 620,
    },
  });
});

const node = (id: string) => {
  const element = nodes.get(id);
  assert.ok(element, `Missing ${id}`);

  return element;
};

const settle = async () => {
  app.flush();
  renderer.tick();
  await Bun.sleep(80);
  app.flush();
};

const key = async (name: string) => {
  renderer.simulateKeystrokes(name);
  renderer.simulateKeyUp(name);
  await settle();
};

const click = async (element: HostElement) => {
  const box = renderer.getElementBounds(element.id);
  assert.ok(box && box.width > 0 && box.height > 0);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  assert.ok(renderer.getElementsAt(x, y).includes(element.id));
  renderer.simulateClick(x, y);
  await settle();
};

const verify = async () => {
  renderer.activateWindow();
  await settle();
  renderer.focusElement(node("single-Apple").id);
  await key("down");
  assert.equal(renderer.getFocusedElementId(), node("single-Cherry").id);
  assert.deepEqual(single(), ["Apple"], "Navigation does not select");
  await key("down");
  assert.equal(renderer.getFocusedElementId(), node("single-Apple").id);
  await key("end");
  assert.equal(renderer.getFocusedElementId(), node("single-Cherry").id);
  await key("home");
  assert.equal(renderer.getFocusedElementId(), node("single-Apple").id);
  await key("c");
  assert.equal(renderer.getFocusedElementId(), node("single-Cherry").id);
  const appleBounds = renderer.getElementBounds(node("single-Apple").id);
  const disabledBounds = renderer.getElementBounds(node("single-Banana").id);
  assert.ok(appleBounds && disabledBounds);
  renderer.simulateMouseMove(
    appleBounds.x + appleBounds.width / 2,
    appleBounds.y + appleBounds.height / 2
  );
  await settle();
  assert.equal(
    renderer.getFocusedElementId(),
    node("single-Apple").id,
    "Real movement restores hover focus after keyboard navigation"
  );
  renderer.simulateMouseMove(
    disabledBounds.x + disabledBounds.width / 2,
    disabledBounds.y + disabledBounds.height / 2
  );
  await settle();
  assert.equal(
    renderer.getFocusedElementId(),
    node("single-Apple").id,
    "Disabled hover preserves focus"
  );
  await key("c");
  await key("space");
  assert.deepEqual(single(), ["Cherry"]);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), node("multiple-Apple").id);
  await key("enter");
  assert.deepEqual(multiple(), ["Apple"]);
  await click(node("multiple-Cherry"));
  assert.deepEqual(multiple(), ["Apple", "Cherry"]);
  await click(node("multiple-Banana"));
  assert.deepEqual(multiple(), ["Apple", "Cherry"]);
  accept = false;
  await click(node("single-Apple"));
  assert.deepEqual(requests.at(-1), ["Apple"]);
  assert.deepEqual(single(), ["Cherry"]);
  accept = true;
  await click(trigger);
  assert.equal(isOpen(), true);
  assert.equal(renderer.getFocusedElementId(), node("none-Apple").id);
  await key("tab");
  assert.ok(
    [node("none-Apple").id, node("none-Cherry").id].includes(
      renderer.getFocusedElementId() ?? 0
    ),
    "Modal Tab stays inside the menu"
  );
  await key("home");
  await key("down");
  assert.equal(renderer.getFocusedElementId(), node("none-Cherry").id);
  await key("enter");
  assert.equal(isOpen(), false);
  assert.equal(actions.at(-1), "Cherry");
  assert.equal(renderer.getFocusedElementId(), trigger.id);
  await click(trigger);
  await key("escape");
  assert.equal(isOpen(), false);
  assert.equal(renderer.getFocusedElementId(), trigger.id);
  await click(trigger);
  await click(outside);
  assert.equal(isOpen(), false);
  console.log(
    "Native Menu keyboard, selection, guards, controlled requests, measured mouse input, Tab, overlay dismissal and restoration passed."
  );
};

try {
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Menu inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each native frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.deepEqual(
      single(),
      ["Cherry"],
      "OS Click must update controlled menu selection"
    );
    assert.deepEqual(
      multiple(),
      ["Apple", "Cherry"],
      "OS Click must update multiple selection"
    );
    assert.equal(
      actions.at(-1),
      "Cherry",
      "OS action must call the menu callback"
    );
    assert.equal(isOpen(), false);
  }
} finally {
  app.unmount();
}

process.exit(0);
