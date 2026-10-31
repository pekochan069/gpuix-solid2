/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/*
 * Derived from Solid Aria's numberfield/create-number-field.ts and Adobe React
 * Spectrum's packages/react-aria/src/numberfield/useNumberField.ts. Modified for
 * GPUIX: native editing and focus, explicit state, application-localized buttons,
 * and commit-time parsing without DOM input filtering, forms, or live regions.
 */

import type { EventPayload, InputProps, KeyEvent } from "gpuix-solid2";
import type { NumberFieldState } from "gpuix-solid2-stately/numberfield/create-number-field-state";
import { merge } from "solid-js";

import { createTextField } from "./controls.js";
import type {
  ButtonProps,
  NativeControlProps,
  TextFieldProps,
} from "./controls.js";
import { createKeyboard } from "./interactions.js";
import type { KeyboardProps } from "./interactions.js";
import { createNativeServices } from "./native.js";
import type { NativeRef } from "./native.js";

export interface NumberFieldProps
  extends
    Omit<TextFieldProps, "value" | "defaultValue" | "onChange" | "onSubmit">,
    KeyboardProps {
  isRequired?: boolean;
  /** Localized by the application. Defaults to "Increase value". */
  incrementButtonLabel?: string;
  /** Localized by the application. Defaults to "Decrease value". */
  decrementButtonLabel?: string;
}

export const createNumberField = (
  props: NumberFieldProps,
  state: NumberFieldState,
  inputRef: NativeRef
) => {
  const services = createNativeServices();
  const blocked = () => props.isDisabled === true || props.isReadOnly === true;

  const step = (direction: "increment" | "decrement") => {
    if (
      !blocked() &&
      (direction === "increment" ? state.canIncrement : state.canDecrement)
    ) {
      state[direction]();
    }
  };

  const commit = (value?: string) => {
    if (!blocked()) {
      state.commit(value);
      state.commitValidation();
    }
  };

  const field = createTextField(
    merge(props, {
      onBlur(event: EventPayload) {
        commit();
        props.onBlur?.(event);
      },
      onChange: state.setInputValue,
      onSubmit: commit,
      get value() {
        return state.inputValue;
      },
    })
  );

  const keyboard = createKeyboard(
    merge(props, {
      onKeyDown(event: KeyEvent) {
        props.onKeyDown?.(event);

        if (
          event.defaultPrevented ||
          blocked() ||
          event.modifiers?.ctrl === true ||
          event.modifiers?.alt === true ||
          event.modifiers?.cmd === true
        ) {
          return;
        }

        switch (event.key ?? "") {
          case "ArrowUp":
          case "PageUp": {
            step("increment");
            break;
          }

          case "ArrowDown":
          case "PageDown": {
            step("decrement");
            break;
          }

          default: {
            return;
          }
        }

        event.preventDefault();
        event.stopPropagation();
      },
    })
  );

  const stepButton = (direction: "increment" | "decrement"): ButtonProps => ({
    get "aria-label"() {
      return direction === "increment"
        ? (props.incrementButtonLabel ?? "Increase value")
        : (props.decrementButtonLabel ?? "Decrease value");
    },
    get isDisabled() {
      return (
        blocked() ||
        !(direction === "increment" ? state.canIncrement : state.canDecrement)
      );
    },
    onPress() {
      step(direction);
    },
    onPressStart() {
      services.focus(inputRef);
    },
    preventFocusOnPress: true,
    tabIndex: -1,
  });

  return {
    decrementButtonProps: stepButton("decrement"),
    incrementButtonProps: stepButton("increment"),
    get inputProps(): InputProps &
      NativeControlProps & {
        "aria-valuemin"?: number;
        "aria-valuemax"?: number;
        "aria-valuenow"?: number;
        "aria-valuetext": string;
      } {
      return merge(field.inputProps, keyboard.keyboardProps, {
        get "aria-disabled"() {
          return props.isDisabled === true;
        },
        get "aria-invalid"() {
          return state.displayValidation.isInvalid;
        },
        get "aria-readonly"() {
          return props.isReadOnly === true;
        },
        get "aria-required"() {
          return props.isRequired === true;
        },
        get "aria-valuemax"() {
          return state.maxValue;
        },
        get "aria-valuemin"() {
          return state.minValue;
        },
        get "aria-valuenow"() {
          return Number.isNaN(state.numberValue)
            ? undefined
            : state.numberValue;
        },
        get "aria-valuetext"() {
          return state.inputValue;
        },
        role: "spinbutton",
      });
    },
    get isInvalid() {
      return state.displayValidation.isInvalid;
    },
    get validationDetails() {
      return state.displayValidation.validationDetails;
    },
    get validationErrors() {
      return state.displayValidation.validationErrors;
    },
  };
};
