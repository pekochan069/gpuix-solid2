import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createRadioGroupState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { merge } from "solid-js";

import { createRadio, createRadioGroup } from "../src/radio.js";
import { setup } from "./support.js";

test("native radio behaviors compose with state, ignore modified arrows, and cancel Space on blur", () => {
  const app = setup();
  let group!: HostElement;
  let a!: HostElement;
  let b!: HostElement;
  let selected!: () => string;
  const focus: boolean[] = [];
  app.root.render(() => {
    const state = createRadioGroupState({ defaultValue: "a" });
    selected = () => state.selectedValue ?? "";
    const aria = createRadioGroup({ "aria-label": "Plan" }, state, () => group);
    const first = createRadio({ value: "a" }, state, () => a);

    const second = createRadio(
      {
        onFocusChange: (value) => {
          focus.push(value);
        },
        value: "b",
      },
      state,
      () => b
    );

    return jsx(
      "div",
      merge(aria.radioGroupProps, {
        children: [
          jsx(
            "div",
            merge(first.inputProps, {
              ref: (node: HostElement) => {
                a = node;
              },
            })
          ),
          jsx(
            "div",
            merge(second.inputProps, {
              ref: (node: HostElement) => {
                b = node;
              },
            })
          ),
        ],
        ref: (node: HostElement) => {
          group = node;
        },
      })
    );
  });
  app.send(a, "keyDown", {
    key: "right",
    modifiers: { alt: false, cmd: false, ctrl: true, shift: false },
  });
  expect(selected()).toBe("a");
  app.send(a, "keyDown", { key: "right" });
  expect(selected()).toBe("b");
  expect(app.focusCalls.at(-1)).toBe(b.id);
  app.send(b, "focus");
  app.send(b, "blur");
  expect(focus).toEqual([true, false]);
  app.send(a, "keyDown", { key: "space" });
  app.send(a, "blur");
  app.send(a, "keyUp", { key: "space" });
  expect(selected()).toBe("b");
  expect(group.props.get("role")).toBe("radiogroup");
});
