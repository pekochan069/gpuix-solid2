/*
 * Copyright 2024 Adobe. All rights reserved.
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
 * Derived from Solid Aria's disclosure/create-disclosure.ts and Adobe React Spectrum's
 * packages/react-aria/src/disclosure/useDisclosure.ts. Modified for GPUIX: native
 * trigger props and events, explicit state, and conditional panel mounting instead
 * of DOM hidden attributes, browser find-in-page, and animations.
 */

import type { DisclosureState } from "gpuix-solid2-stately/disclosure/create-disclosure-state";
import { createUniqueId, merge } from "solid-js";

import { createButton } from "./controls.js";
import type { ButtonProps, NativeControlProps } from "./controls.js";
import type { PressEvent } from "./interactions.js";
import type { NativeRef } from "./native.js";

export type DisclosureProps = ButtonProps;

/** Mount the panel only while isExpanded is true, using Solid's Show. */
export const createDisclosure = (
  props: DisclosureProps,
  state: DisclosureState,
  triggerRef: NativeRef
) => {
  const triggerId = `disclosure-trigger-${createUniqueId()}`;
  const panelId = `disclosure-panel-${createUniqueId()}`;

  const button = createButton(
    merge(props, {
      onPress(event: PressEvent) {
        if (event.pointerType !== "keyboard") {
          state.toggle();
        }

        props.onPress?.(event);
      },
      onPressStart(event: PressEvent) {
        if (event.pointerType === "keyboard") {
          state.toggle();
        }

        props.onPressStart?.(event);
      },
    }),
    triggerRef
  );

  const panelProps: NativeControlProps = {
    "aria-id": panelId,
    "aria-labelledby": triggerId,
    role: "group",
  };

  return {
    get buttonProps(): NativeControlProps {
      return merge(button.buttonProps, {
        "aria-controls": panelId,
        get "aria-expanded"() {
          return state.isExpanded;
        },
        "aria-id": triggerId,
      });
    },
    get isExpanded() {
      return state.isExpanded;
    },
    get isPressed() {
      return button.isPressed;
    },
    panelProps,
  };
};
