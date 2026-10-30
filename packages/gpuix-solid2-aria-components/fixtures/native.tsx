/* oxlint-disable solid/style-prop -- GPUIX accepts camelCase styles and numeric pixel values. */
import assert from "node:assert/strict";

import { createRoot, GpuixRenderer } from "gpuix-solid2";
import type { HostElement, StyleDesc } from "gpuix-solid2";
import { createSignal } from "solid-js";
import type { Setter } from "solid-js";

import { Button, Checkbox, ToggleButton } from "../src/index.js";

const title = "GPUIX Aria components native verification";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({ height: 420, title, width: 560 });

const app = createRoot(renderer);
let button!: HostElement;
let toggle!: HostElement;
let checkbox!: HostElement;
let disabled!: HostElement;
let readonly!: HostElement;
let mixed!: HostElement;
let presses = 0;
let toggleSelected = () => false;
let checkboxSelected = () => false;
let focusVisible = () => false;
let hovered = () => false;
let pending!: Setter<boolean>;

const style = (selected = false): StyleDesc => ({
  backgroundColor: selected ? "#285f46" : "#e8edf2",
  borderRadius: 6,
  color: selected ? "#ffffff" : "#102030",
  height: 42,
  padding: 10,
  width: 340,
});

app.render(() => {
  const [count, setCount] = createSignal(0);
  const [selected, setSelected] = createSignal(false);
  const [bold, setBold] = createSignal(false);
  const [isPending, setPending] = createSignal(false);
  pending = setPending;

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
      <text>Native Solid 2 Aria components</text>
      <Button
        aria-label="Save"
        aria-description={`Activated ${count()} times`}
        isPending={isPending()}
        ref={(node) => {
          button = node;
        }}
        onPress={() => {
          presses += 1;
          setCount(presses);
        }}
        style={(state) => ({
          ...style(),
          backgroundColor: state.isFocusVisible ? "#b5d7fa" : "#e8edf2",
        })}
      >
        {(state) => {
          focusVisible = () => state.isFocusVisible;
          hovered = () => state.isHovered;

          return state.isPending ? "Saving…" : `Save (${count()})`;
        }}
      </Button>
      <ToggleButton
        aria-label="Bold"
        ref={(node) => {
          toggle = node;
        }}
        aria-description={bold() ? "Selected" : "Unselected"}
        isSelected={bold()}
        onChange={(next) => {
          setBold(next);
        }}
        style={(state) => style(state.isSelected)}
      >
        {(state) => {
          toggleSelected = () => state.isSelected;

          return state.isSelected ? "Bold: on" : "Bold: off";
        }}
      </ToggleButton>
      <Checkbox
        aria-label="Accept terms"
        aria-description={selected() ? "Checked" : "Unchecked"}
        isSelected={selected()}
        onChange={(next) => {
          setSelected(next);
        }}
        ref={(node) => {
          checkbox = node;
        }}
        style={(state) => style(state.isSelected)}
      >
        {(state) => {
          checkboxSelected = () => state.isSelected;

          return state.isSelected ? "[x] Accept terms" : "[ ] Accept terms";
        }}
      </Checkbox>
      <Button
        aria-label="Disabled"
        isDisabled
        ref={(node) => {
          disabled = node;
        }}
        style={{ ...style(), opacity: 0.5 }}
        onPress={() => {
          throw new Error("Disabled button activated");
        }}
      >
        Disabled
      </Button>
      <Checkbox
        aria-label="Readonly"
        isReadOnly
        defaultSelected
        ref={(node) => {
          readonly = node;
        }}
        style={style()}
        onChange={() => {
          throw new Error("Readonly checkbox changed");
        }}
      >
        Readonly selected
      </Checkbox>
      <Checkbox
        aria-label="Mixed"
        isIndeterminate
        ref={(node) => {
          mixed = node;
        }}
        style={style()}
      >
        Mixed
      </Checkbox>
    </div>
  );
});

const settle = async () => {
  app.flush();
  renderer.tick();
  await Bun.sleep(80);
  app.flush();
};

const click = async (node: HostElement) => {
  const box = renderer.getElementBounds(node.id);
  assert.ok(box && box.width > 0 && box.height > 0);
  renderer.simulateClick(box.x + box.width / 2, box.y + box.height / 2);
  await settle();
};

const key = async (value: string) => {
  renderer.simulateKeyDown(value);
  renderer.simulateKeyUp(value);
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
  await click(button);
  await key("enter");
  await key("space");
  assert.equal(presses, 3);
  assert.equal(focusVisible(), true);
  const bounds = renderer.getElementBounds(button.id);
  assert.ok(bounds);
  renderer.simulateMouseMove(bounds.x + 5, bounds.y + 5);
  await settle();
  assert.equal(hovered(), true);
  await click(toggle);
  assert.equal(toggleSelected(), true);
  await key("space");
  assert.equal(toggleSelected(), false);
  await click(checkbox);
  assert.equal(checkboxSelected(), true);
  await key("enter");
  assert.equal(checkboxSelected(), true);
  await key("space");
  assert.equal(checkboxSelected(), false);
  await click(disabled);
  await click(readonly);
  await key("space");
  renderer.focusElement(button.id);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), toggle.id);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), checkbox.id);
  await key("tab");
  assert.equal(renderer.getFocusedElementId(), readonly.id);
  app.flushSync(() => pending(true));
  await click(button);
  await key("enter");
  assert.equal(presses, 3);
  app.flushSync(() => pending(false));
  assert.ok(renderer.getElementBounds(mixed.id));
  console.log(
    "Native component mouse, keyboard, controlled state, focus, pending, readonly, and disabled checks passed."
  );

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Each native frame must settle before the next tick.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(presses, 4, "AT-SPI Save action must update Solid state");
    assert.equal(
      toggleSelected(),
      true,
      "AT-SPI Toggle action must update Solid state"
    );
    assert.equal(
      checkboxSelected(),
      true,
      "AT-SPI Checkbox action must update controlled Solid state"
    );
  }
} finally {
  app.unmount();
}

process.exit(0);
