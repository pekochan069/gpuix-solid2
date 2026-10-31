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
 * Derived from Solid Aria's select/create-select.ts, based on Adobe React
 * Spectrum's useSelect.ts. Modified for GPUIX: native trigger and listbox
 * composition, direct labels, normalized keys, and single-character search.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import type { KeyEvent } from "gpuix-solid2";
import type {
  SelectionMode,
  SelectState,
} from "gpuix-solid2-stately/select/create-select-state";
import { createUniqueId, merge } from "solid-js";

import { ListKeyboardDelegate } from "./collections.js";
import type { NativeControlProps } from "./controls.js";
import { createCollator } from "./i18n.js";
import { createMenuTrigger } from "./menu-trigger.js";
import type { MenuTriggerProps } from "./menu-trigger.js";
import { normalizeKeyboardEvent } from "./native.js";
import type { NativeRef } from "./native.js";

export interface SelectProps extends MenuTriggerProps {
  isRequired?: boolean;
  onKeyDown?: (event: KeyEvent) => void;
  onKeyUp?: (event: KeyEvent) => void;
}

/** Compose menuProps with createListBox; mount the popup only while state.isOpen. */
export const createSelect = <T, M extends SelectionMode = "single">(
  props: SelectProps,
  state: SelectState<T, M>,
  ref: NativeRef
) => {
  const trigger = createMenuTrigger(props, state, ref);
  const valueId = `select-value-${createUniqueId()}`;
  const collator = createCollator({ sensitivity: "base", usage: "search" });

  const delegate = new ListKeyboardDelegate({
    collator,
    get collection() {
      return state.collection;
    },
    get disabledKeys() {
      return state.disabledKeys;
    },
  });

  const menuProps = merge(trigger.menuProps, {
    shouldFocusWrap: true,
    shouldSelectOnFocus: false,
  });

  return {
    get isInvalid() {
      return state.displayValidation.isInvalid;
    },
    get isPressed() {
      return trigger.isPressed;
    },
    menuProps,
    get triggerProps(): NativeControlProps {
      return merge(trigger.menuTriggerProps, {
        get "aria-haspopup"(): "listbox" {
          return "listbox";
        },
        get "aria-invalid"() {
          return state.displayValidation.isInvalid;
        },
        get "aria-labelledby"() {
          return `${valueId} ${trigger.menuTriggerProps["aria-id"]}`;
        },
        get "aria-required"() {
          return props.isRequired === true;
        },
        // oxlint-disable-next-line complexity -- Trigger opening, modifier guards and closed selection keys share one native boundary.
        onKeyDown(event: KeyEvent) {
          const normalized = normalizeKeyboardEvent(event);
          props.onKeyDown?.(normalized);

          if (normalized.defaultPrevented || props.isDisabled === true) {
            return;
          }

          trigger.menuTriggerProps.onKeyDown?.(event);

          if (
            event.defaultPrevented ||
            state.isOpen ||
            state.selectionManager.selectionMode === "multiple" ||
            event.modifiers?.ctrl === true ||
            event.modifiers?.cmd === true ||
            event.modifiers?.alt === true
          ) {
            return;
          }

          const key = normalized.key ?? "";
          const selected = state.selectionManager.firstSelectedKey;
          let next = null;

          if (key === "ArrowLeft") {
            next =
              selected === null
                ? delegate.getFirstKey()
                : delegate.getKeyAbove(selected);
          } else if (key === "ArrowRight") {
            next =
              selected === null
                ? delegate.getFirstKey()
                : delegate.getKeyBelow(selected);
          } else if (key.length === 1 && key !== " ") {
            next = delegate.getKeyForSearch(key, selected ?? undefined);
          } else {
            return;
          }

          event.preventDefault();

          if (next !== null) {
            state.setValue(next);
          }
        },
        onKeyUp(event: KeyEvent) {
          props.onKeyUp?.(normalizeKeyboardEvent(event));

          if (!event.defaultPrevented) {
            trigger.menuTriggerProps.onKeyUp?.(event);
          }
        },
      });
    },
    get validationDetails() {
      return state.displayValidation.validationDetails;
    },
    get validationErrors() {
      return state.displayValidation.validationErrors;
    },
    valueProps: { "aria-id": valueId },
  };
};
