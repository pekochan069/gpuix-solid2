import { plugin } from "bun";

import { createSolidPlugin } from "../bun-plugin.js";

void plugin(
  createSolidPlugin({
    dev: true,
    moduleName: new URL("../universal.ts", import.meta.url).pathname,
  })
);
