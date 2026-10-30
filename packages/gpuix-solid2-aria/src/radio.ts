import type { HostElement, KeyEvent } from "gpuix-solid2";
import type { RadioGroupState } from "gpuix-solid2-stately/radio/create-radio-group-state";
import { createMemo, createSignal, merge, onSettled } from "solid-js";

import type { ButtonProps, NativeControlProps } from "./controls.js";
import { createButton } from "./controls.js";
import { createLocale } from "./i18n.js";
import { createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export interface RadioGroupProps {
  "aria-label"?: string;
  "aria-description"?: string;
  orientation?: "horizontal" | "vertical";
}

export interface RadioProps extends Omit<ButtonProps, "tabIndex"> {
  value: string;
}

interface RegisteredRadio {
  props: RadioProps;
  ref: NativeRef;
}

interface GroupRegistration {
  register: (radio: RegisteredRadio) => () => void;
  tabStop: () => RegisteredRadio | undefined;
  navigate: (radio: RegisteredRadio, event: KeyEvent) => void;
}

// State identities isolate groups and requests; the weak keys do not own group lifetime.
const groups = new WeakMap<RadioGroupState, GroupRegistration>();

export const createRadioGroup = (
  props: RadioGroupProps,
  state: RadioGroupState,
  ref: NativeRef
) => {
  const services = createNativeServices();
  const locale = createLocale();
  const [radios, setRadios] = createSignal<RegisteredRadio[]>([]);

  const enabled = createMemo(() =>
    radios().filter(
      (radio) => !state.isDisabled && !(radio.props.isDisabled === true)
    )
  );

  const tabStop = createMemo(() => {
    const options = enabled();

    return (
      options.find((radio) => radio.props.value === state.selectedValue) ??
      options.find((radio) => radio.props.value === state.lastFocusedValue) ??
      options[0]
    );
  });

  const ordered = () => {
    const staticOptions = enabled();
    const result: RegisteredRadio[] = [];

    const visit = (node: HostElement) => {
      const radio = staticOptions.find((option) => option.ref() === node);

      if (radio) {
        result.push(radio);
      }

      for (const child of node.children) {
        if (child.kind === "element") {
          visit(child);
        }
      }
    };

    const container = ref();

    if (container) {
      visit(container);
    }

    return result;
  };

  groups.set(state, {
    navigate(radio, event) {
      if (
        event.defaultPrevented ||
        state.isDisabled ||
        event.modifiers?.ctrl === true ||
        event.modifiers?.alt === true ||
        event.modifiers?.cmd === true
      ) {
        return;
      }

      const key = normalizeKey(event.key);
      let direction: number;

      switch (key) {
        case "ArrowDown": {
          direction = 1;
          break;
        }

        case "ArrowUp": {
          direction = -1;
          break;
        }

        case "ArrowRight": {
          direction =
            props.orientation === "horizontal" && locale.direction === "rtl"
              ? -1
              : 1;
          break;
        }

        case "ArrowLeft": {
          direction =
            props.orientation === "horizontal" && locale.direction === "rtl"
              ? 1
              : -1;
          break;
        }

        default: {
          return;
        }
      }

      const options = ordered();
      const index = options.indexOf(radio);

      if (index === -1) {
        return;
      }

      const next =
        options[(index + direction + options.length) % options.length];

      if (!next) {
        return;
      }

      event.preventDefault();
      state.setLastFocusedValue(next.props.value);
      state.setSelectedValue(next.props.value);
      services.focus(next.ref);
      services.scrollIntoView(next.ref);
    },
    register(radio) {
      setRadios((current) => [...current, radio]);

      return () => {
        setRadios((current) => current.filter((item) => item !== radio));
      };
    },
    tabStop,
  });
  onSettled(() => () => {
    groups.delete(state);
  });

  return {
    radioGroupProps: {
      get "aria-description"() {
        return props["aria-description"];
      },
      get "aria-disabled"() {
        return state.isDisabled;
      },
      get "aria-invalid"() {
        return state.isInvalid;
      },
      get "aria-label"() {
        return props["aria-label"];
      },
      get "aria-orientation"() {
        return props.orientation ?? "vertical";
      },
      get "aria-readonly"() {
        return state.isReadOnly;
      },
      get "aria-required"() {
        return state.isRequired;
      },
      role: "radiogroup",
    } satisfies NativeControlProps & {
      "aria-orientation": "horizontal" | "vertical";
    },
  };
};

export const createRadio = (
  props: RadioProps,
  state: RadioGroupState,
  ref: NativeRef
) => {
  const group = groups.get(state);

  if (!group) {
    throw new Error(
      "createRadio requires createRadioGroup with the same state."
    );
  }

  const registration = { props, ref };
  onSettled(() => group.register(registration));

  const button = createButton(
    merge(props, {
      get isDisabled() {
        return state.isDisabled || props.isDisabled === true;
      },
      onFocus(event: Parameters<NonNullable<ButtonProps["onFocus"]>>[0]) {
        state.setLastFocusedValue(props.value);
        props.onFocus?.(event);
      },
      onPress(event: Parameters<NonNullable<ButtonProps["onPress"]>>[0]) {
        state.setSelectedValue(props.value);
        props.onPress?.(event);
      },
    }),
    ref
  );

  const inputProps: NativeControlProps = merge(() => button.buttonProps, {
    get "aria-checked"() {
      return state.selectedValue === props.value;
    },
    get "aria-invalid"() {
      return state.isInvalid;
    },
    get "aria-readonly"() {
      return state.isReadOnly;
    },
    get "aria-required"() {
      return state.isRequired;
    },
    onKeyDown(event: KeyEvent) {
      group.navigate(registration, event);

      if (normalizeKey(event.key) !== "Enter") {
        button.buttonProps.onKeyDown?.(event);
      }
    },
    role: "radio",
    get tabIndex() {
      return group.tabStop() === registration ? 0 : -1;
    },
  });

  return {
    inputProps,
    get isDisabled() {
      return state.isDisabled || props.isDisabled === true;
    },
    get isPressed() {
      return button.isPressed;
    },
    get isSelected() {
      return state.selectedValue === props.value;
    },
  };
};
