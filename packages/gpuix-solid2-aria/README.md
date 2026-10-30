# gpuix-solid2-aria

Native interaction behaviors for the Solid 2 GPUIX renderer. This is the native behavior subset of [issue #2](https://github.com/pekochan069/gpuix-solid2/issues/2). It covers buttons, toggles, checkboxes, switches, radio groups, text fields, linear listboxes, focus, and overlay foundations. It does not provide full `@solid2-aria/core` parity or complete native accessibility. See [coverage and platform gaps](PORTING.md).

## Render a native checkbox

Use the application's Solid client runtime through the renderer preload. Do not enable the global `browser` condition: that selects GPUIX's web backend.

```toml
# bunfig.toml
preload = ["gpuix-solid2/preload"]
```

```tsx
import { render } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createCheckbox } from "gpuix-solid2-aria";
import { createToggleState } from "gpuix-solid2-stately";

function Checkbox() {
  let element: HostElement | null = null;
  const state = createToggleState();
  const behavior = createCheckbox(
    { "aria-label": "Accept terms" },
    state,
    () => element
  );
  return (
    <div
      {...behavior.inputProps}
      ref={(node) => {
        element = node;
      }}
    >
      {behavior.isSelected ? "Accepted" : "Accept terms"}
    </div>
  );
}

render(() => <Checkbox />);
```

Set `jsxImportSource` to `gpuix-solid2`. Use a native `div` for a checkbox surface; GPUIX's `input` is a text editor. `inputProps` retains the source behavior's naming.

Behavior props use reactive property getters. Keep the returned object intact; destructuring a state getter takes a snapshot. Compose callbacks explicitly when behaviors handle the same event. Solid's `merge` overwrites a duplicate handler; it does not chain handlers.

`createButton`, `createToggleButton`, `createCheckbox`, `createSwitch`, and `createPress` take a `() => HostElement | null` ref. `createToggleButton`, `createCheckbox`, and `createSwitch` also take `ToggleState` from `gpuix-solid2-stately`. `createTextField` returns native editor `inputProps` and `value`. Controlled inputs report change requests. Rejected edits require a native editor reset contract that GPUIX 0.11.0 does not expose; see the porting audit before using this pattern for input validation.

## Radio groups

Call `createRadioGroup(props, state, ref)` before `createRadio(props, state, ref)` for each option. Both use the same `RadioGroupState` from `gpuix-solid2-stately`. Spread `radioGroupProps` onto the containing native `div` and each radio's `inputProps` onto a native descendant. Radio values must be unique within the group. Mounted options register and dispose with their owners.

Selection, disabled and readonly guards, one Tab stop, wrapping arrow navigation, and horizontal RTL are supported. The [RadioGroup contract](PORTING.md#radiogroup-stage) defines fallback focus and remaining native accessibility gaps. Applications can use `RadioGroup` and `Radio` from `gpuix-solid2-aria-components` for component composition.

## Focus, collections, and overlays

Call hooks inside a rendered owner. `createNativeServices` supplies native focus, bounds, scrolling, and owned event subscriptions. `createFocusScope(options, ref)` returns `scopeProps` for a containing surface and a native focus manager. Its options enable Tab containment, initial focus, and restoration.

`createListBox(options, state, getItem)` and `createOption({ key }, state, ref)` use `ListState` from `gpuix-solid2-stately`. Register rendered elements in a key-to-element map. Lists use real native focus and roving Tab stops. Arrow keys, Home, End, Space, and single-character search operate on enabled items. `ListKeyboardDelegate` supports linear vertical and horizontal collections, including RTL. Spatial grids and multi-character typeahead are deferred.

`createNativeLayoutDelegate` accepts a container ref, an item lookup, and a content-size callback. GPUI supplies window bounds and negative native scroll offsets. The adapter returns positive collection scroll coordinates. The layout owner supplies content size because GPUIX has no DOM-style `scrollWidth` or `scrollHeight`.

`createOverlay(options, ref)` registers an open surface with the native dismissal stack. Its `overlayProps` handle top-layer outside dismissal and modal Tab containment. Outside dismissal runs on the next task so one native gesture cannot dismiss both a child and its parent. Escape and focus restoration use the renderer's stack. Render nested surfaces within their parent's native subtree. `createOverlayPosition(options).overlayProps` belongs on a native `anchored` element; GPUI owns placement and collision handling.

`I18nProvider` takes an explicit reactive locale. The default is `en-US`; locale code does not read `navigator`. Formatter methods and filters follow provider changes.

## Verify the package

Build the renderer and state package first, then run these commands in this package:

```bash
bun run build
bun run check-types
bun run test
bun run check:native
```

`check:native` packs and installs all three native packages into an isolated consumer, checks declarations without `lib.dom`, compiles the consumer with the Solid client runtime, runs it in Bun, and compares packaged licenses. Application builds must bundle Solid and its subpaths consistently. The script contains a working tsdown configuration.

In a graphical session, run `bun run test:native`. It drives the real GPUI renderer through native mouse and key simulation. On a bare Xvfb session, set `GPUIX_ARIA_XDOTOOL` to an `xdotool` executable so the fixture can focus its window. Set `GPUIX_ARIA_INSPECT=1` to retain the window for 60 seconds. With an enabled AT-SPI bus and `python3-dbus`, run `python3 scripts/check-atspi.py` during that interval. It verifies OS click actions and records backend state gaps. [Observed accessibility results](docs/native-accessibility.json) came from this session.
