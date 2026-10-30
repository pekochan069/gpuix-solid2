import type { NativeRenderer } from "@gpuix/native/host";

import { createRoot } from "../root.js";

export const createRecorder = () => {
  const batches: unknown[][] = [];

  const renderer: NativeRenderer = {
    applyBatch(json) {
      const batch: unknown = JSON.parse(json);

      if (!Array.isArray(batch)) {
        throw new TypeError("Expected a native mutation array");
      }

      batches.push(batch);

      return [];
    },
    getSelectedText: () => null,
    getWindowSize: () => ({ height: 600, width: 800 }),
  };

  const root = createRoot(renderer);

  const mutations = () => batches.flat();

  return { batches, mutations, renderer, root };
};
