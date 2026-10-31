# gpuix-solid2-aria

Native interaction behaviors for the Solid 2 GPUIX renderer. This is the native behavior subset of [issue #2](https://github.com/pekochan069/gpuix-solid2/issues/2). It covers buttons, disclosures, tabs, toggles, toggle button groups, checkboxes, checkbox groups, switches, radio groups, text, search and number fields, menus, linear listboxes, focus, and overlay foundations. It does not provide full `@solid2-aria/core` parity or complete native accessibility. See [coverage and platform gaps](PORTING.md).

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

## Search fields

Use `createSearchField(props, state, inputRef)` from `gpuix-solid2-aria/search-field` with `SearchFieldState` from `gpuix-solid2-stately`. Spread `inputProps` onto a native `input`. Pass `clearButtonProps` to `createButton`, then spread that button's `buttonProps` onto a native `div`.

```ts
const state = createSearchFieldState({ defaultValue: "query" });
const search = createSearchField(
  { "aria-label": "Search documents", onSubmit: searchDocuments },
  state,
  () => inputElement
);
const clear = createButton(search.clearButtonProps, () => clearElement);
```

State owns `value`, `defaultValue`, and `onChange`. The behavior owns `onSubmit` and `onClear`. Native editor submit invokes `onSubmit` once per Enter. Escape requests an empty value and consumes overlay dismissal while the state is nonempty. An empty field leaves Escape to its parent. `onKeyDown` receives normalized keys and can prevent the clear action. Mouse clear focuses the editor on press-start and clears on click. The clear button stays outside Tab order. Disabled and readonly fields reject edits, clear, and submit. Readonly editors remain in Tab order.

Controlled parents can reject requests. The native editor rollback limitation documented above still applies. Set a reactive `clearButtonLabel` for application-localized text; its default is `"Clear search"`. Widget dictionaries, form validation, label and error relationships, password editing, and component wrappers remain deferred. The backend exposes the search editor as a generic entry. See the [SearchField contract and native evidence](PORTING.md#searchfield-stage).

## Disclosures

Use `createDisclosure(props, state, triggerRef)` from `gpuix-solid2-aria/disclosure` with `DisclosureState` from `gpuix-solid2-stately`. Spread `buttonProps` onto the trigger and use `Show` to mount the panel only while expanded. Collapsed content must unmount so its children leave native Tab traversal and the OS accessibility tree.

```tsx
import type { HostElement } from "gpuix-solid2";
import { createDisclosure } from "gpuix-solid2-aria";
import { createDisclosureState } from "gpuix-solid2-stately";
import { Show } from "solid-js";

function Details() {
  let trigger: HostElement | null = null;
  const state = createDisclosureState({});
  const behavior = createDisclosure(
    { "aria-label": "Details" },
    state,
    () => trigger
  );
  return (
    <>
      <div
        {...behavior.buttonProps}
        ref={(node) => {
          trigger = node;
        }}
      >
        Details
      </div>
      <Show when={behavior.isExpanded}>
        {() => (
          <div {...behavior.panelProps} aria-label="Detail panel">
            Panel content
          </div>
        )}
      </Show>
    </>
  );
}
```

Enter and Space toggle on key-down. Mouse and OS Click toggle through state, including controlled parents that reject requests. Disabled triggers reject activation and are skipped by Tab. Panel contents are recreated after collapse. Supply direct labels for the trigger and panel. The published backend omits expanded state and relationships in the observed OS tree. See the [Disclosure contract and evidence](PORTING.md#disclosure-stage).

## Number fields

Use `createNumberField(props, state, inputRef)` from `gpuix-solid2-aria/number-field` with `createNumberFieldState` from `gpuix-solid2-stately`. State owns numeric values, locale, formatting, bounds, step, validation, and `onChange` requests. Spread `inputProps` onto a native `input`. Pass `incrementButtonProps` and `decrementButtonProps` to `createButton`, then spread each button's `buttonProps` onto a native `div`.

```ts
const state = createNumberFieldState({
  defaultValue: 1.5,
  locale: "de-DE",
  minValue: 0,
  maxValue: 10,
  step: 0.5,
});
const field = createNumberField({ "aria-label": "Amount" }, state, () => input);
const increase = createButton(
  field.incrementButtonProps,
  () => increaseElement
);
const decrease = createButton(
  field.decrementButtonProps,
  () => decreaseElement
);
```

Editing updates the state's draft text. Enter submit and blur commit it through the locale parser. Native text may contain incomplete or invalid numbers until commit. State restores invalid text to the prior committed number, clamps and snaps valid values by default, and commits empty text as `NaN`. Up and Down step the value. Page Up and Page Down each step once, including keyboard repeats. Home, End, Left, and Right preserve native caret movement. GPUIX consumes Home and End before JavaScript, so this subset does not use them to jump to numeric bounds.

Step buttons stay outside Tab order and mouse press keeps editor focus. Disabled editors leave Tab order; readonly editors remain focusable. Both guards block editing, commit, and stepping. Supply reactive flags to the behavior and state when both use them. Controlled state accepts draft editing, requests a numeric change on commit or step, and restores committed text when the parent rejects a step. Applications localize `incrementButtonLabel` and `decrementButtonLabel`, which default to `Increase value` and `Decrease value`.

The behavior exposes `isInvalid`, `validationErrors`, and `validationDetails` from state's displayed validation. Submit and blur publish validation for unchanged and empty drafts too. It does not add browser constraint validation, forms, label relationships, wheel stepping, press-and-hold timers, announcements, or native numeric accessibility actions. The published backend exposes a generic editor entry and drops numeric range semantics. See the [NumberField contract and native evidence](PORTING.md#numberfield-stage).

## Menus

Call `createMenu(props, state, menuRef)` before `createMenuItem({ key, ...props }, state, itemRef)` from `gpuix-solid2-aria/menu`. Use one `TreeState` from `createTreeState` in `gpuix-solid2-stately` per menu. Spread `menuProps` onto its container and `menuItemProps` onto native `div` items inside it. Each item needs a unique collection key. Render items in collection order. State owns selection mode, controlled selection, disabled keys, and selection requests. The default mode is `"none"` for action menus. `"single"` and `"multiple"` expose radio and checkbox menu items.

Up and Down move focus and wrap by default, skipping disabled items. Set `shouldFocusWrap` to `false` to stop at the ends. Home and End move to the first and last enabled items. Single-character search uses the current locale. Navigation and mouse hover do not select. Enter and Space activate on key-down. Mouse click and OS Click also select and invoke `onAction(key, value)`. The value is the collection's data object, or `null` for static descriptors. Controlled parents can accept or reject selection requests.

Action menus close after activation. Selectable menus close on Enter. Mouse and OS Click close single-selection menus and keep multiple-selection menus open. Space keeps selectable menus open. An item's `shouldCloseOnSelect` overrides these defaults. `onClose` requests closure; the application owns open state and mounting. `autoFocus` accepts `true`, `"first"`, or `"last"`, preferring an enabled selected item before its first or last fallback.

Compose popup dismissal with `createOverlay`, and explicitly chain shared handlers. `merge` alone overwrites handlers such as `onKeyDown`. The [native fixture](fixtures/menu-native.ts) composes a modal overlay with containment, Escape and outside dismissal, unmounting, and restoration to its trigger. Menu behavior leaves Escape and Tab to the containing overlay or application. Submenus, sections, multi-character search, links, drag-across activation, virtual focus, and component wrappers remain deferred. Supply direct labels and descriptions. The backend omits checked and disabled states and relationships in the observed OS tree. See the [Menu contract and native evidence](PORTING.md#menu-stage).

## Menu triggers

Use `createMenuTrigger(props, state, triggerRef)` from `gpuix-solid2-aria/menu-trigger` with `createMenuTriggerState` from `gpuix-solid2-stately`. Spread its `menuTriggerProps` directly onto a native `div`. The trigger already composes native button behavior. Pass its `menuProps` to `createMenu`, using a separate `TreeState` for the menu items.

```ts
const state = createMenuTriggerState({});
const trigger = createMenuTrigger(
  { "aria-label": "Actions" },
  state,
  () => triggerElement
);
// Inside the conditionally mounted menu's owner:
const menu = createMenu(trigger.menuProps, treeState, () => menuElement);
```

Mount the menu and its items only while `state.isOpen` is true. Compose it with `createOverlay` using `state.close` and the same trigger ref for dismissal and restoration. Explicitly chain the menu and overlay key handlers. The [complete native fixture](fixtures/menu-trigger-native.ts) demonstrates this composition.

Enter, Space, and Down request opening with first-item focus on key-down. Up requests last-item focus. Alt with Up or Down also works. An enabled selected item takes precedence over either endpoint. Repeats and modified shortcuts other than Alt arrows do not open. Mouse-down opens before release; OS Click opens with first-item focus. Keyboard activation toggles an already open menu. Disabled triggers reject every activation path and leave Tab order. Controlled parents may accept or reject open and close requests.

The menu inherits the trigger's direct label unless you override it. Semantic props include expanded state, popup type, IDs, and relationships, but the published backend omits expanded state and relationships from the observed OS tree. Long-press, context-menu mode, alternate popup types, submenus, and component wrappers remain deferred. See the [MenuTrigger contract and evidence](PORTING.md#menutrigger-stage).

## Tabs

Call `createTabList(props, state, ref)` before `createTab({ key, ...props }, state, ref)` and `createTabPanel(props, state)` from `gpuix-solid2-aria/tabs`. Use one `TabListState` from `gpuix-solid2-stately` per list. Spread `tabListProps` onto the list container, `tabProps` onto each native tab, and `tabPanelProps` onto its panel. Tab keys are unique string or number collection keys. Render the tabs in collection order within the list container.

Arrows wrap and skip disabled tabs. Left and Right follow locale direction; vertical lists also handle Up and Down. Home and End move to the first and last enabled tabs. Arrows select automatically unless `keyboardActivation` is `"manual"`, which changes only focus until Enter or Space selects. Mouse-down and keyboard-down select once; OS Click uses the same state request path. Controlled parents may reject requests. Group, collection, and local disabled guards combine.

Mount only the selected panel. Use a keyed `For` over `state.selectedKey === null ? [] : [state.selectedKey]` to recreate the panel and its local state on selection changes, including numeric key `0`. The panel's optional `id` is its collection key and defaults to the selected key. Its default `tabIndex` is `0`; set it to `-1` when the panel contains its own Tab stops. Tabbable-child detection, retained inactive panels, and browser links are outside this native subset. Supply direct labels because the backend does not expose relationships. See the [native fixture](fixtures/tabs-native.ts) and [Tabs contract and evidence](PORTING.md#tabs-stage).

## Checkbox groups

Use `createCheckboxGroup(props, state)` and `createCheckboxGroupItem(props, state, ref)` from `gpuix-solid2-aria/checkbox-group` with one `CheckboxGroupState` from `gpuix-solid2-stately`. Spread `groupProps` onto the containing native `div` and each item's `inputProps` onto a native checkbox surface. Give each item a unique string `value` and a direct `aria-label`.

```ts
const state = createCheckboxGroupState({ defaultValue: ["news"] });
const group = createCheckboxGroup({ "aria-label": "Topics" }, state);
const news = createCheckboxGroupItem(
  { value: "news", "aria-label": "News" },
  state,
  () => newsElement
);
```

Space and mouse activation toggle only that item's value. Each enabled item has its own Tab stop. Enter and arrow keys do not select items. Group disabled and readonly state applies to all items, including items that explicitly pass `false`; readonly items remain focusable. Item `onChange` receives the requested boolean after the group's selection request. Controlled groups follow the parent's `value`, including rejected requests. Keep reactive props as getters when calling these functions directly.

The group exposes `isInvalid`, `validationErrors`, and `validationDetails` from state. Item invalid state combines group and item flags. Group required state applies while the selection is empty, unless an item supplies its own `isRequired`. Group focus-within, label relationships, per-item validation aggregation, and native forms remain deferred. See the [CheckboxGroup contract and native evidence](PORTING.md#checkboxgroup-stage).

## Toggle button groups

Call `createToggleButtonGroup(props, state, ref)` before `createToggleButtonGroupItem(props, state, ref)` for each item. Both are exported from `gpuix-solid2-aria/toggle-button-group` and use one `ToggleGroupState` from `gpuix-solid2-stately`. Spread `groupProps` onto the containing native `div` and each item's `buttonProps` onto a native descendant. Give each item a unique string or number `id` and a direct `aria-label`. The item `id` identifies its selection key; it is not a native element ID.

```ts
const state = createToggleGroupState({ defaultSelectedKeys: ["left"] });
const group = createToggleButtonGroup(
  { "aria-label": "Alignment" },
  state,
  () => groupElement
);
const left = createToggleButtonGroupItem(
  { id: "left", "aria-label": "Left" },
  state,
  () => leftElement
);
```

Single selection uses `radiogroup` and `radio` roles. Multiple selection uses `toolbar` and `button` roles with pressed state. Enter, Space release, mouse click, and accessibility Click toggle selection through state. `disallowEmptySelection` prevents clearing the last selection. Controlled requests follow the parent, including rejected requests.

The group has one Tab stop, initially its first enabled item. Arrows move focus without selecting, stop at the ends, and skip disabled items. Horizontal groups use Left and Right with locale direction; vertical groups use Up and Down. Tab leaves the group and reentry returns to its last focused enabled item. Group and item disabled guards combine. Item readonly blocks selection while keeping focus. Mounted items register and unregister with their owners. Nested toolbars and arbitrary focusable children are outside this subset. See the [contract and native evidence](PORTING.md#togglebuttongroup-stage).

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

Run `bun run test:native:checkbox-group` for checkbox-group mouse, keyboard, controlled state, and native Tab checks. For OS checks, run it with `GPUIX_ARIA_INSPECT=1`, then run `python3 scripts/check-checkbox-group-atspi.py` during its inspection interval with `python3-dbus` and `AT_SPI_BUS_ADDRESS`. Set `GPUIX_ARIA_AUDIT_OUTPUT` to write the results to JSON. The checker acts only on the named verification window; the fixture asserts the resulting Solid state before exiting.

Run `bun run test:native:toggle-button-group` for single and multiple selection, native Tab exit and reentry, arrow focus, orientation, RTL, and controlled rejection. For OS checks, run it with `GPUIX_ARIA_INSPECT=1`, then run `python3 scripts/check-toggle-button-group-atspi.py` during its inspection interval using the same AT-SPI environment. Set `GPUIX_ARIA_AUDIT_OUTPUT` to record the audit. The fixture verifies that OS actions changed both groups' Solid state before exiting.

Run `bun run test:native:disclosure` for expansion, native Tab traversal, panel unmounting, controlled rejection, and disabled guards. With `GPUIX_ARIA_INSPECT=1`, run `python3 scripts/check-disclosure-atspi.py` during the inspection interval in the same AT-SPI environment. Set `GPUIX_ARIA_AUDIT_OUTPUT` to record the audit. The checker expands and collapses the panel through OS Click, checks its presence in the OS tree, and records the missing expanded state and relationships.

Run `bun run test:native:tabs` for automatic and manual activation, wrapping, disabled skipping, RTL, orientation, native Tab traversal, conditional panels, and controlled rejection. With `GPUIX_ARIA_INSPECT=1`, run `python3 scripts/check-tabs-atspi.py` during its inspection interval in the same AT-SPI environment. Set `GPUIX_ARIA_AUDIT_OUTPUT` to record the audit. The checker changes selection through OS Click, verifies inactive panels leave the OS tree, and records selected state, roles, and missing relationships.

Run `bun run test:native:search-field` in a Wayland session for native editing, Enter submit, Escape dismissal ordering, mouse clear, focus retention, Tab traversal, controlled rejection, and guards. For the X11 OS audit, set both `GPUIX_ARIA_INSPECT_ONLY=1` and `GPUIX_ARIA_INSPECT=1`, then run `python3 scripts/check-search-field-atspi.py` in the same AT-SPI environment. Inspect-only mode skips the keyboard proof and retains the window for OS actions and screenshots. Set `GPUIX_ARIA_AUDIT_OUTPUT` to record the audit. The fixture checks that OS Click cleared the controlled query and preserved disabled and readonly values before it exits. X11 keyboard injection was inconsistent in this session; the passing keyboard proof used Wayland.

Run `bun run test:native:number-field` in a Wayland session for locale formatting, arrow and page stepping, bounds, native editing, submit and blur commits, focus, Tab traversal, controlled requests, and guards. For the X11 OS audit, set both inspection flags above and run `python3 scripts/check-number-field-atspi.py` in the same AT-SPI environment. It checks OS Click on both step buttons and records missing numeric values and relationships. Set `GPUIX_ARIA_AUDIT_OUTPUT` to write the audit. The fixture verifies that OS Click changed controlled number state and preserved disabled and readonly values before it exits.

Run `bun run test:native:menu` in a Wayland session for navigation, selection, controlled requests, mouse hit testing, disabled guards, Tab traversal, and overlay dismissal and restoration. For the X11 OS audit, set both inspection flags above and run `python3 scripts/check-menu-atspi.py` in the same AT-SPI environment. It checks OS Click selection and action-menu unmounting, and records roles, names, missing checked state, and disabled items reported enabled. Set `GPUIX_ARIA_AUDIT_OUTPUT` to write the audit. The fixture verifies the resulting Solid selection and action callback before exiting.

Run `bun run test:native:menu-trigger` in a Wayland session for opening keys, initial focus, mouse hit testing, disabled Tab traversal, controlled rejection, dismissal, and restoration. For the X11 OS audit, set both inspection flags and run `python3 scripts/check-menu-trigger-atspi.py` in the same AT-SPI environment. It verifies OS Click opening, activation, unmounting, disabled guards, and reopening. Set `GPUIX_ARIA_AUDIT_OUTPUT` to record the audit. The fixture checks the resulting action, open state, and focus before exiting.
