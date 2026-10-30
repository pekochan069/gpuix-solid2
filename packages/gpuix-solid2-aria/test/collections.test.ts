import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createListState, Item } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { merge } from "solid-js";

import {
  createListBox,
  createOption,
  ListKeyboardDelegate,
} from "../src/collections.js";
import { setup } from "./support.js";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

const children = (item: { id: string }) =>
  Item({ children: item.id, key: item.id, textValue: item.id });

test("Linear navigation skips disabled keys and respects horizontal RTL", () => {
  const app = setup();
  let delegate: ListKeyboardDelegate<{ id: string }> | undefined;
  app.root.render(() => {
    const state = createListState({ children, disabledKeys: ["b"], items });
    delegate = new ListKeyboardDelegate({
      collection: state.collection,
      direction: "rtl",
      disabledKeys: state.disabledKeys,
      orientation: "horizontal",
    });

    return null;
  });
  expect(delegate?.getFirstKey()).toBe("a");
  expect(delegate?.getLastKey()).toBe("c");
  expect(delegate?.getKeyLeftOf("a")).toBe("c");
  expect(delegate?.getKeyRightOf("c")).toBe("a");
  expect(delegate?.getKeyForSearch("C")).toBe("c");
});

for (const selectionMode of ["single", "multiple"] as const) {
  test(`Native listbox uses ${selectionMode} stately selection and roving focus`, () => {
    const app = setup();
    const nodes = new Map<string | number, HostElement>();
    let list!: HostElement;
    let selected: (() => Set<string | number>) | undefined;
    app.root.render(() => {
      const state = createListState({
        children,
        disabledKeys: ["b"],
        items,
        selectionMode,
      });

      selected = () => state.selectionManager.selectedKeys;

      const behavior = createListBox(
        { shouldFocusWrap: true },
        state,
        (key) => nodes.get(key) ?? null
      );

      return jsx(
        "div",
        merge(behavior.listBoxProps, {
          get children() {
            return ["a", "b", "c"].map((key) => {
              const option = createOption(
                { key },
                state,
                () => nodes.get(key) ?? null
              );

              return jsx(
                "div",
                merge(option.optionProps, {
                  ref: (el: HostElement) => {
                    nodes.set(key, el);
                  },
                })
              );
            });
          },
          ref: (el: HostElement) => {
            list = el;
          },
        })
      );
    });
    app.send(list, "keyDown", { key: "down" });
    expect(app.renderer.getFocusedElementId?.()).toBe(nodes.get("a")?.id);
    app.send(list, "keyDown", { key: "down" });
    expect(app.renderer.getFocusedElementId?.()).toBe(nodes.get("c")?.id);
    expect(list.props.get("tabIndex")).toBe(-1);
    const a = nodes.get("a");
    const b = nodes.get("b");
    const c = nodes.get("c");

    if (!a || !b || !c) {
      throw new Error("Missing options");
    }

    app.send(c, "click");
    app.send(a, "click");
    app.send(b, "click");
    expect([...(selected?.() ?? [])]).toEqual(
      selectionMode === "single" ? ["a"] : ["c", "a"]
    );
  });
}
