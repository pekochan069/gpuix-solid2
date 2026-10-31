import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createDisclosureState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import { createButton } from "../src/controls.js";
import { createDisclosure } from "../src/disclosure.js";

const title = "GPUIX Disclosure native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 380, title, width: 540 });

const app = createRoot(renderer, { keyboardFocusDim: false });
let trigger!: HostElement;
let disabled!: HostElement;
let inside!: HostElement;
let after!: HostElement;
let expanded!: () => boolean;
let disable!: Setter<boolean>;
let accept = true;
const requests: boolean[] = [];

const button = (label: string, attach: (node: HostElement) => void) => {
  let node: HostElement | null = null;
  const behavior = createButton({ "aria-label": label }, () => node);

  return jsx(
    "div",
    merge(behavior.buttonProps, {
      children: label,
      ref: (element: HostElement) => {
        node = element;
        attach(element);
      },
      style: {
        backgroundColor: "#e8edf2",
        color: "#102030",
        height: 40,
        padding: 8,
        width: 400,
      },
    })
  );
};

app.render(() => {
  const [value, setValue] = createSignal(false);
  const [isDisabled, setDisabled] = createSignal(false);
  expanded = value;
  disable = setDisabled;

  const state = createDisclosureState({
    get isExpanded() {
      return value();
    },
    onExpandedChange(next) {
      requests.push(next);

      if (accept) {
        setValue(next);
      }
    },
  });

  const disclosure = createDisclosure(
    {
      get "aria-description"() {
        return value() ? "Expanded" : "Collapsed";
      },
      "aria-label": "Details",
      get isDisabled() {
        return isDisabled();
      },
    },
    state,
    () => trigger
  );

  const blocked = createDisclosure(
    { "aria-label": "Unavailable details", isDisabled: true },
    createDisclosureState({}),
    () => disabled
  );

  return jsx("div", {
    children: [
      jsx("text", { children: "Native Solid 2 disclosure" }),
      jsx(
        "div",
        merge(disclosure.buttonProps, {
          get children() {
            return `${disclosure.isExpanded ? "Collapse" : "Expand"} details`;
          },
          ref: (node: HostElement) => {
            trigger = node;
          },
          style: {
            backgroundColor: "#285f46",
            borderRadius: 6,
            color: "#ffffff",
            height: 44,
            padding: 10,
            width: 400,
          },
        })
      ),
      jsx(Show, {
        children: () =>
          jsx(
            "div",
            merge(disclosure.panelProps, {
              "aria-label": "Detail panel",
              children: [
                jsx("text", {
                  children: "The expanded panel is mounted in the native tree.",
                }),
                button("Panel action", (node) => {
                  inside = node;
                }),
              ],
              style: { backgroundColor: "#dcece4", gap: 8, padding: 12 },
            })
          ),
        get when() {
          return disclosure.isExpanded;
        },
      }),
      jsx(
        "div",
        merge(blocked.buttonProps, {
          children: "Unavailable details",
          ref: (node: HostElement) => {
            disabled = node;
          },
          style: { height: 40, opacity: 0.5, padding: 8 },
        })
      ),
      button("After", (node) => {
        after = node;
      }),
    ],
    style: {
      backgroundColor: "#ffffff",
      color: "#102030",
      gap: 10,
      padding: 20,
    },
  });
});

const settle = async () => {
  app.flush();
  renderer.tick();
  await Bun.sleep(80);
  app.flush();
};

const key = async (value: string) => {
  renderer.simulateKeyDown(value);
  renderer.simulateKeyUp(value);
  await settle();
};

const click = async (node: HostElement) => {
  const box = renderer.getElementBounds(node.id);
  assert.ok(box && box.width > 0 && box.height > 0);
  renderer.simulateClick(box.x + box.width / 2, box.y + box.height / 2);
  await settle();
};

try {
  if (process.env.GPUIX_ARIA_XDOTOOL !== undefined) {
    assert.equal(
      Bun.spawnSync([
        process.env.GPUIX_ARIA_XDOTOOL,
        "search",
        "--name",
        title,
        "windowfocus",
        "--sync",
      ]).exitCode,
      0
    );
  }

  renderer.activateWindow();
  await settle();
  renderer.focusElement(trigger.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    after.id,
    "Collapsed children and the disabled trigger are absent from Tab traversal"
  );
  await click(trigger);
  assert.equal(expanded(), true);
  assert.equal(inside.mounted, true);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), inside.id);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), after.id);
  await click(trigger);
  assert.equal(expanded(), false);
  assert.equal(inside.mounted, false);
  renderer.simulateKeyDown("space");
  await settle();
  assert.equal(expanded(), true, "Space expands on key-down");
  renderer.simulateKeyUp("space");
  await settle();
  assert.equal(expanded(), true, "Space release must not toggle twice");
  await key("enter");
  assert.equal(expanded(), false);
  accept = false;
  await click(trigger);
  assert.equal(
    expanded(),
    false,
    "A rejected request keeps the panel collapsed"
  );
  accept = true;
  app.flushSync(() => disable(true));
  await click(trigger);
  await key("space");
  assert.equal(expanded(), false);
  app.flushSync(() => disable(false));
  await click(disabled);
  assert.equal(disabled.props.get("aria-expanded"), false);
  assert.deepEqual(requests, [true, false, true, false, true]);
  console.log(
    "Native Disclosure mouse, keyboard, controlled requests, panel unmounting, Tab traversal, and disabled guards passed."
  );

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Disclosure inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(
      expanded(),
      true,
      "AT-SPI Click must expand the controlled disclosure"
    );
    assert.equal(disabled.props.get("aria-expanded"), false);
  }
} finally {
  app.unmount();
}

process.exit(0);
