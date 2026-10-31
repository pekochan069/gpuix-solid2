import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createDisclosureState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import { createDisclosure } from "../src/disclosure.js";
import { setup } from "./support.js";

test("Disclosure toggles on keyboard start, mouse release, and OS Click", () => {
  const app = setup();
  let trigger!: HostElement;
  let panel: HostElement | null = null;
  const readPanel = () => panel;
  const changes: boolean[] = [];
  const callbacks: string[] = [];
  app.root.render(() => {
    const state = createDisclosureState({
      onExpandedChange: (next) => {
        changes.push(next);
      },
    });

    const disclosure = createDisclosure(
      {
        "aria-label": "Details",
        onPress: (event) => {
          callbacks.push(event.pointerType);
        },
      },
      state,
      () => trigger
    );

    return [
      jsx(
        "div",
        merge(disclosure.buttonProps, {
          ref: (node: HostElement) => {
            trigger = node;
          },
        })
      ),
      jsx(Show, {
        children: () =>
          jsx(
            "div",
            merge(disclosure.panelProps, {
              ref: (node: HostElement) => {
                panel = node;
              },
            })
          ),
        get when() {
          return disclosure.isExpanded;
        },
      }),
    ];
  });

  expect(trigger.props.get("aria-expanded")).toBe(false);
  expect(panel).toBeNull();
  app.send(trigger, "keyDown", { key: "space" });
  expect(trigger.props.get("aria-expanded")).toBe(true);
  const firstPanel = readPanel();
  expect(firstPanel?.mounted).toBe(true);
  expect(firstPanel?.props.get("aria-id")).toBe(
    trigger.props.get("aria-controls")
  );
  expect(firstPanel?.props.get("aria-labelledby")).toBe(
    trigger.props.get("aria-id")
  );
  expect(firstPanel?.props.get("role")).toBe("group");
  app.send(trigger, "keyDown", { isHeld: true, key: "space" });
  app.send(trigger, "keyUp", { key: "space" });
  expect(changes).toEqual([true]);
  app.send(trigger, "keyDown", { key: "return" });
  expect(firstPanel?.mounted).toBe(false);
  app.send(trigger, "keyUp", { key: "return" });
  app.send(trigger, "mouseDown", { button: 0 });
  expect(changes).toEqual([true, false]);
  app.send(trigger, "mouseUp", { button: 0 });
  app.send(trigger, "click", { button: 0, x: 1, y: 1 });
  app.send(trigger, "click");
  expect(changes).toEqual([true, false, true, false]);
  expect(callbacks).toEqual(["keyboard", "keyboard", "mouse", "virtual"]);
});

test("Controlled expansion follows accepted requests and external state", () => {
  const app = setup();
  let trigger!: HostElement;
  let accept = false;
  let update!: Setter<boolean>;
  const requests: boolean[] = [];
  app.root.render(() => {
    const [expanded, setExpanded] = createSignal(true);
    update = setExpanded;

    const state = createDisclosureState({
      get isExpanded() {
        return expanded();
      },
      onExpandedChange(next) {
        requests.push(next);

        if (accept) {
          setExpanded(next);
        }
      },
    });

    const disclosure = createDisclosure({}, state, () => trigger);

    return jsx(
      "div",
      merge(disclosure.buttonProps, {
        ref: (node: HostElement) => {
          trigger = node;
        },
      })
    );
  });

  app.send(trigger, "click");
  expect(requests).toEqual([false]);
  expect(trigger.props.get("aria-expanded")).toBe(true);
  accept = true;
  app.send(trigger, "click");
  expect(trigger.props.get("aria-expanded")).toBe(false);
  app.root.flushSync(() => update(true));
  expect(trigger.props.get("aria-expanded")).toBe(true);
});

test("Defaults, reactive disabled guards, cancellation, and disposal", () => {
  const app = setup();
  let trigger!: HostElement;
  let disable!: Setter<boolean>;
  let defaults!: Setter<boolean>;
  const changes: boolean[] = [];
  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);
    const [initial, setInitial] = createSignal(true);
    disable = setDisabled;
    defaults = setInitial;

    const state = createDisclosureState({
      get defaultExpanded() {
        return initial();
      },
      onExpandedChange: (next) => {
        changes.push(next);
      },
    });

    const disclosure = createDisclosure(
      {
        get isDisabled() {
          return disabled();
        },
      },
      state,
      () => trigger
    );

    return jsx(
      "div",
      merge(disclosure.buttonProps, {
        ref: (node: HostElement) => {
          trigger = node;
        },
      })
    );
  });

  app.root.flushSync(() => defaults(false));
  expect(trigger.props.get("aria-expanded")).toBe(true);
  app.send(trigger, "mouseDown", { button: 0 });
  app.send(trigger, "mouseLeave");
  app.send(trigger, "mouseUp", { button: 0 });
  app.send(trigger, "click", { button: 0, x: 1, y: 1 });
  expect(changes).toEqual([]);
  app.root.flushSync(() => disable(true));
  app.send(trigger, "click");
  app.send(trigger, "keyDown", { key: "enter" });
  app.send(trigger, "keyUp", { key: "enter" });
  app.send(trigger, "keyDown", { key: "space" });
  app.send(trigger, "keyUp", { key: "space" });
  expect(changes).toEqual([]);
  expect(trigger.props.get("tabIndex")).toBe(-1);
  expect(trigger.props.get("aria-disabled")).toBe(true);
  app.root.flushSync(() => disable(false));
  expect(trigger.props.get("tabIndex")).toBe(0);
  app.send(trigger, "keyDown", { key: "space" });
  app.send(trigger, "blur");
  app.send(trigger, "keyUp", { key: "space" });
  expect(changes).toEqual([false]);
  app.root.unmount();
  app.send(trigger, "click");
  expect(changes).toEqual([false]);
});

test("Disclosure relationships have distinct stable IDs per instance", () => {
  const app = setup();
  const ids: (string | undefined)[] = [];
  app.root.render(() => {
    for (let index = 0; index < 2; index += 1) {
      const disclosure = createDisclosure(
        {},
        createDisclosureState({}),
        () => null
      );

      const triggerId = disclosure.buttonProps["aria-id"];
      const panelId = disclosure.panelProps["aria-id"];
      expect(triggerId).toMatch(/^disclosure-trigger-/u);
      expect(panelId).toMatch(/^disclosure-panel-/u);
      ids.push(triggerId, panelId);
      expect(disclosure.buttonProps["aria-id"]).toBe(triggerId);
      expect(disclosure.panelProps["aria-id"]).toBe(panelId);
    }

    return null;
  });
  expect(new Set(ids).size).toBe(4);
});
