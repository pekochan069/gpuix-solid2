import { expect, test } from "bun:test";

import type { HostElement, KeyEvent } from "gpuix-solid2";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createBreadcrumbItem, createBreadcrumbs } from "../src/breadcrumbs.js";
import { createLink } from "../src/link.js";
import type { LinkProps } from "../src/link.js";
import { setup } from "./support.js";

const mount = (breadcrumb = false, props: LinkProps = {}) => {
  const app = setup();
  let element!: HostElement;
  let nav!: HostElement;
  let disable!: Setter<boolean>;
  let current!: Setter<boolean>;
  let label!: Setter<string>;
  let behavior!: ReturnType<typeof createLink>;
  const presses: string[] = [];
  const changes: boolean[] = [];
  const focuses: boolean[] = [];
  const keys: KeyEvent[] = [];

  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);
    const [isCurrent, setCurrent] = createSignal(false);
    const [name, setName] = createSignal("Home");
    disable = setDisabled;
    current = setCurrent;
    label = setName;

    const options = merge(
      {
        "aria-description": "Open the home page",
        get "aria-label"() {
          return name();
        },
        get isDisabled() {
          return disabled();
        },
        onFocusChange(value: boolean) {
          focuses.push(value);
        },
        onPress(event: Parameters<NonNullable<LinkProps["onPress"]>>[0]) {
          presses.push(event.pointerType);
        },
        onPressChange(value: boolean) {
          changes.push(value);
        },
      },
      props
    );

    let controlProps;

    if (breadcrumb) {
      controlProps = createBreadcrumbItem(
        merge(options, {
          get isCurrent() {
            return isCurrent();
          },
        }),
        () => element
      ).itemProps;
    } else {
      behavior = createLink(options, () => element);
      controlProps = behavior.linkProps;
    }

    return jsx(
      "div",
      merge(
        createBreadcrumbs({
          "aria-description": "Page hierarchy",
          get "aria-label"() {
            return name();
          },
        }).navProps,
        {
          children: jsx(
            "div",
            merge(controlProps, {
              onKeyDown(event: KeyEvent) {
                controlProps.onKeyDown?.(event);
                keys.push(event);
              },
              ref(node: HostElement) {
                element = node;
              },
            })
          ),
          ref(node: HostElement) {
            nav = node;
          },
        }
      )
    );
  });

  return {
    ...app,
    behavior: () => behavior,
    changes,
    current,
    disable,
    element,
    focuses,
    keys,
    label,
    nav,
    presses,
  };
};

test("native links activate on normalized Enter without repeats, and leave Space and modified keys alone", () => {
  const app = mount();
  expect(app.element.props.get("role")).toBe("link");
  expect(app.element.props.get("tabIndex")).toBe(0);
  app.send(app.element, "keyDown", { key: "space" });
  expect(app.keys.at(-1)?.defaultPrevented).toBe(false);
  app.send(app.element, "keyUp", { key: "space" });
  expect(app.presses).toEqual([]);
  expect(app.changes).toEqual([]);
  app.send(app.element, "keyDown", {
    key: "enter",
    modifiers: { alt: false, cmd: false, ctrl: true, shift: false },
  });
  expect(app.presses).toEqual([]);
  expect(app.send(app.element, "keyDown", { key: "return" })).toBe(true);
  expect(app.behavior().isPressed).toBe(true);
  app.send(app.element, "keyDown", { isHeld: true, key: "enter" });
  expect(app.presses).toEqual(["keyboard"]);
  app.send(app.element, "keyUp", { key: "Enter" });
  expect(app.behavior().isPressed).toBe(false);
  expect(app.changes).toEqual([true, false]);
});

test("native links preserve pointer, OS Click, focus callbacks, and reactive labels", () => {
  const app = mount();
  app.send(app.element, "mouseDown", { button: 0 });
  app.send(app.element, "mouseUp", { button: 0 });
  app.send(app.element, "click", { button: 0, x: 1, y: 1 });
  app.send(app.element, "click");
  app.send(app.element, "click", { button: 2 });
  expect(app.presses).toEqual(["mouse", "virtual"]);
  expect(app.focusCalls).toEqual([app.element.id]);
  app.send(app.element, "focus");
  expect(app.behavior().isFocused).toBe(true);
  app.send(app.element, "blur");
  expect(app.behavior().isFocused).toBe(false);
  expect(app.focuses).toEqual([true, false]);
  app.root.flushSync(() => app.label("Projects"));
  expect(app.element.props.get("aria-label")).toBe("Projects");
  expect(app.element.props.get("aria-description")).toBe("Open the home page");
  expect(app.nav.props.get("role")).toBe("navigation");
  expect(app.nav.props.get("aria-label")).toBe("Projects");
  expect(app.nav.props.get("aria-description")).toBe("Page hierarchy");
});

test("disabling a link cancels a pending press and blocks keys, pointer, and OS actions", () => {
  const app = mount();
  app.send(app.element, "mouseDown");
  expect(app.behavior().isPressed).toBe(true);
  app.root.flushSync(() => app.disable(true));
  expect(app.behavior().isPressed).toBe(false);
  expect(app.element.props.get("aria-disabled")).toBe(true);
  expect(app.element.props.get("tabIndex")).toBe(-1);
  app.send(app.element, "mouseUp");
  app.send(app.element, "click", { x: 1, y: 1 });
  app.send(app.element, "click");
  app.send(app.element, "keyDown", { key: "enter" });
  app.send(app.element, "keyUp", { key: "enter" });
  expect(app.presses).toEqual([]);
  expect(app.changes).toEqual([true, false]);
  app.root.flushSync(() => app.disable(false));
  app.send(app.element, "click");
  expect(app.presses).toEqual(["virtual"]);
});

test("links preserve explicit Tab and current props and cancel on blur and disposal", () => {
  const app = mount(false, { "aria-current": "location", tabIndex: -1 });
  expect(app.element.props.get("aria-current")).toBe("location");
  expect(app.element.props.get("tabIndex")).toBe(-1);
  app.send(app.element, "mouseDown");
  app.send(app.element, "blur");
  expect(app.behavior().isPressed).toBe(false);
  app.send(app.element, "mouseDown");
  app.root.unmount();
  expect(app.changes).toEqual([true, false, true, false]);
  expect(app.presses).toEqual([]);
});

test("current breadcrumbs block activation and leave Tab order, then reactivate when current changes", () => {
  const app = mount(true);
  app.send(app.element, "click");
  expect(app.presses).toEqual(["virtual"]);
  app.root.flushSync(() => app.current(true));
  expect(app.element.props.get("aria-current")).toBe("page");
  expect(app.element.props.get("aria-disabled")).toBe(false);
  expect(app.element.props.get("tabIndex")).toBe(-1);
  app.send(app.element, "keyDown", { key: "enter" });
  app.send(app.element, "mouseDown");
  app.send(app.element, "mouseUp");
  app.send(app.element, "click");
  expect(app.presses).toEqual(["virtual"]);
  app.root.flushSync(() => app.current(false));
  expect(app.element.props.get("aria-current")).toBeUndefined();
  expect(app.element.props.get("tabIndex")).toBe(0);
  app.send(app.element, "keyDown", { key: "enter" });
  expect(app.presses).toEqual(["virtual", "keyboard"]);
});

test("breadcrumb current tokens and explicit disabled state stay independent", () => {
  const app = mount(true, { "aria-current": "step" });
  app.root.flushSync(() => {
    app.current(true);
    app.disable(true);
  });
  expect(app.element.props.get("aria-current")).toBe("step");
  expect(app.element.props.get("aria-disabled")).toBe(true);
  app.root.flushSync(() => app.current(false));
  expect(app.element.props.get("aria-current")).toBeUndefined();
  expect(app.element.props.get("tabIndex")).toBe(-1);
  app.send(app.element, "click");
  expect(app.presses).toEqual([]);
});
