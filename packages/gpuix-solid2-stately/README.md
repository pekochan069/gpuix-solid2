# gpuix-solid2-stately

Solid 2 state for native applications and GPUIX Aria components. State runs in Bun without a browser or a renderer. The package reuses the pinned Solid2 Aria implementations with native locale, geometry, and type adaptations.

## Use state in a native application

```ts
import { createToggleState } from "gpuix-solid2-stately";
import { createRoot, flush } from "solid-js";

createRoot((dispose) => {
  const toggle = createToggleState({ defaultSelected: false });
  toggle.toggle();
  flush();
  console.log(toggle.isSelected); // true
  dispose();
});
```

Use the application's Solid 2 client runtime. GPUIX applications already select it through `gpuix-solid2/preload`. A state-only Bun application can select it with `bun --conditions=browser app.ts`. That resolution condition selects Solid's client graph and does not install or load a web renderer. Do not mix Solid's server and client graphs in one application.

Create state inside a Solid owner and dispose that owner when its native view is removed. Tooltip timers, owned toast queues, effects, and async-list requests follow the owner. An externally constructed `ToastQueue` remains caller-owned. Solid queues writes; call `flush()` before reading results synchronously.

Root exports mirror `@solid2-aria/stately` and also include `createControlledSignal`. Module subpaths are available, for example:

```ts
import type { NativeTarget } from "gpuix-solid2-stately/native-platform";
import type { Key, Collection } from "gpuix-solid2-stately/shared-types";
import { createToggleState } from "gpuix-solid2-stately/toggle/create-toggle-state";
```

The complete module audit and native contracts are in [PORTING.md](./PORTING.md).

## Supply the native locale and geometry

Number fields, calendar states, and segmented date and time fields take `locale`. Date and date-range picker state also accept `locale` for validation messages, with a deterministic `en-US` default. Locale props can be reactive getters. Date utility functions accept `FormatterOptions.locale`.

```ts
import { CalendarDate } from "@internationalized/date";
import { createDatePickerState } from "gpuix-solid2-stately";

const picker = createDatePickerState({
  locale: "ko-KR",
  defaultValue: new CalendarDate(2026, 10, 30),
});
```

Create the picker inside your native view's Solid owner. Validation uses the supplied locale and packaged translations. It does not consult browser language settings or window-scoped translation dictionaries.

Virtualizers require `initialVisibleRect`. Supply subsequent viewport changes through `setVisibleRect`. The layout size follows the viewport by default. For a layout area larger than the visible viewport, pass `sizeMode: "explicit"` and `initialSize`, then call `setSize` when the native layout area changes. The host supplies measured item sizes, scrolling state, and rendering callbacks.

## Develop and verify

From the repository root, run `bun install`, then:

```sh
cd packages/gpuix-solid2-stately
bun run build
bun run check-types
bun run test
bun run check:native
```

`check:native` installs the packed artifact in a temporary Bun consumer. It imports every runtime module with browser globals removed, checks every declaration without `lib.dom`, and runs the behavior suite with browser access trapped. It also verifies that web renderers and upstream build dependencies are absent and that license texts survive packing.

The build uses the published upstream packages as pinned development inputs. Consumers need only the internationalization libraries and their own `solid-js` peer. Generated files live in `dist`; edit the build adaptations rather than generated output. Exact patch assertions reject upstream changes that need a new audit.
