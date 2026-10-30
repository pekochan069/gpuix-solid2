import type { EventPayload, HostElement, KeyEvent } from "gpuix-solid2";
import { useGpuix } from "gpuix-solid2";
import { onSettled } from "solid-js";

export type NativeRef = () => HostElement | null;

const keyNames = new Map<string, string>([
  ["enter", "Enter"],
  ["return", "Enter"],
  ["space", " "],
  ["spacebar", " "],
  [" ", " "],
  ["escape", "Escape"],
  ["esc", "Escape"],
  ["tab", "Tab"],
  ["up", "ArrowUp"],
  ["arrowup", "ArrowUp"],
  ["down", "ArrowDown"],
  ["arrowdown", "ArrowDown"],
  ["left", "ArrowLeft"],
  ["arrowleft", "ArrowLeft"],
  ["right", "ArrowRight"],
  ["arrowright", "ArrowRight"],
  ["home", "Home"],
  ["end", "End"],
  ["pageup", "PageUp"],
  ["pagedown", "PageDown"],
  ["backspace", "Backspace"],
  ["delete", "Delete"],
]);

/** Normalize GPUI key names only where native events enter a behavior. */
export const normalizeKey = (key: string | undefined): string =>
  keyNames.get(key?.toLowerCase() ?? "") ?? key ?? "";

export const normalizeKeyboardEvent = (event: KeyEvent): KeyEvent => ({
  ...event,
  get defaultPrevented() {
    return event.defaultPrevented;
  },
  key: normalizeKey(event.key),
  preventDefault: () => {
    event.preventDefault();
  },
  stopPropagation: () => {
    event.stopPropagation();
  },
});

export const contains = (
  container: HostElement | null,
  id: number
): boolean => {
  if (!container) {
    return false;
  }

  if (container.id === id) {
    return true;
  }

  return container.children.some(
    (child) => child.kind === "element" && contains(child, id)
  );
};

export const createNativeServices = () => {
  const context = useGpuix();

  return {
    ...context,
    bounds(ref: NativeRef) {
      const node = ref();

      return node?.mounted === true
        ? (context.renderer.getElementBounds?.(node.id) ?? null)
        : null;
    },
    focus(ref: NativeRef) {
      context.flushMutations();
      const node = ref();

      if (node?.mounted === true) {
        context.renderer.focusElement?.(node.id);
      }
    },
    scrollIntoView(ref: NativeRef) {
      const node = ref();

      if (node?.mounted === true) {
        context.renderer.scrollIntoView?.(node.id);
      }
    },
    subscribe(listener: (event: EventPayload) => void) {
      onSettled(() => context.subscribeEvents(listener));
    },
  };
};
