/* oxlint-disable solid/style-prop -- GPUIX accepts camelCase styles and numeric pixel values. */
import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement, StyleDesc } from "gpuix-solid2";
import { createSignal } from "solid-js";
import type { Setter } from "solid-js";

import { Button, Radio, RadioGroup } from "../src/index.js";

const title = "GPUIX RadioGroup native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 480, title, width: 560 });

const app = createRoot(renderer, { keyboardFocusDim: false });
let before!: HostElement;
let after!: HostElement;
let standard!: HostElement;
let express!: HostElement;
let disabled!: HostElement;
let readonly!: HostElement;
let disable!: Setter<boolean>;
let setValue!: Setter<string | null>;
let selected!: () => string | null;
let focusVisible!: () => boolean;
const changes: string[] = [];

const style = (isSelected: boolean, isFocused = false): StyleDesc => ({
  backgroundColor: isSelected ? "#285f46" : "#e8edf2",
  borderColor: isFocused ? "#2878c8" : "#aab7c4",
  borderRadius: 6,
  borderWidth: 2,
  color: isSelected ? "#ffffff" : "#102030",
  height: 42,
  padding: 10,
  width: 340,
});

app.render(() => {
  const [value, updateValue] = createSignal<string | null>("standard");
  const [isDisabled, setDisabled] = createSignal(false);
  selected = value;
  setValue = updateValue;
  disable = setDisabled;

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        color: "#102030",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        padding: 20,
      }}
    >
      <text>Native Solid 2 RadioGroup</text>
      <Button
        aria-label="Before"
        ref={(node) => {
          before = node;
        }}
        style={style(false)}
      >
        Before group
      </Button>
      <RadioGroup
        aria-label="Shipping"
        aria-description={`Selected ${value()}`}
        value={value()}
        isDisabled={isDisabled()}
        onChange={(next) => {
          changes.push(next);
          updateValue(next);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <Radio
          value="standard"
          aria-label="Standard"
          aria-description={value() === "standard" ? "Selected" : "Unselected"}
          ref={(node) => {
            standard = node;
          }}
          style={(state) => style(state.isSelected, state.isFocusVisible)}
        >
          {(state) => {
            focusVisible = () => state.isFocusVisible;

            return state.isSelected ? "(o) Standard" : "( ) Standard";
          }}
        </Radio>
        <Radio
          value="disabled"
          aria-label="Unavailable"
          isDisabled
          ref={(node) => {
            disabled = node;
          }}
          style={{ ...style(false), opacity: 0.5 }}
        >
          Unavailable
        </Radio>
        <Radio
          value="express"
          aria-label="Express"
          aria-description={value() === "express" ? "Selected" : "Unselected"}
          ref={(node) => {
            express = node;
          }}
          style={(state) => style(state.isSelected, state.isFocusVisible)}
        >
          {(state) => (state.isSelected ? "(o) Express" : "( ) Express")}
        </Radio>
      </RadioGroup>
      <Button
        aria-label="After"
        ref={(node) => {
          after = node;
        }}
        style={style(false)}
      >
        After group
      </Button>
      <RadioGroup
        aria-label="Readonly plan"
        defaultValue="fixed"
        isReadOnly
        onChange={() => {
          throw new Error("Readonly group changed");
        }}
      >
        <Radio
          value="fixed"
          aria-label="Fixed"
          ref={(node) => {
            readonly = node;
          }}
          style={style(true)}
        >
          Readonly selected
        </Radio>
        <Radio value="other" aria-label="Other" style={style(false)}>
          Readonly alternative
        </Radio>
      </RadioGroup>
    </div>
  );
});

const settle = async () => {
  app.flush();
  renderer.tick();
  await Bun.sleep(80);
  app.flush();
};

const key = async (value: string) => {
  renderer.simulateKeyDown(value);
  renderer.simulateKeyUp(value);
  await settle();
};

const click = async (node: HostElement) => {
  const box = renderer.getElementBounds(node.id);
  assert.ok(box && box.width > 0 && box.height > 0);
  renderer.simulateClick(box.x + box.width / 2, box.y + box.height / 2);
  await settle();
};

try {
  if (process.env.GPUIX_ARIA_XDOTOOL !== undefined) {
    const result = Bun.spawnSync([
      process.env.GPUIX_ARIA_XDOTOOL,
      "search",
      "--name",
      title,
      "windowfocus",
      "--sync",
    ]);

    assert.equal(result.exitCode, 0);
  }

  renderer.activateWindow();
  await settle();
  renderer.focusElement(before.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    standard.id,
    "Tab enters at the selected radio"
  );
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    after.id,
    "Tab leaves the group after one stop"
  );
  await key("shift-tab");
  assert.equal(
    renderer.getFocusedElementId(),
    standard.id,
    "Shift Tab returns to the selected radio"
  );
  renderer.focusElement(standard.id);
  await key("down");
  assert.equal(
    renderer.getFocusedElementId(),
    express.id,
    "Down skips the disabled radio"
  );
  assert.equal(selected(), "express");
  await key("down");
  assert.equal(
    renderer.getFocusedElementId(),
    standard.id,
    "Down wraps to Standard"
  );
  assert.equal(selected(), "standard");
  assert.equal(focusVisible(), true);
  await key("up");
  assert.equal(selected(), "express");
  await click(standard);
  assert.equal(selected(), "standard");
  await click(disabled);
  assert.equal(selected(), "standard");
  await click(express);
  await key("enter");
  assert.equal(selected(), "express");
  renderer.focusElement(standard.id);
  await key("space");
  assert.equal(selected(), "standard");
  app.flushSync(() => disable(true));
  await click(express);
  assert.equal(selected(), "standard");
  renderer.focusElement(before.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    after.id,
    "Tab skips a disabled group"
  );
  app.flushSync(() => {
    disable(false);
    setValue(null);
  });
  renderer.focusElement(before.id);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    standard.id,
    "An empty selection retains the last focused Tab stop"
  );
  await key("space");
  assert.equal(selected(), "standard");
  await click(readonly);
  await key("down");
  await key("space");
  assert.ok(changes.length >= 6);
  console.log(
    "Native RadioGroup mouse, keyboard, wrapping, disabled skipping, single Tab stop, controlled state, readonly, and focus visibility passed."
  );

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Radio inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(
      readonly.props.get("aria-checked"),
      true,
      "AT-SPI cannot change readonly selection"
    );
    assert.equal(
      selected(),
      "express",
      "AT-SPI radio Click must update controlled Solid state"
    );
  }
} finally {
  app.unmount();
}

process.exit(0);
