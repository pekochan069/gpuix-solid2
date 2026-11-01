import assert from "node:assert/strict";

import { GpuixRenderer } from "@gpuix/native";
import { createRoot } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createToggleState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import { createButton, createToggleButton } from "../src/controls.js";
import { I18nProvider } from "../src/i18n.js";
import { createToolbar } from "../src/toolbar.js";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({
  height: 430,
  title: "GPUIX Toolbar native verification",
  width: 600,
});

const app = createRoot(renderer, { keyboardFocusDim: false });
const nodes = new Map<string, HostElement>();
let locale!: Setter<string>;
let orientation!: Setter<"horizontal" | "vertical">;
let disable!: Setter<boolean>;
let show!: Setter<boolean>;
let selected!: () => boolean;
let actions!: () => number;

const node = (name: string) => {
  const result = nodes.get(name);
  assert.ok(result, `Missing ${name}`);

  return result;
};

app.render(() => {
  const [language, setLanguage] = createSignal("en-US");
  locale = setLanguage;

  return jsx(I18nProvider, {
    get children() {
      const [direction, setDirection] = createSignal<"horizontal" | "vertical">(
        "horizontal"
      );

      const [disabled, setDisabled] = createSignal(false);
      const [visible, setVisible] = createSignal(true);
      const [count, setCount] = createSignal(0);
      orientation = setDirection;
      disable = setDisabled;
      show = setVisible;
      actions = count;
      const state = createToggleState();
      selected = () => state.isSelected;
      let container: HostElement | null = null;

      const toolbar = createToolbar(
        {
          "aria-description": "Arrow keys move between editing controls.",
          "aria-label": "Editing commands",
          get orientation() {
            return direction();
          },
        },
        () => container
      );

      const button = (name: string, inToolbar = false) => {
        let element: HostElement | null = null;

        const props = {
          get "aria-description"() {
            return `Actions: ${count()}. Bold: ${state.isSelected}.`;
          },
          "aria-label": name,
          get isDisabled() {
            return name === "Unavailable" || (name === "Bold" && disabled());
          },
          onPress() {
            setCount((value) => value + 1);
          },
        };

        const behavior =
          name === "Bold"
            ? createToggleButton(props, state, () => element)
            : createButton(props, () => element);

        const buttonProps = inToolbar
          ? toolbar.createItem(behavior.buttonProps, () => element)
          : behavior.buttonProps;

        return jsx(
          "div",
          merge(buttonProps, {
            children: name,
            ref(value: HostElement) {
              element = value;
              nodes.set(name, value);
            },
            style: {
              backgroundColor: "#d9e8f2",
              height: 38,
              padding: 8,
              width: 420,
            },
          })
        );
      };

      return jsx("div", {
        children: [
          button("Before toolbar"),
          jsx(
            "div",
            merge(toolbar.toolbarProps, {
              children: [
                button("Copy", true),
                button("Unavailable", true),
                button("Bold", true),
                jsx(Show, {
                  children: () => button("Paste", true),
                  get when() {
                    return visible();
                  },
                }),
              ],
              ref(value: HostElement) {
                container = value;
                nodes.set("Toolbar", value);
              },
              style: {
                borderColor: "#466987",
                borderWidth: 2,
                gap: 8,
                padding: 8,
              },
            })
          ),
          button("After toolbar"),
        ],
        style: { backgroundColor: "#f6f8fb", gap: 12, padding: 20 },
      });
    },
    get locale() {
      return language();
    },
  });
});

const settle = async () => {
  for (let index = 0; index < 8; index += 1) {
    renderer.tick();
    // oxlint-disable-next-line no-await-in-loop -- Pump native events before checking focus.
    await Bun.sleep(15);
    app.flush();
  }
};

const key = async (name: string) => {
  renderer.simulateKeyDown(name);
  renderer.simulateKeyUp(name);
  await settle();
};

const focusIs = (name: string) => {
  assert.equal(
    renderer.getFocusedElementId(),
    node(name).id,
    `Expected focus on ${name}`
  );
};

const click = async (name: string) => {
  const element = node(name);
  const bounds = renderer.getElementBounds(element.id);
  assert.ok(bounds && bounds.height > 0 && bounds.width > 0);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  assert.ok(renderer.getElementsAt(x, y).includes(element.id));
  renderer.simulateClick(x, y);
  await settle();
};

const verify = async () => {
  renderer.activateWindow();
  await settle();
  renderer.focusElement(node("Before toolbar").id);
  await key("tab");
  focusIs("Copy");
  await key("right");
  focusIs("Bold");
  assert.equal(selected(), false);
  assert.equal(actions(), 0);
  await key("right");
  focusIs("Paste");
  await key("right");
  focusIs("Paste");
  await key("tab");
  focusIs("After toolbar");
  await key("shift-tab");
  focusIs("Paste");
  await key("left");
  focusIs("Bold");
  await key("enter");
  assert.equal(selected(), true);
  await key("space");
  assert.equal(selected(), false);
  assert.equal(actions(), 2);
  await click("Copy");
  focusIs("Copy");
  assert.equal(actions(), 3);
  await key("shift-tab");
  focusIs("Before toolbar");
  await key("tab");
  focusIs("Copy");
  await click("Unavailable");
  assert.equal(actions(), 3);
  renderer.focusElement(node("Copy").id);
  await settle();
  app.flushSync(() => {
    locale("ar");
  });
  await key("left");
  focusIs("Bold");
  app.flushSync(() => {
    orientation("vertical");
  });
  await key("down");
  focusIs("Paste");
  await key("up");
  focusIs("Bold");
  app.flushSync(() => {
    disable(true);
  });
  renderer.focusElement(node("Copy").id);
  await key("down");
  focusIs("Paste");
  app.flushSync(() => {
    show(false);
  });
  await settle();
  assert.equal(node("Copy").props.get("tabIndex"), 0);
  renderer.focusElement(node("Before toolbar").id);
  await key("tab");
  focusIs("Copy");
  await key("down");
  focusIs("Copy");
  app.flushSync(() => {
    disable(false);
    show(true);
    orientation("horizontal");
    locale("en-US");
  });
  await settle();
  console.log(
    "Native Toolbar Tab entry, exit and restoration, arrows, disabled skipping, RTL, vertical navigation, button and toggle actions, pointer hit testing and removal passed."
  );
};

try {
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Toolbar inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Keep the native window alive for OS inspection.
      await Bun.sleep(100);
      app.flush();
    }
  }
} finally {
  app.unmount();
}

process.exit(0);
