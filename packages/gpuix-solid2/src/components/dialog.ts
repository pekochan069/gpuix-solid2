import type { EventPayload } from "@gpuix/native";
/** Headless Base UI-shaped Dialog over a full-window GPUIX anchored layer. */
import { resolveFocusTarget } from "@gpuix/native/host";
import type {
  FocusTarget,
  HostProps,
  KeyEvent,
  StyleDesc,
} from "@gpuix/native/host";
import {
  untrack,
  merge,
  createComponent,
  createContext,
  createSignal,
  Show,
  omit,
  useContext,
} from "solid-js";
import type { Element } from "solid-js";

import type { HostElement } from "../host.js";
import { jsx } from "../jsx-runtime.js";
import { useGpuixRequired } from "../root.js";
import { buttonProps } from "./button.js";
import { DismissableLayer, renderSlot } from "./floating.js";

interface DialogState {
  open: () => boolean;
  modal: () => boolean;
  setOpen: (open: boolean) => void;
  pointerDismissal: () => boolean;
  trigger: { current: HostElement | null };
}

const DialogContext = createContext<DialogState>();

const context = (_name: string): DialogState => useContext(DialogContext);

export interface DialogProps {
  children?: Element;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Default true: blocks the page behind, keeps Tab inside the popup. */
  modal?: boolean;
  /** Keep the dialog open when the backdrop is pressed. */
  disablePointerDismissal?: boolean;
}

export const Dialog = (props: DialogProps): Element => {
  const [internalOpen, setInternalOpen] = createSignal(
    untrack(() => props.defaultOpen ?? false)
  );

  const open = () => props.open ?? internalOpen();

  const state: DialogState = {
    modal: () => props.modal ?? true,
    open,
    pointerDismissal: () => props.disablePointerDismissal !== true,
    setOpen(next) {
      const previous = open();

      if (previous === next) {
        return;
      }

      if (props.open === undefined) {
        setInternalOpen(next);
      }

      props.onOpenChange?.(next);
    },
    trigger: { current: null },
  };

  return createComponent(DialogContext, {
    get children() {
      return props.children;
    },
    value: state,
  });
};

export interface DialogTriggerProps extends HostProps {
  children?: Element;
  asChild?: boolean;
  ref?: (element: HostElement) => void;
}

export const DialogTrigger = (props: DialogTriggerProps): Element => {
  const state = useContext(DialogContext);

  const forwardedProps = merge(
    props,
    {
      get "aria-expanded"() {
        return state.open();
      },
      ref(element: HostElement) {
        state.trigger.current = element;

        props.ref?.(element);
      },
    },
    buttonProps({
      onClick(event) {
        props.onClick?.(event);

        state.setOpen(true);
      },
      onKeyDown: (event) => props.onKeyDown?.(event),
      onKeyUp: (event) => props.onKeyUp?.(event),
      get tabIndex() {
        return props.tabIndex;
      },
    })
  );

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

export interface DialogPortalProps extends HostProps {
  children?: Element;
}

/**
 * A full-window layer painted after the page, so it covers `<virtual-list>`
 * and everything else. Mounted only while the dialog is open.
 */
export const DialogPortal = (props: DialogPortalProps): Element => {
  const state = context("DialogPortal");

  return Show<boolean>({
    get children() {
      return jsx(
        "anchored",
        merge(props, {
          get children() {
            return props.children;
          },
          deferred: true,
          // Size this overlay to the viewport and paint it below menus.
          fill: "window" as const,
          get occlude() {
            return state.modal();
          },
          priority: 0,
          get style(): StyleDesc {
            return {
              alignItems: "center",
              backgroundColor: "transparent",
              display: "flex",
              justifyContent: "center",
              ...props.style,
              pointerEvents: state.modal()
                ? props.style?.pointerEvents
                : "none",
            };
          },
        })
      );
    },
    keyed: true,
    get when() {
      return state.open();
    },
  });
};

export interface DialogBackdropProps extends HostProps {
  children?: Element;
}

/** Covers the window behind the popup. A press on it closes the dialog. */
export const DialogBackdrop = (props: DialogBackdropProps): Element => {
  const state = context("DialogBackdrop");

  return jsx(
    "div",
    merge(props, {
      onMouseDown(event: EventPayload) {
        props.onMouseDown?.(event);

        if (state.pointerDismissal()) {
          state.setOpen(false);
        }
      },
      get style(): StyleDesc {
        return {
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
          ...props.style,
        };
      },
    })
  );
};

export interface DialogPopupProps extends HostProps {
  children?: Element;
  ref?: (element: HostElement) => void;
  /** Focus on open. Default: the popup itself, so the first Tab enters it. */
  initialFocus?: FocusTarget<HostElement>;
  /** Focus on close. Default: the trigger, else the element focused before open. */
  finalFocus?: FocusTarget<HostElement>;
}

/** The dialog surface. Moves focus in on open and back out on close. */
export const DialogPopup = (allProps: DialogPopupProps): Element => {
  const props = omit(allProps, "initialFocus", "finalFocus");

  const state = context("DialogPopup");

  const renderer = useGpuixRequired();

  let popup: HostElement | null = null;

  return Show<boolean>({
    get children() {
      return createComponent(DismissableLayer, {
        get children() {
          return jsx(
            "div",
            merge(props, {
              onKeyDown(event: KeyEvent) {
                props.onKeyDown?.(event);

                if (
                  !state.modal() ||
                  event.key !== "tab" ||
                  event.defaultPrevented ||
                  !popup
                ) {
                  return;
                }

                event.preventDefault();

                if (event.modifiers?.shift === true) {
                  renderer.focusPreviousWithin?.(popup.id);
                } else {
                  renderer.focusNextWithin?.(popup.id);
                }
              },
              ref(element: HostElement) {
                popup = element;

                props.ref?.(element);
              },
              get role() {
                return props.role ?? "dialog";
              },
              // A press inside the popup must never reach the backdrop behind it.
              // The popup is focused so the first Tab enters it; it is a surface,
              // not a control, so it gets no focus look of its own.
              get style(): StyleDesc {
                return {
                  keyboardFocusDim: false,
                  pointerEvents: "auto",
                  ...props.style,
                };
              },
              get tabIndex() {
                return props.tabIndex ?? -1;
              },
            })
          );
        },
        finalFocus: (previous) =>
          resolveFocusTarget(
            allProps.finalFocus,
            () => state.trigger.current?.id ?? previous
          ),
        initialFocus: () =>
          resolveFocusTarget(allProps.initialFocus, () => popup?.id ?? null),
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

export const DialogTitle = (
  props: HostProps & { children?: Element }
): Element => jsx("div", { "aria-level": 2, role: "heading", ...props });

export const DialogDescription = (
  props: HostProps & { children?: Element }
): Element => jsx("div", props);

export interface DialogCloseProps extends HostProps {
  children?: Element;
  asChild?: boolean;
}

export const DialogClose = (props: DialogCloseProps): Element => {
  const state = useContext(DialogContext);

  const forwardedProps = merge(
    props,
    buttonProps({
      onClick(event) {
        props.onClick?.(event);

        state.setOpen(false);
      },
      onKeyDown: (event) => props.onKeyDown?.(event),
      onKeyUp: (event) => props.onKeyUp?.(event),
      get tabIndex() {
        return props.tabIndex;
      },
    })
  );

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

export {
  Dialog as Root,
  DialogBackdrop as Backdrop,
  DialogClose as Close,
  DialogDescription as Description,
  DialogPopup as Popup,
  DialogPortal as Portal,
  DialogTitle as Title,
  DialogTrigger as Trigger,
};
