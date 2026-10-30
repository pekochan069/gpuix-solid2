import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

const [filterNotice] = readFileSync(
  new URL("src/filter.ts", import.meta.url),
  "utf-8"
).split("\nimport ");

export default defineConfig({
  banner: ({ fileName }) =>
    fileName.startsWith("filter.")
      ? { dts: filterNotice, js: filterNotice }
      : undefined,
  deps: { neverBundle: true },
  dts: {
    generator: "tsgo",
    sourcemap: false,
    tsgo: {
      path: fileURLToPath(
        new URL("bin/tsc", import.meta.resolve("typescript/package.json"))
      ),
    },
  },
  entry: ["src/**/*.ts"],
  fixedExtension: false,
  root: "src",
  unbundle: true,
});
