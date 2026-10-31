import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { build } from "tsdown";

const root = path.resolve(import.meta.dir, "..");
const consumer = await mkdtemp(path.join(tmpdir(), "gpuix-aria-consumer-"));

const run = (command: string[], cwd = consumer) => {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, NODE_PATH: "" },
    stderr: "inherit",
    stdout: "inherit",
  });

  assert.equal(result.exitCode, 0, `Failed: ${command.join(" ")}`);
};

try {
  const nativePackages = [
    "gpuix-solid2",
    "gpuix-solid2-stately",
    "gpuix-solid2-aria",
  ];

  const tarballs = Object.fromEntries(
    nativePackages.map((name) => [name, `file:./${name}.tgz`])
  );

  const dependencies = {
    ...tarballs,
    "@types/bun": "^1.4.4",
    "solid-js": "2.0.0-rc.20",
  };

  for (const name of [
    "gpuix-solid2",
    "gpuix-solid2-stately",
    "gpuix-solid2-aria",
  ]) {
    const tar = path.join(consumer, `${name}.tgz`);
    run(
      [
        process.execPath,
        "pm",
        "pack",
        "--ignore-scripts",
        "--quiet",
        "--filename",
        tar,
      ],
      path.join(root, "..", name)
    );
  }

  await writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({ dependencies, overrides: tarballs, type: "module" })
  );
  run([process.execPath, "install", "--ignore-scripts", "--silent"]);
  await cp(
    path.join(root, "fixtures/consumer.ts"),
    path.join(consumer, "consumer.ts")
  );
  const files = await readdir(path.join(root, "dist"));
  const modules = files.filter((file) => file.endsWith(".js"));
  await writeFile(
    path.join(consumer, "all-types.ts"),
    modules
      .map(
        (file, index) =>
          `import type * as M${index} from "gpuix-solid2-aria/${file.slice(0, -3)}";`
      )
      .join("\n")
  );
  await writeFile(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        lib: ["ESNext"],
        module: "Preserve",
        moduleResolution: "bundler",
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: "ESNext",
        types: ["bun"],
      },
      files: ["consumer.ts", "all-types.ts"],
    })
  );
  run([path.resolve(root, "../../node_modules/.bin/tsc"), "-p", consumer]);
  await build({
    cwd: consumer,
    deps: {
      alwaysBundle: [
        /^gpuix-solid2(?:-|\/|$)/u,
        /^solid-js(?:\/|$)/u,
        /^@solidjs\//u,
      ],
    },
    dts: false,
    entry: { consumer: "consumer.ts" },
    fixedExtension: false,
    inputOptions: {
      external: [/^node:/u, /^@gpuix\/native(?:\/|$)/u, "module"],
      resolve: { conditionNames: ["import", "default"] },
    },
    outDir: "out",
    platform: "neutral",
  });
  run([process.execPath, "out/consumer.js"]);

  const source = await readFile(
    path.join(consumer, "out/consumer.js"),
    "utf-8"
  );

  assert.doesNotMatch(source, /from ["']@solidjs\/web/u);
  await Promise.all(
    [
      "LICENSE",
      "NOTICE.txt",
      "LICENSES/Apache-2.0.txt",
      "LICENSES/solid2-aria-NOTICE.txt",
      "LICENSES/react-spectrum-NOTICE.txt",
    ].map(async (file) => {
      assert.equal(
        await readFile(
          path.join(consumer, "node_modules/gpuix-solid2-aria", file),
          "utf-8"
        ),
        await readFile(path.join(root, file), "utf-8")
      );
    })
  );

  await Promise.all(
    [
      "filter",
      "checkbox-group",
      "toggle-button-group",
      "disclosure",
      "tabs",
      "search-field",
      "number-field",
    ].map(async (name) => {
      const original = await readFile(
        path.join(root, `src/${name}.ts`),
        "utf-8"
      );

      const [notice = ""] = original.split("\nimport ");
      assert.match(notice, /Copyright 20\d\d Adobe/u);

      await Promise.all(
        ["js", "d.ts"].map(async (extension) => {
          const file = `${name}.${extension}`;

          const emitted = await readFile(
            path.join(consumer, "node_modules/gpuix-solid2-aria/dist", file),
            "utf-8"
          );

          assert.ok(
            emitted.startsWith(notice),
            `Missing original notice in ${file}`
          );
        })
      );
    })
  );
  console.log(
    `Checked ${modules.length} native declarations without lib.dom and verified packaged license texts.`
  );
} finally {
  await rm(consumer, { force: true, recursive: true });
}
