import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createCheckboxGroupState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import {
  createCheckboxGroup,
  createCheckboxGroupItem,
} from "../src/checkbox-group.js";
import { createButton } from "../src/controls.js";

const title = "GPUIX CheckboxGroup native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 400, title, width: 540 });

const app = createRoot(renderer, { keyboardFocusDim: false });
let before!: HostElement;
let after!: HostElement;
let news!: HostElement;
let offers!: HostElement;
let disabled!: HostElement;
let selected!: () => readonly string[];
let disable!: Setter<boolean>;
let readonly!: Setter<boolean>;
let accept = true;

const button = (name: string, attach: (el: HostElement) => void) => {
  let node: HostElement | null = null;
  const behavior = createButton({ "aria-label": name }, () => node);

  return jsx(
    "div",
    merge(behavior.buttonProps, {
      children: name,
      ref: (el: HostElement) => {
        node = el;
        attach(el);
      },
      style: { height: 36, padding: 8, width: 340 },
    })
  );
};

app.render(() => {
  const [value, setValue] = createSignal<string[]>(["news"]);
  const [isDisabled, setDisabled] = createSignal(false);
  const [isReadOnly, setReadOnly] = createSignal(false);
  disable = setDisabled;
  readonly = setReadOnly;
  selected = value;

  const state = createCheckboxGroupState({
    get isDisabled() {
      return isDisabled();
    },
    get isReadOnly() {
      return isReadOnly();
    },
    onChange: (next) => {
      if (accept) {
        setValue(next);
      }
    },
    get value() {
      return value();
    },
  });

  const group = createCheckboxGroup(
    {
      get "aria-description"() {
        return `Selected ${value().join(", ")}`;
      },
      "aria-label": "Topics",
    },
    state
  );

  const item = (
    name: string,
    isItemDisabled: boolean,
    attach: (el: HostElement) => void
  ) => {
    let node: HostElement | null = null;

    const checkbox = createCheckboxGroupItem(
      {
        get "aria-description"() {
          return state.isSelected(name.toLowerCase()) ? "Checked" : "Unchecked";
        },
        "aria-label": name,
        isDisabled: isItemDisabled,
        value: name.toLowerCase(),
      },
      state,
      () => node
    );

    return jsx(
      "div",
      merge(checkbox.inputProps, {
        get children() {
          return `${checkbox.isSelected ? "[x]" : "[ ]"} ${name}`;
        },
        ref: (el: HostElement) => {
          node = el;
          attach(el);
        },
        get style() {
          return {
            backgroundColor: checkbox.isSelected ? "#285f46" : "#e8edf2",
            borderRadius: 6,
            color: checkbox.isSelected ? "#ffffff" : "#102030",
            height: 42,
            opacity: checkbox.isDisabled ? 0.5 : 1,
            padding: 10,
            width: 340,
          };
        },
      })
    );
  };

  return jsx("div", {
    children: [
      jsx("text", { children: "Native Solid 2 checkbox group" }),
      button("Before", (node) => {
        before = node;
      }),
      jsx(
        "div",
        merge(group.groupProps, {
          children: [
            item("News", false, (node) => {
              news = node;
            }),
            item("Unavailable", true, (node) => {
              disabled = node;
            }),
            item("Offers", false, (node) => {
              offers = node;
            }),
          ],
          style: { display: "flex", flexDirection: "column", gap: 8 },
        })
      ),
      button("After", (node) => {
        after = node;
      }),
    ],
    style: {
      backgroundColor: "#ffffff",
      color: "#102030",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      height: "100%",
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
    const result = Bun.spawnSync([
      process.env.GPUIX_ARIA_XDOTOOL,
      "search",
      "--name",
      title,
      "windowfocus",
      "--sync",
    ]);

    assert.equal(result.exitCode, 0);
  }

  renderer.activateWindow();
  await settle();
  renderer.focusElement(before.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    news.id,
    "Tab enters at the first enabled checkbox"
  );
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    offers.id,
    "Tab skips the disabled checkbox"
  );
  await key("space");
  assert.deepEqual(selected(), ["news", "offers"]);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    after.id,
    "Tab leaves after the last checkbox"
  );
  await key("shift-tab");
  assert.equal(renderer.getFocusedElementId(), offers.id);
  await click(news);
  assert.deepEqual(selected(), ["offers"]);
  await click(disabled);
  assert.deepEqual(selected(), ["offers"]);
  await key("enter");
  assert.deepEqual(selected(), ["offers"]);
  accept = false;
  await click(news);
  assert.deepEqual(
    selected(),
    ["offers"],
    "A rejected controlled request leaves the native checkbox unchecked"
  );
  assert.equal(news.props.get("aria-checked"), false);
  accept = true;
  app.flushSync(() => {
    readonly(true);
  });
  await click(news);
  await key("space");
  assert.deepEqual(
    selected(),
    ["offers"],
    "Readonly blocks mouse and keyboard selection"
  );
  app.flushSync(() => {
    readonly(false);
    disable(true);
  });
  renderer.focusElement(before.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    after.id,
    "Tab skips a disabled group"
  );
  await click(news);
  assert.deepEqual(selected(), ["offers"]);
  app.flushSync(() => {
    disable(false);
  });
  console.log(
    "Native CheckboxGroup mouse, Space, Enter, independent Tab stops, disabled skipping, controlled requests, and readonly guards passed."
  );

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Checkbox group inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.deepEqual(
      selected(),
      ["offers", "news"],
      "AT-SPI Click must update controlled Solid state and ignore the disabled item"
    );
  }
} finally {
  app.unmount();
}

process.exit(0);
