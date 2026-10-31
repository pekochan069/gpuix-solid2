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
 * Derived from Solid Aria's menu/create-menu-trigger.ts, based on Adobe React
 * Spectrum's useMenuTrigger.ts. Modified for GPUIX: composed native button props,
 * native focus and key names, direct labels, and mouse/keyboard/OS Click only.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import type { KeyEvent } from "gpuix-solid2";
import type { MenuTriggerState } from "gpuix-solid2-stately/menu/create-menu-trigger-state";
import { createUniqueId, merge } from "solid-js";

import { createButton } from "./controls.js";
import type { ButtonProps, NativeControlProps } from "./controls.js";
import type { PressEvent } from "./interactions.js";
import type { MenuProps } from "./menu.js";
import { createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export type MenuTriggerProps = Omit<ButtonProps, "preventFocusOnPress">;

/** Spread menuTriggerProps directly onto a native div. Mount the menu while open. */
export const createMenuTrigger = (
  props: MenuTriggerProps,
  state: MenuTriggerState,
  ref: NativeRef
) => {
  const services = createNativeServices();
  const triggerId = `menu-trigger-${createUniqueId()}`;
  const menuId = `menu-${createUniqueId()}`;

  const button = createButton(
    merge(props, {
      onPress(event: PressEvent) {
        if (event.pointerType === "virtual") {
          services.focus(ref);
          state.open("first");
        }

        props.onPress?.(event);
      },
      onPressStart(event: PressEvent) {
        // Focus before requesting open so the new overlay owns subsequent focus.
        services.focus(ref);

        if (event.pointerType === "keyboard") {
          state.toggle("first");
        } else {
          state.open();
        }

        props.onPressStart?.(event);
      },
      preventFocusOnPress: true,
    }),
    ref
  );

  return {
    get isPressed() {
      return button.isPressed;
    },
    menuProps: {
      "aria-id": menuId,
      get "aria-label"() {
        return props["aria-label"];
      },
      "aria-labelledby": triggerId,
      get autoFocus() {
        return state.focusStrategy ?? true;
      },
      onClose: () => {
        state.close();
      },
    } satisfies MenuProps<unknown>,
    get menuTriggerProps(): NativeControlProps {
      return merge(button.buttonProps, {
        get "aria-controls"() {
          return state.isOpen ? menuId : undefined;
        },
        get "aria-expanded"() {
          return state.isOpen;
        },
        get "aria-haspopup"(): "menu" {
          return "menu";
        },
        "aria-id": triggerId,
        onKeyDown(event: KeyEvent) {
          if (
            props.isDisabled === true ||
            event.defaultPrevented ||
            event.isHeld === true ||
            event.modifiers?.ctrl === true ||
            event.modifiers?.cmd === true ||
            event.modifiers?.shift === true
          ) {
            return;
          }

          const key = normalizeKey(event.key);

          if (key === "ArrowDown" || key === "ArrowUp") {
            event.preventDefault();
            services.focus(ref);
            state.toggle(key === "ArrowUp" ? "last" : "first");
          } else {
            button.buttonProps.onKeyDown?.(event);
          }
        },
      });
    },
  };
};
