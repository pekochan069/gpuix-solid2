import type { EventPayload, HostProps, KeyEvent } from "gpuix-solid2";
import { createEffect, createSignal, onSettled } from "solid-js";

import {
  createNativeServices,
  normalizeKey,
  normalizeKeyboardEvent,
} from "./native.js";
import type { NativeRef } from "./native.js";

export interface DisabledProps {
  isDisabled?: boolean;
}

export interface PressEvent {
  type: "pressstart" | "pressend" | "pressup" | "press";
  pointerType: "mouse" | "keyboard" | "virtual";
  target: ReturnType<NativeRef>;
  nativeEvent: EventPayload;
}

export interface PressProps extends DisabledProps {
  onPress?: (event: PressEvent) => void;
  onPressStart?: (event: PressEvent) => void;
  onPressEnd?: (event: PressEvent) => void;
  onPressUp?: (event: PressEvent) => void;
  onPressChange?: (pressed: boolean) => void;
  preventFocusOnPress?: boolean;
}

export const createPress = (props: PressProps, ref: NativeRef) => {
  const services = createNativeServices();
  const [pressed, setPressed] = createSignal(false);

  let active: {
    pointerType: PressEvent["pointerType"];
    key: string;
    event: EventPayload;
  } | null = null;

  let mouseReleased = false;

  const emit = (
    type: PressEvent["type"],
    pointerType: PressEvent["pointerType"],
    event: EventPayload
  ): void => {
    const payload: PressEvent = {
      nativeEvent: event,
      pointerType,
      target: ref(),
      type,
    };

    switch (type) {
      case "pressstart": {
        props.onPressStart?.(payload);
        break;
      }

      case "pressend": {
        props.onPressEnd?.(payload);
        break;
      }

      case "pressup": {
        props.onPressUp?.(payload);
        break;
      }

      case "press": {
        props.onPress?.(payload);
        break;
      }

      default: {
        const exhaustive: never = type;

        return exhaustive;
      }
    }
  };

  const cancel = (event: EventPayload) => {
    if (!active) {
      return;
    }

    const current = active;
    active = null;
    setPressed(false);
    props.onPressChange?.(false);
    emit("pressend", current.pointerType, event);
  };

  const start = (
    pointerType: PressEvent["pointerType"],
    key: string,
    event: EventPayload
  ): void => {
    if (props.isDisabled === true || active) {
      return;
    }

    active = { event, key, pointerType };
    setPressed(true);
    props.onPressChange?.(true);
    emit("pressstart", pointerType, event);

    if (!(props.preventFocusOnPress === true)) {
      services.focus(ref);
    }
  };

  createEffect(
    () => props.isDisabled === true,
    (disabled) => {
      if (disabled && active) {
        cancel(active.event);
      }
    }
  );
  onSettled(() => () => {
    if (active) {
      cancel(active.event);
    }
  });

  const pressProps: HostProps = {
    onBlur: cancel,
    onClick(event) {
      if (
        props.isDisabled === true ||
        (event.button !== undefined && event.button !== 0)
      ) {
        return;
      }

      // GPUI emits click after mouseUp; accessibility Click also takes this path.
      const virtual = event.x === undefined && event.y === undefined;

      if (!virtual && !mouseReleased) {
        return;
      }

      mouseReleased = false;
      emit("press", virtual ? "virtual" : "mouse", event);
    },
    onKeyDown(event) {
      if (
        props.isDisabled === true ||
        event.defaultPrevented ||
        event.modifiers?.ctrl === true ||
        event.modifiers?.alt === true ||
        event.modifiers?.cmd === true
      ) {
        return;
      }

      const key = normalizeKey(event.key);

      if (key !== "Enter" && key !== " ") {
        return;
      }

      event.preventDefault();

      if (event.isHeld === true || active) {
        return;
      }

      start("keyboard", key, event);

      if (key === "Enter") {
        emit("press", "keyboard", event);
      }
    },
    onKeyUp(event) {
      const key = normalizeKey(event.key);

      if (active?.pointerType !== "keyboard" || active.key !== key) {
        return;
      }

      event.preventDefault();

      if (!(props.isDisabled === true)) {
        emit("pressup", "keyboard", event);

        if (key === " ") {
          emit("press", "keyboard", event);
        }
      }

      cancel(event);
    },
    onMouseDown(event) {
      mouseReleased = false;

      if (event.button === undefined || event.button === 0) {
        start("mouse", "", event);
      }
    },
    onMouseDownOutside: cancel,
    onMouseLeave(event) {
      if (active?.pointerType === "mouse") {
        cancel(event);
      }
    },
    onMouseUp(event) {
      if (
        active?.pointerType !== "mouse" ||
        (event.button !== undefined && event.button !== 0)
      ) {
        return;
      }

      if (!(props.isDisabled === true)) {
        emit("pressup", "mouse", event);
      }

      mouseReleased = !(props.isDisabled === true);
      cancel(event);
    },
  };

  return {
    get isPressed() {
      return !(props.isDisabled === true) && pressed();
    },
    pressProps,
  };
};

export interface HoverProps extends DisabledProps {
  onHoverStart?: (event: EventPayload) => void;
  onHoverEnd?: (event: EventPayload) => void;
  onHoverChange?: (hovered: boolean) => void;
}

export const createHover = (props: HoverProps = {}) => {
  const [hovered, setHovered] = createSignal(false);
  let last: EventPayload | null = null;

  const end = (event: EventPayload) => {
    if (!last) {
      return;
    }

    last = null;
    setHovered(false);
    props.onHoverEnd?.(event);
    props.onHoverChange?.(false);
  };

  createEffect(
    () => props.isDisabled === true,
    (disabled) => {
      if (disabled && last) {
        end(last);
      }
    }
  );

  return {
    hoverProps: {
      onMouseEnter(event: EventPayload) {
        if (props.isDisabled === true || last) {
          return;
        }

        last = event;
        setHovered(true);
        props.onHoverStart?.(event);
        props.onHoverChange?.(true);
      },
      onMouseLeave: end,
    } satisfies HostProps,
    get isHovered() {
      return !(props.isDisabled === true) && hovered();
    },
  };
};

export interface KeyboardProps extends DisabledProps {
  onKeyDown?: (event: KeyEvent) => void;
  onKeyUp?: (event: KeyEvent) => void;
}

export const createKeyboard = (props: KeyboardProps) => ({
  keyboardProps: {
    onKeyDown(event: KeyEvent) {
      if (!(props.isDisabled === true)) {
        props.onKeyDown?.(normalizeKeyboardEvent(event));
      }
    },
    onKeyUp(event: KeyEvent) {
      if (!(props.isDisabled === true)) {
        props.onKeyUp?.(normalizeKeyboardEvent(event));
      }
    },
  } satisfies HostProps,
});

export interface FocusProps extends DisabledProps {
  onFocus?: (event: EventPayload) => void;
  onBlur?: (event: EventPayload) => void;
  onFocusChange?: (focused: boolean) => void;
}

export const createFocus = (props: FocusProps = {}) => {
  const [focused, setFocused] = createSignal(false);

  return {
    focusProps: {
      onBlur(event: EventPayload) {
        setFocused(false);
        props.onBlur?.(event);
        props.onFocusChange?.(false);
      },
      onFocus(event: EventPayload) {
        if (props.isDisabled === true) {
          return;
        }

        setFocused(true);
        props.onFocus?.(event);
        props.onFocusChange?.(true);
      },
    } satisfies HostProps,
    get isFocused() {
      return !(props.isDisabled === true) && focused();
    },
  };
};

export const createFocusRing = (
  props: FocusProps & { autoFocus?: boolean } = {}
) => {
  const services = createNativeServices();
  const focus = createFocus(props);

  const [visible, setVisible] = createSignal(
    props.autoFocus ?? services.getInteractionModality() === "keyboard"
  );

  services.subscribe((event) => {
    if (event.eventType === "keyDown" || event.eventType === "windowKeyDown") {
      setVisible(true);
    }

    if (event.eventType === "mouseDown") {
      setVisible(false);
    }
  });

  return {
    focusProps: focus.focusProps,
    get isFocusVisible() {
      return focus.isFocused && visible();
    },
    get isFocused() {
      return focus.isFocused;
    },
  };
};

export const createInteractOutside = (
  props: DisabledProps & { onInteractOutside: (event: EventPayload) => void }
) => ({
  interactOutsideProps: {
    onMouseDownOutside(event: EventPayload) {
      if (!(props.isDisabled === true)) {
        props.onInteractOutside(event);
      }
    },
  } satisfies HostProps,
});
