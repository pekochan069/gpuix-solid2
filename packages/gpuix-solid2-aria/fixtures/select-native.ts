import assert from "node:assert/strict";

import { GpuixRenderer } from "@gpuix/native";
import { createRoot } from "gpuix-solid2";
import type { HostElement, KeyEvent } from "gpuix-solid2";
import { createSelectState, Item } from "gpuix-solid2-stately";
import type { SelectionMode } from "gpuix-solid2-stately/select/create-select-state";
import type { Key } from "gpuix-solid2-stately/shared-types";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";

import { createListBox, createOption } from "../src/collections.js";
import { createButton } from "../src/controls.js";
import { createOverlay } from "../src/overlays.js";
import { createSelect } from "../src/select.js";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({
  height: 650,
  title: "GPUIX Select native verification",
  width: 540,
});

const app = createRoot(renderer, { keyboardFocusDim: false });
let acceptValue = true;
let acceptOpen = true;
const changes: (Key | Key[] | null)[] = [];
const opens: boolean[] = [];

const style = {
  backgroundColor: "#d9e8f2",
  height: 36,
  padding: 6,
  width: 390,
};

const selectFixture = (
  label: string,
  selectionMode: SelectionMode,
  isDisabled = false
) => {
  let trigger!: HostElement;
  let popup: HostElement | null = null;
  const nodes = new Map<Key, HostElement>();

  const [value, setValue] = createSignal<Key | readonly Key[] | null>(
    selectionMode === "single" ? "Apple" : []
  );

  const [open, setOpen] = createSignal(false);

  const state = createSelectState<{ id: string }, SelectionMode>({
    children: (entry) =>
      Item({ children: entry.id, key: entry.id, textValue: entry.id }),
    disabledKeys: ["Banana"],
    get isOpen() {
      return open();
    },
    items: [{ id: "Apple" }, { id: "Banana" }, { id: "Cherry" }],
    onChange(next) {
      changes.push(next);

      if (acceptValue) {
        setValue(next);
      }
    },
    onOpenChange(next) {
      opens.push(next);

      if (acceptOpen) {
        setOpen(next);
      }
    },
    selectionMode,
    get value() {
      return value();
    },
  });

  const behavior = createSelect(
    { "aria-label": label, isDisabled },
    state,
    () => trigger
  );

  return {
    close: state.close,
    get isOpen() {
      return state.isOpen;
    },
    nodes,
    get popup() {
      return popup;
    },
    get trigger() {
      return trigger;
    },
    get value() {
      return state.value;
    },
    view: jsx("div", {
      children: [
        jsx(
          "div",
          merge(behavior.triggerProps, {
            get "aria-description"() {
              return `Open: ${state.isOpen}. Value: ${JSON.stringify(state.value)}`;
            },
            children: jsx(
              "div",
              merge(behavior.valueProps, {
                get children() {
                  return `${label}: ${state.selectedItems.map((item) => item.textValue).join(", ") || "Choose"}`;
                },
              })
            ),
            ref: (node: HostElement) => {
              trigger = node;
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
              () => popup
            );

            const list = createListBox(
              merge(behavior.menuProps, { "aria-label": `${label} choices` }),
              state,
              (key) => nodes.get(key) ?? null
            );

            return jsx(
              "div",
              merge(overlay.overlayProps, () => list.listBoxProps, {
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
                        children: String(key),
                        ref: (node: HostElement) => nodes.set(key, node),
                        get style() {
                          return {
                            ...style,
                            backgroundColor: option.isSelected
                              ? "#b5dfcb"
                              : "#edf2f6",
                            color: state.disabledKeys.has(key)
                              ? "#7c8790"
                              : "#102030",
                          };
                        },
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
                style: { display: "flex", flexDirection: "column", gap: 4 },
              })
            );
          },
          get each() {
            return state.isOpen ? [true] : [];
          },
        }),
      ],
      style: { display: "flex", flexDirection: "column", gap: 4 },
    }),
  };
};

let single!: ReturnType<typeof selectFixture>;
let multiple!: ReturnType<typeof selectFixture>;
let disabled!: ReturnType<typeof selectFixture>;
let outside!: HostElement;
let closeAction!: HostElement;

app.render(() => {
  single = selectFixture("Fruit", "single");
  multiple = selectFixture("Toppings", "multiple");
  disabled = selectFixture("Disabled fruit", "single", true);

  const next = createButton({ "aria-label": "After selects" }, () => outside);

  const close = createButton(
    {
      "aria-label": "Close choices",
      onPress() {
        single.close();
        multiple.close();
      },
      tabIndex: -1,
    },
    () => closeAction
  );

  return jsx("div", {
    children: [
      jsx("text", {
        children: "Native selects",
        style: { color: "#102030", fontSize: 22 },
      }),
      jsx("text", {
        children: "Arrows open. Navigate, then Enter or Space selects.",
        style: { color: "#102030" },
      }),
      single.view,
      multiple.view,
      disabled.view,
      jsx(
        "div",
        merge(next.buttonProps, {
          children: "After selects",
          ref: (node: HostElement) => {
            outside = node;
          },
          style,
        })
      ),
      jsx(
        "div",
        merge(close.buttonProps, {
          children: "Close choices",
          ref: (node: HostElement) => {
            closeAction = node;
          },
          style,
        })
      ),
    ],
    style: {
      backgroundColor: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      height: 650,
      padding: 16,
    },
  });
});

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

const node = (fixture: ReturnType<typeof selectFixture>, name: Key) => {
  const item = fixture.nodes.get(name);
  assert.ok(item);

  return item;
};

const verify = async () => {
  renderer.activateWindow();
  await settle();
  renderer.focusElement(multiple.trigger.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    outside.id,
    "Disabled select leaves Tab order"
  );
  renderer.focusElement(single.trigger.id);
  await key("right");
  assert.equal(single.value, "Cherry");
  assert.equal(single.isOpen, false);
  await key("a");
  assert.equal(single.value, "Apple");

  for (const opener of ["up", "down", "enter", "space", "alt-up", "alt-down"]) {
    // oxlint-disable-next-line no-await-in-loop -- Each native opener and dismissal must settle.
    await key(opener);
    assert.equal(single.isOpen, true);
    assert.equal(renderer.getFocusedElementId(), node(single, "Apple").id);
    // oxlint-disable-next-line no-await-in-loop -- Return to the trigger before the next opener.
    await key("escape");
    assert.equal(single.isOpen, false);
    assert.equal(renderer.getFocusedElementId(), single.trigger.id);
  }

  await click(single.trigger);
  await key("enter");
  assert.equal(single.isOpen, false, "Reselecting the current value closes");
  assert.equal(single.value, "Apple");
  await click(single.trigger);
  await click(node(single, "Apple"));
  assert.equal(single.isOpen, false, "Mouse reselection closes too");
  assert.equal(single.value, "Apple");

  acceptOpen = false;
  await key("down");
  assert.equal(single.isOpen, false);
  assert.equal(opens.at(-1), true);
  acceptOpen = true;
  await click(single.trigger);
  const oldPopup = single.popup;
  await key("down");
  assert.equal(renderer.getFocusedElementId(), node(single, "Cherry").id);
  assert.equal(single.value, "Apple", "Navigation does not select");
  acceptValue = false;
  await key("enter");
  assert.equal(changes.at(-1), "Cherry");
  assert.equal(single.value, "Apple");
  assert.equal(single.isOpen, false);
  assert.equal(oldPopup?.mounted, false);
  acceptValue = true;
  await click(single.trigger);
  await click(node(single, "Cherry"));
  assert.equal(single.value, "Cherry");
  assert.equal(single.isOpen, false);
  assert.equal(renderer.getFocusedElementId(), single.trigger.id);
  await click(single.trigger);
  assert.equal(renderer.getFocusedElementId(), node(single, "Cherry").id);
  await key("home");
  assert.equal(renderer.getFocusedElementId(), node(single, "Apple").id);
  await key("end");
  assert.equal(renderer.getFocusedElementId(), node(single, "Cherry").id);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), node(single, "Cherry").id);
  await key("escape");
  await click(single.trigger);
  await click(outside);
  assert.equal(single.isOpen, false);
  await click(disabled.trigger);
  assert.equal(disabled.isOpen, false);
  await click(multiple.trigger);
  await click(node(multiple, "Apple"));
  await click(node(multiple, "Cherry"));
  assert.deepEqual(multiple.value, ["Apple", "Cherry"]);
  assert.equal(multiple.isOpen, true);
  await key("escape");
  console.log(
    "Native Select keyboard, mouse, focus, controlled rejection, single and multiple selection, guards, dismissal and restoration passed."
  );
};

try {
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Select inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Keep the UI alive for external OS actions.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(single.value, "Cherry");
    assert.equal(single.isOpen, true);
    assert.equal(disabled.value, "Apple");
    assert.deepEqual(multiple.value, ["Apple", "Cherry"]);
  }
} finally {
  app.unmount();
}

process.exit(0);
