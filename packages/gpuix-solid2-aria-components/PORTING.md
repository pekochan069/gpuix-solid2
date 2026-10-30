# Native component coverage

The source API audit pins [solid2-aria revision 4bb0e1f](https://github.com/pekochan069/solid2-aria/tree/4bb0e1f8c918e63c045c28d995d51dd1cf9a83b1/packages/solid2-aria-components). [native-coverage.json](native-coverage.json) inventories 299 root runtime exports and 73 public module paths. Each runtime export is classified as `native-subset` or `deferred`. Regenerate it with `bun scripts/inventory.ts /path/to/solid2-aria`; append `--check` to compare without writing.

This package compiles native JSX with the GPUIX renderer and uses `gpuix-solid2-aria` behaviors and `gpuix-solid2-stately` state. Its root and explicit component subpaths export native implementations. Source DOM, SSR, and web subpaths are not retargeted or re-exported.

## Supported component subset

| Export | Native behavior and limits |
| --- | --- |
| `Button`, `ButtonContext` | Mouse, Enter on key-down, Space on key-up, focus, focus visibility, hover, reactive disabled state, and autofocus. `isPending` blocks activation and hover while preserving the Tab stop and focus callbacks. Pending announcements and progress-bar composition are deferred. |
| `ToggleButton`, `ToggleButtonContext` | The same native interactions, plus controlled `isSelected`, initial `defaultSelected`, `onChange`, readonly state, and `state` in render callbacks. Toggle groups and selection-indicator composition are deferred. |
| `Checkbox`, `CheckboxContext` | Mouse and Space activation, controlled and uncontrolled selection, focus, hover, readonly and disabled guards, and render-state flags for required, invalid, and indeterminate values. Enter does not toggle. `ref` and `inputRef` attach to the same native element. Checkbox groups, field/button composition, and browser validation are deferred. |
| `DEFAULT_SLOT`, `createContextProps`, `createRenderProps` | Context defaults, named slots, callback and ref composition, and reactive children and style callbacks. Slots are selected at mount. Style callbacks receive `defaultStyle: {}` and children callbacks receive `defaultChildren: undefined`. CSS classes, web render overrides, DOM refs, and hidden collection traversal are excluded. |

Components expose native behavior callbacks such as `onPress`, `onFocus`, and `onHoverChange`. They do not expose browser event objects or arbitrary DOM props. Local props override contextual defaults; supported callbacks chain instead of replacing each other. A render callback can return native JSX or text and read reactive state through property getters.

Controlled selection reports change requests through `onChange`. If the parent rejects a request, the selection and native rendering retain the supplied value. `defaultSelected` initializes uncontrolled state. Later changes to that default do not reset the control.

## Forms and accessibility

There is no browser form submission, native form registration, hidden input, automatic reset, or constraint validation. `isRequired` and `isInvalid` describe application state; they do not validate it. Applications own submission and reset by updating controlled values. Clicking a checkbox's visible native content activates its single control element. Separate HTML labels and ID-based label relationships are unsupported.

The backend remains `@gpuix/native@0.11.0`. Its [behavior-package accessibility audit](../gpuix-solid2-aria/PORTING.md#native-accessibility-audit) records the shared host and Rust backend blockers. Component composition cannot repair those mappings.

| Requirement | Observed result in this stage |
| --- | --- |
| Direct names, descriptions, and roles | Live Linux AT-SPI exposes Save, Bold, Disabled, Accept terms, Readonly, and Mixed with button or checkbox roles. |
| OS Click actions | Save increments Solid state; Bold toggles selection; Accept terms updates controlled state. Disabled and readonly handlers reject changes. |
| Checked, mixed, pressed, disabled, readonly, required, invalid | Backend mappings remain absent. The checked checkbox omits checked state, and the disabled button reports enabled with a Click action. Readonly and mixed controls have the same observed state bits as other controls. |
| Label, description, control, and error relationships | Direct text works. ID relationships remain unmapped. |
| Pending announcements and browser forms | No native implementation in this stage. |

[Observed AT-SPI results](docs/native-accessibility.json) and the [captured native window](docs/native-verification.png) record this stage. The screenshot follows OS action activation and shows Save at four activations, Bold selected, and Accept terms checked. The native fixture also verifies mouse and keyboard input, Tab order, focus visibility, hover, pending behavior, and readonly and disabled guards with GPUI hit testing and keyboard dispatch under Xvfb and Mesa software Vulkan.

The first component group remains an accessibility subset. Issues [#2](https://github.com/pekochan069/gpuix-solid2/issues/2) and [#3](https://github.com/pekochan069/gpuix-solid2/issues/3) remain open. This stage changes no external repository and publishes no package.

## Deferred stages

| Components and infrastructure | Required native work |
| --- | --- |
| TextField, TextArea, SearchField, NumberField | Native editor integration, controlled edit rollback, field composition, validation, and accessible values. |
| RadioGroup, CheckboxGroup, ToggleButtonGroup, Tabs, Toolbar | Group state and focus, keyboard delegates, selection relationships, and checked or selected accessibility state. |
| ListBox, Select, ComboBox, Menu, Autocomplete | Descriptor evaluation without native hidden nodes, collection registration and disposal, keyboard navigation, and trigger relationships. |
| Dialog, Modal, Popover, Tooltip, Sheet | Component composition over native overlays, focus restoration, anchoring, modal accessibility exclusion, and descriptions. |
| Calendar, date and time, color, slider controls | Segmented editing, pointer gestures, geometry, numeric values, and native accessibility actions. |
| GridList, Table, Tree, Virtualizer, layouts | Spatial delegates, measured collections, virtual accessibility nodes, and focus across reuse. |
| Drag and drop, FileTrigger, Toast, navigation, text and layout helpers | OS drag sessions, file dialogs, announcements, native relationships, and component-specific contracts. |

The inventory lists every remaining source runtime export individually. Dynamic collection component tests and descriptor evaluation belong to the collection stage. No visible native placeholder nodes are created for deferred components.

Original Adobe source notices, Solid Aria modification notices, and the new GPUIX modification notices appear in both runtime output and declarations. Complete pinned notices and license texts ship with the package. See [NOTICE.txt](NOTICE.txt).
