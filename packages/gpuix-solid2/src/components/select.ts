import type { EventPayload } from "@gpuix/native";
import type { HostProps, KeyEvent } from "@gpuix/native/host";
import {
  omit,
  merge,
  createComponent,
  createContext,
  createSignal,
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

export interface SelectItemData {
  value: string;
  label?: Element;
  textValue?: string;
}

interface ItemRecord {
  value: string;
  disabled: boolean;
}

interface SelectContextValue {
  open: () => boolean;
  value: () => string | undefined;
  active: () => string | null;
  disabled: boolean;
  labels: Map<string, Element>;
  trigger: { current: HostElement | null };
  /** `restoreFocus: false` when the user pressed elsewhere, so the press keeps
   *  the focus it just gave. */
  setOpen: (value: boolean, restoreFocus?: boolean) => void;
  setActive: (value: string | null) => void;
  move: (delta: number) => void;
  select: (value: string) => void;
  register: (item: ItemRecord) => () => void;
}

const SelectContext = createContext<SelectContextValue>();

const context = (_name: string): SelectContextValue =>
  useContext(SelectContext);

export interface SelectProps extends HostProps {
  children?: Element;
  items?: readonly SelectItemData[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export const Select = (props: SelectProps): Element => {
  const renderer = useGpuixRequired();

  const [internalValue, setInternalValue] = createSignal(
    untrack(() => props.defaultValue)
  );

  const [internalOpen, setInternalOpen] = createSignal(
    untrack(() => props.defaultOpen ?? false)
  );

  const [active, setActive] = createSignal<string | null>(null);

  const items: ItemRecord[] = [];

  const trigger: SelectContextValue["trigger"] = { current: null };

  const value = () => props.value ?? internalValue();

  const open = () => props.open ?? internalOpen();

  const setValue = (next: string) => {
    const previous = value();

    if (props.value === undefined) {
      setInternalValue(next);
    }

    if (previous !== next) {
      props.onValueChange?.(next);
    }
  };

  const setOpen = (next: boolean, restoreFocus = true) => {
    const previous = open();

    if (props.open === undefined) {
      setInternalOpen(next);
    }

    if (previous !== next) {
      props.onOpenChange?.(next);
    }

    if (!next && restoreFocus && trigger.current) {
      renderer.focusElement?.(trigger.current.id);
    }

    if (next) {
      setActive(value() ?? null);
    }
  };

  const move = (delta: number) => {
    const enabled = items.filter((item) => !item.disabled);

    if (enabled.length === 0) {
      return;
    }

    const current = enabled.findIndex((item) => item.value === active());

    const fallbackIndex = delta > 0 ? -1 : 0;

    const start = current === -1 ? fallbackIndex : current;

    const next = enabled.at((start + delta + enabled.length) % enabled.length);

    if (next) {
      setActive(next.value);
    }
  };

  const select = (next: string) => {
    if (
      props.disabled === true ||
      items.find((item) => item.value === next)?.disabled === true
    ) {
      return;
    }

    setValue(next);

    setOpen(false);
  };

  const labels = () =>
    new Map(
      (props.items ?? []).map((item) => [
        item.value,
        item.label ?? item.textValue ?? item.value,
      ])
    );

  const valueContext: SelectContextValue = {
    active,
    get disabled() {
      return props.disabled ?? false;
    },
    get labels() {
      return labels();
    },
    move,
    open,
    register(item) {
      items.push(item);

      return () => {
        const index = items.indexOf(item);

        if (index !== -1) {
          items.splice(index, 1);
        }
      };
    },
    select,
    setActive: (next) => {
      setActive(next);
    },
    setOpen,
    trigger,
    value,
  };

  return createComponent(SelectContext, {
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
    value: valueContext,
  });
};

export interface SelectTriggerState {
  open: boolean;
  disabled: boolean;
  placeholder: boolean;
}

export interface SelectTriggerProps extends Omit<HostProps, "style"> {
  children?: Element;
  asChild?: boolean;
  disabled?: boolean;
  style?: StateStyle<SelectTriggerState>;
  ref?: (element: HostElement) => void;
}

export const SelectTrigger = (props: SelectTriggerProps): Element => {
  const state = context("SelectTrigger");

  const disabled = () => props.disabled ?? state.disabled;

  const forwardedProps = merge(omit(props, "style"), {
    onClick(event: EventPayload) {
      props.onClick?.(event);

      if (!disabled()) {
        state.setOpen(!state.open());
      }
    },
    onKeyDown(event: KeyEvent) {
      props.onKeyDown?.(event);

      if (disabled()) {
        return;
      }

      if (event.key === "down") {
        if (state.open()) {
          state.move(1);
        } else {
          state.setOpen(true);
        }
      } else if (event.key === "up") {
        if (state.open()) {
          state.move(-1);
        } else {
          state.setOpen(true);
        }
      } else if (event.key === "enter" || event.key === "space") {
        state.setOpen(!state.open());
      }
    },
    ref(element: HostElement) {
      state.trigger.current = element;

      props.ref?.(element);
    },
    get style() {
      return resolveStyle(props.style, {
        disabled: disabled(),
        open: state.open(),
        placeholder: state.value() === undefined,
      });
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

export interface SelectValueProps extends HostProps {
  children?: Element;
  placeholder?: Element;
}

export const SelectValue = (props: SelectValueProps): Element => {
  const state = context("SelectValue");

  return jsx(
    "div",
    merge(props, {
      get children() {
        const selected = state.value();

        return (
          props.children ??
          (selected === undefined
            ? props.placeholder
            : (state.labels.get(selected) ?? selected))
        );
      },
    })
  );
};

export interface SelectContentProps extends FloatingContentProps {
  onEscapeKeyDown?: (event: KeyEvent) => void;
}

export const SelectContent = (props: SelectContentProps): Element => {
  const state = context("SelectContent");

  return Show<boolean>({
    get children() {
      return createComponent(DismissableLayer, {
        get children() {
          return FloatingLayer(
            merge(props, {
              autoFocus: true,
              onKeyDown(event: KeyEvent) {
                props.onKeyDown?.(event);

                // The popup is modal, like Base UI: Tab stays inside until it closes.
                if (event.key === "tab") {
                  event.preventDefault();
                } else if (event.key === "down") {
                  state.move(1);
                } else if (event.key === "up") {
                  state.move(-1);
                } else if (
                  (event.key === "enter" || event.key === "space") &&
                  state.active() !== null
                ) {
                  const active = state.active();

                  if (active !== null) {
                    state.select(active);
                  }
                }
              },
              onMouseDownOutside(event: EventPayload) {
                props.onMouseDownOutside?.(event);

                state.setOpen(false, false);
              },
              // Focused only to receive keys; the highlighted item shows where
              // the user is, so the popup gets no focus look of its own.
              get style() {
                return { keyboardFocusDim: false, ...props.style };
              },
              tabIndex: props.tabIndex ?? -1,
            })
          );
        },
        onEscapeKeyDown(event) {
          props.onEscapeKeyDown?.(event);

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

export interface SelectItemState {
  selected: boolean;
  highlighted: boolean;
  disabled: boolean;
}

export interface SelectItemProps extends Omit<HostProps, "style"> {
  value: string;
  disabled?: boolean;
  asChild?: boolean;
  children?: Element | ((state: SelectItemState) => Element);
  style?: StateStyle<SelectItemState>;
}

export const SelectItem = (props: SelectItemProps): Element => {
  const state = context("SelectItem");

  createEffect(
    () => ({ disabled: props.disabled ?? false, value: props.value }),
    (item) => state.register(item)
  );

  const itemState = () => ({
    get disabled() {
      return props.disabled ?? false;
    },
    highlighted: state.active() === props.value,
    selected: state.value() === props.value,
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
        state.setActive(props.value);
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

const divComponent = (props: HostProps & { children?: Element }): Element =>
  jsx("div", props);

export const SelectGroup = divComponent;

export const SelectLabel = divComponent;

export const SelectSeparator = divComponent;

export const SelectScrollUpButton = divComponent;

export const SelectScrollDownButton = divComponent;

export {
  Select as Root,
  SelectContent as Content,
  SelectGroup as Group,
  SelectItem as Item,
  SelectLabel as Label,
  SelectScrollDownButton as ScrollDownButton,
  SelectScrollUpButton as ScrollUpButton,
  SelectSeparator as Separator,
  SelectTrigger as Trigger,
  SelectValue as Value,
};
