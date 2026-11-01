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
 * Derived from Solid Aria's tooltip/create-tooltip-trigger.ts and create-tooltip.ts,
 * based on Adobe React Spectrum's useTooltipTrigger.ts and useTooltip.ts.
 * Modified for GPUIX: native focus and mouse events, native IDs, direct labels,
 * and the shared native Escape stack instead of document listeners.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import { pushDismissLayer } from "gpuix-solid2";
import type { KeyEvent } from "gpuix-solid2";
import type {
  TooltipTriggerProps as StateProps,
  TooltipTriggerState,
} from "gpuix-solid2-stately/tooltip/create-tooltip-trigger-state";
import { createEffect, createUniqueId, merge, onCleanup } from "solid-js";

import type { NativeControlProps } from "./controls.js";
import { createFocus, createHover } from "./interactions.js";
import { createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export type TooltipTriggerProps = Pick<
  StateProps,
  "isDisabled" | "trigger" | "shouldCloseOnPress"
>;

const hoveredTooltips = new WeakSet<TooltipTriggerState>();
const hoveredTriggers = new WeakSet<TooltipTriggerState>();

export const createTooltipTrigger = (
  props: TooltipTriggerProps,
  state: TooltipTriggerState,
  ref: NativeRef
) => {
  const services = createNativeServices();
  const id = `tooltip-${createUniqueId()}`;
  let focused = false;
  let mousePressed = false;

  const hide = (immediate = false) => {
    hoveredTriggers.delete(state);
    focused = false;

    // Native enter can precede trigger leave when moving onto the tooltip.
    if (immediate || !hoveredTooltips.has(state)) {
      state.close(immediate);
    }
  };

  const showOnHover = () => {
    if (
      props.isDisabled === true ||
      props.trigger === "focus" ||
      (mousePressed && props.shouldCloseOnPress !== false) ||
      hoveredTriggers.has(state)
    ) {
      return;
    }

    hoveredTriggers.add(state);
    state.open(focused);
  };

  const closeOnPress = () => {
    if (props.shouldCloseOnPress !== false) {
      hide(true);
    }
  };

  const hover = createHover({
    get isDisabled() {
      return props.isDisabled;
    },
    onHoverEnd() {
      if (props.trigger !== "focus") {
        hide();
      }
    },
    onHoverStart() {
      // Layout-only hover notifications must not reopen a keyboard-dismissed tooltip.
      if (services.getInteractionModality() !== "keyboard") {
        showOnHover();
      }
    },
  });

  const focus = createFocus({
    get isDisabled() {
      return props.isDisabled;
    },
    onBlur: () => {
      mousePressed = false;
      hide(true);
    },
    onFocus() {
      if (services.getInteractionModality() !== "pointer") {
        focused = true;
        state.open(true);
      }
    },
  });

  createEffect(
    () => props.isDisabled === true,
    (disabled) => {
      if (disabled) {
        hide(true);
      }
    }
  );
  createEffect(
    () => state.isOpen,
    (open) =>
      open
        ? pushDismissLayer(services.renderer, {
            onEscapeKeyDown(event) {
              event.preventDefault();
              hide(true);
            },
          })
        : undefined
  );

  onCleanup(() => {
    hoveredTriggers.delete(state);
  });

  return {
    tooltipProps: { "aria-id": id },
    get triggerProps() {
      return merge(focus.focusProps, hover.hoverProps, {
        get "aria-describedby"() {
          return state.isOpen ? id : undefined;
        },
        onClick() {
          mousePressed = false;
          closeOnPress();
        },
        onKeyDown(event: KeyEvent) {
          if (event.defaultPrevented || ref()?.mounted !== true) {
            return;
          }

          if (normalizeKey(event.key) === "Escape" && state.isOpen) {
            event.preventDefault();
            event.stopPropagation();
            hide(true);
          } else {
            closeOnPress();
          }
        },
        onMouseDown() {
          mousePressed = true;
          closeOnPress();
        },
        onMouseMove: showOnHover,
        onMouseUp() {
          mousePressed = false;
        },
      } satisfies NativeControlProps);
    },
  };
};

export interface TooltipProps {
  "aria-id"?: string;
  "aria-label"?: string;
  "aria-description"?: string;
}

/** Mount noninteractive tooltip content only while its trigger state is open. */
export const createTooltip = (
  props: TooltipProps,
  state?: TooltipTriggerState
) => {
  const hover = createHover({
    onHoverEnd() {
      if (state) {
        hoveredTooltips.delete(state);

        if (!hoveredTriggers.has(state)) {
          state.close();
        }
      }
    },
    onHoverStart() {
      if (state) {
        hoveredTooltips.add(state);
        state.open(true);
      }
    },
  });

  onCleanup(() => {
    if (state) {
      hoveredTooltips.delete(state);
    }
  });

  return {
    get tooltipProps() {
      return merge(hover.hoverProps, {
        get "aria-description"() {
          return props["aria-description"];
        },
        get "aria-id"() {
          return props["aria-id"];
        },
        get "aria-label"() {
          return props["aria-label"];
        },
        role: "tooltip",
      } satisfies NativeControlProps);
    },
  };
};
