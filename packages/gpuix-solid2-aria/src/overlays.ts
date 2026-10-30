import type { HostProps, NativeRenderer, DismissLayer } from "gpuix-solid2";
import { pushDismissLayer } from "gpuix-solid2";
import { createEffect } from "solid-js";

import { contains, createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

interface OverlayEntry {
  ref: NativeRef;
  layer: DismissLayer;
}

const layers = new WeakMap<NativeRenderer, OverlayEntry[]>();

export interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  isModal?: boolean;
  shouldRestoreFocus?: boolean;
  triggerRef?: NativeRef;
}

export const createOverlay = (props: OverlayProps, ref: NativeRef) => {
  const services = createNativeServices();

  const stack = layers.get(services.renderer) ?? [];
  layers.set(services.renderer, stack);
  let outsideTimer: ReturnType<typeof setTimeout> | undefined;

  // The callback is invoked after entry registration.
  const top = () => stack.at(-1)?.ref === ref;

  const layer: DismissLayer = {
    finalFocus: (previous) =>
      props.shouldRestoreFocus === false
        ? null
        : (props.triggerRef?.()?.id ?? previous),
    initialFocus: () => ref()?.id ?? null,
    onEscapeKeyDown() {
      if (top() && !(props.isKeyboardDismissDisabled === true)) {
        props.onClose();
      }
    },
  };

  const entry: OverlayEntry = { layer, ref };

  const activeScope = () =>
    top() || contains(ref(), stack.at(-1)?.ref()?.id ?? 0);

  createEffect(
    () => props.isOpen,
    (open): (() => void) | undefined => {
      if (!open) {
        return undefined;
      }

      const previous = services.renderer.getFocusedElementId?.() ?? null;
      services.flushMutations();

      const parent = stack.findLast((candidate) =>
        contains(candidate.ref(), ref()?.id ?? 0)
      );

      Object.defineProperty(layer, "parent", {
        configurable: true,
        value: parent?.layer,
      });
      stack.push(entry);

      // Shared native stack coordinates Escape and restoration with renderer components.
      const pop = pushDismissLayer(services.renderer, layer, {
        previousFocus: previous,
      });

      return () => {
        const index = stack.indexOf(entry);

        if (index !== -1) {
          stack.splice(index, 1);
        }

        if (outsideTimer !== undefined) {
          clearTimeout(outsideTimer);
          outsideTimer = undefined;
        }

        pop();
      };
    }
  );
  services.subscribe((event) => {
    if (
      !props.isOpen ||
      !(props.isModal === true) ||
      !activeScope() ||
      event.eventType !== "focus"
    ) {
      return;
    }

    const focused = services.renderer.getFocusedElementId?.();

    if (
      focused !== undefined &&
      focused !== null &&
      !contains(ref(), focused)
    ) {
      services.focus(ref);
    }
  });

  return {
    overlayProps: {
      onKeyDown(event) {
        if (
          !props.isOpen ||
          !(props.isModal === true) ||
          !activeScope() ||
          event.defaultPrevented ||
          normalizeKey(event.key) !== "Tab"
        ) {
          return;
        }

        const node = ref();

        if (!(node?.mounted === true)) {
          return;
        }

        event.preventDefault();

        if (event.modifiers?.shift === true) {
          services.renderer.focusPreviousWithin?.(node.id);
        } else {
          services.renderer.focusNextWithin?.(node.id);
        }
      },
      onMouseDownOutside(event) {
        if (!props.isOpen || props.isDismissable !== true || !top()) {
          return;
        }

        const trigger = props.triggerRef?.();

        const hits =
          event.x !== undefined && event.y !== undefined
            ? (services.renderer.getElementsAt?.(event.x, event.y) ?? [])
            : [];

        if (trigger && hits.some((id) => contains(trigger, id))) {
          return;
        }

        // Outside capture notifications for one native gesture can arrive in either order.
        // Close after that batch, so every callback sees the same top layer.
        outsideTimer ??= setTimeout(() => {
          outsideTimer = undefined;

          if (props.isOpen && ref()?.mounted === true) {
            props.onClose();
          }
        }, 0);
      },
      tabIndex: -1,
    } satisfies HostProps,
  };
};

/** Use with the renderer's anchored element; placement and collision stay native. */
export const createOverlayPosition = (
  props: {
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    offset?: number;
    padding?: number;
  } = {}
) => ({
  overlayProps: {
    get align() {
      return props.align ?? "start";
    },
    deferred: true,
    fit: "snap" as const,
    get gap() {
      return props.offset ?? 0;
    },
    priority: 1,
    get side() {
      return props.side ?? "bottom";
    },
    get snapMargin() {
      return props.padding ?? 8;
    },
  },
});
