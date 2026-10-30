# gpuix-solid2-aria-components

Native Solid 2 `Button`, `ToggleButton`, `Checkbox`, `RadioGroup`, and `Radio` components for GPUIX. This implements a subset of [issue #3](https://github.com/pekochan069/gpuix-solid2/issues/3).

GPUIX 0.11.0 exposes names, roles, and Click actions, but omits control states such as checked, pressed, and disabled. This package does not provide complete native accessibility. See the [porting audit](PORTING.md) before using these controls with assistive technology.

## Render native controls

Set `jsxImportSource` to `gpuix-solid2` and enable the renderer's Bun preload:

```toml
preload = ["gpuix-solid2/preload"]
```

```tsx
import { render } from "gpuix-solid2";
import { Button, Checkbox, ToggleButton } from "gpuix-solid2-aria-components";
import { createSignal } from "solid-js";

function App() {
  const [accepted, setAccepted] = createSignal(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Button aria-label="Save" onPress={() => save()}>
        Save
      </Button>
      <ToggleButton aria-label="Bold" defaultSelected>
        {(state) => (state.isSelected ? "Bold on" : "Bold off")}
      </ToggleButton>
      <Checkbox
        aria-label="Accept terms"
        isSelected={accepted()}
        onChange={(value) => {
          setAccepted(value);
        }}
        style={(state) => ({ opacity: state.isDisabled ? 0.5 : 1 })}
      >
        {(state) =>
          state.isSelected ? "[x] Accept terms" : "[ ] Accept terms"
        }
      </Checkbox>
    </div>
  );
}

function save() {
  // Save application data here.
}

render(() => <App />);
```

Pass signal values at JSX boundaries, as in `isSelected={accepted()}`. Read properties from the render-state object without destructuring them. Supply direct `aria-label` and `aria-description` strings for native accessible names and descriptions.

Use GPUIX `StyleDesc` objects or style callbacks. Numeric lengths use native pixel units. CSS strings, classes, browser attributes, DOM refs, and DOM render overrides are outside this subset. Every selectable control renders one focusable native `div`; a checkbox does not create a native text editor or hidden HTML input.

For compiled applications, transform JSX with `@solidjs/compiler` using `generate: "universal"` and `moduleName: "gpuix-solid2"`. Bundle `solid-js` and its subpaths consistently into one client runtime. Keep GPUIX on its native exports instead of enabling a global `browser` condition. The [packed-consumer check](scripts/check-native.ts) provides a working build configuration.

## Select one radio option

```tsx
import { Radio, RadioGroup } from "gpuix-solid2-aria-components/radio-group";

<RadioGroup
  aria-label="Shipping"
  defaultValue="standard"
  onChange={saveShipping}
>
  <Radio value="standard" aria-label="Standard">
    {(state) => (state.isSelected ? "(o) Standard" : "( ) Standard")}
  </Radio>
  <Radio value="express" aria-label="Express">
    Express
  </Radio>
  <Radio value="pickup" aria-label="Pickup" isDisabled>
    Pickup unavailable
  </Radio>
</RadioGroup>;
```

Use `value={shipping()}` and `onChange={setShipping}` for controlled selection. `value={null}` clears it. Changes to `defaultValue` do not reset an existing group. Values must be unique within the group. Arrow keys wrap, skip disabled options, and select the focused option; horizontal groups reverse Left and Right under an RTL `I18nProvider`. Tab enters and leaves through one enabled option. Space selects; Enter does not.

`isDisabled` on the group disables all options. `isReadOnly` preserves selection while allowing focus navigation. `isRequired` and `isInvalid` expose application state without validating it. `orientation` describes navigation; arrange controls with native styles. Group render callbacks receive `state` and group flags. Radio callbacks receive selection, press, hover, focus, disabled, readonly, required, and invalid flags. `RadioGroupStateContext` exposes the group state to descendants through `useContext`.

`RadioGroup` renders a native container and `Radio` renders one native control. Supply direct accessible names on the group and each radio. Native label relationships, split fields, form submission and reset, and group focus-within callbacks are deferred. See the [RadioGroup audit](PORTING.md#radiogroup-verification) for observed OS limitations.

## Compose context defaults

```tsx
import {
  Button,
  ButtonContext,
  DEFAULT_SLOT,
} from "gpuix-solid2-aria-components";

<ButtonContext
  value={{
    slots: {
      [DEFAULT_SLOT]: { "aria-label": "Default action" },
      save: { "aria-label": "Save", isDisabled: false },
    },
  }}
>
  <Button slot="save">Save</Button>
  <Button>Default action</Button>
  <Button slot={null} aria-label="Independent action">
    Independent action
  </Button>
</ButtonContext>;
```

`ButtonContext`, `ToggleButtonContext`, `CheckboxContext`, `RadioGroupContext`, and `RadioContext` accept plain defaults or a `slots` map. Local props override defaults, including explicit `undefined`. Event callbacks run in context-first order, followed by local callbacks. Both context and local callback refs attach to the native `HostElement`. Refs can also be arrays of callbacks. Checkbox's `ref` and `inputRef` refer to the same element.

Choose a slot when the component mounts. `DEFAULT_SLOT` supplies unnamed defaults, and `slot={null}` opts out of context. An unknown slot throws. Defaults at the selected slot remain reactive. Ref callbacks run when the element attaches, following the renderer's ref contract.

## Verify this stage

Build the renderer, state, and behavior packages in order before checking this package. Run from the repository root:

```bash
bun run --cwd packages/gpuix-solid2 build
bun run --cwd packages/gpuix-solid2-stately build
bun run --cwd packages/gpuix-solid2-aria build
bun run --cwd packages/gpuix-solid2-aria-components build
bun run --cwd packages/gpuix-solid2-aria-components check-types
bun run --cwd packages/gpuix-solid2-aria-components test
bun run --cwd packages/gpuix-solid2-aria-components check:native
bunx ultracite check packages/gpuix-solid2-aria-components
```

`check:native` packs all four native packages, checks every component declaration without `lib.dom`, and compiles and runs a native JSX consumer. It also checks packaged licenses and source notices. Do not run the state build alongside consumers or tests because it replaces `dist`.

In a graphical session, run `bun run test:native` inside this package. On bare Xvfb, set `GPUIX_ARIA_XDOTOOL` to an `xdotool` executable so the fixture can focus its window.

To inspect accessibility, enable the AT-SPI bus and its screen-reader flag, then run `GPUIX_ARIA_INSPECT=1 bun run test:native`. During its inspection interval, run `python3 scripts/check-atspi.py` with `python3-dbus` and `AT_SPI_BUS_ADDRESS`. The fixture verifies that OS actions update Solid state before exiting. `GPUIX_ARIA_AUDIT_OUTPUT` optionally selects the JSON output file. The checker acts only on the named verification window.

Run `bun run test:native:radio` in a graphical session to verify RadioGroup. For OS checks, run `GPUIX_ARIA_INSPECT=1 bun run test:native:radio`, then `python3 scripts/check-radio-atspi.py` during its inspection interval. The same AT-SPI setup and `GPUIX_ARIA_AUDIT_OUTPUT` option apply. The fixture checks OS selection and readonly guards before exiting.
