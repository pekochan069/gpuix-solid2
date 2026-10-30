# gpuix-solid2

Native Solid 2 packages:

- [gpuix-solid2](packages/gpuix-solid2/README.md): GPUIX renderer and controls.
- [gpuix-solid2-stately](packages/gpuix-solid2-stately/README.md): renderer-neutral state with native locale, geometry, and type contracts. See its [module audit](packages/gpuix-solid2-stately/PORTING.md).
- [gpuix-solid2-aria](packages/gpuix-solid2-aria/README.md): native interaction and control behavior foundations. Its [coverage audit](packages/gpuix-solid2-aria/PORTING.md) records deferred widgets and native accessibility gaps.
- [gpuix-solid2-aria-components](packages/gpuix-solid2-aria-components/README.md): native Button, ToggleButton, and Checkbox components with context slots and render callbacks. Its [porting audit](packages/gpuix-solid2-aria-components/PORTING.md) records supported behavior and backend accessibility gaps.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

To type check:

```bash
bun check
```

Run `bun fmt` to format the code.

This project was created using `bun init` in bun v1.4.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
