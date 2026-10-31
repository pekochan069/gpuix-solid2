import { expect, test } from "bun:test";

import type { HostElement, KeyEvent } from "gpuix-solid2";
import {
  createMenuTriggerState,
  createTreeState,
  Item,
} from "gpuix-solid2-stately";
import type { MenuTriggerProps as StateProps } from "gpuix-solid2-stately/menu/create-menu-trigger-state";
import type { Key } from "gpuix-solid2-stately/shared-types";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";

import { createMenuTrigger } from "../src/menu-trigger.js";
import type { MenuTriggerProps } from "../src/menu-trigger.js";
import { createMenu, createMenuItem } from "../src/menu.js";
import { createOverlay } from "../src/overlays.js";
import { setup } from "./support.js";

const mount = (
  options: {
    trigger?: MenuTriggerProps;
    state?: StateProps;
    selected?: string[];
    empty?: boolean;
  } = {}
) => {
  const app = setup();
  let trigger!: HostElement;
  let menu: HostElement | null = null;
  let behavior!: ReturnType<typeof createMenuTrigger>;
  let state!: ReturnType<typeof createMenuTriggerState>;
  let action = "";
  const items = new Map<string, HostElement>();
  app.root.render(() => {
    state = createMenuTriggerState(options.state ?? {});
    behavior = createMenuTrigger(options.trigger ?? {}, state, () => trigger);

    const tree = createTreeState({
      children: (entry: { id: string }) =>
        Item({ children: entry.id, key: entry.id, textValue: entry.id }),
      defaultSelectedKeys: options.selected,
      disabledKeys: ["Banana"],
      items:
        options.empty === true
          ? []
          : [{ id: "Apple" }, { id: "Banana" }, { id: "Cherry" }],
      selectionMode: "single",
    });

    return jsx("div", {
      children: [
        jsx(
          "div",
          merge(behavior.menuTriggerProps, {
            ref: (node: HostElement) => {
              trigger = node;
            },
          })
        ),
        For({
          children: () => {
            const menuBehavior = createMenu(
              merge(behavior.menuProps, {
                onAction(key: Key) {
                  action = String(key);
                },
              }),
              tree,
              () => menu
            );

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

            return jsx(
              "div",
              merge(overlay.overlayProps, () => menuBehavior.menuProps, {
                children: For({
                  children: (key) => {
                    const item = createMenuItem(
                      { key },
                      tree,
                      () => items.get(String(key)) ?? null
                    );

                    return jsx(
                      "div",
                      merge(item.menuItemProps, {
                        ref: (node: HostElement) =>
                          items.set(String(key), node),
                      })
                    );
                  },
                  get each() {
                    return [...tree.collection.getKeys()];
                  },
                }),
                onKeyDown(event: KeyEvent) {
                  menuBehavior.menuProps.onKeyDown(event);
                  overlay.overlayProps.onKeyDown(event);
                },
                ref: (node: HostElement) => {
                  menu = node;
                },
              })
            );
          },
          get each() {
            return state.isOpen ? [true] : [];
          },
        }),
      ],
    });
  });

  return {
    ...app,
    action: () => action,
    get behavior() {
      return behavior;
    },
    item(key: string) {
      const node = items.get(key);

      if (!node) {
        throw new Error(`Missing ${key}`);
      }

      return node;
    },
    menu: () => menu,
    get state() {
      return state;
    },
    trigger,
  };
};

test("Menu triggers open on Enter and Space key-down without repeated or release activation", () => {
  for (const key of ["return", "space"]) {
    const requests: boolean[] = [];

    const app = mount({
      state: {
        onOpenChange: (open) => {
          requests.push(open);
        },
      },
    });

    app.send(app.trigger, "keyDown", { key });
    expect(app.state.isOpen).toBe(true);
    expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
    app.send(app.trigger, "keyDown", { isHeld: true, key });
    app.send(app.trigger, "keyUp", { key });
    expect(requests).toEqual([true]);
    app.windowKey("escape");
    expect(app.state.isOpen).toBe(false);
    expect(app.renderer.getFocusedElementId?.()).toBe(app.trigger.id);
  }
});

test("Native arrows and Alt arrows choose first and last enabled menu items", () => {
  for (const key of ["down", "up"]) {
    for (const alt of [false, true]) {
      const app = mount();
      app.send(app.trigger, "keyDown", {
        key,
        modifiers: { alt, cmd: false, ctrl: false, shift: false },
      });
      expect(app.state.isOpen).toBe(true);
      expect(app.state.focusStrategy).toBe(key === "up" ? "last" : "first");
      expect(app.renderer.getFocusedElementId?.()).toBe(
        app.item(key === "up" ? "Cherry" : "Apple").id
      );
    }
  }
});

test("Opening prefers the enabled selected item and empty menus receive focus", () => {
  const selected = mount({ selected: ["Cherry"] });
  selected.send(selected.trigger, "keyDown", { key: "down" });
  expect(selected.renderer.getFocusedElementId?.()).toBe(
    selected.item("Cherry").id
  );
  const empty = mount({ empty: true });
  empty.send(empty.trigger, "keyDown", { key: "down" });
  expect(empty.renderer.getFocusedElementId?.()).toBe(empty.menu()?.id);
});

test("Mouse-down opens once and focuses the menu before release and click", () => {
  const requests: boolean[] = [];
  const callbacks: string[] = [];

  const app = mount({
    state: {
      onOpenChange: (open) => {
        requests.push(open);
      },
    },
    trigger: {
      onPress: (event) => {
        callbacks.push(event.type);
      },
      onPressStart: (event) => {
        callbacks.push(event.type);
      },
    },
  });

  app.send(app.trigger, "mouseDown", { button: 0 });
  expect(app.state.isOpen).toBe(true);
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
  app.send(app.trigger, "mouseUp", { button: 0 });
  app.send(app.trigger, "click", { button: 0, x: 1, y: 1 });
  expect(requests).toEqual([true]);
  expect(callbacks).toEqual(["pressstart", "press"]);
});

test("OS Click opens and menu activation unmounts and restores the trigger", () => {
  const app = mount({ trigger: { "aria-label": "Actions" } });
  app.send(app.trigger, "click");
  const menu = app.menu();
  expect(menu?.props.get("aria-label")).toBe("Actions");
  expect(menu?.props.get("aria-labelledby")).toBe(
    app.trigger.props.get("aria-id")
  );
  expect(app.trigger.props.get("aria-controls")).toBe(
    menu?.props.get("aria-id")
  );
  expect(app.trigger.props.get("aria-haspopup")).toBe("menu");
  expect(app.trigger.props.get("aria-expanded")).toBe(true);
  app.send(app.item("Cherry"), "keyDown", { key: "return" });
  expect(app.action()).toBe("Cherry");
  expect(app.state.isOpen).toBe(false);
  expect(menu?.mounted).toBe(false);
  expect(app.trigger.props.get("aria-expanded")).toBe(false);
  expect(app.trigger.props.get("aria-controls")).toBeUndefined();
  expect(app.renderer.getFocusedElementId?.()).toBe(app.trigger.id);
});

test("Controlled open requests can be rejected and later accepted", () => {
  const requests: boolean[] = [];
  const [open, setOpen] = createSignal(false);
  let accept = false;

  const app = mount({
    state: {
      get isOpen() {
        return open();
      },
      onOpenChange(value) {
        requests.push(value);

        if (accept) {
          setOpen(value);
        }
      },
    },
  });

  app.send(app.trigger, "keyDown", { key: "up" });
  expect(requests).toEqual([true]);
  expect(app.state.isOpen).toBe(false);
  expect(app.menu()).toBeNull();
  accept = true;
  app.send(app.trigger, "keyDown", { key: "up" });
  expect(app.state.isOpen).toBe(true);
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Cherry").id);
  accept = false;
  app.windowKey("escape");
  expect(requests).toEqual([true, true, false]);
  expect(app.state.isOpen).toBe(true);
  accept = true;
  app.windowKey("escape");
  expect(app.state.isOpen).toBe(false);
});

test("Reactive disabled guards block native keys, mouse and OS actions", () => {
  const [disabled, setDisabled] = createSignal(true);

  const app = mount({
    trigger: {
      get isDisabled() {
        return disabled();
      },
    },
  });

  expect(app.trigger.props.get("tabIndex")).toBe(-1);

  for (const key of ["return", "space", "up", "down"]) {
    app.send(app.trigger, "keyDown", { key });
  }

  app.send(app.trigger, "mouseDown", { button: 0 });
  app.send(app.trigger, "mouseUp", { button: 0 });
  app.send(app.trigger, "click");
  expect(app.state.isOpen).toBe(false);
  setDisabled(false);
  app.root.flush();
  expect(app.trigger.props.get("tabIndex")).toBe(0);
  app.send(app.trigger, "keyDown", { key: "down" });
  expect(app.state.isOpen).toBe(true);
});

test("Repeats, other chords and non-primary mouse buttons do not open", () => {
  const app = mount();
  app.send(app.trigger, "keyDown", { isHeld: true, key: "up" });

  for (const modifier of ["ctrl", "cmd", "shift"]) {
    app.send(app.trigger, "keyDown", {
      key: "down",
      modifiers: {
        alt: false,
        cmd: modifier === "cmd",
        ctrl: modifier === "ctrl",
        shift: modifier === "shift",
      },
    });
  }

  app.send(app.trigger, "keyDown", {
    key: "return",
    modifiers: { alt: true, cmd: false, ctrl: false, shift: false },
  });
  app.send(app.trigger, "keyDown", { key: "left" });
  app.send(app.trigger, "mouseDown", { button: 2 });
  app.send(app.trigger, "click", { button: 2 });
  expect(app.state.isOpen).toBe(false);
});

test("Open triggers toggle on keyboard, reopen with fresh focus strategy, and dispose", () => {
  const app = mount();
  app.send(app.trigger, "keyDown", { key: "up" });
  const oldMenu = app.menu();
  app.send(app.trigger, "keyDown", { key: "down" });
  expect(app.state.isOpen).toBe(false);
  expect(oldMenu?.mounted).toBe(false);
  app.send(app.trigger, "keyDown", { key: "down" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
  app.root.unmount();
  expect(app.menu()?.mounted).toBe(false);
  expect(app.behavior.isPressed).toBe(false);
});
