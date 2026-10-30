import type { EventPayload } from "@gpuix/native";
import {
  createMutationQueue,
  createRendererState,
  unregisterEventHandlers,
} from "@gpuix/native/host";
import type {
  NativeRenderer,
  RendererRootBinding,
  RootEventHandlers,
} from "@gpuix/native/host";
import {
  createComponent,
  createContext,
  flush as flushSolid,
  useContext,
} from "solid-js";
import type { Element } from "solid-js";

import { createHostRoot, removeHostNode } from "./host.js";
import { universalRender } from "./universal.js";

export interface GpuixContextValue {
  flushMutations: () => void;
  renderer: NativeRenderer;
  subscribeSelection: (callback: (text: string | null) => void) => () => void;
}

export const GpuixContext = createContext<GpuixContextValue>();

export const useGpuix = (): GpuixContextValue => useContext(GpuixContext);

export const useGpuixRequired = (): NativeRenderer => {
  const value = useGpuix();

  return value.renderer;
};

export interface Root {
  render: (code: () => Element) => void;
  flush: () => void;
  flushSync: <Value>(fn: () => Value) => Value;
  dispatch: (event: EventPayload) => boolean;
  unmount: () => void;
}

export const createRoot = (
  renderer: NativeRenderer,
  rootHandlers: RootEventHandlers = {}
): Root => {
  const state = createRendererState(renderer);

  const eventHandlers = new Map();

  const mutations = createMutationQueue(
    renderer,
    (ids) => {
      for (const id of ids) {
        unregisterEventHandlers(eventHandlers, id);
      }
    },
    (flush) => {
      queueMicrotask(() => {
        try {
          flush();
        } catch (error) {
          rootHandlers.onUncaughtError?.(
            error instanceof Error ? error : new Error(String(error)),
            {}
          );
        }
      });
    }
  );

  const container = createHostRoot({
    allocateId: () => (state.ids.nextElementId += 1),
    eventHandlers,
    mutations,
    nativeRenderer: renderer,
  });

  let binding: RendererRootBinding | undefined;

  let dispose: (() => void) | undefined;

  const selectionListeners = new Set<(text: string | null) => void>();

  const onSelectionChange = (
    event: EventPayload,
    currentRenderer: NativeRenderer
  ) => {
    rootHandlers.onSelectionChange?.(event, currentRenderer);

    for (const listener of selectionListeners) {
      listener(event.value ?? null);
    }
  };

  const syncSelection = () => {
    if (!binding) {
      return;
    }

    renderer.setWindowSelectionChange?.(
      rootHandlers.onSelectionChange !== undefined ||
        selectionListeners.size > 0,
      binding.windowSelectionEventId
    );
  };

  const attach = () => {
    binding = state.attach({
      eventHandlers,
      onEvent: rootHandlers.onEvent,
      onSelectionChange,
      onWindowKeyDown: rootHandlers.onKeyDown,
      onWindowKeyUp: rootHandlers.onKeyUp,
      tabNavigation: rootHandlers.tabNavigation,
    });

    renderer.setWindowKeyEvents?.(
      // Always on: the Tab and Escape defaults run on the window event.
      true,
      rootHandlers.onKeyUp !== undefined,
      binding.windowKeyEventId
    );

    // Sent on every attach, so a remount without the option restores the default.
    mutations.setKeyboardFocusDim(rootHandlers.keyboardFocusDim !== false);

    syncSelection();
  };

  const detach = () => {
    if (binding?.detach() !== true) {
      return;
    }

    renderer.setWindowKeyEvents?.(false, false, binding.windowKeyEventId);

    renderer.setWindowSelectionChange?.(false, binding.windowSelectionEventId);

    binding = undefined;
  };

  attach();

  const flush = () => {
    flushSolid();

    mutations.flushMutations();
  };

  const clear = () => {
    dispose?.();

    dispose = undefined;

    while (container.children.length > 0) {
      const mounted = container.children.at(-1);

      if (mounted) {
        removeHostNode(container, mounted);
      }
    }

    flush();

    eventHandlers.clear();
  };

  return {
    dispatch(event) {
      try {
        return state.dispatch(event);
      } finally {
        flush();
      }
    },
    flush,
    flushSync(fn) {
      try {
        return fn();
      } finally {
        flush();
      }
    },
    render(code) {
      if (dispose) {
        clear();

        detach();

        attach();
      }

      if (!binding) {
        attach();
      }

      dispose = universalRender(
        () =>
          createComponent(GpuixContext, {
            get children() {
              return code();
            },
            value: {
              flushMutations() {
                mutations.flushMutations();
              },
              renderer,
              subscribeSelection(listener) {
                selectionListeners.add(listener);

                listener(renderer.getSelectedText?.() ?? null);

                syncSelection();

                return () => {
                  selectionListeners.delete(listener);

                  syncSelection();
                };
              },
            },
          }),
        container
      );

      flush();
    },
    unmount() {
      clear();

      detach();
    },
  };
};
