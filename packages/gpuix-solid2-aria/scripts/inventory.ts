import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");

const upstream =
  process.argv[2] ?? path.resolve(root, "../../../aria/solid-aria");

const commit = "4bb0e1f8c918e63c045c28d995d51dd1cf9a83b1";

const readUpstream = (file: string) => {
  const result = Bun.spawnSync([
    "git",
    "-C",
    upstream,
    "show",
    `${commit}:packages/solid2-aria/${file}`,
  ]);

  assert.equal(result.exitCode, 0, result.stderr.toString());

  return result.stdout.toString();
};

const files = await readdir(path.join(root, "src"));

const modules = await Promise.all(
  files
    .filter((file) => file.endsWith(".ts"))
    .map(async (file) => await readFile(path.join(root, "src", file), "utf-8"))
);

const nativeNames = new Set(
  modules.flatMap((source) =>
    [
      ...source.matchAll(/export (?:const|class|function) (?<native>\w+)/gu),
    ].map((match) => match.groups?.native)
  )
);

const source = readUpstream("src/index.ts").split("export type {")[0] ?? "";

const entries = [
  ...source.matchAll(
    /export\s*\{(?<names>[^}]+)\}\s*from\s*"(?<source>[^"]+)";/gu
  ),
].flatMap((match) => {
  const sourcePath = match.groups?.source?.replace(/^\.\//u, "");

  return (match.groups?.names ?? "")
    .split(",")
    .map((entry) => entry.trim().split(" as ").at(-1) ?? "")
    .filter(Boolean)
    .map(
      (name) =>
        [
          name,
          {
            source: sourcePath,
            status: nativeNames.has(name) ? "native-subset" : "deferred",
          },
        ] satisfies [
          string,
          { source: string | undefined; status: "native-subset" | "deferred" },
        ]
    );
});

const publicModules = [
  ...readUpstream("package.json").matchAll(/"(?<module>\.\/[^"]+)"\s*:/gu),
]
  .flatMap((match) =>
    match.groups?.module === "./package.json"
      ? []
      : [match.groups?.module ?? ""]
  )
  .toSorted((a, b) => (a < b ? -1 : Number(a > b)));

const inventory = {
  exports: Object.fromEntries(entries),
  publicModules,
  source: {
    commit,
    package: "packages/solid2-aria",
    repository: "https://github.com/pekochan069/solid2-aria",
  },
};

const output = `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const existing: unknown = JSON.parse(
    await readFile(path.join(root, "native-coverage.json"), "utf-8")
  );

  assert.deepEqual(existing, inventory);
} else {
  await writeFile(path.join(root, "native-coverage.json"), output);
}

console.log(
  `Inventoried ${entries.length} upstream runtime exports and ${publicModules.length} public module paths.`
);
