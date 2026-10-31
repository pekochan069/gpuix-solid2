import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createTabListState, Item } from "gpuix-solid2-stately";
import type { Key } from "gpuix-solid2-stately/shared-types";
import type { TabListStateOptions } from "gpuix-solid2-stately/tabs/create-tab-list-state";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";
import type { Setter } from "solid-js";

import { I18nProvider } from "../src/i18n.js";
import { createTab, createTabList, createTabPanel } from "../src/tabs.js";
import type { TabListProps, TabProps } from "../src/tabs.js";
import { setup } from "./support.js";

const mount = (
  options: {
    list?: TabListProps;
    state?: TabListStateOptions<{ id: Key }>;
    tab?: (key: Key) => Omit<TabProps, "key">;
    locale?: string;
    setup?: () => void;
  } = {}
) => {
  const app = setup();
  const nodes = new Map<Key, HostElement>();
  const panels = new Map<Key, HostElement>();
  let list!: HostElement;
  let selected!: () => Key | null;

  app.root.render(() => {
    options.setup?.();

    return jsx(I18nProvider, {
      get children() {
        const state = createTabListState(
          merge(
            {
              children: (item: { id: Key }) =>
                Item({
                  children: String(item.id),
                  key: item.id,
                  textValue: String(item.id),
                }),
              items: [{ id: "a" }, { id: "b" }, { id: "c" }],
            },
            options.state ?? {}
          )
        );

        selected = () => state.selectedKey;

        const behavior = createTabList(options.list ?? {}, state, () => list);

        return [
          jsx(
            "div",
            merge(behavior.tabListProps, {
              children: For({
                children: (key: Key) => {
                  const tab = createTab(
                    merge(options.tab?.(key) ?? {}, { key }),
                    state,
                    () => nodes.get(key) ?? null
                  );

                  return jsx(
                    "div",
                    merge(tab.tabProps, {
                      ref: (node: HostElement) => nodes.set(key, node),
                    })
                  );
                },
                get each() {
                  return [...state.collection.getKeys()];
                },
              }),
              ref: (node: HostElement) => {
                list = node;
              },
            })
          ),
          For({
            children: (key: Key) =>
              jsx(
                "div",
                merge(createTabPanel({ id: key }, state).tabPanelProps, {
                  ref: (node: HostElement) => panels.set(key, node),
                })
              ),
            get each() {
              return state.selectedKey === null ? [] : [state.selectedKey];
            },
          }),
        ];
      },
      get locale() {
        return options.locale ?? "en-US";
      },
    });
  });

  return {
    ...app,
    list,
    panels,
    selected,
    tab(key: Key) {
      const node = nodes.get(key);

      if (!node) {
        throw new Error(`Missing tab ${key}`);
      }

      return node;
    },
  };
};

test("Tabs select on press start and OS Click, preserve callbacks, and swap panels", () => {
  const changes: Key[] = [];
  const callbacks: string[] = [];

  const app = mount({
    state: {
      onSelectionChange: (key) => {
        changes.push(key);
      },
    },
    tab: () => ({
      onPress: (event) => {
        callbacks.push(event.pointerType);
      },
    }),
  });

  changes.length = 0;

  const firstPanel = app.panels.get("a");
  expect(app.selected()).toBe("a");
  expect(app.tab("a").props.get("tabIndex")).toBe(0);
  expect(app.tab("b").props.get("tabIndex")).toBe(-1);
  app.send(app.tab("b"), "mouseDown", { button: 0 });
  expect(app.selected()).toBe("b");
  expect(firstPanel?.mounted).toBe(false);
  expect(app.panels.get("b")?.mounted).toBe(true);
  app.send(app.tab("b"), "mouseUp", { button: 0 });
  app.send(app.tab("b"), "click", { button: 0, x: 1, y: 1 });
  expect(changes).toEqual(["b"]);
  app.send(app.tab("c"), "keyDown", { key: "space" });
  expect(app.selected()).toBe("c");
  app.send(app.tab("c"), "keyDown", { isHeld: true, key: "space" });
  app.send(app.tab("c"), "keyUp", { key: "space" });
  app.send(app.tab("a"), "keyDown", { key: "return" });
  app.send(app.tab("a"), "keyUp", { key: "return" });
  app.send(app.tab("b"), "click");
  expect(changes).toEqual(["b", "c", "a", "b"]);
  expect(callbacks).toEqual(["mouse", "keyboard", "keyboard", "virtual"]);
  const panel = app.panels.get("b");
  expect(panel?.props.get("role")).toBe("tabpanel");
  expect(panel?.props.get("aria-id")).toBe(
    app.tab("b").props.get("aria-controls")
  );
  expect(panel?.props.get("aria-labelledby")).toBe(
    app.tab("b").props.get("aria-id")
  );
  expect(app.tab("a").props.get("aria-controls")).toBeUndefined();
});

test("Automatic arrows wrap, skip disabled tabs, and Home/End select", () => {
  const app = mount({ state: { disabledKeys: ["b"] } });
  app.send(app.tab("a"), "keyDown", { key: "right" });
  expect(app.selected()).toBe("c");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.tab("c").id);
  app.send(app.tab("c"), "keyDown", { key: "right" });
  expect(app.selected()).toBe("a");
  app.send(app.tab("a"), "keyDown", { key: "left" });
  expect(app.selected()).toBe("c");
  app.send(app.tab("c"), "keyDown", { key: "home" });
  expect(app.selected()).toBe("a");
  app.send(app.tab("a"), "keyDown", { key: "end" });
  expect(app.selected()).toBe("c");
  app.send(app.tab("c"), "keyDown", { key: "up" });
  app.send(app.tab("c"), "keyDown", {
    key: "left",
    modifiers: { alt: false, cmd: false, ctrl: true, shift: false },
  });
  expect(app.selected()).toBe("c");
});

test("Manual arrows move focus only, then Space or Enter selects", () => {
  const app = mount({ list: { keyboardActivation: "manual" } });
  app.send(app.tab("a"), "keyDown", { key: "right" });
  expect(app.selected()).toBe("a");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.tab("b").id);
  expect(app.tab("b").props.get("tabIndex")).toBe(0);
  app.send(app.tab("b"), "keyDown", { key: "space" });
  app.send(app.tab("b"), "keyUp", { key: "space" });
  expect(app.selected()).toBe("b");
  app.send(app.tab("b"), "keyDown", { key: "end" });
  expect(app.selected()).toBe("b");
  app.send(app.tab("c"), "keyDown", { key: "enter" });
  expect(app.selected()).toBe("c");
});

test("Locale, orientation, and activation mode remain reactive", () => {
  let locale!: () => string;
  let setLocale!: Setter<string>;
  let vertical!: () => boolean;
  let setVertical!: Setter<boolean>;
  let manual!: () => boolean;
  let setManual!: Setter<boolean>;

  const app = mount({
    list: {
      get keyboardActivation() {
        return manual() ? "manual" : "automatic";
      },
      get orientation() {
        return vertical() ? "vertical" : "horizontal";
      },
    },
    get locale() {
      return locale();
    },
    setup() {
      [locale, setLocale] = createSignal("en-US");
      [vertical, setVertical] = createSignal(false);
      [manual, setManual] = createSignal(false);
    },
  });

  app.root.flushSync(() => {
    setLocale("ar-AE");
    setVertical(true);
  });
  app.send(app.tab("a"), "keyDown", { key: "left" });
  expect(app.selected()).toBe("b");
  app.send(app.tab("b"), "keyDown", { key: "down" });
  expect(app.selected()).toBe("c");
  app.root.flushSync(() => setManual(true));
  app.send(app.tab("c"), "keyDown", { key: "home" });
  expect(app.selected()).toBe("c");
  app.send(app.tab("a"), "keyDown", { key: "down" });
  expect(app.selected()).toBe("c");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.tab("b").id);
});

test("Controlled requests may be rejected and external selection remains authoritative", () => {
  let accept = false;
  let value!: () => Key;
  let setValue!: Setter<Key>;
  const requests: Key[] = [];

  const app = mount({
    setup() {
      [value, setValue] = createSignal<Key>("a");
    },
    state: {
      onSelectionChange(key) {
        requests.push(key);

        if (accept) {
          setValue(key);
        }
      },
      get selectedKey() {
        return value();
      },
    },
  });

  app.send(app.tab("b"), "click");
  expect(app.selected()).toBe("a");
  app.send(app.tab("a"), "keyDown", { key: "right" });
  expect(app.selected()).toBe("a");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.tab("b").id);
  expect(requests).toEqual(["b", "b"]);
  accept = true;
  app.send(app.tab("c"), "click");
  expect(app.selected()).toBe("c");
  app.root.flushSync(() => setValue("a"));
  expect(app.selected()).toBe("a");
  expect(app.tab("a").props.get("aria-selected")).toBe(true);
});

test("Reactive guards combine group, collection, and local disabled state", () => {
  let disable!: Setter<boolean>;
  let setItems!: Setter<{ id: Key }[]>;
  let groupDisabled!: () => boolean;
  let items!: () => { id: Key }[];

  const app = mount({
    setup() {
      [groupDisabled, disable] = createSignal(false);
      [items, setItems] = createSignal<{ id: Key }[]>([
        { id: "a" },
        { id: "b" },
        { id: "c" },
      ]);
    },
    state: {
      disabledKeys: ["b"],
      get isDisabled() {
        return groupDisabled();
      },
      get items() {
        return items();
      },
    },
    tab: (key) => ({ isDisabled: key === "c" }),
  });

  app.send(app.tab("b"), "click");
  app.send(app.tab("c"), "click");
  expect(app.selected()).toBe("a");
  app.root.flushSync(() => disable(true));
  expect(app.tab("a").props.get("tabIndex")).toBe(-1);
  app.send(app.tab("a"), "click");
  expect(app.selected()).toBe("a");
  app.root.flushSync(() => disable(false));
  expect(app.tab("a").props.get("tabIndex")).toBe(0);
  const removed = app.tab("a");
  app.root.flushSync(() => setItems([{ id: "b" }, { id: "c" }]));
  expect(removed.mounted).toBe(false);
  expect(app.tab("b").props.get("tabIndex")).toBe(-1);
  app.root.unmount();
  app.send(removed, "click");
});

test("External selection after tab blur moves the next entry point and preserves blur callbacks", () => {
  let value!: () => Key;
  let setValue!: Setter<Key>;
  const callbacks: string[] = [];

  const app = mount({
    setup() {
      [value, setValue] = createSignal<Key>("a");
    },
    state: {
      get selectedKey() {
        return value();
      },
    },
    tab: () => ({
      onBlur() {
        callbacks.push("blur");
      },
    }),
  });

  app.send(app.tab("a"), "focus");
  app.send(app.tab("a"), "blur");
  app.root.flushSync(() => setValue("b"));
  expect(app.tab("a").props.get("tabIndex")).toBe(-1);
  expect(app.tab("b").props.get("tabIndex")).toBe(0);
  expect(callbacks).toEqual(["blur"]);
});

test("A prior tab's late blur preserves the currently focused tab", () => {
  let value!: () => Key;
  let setValue!: Setter<Key>;

  const app = mount({
    setup() {
      [value, setValue] = createSignal<Key>("a");
    },
    state: {
      get selectedKey() {
        return value();
      },
    },
  });

  app.send(app.tab("a"), "focus");
  app.send(app.tab("b"), "focus");
  app.send(app.tab("a"), "blur");
  app.root.flushSync(() => setValue("c"));
  expect(app.tab("b").props.get("tabIndex")).toBe(0);
  expect(app.tab("c").props.get("tabIndex")).toBe(-1);
});

test("Numeric and string keys get distinct stable IDs and owner cleanup removes handlers", () => {
  const app = mount({ state: { items: [{ id: 0 }, { id: "0" }] } });
  const first = app.tab(0).props.get("aria-id");
  expect(first).not.toBe(app.tab("0").props.get("aria-id"));
  expect(app.panels.get(0)?.mounted).toBe(true);
  app.send(app.tab("0"), "click");
  app.send(app.tab(0), "click");
  expect(app.tab(0).props.get("aria-id")).toBe(first);
  const node = app.tab("0");
  app.root.unmount();
  app.send(node, "click");
  expect(app.selected()).toBe(0);
});

test("Collection metadata and reactive local guards skip tabs; removal restores an enabled Tab stop", () => {
  let items!: () => { id: Key }[];
  let setItems!: Setter<{ id: Key }[]>;
  let disabled!: () => boolean;
  let setDisabled!: Setter<boolean>;

  const app = mount({
    setup() {
      [items, setItems] = createSignal<{ id: Key }[]>([
        { id: "a" },
        { id: "b" },
        { id: "c" },
      ]);
      [disabled, setDisabled] = createSignal(true);
    },
    state: {
      children: (entry: { id: Key }) => {
        const descriptor = {
          children: String(entry.id),
          isDisabled: entry.id === "b",
          key: entry.id,
          textValue: String(entry.id),
        };

        return Item(descriptor);
      },
      get items() {
        return items();
      },
    },
    tab: (tabKey) => ({
      get isDisabled() {
        return tabKey === "c" && disabled();
      },
    }),
  });

  app.send(app.tab("b"), "click");
  app.send(app.tab("a"), "keyDown", { key: "right" });
  expect(app.selected()).toBe("a");
  app.root.flushSync(() => setDisabled(false));
  app.send(app.tab("a"), "keyDown", { key: "right" });
  expect(app.selected()).toBe("c");
  app.root.flushSync(() => setItems([{ id: "a" }, { id: "b" }]));
  expect(app.tab("c").mounted).toBe(false);
  expect(app.tab("a").props.get("tabIndex")).toBe(0);
  expect(app.tab("b").props.get("tabIndex")).toBe(-1);
  app.root.flushSync(() => setItems([]));
  expect(app.tab("a").mounted).toBe(false);
});
