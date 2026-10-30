import type { HostProps } from "gpuix-solid2";
import { onSettled } from "solid-js";

import { contains, createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export const createFocusManager = (ref: NativeRef) => {
  const services = createNativeServices();
  const { renderer } = services;

  return {
    focusFirst() {
      services.focus(ref);
      const node = ref();

      if (node?.mounted === true) {
        renderer.focusNextWithin?.(node.id);
      }
    },
    focusNext() {
      const node = ref();

      if (node?.mounted === true) {
        renderer.focusNextWithin?.(node.id);
      }
    },
    focusPrevious() {
      const node = ref();

      if (node?.mounted === true) {
        renderer.focusPreviousWithin?.(node.id);
      }
    },
  };
};

export const createFocusScope = (
  props: { contain?: boolean; restoreFocus?: boolean; autoFocus?: boolean },
  ref: NativeRef
) => {
  const services = createNativeServices();
  const manager = createFocusManager(ref);
  const previous = services.renderer.getFocusedElementId?.() ?? null;
  onSettled(() => {
    if (props.autoFocus === true) {
      manager.focusFirst();
    }

    return () => {
      if (props.restoreFocus === true && previous !== null) {
        services.renderer.focusElement?.(previous);
      }
    };
  });
  services.subscribe((event) => {
    if (event.eventType !== "focus" || !(props.contain === true)) {
      return;
    }

    const node = ref();
    const id = services.renderer.getFocusedElementId?.();

    if (
      node?.mounted === true &&
      id !== undefined &&
      id !== null &&
      !contains(node, id)
    ) {
      manager.focusFirst();
    }
  });

  return {
    focusManager: manager,
    scopeProps: {
      onKeyDown(event) {
        if (
          !(props.contain === true) ||
          event.defaultPrevented ||
          normalizeKey(event.key) !== "Tab"
        ) {
          return;
        }

        event.preventDefault();

        if (event.modifiers?.shift === true) {
          manager.focusPrevious();
        } else {
          manager.focusNext();
        }
      },
    } satisfies HostProps,
  };
};
