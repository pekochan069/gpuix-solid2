import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "tsdown";

const notices = new Map(
  [
    "filter",
    "checkbox-group",
    "toggle-button-group",
    "disclosure",
    "tabs",
    "search-field",
  ].map((name) => [
    name,
    readFileSync(new URL(`src/${name}.ts`, import.meta.url), "utf-8").split(
      "\nimport "
    )[0],
  ])
);

export default defineConfig({
  banner: ({ fileName }) => {
    const notice = notices.get(fileName.split(".")[0] ?? "");

    return notice === undefined ? undefined : { dts: notice, js: notice };
  },
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
