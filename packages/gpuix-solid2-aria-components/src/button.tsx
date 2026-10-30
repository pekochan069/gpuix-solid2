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
 * Derived from Adobe React Spectrum: packages/react-aria-components/src/Button.tsx.
 * Modified for Solid Aria: adapted components, contexts, refs, and reactive properties for Solid 2; uses Solid class props.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt at the repository root.
 * Modified for GPUIX: native host refs, styles, interactions, and rendering; browser and group integrations omitted. See NOTICE.txt.
 */

import type { JSX } from "gpuix-solid2";
import { createButton, createFocusRing, createHover } from "gpuix-solid2-aria";
import { createContext, untrack, merge, omit } from "solid-js";

import {
  createContextProps,
  createRenderProps,
  createSurfaceProps,
} from "./utils.js";
import type { ContextValue, NativeOptions, RenderProps } from "./utils.js";

export interface ButtonRenderProps {
  isHovered: boolean;
  isPressed: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
  isDisabled: boolean;
  isPending: boolean;
}

export interface ButtonProps
  extends
    Omit<NativeOptions, "onChange" | "inputRef">,
    RenderProps<ButtonRenderProps> {
  isPending?: boolean;
  isPressed?: boolean;
}

export const ButtonContext = createContext<ContextValue<ButtonProps>>(null);

export const Button = (input: ButtonProps): JSX.Element => {
  const { props, ref, setRef } = createContextProps(input, ButtonContext);

  const interaction = merge(omit(props, "onFocus", "onBlur", "onFocusChange"), {
    get isDisabled() {
      return props.isDisabled === true || props.isPending === true;
    },
  });

  const aria = createButton(interaction, ref);
  const focus = untrack(() => createFocusRing(props));
  const hover = createHover(interaction);

  const values: ButtonRenderProps = {
    get isDisabled() {
      return props.isDisabled === true;
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
    get isPending() {
      return props.isPending === true;
    },
    get isPressed() {
      return (
        !(props.isPending === true) &&
        (props.isPressed === true || aria.isPressed)
      );
    },
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
