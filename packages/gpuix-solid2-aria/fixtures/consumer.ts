import assert from "node:assert/strict";

import { createRoot } from "gpuix-solid2";
import type { HostElement, NativeRenderer } from "gpuix-solid2";
import {
  createButton,
  createCheckbox,
  createCheckboxGroup,
  createCheckboxGroupItem,
  createKeyboard,
  createLocale,
} from "gpuix-solid2-aria";
import {
  createCheckboxGroupState,
  createToggleState,
} from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { merge } from "solid-js";

for (const name of ["window", "document", "navigator", "HTMLElement"]) {
  Reflect.deleteProperty(globalThis, name);
  assert.equal(name in globalThis, false);
}

assert.throws(() => import.meta.resolve("@solidjs/web"));

assert.throws(() => import.meta.resolve("@solid2-aria/core"));

let check!: HostElement;
let button!: HostElement;
let groupItem!: HostElement;
let selected = () => false;
let count = 0;
let key = "";
const renderer: NativeRenderer = { applyBatch: () => [] };
const app = createRoot(renderer);

try {
  app.render(() => {
    const state = createToggleState();

    const checkbox = createCheckbox(
      { "aria-label": "Accept" },
      state,
      () => check
    );

    const press = createButton(
      {
        onPress: () => {
          count += 1;
        },
      },
      () => button
    );

    const keyboard = createKeyboard({
      onKeyDown: (event) => {
        key = event.key ?? "";
      },
    });

    selected = () => state.isSelected;
    assert.equal(createLocale().locale, "en-US");
    const groupState = createCheckboxGroupState({ defaultValue: ["news"] });
    const group = createCheckboxGroup({ "aria-label": "Topics" }, groupState);

    const item = createCheckboxGroupItem(
      { value: "news" },
      groupState,
      () => groupItem
    );

    return [
      jsx(
        "div",
        merge(group.groupProps, {
          children: jsx(
            "div",
            merge(item.inputProps, {
              ref: (node: HostElement) => {
                groupItem = node;
              },
            })
          ),
        })
      ),
      jsx(
        "div",
        merge(checkbox.inputProps, {
          ref: (node: HostElement) => {
            check = node;
          },
        })
      ),
      jsx(
        "div",
        merge(press.buttonProps, keyboard.keyboardProps, {
          ref: (node: HostElement) => {
            button = node;
          },
        })
      ),
    ];
  });
  app.dispatch({ elementId: check.id, eventType: "keyDown", key: "space" });
  app.dispatch({ elementId: check.id, eventType: "keyUp", key: "space" });
  assert.equal(selected(), true);
  assert.equal(check.props.get("aria-checked"), true);
  app.dispatch({ elementId: button.id, eventType: "click" });
  assert.equal(count, 1);
  app.dispatch({ elementId: button.id, eventType: "keyDown", key: "down" });
  assert.equal(key, "ArrowDown");
  assert.equal(groupItem.props.get("aria-checked"), true);
  app.dispatch({ elementId: groupItem.id, eventType: "keyDown", key: "space" });
  app.dispatch({ elementId: groupItem.id, eventType: "keyUp", key: "space" });
  assert.equal(groupItem.props.get("aria-checked"), false);
  console.log(
    "Compiled native consumer passed without browser globals, @solidjs/web, or upstream SSR."
  );
} finally {
  app.unmount();
}
