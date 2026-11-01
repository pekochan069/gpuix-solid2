import { expect, test } from "bun:test";

import type { HostElement, KeyEvent } from "gpuix-solid2";
import { createToggleState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import { createButton, createToggleButton } from "../src/controls.js";
import { I18nProvider } from "../src/i18n.js";
import { createToolbar } from "../src/toolbar.js";
import { setup } from "./support.js";

const mount = () => {
  const app = setup();
  const nodes = new Map<string, HostElement>();
  let container!: HostElement;
  let disable!: Setter<boolean>;
  let show!: Setter<boolean>;
  let orientation!: Setter<"horizontal" | "vertical">;
  let locale!: Setter<string>;
  let selected!: () => boolean;
  let actions = 0;
  let focusEvents = 0;
  let consumeArrow = false;

  app.root.render(() => {
    const [language, setLanguage] = createSignal("en-US");
    locale = setLanguage;

    return jsx(I18nProvider, {
      get children() {
        const [disabled, setDisabled] = createSignal(false);
        const [visible, setVisible] = createSignal(true);

        const [direction, setDirection] = createSignal<
          "horizontal" | "vertical"
        >("horizontal");

        disable = setDisabled;
        show = setVisible;
        orientation = setDirection;
        const state = createToggleState();
        selected = () => state.isSelected;

        const toolbar = createToolbar(
          {
            "aria-description": "Editing commands",
            "aria-label": "Editing",
            get orientation() {
              return direction();
            },
          },
          () => container
        );

        const item = (name: string) => {
          let node: HostElement | null = null;

          const props = {
            "aria-label": name,
            get isDisabled() {
              return name === "Disabled" || (name === "Bold" && disabled());
            },
            onFocus() {
              focusEvents += 1;
            },
            onPress() {
              actions += 1;
            },
          };

          const control =
            name === "Bold"
              ? createToggleButton(props, state, () => node)
              : createButton(props, () => node);

          const itemProps = toolbar.createItem(
            merge(control.buttonProps, {
              onKeyDown(event: KeyEvent) {
                control.buttonProps.onKeyDown?.(event);

                if (consumeArrow && event.key === "right") {
                  event.preventDefault();
                }
              },
            }),
            () => node
          );

          return jsx(
            "div",
            merge(itemProps, {
              children: name,
              ref(element: HostElement) {
                node = element;
                nodes.set(name, element);
              },
            })
          );
        };

        // Register in a different order from the native tree.
        const bold = item("Bold");
        const copy = item("Copy");

        return jsx(
          "div",
          merge(toolbar.toolbarProps, {
            children: [
              copy,
              item("Disabled"),
              jsx("div", { children: bold }),
              jsx(Show, {
                children: () => item("Paste"),
                get when() {
                  return visible();
                },
              }),
            ],
            ref(element: HostElement) {
              container = element;
            },
          })
        );
      },
      get locale() {
        return language();
      },
    });
  });

  const node = (name: string) => {
    const result = nodes.get(name);

    if (!result) {
      throw new Error(`Missing ${name}`);
    }

    return result;
  };

  return {
    ...app,
    actions: () => actions,
    consumeArrow: () => {
      consumeArrow = true;
    },
    container,
    disable,
    focusEvents: () => focusEvents,
    locale,
    node,
    orientation,
    selected,
    show,
    stops: () =>
      ["Copy", "Disabled", "Bold", "Paste"].map((name) =>
        node(name).props.get("tabIndex")
      ),
  };
};

test("toolbar registers controls in tree order, skips disabled items, and does not wrap or activate", () => {
  const app = mount();
  expect(app.container.props.get("role")).toBe("toolbar");
  expect(app.container.props.get("aria-label")).toBe("Editing");
  expect(app.container.props.get("aria-description")).toBe("Editing commands");
  expect(app.stops()).toEqual([0, -1, -1, -1]);
  expect(app.send(app.node("Copy"), "keyDown", { key: "right" })).toBe(true);
  expect(app.focusCalls).toEqual([app.node("Bold").id]);
  expect(app.stops()).toEqual([-1, -1, 0, -1]);
  expect(app.selected()).toBe(false);
  expect(app.actions()).toBe(0);
  app.send(app.node("Bold"), "keyDown", { key: "right" });
  app.send(app.node("Paste"), "keyDown", { key: "right" });
  expect(app.focusCalls).toEqual([app.node("Bold").id, app.node("Paste").id]);
  app.send(app.node("Paste"), "keyDown", { key: "left" });
  expect(app.focusCalls.at(-1)).toBe(app.node("Bold").id);
});

test("toolbar preserves button, toggle, mouse, OS Click, and focus handlers", () => {
  const app = mount();
  const bold = app.node("Bold");
  app.send(bold, "focus");
  expect(app.focusEvents()).toBe(1);
  app.send(bold, "keyDown", { key: "enter" });
  app.send(bold, "keyUp", { key: "enter" });
  expect(app.selected()).toBe(true);
  app.send(bold, "keyDown", { key: "space" });
  expect(app.selected()).toBe(true);
  app.send(bold, "keyUp", { key: "space" });
  expect(app.selected()).toBe(false);
  app.send(bold, "mouseDown", { button: 0 });
  app.send(bold, "mouseUp", { button: 0 });
  app.send(bold, "click", { button: 0, x: 1, y: 1 });
  expect(app.selected()).toBe(true);
  app.send(bold, "click");
  expect(app.selected()).toBe(false);
  expect(app.actions()).toBe(4);
  app.send(app.node("Disabled"), "click");
  expect(app.actions()).toBe(4);
});

test("toolbar remembers pointer focus, replaces removed or disabled Tab stops, and cleans up", () => {
  const app = mount();
  const paste = app.node("Paste");
  app.send(paste, "focus");
  app.send(paste, "blur");
  expect(app.stops()).toEqual([-1, -1, -1, 0]);
  app.root.flushSync(() => {
    app.show(false);
  });
  expect(app.node("Copy").props.get("tabIndex")).toBe(0);
  app.send(app.node("Bold"), "focus");
  app.root.flushSync(() => {
    app.disable(true);
  });
  expect(app.node("Copy").props.get("tabIndex")).toBe(0);
  app.send(app.node("Copy"), "keyDown", { key: "right" });
  expect(app.focusCalls).toEqual([]);
  app.root.flushSync(() => {
    app.disable(false);
  });
  expect(app.node("Bold").props.get("tabIndex")).toBe(0);
  app.send(paste, "click");
  expect(app.actions()).toBe(0);
  app.root.unmount();
  app.send(app.node("Bold"), "click");
  expect(app.actions()).toBe(0);
});

test("toolbar respects reactive vertical orientation and horizontal RTL", () => {
  const app = mount();
  app.root.flushSync(() => {
    app.locale("ar");
  });
  app.send(app.node("Copy"), "keyDown", { key: "left" });
  expect(app.focusCalls.at(-1)).toBe(app.node("Bold").id);
  app.send(app.node("Bold"), "keyDown", { key: "right" });
  expect(app.focusCalls.at(-1)).toBe(app.node("Copy").id);
  app.root.flushSync(() => {
    app.orientation("vertical");
  });
  expect(app.container.props.get("aria-orientation")).toBe("vertical");
  app.send(app.node("Copy"), "keyDown", { key: "down" });
  expect(app.focusCalls.at(-1)).toBe(app.node("Bold").id);
  app.send(app.node("Bold"), "keyDown", { key: "up" });
  expect(app.focusCalls.at(-1)).toBe(app.node("Copy").id);
});

test("toolbar leaves Tab, unrelated keys, modified keys, and consumed child arrows alone", () => {
  const app = mount();

  for (const key of ["tab", "down", "home", "end"]) {
    expect(app.send(app.node("Copy"), "keyDown", { key })).toBe(true);
  }

  for (const modifier of ["ctrl", "alt", "cmd"]) {
    app.send(app.node("Copy"), "keyDown", {
      key: "right",
      modifiers: {
        alt: modifier === "alt",
        cmd: modifier === "cmd",
        ctrl: modifier === "ctrl",
        shift: false,
      },
    });
  }

  app.consumeArrow();
  app.send(app.node("Copy"), "keyDown", { key: "right" });
  app.send(app.node("Disabled"), "keyDown", { key: "right" });
  expect(app.focusCalls).toEqual([]);
});
