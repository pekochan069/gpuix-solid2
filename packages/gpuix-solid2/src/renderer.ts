import { GpuixRenderer } from "@gpuix/native";
import type { WindowOptions, EventPayload } from "@gpuix/native";
import type { NativeRenderer, RootEventHandlers } from "@gpuix/native/host";
import {
  createNativeRenderer,
  installBrowserAutomation,
  startFrameLoop,
} from "@gpuix/native/runtime";
import type { FrameLoop } from "@gpuix/native/runtime";
import type { Element } from "solid-js";

import { createRoot } from "./root.js";
import type { Root } from "./root.js";

const RENDER_HOST = Symbol.for("gpuix-solid2/render-host");

interface RenderSlot {
  renderer?: NativeRenderer;
  root?: Root;
  loop?: FrameLoop;
}

export interface RenderOptions extends WindowOptions, RootEventHandlers {
  renderer?: NativeRenderer;
  debugFrameOverlay?: "hidden" | "minimal" | "full";
}

export const createRenderer = (
  onEvent?: (event: EventPayload) => void
): GpuixRenderer =>
  createNativeRenderer({
    onError: (error) => {
      console.error("[gpuix-solid2] native event error", error);
    },
    onEvent,
  });

const slot = (): RenderSlot => {
  const global: typeof globalThis & {
    [RENDER_HOST]?: RenderSlot;
  } = globalThis;

  return (global[RENDER_HOST] ??= {});
};

/** Mount Solid. Later calls under `bun --hot` remount on the same window. */
export const render = (
  code: () => Element,
  options: RenderOptions = {}
): Root => {
  const {
    renderer: injected,
    debugFrameOverlay,
    onEvent,
    onKeyDown,
    onKeyUp,
    onSelectionChange,
    tabNavigation,
    keyboardFocusDim,
    onUncaughtError,
    ...windowOptions
  } = options;

  const host = slot();

  if (!host.renderer) {
    host.renderer =
      injected ??
      createNativeRenderer({
        onError(error) {
          onUncaughtError?.(
            error instanceof Error ? error : new Error(String(error)),
            {}
          );
        },
      });

    if (!injected && host.renderer instanceof GpuixRenderer) {
      host.renderer.init(windowOptions);
    }
  }

  host.root?.unmount();

  host.root = createRoot(host.renderer, {
    keyboardFocusDim,
    onEvent,
    onKeyDown,
    onKeyUp,
    onSelectionChange,
    onUncaughtError,
    tabNavigation,
  });

  if (!injected && host.renderer instanceof GpuixRenderer && !host.loop) {
    host.loop = startFrameLoop(host.renderer, {
      onError: (error) => {
        console.error("[gpuix-solid2] frame error", error);
      },
      onTerminated: () => {
        if (typeof process !== "undefined") {
          process.exit(0);
        }
      },
    });
  }

  if (
    Reflect.has(globalThis, "window") &&
    host.renderer instanceof GpuixRenderer &&
    !Reflect.has(globalThis, "gpuix")
  ) {
    Reflect.set(globalThis, "gpuix", installBrowserAutomation(host.renderer));
  }

  if (debugFrameOverlay) {
    host.renderer.setDebugFrameOverlay?.(debugFrameOverlay);
  }

  host.root.render(code);

  return host.root;
};

export const resetRender = (): void => {
  const global: typeof globalThis & {
    [RENDER_HOST]?: RenderSlot;
  } = globalThis;

  const host = global[RENDER_HOST];

  host?.loop?.stop();

  host?.root?.unmount();

  Reflect.deleteProperty(global, RENDER_HOST);
};
