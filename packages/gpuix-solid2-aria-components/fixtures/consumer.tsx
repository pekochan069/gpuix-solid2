import assert from "node:assert/strict";

import { createRoot } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import {
  Button,
  ButtonContext,
  DEFAULT_SLOT,
} from "gpuix-solid2-aria-components";
import { Checkbox } from "gpuix-solid2-aria-components/checkbox";
import { Radio, RadioGroup } from "gpuix-solid2-aria-components/radio-group";
import { ToggleButton } from "gpuix-solid2-aria-components/toggle-button";
import { createSignal } from "solid-js";

for (const name of ["window", "document", "navigator", "HTMLElement"]) {
  Reflect.deleteProperty(globalThis, name);
}

const root = createRoot({ applyBatch: () => [] });
let button!: HostElement;
let toggle!: HostElement;
let checkbox!: HostElement;
let radio!: HostElement;
let radioValue = () => "";
let presses = 0;
let selected = () => false;
let checked = () => false;

try {
  root.render(() => {
    const [value, setValue] = createSignal(false);
    checked = value;

    return (
      <div>
        <RadioGroup defaultValue="standard" aria-label="Shipping">
          {(state) => {
            radioValue = () => state.state.selectedValue ?? "";

            return (
              <>
                <Radio value="standard" aria-label="Standard" />
                <Radio
                  value="express"
                  aria-label="Express"
                  ref={(node) => {
                    radio = node;
                  }}
                />
              </>
            );
          }}
        </RadioGroup>
        <ButtonContext
          value={{ slots: { [DEFAULT_SLOT]: { "aria-label": "Save" } } }}
        >
          <Button
            ref={(node) => {
              button = node;
            }}
            onPress={() => {
              presses += 1;
            }}
          >
            Save
          </Button>
        </ButtonContext>
        <ToggleButton
          ref={(node) => {
            toggle = node;
          }}
          style={(state) => ({ opacity: state.isSelected ? 1 : 0.5 })}
        >
          {(state) => {
            selected = () => state.isSelected;

            return state.isSelected ? "On" : "Off";
          }}
        </ToggleButton>
        <Checkbox
          ref={(node) => {
            checkbox = node;
          }}
          isSelected={value()}
          onChange={(next) => {
            setValue(next);
          }}
          aria-label="Accept terms"
        >
          {(state) => (state.isSelected ? "Checked" : "Unchecked")}
        </Checkbox>
      </div>
    );
  });

  for (const node of [button, toggle, checkbox]) {
    root.dispatch({ elementId: node.id, eventType: "keyDown", key: "space" });
    root.dispatch({ elementId: node.id, eventType: "keyUp", key: "space" });
    root.flush();
  }

  root.dispatch({ elementId: radio.id, eventType: "click" });
  assert.equal(radioValue(), "express");
  assert.equal(radio.props.get("role"), "radio");
  assert.equal(radio.props.get("tabIndex"), 0);
  assert.equal(presses, 1);
  assert.equal(selected(), true);
  assert.equal(checked(), true);
  assert.equal(button.props.get("aria-label"), "Save");
  assert.equal(toggle.style.opacity, 1);
  assert.equal(checkbox.props.get("role"), "checkbox");
  console.log(
    "Packed native JSX consumer passed with one Solid client runtime and no browser globals."
  );
} finally {
  root.unmount();
}
