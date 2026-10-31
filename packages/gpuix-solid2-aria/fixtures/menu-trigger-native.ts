import assert from "node:assert/strict";

import { GpuixRenderer } from "@gpuix/native";
import { createRoot } from "gpuix-solid2";
import type { HostElement, KeyEvent } from "gpuix-solid2";
import {
  createMenuTriggerState,
  createTreeState,
  Item,
} from "gpuix-solid2-stately";
import type { Key } from "gpuix-solid2-stately/shared-types";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";

import { createButton } from "../src/controls.js";
import { createMenuTrigger } from "../src/menu-trigger.js";
import { createMenu, createMenuItem } from "../src/menu.js";
import { createOverlay } from "../src/overlays.js";

const title = "GPUIX MenuTrigger native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 410, title, width: 540 });

const app = createRoot(renderer, { keyboardFocusDim: false });
let trigger!: HostElement;
let disabled!: HostElement;
let outside!: HostElement;
let menu: HostElement | null = null;
let isOpen!: () => boolean;
let accept = true;
const requests: boolean[] = [];
const actions: Key[] = [];
const nodes = new Map<Key, HostElement>();

app.render(() => {
  const [open, setOpen] = createSignal(false);
  isOpen = open;

  const state = createMenuTriggerState({
    get isOpen() {
      return open();
    },
    onOpenChange(value) {
      requests.push(value);

      if (accept) {
        setOpen(value);
      }
    },
  });

  const behavior = createMenuTrigger(
    { "aria-label": "Actions" },
    state,
    () => trigger
  );

  const blocked = createMenuTrigger(
    { "aria-label": "Disabled actions", isDisabled: true },
    createMenuTriggerState({}),
    () => disabled
  );

  const next = createButton({ "aria-label": "After actions" }, () => outside);

  const tree = createTreeState({
    children: (entry: { id: string }) =>
      Item({ children: entry.id, key: entry.id, textValue: entry.id }),
    disabledKeys: ["Banana"],
    items: [{ id: "Apple" }, { id: "Banana" }, { id: "Cherry" }],
  });

  const style = {
    backgroundColor: "#d9e8f2",
    height: 34,
    padding: 6,
    width: 350,
  };

  return jsx("div", {
    children: [
      jsx("text", {
        children: "Native menu triggers",
        style: { color: "#102030", fontSize: 22 },
      }),
      jsx("text", {
        children: "Enter, Space, Down or Up opens the menu.",
        style: { color: "#102030" },
      }),
      jsx(
        "div",
        merge(behavior.menuTriggerProps, {
          get "aria-description"() {
            return `Open: ${state.isOpen}. Action: ${actions.at(-1) ?? "none"}`;
          },
          children: "Actions",
          ref: (node: HostElement) => {
            trigger = node;
          },
          style,
        })
      ),
      jsx(
        "div",
        merge(blocked.menuTriggerProps, {
          children: "Disabled actions",
          ref: (node: HostElement) => {
            disabled = node;
          },
          style: { ...style, color: "#7c8790" },
        })
      ),
      jsx(
        "div",
        merge(next.buttonProps, {
          children: "After actions",
          ref: (node: HostElement) => {
            outside = node;
          },
          style,
        })
      ),
      For({
        children: () => {
          const overlay = createOverlay(
            {
              isDismissable: true,
              isModal: true,
              isOpen: true,
              onClose: state.close,
              triggerRef: () => trigger,
            },
            () => menu
          );

          const nativeMenu = createMenu(
            merge(behavior.menuProps, {
              "aria-label": "Available actions",
              onAction(key: Key) {
                actions.push(key);
              },
            }),
            tree,
            () => menu
          );

          return jsx(
            "div",
            merge(overlay.overlayProps, () => nativeMenu.menuProps, {
              children: For({
                children: (key) => {
                  const item = createMenuItem(
                    { key },
                    tree,
                    () => nodes.get(key) ?? null
                  );

                  return jsx(
                    "div",
                    merge(item.menuItemProps, {
                      children: String(key),
                      ref: (node: HostElement) => nodes.set(key, node),
                      get style() {
                        return {
                          ...style,
                          backgroundColor: "#edf2f6",
                          color: item.isDisabled ? "#7c8790" : "#102030",
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
                nativeMenu.menuProps.onKeyDown(event);
                overlay.overlayProps.onKeyDown(event);
              },
              ref: (node: HostElement) => {
                menu = node;
              },
              style: { display: "flex", flexDirection: "column", gap: 4 },
            })
          );
        },
        get each() {
          return state.isOpen ? [true] : [];
        },
      }),
    ],
    style: {
      backgroundColor: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 16,
    },
  });
});

const node = (key: Key) => {
  const element = nodes.get(key);
  assert.ok(element);

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
  renderer.focusElement(trigger.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    outside.id,
    "Disabled trigger is skipped"
  );

  for (const opener of ["up", "down", "enter", "space", "alt-up", "alt-down"]) {
    renderer.focusElement(trigger.id);
    // oxlint-disable-next-line no-await-in-loop -- Each native key must settle before checking focus.
    await key(opener);
    assert.equal(isOpen(), true);
    assert.equal(
      renderer.getFocusedElementId(),
      node(opener.endsWith("up") ? "Cherry" : "Apple").id
    );
    // oxlint-disable-next-line no-await-in-loop -- Each popup must close before the next opener.
    await key("escape");
    assert.equal(isOpen(), false);
    assert.equal(renderer.getFocusedElementId(), trigger.id);
  }

  accept = false;
  await key("up");
  assert.equal(isOpen(), false);
  assert.equal(requests.at(-1), true);
  accept = true;
  await click(trigger);
  assert.equal(isOpen(), true);
  assert.equal(renderer.getFocusedElementId(), node("Apple").id);
  await key("down");
  assert.equal(renderer.getFocusedElementId(), node("Cherry").id);
  await key("enter");
  assert.equal(isOpen(), false);
  assert.equal(actions.at(-1), "Cherry");
  assert.equal(renderer.getFocusedElementId(), trigger.id);
  await click(trigger);
  await click(outside);
  assert.equal(isOpen(), false);
  await click(disabled);
  assert.equal(isOpen(), false);
  console.log(
    "Native MenuTrigger keyboard opening, initial focus, mouse, guards, controlled requests, dismissal, unmounting and restoration passed."
  );
};

try {
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("MenuTrigger inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Keep the native UI alive for external AT-SPI actions.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(
      isOpen(),
      true,
      "OS Click must reopen the menu for inspection"
    );
    assert.equal(actions.at(-1), "Cherry", "OS Click must invoke the action");
    assert.equal(renderer.getFocusedElementId(), node("Apple").id);
  }
} finally {
  app.unmount();
}

process.exit(0);
