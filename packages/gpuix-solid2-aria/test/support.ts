import { afterEach } from "bun:test";

import { createRoot } from "gpuix-solid2";
import type { EventPayload, HostElement, NativeRenderer } from "gpuix-solid2";

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

export const setup = () => {
  const mutations: unknown[] = [];
  const focusCalls: number[] = [];
  const traversal: string[] = [];
  let focused: number | null = null;
  let windowId = 0;

  const renderer: NativeRenderer = {
    applyBatch(json) {
      const batch: unknown = JSON.parse(json);

      if (!Array.isArray(batch)) {
        throw new TypeError("Expected mutation array");
      }

      for (const mutation of batch) {
        const value: unknown = mutation;
        mutations.push(value);
      }

      return [];
    },
    focusElement(id) {
      focusCalls.push(id);
      focused = id;
    },
    focusNextWithin: () => {
      traversal.push("next");
    },
    focusPreviousWithin: () => {
      traversal.push("previous");
    },
    getElementBounds: (id) => ({
      height: 20,
      width: 100,
      x: id * 10,
      y: id * 20,
    }),
    getFocusedElementId: () => focused,
    getScrollOffset: () => [-5, -25],
    setWindowKeyEvents(_down, _up, id) {
      windowId = id;
    },
  };

  const root = createRoot(renderer);
  disposers.push(() => {
    root.unmount();
  });

  return {
    focusCalls,
    mutations,
    renderer,
    root,
    send(
      node: HostElement,
      eventType: string,
      event: Partial<EventPayload> = {}
    ) {
      return root.dispatch({ elementId: node.id, eventType, ...event });
    },
    traversal,
    windowKey(key: string) {
      root.dispatch({ elementId: windowId, eventType: "windowKeyDown", key });
    },
  };
};
