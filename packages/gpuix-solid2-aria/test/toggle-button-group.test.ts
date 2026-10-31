import { expect, test } from "bun:test";
import assert from "node:assert/strict";

import type { HostElement } from "gpuix-solid2";
import { createToggleGroupState } from "gpuix-solid2-stately";
import type { ToggleGroupProps } from "gpuix-solid2-stately/toggle/create-toggle-group-state";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import { I18nProvider } from "../src/i18n.js";
import {
  createToggleButtonGroup,
  createToggleButtonGroupItem,
} from "../src/toggle-button-group.js";
import type {
  ToggleButtonGroupItemProps,
  ToggleButtonGroupProps,
} from "../src/toggle-button-group.js";
import { setup } from "./support.js";

const mount = (
  options: ToggleGroupProps = {},
  props: ToggleButtonGroupProps = {},
  itemProps: Partial<ToggleButtonGroupItemProps> = {},
  locale = "en-US"
) => {
  const app = setup();
  const nodes: HostElement[] = [];
  let container!: HostElement;
  let state!: ReturnType<typeof createToggleGroupState>;
  let show!: Setter<boolean>;
  app.root.render(() =>
    jsx(I18nProvider, {
      get children() {
        state = createToggleGroupState(options);
        const [visible, setVisible] = createSignal(true);
        show = setVisible;

        const group = createToggleButtonGroup(props, state, () => container);

        const item = (id: number) => {
          let node: HostElement | null = null;

          const behavior = createToggleButtonGroupItem(
            merge({ id, isDisabled: id === 2 }, id === 1 ? itemProps : {}),
            state,
            () => node
          );

          return jsx(
            "div",
            merge(() => behavior.buttonProps, {
              children: String(id),
              ref: (element: HostElement) => {
                node = element;
                nodes[id - 1] = element;
              },
            })
          );
        };

        return jsx(
          "div",
          merge(group.groupProps, {
            children: [
              item(1),
              item(2),
              jsx(Show, {
                children: () => item(3),
                get when() {
                  return visible();
                },
              }),
            ],
            ref: (element: HostElement) => {
              container = element;
            },
          })
        );
      },
      locale,
    })
  );
  const [first, disabled, last] = nodes;
  assert.ok(first && disabled && last);

  return {
    ...app,
    container,
    nodes: [first, disabled, last] satisfies [
      HostElement,
      HostElement,
      HostElement,
    ],
    show,
    state,
  };
};

test("single toggle groups activate on Enter, Space release, mouse and OS Click", () => {
  const app = mount(
    { defaultSelectedKeys: [3] },
    { "aria-label": "Alignment" }
  );

  const [first, disabled, last] = app.nodes;
  expect(app.container.props.get("role")).toBe("radiogroup");
  expect(app.container.props.get("aria-label")).toBe("Alignment");
  expect(first.props.get("role")).toBe("radio");
  expect(last.props.get("aria-checked")).toBe(true);
  expect(first.props.get("aria-pressed")).toBeUndefined();
  expect(app.nodes.map((node) => node.props.get("tabIndex"))).toEqual([
    0, -1, -1,
  ]);
  app.send(first, "keyDown", { key: "return" });
  expect([...app.state.selectedKeys]).toEqual([1]);
  app.send(first, "keyUp", { key: "return" });
  app.send(first, "keyDown", { key: "space" });
  expect([...app.state.selectedKeys]).toEqual([1]);
  app.send(first, "keyUp", { key: "space" });
  expect([...app.state.selectedKeys]).toEqual([]);
  app.send(last, "mouseDown", { button: 0 });
  app.send(last, "mouseUp", { button: 0 });
  app.send(last, "click", { button: 0, x: 1, y: 1 });
  expect([...app.state.selectedKeys]).toEqual([3]);
  app.send(disabled, "click");
  expect([...app.state.selectedKeys]).toEqual([3]);
  app.send(first, "click");
  expect([...app.state.selectedKeys]).toEqual([1]);
  app.send(last, "keyDown", { key: "space" });
  app.send(last, "blur");
  app.send(last, "keyUp", { key: "space" });
  expect([...app.state.selectedKeys]).toEqual([1]);
});

test("multiple toggle groups preserve nonempty selection and expose button pressed state", () => {
  const app = mount({
    defaultSelectedKeys: [1],
    disallowEmptySelection: true,
    selectionMode: "multiple",
  });

  const [first, , last] = app.nodes;
  expect(app.container.props.get("role")).toBe("toolbar");
  expect(first.props.get("role")).toBe("button");
  expect(first.props.get("aria-pressed")).toBe(true);
  expect(first.props.get("aria-checked")).toBeUndefined();
  app.send(first, "click");
  expect([...app.state.selectedKeys]).toEqual([1]);
  app.send(last, "click");
  expect([...app.state.selectedKeys]).toEqual([1, 3]);
  app.send(first, "click");
  expect([...app.state.selectedKeys]).toEqual([3]);

  const single = mount({
    defaultSelectedKeys: [1],
    disallowEmptySelection: true,
  });

  single.send(single.nodes[0], "click");
  expect([...single.state.selectedKeys]).toEqual([1]);
});

test("toolbar arrows move focus without selection, skip disabled items, and stop at ends", () => {
  const focus: boolean[] = [];

  const app = mount(
    { defaultSelectedKeys: [1] },
    {},
    {
      onFocusChange: (value) => {
        focus.push(value);
      },
    }
  );

  const [first, , last] = app.nodes;
  app.send(first, "keyDown", { key: "down" });
  app.send(first, "keyDown", {
    key: "right",
    modifiers: { alt: false, cmd: false, ctrl: true, shift: false },
  });
  expect(app.focusCalls).toEqual([]);
  app.send(first, "keyDown", { key: "right" });
  expect(app.focusCalls).toEqual([last.id]);
  expect([...app.state.selectedKeys]).toEqual([1]);
  expect(app.nodes.map((node) => node.props.get("tabIndex"))).toEqual([
    -1, -1, 0,
  ]);
  app.send(last, "keyDown", { key: "right" });
  expect(app.focusCalls).toEqual([last.id]);
  app.send(first, "focus");
  app.send(first, "blur");
  expect(focus).toEqual([true, false]);
  expect(first.props.get("tabIndex")).toBe(0);
  app.send(last, "focus");
  app.root.flushSync(() => {
    app.show(false);
  });
  expect(first.props.get("tabIndex")).toBe(0);
  app.send(last, "click");
  expect([...app.state.selectedKeys]).toEqual([1]);
});

test("vertical navigation and horizontal RTL follow toolbar orientation", () => {
  const rtl = mount({}, {}, {}, "ar");
  rtl.send(rtl.nodes[0], "keyDown", { key: "left" });
  expect(rtl.focusCalls.at(-1)).toBe(rtl.nodes[2].id);
  rtl.send(rtl.nodes[2], "keyDown", { key: "right" });
  expect(rtl.focusCalls.at(-1)).toBe(rtl.nodes[0].id);
  const vertical = mount({}, { orientation: "vertical" }, {}, "ar");
  vertical.send(vertical.nodes[0], "keyDown", { key: "left" });
  expect(vertical.focusCalls).toEqual([]);
  vertical.send(vertical.nodes[0], "keyDown", { key: "down" });
  expect(vertical.focusCalls.at(-1)).toBe(vertical.nodes[2].id);
  vertical.send(vertical.nodes[2], "keyDown", { key: "up" });
  expect(vertical.focusCalls.at(-1)).toBe(vertical.nodes[0].id);
});

test("controlled requests, reactive modes, ids, guards, and cleanup follow shared state", () => {
  let update!: Setter<Set<string | number>>;
  let disable!: Setter<boolean>;
  let mode!: Setter<"single" | "multiple">;
  let rename!: Setter<number>;
  let readonly!: Setter<boolean>;
  let accept = false;
  const requests: (string | number)[][] = [];
  const app = setup();
  let node!: HostElement;
  let container!: HostElement;
  app.root.render(() => {
    const [selectedKeys, setSelectedKeys] = createSignal(
      new Set<string | number>([1])
    );

    const [isDisabled, setDisabled] = createSignal(false);

    const [selectionMode, setMode] = createSignal<"single" | "multiple">(
      "single"
    );

    const [id, setId] = createSignal(1);
    const [isReadOnly, setReadOnly] = createSignal(false);
    update = setSelectedKeys;
    disable = setDisabled;
    mode = setMode;
    rename = setId;
    readonly = setReadOnly;

    const state = createToggleGroupState({
      get isDisabled() {
        return isDisabled();
      },
      onSelectionChange(next) {
        requests.push([...next]);

        if (accept) {
          setSelectedKeys(next);
        }
      },
      get selectedKeys() {
        return selectedKeys();
      },
      get selectionMode() {
        return selectionMode();
      },
    });

    const group = createToggleButtonGroup({}, state, () => container);

    const item = createToggleButtonGroupItem(
      {
        get id() {
          return id();
        },
        isDisabled: false,
        get isReadOnly() {
          return isReadOnly();
        },
      },
      state,
      () => node
    );

    return jsx(
      "div",
      merge(group.groupProps, {
        children: jsx(
          "div",
          merge(item.buttonProps, {
            ref: (element: HostElement) => {
              node = element;
            },
          })
        ),
        ref: (element: HostElement) => {
          container = element;
        },
      })
    );
  });
  app.send(node, "click");
  expect(requests).toEqual([[]]);
  expect(node.props.get("aria-checked")).toBe(true);
  accept = true;
  app.send(node, "click");
  expect(node.props.get("aria-checked")).toBe(false);
  app.root.flushSync(() => {
    update(new Set([3]));
    rename(3);
    mode("multiple");
  });
  expect(container.props.get("role")).toBe("toolbar");
  expect(node.props.get("role")).toBe("button");
  expect(node.props.get("aria-pressed")).toBe(true);
  expect(node.props.get("aria-checked")).toBeUndefined();
  app.root.flushSync(() => {
    readonly(true);
  });
  app.send(node, "click");
  expect(requests).toEqual([[], []]);
  app.root.flushSync(() => {
    readonly(false);
    disable(true);
  });
  expect(node.props.get("tabIndex")).toBe(-1);
  app.send(node, "click");
  expect(requests).toEqual([[], []]);
  app.root.flushSync(() => {
    disable(false);
  });
  expect(node.props.get("tabIndex")).toBe(0);
  app.send(node, "keyDown", { key: "space" });
  app.root.unmount();
  app.send(node, "keyUp", { key: "space" });
  app.send(node, "click");
  expect(requests).toEqual([[], []]);
});
