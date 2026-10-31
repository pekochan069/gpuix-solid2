import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createNumberFieldState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createButton } from "../src/controls.js";
import { createNumberField } from "../src/number-field.js";

const title = "GPUIX NumberField native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 450, title, width: 620 });

const app = createRoot(renderer, { keyboardFocusDim: false });
let input!: HostElement;
let increment!: HostElement;
let decrement!: HostElement;
let disabled!: HostElement;
let readonly!: HostElement;
let disabledIncrement!: HostElement;
let readonlyIncrement!: HostElement;
let after!: HostElement;
let update!: Setter<number>;
let disable!: Setter<boolean>;
let lock!: Setter<boolean>;
let value!: () => number;
let text!: () => string;
let invalid!: () => boolean;
let accept = true;
const requests: number[] = [];

app.render(() => {
  const [amount, setAmount] = createSignal(4);
  const [isDisabled, setDisabled] = createSignal(false);
  const [isReadOnly, setReadOnly] = createSignal(false);
  update = setAmount;
  disable = setDisabled;
  lock = setReadOnly;
  value = amount;

  const state = createNumberFieldState({
    locale: "de-DE",
    maxValue: 10,
    minValue: 0,
    onChange(next) {
      requests.push(next);

      if (accept) {
        setAmount(next);
      }
    },
    step: 0.5,
    validate: (next) => (next === 4 ? "Choose another amount" : null),
    validationBehavior: "native",
    get value() {
      return amount();
    },
  });

  text = () => state.inputValue;

  const number = createNumberField(
    {
      get "aria-description"() {
        return `Amount: ${amount()}`;
      },
      "aria-label": "Amount",
      get isDisabled() {
        return isDisabled();
      },
      get isReadOnly() {
        return isReadOnly();
      },
    },
    state,
    () => input
  );

  const up = createButton(number.incrementButtonProps, () => increment);
  invalid = () => number.isInvalid;
  const down = createButton(number.decrementButtonProps, () => decrement);

  const blocked = createNumberField(
    {
      "aria-label": "Disabled amount",
      incrementButtonLabel: "Increase disabled amount",
      isDisabled: true,
    },
    createNumberFieldState({ defaultValue: 2, locale: "en-US" }),
    () => disabled
  );

  const blockedUp = createButton(
    blocked.incrementButtonProps,
    () => disabledIncrement
  );

  const fixed = createNumberField(
    {
      "aria-label": "Readonly amount",
      incrementButtonLabel: "Increase readonly amount",
      isReadOnly: true,
    },
    createNumberFieldState({ defaultValue: 3, locale: "en-US" }),
    () => readonly
  );

  const fixedUp = createButton(
    fixed.incrementButtonProps,
    () => readonlyIncrement
  );

  const next = createButton({ "aria-label": "After amount" }, () => after);
  const inputStyle = { height: 40, width: 400 };

  const buttonStyle = {
    backgroundColor: "#e8edf2",
    color: "#102030",
    height: 32,
    padding: 6,
    width: 240,
  };

  return jsx("div", {
    get children() {
      return [
        jsx("text", {
          children: "Native Solid 2 number field",
          style: { color: "#102030", fontSize: 22 },
        }),
        jsx(
          "input",
          merge(number.inputProps, {
            ref: (node: HostElement) => {
              input = node;
            },
            style: inputStyle,
          })
        ),
        jsx(
          "div",
          merge(up.buttonProps, {
            children: "Increase value",
            ref: (node: HostElement) => {
              increment = node;
            },
            style: buttonStyle,
          })
        ),
        jsx(
          "div",
          merge(down.buttonProps, {
            children: "Decrease value",
            ref: (node: HostElement) => {
              decrement = node;
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
          merge(blockedUp.buttonProps, {
            children: "Increase disabled amount",
            ref: (node: HostElement) => {
              disabledIncrement = node;
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
          merge(fixedUp.buttonProps, {
            children: "Increase readonly amount",
            ref: (node: HostElement) => {
              readonlyIncrement = node;
            },
            style: buttonStyle,
          })
        ),
        jsx(
          "div",
          merge(next.buttonProps, {
            children: "After amount",
            ref: (node: HostElement) => {
              after = node;
            },
            style: buttonStyle,
          })
        ),
        jsx("text", {
          get children() {
            return `Committed amount: ${amount()}`;
          },
          style: { color: "#102030" },
        }),
      ];
    },
    style: {
      backgroundColor: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      height: 450,
      padding: 16,
      width: 620,
    },
  });
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
  assert.equal(invalid(), false);
  await key("enter");
  assert.equal(
    invalid(),
    true,
    "An unchanged submit publishes state validation"
  );
  await key("up");
  assert.equal(value(), 4.5);
  assert.equal(text(), "4,5");
  await key("down");
  assert.equal(value(), 4);
  await key("pageup");
  assert.equal(value(), 4.5);
  await key("pagedown");
  assert.equal(value(), 4);
  await key("end");
  await key("home");
  assert.equal(value(), 4, "Home and End preserve native caret movement");
  app.flushSync(() => update(10));
  assert.equal(value(), 10);
  await click(increment);
  assert.equal(value(), 10);
  app.flushSync(() => update(0));
  assert.equal(value(), 0);
  await click(decrement);
  assert.equal(value(), 0);
  await click(increment);
  assert.equal(value(), 0.5);
  assert.equal(renderer.getFocusedElementId(), input.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    readonly.id,
    "Tab skips step buttons and disabled editor"
  );
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), after.id);
  app.flushSync(() => update(4));
  renderer.focusElement(input.id);
  await key("right");
  await key("backspace");
  await key("7");
  assert.equal(text(), "7");
  assert.equal(value(), 4, "Editing waits for commit");
  const beforeSubmit = requests.length;
  await key("enter");
  assert.equal(value(), 7);
  assert.equal(requests.length, beforeSubmit + 1, "Enter commits exactly once");
  await key("backspace");
  await key("8");
  await key("tab");
  assert.equal(value(), 8, "Blur commits edited text");
  accept = false;
  await click(increment);
  assert.equal(value(), 8);
  assert.equal(requests.at(-1), 8.5);
  renderer.focusElement(input.id);
  await key("right");
  await key("backspace");
  await key("9");
  assert.equal(text(), "9");
  await key("up");
  assert.equal(requests.at(-1), 9.5);
  assert.equal(
    text(),
    "8",
    "Rejected stepping restores committed text after draft editing"
  );
  assert.equal(value(), 8);
  accept = true;
  app.flushSync(() => disable(true));
  await click(increment);
  assert.equal(value(), 8);
  app.flushSync(() => {
    disable(false);
    lock(true);
  });
  renderer.focusElement(input.id);
  await key("up");
  await key("9");
  await key("enter");
  await click(decrement);
  assert.equal(value(), 8);
  app.flushSync(() => lock(false));
  await click(disabledIncrement);
  await click(readonlyIncrement);
  assert.equal(disabled.props.get("value"), "2");
  assert.equal(readonly.props.get("value"), "3");
  console.log(
    "Native NumberField locale, stepping, bounds, editing, submit, blur, focus, Tab, controlled requests, and guards passed."
  );
};

try {
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  app.flushSync(() => update(4));

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("NumberField inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(
      value(),
      4.5,
      "AT-SPI Click must step controlled number state"
    );
    assert.equal(disabled.props.get("value"), "2");
    assert.equal(readonly.props.get("value"), "3");
  }
} finally {
  app.unmount();
}

process.exit(0);
