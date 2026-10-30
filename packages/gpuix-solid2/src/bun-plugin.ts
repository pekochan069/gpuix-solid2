import { readFile } from "node:fs/promises";
import nodePath from "node:path";

import { transform } from "@solidjs/compiler";
import type { TransformOptions } from "@solidjs/compiler";
import { plugin } from "bun";
import type { BunPlugin } from "bun";

export interface SolidPluginOptions {
  dev?: boolean;
  moduleName?: string;
}

/** Native applications need the client graph without selecting browser GPUIX. */
export const createSolidPlugin = (
  options: SolidPluginOptions = {}
): BunPlugin => {
  const dev = options.dev ?? process.env.NODE_ENV !== "production";

  const compilerOptions: TransformOptions = {
    builtIns: [],
    dev,
    generate: "universal",
    moduleName: options.moduleName ?? "gpuix-solid2",
  };

  return {
    name: "gpuix-solid2",
    setup(build) {
      build.onLoad(
        {
          filter: /[/\\]solid-js[/\\]dist[/\\]server(?:\.dev|\.observe)?\.js$/u,
        },
        ({ path }) => ({
          contents: `export * from ${JSON.stringify(nodePath.resolve(nodePath.dirname(path), dev ? "solid.dev.js" : "solid.js"))}`,
          loader: "js",
        })
      );

      if (dev) {
        build.onLoad(
          {
            filter:
              /[/\\]@solidjs[/\\]signals[/\\]dist[/\\]prod[/\\]index\.js$/u,
          },
          ({ path }) => ({
            contents: `export * from ${JSON.stringify(nodePath.resolve(nodePath.dirname(path), "../dev.js"))}`,
            loader: "js",
          })
        );
      }

      build.onLoad({ filter: /\.[cm]?[jt]sx$/u }, async ({ path }) => {
        const source = await readFile(path, "utf-8");

        const result = transform(source, {
          ...compilerOptions,
          filename: path,
        });

        return { contents: result.code, loader: "ts" };
      });
    },
  };
};

const stateKey = Symbol.for("gpuix-solid2/bun-plugin");

const state: typeof globalThis & { [stateKey]?: boolean } = globalThis;

export const ensureSolidPlugin = (): boolean => {
  if (state[stateKey] === true) {
    return false;
  }

  void plugin(createSolidPlugin());

  state[stateKey] = true;

  return true;
};

export default createSolidPlugin();
