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
 * Derived from Adobe React Spectrum: packages/react-aria-components/src/ToggleButton.tsx.
 * Modified for Solid Aria: adapted components, contexts, refs, and reactive properties for Solid 2; uses Solid class props and an untracked setup-time choice of group interaction behavior.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt at the repository root.
 * Modified for GPUIX: native host refs, styles, interactions, and rendering; browser and group integrations omitted. See NOTICE.txt.
 */

import type { JSX } from "gpuix-solid2";
import {
  createToggleButton,
  createFocusRing,
  createHover,
} from "gpuix-solid2-aria";
import { createToggleState } from "gpuix-solid2-stately";
import type { ToggleState } from "gpuix-solid2-stately/toggle/create-toggle-state";
import { createContext, untrack, omit } from "solid-js";

import type { ButtonRenderProps } from "./button.js";
import {
  createContextProps,
  createRenderProps,
  createSurfaceProps,
} from "./utils.js";
import type { ContextValue, NativeOptions, RenderProps } from "./utils.js";

export interface ToggleButtonRenderProps extends Omit<
  ButtonRenderProps,
  "isPending"
> {
  isSelected: boolean;
  state: ToggleState;
}

export interface ToggleButtonProps
  extends
    Omit<NativeOptions, "inputRef">,
    RenderProps<ToggleButtonRenderProps> {
  isSelected?: boolean;
  defaultSelected?: boolean;
  isReadOnly?: boolean;
}

export const ToggleButtonContext =
  createContext<ContextValue<ToggleButtonProps>>(null);

export const ToggleButton = (input: ToggleButtonProps): JSX.Element => {
  const { props, ref, setRef } = createContextProps(input, ToggleButtonContext);
  const state = createToggleState(props);

  const aria = createToggleButton(
    omit(props, "onFocus", "onBlur", "onFocusChange"),
    state,
    ref
  );

  const focus = untrack(() => createFocusRing(props));
  const hover = createHover(props);

  const values: ToggleButtonRenderProps = {
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
    get isPressed() {
      return aria.isPressed;
    },
    get isSelected() {
      return state.isSelected;
    },
    state,
  };

  const render = createRenderProps(props, values);

  return (
    <div
      {...createSurfaceProps(props, aria.buttonProps, focus, hover)}
      {...render}
      ref={setRef}
    />
  );
};
