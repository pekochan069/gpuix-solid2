import type { EventPayload } from "@gpuix/native";
import type { HostProps } from "@gpuix/native/host";
import {
  merge,
  createComponent,
  createContext,
  createSignal,
  onSettled,
  untrack,
  Show,
  useContext,
} from "solid-js";
import type { Element } from "solid-js";

import { jsx } from "../jsx-runtime.js";
import {
  FloatingLayer,
  floatingRootStyle,
  renderSlot,
  DismissableLayer,
} from "./floating.js";
import type { FloatingContentProps } from "./floating.js";

interface ProviderState {
  delayDuration: number;
  skipDelayDuration: number;
  disableHoverableContent: boolean;
  lastClosedAt: { current: number };
}

const ProviderContext = createContext<ProviderState | null>(null);

const createProviderState = (): ProviderState => ({
  delayDuration: 0,
  disableHoverableContent: false,
  lastClosedAt: { current: Number.NEGATIVE_INFINITY },
  skipDelayDuration: 300,
});

export interface TooltipProviderProps {
  children: Element;
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
}

export const TooltipProvider = (props: TooltipProviderProps): Element => {
  const value: ProviderState = {
    get delayDuration() {
      return props.delayDuration ?? 0;
    },
    get disableHoverableContent() {
      return props.disableHoverableContent ?? false;
    },
    lastClosedAt: { current: Number.NEGATIVE_INFINITY },
    get skipDelayDuration() {
      return props.skipDelayDuration ?? 300;
    },
  };

  return createComponent(ProviderContext, {
    get children() {
      return props.children;
    },
    value,
  });
};

interface TooltipState {
  open: () => boolean;
  hoverable: boolean;
  openNow: () => void;
  scheduleOpen: () => void;
  scheduleClose: () => void;
  cancelClose: () => void;
  close: () => void;
}

const TooltipContext = createContext<TooltipState>();

const context = (_name: string): TooltipState => useContext(TooltipContext);

export interface TooltipProps extends HostProps {
  children?: Element;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
  disableHoverableContent?: boolean;
}

export const Tooltip = (props: TooltipProps): Element => {
  const provider = useContext(ProviderContext) ?? createProviderState();

  const [internal, setInternal] = createSignal(
    untrack(() => props.defaultOpen ?? false)
  );

  const open = () => props.open ?? internal();

  let openTimer: ReturnType<typeof setTimeout> | undefined;

  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelOpen = () => {
    if (openTimer) {
      clearTimeout(openTimer);
    }

    openTimer = undefined;
  };

  const cancelClose = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
    }

    closeTimer = undefined;
  };

  const setOpen = (next: boolean) => {
    const previous = open();

    cancelOpen();

    cancelClose();

    if (props.open === undefined) {
      setInternal(next);
    }

    if (previous !== next) {
      props.onOpenChange?.(next);
    }

    if (!next) {
      provider.lastClosedAt.current = Date.now();
    }
  };

  const hoverable = () =>
    !(props.disableHoverableContent ?? provider.disableHoverableContent);

  const state: TooltipState = {
    cancelClose,
    close: () => {
      setOpen(false);
    },
    get hoverable() {
      return hoverable();
    },
    open,
    openNow: () => {
      setOpen(true);
    },
    scheduleClose() {
      cancelOpen();

      if (hoverable()) {
        closeTimer = setTimeout(() => {
          setOpen(false);
        }, 80);
      } else {
        setOpen(false);
      }
    },
    scheduleOpen() {
      cancelClose();

      const recent =
        Date.now() - provider.lastClosedAt.current <=
        provider.skipDelayDuration;

      const delay = recent
        ? 0
        : (props.delayDuration ?? provider.delayDuration);

      if (delay <= 0) {
        setOpen(true);
      } else {
        openTimer = setTimeout(() => {
          setOpen(true);
        }, delay);
      }
    },
  };

  onSettled(() => () => {
    cancelOpen();

    cancelClose();
  });

  return createComponent(TooltipContext, {
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

export interface TooltipTriggerProps extends HostProps {
  children?: Element;
  asChild?: boolean;
}

export const TooltipTrigger = (props: TooltipTriggerProps): Element => {
  const state = context("TooltipTrigger");

  const forwardedProps = merge(props, {
    onBlur(event: EventPayload) {
      props.onBlur?.(event);

      state.close();
    },
    onClick(event: EventPayload) {
      props.onClick?.(event);

      state.close();
    },
    onFocus(event: EventPayload) {
      props.onFocus?.(event);

      state.openNow();
    },
    onMouseDown(event: EventPayload) {
      props.onMouseDown?.(event);

      state.close();
    },
    onMouseEnter(event: EventPayload) {
      props.onMouseEnter?.(event);

      state.scheduleOpen();
    },
    onMouseLeave(event: EventPayload) {
      props.onMouseLeave?.(event);

      state.scheduleClose();
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

export type TooltipContentProps = FloatingContentProps;

export const TooltipContent = (props: TooltipContentProps): Element => {
  const state = context("TooltipContent");

  return Show<boolean>({
    get children() {
      return createComponent(DismissableLayer, {
        get children() {
          return FloatingLayer(
            merge(props, {
              get align() {
                return props.align ?? "center";
              },
              onMouseEnter(event: EventPayload) {
                props.onMouseEnter?.(event);

                if (state.hoverable) {
                  state.cancelClose();
                }
              },
              onMouseLeave(event: EventPayload) {
                props.onMouseLeave?.(event);

                state.scheduleClose();
              },
              get side() {
                return props.side ?? "top";
              },
            })
          );
        },
        onEscapeKeyDown: state.close,
      });
    },
    keyed: true,
    get when() {
      return state.open();
    },
  });
};

export {
  Tooltip as Root,
  TooltipContent as Content,
  TooltipProvider as Provider,
  TooltipTrigger as Trigger,
};
