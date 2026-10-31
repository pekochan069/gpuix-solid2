import { expect, test } from "bun:test";

import type { HostElement, KeyEvent } from "gpuix-solid2";
import { createNumberFieldState } from "gpuix-solid2-stately";
import type { NumberFieldState } from "gpuix-solid2-stately/numberfield/create-number-field-state";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createButton } from "../src/controls.js";
import { createNumberField } from "../src/number-field.js";
import type { NumberFieldProps } from "../src/number-field.js";
import { setup } from "./support.js";

const setupNumber = (
  create: () => { state: NumberFieldState; props?: NumberFieldProps }
) => {
  const app = setup();
  let input!: HostElement;
  let increment!: HostElement;
  let decrement!: HostElement;
  let state!: NumberFieldState;
  let behavior!: ReturnType<typeof createNumberField>;
  app.root.render(() => {
    const options = create();
    ({ state } = options);
    behavior = createNumberField(options.props ?? {}, state, () => input);
    const up = createButton(behavior.incrementButtonProps, () => increment);
    const down = createButton(behavior.decrementButtonProps, () => decrement);

    return [
      jsx(
        "input",
        merge(behavior.inputProps, {
          ref: (node: HostElement) => {
            input = node;
          },
        })
      ),
      jsx(
        "div",
        merge(up.buttonProps, {
          ref: (node: HostElement) => {
            increment = node;
          },
        })
      ),
      jsx(
        "div",
        merge(down.buttonProps, {
          ref: (node: HostElement) => {
            decrement = node;
          },
        })
      ),
    ];
  });

  return { ...app, behavior, decrement, increment, input, state };
};

test("NumberField edits localized text, commits on submit and blur, and exposes semantics", () => {
  const changes: number[] = [];

  const app = setupNumber(() => ({
    props: { "aria-label": "Amount", isRequired: true, placeholder: "Amount" },
    state: createNumberFieldState({
      defaultValue: 1234.5,
      locale: "de-DE",
      maxValue: 2000,
      minValue: 0,
      onChange: (value) => {
        changes.push(value);
      },
      step: 0.5,
    }),
  }));

  expect(app.input.props.get("value")).toBe("1.234,5");
  expect(app.input.props.get("role")).toBe("spinbutton");
  expect(app.input.props.get("aria-label")).toBe("Amount");
  expect(app.input.props.get("aria-required")).toBe(true);
  expect(app.input.props.get("aria-valuemin")).toBe(0);
  expect(app.input.props.get("aria-valuemax")).toBe(2000);
  expect(app.input.props.get("aria-valuenow")).toBe(1234.5);
  app.send(app.input, "change", { value: "12,7" });
  expect(app.state.numberValue).toBe(12.7);
  expect(changes).toEqual([]);
  app.send(app.input, "keyDown", { key: "return" });
  app.send(app.input, "submit");
  expect(changes).toEqual([12.5]);
  expect(app.input.props.get("value")).toBe("12,5");
  app.send(app.input, "change", { value: "3000" });
  app.send(app.input, "blur");
  expect(app.state.numberValue).toBe(2000);
  expect(app.input.props.get("aria-valuetext")).toBe("2.000");
  expect(changes).toEqual([12.5, 2000]);
});

test("NumberField allows partial and invalid native text until commit, and supports empty values", () => {
  const app = setupNumber(() => ({
    state: createNumberFieldState({ defaultValue: 3, locale: "en-US" }),
  }));

  app.send(app.input, "change", { value: "-" });
  expect(app.state.inputValue).toBe("-");
  expect(app.input.props.get("aria-valuenow")).toBeUndefined();
  app.send(app.input, "change", { value: "invalid" });
  expect(app.state.inputValue).toBe("invalid");
  app.send(app.input, "submit");
  expect(app.input.props.get("value")).toBe("3");
  app.send(app.input, "change", { value: "" });
  app.send(app.input, "blur");
  expect(app.state.numberValue).toBeNaN();
  expect(app.input.props.get("value")).toBe("");
  app.send(app.input, "keyDown", { key: "up" });
  expect(app.state.numberValue).toBe(0);
});

test("NumberField normalizes repeated arrows and page keys within its bounds", () => {
  const keys: string[] = [];

  const app = setupNumber(() => ({
    props: {
      onKeyDown: (event) => {
        keys.push(event.key ?? "");
      },
    },
    state: createNumberFieldState({
      defaultValue: 4,
      locale: "en-US",
      maxValue: 10,
      minValue: 0,
      step: 2,
    }),
  }));

  app.send(app.input, "keyDown", { key: "up" });
  expect(app.state.numberValue).toBe(6);
  app.send(app.input, "keyDown", { isHeld: true, key: "up" });
  expect(app.state.numberValue).toBe(8);
  app.send(app.input, "keyDown", { key: "pageup" });
  expect(app.state.numberValue).toBe(10);
  app.send(app.input, "keyDown", { key: "up" });
  expect(app.state.numberValue).toBe(10);
  expect(app.increment.props.get("aria-disabled")).toBe(true);
  app.send(app.input, "keyDown", { key: "pagedown" });
  expect(app.state.numberValue).toBe(8);
  app.send(app.input, "keyDown", { key: "down" });
  expect(app.state.numberValue).toBe(6);
  expect(keys).toEqual([
    "ArrowUp",
    "ArrowUp",
    "PageUp",
    "ArrowUp",
    "PageDown",
    "ArrowDown",
  ]);
});

test("NumberField leaves native caret keys, modifiers, and canceled keys alone", () => {
  let cancel = false;
  let lastKey: KeyEvent | undefined;

  const app = setupNumber(() => ({
    props: {
      onKeyDown(event) {
        lastKey = event;

        if (cancel) {
          event.preventDefault();
        }
      },
    },
    state: createNumberFieldState({
      defaultValue: 5,
      locale: "en-US",
      maxValue: 10,
      minValue: 0,
    }),
  }));

  for (const key of ["home", "end", "left", "right", "enter"]) {
    app.send(app.input, "keyDown", { key });
    expect(lastKey?.defaultPrevented).toBeFalsy();
  }

  app.send(app.input, "keyDown", {
    key: "up",
    modifiers: { alt: false, cmd: false, ctrl: true, shift: false },
  });
  app.send(app.input, "keyDown", {
    key: "down",
    modifiers: { alt: true, cmd: false, ctrl: false, shift: false },
  });
  app.send(app.input, "keyDown", {
    key: "up",
    modifiers: { alt: false, cmd: true, ctrl: false, shift: false },
  });
  cancel = true;
  app.send(app.input, "keyDown", { key: "up" });
  expect(app.state.numberValue).toBe(5);
});

test("NumberField step buttons preserve input focus and step once per mouse or OS Click", () => {
  const app = setupNumber(() => ({
    state: createNumberFieldState({ defaultValue: 1, locale: "en-US" }),
  }));

  expect(app.increment.props.get("tabIndex")).toBe(-1);
  expect(app.decrement.props.get("tabIndex")).toBe(-1);
  expect(app.increment.props.get("aria-label")).toBe("Increase value");
  app.send(app.increment, "mouseDown", { button: 0 });
  expect(app.focusCalls.at(-1)).toBe(app.input.id);
  app.send(app.increment, "mouseUp", { button: 0 });
  app.send(app.increment, "click", { button: 0 });
  expect(app.state.numberValue).toBe(2);
  app.send(app.decrement, "click");
  expect(app.state.numberValue).toBe(1);
});

test("Controlled NumberField commits and steps request values while the parent stays authoritative", () => {
  const requests: number[] = [];
  let accept = false;
  let update!: Setter<number>;

  const app = setupNumber(() => {
    const [value, setValue] = createSignal(5);
    update = setValue;

    return {
      state: createNumberFieldState({
        locale: "en-US",
        onChange(next) {
          requests.push(next);

          if (accept) {
            setValue(next);
          }
        },
        get value() {
          return value();
        },
      }),
    };
  });

  app.send(app.input, "change", { value: "8" });
  expect(requests).toEqual([]);
  app.send(app.input, "submit");
  expect(app.state.inputValue).toBe("5");
  app.send(app.input, "change", { value: "8" });
  app.send(app.increment, "click");
  expect(app.state.numberValue).toBe(5);
  expect(app.input.props.get("value")).toBe("5");
  expect(requests).toEqual([8, 9]);
  accept = true;
  app.send(app.increment, "click");
  expect(app.state.numberValue).toBe(6);
  app.root.flushSync(() => update(20));
  expect(app.input.props.get("value")).toBe("20");
});

test.each(["submit", "blur"])(
  "NumberField %s publishes validation for unchanged and empty drafts",
  (event) => {
    const app = setupNumber(() => ({
      state: createNumberFieldState({
        defaultValue: 5,
        locale: "en-US",
        validate: () => "Invalid amount",
        validationBehavior: "native",
      }),
    }));

    expect(app.behavior.isInvalid).toBe(false);
    app.send(app.input, event);
    expect(app.behavior.isInvalid).toBe(true);
    expect(app.behavior.validationErrors).toEqual(["Invalid amount"]);
    app.root.flushSync(() => {
      app.state.resetValidation();
    });
    expect(app.behavior.isInvalid).toBe(false);
    app.send(app.input, "change", { value: "" });
    app.send(app.input, event);
    expect(app.state.numberValue).toBeNaN();
    expect(app.behavior.isInvalid).toBe(true);
    expect(app.behavior.validationErrors).toEqual(["Invalid amount"]);
  }
);

test("NumberField reactive guards block editing, commits, keys, and pending button presses", () => {
  let disable!: Setter<boolean>;
  let lock!: Setter<boolean>;
  let relabel!: Setter<string>;
  const requests: number[] = [];

  const app = setupNumber(() => {
    const [disabled, setDisabled] = createSignal(false);
    const [readonly, setReadonly] = createSignal(false);
    const [label, setLabel] = createSignal("Increase value");
    disable = setDisabled;
    lock = setReadonly;
    relabel = setLabel;

    return {
      props: {
        get incrementButtonLabel() {
          return label();
        },
        get isDisabled() {
          return disabled();
        },
        get isReadOnly() {
          return readonly();
        },
      },
      state: createNumberFieldState({
        defaultValue: 5,
        locale: "en-US",
        onChange: (next) => {
          requests.push(next);
        },
      }),
    };
  });

  const attempt = () => {
    app.send(app.input, "change", { value: "8" });
    app.send(app.input, "submit");
    app.send(app.input, "blur");
    app.send(app.input, "keyDown", { key: "up" });
    app.send(app.increment, "click");
  };

  app.send(app.increment, "keyDown", { key: "space" });
  app.root.flushSync(() => disable(true));
  app.send(app.increment, "keyUp", { key: "space" });
  attempt();
  expect(app.input.props.get("tabIndex")).toBe(-1);
  expect(app.input.props.get("readOnly")).toBe(true);
  app.root.flushSync(() => {
    disable(false);
    lock(true);
    relabel("Increase amount");
  });
  attempt();
  expect(app.input.props.get("tabIndex")).toBe(0);
  expect(app.input.props.get("aria-readonly")).toBe(true);
  expect(app.increment.props.get("aria-label")).toBe("Increase amount");
  expect(app.state.numberValue).toBe(5);
  expect(requests).toEqual([]);
  app.root.flushSync(() => lock(false));
  app.send(app.increment, "click");
  expect(app.state.numberValue).toBe(6);
});

test("NumberField exposes state validation and cleans up press handlers on unmount", () => {
  const app = setupNumber(() => ({
    state: createNumberFieldState({
      defaultValue: 5,
      locale: "en-US",
      validate: () => "Invalid amount",
      validationBehavior: "aria",
    }),
  }));

  expect(app.behavior.isInvalid).toBe(true);
  expect(app.input.props.get("aria-invalid")).toBe(true);
  expect(app.behavior.validationErrors).toEqual(["Invalid amount"]);
  expect(app.behavior.validationDetails.customError).toBe(true);
  app.send(app.increment, "keyDown", { key: "space" });
  app.root.unmount();
  app.send(app.increment, "keyUp", { key: "space" });
  app.send(app.increment, "click");
  app.send(app.input, "keyDown", { key: "up" });
  expect(app.state.numberValue).toBe(5);
});
