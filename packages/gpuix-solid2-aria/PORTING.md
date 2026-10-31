# Native behavior coverage

Source audit: [solid2-aria revision 4bb0e1f](https://github.com/pekochan069/solid2-aria/tree/4bb0e1f8c918e63c045c28d995d51dd1cf9a83b1/packages/solid2-aria). [native-coverage.json](native-coverage.json) inventories all 156 root runtime exports and all 256 public source module paths. Each root export is classified as a native subset or deferred. Type-only exports are not counted as behaviors. Regenerate it with `bun scripts/inventory.ts /path/to/solid2-aria`; append `--check` to compare without writing.

This stage adds a native API with GPUIX event and element types. It is not a drop-in build of the web package. Only the native entry points emitted from `src` are exported. Source web subpaths, DOM refs, browser form attributes, and web portals are not exposed.

## Implemented native subsets

| Source family | Native behavior | Limits |
| --- | --- | --- |
| Interactions | Press, hover, keyboard, focus, focus ring, outside interaction | Mouse and keyboard only. Enter presses on key-down; Space presses on key-up. Repeats, disabled input, blur cancellation, and owner cleanup are covered. Pointer exit cancels mouse presses; reentry does not restart them. Touch, pen, long press, move, drag sessions, and focus-within are deferred. |
| Button and toggle | `createButton`, `createToggleButton` | Native `div` surface; no HTML form or link behavior. Uses the application's `ToggleState`. |
| Checkbox and switch | `createCheckbox`, `createSwitch` | Reactive state, readonly and disabled guards, Space activation, semantic props. Native accessibility state support remains blocked below. |
| Checkbox group | `createCheckboxGroup`, `createCheckboxGroupItem` | Multiple selection through shared state, controlled requests, independent Tab stops, group and item disabled/readonly guards, and group validation results. No group focus-within, label relationships, per-item validation aggregation, or forms. |
| Radio | `createRadioGroup`, `createRadio` | State-backed selection, Space and mouse activation, one group Tab stop, wrapping arrow navigation in native tree order, disabled skipping, and horizontal RTL. Readonly groups allow focus navigation while keeping selection. No form, label relationship, or focus-within adapter. |
| Text field | `createTextField` | Controlled and uncontrolled strings, editor change and submit, readonly and disabled edits. No HTML form validation or password input. Controlled change requests preserve the external Solid value; the backend does not roll back native edits when the parent rejects an edit without changing its value prop. |
| Focus | `createFocusScope`, `createFocusManager` | Native Tab traversal, containment, and restoration for mounted native subtrees. Browser FocusScope components and portals are deferred. |
| Selection and listbox | `ListKeyboardDelegate`, `createListBox`, `createOption` | Linear navigation, disabled keys, single and multiple selection, roving native focus, single-character search. No spatial grid or multi-character typeahead. |
| Geometry | `createNativeServices`, `createNativeLayoutDelegate` | Native focus, measured bounds, hit testing for outside dismissal, and scrolling. Layout owners provide content size. |
| Overlays | `createOverlay`, `createOverlayPosition` | Native stack, nested Escape dismissal, outside mouse-down, modal Tab containment, focus restoration, and native anchoring. No DOM portals or body-scroll locking. Nesting is established through the native host tree. |
| Locale | Provider, locale and direction, collator, date, number and list formatting, filter | Explicit `en-US` default and reactive overrides. No browser locale detection. Localized widget dictionaries remain part of later widget ports. |

Fresh native modules use the source API as a design reference. The filter and checkbox-group implementations are derived from upstream and retain their Adobe notices in source and build outputs. Complete license texts and upstream notices ship with the package.

## Remaining control stages

| Modules still deferred | Required next work |
| --- | --- |
| Toggle groups, search and number fields, select, combobox, autocomplete | Compose native fields and collection behavior with state; implement group focus, validation, and trigger relationships. |
| Menu, submenu, tabs, toolbar, disclosure, breadcrumbs, link, separator, meter, progress | Add widget adapters and test their keyboard contracts. Native state for many of these is already available in `gpuix-solid2-stately`. |
| Calendar, date and time fields, date picker, color, slider | Native segmented editing, pointer gestures, geometry, and accessible numeric actions and values. |
| Gridlist, grid, table, tree, virtualizer | Spatial keyboard delegates, measured layouts, row and cell relationships, virtual accessibility nodes, and collection focus across reuse. |
| Drag and drop, clipboard, token field, toast, landmark, announcements | OS drag sessions, clipboard and editable selection contracts, live announcements, and native accessibility actions. |
| DOM collection builder, hidden selects, visually hidden content, modal polyfill, router and portal providers | Native-specific replacements or deliberate exclusions. Hidden web inputs and document mutation code cannot be reused. |

These deferred stages keep issue #2 open. The exported state foundation alone does not establish behavior or accessibility parity.

## Native accessibility audit

The pinned backend is `@gpuix/native@0.11.0`. The [property allowlist](https://github.com/remorses/gpuix/blob/a53b294401280014e94eb9bd98a7c7ed1929f92d/packages/native/js/mutations.ts#L129-L143) and [Rust accessibility adapter](https://github.com/remorses/gpuix/blob/a53b294401280014e94eb9bd98a7c7ed1929f92d/packages/native/src/accessibility.rs) expose roles, direct labels and descriptions, author IDs, expanded and selected state, textual values, heading levels, and Click. [Upstream issue #47](https://github.com/remorses/gpuix/issues/47) tracks the initial accessibility integration and is closed; it does not resolve the remaining state and relationship gaps. [Upstream issue #48](https://github.com/remorses/gpuix/issues/48) links separate work on broader ARIA support in a fork. This package continues to use the published 0.11.0 backend.

| Requirement | Observed support or blocker |
| --- | --- |
| Roles and direct names | Verified in live Linux AT-SPI: button `Save`, checkbox `Accept terms`, button `Disabled`, text editor `Name`. |
| Supported actions | AT-SPI Click on Save updates Solid state; Click on the checkbox toggles its state. The disabled handler rejects Click. |
| Checked, mixed, pressed, disabled, readonly, required, invalid | Not mapped by the native backend. A checked checkbox omits AT-SPI checked state; a disabled button reports enabled and retains Click. Returning semantic props from a behavior does not repair the backend. |
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
