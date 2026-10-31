import { expect, test } from "bun:test";

import type { HostElement, KeyEvent } from "gpuix-solid2";
import { createSelectState, Item } from "gpuix-solid2-stately";
import type {
  SelectionMode,
  SelectStateOptions,
} from "gpuix-solid2-stately/select/create-select-state";
import type { Key } from "gpuix-solid2-stately/shared-types";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";

import { createListBox, createOption } from "../src/collections.js";
import { createOverlay } from "../src/overlays.js";
import { createSelect } from "../src/select.js";
import type { SelectProps } from "../src/select.js";
import { setup } from "./support.js";

interface Entry {
  id: Key;
}

const mount = (
  options: {
    trigger?: SelectProps;
    state?: Omit<
      SelectStateOptions<Entry, SelectionMode>,
      "children" | "items"
    >;
    items?: Entry[];
  } = {}
) => {
  const app = setup();
  let trigger!: HostElement;
  let popup: HostElement | null = null;
  let state!: ReturnType<typeof createSelectState<Entry, SelectionMode>>;
  let behavior!: ReturnType<typeof createSelect<Entry, SelectionMode>>;
  const nodes = new Map<Key, HostElement>();

  app.root.render(() => {
    // oxlint-disable-next-line solid/reactivity -- Capture the mounted state for imperative event assertions.
    state = createSelectState<Entry, SelectionMode>(
      merge(
        {
          children: (entry: Entry) =>
            Item({
              children: String(entry.id),
              key: entry.id,
              textValue: String(entry.id),
            }),
          disabledKeys: ["Banana"],
          items: options.items ?? [
            { id: "Apple" },
            { id: "Banana" },
            { id: "Cherry" },
          ],
        },
        options.state ?? {}
      )
    );
    behavior = createSelect(
      options.trigger ?? { "aria-label": "Fruit" },
      state,
      () => trigger
    );

    return jsx("div", {
      children: [
        jsx(
          "div",
          merge(behavior.triggerProps, {
            children: jsx(
              "div",
              merge(behavior.valueProps, {
                get children() {
                  return state.selectedItems
                    .map((item) => item.textValue)
                    .join(", ");
                },
              })
            ),
            ref: (node: HostElement) => {
              trigger = node;
            },
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
              () => popup
            );

            const list = createListBox(
              behavior.menuProps,
              state,
              (key) => nodes.get(key) ?? null
            );

            return jsx(
              "div",
              merge(overlay.overlayProps, list.listBoxProps, {
                children: For({
                  children: (key) => {
                    const option = createOption(
                      { key },
                      state,
                      () => nodes.get(key) ?? null
                    );

                    return jsx(
                      "div",
                      merge(option.optionProps, {
                        ref: (node: HostElement) => nodes.set(key, node),
                      })
                    );
                  },
                  get each() {
                    return [...state.collection.getKeys()];
                  },
                }),
                onKeyDown(event: KeyEvent) {
                  list.listBoxProps.onKeyDown(event);
                  overlay.overlayProps.onKeyDown(event);
                },
                ref: (node: HostElement) => {
                  popup = node;
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
    get behavior() {
      return behavior;
    },
    item(key: Key) {
      const node = nodes.get(key);

      if (!node) {
        throw new Error(`Missing ${key}`);
      }

      return node;
    },
    popup: () => popup,
    get state() {
      return state;
    },
    trigger,
  };
};

test("Select opens on key-down, skips disabled items and restores on selection", () => {
  for (const key of ["return", "space", "down", "up"]) {
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
    expect(app.renderer.getFocusedElementId?.()).toBe(
      app.item(key === "up" ? "Cherry" : "Apple").id
    );
    app.send(app.trigger, "keyDown", { isHeld: true, key });
    app.send(app.trigger, "keyUp", { key });
    expect(requests).toEqual([true]);
    const popup = app.popup();
    app.send(app.item("Cherry"), "keyDown", { key: "return" });
    expect(app.state.value).toBe("Cherry");
    expect(app.state.isOpen).toBe(false);
    expect(popup?.mounted).toBe(false);
    expect(app.renderer.getFocusedElementId?.()).toBe(app.trigger.id);
  }
});

test("Reselecting the current single value closes through every activation path", () => {
  for (const activation of ["click", "return", "space", "container"]) {
    const app = mount({ state: { defaultValue: "Apple" } });
    app.send(app.trigger, "click");

    if (activation === "click") {
      app.send(app.item("Apple"), "click");
    } else if (activation === "container") {
      const popup = app.popup();

      if (!popup) {
        throw new Error("Missing popup");
      }

      app.send(popup, "keyDown", { key: "space" });
    } else {
      app.send(app.item("Apple"), "keyDown", { key: activation });
      app.send(app.item("Apple"), "keyUp", { key: activation });
    }

    expect(app.state.value).toBe("Apple");
    expect(app.state.isOpen).toBe(false);
    expect(app.renderer.getFocusedElementId?.()).toBe(app.trigger.id);
  }
});

test("Selected items receive opening focus and focus navigation does not select", () => {
  const app = mount({ state: { defaultValue: "Cherry" } });
  app.send(app.trigger, "click");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Cherry").id);
  const popup = app.popup();

  if (!popup) {
    throw new Error("Missing popup");
  }

  app.send(popup, "keyDown", { key: "down" });
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
  expect(app.state.value).toBe("Cherry");
  app.send(app.item("Apple"), "keyDown", { key: "space" });
  expect(app.state.isOpen).toBe(true);
  app.send(app.item("Apple"), "keyUp", { key: "space" });
  expect(app.state.value).toBe("Apple");
  expect(app.state.isOpen).toBe(false);
});

test("Closed arrows and single-character search request enabled values without opening", () => {
  const app = mount();
  app.send(app.trigger, "keyDown", { key: "right" });
  expect(app.state.value).toBe("Apple");
  app.send(app.trigger, "keyDown", { isHeld: true, key: "right" });
  expect(app.state.value).toBe("Cherry");
  app.send(app.trigger, "keyDown", { key: "right" });
  expect(app.state.value).toBe("Cherry");
  app.send(app.trigger, "keyDown", { key: "left" });
  expect(app.state.value).toBe("Apple");
  app.send(app.trigger, "keyDown", { key: "C" });
  expect(app.state.value).toBe("Cherry");
  app.send(app.trigger, "keyDown", { key: "b" });
  expect(app.state.value).toBe("Cherry");
  expect(app.state.isOpen).toBe(false);
});

test("Controlled value and open requests may be rejected independently", () => {
  const [value, setValue] = createSignal<Key | null>("Apple");
  const [open, setOpen] = createSignal(false);
  const values: (Key | null | Key[])[] = [];
  const opens: boolean[] = [];
  let acceptValue = false;
  let acceptOpen = false;

  const app = mount({
    state: {
      get isOpen() {
        return open();
      },
      onChange(next) {
        values.push(next);

        if (acceptValue && !Array.isArray(next)) {
          setValue(next);
        }
      },
      onOpenChange(next) {
        opens.push(next);

        if (acceptOpen) {
          setOpen(next);
        }
      },
      get value() {
        return value();
      },
    },
  });

  app.send(app.trigger, "keyDown", { key: "right" });
  expect(values).toEqual(["Cherry"]);
  expect(app.state.value).toBe("Apple");
  app.send(app.trigger, "click");
  expect(opens).toEqual([true]);
  expect(app.popup()).toBeNull();
  acceptOpen = true;
  app.send(app.trigger, "click");
  app.send(app.item("Cherry"), "click");
  expect(app.state.value).toBe("Apple");
  expect(app.state.isOpen).toBe(false);
  acceptValue = true;
  app.send(app.trigger, "keyDown", { key: "c" });
  expect(app.state.value).toBe("Cherry");
  setValue("Apple");
  app.root.flush();
  app.send(app.trigger, "click");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item("Apple").id);
  acceptOpen = false;
  app.windowKey("escape");
  expect(app.state.isOpen).toBe(true);
  acceptOpen = true;
  app.windowKey("escape");
  expect(app.state.isOpen).toBe(false);
});

test("Multiple selection stays open and does not select from the closed trigger", () => {
  const app = mount({ state: { selectionMode: "multiple" } });
  app.send(app.trigger, "keyDown", { key: "c" });
  app.send(app.trigger, "keyDown", { key: "right" });
  expect(app.state.value).toEqual([]);
  app.send(app.trigger, "click");
  expect(app.popup()?.props.get("aria-multiselectable")).toBe(true);
  app.send(app.item("Apple"), "click");
  app.send(app.item("Cherry"), "click");
  expect(app.state.value).toEqual(["Apple", "Cherry"]);
  app.send(app.item("Apple"), "click");
  expect(app.state.value).toEqual(["Cherry"]);
  expect(app.state.isOpen).toBe(true);
  app.windowKey("escape");
  expect(app.state.isOpen).toBe(false);
});

test("Mouse opens on press-start only and OS Click follows selection close policy", () => {
  const requests: boolean[] = [];

  const app = mount({
    state: {
      onOpenChange: (value) => {
        requests.push(value);
      },
      shouldCloseOnSelect: false,
    },
  });

  app.send(app.trigger, "mouseDown", { button: 0 });
  expect(app.state.isOpen).toBe(true);
  app.send(app.trigger, "mouseUp", { button: 0 });
  app.send(app.trigger, "click", { button: 0, x: 1, y: 1 });
  expect(requests).toEqual([true]);
  app.send(app.item("Cherry"), "click");
  expect(app.state.value).toBe("Cherry");
  expect(app.state.isOpen).toBe(true);
  app.windowKey("escape");
  app.send(app.trigger, "click");
  expect(app.state.isOpen).toBe(true);
});

test("Reactive guards, normalized callbacks and cancellation block trigger changes", () => {
  const [disabled, setDisabled] = createSignal(true);
  const keys: string[] = [];
  let cancel = false;

  const app = mount({
    trigger: {
      get isDisabled() {
        return disabled();
      },
      onKeyDown(event) {
        keys.push(event.key ?? "");

        if (cancel) {
          event.preventDefault();
        }
      },
    },
  });

  for (const key of ["return", "up", "down", "space", "right", "c"]) {
    app.send(app.trigger, "keyDown", { key });
  }

  app.send(app.trigger, "click");
  app.send(app.trigger, "mouseDown", { button: 0 });
  expect(app.state.isOpen).toBe(false);
  expect(app.state.value).toBeNull();
  expect(app.trigger.props.get("tabIndex")).toBe(-1);
  expect(keys[0]).toBe("Enter");
  setDisabled(false);
  app.root.flush();
  cancel = true;
  app.send(app.trigger, "keyDown", { key: "right" });
  app.send(app.trigger, "keyDown", { key: "down" });
  expect(app.state.value).toBeNull();
  expect(app.state.isOpen).toBe(false);
  cancel = false;
  app.send(app.trigger, "keyDown", {
    key: "down",
    modifiers: { alt: false, cmd: false, ctrl: true, shift: false },
  });
  expect(app.state.isOpen).toBe(false);
  app.send(app.trigger, "click");
  app.send(app.item("Banana"), "click");
  expect(app.state.value).toBeNull();
});

test("Stable native IDs, validation and numeric zero survive reopening and cleanup", () => {
  const app = mount({
    items: [{ id: 0 }, { id: 1 }],
    state: { defaultValue: 0, isInvalid: true },
    trigger: { isRequired: true },
  });

  const valueId = app.behavior.valueProps["aria-id"];
  const id = app.behavior.triggerProps["aria-id"];
  expect(app.behavior.isInvalid).toBe(true);
  expect(app.trigger.props.get("aria-invalid")).toBe(true);
  expect(app.trigger.props.get("aria-required")).toBe(true);
  expect(app.trigger.props.get("aria-labelledby")).toBe(`${valueId} ${id}`);
  app.send(app.trigger, "click");
  expect(app.renderer.getFocusedElementId?.()).toBe(app.item(0).id);
  expect(app.popup()?.props.get("role")).toBe("listbox");
  expect(app.popup()?.props.get("aria-labelledby")).toBe(
    app.trigger.props.get("aria-id")
  );
  expect(app.trigger.props.get("aria-haspopup")).toBe("listbox");
  const popupId = app.popup()?.props.get("aria-id");
  expect(app.trigger.props.get("aria-controls")).toBe(popupId);
  app.windowKey("escape");
  app.send(app.trigger, "click");
  expect(app.popup()?.props.get("aria-id")).toBe(popupId);
  app.root.unmount();
  expect(app.popup()?.mounted).toBe(false);
  expect(app.behavior.isPressed).toBe(false);
});

test("Empty and fully disabled collections leave focus on the popup container", () => {
  const empty = mount({ items: [] });
  empty.send(empty.trigger, "click");
  expect(empty.state.isOpen).toBe(false);
  const allowed = mount({ items: [], state: { allowsEmptyCollection: true } });
  allowed.send(allowed.trigger, "click");
  expect(allowed.renderer.getFocusedElementId?.()).toBe(allowed.popup()?.id);

  const blocked = mount({
    state: { disabledKeys: ["Apple", "Banana", "Cherry"] },
  });

  blocked.send(blocked.trigger, "click");
  expect(blocked.renderer.getFocusedElementId?.()).toBe(blocked.popup()?.id);
});
