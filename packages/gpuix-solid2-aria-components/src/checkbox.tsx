/*
 * Copyright 2022 Adobe. All rights reserved.
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
 * Derived from Adobe React Spectrum: packages/react-aria-components/src/Checkbox.tsx.
 * Modified for Solid Aria: adapted components, contexts, refs, and reactive properties for Solid 2; uses Solid class props.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt at the repository root.
 * Modified for GPUIX: native host refs, styles, interactions, and rendering; browser and group integrations omitted. See NOTICE.txt.
 */

import type { JSX } from "gpuix-solid2";
import {
  createCheckbox,
  createFocusRing,
  createHover,
} from "gpuix-solid2-aria";
import { createToggleState } from "gpuix-solid2-stately";
import { createContext, merge, untrack, omit } from "solid-js";

import {
  createContextProps,
  createRenderProps,
  createSurfaceProps,
} from "./utils.js";
import type { ContextValue, NativeOptions, RenderProps } from "./utils.js";

export interface CheckboxRenderProps {
  isSelected: boolean;
  isHovered: boolean;
  isPressed: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isInvalid: boolean;
  isRequired: boolean;
  isIndeterminate: boolean;
}

export interface CheckboxProps
  extends NativeOptions, RenderProps<CheckboxRenderProps> {
  isSelected?: boolean;
  defaultSelected?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  isRequired?: boolean;
  isIndeterminate?: boolean;
}

export const CheckboxContext = createContext<ContextValue<CheckboxProps>>(null);

export const Checkbox = (input: CheckboxProps): JSX.Element => {
  const { props, ref, setRef } = createContextProps(input, CheckboxContext);
  const state = createToggleState(props);

  const aria = createCheckbox(
    omit(props, "onFocus", "onBlur", "onFocusChange"),
    state,
    ref
  );

  const focus = untrack(() => createFocusRing(props));

  const hover = createHover(
    merge(props, {
      get isDisabled() {
        return aria.isDisabled || aria.isReadOnly;
      },
    })
  );

  const values: CheckboxRenderProps = {
    get isDisabled() {
      return aria.isDisabled;
    },
    get isFocusVisible() {
      return focus.isFocusVisible;
    },
    get isFocused() {
      return focus.isFocused;
    },
    get isHovered() {
      return hover.isHovered;
    },
    get isIndeterminate() {
      return props.isIndeterminate === true;
    },
    get isInvalid() {
      return props.isInvalid === true;
    },
    get isPressed() {
      return aria.isPressed;
    },
    get isReadOnly() {
      return aria.isReadOnly;
    },
    get isRequired() {
      return props.isRequired === true;
    },
    get isSelected() {
      return state.isSelected;
    },
  };

  const render = createRenderProps(props, values);

  return (
    <div
      {...createSurfaceProps(props, aria.inputProps, focus, hover)}
      {...render}
      ref={setRef}
    />
  );
};
