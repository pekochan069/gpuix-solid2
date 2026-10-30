# gpuix-solid2

A Solid.js 2 renderer for [GPUIX](https://github.com/remorses/gpuix), ported from [`@gpuix/solid`](https://github.com/remorses/gpuix/tree/main/packages/solid). Uses Solid ^2.0.0-rc.17 and `@gpuix/native` 0.11.0.

## Run a native app with Bun

Build the package from this directory:

```sh
bun install
bun run build
```

In a consuming app, install `gpuix-solid2`, `solid-js@next`, and `@gpuix/native@0.11.0`. Add the package preload to `bunfig.toml`:

```toml
preload = ["gpuix-solid2/preload"]
```

Configure TypeScript for this native renderer:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "gpuix-solid2",
    "moduleResolution": "bundler"
  }
}
```

Create `main.tsx`:

```tsx
import { Button, render } from "gpuix-solid2";
import { createSignal } from "solid-js";

function App() {
  const [count, setCount] = createSignal(0);
  return (
    <div style={{ padding: 24 }}>
      <Button
        onClick={() => {
          setCount((value) => value + 1);
        }}
      >
        <text>Count: {count()}</text>
      </Button>
    </div>
  );
}

render(() => <App />, { title: "Solid 2 GPUIX", width: 640, height: 480 });
```

Run `bun main.tsx`. From this package, run `bun examples/counter.tsx` after the build. GPUIX requires its platform libraries and a graphical session.

The preload compiles native JSX with `@solidjs/compiler` and selects Solid's client runtime for Bun. Set `NODE_ENV=production` for the production runtime. Use one installed copy of `solid-js` throughout the app.

For tsdown, use the universal compiler with `moduleName: "gpuix-solid2"`, `builtIns: []`, and the client export conditions. See the runnable [consumer config](fixtures/consumer/tsdown.config.ts).

## Use the renderer API

`render(() => <App />, options)` creates a window and retains it across hot reloads. `resetRender()` disposes its root and stops its frame loop.

For an existing native renderer, use `createRoot(renderer, handlers)`:

```tsx
const root = createRoot(renderer);
root.render(() => <App />);
root.flushSync(() => {
  setCount(2);
});
root.unmount();
```

`flush`, `flushSync`, and native event dispatch commit Solid updates before flushing native mutations. Ordinary signal updates commit on the next microtask. A root owns a full-window flex column containing its top-level children, so fragments and conditional roots share one native root ID.

GPUIX owns the intrinsic elements and their properties. Use native properties such as `tabIndex`, `autoFocus`, `testId`, and object `style`, as defined by `@gpuix/native/host`. `@solidjs/web` JSX types describe DOM elements and do not apply here. Refs accept callbacks and arrays of callbacks.

The port includes the upstream APIs:

- Intrinsics: `div`, `text`, `img`, `svg`, `canvas`, `input`, `textarea`, `anchored`, `code`, `diff`, `markdown`, and `virtual-list`.
- Controls: Button, Select, Combobox, Dialog, Tooltip, and their parts.
- Motion: `motion.div`, `AnimatePresence`, `usePresence`, and `useIsPresent`.
- Native state: `createWindowSize`, `createWindowInsets`, `createSelectedText`, `createTextSearch`, and `GpuixContext`.
- Entry points: `/button`, `/select`, `/combobox`, `/dialog`, `/tooltip`, `/floating`, `/testing`, `/automation`, `/bun-plugin`, and `/preload`.

Native subscriptions use `onSettled` and dispose with their component. Required contexts use Solid 2's missing-provider errors. Compiler helpers named `mergeProps` remain part of the compiler ABI; application code uses Solid's `merge` and `omit`.

## Check the port

```sh
bun run build
bun run check-types
bun run check
bun test
bun run build:consumer
```

The tests compile TSX with the Solid 2 compiler and execute the development runtime against a native mutation recorder. The offscreen native test runs when the installed GPUIX binary includes `test-support`; otherwise Bun reports it as skipped. The recorder verifies framework integration, without measuring native layout or painting.

Port decisions and source provenance are recorded in [PORTING.md](docs/PORTING.md). The upstream Apache-2.0 license is included in [LICENSES/LICENSE-gpuix](LICENSES/LICENSE-gpuix).
