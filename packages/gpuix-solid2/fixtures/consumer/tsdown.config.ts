import { fileURLToPath } from "node:url";

import { transform } from "@solidjs/compiler";
import { defineConfig } from "tsdown";

export default defineConfig({
  clean: false,
  cwd: fileURLToPath(new URL("../../", import.meta.url)),
  deps: {
    alwaysBundle: [
      "gpuix-solid2",
      "solid-js",
      "@solidjs/universal",
      "@solidjs/signals",
    ],
  },
  dts: false,
  entry: { consumer: "fixtures/consumer/main.tsx" },
  fixedExtension: true,
  inputOptions: {
    resolve: { conditionNames: ["development", "import", "default"] },
  },
  outDir: ".cache",
  platform: "neutral",
  plugins: [
    {
      name: "solid2-universal",
      transform: {
        filter: { id: /\.tsx$/u },
        handler(code, id) {
          const result = transform(code, {
            builtIns: [],
            dev: true,
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
});
