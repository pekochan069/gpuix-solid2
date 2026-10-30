import type { EventPayload } from "@gpuix/native";
import { TestRenderer } from "@gpuix/native/testing";
import type { TestRendererOptions } from "@gpuix/native/testing";
import type { Element } from "solid-js";

import { createRoot } from "./root.js";
import type { Root } from "./root.js";

export { TestRenderer, hasNativeTestRenderer } from "@gpuix/native/testing";

export * from "@gpuix/native/testing";

export interface TestRoot {
  root: Root;
  renderer: TestRenderer;
  render: (code: () => Element) => void;
  flushSync: <Value>(fn: () => Value) => Value;
  unmount: () => void;
}

export const createTestRoot = (options: TestRendererOptions = {}): TestRoot => {
  const dispatchEvent = (event: EventPayload) => {
    // oxlint-disable-next-line no-use-before-define -- Native events run after root initialization.
    root.dispatch(event);
  };

  const renderer = new TestRenderer({
    ...options,
    dispatchEvent,
  });

  const root = createRoot(renderer);

  return {
    flushSync(fn) {
      const value = root.flushSync(fn);

      renderer.flush();

      return value;
    },
    render(code) {
      root.render(code);

      renderer.flush();
    },
    renderer,
    root,
    unmount() {
      root.unmount();

      renderer.flush();
    },
  };
};
