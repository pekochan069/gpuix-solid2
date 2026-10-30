import type { EventPayload } from "@gpuix/native";
import type { HostProps, InputProps, KeyEvent } from "@gpuix/native/host";
import {
  omit,
  merge,
  createComponent,
  createContext,
  createSignal,
  For,
  createEffect,
  untrack,
  Show,
  useContext,
} from "solid-js";
import type { Element } from "solid-js";

import type { HostElement } from "../host.js";
import { jsx } from "../jsx-runtime.js";
import { useGpuixRequired } from "../root.js";
import {
  FloatingLayer,
  floatingRootStyle,
  renderSlot,
  resolveStyle,
  DismissableLayer,
} from "./floating.js";
import type { FloatingContentProps, StateStyle } from "./floating.js";

// oxlint-disable-next-line no-redeclare -- The public value type and component intentionally share a TypeScript name.
export type ComboboxValue = string | string[] | null;

interface ComboContext {
  open: () => boolean;
  value: () => ComboboxValue;
  input: () => string;
  active: () => number | null;
  filtered: () => string[];
  disabled: boolean;
  multiple: boolean;
  inputRef: { current: HostElement | null };
  setOpen: (value: boolean) => void;
  setInput: (value: string) => void;
  setActive: (value: number | null) => void;
  move: (delta: number) => void;
  select: (value: string) => void;
  registerDisabled: (value: string, disabled: boolean) => () => void;
}

const ComboboxContext = createContext<ComboContext>();

const context = (_name: string): ComboContext => useContext(ComboboxContext);

export interface ComboboxProps extends HostProps {
  children?: Element;
  items?: readonly string[];
  value?: ComboboxValue;
  defaultValue?: ComboboxValue;
  onValueChange?: (value: ComboboxValue) => void;
  inputValue?: string;
  defaultInputValue?: string;
  onInputValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  multiple?: boolean;
  disabled?: boolean;
  autoHighlight?: boolean | "always";
  filter?:
    | null
    | ((
        item: string,
        query: string,
        itemToString: (item: string) => string
      ) => boolean);
  itemToStringValue?: (item: string) => string;
}

export const Combobox = (props: ComboboxProps): Element => {
  const renderer = useGpuixRequired();

  const [internalValue, setInternalValue] = createSignal<ComboboxValue>(
    untrack(() => props.defaultValue ?? null)
  );

  const [internalInput, setInternalInput] = createSignal(
    untrack(() => props.defaultInputValue ?? "")
  );

  const [internalOpen, setInternalOpen] = createSignal(
    untrack(() => props.defaultOpen ?? false)
  );

  const [active, setActive] = createSignal<number | null>(null);

  const inputRef: ComboContext["inputRef"] = { current: null };

  const disabledItems = new Set<string>();

  const value = () =>
    props.value === undefined ? internalValue() : props.value;

  const input = () => props.inputValue ?? internalInput();

  const open = () => props.open ?? internalOpen();

  const itemToString = (item: string) =>
    props.itemToStringValue?.(item) ?? item;

  const filterItems = (text: string) => {
    const query = text.trim().toLowerCase();

    if (props.filter === null) {
      return [...(props.items ?? [])];
    }

    const { filter } = props;

    if (filter) {
      return [...(props.items ?? [])].filter((item) =>
        filter(item, query, itemToString)
      );
    }

    return [...(props.items ?? [])].filter((item) =>
      itemToString(item).toLowerCase().includes(query)
    );
  };

  const filtered = () => filterItems(input());

  const setOpen = (next: boolean) => {
    const previous = open();

    if (props.open === undefined) {
      setInternalOpen(next);
    }

    if (previous !== next) {
      props.onOpenChange?.(next);
    }

    if (next) {
      queueMicrotask(() => {
        if (inputRef.current) {
          renderer.focusElement?.(inputRef.current.id);
        }
      });
    }
  };

  const setInput = (next: string) => {
    const previous = input();

    if (props.inputValue === undefined) {
      setInternalInput(next);
    }

    if (previous !== next) {
      props.onInputValueChange?.(next);
    }

    const nextItems = filterItems(next);

    const firstEnabled = nextItems.findIndex(
      (item) => !disabledItems.has(item)
    );

    setActive(
      props.autoHighlight !== undefined &&
        props.autoHighlight !== false &&
        firstEnabled !== -1
        ? firstEnabled
        : null
    );
  };

  const setValue = (next: ComboboxValue) => {
    const previous = value();

    if (props.value === undefined) {
      setInternalValue(next);
    }

    if (!Object.is(previous, next)) {
      props.onValueChange?.(next);
    }
  };

  const move = (delta: number) => {
    const items = filtered();

    if (items.length === 0) {
      return;
    }

    const fallbackIndex = delta > 0 ? -1 : 0;

    let next = active() ?? fallbackIndex;

    for (const _item of items) {
      next = (next + delta + items.length) % items.length;

      const item = items.at(next);

      if (item !== undefined && !disabledItems.has(item)) {
        setActive(next);

        return;
      }
    }
  };

  const select = (item: string) => {
    if (props.disabled === true || disabledItems.has(item)) {
      return;
    }

    if (props.multiple === true) {
      const current = value();

      const selected = Array.isArray(current) ? current : [];

      setValue(
        selected.includes(item)
          ? selected.filter((selectedItem) => selectedItem !== item)
          : [...selected, item]
      );

      setInput("");

      return;
    }

    setValue(item);

    setInput(itemToString(item));

    setOpen(false);
  };

  const state: ComboContext = {
    active,
    get disabled() {
      return props.disabled ?? false;
    },
    filtered,
    input,
    inputRef,
    move,
    get multiple() {
      return props.multiple ?? false;
    },
    open,
    registerDisabled(item, disabled) {
      if (disabled) {
        disabledItems.add(item);
      }

      return () => {
        disabledItems.delete(item);
      };
    },
    select,
    setActive: (next) => {
      setActive(next);
    },
    setInput,
    setOpen,
    value,
  };

  return createComponent(ComboboxContext, {
    get children() {
      return jsx(
        "div",
        merge(props, {
          get children() {
            return props.children;
          },
          get style() {
            return floatingRootStyle(props.style);
          },
        })
      );
    },
    value: state,
  });
};

export interface ComboboxInputProps extends InputProps {
  disabled?: boolean;
  ref?: (element: HostElement) => void;
}

export const ComboboxInput = (props: ComboboxInputProps): Element => {
  const state = context("ComboboxInput");

  const disabled = () => props.disabled ?? state.disabled;

  return jsx(
    "input",
    merge(props, {
      get autoFocus() {
        return state.open();
      },
      // Focus leaving the input closes the popup, like Base UI. Tab moves focus
      // only when no handler prevented it, so a kept Tab keeps it open.
      onBlur(event: EventPayload) {
        props.onBlur?.(event);

        state.setOpen(false);
      },
      onChange(event: EventPayload) {
        props.onChange?.(event);

        state.setInput(event.value ?? "");

        if (!disabled()) {
          state.setOpen(true);
        }
      },
      onClick(event: EventPayload) {
        props.onClick?.(event);

        if (!disabled()) {
          state.setOpen(true);
        }
      },
      onFocus(event: EventPayload) {
        props.onFocus?.(event);

        if (!disabled()) {
          state.setOpen(true);
        }
      },
      onKeyDown(event: KeyEvent) {
        props.onKeyDown?.(event);

        if (event.key === "down") {
          state.move(1);
        } else if (event.key === "up") {
          state.move(-1);
        }
      },
      onSubmit(event: EventPayload) {
        props.onSubmit?.(event);

        const index = state.active();

        if (index !== null) {
          const item = state.filtered().at(index);

          if (item !== undefined) {
            state.select(item);
          }
        }
      },
      get readOnly() {
        return disabled() || props.readOnly;
      },
      ref(element: HostElement) {
        state.inputRef.current = element;

        props.ref?.(element);
      },
      get value() {
        return state.input();
      },
    })
  );
};

export interface ComboboxTriggerProps extends HostProps {
  children?: Element;
  asChild?: boolean;
  disabled?: boolean;
}

export const ComboboxTrigger = (props: ComboboxTriggerProps): Element => {
  const state = context("ComboboxTrigger");

  const disabled = () => props.disabled ?? state.disabled;

  const forwardedProps = merge(props, {
    onClick(event: EventPayload) {
      props.onClick?.(event);

      if (!disabled()) {
        state.setOpen(!state.open());
      }
    },
    get tabIndex() {
      return disabled() ? -1 : props.tabIndex;
    },
  });

  return renderSlot({
    get asChild() {
      return props.asChild;
    },
    get children() {
      return props.children;
    },
    defaultTabIndex: 0,
    props: forwardedProps,
  });
};

export interface ComboboxValueProps extends HostProps {
  children?: Element | ((value: ComboboxValue) => Element);
  placeholder?: Element;
}

export const ComboboxValue = (props: ComboboxValueProps): Element => {
  const state = context("ComboboxValue");

  return jsx(
    "div",
    merge(omit(props, "children"), {
      get children() {
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Select the callback or value form of this typed renderer API.
        if (typeof props.children === "function") {
          return props.children(state.value());
        }

        if (props.children !== undefined) {
          return props.children;
        }

        const value = state.value();

        return Array.isArray(value)
          ? value.join(", ")
          : (value ?? props.placeholder);
      },
    })
  );
};

export const ComboboxContent = (props: FloatingContentProps): Element => {
  const state = context("ComboboxContent");

  return Show<boolean>({
    get children() {
      return createComponent(DismissableLayer, {
        get children() {
          return FloatingLayer(
            merge(props, {
              onMouseDownOutside(event: EventPayload) {
                props.onMouseDownOutside?.(event);

                state.setOpen(false);
              },
            })
          );
        },
        onEscapeKeyDown: () => {
          state.setOpen(false);
        },
      });
    },
    keyed: true,
    get when() {
      return state.open();
    },
  });
};

export interface ComboboxListProps extends HostProps {
  children?: Element | ((item: string) => Element);
}

export const ComboboxList = (props: ComboboxListProps): Element => {
  const state = context("ComboboxList");

  return jsx(
    "div",
    merge(omit(props, "children"), {
      get children() {
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Select the callback or value form of this typed renderer API.
        if (typeof props.children !== "function") {
          return props.children;
        }

        return For<string[], Element>({
          children: props.children,
          get each() {
            return state.filtered();
          },
        });
      },
    })
  );
};

export interface ComboboxItemState {
  selected: boolean;
  highlighted: boolean;
  disabled: boolean;
}

export interface ComboboxItemProps extends Omit<HostProps, "style"> {
  value: string;
  disabled?: boolean;
  asChild?: boolean;
  children?: Element | ((state: ComboboxItemState) => Element);
  style?: StateStyle<ComboboxItemState>;
}

export const ComboboxItem = (props: ComboboxItemProps): Element => {
  const state = context("ComboboxItem");

  createEffect(
    () => ({ disabled: props.disabled ?? false, value: props.value }),
    (item) => state.registerDisabled(item.value, item.disabled)
  );

  const itemState = () => ({
    get disabled() {
      return props.disabled ?? false;
    },
    highlighted: state.filtered().indexOf(props.value) === state.active(),
    selected: (() => {
      const value = state.value();

      return Array.isArray(value)
        ? value.includes(props.value)
        : value === props.value;
    })(),
  });

  const forwardedProps = merge(omit(props, "style"), {
    onClick(event: EventPayload) {
      props.onClick?.(event);

      if (!itemState().disabled) {
        state.select(props.value);
      }
    },
    onMouseEnter(event: EventPayload) {
      props.onMouseEnter?.(event);

      if (!itemState().disabled) {
        state.setActive(state.filtered().indexOf(props.value));
      }
    },
    get style() {
      return resolveStyle(props.style, itemState());
    },
  });

  return renderSlot({
    get asChild() {
      return props.asChild;
    },
    get children() {
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Select the callback or value form of this typed renderer API.
      return typeof props.children === "function"
        ? props.children(itemState())
        : props.children;
    },
    props: forwardedProps,
  });
};

export const ComboboxEmpty = (
  props: HostProps & { children?: Element }
): Element => {
  const state = context("ComboboxEmpty");

  return Show<boolean>({
    get children() {
      return jsx("div", props);
    },
    keyed: true,
    get when() {
      return state.filtered().length === 0;
    },
  });
};

const div = (props: HostProps & { children?: Element }) => jsx("div", props);

export const ComboboxGroup = div;

export const ComboboxLabel = div;

export const ComboboxSeparator = div;

export {
  Combobox as Root,
  ComboboxContent as Content,
  ComboboxEmpty as Empty,
  ComboboxGroup as Group,
  ComboboxInput as Input,
  ComboboxItem as Item,
  ComboboxLabel as Label,
  ComboboxList as List,
  ComboboxSeparator as Separator,
  ComboboxTrigger as Trigger,
  ComboboxValue as Value,
};
