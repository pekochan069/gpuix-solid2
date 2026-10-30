# Solid 2 port

Source: remorses/gpuix `packages/solid`, commit `a53b294401280014e94eb9bd98a7c7ed1929f92d` (Apache-2.0).

Plan: inspect the native contract and Solid 2 semantics; compare renderer boundaries; implement the port; verify compiled consumers and native behavior.

The public usage remains `render(() => <App />, options)`, with `createRoot` for injected renderers. Components and native properties retain the upstream API. JSX belongs to this renderer (`jsxImportSource: "gpuix-solid2"`).

The selected design keeps upstream host nodes, mutation batching, root events, primitives, and controls. The alternative uses the official Solid 2 universal renderer to own insertion and disposal. Synthesis: retain the native adapter and use the official universal renderer, avoiding a second reconciliation implementation. Export the compiler's ref/applyRef and split-effect helpers. Both candidates agreed on this boundary. Other model families were unavailable, so the two candidates used the current model; no independent cross-judge ran.

Each root owns its native events and reactive lifetime. The application-level render helper alone retains a window for hot reload. Updates flow from an event through Solid's commit, host mutations, and the native batch in that order. Subscriptions start with onSettled and return their disposal callback. Optional contexts use null; required contexts rely on Solid's missing-provider error.

Each root uses one full-window flex column to support fragments with GPUIX's single root ID. Dismissable layers flush native creation mutations before moving focus.

Verification covers type checking, lint, compiled consumer execution, and the real Solid development runtime against a mutation recorder. Native offscreen rendering is conditional on a test-support binary and is reported as skipped when unavailable.
