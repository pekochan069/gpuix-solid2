import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

export default defineConfig({
  deps: { neverBundle: true },
  dts: {
    // tsdown 0.23 auto-detects TypeScript 7.0, while this workspace uses 7.1 beta.
    generator: "tsgo",
    sourcemap: false,
    tsgo: {
      path: fileURLToPath(
        new URL("bin/tsc", import.meta.resolve("typescript/package.json"))
      ),
    },
  },
  entry: ["src/**/*.ts", "!src/**/__tests__/**"],
  fixedExtension: false,
  root: "src",
  sourcemap: true,
  unbundle: true,
});
