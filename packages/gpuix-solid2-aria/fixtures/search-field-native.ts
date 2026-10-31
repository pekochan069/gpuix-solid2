import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createSearchFieldState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createButton } from "../src/controls.js";
import { createOverlay } from "../src/overlays.js";
import { createSearchField } from "../src/search-field.js";

const title = "GPUIX SearchField native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 460, title, width: 620 });

const app = createRoot(renderer, { keyboardFocusDim: false });
let container!: HostElement;
let input!: HostElement;
let clear!: HostElement;
let disabled!: HostElement;
let readonly!: HostElement;
let disabledClear!: HostElement;
let readonlyClear!: HostElement;
let after!: HostElement;
let update!: Setter<string>;
let disable!: Setter<boolean>;
let lock!: Setter<boolean>;
let value!: () => string;
let isOpen!: () => boolean;
let accept = true;
let clears = 0;
const submits: string[] = [];
const requests: string[] = [];

app.render(() => {
  const [query, setQuery] = createSignal("query");
  const [isDisabled, setDisabled] = createSignal(false);
  const [isReadOnly, setReadOnly] = createSignal(false);
  const [open, setOpen] = createSignal(true);
  update = setQuery;
  disable = setDisabled;
  lock = setReadOnly;
  value = query;
  isOpen = open;

  const overlay = createOverlay(
    {
      get isOpen() {
        return open();
      },
      onClose: () => {
        setOpen(false);
      },
      shouldRestoreFocus: false,
    },
    () => container
  );

  const state = createSearchFieldState({
    onChange(next) {
      requests.push(next);

      if (accept) {
        setQuery(next);
      }
    },
    get value() {
      return query();
    },
  });

  const search = createSearchField(
    {
      get "aria-description"() {
        return `Query: ${query()}`;
      },
      "aria-label": "Search documents",
      get isDisabled() {
        return isDisabled();
      },
      get isReadOnly() {
        return isReadOnly();
      },
      onClear: () => {
        clears += 1;
      },
      onSubmit: (next) => {
        submits.push(next);
      },
      placeholder: "Search documents",
    },
    state,
    () => input
  );

  const clearButton = createButton(search.clearButtonProps, () => clear);

  const blocked = createSearchField(
    {
      "aria-label": "Disabled search",
      clearButtonLabel: "Clear disabled search",
      isDisabled: true,
    },
    createSearchFieldState({ defaultValue: "disabled" }),
    () => disabled
  );

  const blockedButton = createButton(
    blocked.clearButtonProps,
    () => disabledClear
  );

  const fixed = createSearchField(
    {
      "aria-label": "Readonly search",
      clearButtonLabel: "Clear readonly search",
      isReadOnly: true,
    },
    createSearchFieldState({ defaultValue: "readonly" }),
    () => readonly
  );

  const fixedButton = createButton(fixed.clearButtonProps, () => readonlyClear);
  const next = createButton({ "aria-label": "After search" }, () => after);
  const inputStyle = { height: 42, width: 400 };

  const buttonStyle = {
    backgroundColor: "#e8edf2",
    color: "#102030",
    height: 36,
    padding: 6,
    width: 220,
  };

  return jsx(
    "div",
    merge(overlay.overlayProps, {
      get children() {
        return [
          jsx("text", {
            children: "Native Solid 2 search field",
            style: { color: "#102030", fontSize: 22 },
          }),
          jsx(
            "input",
            merge(search.inputProps, {
              ref: (node: HostElement) => {
                input = node;
              },
              style: inputStyle,
            })
          ),
          jsx(
            "div",
            merge(clearButton.buttonProps, {
              children: "Clear search",
              ref: (node: HostElement) => {
                clear = node;
              },
              style: buttonStyle,
            })
          ),
          jsx(
            "input",
            merge(blocked.inputProps, {
              ref: (node: HostElement) => {
                disabled = node;
              },
              style: inputStyle,
            })
          ),
          jsx(
            "div",
            merge(blockedButton.buttonProps, {
              children: "Clear disabled search",
              ref: (node: HostElement) => {
                disabledClear = node;
              },
              style: buttonStyle,
            })
          ),
          jsx(
            "input",
            merge(fixed.inputProps, {
              ref: (node: HostElement) => {
                readonly = node;
              },
              style: inputStyle,
            })
          ),
          jsx(
            "div",
            merge(fixedButton.buttonProps, {
              children: "Clear readonly search",
              ref: (node: HostElement) => {
                readonlyClear = node;
              },
              style: buttonStyle,
            })
          ),
          jsx(
            "div",
            merge(next.buttonProps, {
              children: "After search",
              ref: (node: HostElement) => {
                after = node;
              },
              style: buttonStyle,
            })
          ),
          jsx("text", {
            get children() {
              return `Current query: ${query()}`;
            },
            style: { color: "#102030" },
          }),
        ];
      },
      ref: (node: HostElement) => {
        container = node;
      },
      style: {
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: 460,
        padding: 16,
        width: 620,
      },
    })
  );
});

const settle = async () => {
  app.flush();
  renderer.tick();
  await Bun.sleep(80);
  app.flush();
};

const key = async (name: string) => {
  renderer.simulateKeystrokes(name);
  renderer.simulateKeyUp(name);
  await settle();
};

const click = async (node: HostElement) => {
  const box = renderer.getElementBounds(node.id);
  assert.ok(box && box.width > 0 && box.height > 0);
  assert.ok(
    renderer
      .getElementsAt(box.x + box.width / 2, box.y + box.height / 2)
      .includes(node.id)
  );
  renderer.simulateClick(box.x + box.width / 2, box.y + box.height / 2);
  await settle();
};

const verify = async () => {
  renderer.activateWindow();
  await settle();
  renderer.focusElement(input.id);
  await key("escape");
  assert.equal(value(), "");
  assert.equal(
    isOpen(),
    true,
    "Clearing consumes Escape before overlay dismissal"
  );
  assert.equal(clears, 1);
  await key("escape");
  assert.equal(isOpen(), false, "Empty search leaves Escape to the overlay");
  app.flushSync(() => update("native"));
  renderer.focusElement(input.id);
  await key("end");
  await key("x");
  assert.equal(value(), "nativex");
  await key("enter");
  assert.deepEqual(
    submits,
    ["nativex"],
    "Editor submit must fire exactly once"
  );
  await click(clear);
  assert.equal(value(), "");
  assert.equal(
    renderer.getFocusedElementId(),
    input.id,
    "Mouse clear retains editor focus"
  );
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    readonly.id,
    "Tab skips clear buttons and disabled editors"
  );
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), after.id);
  app.flushSync(() => update("parent"));
  accept = false;
  await click(clear);
  assert.equal(value(), "parent", "Rejected clear preserves controlled state");
  assert.equal(requests.at(-1), "");
  accept = true;
  app.flushSync(() => disable(true));
  await click(clear);
  assert.equal(value(), "parent");
  app.flushSync(() => {
    disable(false);
    lock(true);
  });
  renderer.focusElement(input.id);
  await key("end");
  await key("x");
  await key("escape");
  await key("enter");
  await click(clear);
  assert.equal(value(), "parent");
  assert.deepEqual(submits, ["nativex"]);
  app.flushSync(() => lock(false));
  await click(disabledClear);
  await click(readonlyClear);
  assert.equal(disabled.props.get("value"), "disabled");
  assert.equal(readonly.props.get("value"), "readonly");
  console.log(
    "Native SearchField editing, submit, Escape dismissal, mouse clear, focus, Tab traversal, controlled rejection, and guards passed."
  );
};

try {
  // Inspect-only mode separates the X11 OS audit from Wayland keyboard proof.
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  app.flushSync(() => update("OS query"));

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("SearchField inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(
      value(),
      "",
      "AT-SPI Click must clear controlled search state"
    );
    assert.equal(disabled.props.get("value"), "disabled");
    assert.equal(readonly.props.get("value"), "readonly");
  }
} finally {
  app.unmount();
}

process.exit(0);
