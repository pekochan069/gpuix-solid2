import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createToggleGroupState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createButton } from "../src/controls.js";
import { I18nProvider } from "../src/i18n.js";
import {
  createToggleButtonGroup,
  createToggleButtonGroupItem,
} from "../src/toggle-button-group.js";

const title = "GPUIX ToggleButtonGroup native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 490, title, width: 600 });

const app = createRoot(renderer, { keyboardFocusDim: false });
const nodes = new Map<string, HostElement>();
let single!: () => Set<string | number>;
let multiple!: () => Set<string | number>;
let disable!: Setter<boolean>;
let locale!: Setter<string>;
let orientation!: Setter<"horizontal" | "vertical">;
let accept = true;

const node = (name: string) => {
  const element = nodes.get(name);
  assert.ok(element, `Missing ${name}`);

  return element;
};

const button = (name: string) => {
  const behavior = createButton(
    { "aria-label": name },
    () => nodes.get(name) ?? null
  );

  return jsx(
    "div",
    merge(behavior.buttonProps, {
      children: name,
      ref: (element: HostElement) => {
        nodes.set(name, element);
      },
      style: { height: 36, padding: 8, width: 440 },
    })
  );
};

app.render(() => {
  const [currentLocale, setLocale] = createSignal("en-US");
  locale = setLocale;

  return jsx(I18nProvider, {
    get children() {
      const [value, setValue] = createSignal(
        new Set<string | number>(["Left"])
      );

      const [isDisabled, setDisabled] = createSignal(false);

      const [direction, setDirection] = createSignal<"horizontal" | "vertical">(
        "horizontal"
      );

      disable = setDisabled;
      orientation = setDirection;

      const singleState = createToggleGroupState({
        disallowEmptySelection: true,
        get isDisabled() {
          return isDisabled();
        },
        onSelectionChange(next) {
          if (accept) {
            setValue(next);
          }
        },
        get selectedKeys() {
          return value();
        },
      });

      const multipleState = createToggleGroupState({
        defaultSelectedKeys: ["Bold"],
        selectionMode: "multiple",
      });

      single = () => singleState.selectedKeys;
      multiple = () => multipleState.selectedKeys;

      const group = (
        name: string,
        state: typeof singleState,
        names: string[]
      ) => {
        let container: HostElement | null = null;

        const behavior = createToggleButtonGroup(
          {
            get "aria-description"() {
              return `Selected ${[...state.selectedKeys].join(", ")}`;
            },
            "aria-label": name,
            get orientation() {
              return direction();
            },
          },
          state,
          () => container
        );

        return jsx(
          "div",
          merge(behavior.groupProps, {
            children: names.map((label) => {
              let element: HostElement | null = null;

              const item = createToggleButtonGroupItem(
                {
                  get "aria-description"() {
                    return state.selectedKeys.has(label)
                      ? "Selected"
                      : "Unselected";
                  },
                  "aria-label": label,
                  id: label,
                  isDisabled: label === "Unavailable",
                },
                state,
                () => element
              );

              return jsx(
                "div",
                merge(item.buttonProps, {
                  get children() {
                    return `${item.isSelected ? "[x]" : "[ ]"} ${label}`;
                  },
                  ref: (el: HostElement) => {
                    element = el;
                    nodes.set(label, el);
                  },
                  get style() {
                    return {
                      backgroundColor: item.isSelected ? "#285f46" : "#e8edf2",
                      borderRadius: 6,
                      color: item.isSelected ? "#ffffff" : "#102030",
                      height: 42,
                      opacity: item.isDisabled ? 0.5 : 1,
                      padding: 10,
                      width: 440,
                    };
                  },
                })
              );
            }),
            ref: (element: HostElement) => {
              container = element;
            },
            style: { display: "flex", flexDirection: "column", gap: 8 },
          })
        );
      };

      return jsx("div", {
        children: [
          jsx("text", { children: "Native Solid 2 toggle button groups" }),
          button("Before"),
          group("Alignment", singleState, ["Left", "Unavailable", "Right"]),
          group("Formatting", multipleState, ["Bold", "Italic"]),
          button("After"),
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
    },
    get locale() {
      return currentLocale();
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

const focused = (name: string) => {
  assert.equal(
    renderer.getFocusedElementId(),
    node(name).id,
    `Focus should be on ${name}`
  );
};

const click = async (name: string) => {
  const bounds = renderer.getElementBounds(node(name).id);
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
  renderer.simulateClick(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  );
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
  renderer.focusElement(node("Before").id);
  await key("tab");
  focused("Left");
  await key("right");
  focused("Right");
  assert.deepEqual([...single()], ["Left"], "Arrows must not select");
  await key("right");
  focused("Right");
  await key("enter");
  assert.deepEqual([...single()], ["Right"]);
  await key("tab");
  focused("Bold");
  await key("tab");
  focused("After");
  await key("shift-tab");
  focused("Bold");
  await key("right");
  focused("Italic");
  await key("space");
  assert.deepEqual([...multiple()], ["Bold", "Italic"]);
  await key("tab");
  focused("After");
  await key("shift-tab");
  focused("Italic");
  await key("shift-tab");
  focused("Right");
  await click("Left");
  assert.deepEqual([...single()], ["Left"]);
  await click("Unavailable");
  assert.deepEqual([...single()], ["Left"]);
  accept = false;
  await click("Right");
  assert.deepEqual([...single()], ["Left"]);
  assert.equal(node("Right").props.get("aria-checked"), false);
  accept = true;
  app.flushSync(() => {
    locale("ar");
  });
  renderer.focusElement(node("Left").id);
  await key("left");
  focused("Right");
  app.flushSync(() => {
    orientation("vertical");
  });
  await key("up");
  focused("Left");
  await key("down");
  focused("Right");
  assert.deepEqual([...single()], ["Left"]);
  app.flushSync(() => {
    disable(true);
  });
  renderer.focusElement(node("Before").id);
  await key("tab");
  focused("Italic");
  await click("Right");
  assert.deepEqual([...single()], ["Left"]);
  app.flushSync(() => {
    disable(false);
    locale("en-US");
    orientation("horizontal");
  });
  await click("Italic");
  assert.deepEqual([...multiple()], ["Bold"]);
  console.log(
    "Native ToggleButtonGroup mouse, Enter, Space, single and multiple selection, Tab exit and reentry, disabled skipping, controlled rejection, orientation and RTL passed."
  );

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Toggle button group inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.deepEqual(
      [...single()],
      ["Right"],
      "OS Click must update controlled selection and reject disabled activation"
    );
    assert.deepEqual(
      [...multiple()],
      ["Bold", "Italic"],
      "OS Click must update multiple selection"
    );
  }
} finally {
  app.unmount();
}

process.exit(0);
