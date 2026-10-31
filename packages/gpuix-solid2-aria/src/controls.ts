import type {
  EventPayload,
  HostProps,
  InputProps,
  KeyEvent,
} from "gpuix-solid2";
import type { ToggleState } from "gpuix-solid2-stately/toggle/create-toggle-state";
import { createControlledSignal } from "gpuix-solid2-stately/utils/create-controlled-signal";
import { merge } from "solid-js";

import { createFocus, createPress } from "./interactions.js";
import type { FocusProps, PressProps } from "./interactions.js";
import type { NativeRef } from "./native.js";

/** Semantic fields are retained here even when the pinned native backend cannot expose them. See PORTING.md. */
export interface NativeControlProps extends HostProps {
  "aria-disabled"?: boolean;
  "aria-pressed"?: boolean;
  "aria-checked"?: boolean | "mixed";
  "aria-readonly"?: boolean;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-controls"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-haspopup"?: "menu" | "listbox";
  "aria-multiselectable"?: boolean;
}

export interface ButtonProps extends PressProps, FocusProps {
  "aria-label"?: string;
  "aria-description"?: string;
  tabIndex?: number;
}

export const createButton = (props: ButtonProps, ref: NativeRef) => {
  const press = createPress(props, ref);
  const focus = createFocus(props);

  const buttonProps: NativeControlProps = merge(
    focus.focusProps,
    press.pressProps,
    {
      get "aria-description"() {
        return props["aria-description"];
      },
      get "aria-disabled"() {
        return props.isDisabled === true;
      },
      get "aria-label"() {
        return props["aria-label"];
      },
      onBlur(event: EventPayload) {
        press.pressProps.onBlur?.(event);
        focus.focusProps.onBlur?.(event);
      },
      get role() {
        return "button";
      },
      get tabIndex() {
        return props.isDisabled === true ? -1 : (props.tabIndex ?? 0);
      },
    }
  );

  return {
    buttonProps,
    get isFocused() {
      return focus.isFocused;
    },
    get isPressed() {
      return press.isPressed;
    },
  };
};

export const createToggleButton = (
  props: ButtonProps & { isReadOnly?: boolean },
  state: ToggleState,
  ref: NativeRef
) => {
  const button = createButton(
    merge(props, {
      onPress(event: Parameters<NonNullable<PressProps["onPress"]>>[0]) {
        if (!(props.isReadOnly === true)) {
          state.toggle();
        }

        props.onPress?.(event);
      },
    }),
    ref
  );

  return {
    get buttonProps(): NativeControlProps {
      return merge(button.buttonProps, {
        get "aria-pressed"() {
          return state.isSelected;
        },
      });
    },
    get isDisabled() {
      return props.isDisabled === true;
    },
    get isPressed() {
      return button.isPressed;
    },
    get isSelected() {
      return state.isSelected;
    },
  };
};

export interface CheckboxProps extends ButtonProps {
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  isIndeterminate?: boolean;
}

export const createCheckbox = (
  props: CheckboxProps,
  state: ToggleState,
  ref: NativeRef
) => {
  const toggle = createToggleButton(props, state, ref);

  return {
    get inputProps(): NativeControlProps {
      return merge(toggle.buttonProps, {
        get "aria-checked"() {
          return props.isIndeterminate === true
            ? ("mixed" as const)
            : state.isSelected;
        },
        get "aria-invalid"() {
          return props.isInvalid === true;
        },
        "aria-pressed": undefined,
        get "aria-readonly"() {
          return props.isReadOnly === true;
        },
        get "aria-required"() {
          return props.isRequired === true;
        },
        // Native checkbox surfaces activate on Space. Enter is reserved for forms.
        onKeyDown(event: KeyEvent) {
          if (
            event.key?.toLowerCase() !== "enter" &&
            event.key?.toLowerCase() !== "return"
          ) {
            toggle.buttonProps.onKeyDown?.(event);
          }
        },
        get role() {
          return "checkbox";
        },
      });
    },
    get isDisabled() {
      return props.isDisabled === true;
    },
    get isPressed() {
      return toggle.isPressed;
    },
    get isReadOnly() {
      return props.isReadOnly === true;
    },
    get isSelected() {
      return state.isSelected;
    },
  };
};

export const createSwitch = (
  props: CheckboxProps,
  state: ToggleState,
  ref: NativeRef
) => {
  const checkbox = createCheckbox(props, state, ref);

  return {
    get inputProps(): NativeControlProps {
      return merge(checkbox.inputProps, { role: "switch" });
    },
    get isDisabled() {
      return checkbox.isDisabled;
    },
    get isPressed() {
      return checkbox.isPressed;
    },
    get isReadOnly() {
      return checkbox.isReadOnly;
    },
    get isSelected() {
      return checkbox.isSelected;
    },
  };
};

export interface TextFieldProps extends FocusProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  isReadOnly?: boolean;
  "aria-label"?: string;
  "aria-description"?: string;
  placeholder?: string;
}

export const createTextField = (props: TextFieldProps) => {
  const [value, setValue] = createControlledSignal(
    () => props.value,
    props.defaultValue ?? "",
    (next) => props.onChange?.(next)
  );

  const focus = createFocus(props);

  const inputProps: InputProps = merge(focus.focusProps, {
    get "aria-description"() {
      return props["aria-description"];
    },
    get "aria-label"() {
      return props["aria-label"];
    },
    onChange(event: EventPayload) {
      if (
        !(props.isDisabled === true) &&
        !(props.isReadOnly === true) &&
        event.value !== undefined
      ) {
        setValue(event.value);
      }
    },
    onSubmit() {
      if (!(props.isDisabled === true)) {
        props.onSubmit?.(value());
      }
    },
    get placeholder() {
      return props.placeholder;
    },
    get readOnly() {
      return props.isDisabled === true || props.isReadOnly === true;
    },
    role: "textbox",
    get tabIndex() {
      return props.isDisabled === true ? -1 : 0;
    },
    get value() {
      return value();
    },
  });

  return {
    inputProps,
    get value() {
      return value();
    },
  };
};
