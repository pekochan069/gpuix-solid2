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

const root = path.resolve(import.meta.dir, "..");
const fixture = await mkdtemp(path.join(tmpdir(), "gpuix-stately-consumer-"));

const run = (command: string[], cwd = fixture) => {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, NODE_PATH: "" },
    stderr: "inherit",
    stdout: "inherit",
  });

  assert.equal(result.exitCode, 0, `Failed: ${command.join(" ")}`);
};

const specifier = (file: string, suffix: string) =>
  file === `index${suffix}`
    ? "gpuix-solid2-stately"
    : `gpuix-solid2-stately/${file.slice(0, -suffix.length)}`;

try {
  // Test the actual publish artifact, with production dependencies only.
  run(
    [
      process.execPath,
      "pm",
      "pack",
      "--ignore-scripts",
      "--quiet",
      "--filename",
      path.join(fixture, "stately.tgz"),
    ],
    root
  );
  await writeFile(
    path.join(fixture, "package.json"),
    JSON.stringify({
      dependencies: {
        "@types/bun": "^1.4.4",
        "gpuix-solid2-stately": "file:./stately.tgz",
        "solid-js": "2.0.0-rc.20",
      },
      type: "module",
    })
  );
  run([process.execPath, "install", "--ignore-scripts", "--silent"]);
  await cp(
    path.join(root, "fixtures/types.ts"),
    path.join(fixture, "types.ts")
  );
  await cp(
    path.join(root, "fixtures/no-browser.ts"),
    path.join(fixture, "no-browser.ts")
  );
  await cp(
    path.join(root, "test/state.test.ts"),
    path.join(fixture, "state.test.ts")
  );
  const files = await readdir(path.join(root, "dist"), { recursive: true });
  const modules = files.filter((file) => file.endsWith(".js"));
  const declarations = files.filter((file) => file.endsWith(".d.ts"));

  await writeFile(
    path.join(fixture, "all-types.ts"),
    declarations
      .map(
        (file, index) =>
          `import type * as M${index} from "${specifier(file, ".d.ts")}";`
      )
      .join("\n")
  );
  await writeFile(
    path.join(fixture, "tsconfig.json"),
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
      files: ["types.ts", "all-types.ts"],
    })
  );
  run([path.resolve(root, "../../node_modules/.bin/tsc"), "-p", fixture]);
  await writeFile(
    path.join(fixture, "imports.ts"),
    `
import assert from "node:assert/strict";
for (const name of ["document", "window", "navigator", "HTMLElement"]) {
  Reflect.deleteProperty(globalThis, name);
  assert.equal(name in globalThis, false);
}
for (const name of ["@solidjs/web", "@solid2-aria/stately", "@solid2-aria/types-shared", "gpuix-solid2"]) {
  assert.throws(() => import.meta.resolve(name), name + " must not be installed");
}
for (const name of ${JSON.stringify(modules.map((file) => specifier(file, ".js")))}) await import(name);
console.log("Imported ${modules.length} native modules without browser globals or a renderer.");
`
  );
  run([process.execPath, "--conditions=browser", "imports.ts"]);
  run([
    process.execPath,
    "test",
    "--conditions=browser",
    "--conditions=development",
    "--preload",
    "./no-browser.ts",
    "state.test.ts",
  ]);
  const installed = path.join(fixture, "node_modules/gpuix-solid2-stately");

  await Promise.all(
    [
      "LICENSE",
      "NOTICE.txt",
      "LICENSES/Apache-2.0.txt",
      "LICENSES/react-spectrum-NOTICE.txt",
      "LICENSES/solid2-aria-NOTICE.txt",
    ].map(async (file) => {
      assert.equal(
        await readFile(path.join(installed, file), "utf-8"),
        await readFile(path.join(root, file), "utf-8")
      );
    })
  );

  console.log(
    `Checked ${declarations.length} declarations without lib.dom and verified packaged licenses.`
  );
} finally {
  await rm(fixture, { force: true, recursive: true });
}
