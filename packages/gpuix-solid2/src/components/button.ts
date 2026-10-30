/** Headless Base UI-shaped Button: a focusable `div` that acts like `<button>`. */

import type { EventPayload } from "@gpuix/native";
import type { HostProps, KeyEvent } from "@gpuix/native/host";
import { omit, merge } from "solid-js";
import type { Element } from "solid-js";

import { renderSlot, resolveStyle } from "./floating.js";
import type { StateStyle } from "./floating.js";

export interface ButtonState {
  disabled: boolean;
}

export interface ButtonBehavior {
  disabled?: boolean;
  /** Keep a disabled button in the Tab order, for example while it saves. */
  focusableWhenDisabled?: boolean;
  onClick?: (event: EventPayload) => void;
  onKeyDown?: (event: KeyEvent) => void;
  onKeyUp?: (event: KeyEvent) => void;
  tabIndex?: number;
}

/**
 * Props that make any element act like a `<button>`: a tab stop, `role`, and
 * `onClick` from a press, Enter (on key down) or Space (on key up), like a
 * browser. Reads `behavior` lazily, so a reactive `disabled` stays live.
 * Primitives such as `DialogTrigger` build on it.
 */
export const buttonProps = (behavior: ButtonBehavior) => {
  const disabled = () => behavior.disabled ?? false;

  return {
    onClick(event: EventPayload) {
      if (!disabled()) {
        behavior.onClick?.(event);
      }
    },
    onKeyDown(event: KeyEvent) {
      behavior.onKeyDown?.(event);

      if (disabled() || event.defaultPrevented) {
        return;
      }

      if (event.key === "enter" && event.isHeld !== true) {
        behavior.onClick?.(event);
      }

      // Space would otherwise scroll or type; it fires on release.
      if (event.key === "space") {
        event.preventDefault();
      }
    },
    onKeyUp(event: KeyEvent) {
      behavior.onKeyUp?.(event);

      if (!disabled() && !event.defaultPrevented && event.key === "space") {
        behavior.onClick?.(event);
      }
    },
    role: "button",
    // Unset keeps an `asChild` child's own tabIndex; renderSlot defaults to 0.
    get tabIndex() {
      return disabled() && behavior.focusableWhenDisabled !== true
        ? -1
        : behavior.tabIndex;
    },
  };
};

export interface ButtonProps
  extends
    Omit<HostProps, "style" | "onClick" | "onKeyDown" | "onKeyUp">,
    ButtonBehavior {
  children?: Element;
  asChild?: boolean;
  style?: StateStyle<ButtonState>;
}

export const Button = (allProps: ButtonProps): Element => {
  const props = omit(
    allProps,
    "disabled",
    "focusableWhenDisabled",
    "onClick",
    "onKeyDown",
    "onKeyUp",
    "tabIndex",
    "asChild",
    "children",
    "style"
  );

  const button = buttonProps(allProps);

  const forwardedProps = merge(props, button, {
    get style() {
      return resolveStyle(allProps.style, {
        disabled: allProps.disabled ?? false,
      });
    },
  });

  return renderSlot({
    get asChild() {
      return allProps.asChild;
    },
    get children() {
      return allProps.children;
    },
    defaultTabIndex: 0,
    props: forwardedProps,
  });
};
