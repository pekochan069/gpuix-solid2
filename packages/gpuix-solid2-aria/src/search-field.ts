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
 * Derived from Solid Aria's searchfield/create-search-field.ts and Adobe React
 * Spectrum's packages/react-aria/src/searchfield/useSearchField.ts. Modified for
 * GPUIX: native editor submit events, native focus and keyboard events, explicit
 * state, and an application-provided clear label instead of web dictionaries.
 */

import type { InputProps, KeyEvent } from "gpuix-solid2";
import type { SearchFieldState } from "gpuix-solid2-stately/searchfield/create-search-field-state";
import { merge } from "solid-js";

import { createTextField } from "./controls.js";
import type { ButtonProps, TextFieldProps } from "./controls.js";
import { createKeyboard } from "./interactions.js";
import type { KeyboardProps } from "./interactions.js";
import { createNativeServices } from "./native.js";
import type { NativeRef } from "./native.js";

export interface SearchFieldProps
  extends
    Omit<TextFieldProps, "value" | "defaultValue" | "onChange">,
    KeyboardProps {
  onClear?: () => void;
  /** Localized by the application. Defaults to "Clear search". */
  clearButtonLabel?: string;
}

export const createSearchField = (
  props: SearchFieldProps,
  state: SearchFieldState,
  inputRef: NativeRef
) => {
  const services = createNativeServices();
  const blocked = () => props.isDisabled === true || props.isReadOnly === true;

  const clear = () => {
    if (!blocked()) {
      state.setValue("");
      props.onClear?.();
    }
  };

  const field = createTextField(
    merge(props, {
      defaultValue: undefined,
      onChange: state.setValue,
      onSubmit() {
        if (!blocked()) {
          props.onSubmit?.(state.value);
        }
      },
      get value() {
        return state.value;
      },
    })
  );

  const keyboard = createKeyboard(
    merge(props, {
      onKeyDown(event: KeyEvent) {
        props.onKeyDown?.(event);

        if (
          !event.defaultPrevented &&
          !blocked() &&
          event.key === "Escape" &&
          event.isHeld !== true &&
          state.value !== ""
        ) {
          // Consume this keystroke before the window's overlay dismissal runs.
          event.preventDefault();
          event.stopPropagation();
          clear();
        }
      },
    })
  );

  const clearButtonProps: ButtonProps = {
    get "aria-label"() {
      return props.clearButtonLabel ?? "Clear search";
    },
    get isDisabled() {
      return blocked();
    },
    onPress: clear,
    onPressStart() {
      services.focus(inputRef);
    },
    preventFocusOnPress: true,
    tabIndex: -1,
  };

  return {
    clearButtonProps,
    get inputProps(): InputProps {
      return merge(field.inputProps, keyboard.keyboardProps, {
        role: "searchbox",
      });
    },
    get value() {
      return state.value;
    },
  };
};
