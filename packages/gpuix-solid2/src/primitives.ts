import {
  createTextSearchController,
  observeWindowInsets,
  observeWindowSize,
  readWindowInsets,
  readWindowSize,
} from "@gpuix/native/host";
import type {
  ObserverOptions,
  TextSearchOptions,
  WindowInsets,
  WindowSize,
} from "@gpuix/native/host";
import { createSignal, onSettled } from "solid-js";
import type { Accessor } from "solid-js";

import { useGpuix, useGpuixRequired } from "./root.js";

export const createWindowSize = (
  options: ObserverOptions = {}
): Accessor<WindowSize> => {
  const renderer = useGpuixRequired();

  const [value, setValue] = createSignal(readWindowSize(renderer));

  onSettled(() =>
    observeWindowSize(
      renderer,
      (next) => {
        setValue(next);
      },
      options
    )
  );

  return value;
};

export const createWindowInsets = (
  options: ObserverOptions = {}
): Accessor<WindowInsets> => {
  const renderer = useGpuixRequired();

  const [value, setValue] = createSignal(readWindowInsets(renderer));

  onSettled(() =>
    observeWindowInsets(
      renderer,
      (next) => {
        setValue(next);
      },
      options
    )
  );

  return value;
};

export const createSelectedText = (): Accessor<string | null> => {
  const context = useGpuix();

  const [value, setValue] = createSignal(
    context.renderer.getSelectedText?.() ?? null
  );

  onSettled(() =>
    context.subscribeSelection((next) => {
      setValue(next);
    })
  );

  return value;
};

export const createTextSearch = (options: Accessor<TextSearchOptions>) => {
  const controller = createTextSearchController();

  const [revision, setRevision] = createSignal(0);

  onSettled(() =>
    controller.subscribe(() => {
      setRevision((value) => value + 1);
    })
  );

  return {
    get active() {
      revision();

      return controller.getSnapshot(options()).active;
    },
    goTo: (index: number) => {
      controller.goTo(index);
    },
    next: () => {
      controller.next();
    },
    previous: () => {
      controller.previous();
    },
    get props() {
      revision();

      return controller.getSnapshot(options()).props;
    },
    get total() {
      revision();

      return controller.getSnapshot(options()).total;
    },
  };
};
