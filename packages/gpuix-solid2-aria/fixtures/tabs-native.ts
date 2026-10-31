import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createTabListState, Item } from "gpuix-solid2-stately";
import type { Key } from "gpuix-solid2-stately/shared-types";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createButton } from "../src/controls.js";
import { I18nProvider } from "../src/i18n.js";
import { createTab, createTabList, createTabPanel } from "../src/tabs.js";

const title = "GPUIX Tabs native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 390, title, width: 620 });

const app = createRoot(renderer, { keyboardFocusDim: false });
const nodes = new Map<Key, HostElement>();
const panels = new Map<Key, HostElement>();
let list!: HostElement;
let action!: HostElement;
let after!: HostElement;
let selected!: () => Key;
let updateSelection!: Setter<Key>;
let manual!: Setter<boolean>;
let vertical!: Setter<boolean>;
let locale!: Setter<string>;
let disable!: Setter<boolean>;
let accept = true;
const requests: Key[] = [];

const items = [
  { id: "overview", label: "Overview" },
  { id: "blocked", label: "Unavailable" },
  { id: "settings", label: "Settings" },
];

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
      style: { backgroundColor: "#e8edf2", height: 40, padding: 8, width: 300 },
    })
  );
};

app.render(() => {
  const [value, setValue] = createSignal<Key>("overview");
  const [isManual, setManual] = createSignal(false);
  const [isVertical, setVertical] = createSignal(false);
  const [language, setLanguage] = createSignal("en-US");
  const [isDisabled, setDisabled] = createSignal(false);
  selected = value;
  updateSelection = setValue;
  manual = setManual;
  vertical = setVertical;
  locale = setLanguage;
  disable = setDisabled;

  return jsx(I18nProvider, {
    get children() {
      const state = createTabListState({
        children: (item: { id: string; label: string }) =>
          Item({ children: item.label, key: item.id, textValue: item.label }),
        disabledKeys: ["blocked"],
        get isDisabled() {
          return isDisabled();
        },
        items,
        onSelectionChange(next) {
          requests.push(next);

          if (accept) {
            setValue(next);
          }
        },
        get selectedKey() {
          return value();
        },
      });

      const tabs = createTabList(
        {
          "aria-label": "Workspace tabs",
          get keyboardActivation() {
            return isManual() ? "manual" : "automatic";
          },
          get orientation() {
            return isVertical() ? "vertical" : "horizontal";
          },
        },
        state,
        () => list
      );

      return jsx("div", {
        children: [
          jsx("text", { children: "Native Solid 2 tabs" }),
          jsx(
            "div",
            merge(tabs.tabListProps, {
              children: items.map((item) => {
                const tab = createTab(
                  {
                    get "aria-description"() {
                      return state.selectedKey === item.id
                        ? "Selected"
                        : "Not selected";
                    },
                    "aria-label": item.label,
                    key: item.id,
                  },
                  state,
                  () => nodes.get(item.id) ?? null
                );

                return jsx(
                  "div",
                  merge(tab.tabProps, {
                    children: item.label,
                    ref: (node: HostElement) => {
                      nodes.set(item.id, node);
                    },
                    get style() {
                      return {
                        backgroundColor: tab.isSelected ? "#285f46" : "#e8edf2",
                        borderRadius: 6,
                        color: tab.isSelected ? "#ffffff" : "#102030",
                        height: 44,
                        opacity: tab.isDisabled ? 0.5 : 1,
                        padding: 10,
                        width: 160,
                      };
                    },
                  })
                );
              }),
              ref: (node: HostElement) => {
                list = node;
              },
              get style() {
                return {
                  display: "flex",
                  flexDirection: isVertical() ? "column" : "row",
                  gap: 8,
                };
              },
            })
          ),
          For({
            children: (key: Key) =>
              jsx(
                "div",
                merge(
                  createTabPanel(
                    {
                      "aria-label": `${key === "overview" ? "Overview" : "Settings"} panel`,
                      id: key,
                      tabIndex: -1,
                    },
                    state
                  ).tabPanelProps,
                  {
                    children: [
                      jsx("text", {
                        children:
                          key === "overview"
                            ? "Overview content"
                            : "Settings content",
                      }),
                      button("Panel action", (node) => {
                        action = node;
                      }),
                    ],
                    ref: (node: HostElement) => {
                      panels.set(key, node);
                    },
                    style: { backgroundColor: "#dcece4", gap: 8, padding: 12 },
                  }
                )
              ),
            get each() {
              return [value()];
            },
          }),
          button("After tabs", (node) => {
            after = node;
          }),
        ],
        style: {
          backgroundColor: "#ffffff",
          color: "#102030",
          gap: 12,
          height: 390,
          padding: 20,
        },
      });
    },
    get locale() {
      return language();
    },
  });
});

const node = (key: Key) => {
  const value = nodes.get(key);
  assert.ok(value);

  return value;
};

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

const click = async (target: HostElement) => {
  const bounds = renderer.getElementBounds(target.id);
  assert.ok(bounds && bounds.width > 0 && bounds.height > 0);
  renderer.simulateClick(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  );
  await settle();
};

try {
  renderer.activateWindow();
  await settle();
  const firstBounds = renderer.getElementBounds(node("overview").id);
  const lastBounds = renderer.getElementBounds(node("settings").id);
  assert.ok(firstBounds && lastBounds && lastBounds.x > firstBounds.x);
  assert.equal(firstBounds.y, lastBounds.y, "Horizontal tabs share a row");
  await click(node("settings"));
  assert.equal(selected(), "settings");
  assert.equal(panels.get("overview")?.mounted, false);
  renderer.focusElement(node("settings").id);
  await key("right");
  assert.equal(selected(), "overview", "Automatic arrows wrap");
  assert.equal(renderer.getFocusedElementId(), node("overview").id);
  await key("right");
  assert.equal(selected(), "settings", "Arrows skip disabled tabs");
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), action.id);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), after.id);
  app.flushSync(() => updateSelection("overview"));
  await settle();
  await key("shift-tab");
  assert.equal(renderer.getFocusedElementId(), action.id);
  await key("shift-tab");
  assert.equal(
    renderer.getFocusedElementId(),
    node("overview").id,
    "Reentry follows external selection after focus leaves the list"
  );
  await click(node("settings"));
  app.flushSync(() => manual(true));
  await key("left");
  assert.equal(selected(), "settings");
  assert.equal(renderer.getFocusedElementId(), node("overview").id);
  renderer.simulateKeyDown("space");
  await settle();
  assert.equal(selected(), "overview", "Manual Space selects on key-down");
  renderer.simulateKeyUp("space");
  await key("end");
  assert.equal(selected(), "overview");
  await key("enter");
  assert.equal(selected(), "settings");
  app.flushSync(() => {
    manual(false);
    vertical(true);
    locale("ar-AE");
  });
  await key("down");
  assert.equal(selected(), "overview");
  const verticalFirst = renderer.getElementBounds(node("overview").id);
  const verticalLast = renderer.getElementBounds(node("settings").id);
  assert.ok(verticalFirst && verticalLast && verticalLast.y > verticalFirst.y);
  await key("left");
  assert.equal(
    selected(),
    "settings",
    "RTL Left moves forward, including vertical lists"
  );
  await key("home");
  assert.equal(selected(), "overview");
  accept = false;
  await click(node("settings"));
  assert.equal(requests.at(-1), "settings");
  assert.equal(
    selected(),
    "overview",
    "Rejected controlled requests preserve the panel"
  );
  accept = true;
  app.flushSync(() => disable(true));
  await click(node("settings"));
  await key("enter");
  assert.equal(selected(), "overview");
  app.flushSync(() => {
    disable(false);
    vertical(false);
    locale("en-US");
  });
  await settle();
  await click(node("blocked"));
  assert.equal(selected(), "overview");
  console.log(
    "Native Tabs mouse, automatic/manual keys, wrapping, RTL, panels, Tab traversal, disabled guards, and controlled rejection passed."
  );

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Tabs inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(
      selected(),
      "settings",
      "AT-SPI Click must select the controlled tab"
    );
    assert.equal(panels.get("overview")?.mounted, false);
  }
} finally {
  app.unmount();
}

process.exit(0);
