import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createTreeState, Item } from "gpuix-solid2-stately";
import type { Key } from "gpuix-solid2-stately/shared-types";
import type { TreeProps } from "gpuix-solid2-stately/tree/create-tree-state";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createMenu, createMenuItem } from "../src/menu.js";
import type { MenuItemProps, MenuProps } from "../src/menu.js";
import { setup } from "./support.js";

interface Entry {
  id: Key;
}

const mount = (
  options: {
    menu?: MenuProps<Entry>;
    state?: TreeProps<Entry>;
    item?: (key: Key) => Omit<MenuItemProps, "key">;
    setup?: () => void;
  } = {}
) => {
  const app = setup();
  const nodes = new Map<Key, HostElement>();
  let menu!: HostElement;
  let selected!: () => Key[];
  let focused!: () => boolean;
  let pressed!: (key: Key) => boolean;
  const behaviors = new Map<Key, ReturnType<typeof createMenuItem<Entry>>>();
  app.root.render(() => {
    options.setup?.();

    const state = createTreeState(
      merge(
        {
          children: (entry: Entry) =>
            Item({
              children: String(entry.id),
              key: entry.id,
              textValue: String(entry.id),
            }),
          items: [{ id: "Apple" }, { id: "Banana" }, { id: "Cherry" }],
        },
        options.state ?? {}
      )
    );

    selected = () => [...state.selectionManager.selectedKeys];
    focused = () => state.selectionManager.isFocused;
    pressed = (key) => behaviors.get(key)?.isPressed ?? false;
    const behavior = createMenu(options.menu ?? {}, state, () => menu);

    return jsx(
      "div",
      merge(behavior.menuProps, {
        children: For({
          children: (key: Key) => {
            const item = createMenuItem(
              merge(options.item?.(key) ?? {}, { key }),
              state,
              () => nodes.get(key) ?? null
            );

            behaviors.set(key, item);

            return jsx(
              "div",
              merge(item.menuItemProps, {
                ref: (node: HostElement) => nodes.set(key, node),
              })
            );
          },
          get each() {
            return [...state.collection.getKeys()];
          },
        }),
        ref: (node: HostElement) => {
          menu = node;
        },
      })
    );
  });

  return {
    ...app,
    focused,
    item(key: Key) {
      const node = nodes.get(key);

      if (!node) {
        throw new Error(`Missing menu item ${key}`);
      }

      return node;
    },
    menu,
    pressed,
    selected,
  };
};

test("Action menus activate once on Enter and Space key-down, mouse and OS Click", () => {
  const actions: Key[] = [];
  const values: (Entry | null)[] = [];
  const callbacks: string[] = [];
  let closes = 0;

  const app = mount({
    item: () => ({
      onPress: (event) => {
        callbacks.push(event.pointerType);
      },
    }),
    menu: {
      "aria-label": "Fruit actions",
      onAction: (key, value) => {
        actions.push(key);
        values.push(value);
      },
      onClose: () => {
        closes += 1;
      },
    },
  });

  const node = app.item("Apple");
  app.send(node, "keyDown", { key: "return" });
  app.send(node, "keyDown", { isHeld: true, key: "return" });
  app.send(node, "keyUp", { key: "return" });
  app.send(node, "keyDown", { key: "space" });
  expect(actions).toEqual(["Apple", "Apple"]);
  app.send(node, "keyUp", { key: "space" });
  app.send(node, "mouseDown", { button: 0 });
  app.send(node, "mouseUp", { button: 0 });
  app.send(node, "click", { button: 0, x: 1, y: 1 });
  app.send(node, "click");
  expect(actions).toEqual(["Apple", "Apple", "Apple", "Apple"]);
  expect(values).toEqual([
    { id: "Apple" },
    { id: "Apple" },
    { id: "Apple" },
    { id: "Apple" },
  ]);
  expect(closes).toBe(4);
  expect(callbacks).toEqual(["keyboard", "keyboard", "mouse", "virtual"]);
  expect(app.selected()).toEqual([]);
  expect(app.menu.props.get("role")).toBe("menu");
  expect(node.props.get("role")).toBe("menuitem");
  expect(node.props.get("aria-label")).toBe("Apple");
  expect(node.props.get("aria-checked")).toBeUndefined();
});

for (const selectionMode of ["single", "multiple"] as const) {
  test(`${selectionMode} menus select through state and preserve source close rules`, () => {
    let closes = 0;

    const app = mount({
      menu: {
        onClose: () => {
          closes += 1;
        },
      },
      state: { selectionMode },
    });

    const apple = app.item("Apple");
    expect(apple.props.get("role")).toBe(
      selectionMode === "single" ? "menuitemradio" : "menuitemcheckbox"
    );
    app.send(apple, "click");
    expect(app.selected()).toEqual(["Apple"]);
    expect(apple.props.get("aria-checked")).toBe(true);
    expect(closes).toBe(selectionMode === "single" ? 1 : 0);
    closes = 0;
    const banana = app.item("Banana");
    app.send(banana, "keyDown", { key: "space" });
    expect(app.selected()).toEqual(
      selectionMode === "single" ? ["Banana"] : ["Apple", "Banana"]
    );
    expect(closes).toBe(0);
    app.send(banana, "keyUp", { key: "space" });
    app.send(apple, "keyDown", { key: "enter" });
    expect(closes).toBe(1);
    app.send(apple, "keyUp", { key: "enter" });
  });
}

test("Arrows wrap without selecting, skip disabled items, and Home/End and search move focus", () => {
  const app = mount({
    state: { disabledKeys: ["Banana"], selectionMode: "single" },
  });

  app.send(app.item("Apple"), "focus");
  app.send(app.menu, "keyDown", { key: "down" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Cherry").id);
  app.send(app.menu, "keyDown", { key: "down" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
  app.send(app.menu, "keyDown", { key: "up" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Cherry").id);
  app.send(app.menu, "keyDown", { key: "home" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
  app.send(app.menu, "keyDown", { key: "end" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Cherry").id);
  app.send(app.menu, "keyDown", { key: "A" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
  expect(app.selected()).toEqual([]);
  expect(app.item("Apple").props.get("tabIndex")).toBe(0);
  expect(app.item("Banana").props.get("tabIndex")).toBe(-1);
  expect(app.item("Cherry").props.get("tabIndex")).toBe(-1);
});

test("Navigation can stop at ends and leaves Escape, Tab and modifier shortcuts to their owners", () => {
  const app = mount({ menu: { shouldFocusWrap: false } });
  app.send(app.item("Apple"), "focus");
  app.send(app.menu, "keyDown", { key: "up" });
  expect(app.focusCalls).toEqual([]);

  for (const key of ["escape", "tab", "left", "right"]) {
    app.send(app.menu, "keyDown", { key });
  }

  app.send(app.menu, "keyDown", {
    key: "end",
    modifiers: { alt: false, cmd: false, ctrl: true, shift: false },
  });
  app.send(app.item("Apple"), "keyDown", {
    key: "enter",
    modifiers: { alt: true, cmd: false, ctrl: false, shift: false },
  });
  expect(app.focusCalls).toEqual([]);
});

for (const autoFocus of [true, "first", "last"] as const) {
  test(`Menu autoFocus=${autoFocus} uses a selected enabled item before its fallback`, () => {
    const app = mount({
      menu: { autoFocus },
      state: { disabledKeys: ["Banana"] },
    });

    expect(app.renderer.getFocusedElementId?.()).toBe(
      app.item(autoFocus === "last" ? "Cherry" : "Apple").id
    );

    const selected = mount({
      menu: { autoFocus },
      state: { defaultSelectedKeys: ["Cherry"], selectionMode: "single" },
    });

    expect(selected.renderer.getFocusedElementId?.()).toBe(
      selected.item("Cherry").id
    );
  });
}

test("Controlled selection can reject or accept requests and item close overrides stay reactive", () => {
  let selected!: () => Key[];
  let setSelected!: Setter<Key[]>;
  let close!: () => boolean;
  let setClose!: Setter<boolean>;
  let accept = false;
  let closes = 0;
  const requests: Key[][] = [];

  const app = mount({
    item: () => ({
      get shouldCloseOnSelect() {
        return close();
      },
    }),
    menu: {
      onClose: () => {
        closes += 1;
      },
    },
    setup() {
      [selected, setSelected] = createSignal<Key[]>(["Apple"]);
      [close, setClose] = createSignal(false);
    },
    state: {
      onSelectionChange: (keys) => {
        if (keys === "all") {
          throw new Error("Unexpected select-all");
        }

        requests.push([...keys]);

        if (accept) {
          setSelected([...keys]);
        }
      },
      get selectedKeys() {
        return selected();
      },
      selectionMode: "single",
    },
  });

  app.send(app.item("Banana"), "click");
  expect(requests).toEqual([["Banana"]]);
  expect(app.selected()).toEqual(["Apple"]);
  expect(closes).toBe(0);
  accept = true;
  app.root.flushSync(() => setClose(true));
  app.send(app.item("Banana"), "click");
  expect(app.selected()).toEqual(["Banana"]);
  expect(closes).toBe(1);
});

test("Reactive disabled keys cancel held presses and prevent action, focus and selection", () => {
  let disabled!: () => Key[];
  let setDisabled!: Setter<Key[]>;
  const actions: Key[] = [];

  const app = mount({
    menu: {
      onAction: (key) => {
        actions.push(key);
      },
    },
    setup() {
      [disabled, setDisabled] = createSignal<Key[]>([]);
    },
    state: {
      get disabledKeys() {
        return disabled();
      },
    },
  });

  const apple = app.item("Apple");
  app.send(apple, "mouseDown", { button: 0 });
  expect(app.pressed("Apple")).toBe(true);
  app.root.flushSync(() => setDisabled(["Apple"]));
  expect(app.pressed("Apple")).toBe(false);
  app.send(apple, "mouseUp", { button: 0 });
  app.send(apple, "click");
  app.send(apple, "keyDown", { key: "space" });
  app.send(apple, "keyUp", { key: "space" });
  expect(actions).toEqual([]);
  expect(apple.props.get("aria-disabled")).toBe(true);
  expect(apple.props.get("tabIndex")).toBe(-1);
  expect(app.item("Banana").props.get("tabIndex")).toBe(0);
});

test("Hover focuses without selecting, preserves callbacks, and pointer leave cancels presses", () => {
  const events: string[] = [];
  const actions: Key[] = [];

  const app = mount({
    item: () => ({
      onHoverEnd: () => {
        events.push("leave");
      },
      onHoverStart: () => {
        events.push("enter");
      },
    }),
    menu: {
      onAction: (key) => {
        actions.push(key);
      },
    },
  });

  const apple = app.item("Apple");
  app.send(apple, "mouseDown", { button: 0 });
  app.send(apple, "mouseEnter");
  app.send(apple, "mouseLeave");
  expect(app.pressed("Apple")).toBe(false);
  app.send(apple, "mouseUp", { button: 0 });
  app.send(apple, "click", { x: 1, y: 1 });
  expect(actions).toEqual([]);
  expect(events).toEqual(["enter", "leave"]);
  expect(app.renderer.getFocusedElementId?.()).toBe(apple.id);
  expect(app.selected()).toEqual([]);
  app.send(apple, "keyDown", { key: "down" });
  const count = app.focusCalls.length;
  app.send(app.item("Banana"), "mouseEnter");
  expect(app.focusCalls.length).toBe(count);
});

test("Real pointer movement restores hover focus after keyboard navigation", () => {
  const app = mount({
    state: { disabledKeys: ["Banana"], selectionMode: "single" },
  });

  const apple = app.item("Apple");

  app.send(apple, "focus");
  app.send(app.menu, "keyDown", { key: "down" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Cherry").id);
  app.send(apple, "mouseEnter");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Cherry").id);
  app.send(apple, "mouseMove", { x: 1, y: 1 });
  expect(app.renderer.getFocusedElementId?.()).toBe(apple.id);
  const calls = app.focusCalls.length;
  app.send(apple, "mouseMove", { x: 2, y: 2 });
  app.send(app.item("Banana"), "mouseMove", { x: 3, y: 3 });
  expect(app.focusCalls.length).toBe(calls);
  expect(app.selected()).toEqual([]);
});

test("Blur event orders clear focus only when the current menu item loses it", () => {
  const app = mount();
  app.send(app.item("Apple"), "focus");
  app.send(app.item("Banana"), "focus");
  app.send(app.item("Apple"), "blur");
  expect(app.focused()).toBe(true);
  app.send(app.item("Banana"), "blur");
  expect(app.focused()).toBe(false);
});

test("Removed items lose handlers and the remaining enabled item becomes the Tab stop", () => {
  let entries!: () => Entry[];
  let setEntries!: Setter<Entry[]>;
  const actions: Key[] = [];

  const app = mount({
    menu: {
      onAction: (key) => {
        actions.push(key);
      },
    },
    setup() {
      [entries, setEntries] = createSignal<Entry[]>([{ id: 0 }, { id: "0" }]);
    },
    state: {
      get items() {
        return entries();
      },
    },
  });

  app.send(app.item(0), "focus");
  app.send(app.item("0"), "click");
  app.root.flushSync(() => setEntries([{ id: "0" }]));
  expect(app.item(0).mounted).toBe(false);
  app.send(app.item(0), "click");
  expect(actions).toEqual(["0"]);
  expect(app.item("0").props.get("tabIndex")).toBe(0);
  app.root.flushSync(() => setEntries([]));
  expect(app.menu.props.get("tabIndex")).toBe(0);
  app.send(app.menu, "keyDown", { key: "down" });
  app.root.unmount();
  app.send(app.item("0"), "click");
  expect(actions).toEqual(["0"]);
});
