import solid2 from "eslint-plugin-solid/configs/v2-strict";
import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";

export default defineConfig({
  env: core.env,
  extends: [core, antiSlop],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: ["eslint-plugin-solid", "eslint-plugin-de-morgan"],
  options: { typeAware: true },
  rules: {
    ...solid2.rules,
    "de-morgan/no-negated-conjunction": "error",
    "de-morgan/no-negated-disjunction": "error",
  },
  settings: solid2.settings,
});
