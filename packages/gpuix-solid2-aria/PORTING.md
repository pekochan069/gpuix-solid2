# Native behavior coverage

Source audit: [solid2-aria revision 4bb0e1f](https://github.com/pekochan069/solid2-aria/tree/4bb0e1f8c918e63c045c28d995d51dd1cf9a83b1/packages/solid2-aria). [native-coverage.json](native-coverage.json) inventories all 156 root runtime exports and all 256 public source module paths. Each root export is classified as a native subset or deferred. Type-only exports are not counted as behaviors. Regenerate it with `bun scripts/inventory.ts /path/to/solid2-aria`; append `--check` to compare without writing.

This stage adds a native API with GPUIX event and element types. It is not a drop-in build of the web package. Only the native entry points emitted from `src` are exported. Source web subpaths, DOM refs, browser form attributes, and web portals are not exposed.

## Implemented native subsets

| Source family | Native behavior | Limits |
| --- | --- | --- |
| Interactions | Press, hover, keyboard, focus, focus ring, outside interaction | Mouse and keyboard only. Enter presses on key-down; Space presses on key-up. Repeats, disabled input, blur cancellation, and owner cleanup are covered. Pointer exit cancels mouse presses; reentry does not restart them. Touch, pen, long press, move, drag sessions, and focus-within are deferred. |
| Button and toggle | `createButton`, `createToggleButton` | Native `div` surface; no HTML form or link behavior. Uses the application's `ToggleState`. |
| Disclosure | `createDisclosure` | State-backed trigger, controlled requests, keyboard press-start activation, and conditional panel mounting. No browser find-in-page, animated panels, or retained collapsed content. Native expanded state and relationships remain blocked below. |
| Tabs | `createTabList`, `createTab`, `createTabPanel` | State-backed selection, automatic or manual keyboard activation, wrapping arrows, Home/End, disabled skipping, RTL, controlled requests, and conditional panels. Explicit panel Tab stops replace DOM child detection. No link tabs or retained inactive panels. |
| Toggle button group | `createToggleButtonGroup`, `createToggleButtonGroupItem` | Single and multiple selection, controlled requests, Enter and Space activation, one remembered Tab stop, disabled skipping, and orientation-aware arrow focus with horizontal RTL. Arrows do not select or wrap. No nested toolbar or arbitrary focusable-child adapter. |
| Checkbox and switch | `createCheckbox`, `createSwitch` | Reactive state, readonly and disabled guards, Space activation, semantic props. Native accessibility state support remains blocked below. |
| Checkbox group | `createCheckboxGroup`, `createCheckboxGroupItem` | Multiple selection through shared state, controlled requests, independent Tab stops, group and item disabled/readonly guards, and group validation results. No group focus-within, label relationships, per-item validation aggregation, or forms. |
| Radio | `createRadioGroup`, `createRadio` | State-backed selection, Space and mouse activation, one group Tab stop, wrapping arrow navigation in native tree order, disabled skipping, and horizontal RTL. Readonly groups allow focus navigation while keeping selection. No form, label relationship, or focus-within adapter. |
| Text field | `createTextField` | Controlled and uncontrolled strings, editor change and submit, readonly and disabled edits. No HTML form validation or password input. Controlled change requests preserve the external Solid value; the backend does not roll back native edits when the parent rejects an edit without changing its value prop. |
| Focus | `createFocusScope`, `createFocusManager` | Native Tab traversal, containment, and restoration for mounted native subtrees. Browser FocusScope components and portals are deferred. |
| Selection and listbox | `ListKeyboardDelegate`, `createListBox`, `createOption` | Linear navigation, disabled keys, single and multiple selection, roving native focus, single-character search. No spatial grid or multi-character typeahead. |
| Geometry | `createNativeServices`, `createNativeLayoutDelegate` | Native focus, measured bounds, hit testing for outside dismissal, and scrolling. Layout owners provide content size. |
| Overlays | `createOverlay`, `createOverlayPosition` | Native stack, nested Escape dismissal, outside mouse-down, modal Tab containment, focus restoration, and native anchoring. No DOM portals or body-scroll locking. Nesting is established through the native host tree. |
| Locale | Provider, locale and direction, collator, date, number and list formatting, filter | Explicit `en-US` default and reactive overrides. No browser locale detection. Localized widget dictionaries remain part of later widget ports. |

Fresh native modules use the source API as a design reference. The filter, checkbox-group, toggle-button-group, disclosure, and tabs implementations are derived from upstream and retain their Adobe notices in source and build outputs. Complete license texts and upstream notices ship with the package.

## Remaining control stages

| Modules still deferred | Required next work |
| --- | --- |
| Search and number fields, select, combobox, autocomplete | Compose native fields and collection behavior with state; implement group focus, validation, and trigger relationships. |
| Menu, submenu, toolbar, breadcrumbs, link, separator, meter, progress | Add widget adapters and test their keyboard contracts. Native state for many of these is already available in `gpuix-solid2-stately`. |
| Calendar, date and time fields, date picker, color, slider | Native segmented editing, pointer gestures, geometry, and accessible numeric actions and values. |
| Gridlist, grid, table, tree, virtualizer | Spatial keyboard delegates, measured layouts, row and cell relationships, virtual accessibility nodes, and collection focus across reuse. |
| Drag and drop, clipboard, token field, toast, landmark, announcements | OS drag sessions, clipboard and editable selection contracts, live announcements, and native accessibility actions. |
| DOM collection builder, hidden selects, visually hidden content, modal polyfill, router and portal providers | Native-specific replacements or deliberate exclusions. Hidden web inputs and document mutation code cannot be reused. |

These deferred stages keep issue #2 open. The exported state foundation alone does not establish behavior or accessibility parity.

## Native accessibility audit

The pinned backend is `@gpuix/native@0.11.0`. The [property allowlist](https://github.com/remorses/gpuix/blob/a53b294401280014e94eb9bd98a7c7ed1929f92d/packages/native/js/mutations.ts#L129-L143) and [Rust accessibility adapter](https://github.com/remorses/gpuix/blob/a53b294401280014e94eb9bd98a7c7ed1929f92d/packages/native/src/accessibility.rs) accept roles, direct labels and descriptions, author IDs, expanded and selected props, textual values, heading levels, and Click. Accepted props do not establish OS state support. The live disclosure audit found no AT-SPI expanded state despite changing `aria-expanded`. [Upstream issue #47](https://github.com/remorses/gpuix/issues/47) tracks the initial accessibility integration and is closed; it does not resolve the remaining state and relationship gaps. [Upstream issue #48](https://github.com/remorses/gpuix/issues/48) links separate work on broader ARIA support in a fork. This package continues to use the published 0.11.0 backend.

| Requirement | Observed support or blocker |
| --- | --- |
| Roles and direct names | Verified in live Linux AT-SPI: button `Save`, checkbox `Accept terms`, button `Disabled`, text editor `Name`. |
| Supported actions | AT-SPI Click on Save updates Solid state; Click on the checkbox toggles its state. The disabled handler rejects Click. |
| Checked, mixed, pressed, disabled, readonly, required, invalid | Not mapped by the native backend. A checked checkbox omits AT-SPI checked state; a disabled button reports enabled and retains Click. Returning semantic props from a behavior does not repair the backend. |
| Expanded | The disclosure's true and false `aria-expanded` props produce identical AT-SPI state sets in the published Linux backend. OS Click changes controlled Solid state and mounts or unmounts the panel, but expanded state is absent. |
| Tab selection | Live Linux AT-SPI exposes tab-list and tab roles and changes the tab's selected state after OS Click. Tab panels map to a scroll pane. Disabled state and tab/panel relationships remain absent. |
| Label, description, control, active-descendant and error relationships | Not mapped by the property allowlist or Rust adapter. Direct labels and descriptions work; native ID relationships need upstream backend support. |
| Numeric values, ranges, stepping and selection actions | No complete native property/action contract for these widgets. Their behavior adapters remain deferred. |
| Modal exclusion, inert background, live regions and announcements | Not supplied by this stage. Modal keyboard containment does not remove background nodes from the OS accessibility tree. |
| Virtual rows, table and tree structure, drag semantics | Require host accessibility nodes and actions beyond the current backend contract. |

The native text editor also [caches its last value prop](https://github.com/remorses/gpuix/blob/a53b294401280014e94eb9bd98a7c7ed1929f92d/packages/native/src/custom_elements/input.rs#L421-L443). A rejected controlled edit cannot reset the editor by resending that unchanged prop. Full controlled editor rollback needs a native reset or revision contract; this stage exposes controlled state and change requests without promising that rollback.

The missing mappings require changes in the shared GPUIX JS host, native Rust backend, and possibly GPUI's builder surface. They cannot be implemented by widening this renderer's prop types. No external repository was modified or published. This PR does not claim that upstream work is complete. A follow-up upstream implementation is required before the accessibility acceptance check in issue #2 can pass.

## Verification evidence

`bun run test` covers keyboard and mouse activation, key normalization, reactive disabled state, Space cancellation, state sharing, focus modality, Tab delegates, restoration, nested dismissal, cleanup, explicit locale, native geometry translation, and single and multiple collection selection.

`bun run check:native` runs a compiled Bun consumer from packed production dependencies without browser globals or a web renderer. It checks every native declaration without `lib.dom` and verifies packaged attribution.

`bun run test:native` passed against a real Linux GPUI window under Xvfb and Mesa software Vulkan. It exercised native hit testing, measured layout, mouse and keyboard activation, disabled Tab traversal, editor changes, hover, nested Escape and outside dismissal, modal Tab containment with a nonmodal child, restoration, and native scrolling. Native simulation requires explicit key-up calls; `simulateKeystrokes` emits key-downs. The live AT-SPI audit in [docs/native-accessibility.json](docs/native-accessibility.json) verifies names, roles, actions, and the remaining backend gaps. Linux's published binary has no test-support renderer, so this proof uses its production graphical renderer. The [captured window](docs/native-verification.png) shows the checked control, edited field, and scrolled target after the OS action audit.

## RadioGroup stage

`createRadioGroup(props, state, ref)` registers one native group per `RadioGroupState`. Call it before creating its radios. Spread `radioGroupProps` onto the containing native `div`; all option refs must point to descendants of that container. `createRadio({ value, ...props }, state, ref)` returns `inputProps`, `isSelected`, `isDisabled`, and `isPressed`. Each value identifies one option and must be unique within the group. Radios register after mounting and unregister on owner disposal.

The selected enabled option is the sole Tab stop. If it is absent or disabled, the last focused enabled option or first registered enabled option becomes the Tab stop. An empty or fully disabled group has no Tab stop. Left, Right, Up, and Down wrap and skip disabled options. Horizontal Left and Right follow the locale direction; Up and Down keep their order. Enter does not select. Mouse and Space request selection through state, including controlled parents that reject requests.

[RadioGroup OS results](../gpuix-solid2-aria-components/docs/radio-accessibility.json) verify radio roles, direct names and descriptions, and Click actions in the native component fixture. GPUIX maps the group to an AT-SPI panel, omits checked and disabled state, and supplies no radio relationships. These backend gaps keep issue #2 open.

## CheckboxGroup stage

`createCheckboxGroup(props, state)` supplies `groupProps` for a native container. `createCheckboxGroupItem({ value, ...props }, state, ref)` supplies `inputProps`, `isSelected`, `isDisabled`, `isReadOnly`, and `isPressed` for each native checkbox surface. Both use the same `CheckboxGroupState`. Item values must be unique within the group.

Space on release, mouse click, and accessibility Click toggle that item's value through state. Enter does not toggle. Enabled items are independent Tab stops in native tree order; disabled items are skipped. Readonly items remain focusable. Group disabled and readonly guards combine with item guards, so a local `false` cannot enable a blocked group item. Controlled parents may accept or reject selection requests without changing the checkbox's external value. Defaults initialize selection once. Items do not register shared resources, and their press handlers dispose with their owners.

Group `validate` and `isInvalid` belong to state. The behavior exposes its displayed validation errors and details, and combines group and local invalid flags on items. Required state follows the group's empty selection unless the item overrides it. Native form submission, reset, browser constraint validation, per-item validation aggregation, group focus-within callbacks, and label/error relationships are outside this subset.

The focused behavior tests cover multiple selection, mouse and Space activation, controlled acceptance and rejection, reactive values and guards, required and invalid state, blur cancellation, and unmount cleanup. The packed native consumer exercises the exported group behavior without browser globals or `lib.dom` and verifies that Adobe notices survive JavaScript and declaration builds.

`bun run test:native:checkbox-group` passed against the production GPUI renderer in a Linux WSLg graphical session. It verifies measured hit testing, mouse and keyboard selection, independent Tab stops, disabled skipping, readonly guards, and controlled request rejection. The [live AT-SPI results](docs/checkbox-group-accessibility.json) verify checkbox roles, direct names and descriptions, and OS Click updating controlled Solid state while disabled Click preserves selection. GPUIX maps the group to a panel and omits checked state and relationships; disabled checkboxes still report enabled. The [captured verification window](docs/checkbox-group-verification.png) shows both enabled items selected after the OS actions. These backend gaps keep issue #2 open.

## ToggleButtonGroup stage

`createToggleButtonGroup(props, state, ref)` registers one group per `ToggleGroupState`. Call it before its items, spread `groupProps` onto a native container, and keep every item ref within that container. `createToggleButtonGroupItem({ id, ...props }, state, ref)` returns `buttonProps`, `isSelected`, `isDisabled`, and `isPressed`. IDs are unique string or number selection keys. Owners register mounted items and unregister them on disposal. Each group needs its own state.

The state owns selection mode, selected keys, group disabled state, controlled requests, and the empty-selection policy. The first enabled item is initially the sole Tab stop, regardless of selection. Focus then follows the last focused enabled item, falling back to the first enabled item when that item disappears or becomes disabled. Empty and fully disabled groups have no Tab stop. Navigation follows native tree order. Horizontal Left and Right follow locale direction; vertical Up and Down keep tree order. Arrows stop at the ends without selecting. Tab exits the group and Shift-Tab reentry restores its remembered item. Enter selects on key-down; Space selects on release. Mouse and OS Click use the same state request path. Controlled parents can reject requests. Group disabled state cannot be overridden by an item's `false`; item readonly keeps focus while blocking selection.

Single selection exposes `radiogroup`, `radio`, and checked props. Multiple selection exposes `toolbar`, `button`, and pressed props. Selection mode, item IDs, guards, labels, orientation, and locale remain reactive. This is a group of registered toggle items, without the source toolbar's nested-toolbar detection or arbitrary interactive descendants. General `createToolbar`, browser forms, label relationships, and component wrappers remain deferred.

Behavior tests cover activation, empty selection, controlled requests, changing modes and IDs, guards, focus-only arrows, disabled skipping, RTL, orientation, blur cancellation, disposal, and fallback after removing the focused item. The compiled packed consumer exercises the exported group with numeric keys without browser globals or `lib.dom`, and checks Adobe notices in both emitted formats.

`bun run test:native:toggle-button-group` passed against the production GPUI renderer in Linux WSLg. It verifies measured mouse hit testing, single and multiple selection, Enter, Space, native Tab exit and reentry, disabled skipping, controlled rejection, reactive orientation, and RTL. The [live AT-SPI audit](docs/toggle-button-group-accessibility.json) verifies radio and button roles, direct names and descriptions, and OS Click changing both controlled single selection and multiple selection. Disabled Click preserves selection. GPUIX maps the single group to a panel and the multiple group to a toolbar. It omits checked and pressed state and item relationships, and still reports the disabled item enabled. See the [captured verification window](docs/toggle-button-group-verification.png). These backend gaps keep issue #2 open.

## Disclosure stage

`createDisclosure(props, state, triggerRef)` uses `DisclosureState` from `gpuix-solid2-stately`. Spread `buttonProps` onto a native `div` trigger. Mount a panel with `panelProps` only while `isExpanded` is true, using Solid's `Show`. Each behavior generates stable native `aria-id` values and returns `aria-controls` and `aria-labelledby` relationships. Supply direct labels because the backend does not expose these relationships.

Enter and Space toggle on key-down, matching the source disclosure's keyboard press-start timing. Repeats and key-up do not toggle again. Mouse click and accessibility Click toggle through the same state request path. Disabled triggers reject all activation paths and leave Tab traversal. State owns controlled requests, default initialization, and programmatic expansion. Rejected requests preserve the parent's expansion value. Existing press and focus callbacks still run.

Conditional mounting removes collapsed descendants from layout, native Tab traversal, and the OS accessibility tree. Panel contents are recreated on expansion, so panel-local state does not survive collapse. Retained collapsed content, automatic focus recovery for programmatic collapse, browser find-in-page expansion, DOM hidden attributes, and panel animations are outside this subset. Component wrappers remain tracked separately in issue #3.

Behavior tests cover activation timing, repeats, callbacks, controlled acceptance and rejection, external updates, default initialization, reactive disabled guards, cancelled mouse presses, blur, disposal, conditional unmounting, and unique stable IDs. The packed native consumer exercises the exported behavior without browser globals or `lib.dom` and verifies the Adobe notice in JavaScript and declarations.

`bun run test:native:disclosure` passed against the production GPUI renderer in Linux WSLg. It verifies measured mouse hit testing, keyboard timing, controlled rejection, disabled input, panel removal, and Tab traversal through expanded children. The [live AT-SPI audit](docs/disclosure-accessibility.json) verifies button roles and direct names, OS Click updating controlled expansion, and removal of the collapsed panel and its children from the OS tree. Expanded state is absent, disabled triggers still report enabled, and trigger and panel relationships are empty. The [captured window](docs/disclosure-verification.png) shows the panel after OS expansion. These backend gaps keep issue #2 open.

## Tabs stage

`createTabList(props, state, ref)` registers one list per `TabListState`. Call it before creating tabs and panels. Each `createTab({ key, ...props }, state, ref)` identifies a unique string or number collection key. Render the tabs in collection order as descendants of the list container. Mounted owners register tabs and unregister on disposal. Removed and disabled tabs leave the navigation set. The state package owns default selection, controlled requests, and selection fallback after collection changes.

The list has one enabled Tab stop, preferring the state's focused key, then selected key, then first enabled mounted tab. Empty or fully disabled lists have none. Left and Right wrap with locale direction in either orientation; vertical lists also accept Up and Down. Horizontal lists leave Up and Down alone. Home and End move to the first and last enabled tabs. Modified navigation shortcuts are ignored. Automatic activation changes selection with arrows; manual activation changes only focus until Enter or Space. Native focus and scrolling follow navigation. Blur from the focused tab clears list focus, so external selection after exiting the list becomes its next entry point. Mouse-down and keyboard-down select, and repeats or releases do not select twice. OS Click follows the same controlled request path. Group disabled state, collection disabled keys and metadata, and local disabled props all block input.

Mount only the selected panel. A keyed `For` over a singleton selected-key array supports string and numeric keys, including `0`, and recreates panel contents after switching. `createTabPanel({ id, tabIndex, ...labels }, state)` supplies a stable native ID and relationship to that tab. Its `id` defaults to the selected key; it is a collection key rather than an author DOM ID. Panels default to `tabIndex: 0`. Set `tabIndex: -1` when a panel contains its own Tab stops. Automatic tabbable-child detection, retained inactive panels, recovery when an application removes a focused panel, link navigation, custom keyboard delegates, and component wrappers remain outside this stage.

Behavior tests cover automatic and manual activation, press timing, callbacks, controlled acceptance and rejection, external selection, numeric keys, stable relationships, reactive locale and orientation, disabled guards, collection changes, panel unmounting, and owner cleanup. The compiled packed consumer exercises all three exports and checks their declarations without browser globals or `lib.dom`. Original Adobe notices survive JavaScript and declaration builds.

`bun run test:native:tabs` passed against the production GPUI renderer in Linux WSLg. It verifies measured mouse hit testing, automatic and manual keys, wrapping, disabled skipping, RTL, orientation changes, panel removal, Tab exit and reentry, and controlled rejection. The [live AT-SPI audit](docs/tabs-accessibility.json) verifies native tab-list and tab roles, direct names and descriptions, selected state, OS Click changing controlled selection, and inactive panels leaving the OS tree. GPUIX maps the panel to a scroll pane, reports disabled tabs enabled, and omits tab/panel relationships. The [captured window](docs/tabs-verification.png) shows Settings selected after the OS audit. These backend gaps and the remaining control stages keep issue #2 open.
