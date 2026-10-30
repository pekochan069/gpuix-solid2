import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { transform } from "@solidjs/compiler";
import { defineConfig } from "tsdown";

export default defineConfig({
  banner: ({ fileName }) => {
    const name = fileName.replace(/\.(?:d\.ts|js)$/u, "");

    if (name === "index") {
      return {};
    }

    const extension = name === "utils" ? "ts" : "tsx";

    const [notice] = readFileSync(
      new URL(`src/${name}.${extension}`, import.meta.url),
      "utf-8"
    ).split("\nimport ");

    return { dts: notice, js: notice };
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
  entry: ["src/**/*.ts", "src/**/*.tsx"],
  fixedExtension: false,
  plugins: [
    {
      name: "solid2-native",
      transform: {
        filter: { id: /\.tsx$/u },
        handler(code, id) {
          const result = transform(code, {
            builtIns: [],
            dev: false,
            filename: id,
            generate: "universal",
            moduleName: "gpuix-solid2",
          });

          return { code: result.code, map: result.map, moduleType: "ts" };
        },
        order: "pre",
      },
    },
  ],
  root: "src",
  unbundle: true,
});
