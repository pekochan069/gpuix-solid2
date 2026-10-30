import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createRendererState } from "gpuix-solid2";
import { createToggleState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createComponent, createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import { createNativeLayoutDelegate } from "../src/collections.js";
import {
  createButton,
  createCheckbox,
  createSwitch,
  createTextField,
  createToggleButton,
} from "../src/controls.js";
import { createFilter } from "../src/filter.js";
import { createFocusScope } from "../src/focus.js";
import {
  I18nProvider,
  createLocale,
  createNumberFormatter,
} from "../src/i18n.js";
import {
  createFocusRing,
  createHover,
  createInteractOutside,
  createKeyboard,
} from "../src/interactions.js";
import { normalizeKey } from "../src/native.js";
import { createOverlay, createOverlayPosition } from "../src/overlays.js";
import { setup } from "./support.js";

test("Button activates once for Enter, on Space release, and native click", () => {
  const app = setup();
  let node!: HostElement;
  const presses: string[] = [];
  const transitions: boolean[] = [];
  app.root.render(() => {
    const button = createButton(
      {
        onPress: (e) => {
          presses.push(e.pointerType);
        },
        onPressChange: (p) => {
          transitions.push(p);
        },
      },
      () => node
    );

    return jsx(
      "div",
      merge(button.buttonProps, {
        ref: (el: HostElement) => {
          node = el;
        },
      })
    );
  });
  expect(node).not.toBeNull();

  app.send(node, "keyDown", { key: "enter" });
  app.send(node, "keyDown", { isHeld: true, key: "enter" });
  app.send(node, "keyUp", { key: "enter" });
  expect(presses).toEqual(["keyboard"]);
  app.send(node, "keyDown", { key: "space" });
  expect(presses).toHaveLength(1);
  app.send(node, "mouseLeave");
  app.send(node, "keyUp", { key: "space" });
  app.send(node, "mouseDown", { button: 0 });
  app.send(node, "mouseUp", { button: 0 });
  app.send(node, "click", { button: 0, x: 10, y: 10 });
  expect(presses).toEqual(["keyboard", "keyboard", "mouse"]);
  expect(transitions).toEqual([true, false, true, false, true, false]);
});

test("Disabled changes cancel pending Space and prevent every activation path", () => {
  const app = setup();
  let node!: HostElement;
  let disable: Setter<boolean> | undefined;
  let count = 0;
  let pressed: (() => boolean) | undefined;
  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);
    disable = setDisabled;

    const button = createButton(
      {
        get isDisabled() {
          return disabled();
        },
        onPress: () => {
          count += 1;
        },
      },
      () => node
    );

    pressed = () => button.isPressed;

    return jsx(
      "div",
      merge(button.buttonProps, {
        ref: (el: HostElement) => {
          node = el;
        },
      })
    );
  });

  if (disable === undefined) {
    throw new Error("Missing button");
  }

  app.send(node, "keyDown", { key: "space" });
  expect(pressed?.()).toBe(true);
  app.root.flushSync(() => disable?.(true));
  expect(pressed?.()).toBe(false);
  expect(node.props.get("tabIndex")).toBe(-1);
  app.send(node, "keyUp", { key: "space" });
  app.send(node, "click");
  app.send(node, "keyDown", { key: "enter" });
  expect(count).toBe(0);
});

test("Blur cancels Space, command shortcuts and nonprimary buttons do not press", () => {
  const app = setup();
  let node!: HostElement;
  let count = 0;
  app.root.render(() =>
    jsx(
      "div",
      merge(
        createButton(
          {
            onPress: () => {
              count += 1;
            },
          },
          () => node
        ).buttonProps,
        {
          ref: (el: HostElement) => {
            node = el;
          },
        }
      )
    )
  );

  app.send(node, "keyDown", { key: "space" });
  app.send(node, "blur");
  app.send(node, "keyUp", { key: "space" });
  app.send(node, "keyDown", {
    key: "enter",
    modifiers: { alt: false, cmd: true, ctrl: false, shift: false },
  });
  app.send(node, "click", { button: 2 });
  expect(count).toBe(0);
});

for (const kind of ["toggle", "checkbox", "switch"] as const) {
  test(`${kind} shares native stately state and exposes reactive semantic state`, () => {
    const app = setup();
    let node!: HostElement;
    let selected: (() => boolean) | undefined;
    app.root.render(() => {
      const state = createToggleState();

      const behavior =
        kind === "toggle"
          ? createToggleButton({}, state, () => node)
          : { checkbox: createCheckbox, switch: createSwitch }[kind](
              {},
              state,
              () => node
            );

      selected = () => behavior.isSelected;

      const props =
        "buttonProps" in behavior ? behavior.buttonProps : behavior.inputProps;

      return jsx(
        "div",
        merge(props, {
          ref: (el: HostElement) => {
            node = el;
          },
        })
      );
    });

    app.send(node, "keyDown", { key: "space" });
    app.send(node, "keyUp", { key: "space" });
    expect(selected?.()).toBe(true);
    expect(
      node.props.get(kind === "toggle" ? "aria-pressed" : "aria-checked")
    ).toBe(true);
    app.send(node, "click");
    expect(selected?.()).toBe(false);
  });
}

test("Readonly checkbox keeps state and ignores Enter", () => {
  const app = setup();
  let node!: HostElement;
  let selected: (() => boolean) | undefined;
  app.root.render(() => {
    const state = createToggleState({ defaultSelected: true });
    selected = () => state.isSelected;

    const behavior = createCheckbox(
      { isIndeterminate: true, isReadOnly: true },
      state,
      () => node
    );

    return jsx(
      "div",
      merge(behavior.inputProps, {
        ref: (el: HostElement) => {
          node = el;
        },
      })
    );
  });

  app.send(node, "click");
  app.send(node, "keyDown", { key: "enter" });
  expect(selected?.()).toBe(true);
  expect(node.props.get("aria-checked")).toBe("mixed");
});

test("Hover and keyboard use native events and normalize keys", () => {
  const app = setup();
  let node!: HostElement;
  let hovered: (() => boolean) | undefined;
  let key = "";
  app.root.render(() => {
    const hover = createHover();
    hovered = () => hover.isHovered;

    return jsx(
      "div",
      merge(
        hover.hoverProps,
        createKeyboard({
          onKeyDown: (e) => {
            key = e.key ?? "";
            e.preventDefault();
          },
        }).keyboardProps,
        {
          ref: (el: HostElement) => {
            node = el;
          },
        }
      )
    );
  });

  app.send(node, "mouseEnter");
  expect(hovered?.()).toBe(true);
  app.send(node, "mouseLeave");
  expect(hovered?.()).toBe(false);
  app.send(node, "keyDown", { key: "down" });
  expect(key).toBe("ArrowDown");
  expect(normalizeKey("Escape")).toBe("Escape");
});

test("Focus ring follows window Tab and mouse modality and unsubscribes on unmount", () => {
  const app = setup();
  let node!: HostElement;
  let visible: (() => boolean) | undefined;
  app.root.render(() => {
    const ring = createFocusRing();
    visible = () => ring.isFocusVisible;

    return jsx(
      "div",
      merge(ring.focusProps, {
        onMouseDown() {},
        ref: (el: HostElement) => {
          node = el;
        },
      })
    );
  });

  app.send(node, "focus");
  expect(visible?.()).toBe(false);
  app.windowKey("tab");
  expect(visible?.()).toBe(true);
  app.send(node, "mouseDown");
  expect(visible?.()).toBe(false);
  app.root.unmount();
  app.root.render(() => jsx("div", { onKeyDown() {} }));
  app.windowKey("tab");
  expect(visible?.()).toBe(false);
});

test("Focus scope contains Tab, reverses with Shift, and restores previous focus", () => {
  const app = setup();
  app.renderer.focusElement?.(99);
  let scope!: HostElement;
  app.root.render(() => {
    const behavior = createFocusScope(
      { autoFocus: true, contain: true, restoreFocus: true },
      () => scope
    );

    return jsx(
      "div",
      merge(behavior.scopeProps, {
        ref: (el: HostElement) => {
          scope = el;
        },
        tabIndex: -1,
      })
    );
  });

  if (scope === undefined) {
    throw new Error("Missing scope");
  }

  app.send(scope, "keyDown", { key: "tab" });
  app.send(scope, "keyDown", {
    key: "tab",
    modifiers: { alt: false, cmd: false, ctrl: false, shift: true },
  });
  expect(app.traversal).toEqual(["next", "next", "previous"]);
  app.root.unmount();
  expect(app.focusCalls.at(-1)).toBe(99);
});

test("Nested overlays dismiss only the top layer and restore focus", () => {
  const app = setup();
  let outer!: HostElement;
  let inner!: HostElement;
  let isOpen: (() => boolean) | undefined;
  let closeOuter = 0;
  app.renderer.focusElement?.(99);
  app.root.render(() => {
    const [open, setOpen] = createSignal(true);
    isOpen = open;

    const outerBehavior = createOverlay(
      {
        isDismissable: true,
        isModal: true,
        isOpen: true,
        onClose: () => {
          closeOuter += 1;
        },
      },
      () => outer
    );

    return jsx(
      "div",
      merge(outerBehavior.overlayProps, {
        get children() {
          return Show({
            get children() {
              const innerBehavior = createOverlay(
                {
                  isDismissable: true,
                  isModal: true,
                  isOpen: true,
                  onClose: () => {
                    setOpen(false);
                  },
                },
                () => inner
              );

              return jsx(
                "div",

                merge(innerBehavior.overlayProps, {
                  ref: (el: HostElement) => {
                    inner = el;
                  },
                })
              );
            },
            get when() {
              return open();
            },
          });
        },
        ref: (el: HostElement) => {
          outer = el;
        },
      })
    );
  });

  if (outer === undefined || inner === undefined) {
    throw new Error("Missing overlays");
  }

  app.send(outer, "mouseDownOutside");
  expect(closeOuter).toBe(0);
  app.windowKey("escape");
  expect(isOpen?.()).toBe(false);
  expect(closeOuter).toBe(0);
  app.windowKey("escape");
  expect(closeOuter).toBe(1);
  app.root.unmount();
  expect(app.focusCalls.at(-1)).toBe(99);
  app.windowKey("escape");
  expect(closeOuter).toBe(1);
});

test("Outside interaction can be disabled", () => {
  const app = setup();
  let node!: HostElement;
  let count = 0;
  app.root.render(() =>
    jsx(
      "div",
      merge(
        createInteractOutside({
          isDisabled: true,
          onInteractOutside: () => {
            count += 1;
          },
        }).interactOutsideProps,
        {
          ref: (el: HostElement) => {
            node = el;
          },
        }
      )
    )
  );

  app.send(node, "mouseDownOutside");
  expect(count).toBe(0);
  expect(
    createOverlayPosition({ offset: 12, side: "top" }).overlayProps.gap
  ).toBe(12);
});

test("Text field updates state, rejects readonly input and supports controlled values", () => {
  const app = setup();
  let node!: HostElement;
  let readOnly: Setter<boolean> | undefined;
  const values: string[] = [];
  app.root.render(() => {
    const [readonly, setReadonly] = createSignal(false);
    readOnly = setReadonly;

    const field = createTextField({
      defaultValue: "a",
      get isReadOnly() {
        return readonly();
      },
      onChange: (value) => {
        values.push(value);
      },
    });

    return jsx(
      "input",
      merge(field.inputProps, {
        ref: (el: HostElement) => {
          node = el;
        },
      })
    );
  });

  app.send(node, "change", { value: "b" });
  expect(node.props.get("value")).toBe("b");
  app.root.flushSync(() => readOnly?.(true));
  app.send(node, "change", { value: "c" });
  expect(values).toEqual(["b"]);
  expect(node.props.get("readOnly")).toBe(true);
});

test("Locale is explicit, reactive, and controls formatting and text search", () => {
  const app = setup();
  let setLocale: Setter<string> | undefined;
  let read: (() => string) | undefined;
  app.root.render(() => {
    const [locale, update] = createSignal("en-US");
    setLocale = update;

    return createComponent(I18nProvider, {
      get children() {
        const current = createLocale();
        const number = createNumberFormatter();
        const filter = createFilter({ sensitivity: "base" });
        read = () =>
          `${current.direction}:${number.format(1234.5)}:${filter.contains("Café", "cafe")}`;

        return jsx("text", {
          get children() {
            return read?.();
          },
        });
      },
      get locale() {
        return locale();
      },
    });
  });
  expect(read?.()).toBe("ltr:1,234.5:true");
  app.root.flushSync(() => setLocale?.("de-DE"));
  expect(read?.()).toBe("ltr:1.234,5:true");
  app.root.flushSync(() => setLocale?.("ar-EG"));
  expect(read?.()).toStartWith("rtl:");
});

test("Native layout translates negative scroll offsets into collection coordinates", () => {
  const app = setup();
  let container: HostElement | null = null;
  let item: HostElement | null = null;
  let delegate: ReturnType<typeof createNativeLayoutDelegate> | undefined;
  app.root.render(() => {
    delegate = createNativeLayoutDelegate({
      getContentSize: () => ({ height: 1000, width: 100 }),
      getItem: () => item,
      ref: () => container,
    });

    return jsx("div", {
      get children() {
        return jsx("div", {
          ref: (el: HostElement) => {
            item = el;
          },
        });
      },
      ref: (el: HostElement) => {
        container = el;
      },
    });
  });
  expect(delegate?.getVisibleRect()).toEqual({
    height: 20,
    width: 100,
    x: 5,
    y: 25,
  });
  expect(delegate?.getItemRect("item")).toEqual({
    height: 20,
    width: 100,
    x: 15,
    y: 45,
  });
});

test("Native release without a matching press is ignored, while accessibility Click activates", () => {
  const app = setup();
  let node!: HostElement;
  let count = 0;
  app.root.render(() =>
    jsx(
      "div",
      merge(
        createButton(
          {
            onPress: () => {
              count += 1;
            },
          },
          () => node
        ).buttonProps,
        {
          ref: (el: HostElement) => {
            node = el;
          },
        }
      )
    )
  );
  app.send(node, "mouseUp", { button: 0, x: 10, y: 10 });
  app.send(node, "click", { button: 0, x: 10, y: 10 });
  expect(count).toBe(0);
  app.send(node, "click");
  expect(count).toBe(1);
});

test("Controlled text field reports edits while retaining its external value", () => {
  const app = setup();
  let node!: HostElement;
  const changes: string[] = [];
  app.root.render(() =>
    jsx(
      "input",
      merge(
        createTextField({
          onChange: (value) => {
            changes.push(value);
          },
          value: "fixed",
        }).inputProps,
        {
          ref: (el: HostElement) => {
            node = el;
          },
        }
      )
    )
  );
  app.send(node, "change", { value: "next" });
  expect(changes).toEqual(["next"]);
  expect(node.props.get("value")).toBe("fixed");
});

test("Focus ring inherits native renderer modality when it mounts after a keyboard event", () => {
  const app = setup();
  let node!: HostElement;
  app.root.render(() =>
    jsx("div", {
      onKeyDown() {},
      ref: (el: HostElement) => {
        node = el;
      },
    })
  );
  // The render() convenience API dispatches through the native state, bypassing Root.dispatch.
  createRendererState(app.renderer).dispatch({
    elementId: node.id,
    eventType: "keyDown",
    key: "enter",
  });
  let visible: (() => boolean) | undefined;
  app.root.render(() => {
    const ring = createFocusRing();
    visible = () => ring.isFocusVisible;

    return jsx(
      "div",
      merge(ring.focusProps, {
        ref: (el: HostElement) => {
          node = el;
        },
      })
    );
  });
  app.send(node, "focus");
  expect(visible?.()).toBe(true);
});

test("Unmount cancels a pending press and clears its native handlers", () => {
  const app = setup();
  let node!: HostElement;
  const transitions: boolean[] = [];
  app.root.render(() =>
    jsx(
      "div",
      merge(
        createButton(
          {
            onPressChange: (value) => {
              transitions.push(value);
            },
          },
          () => node
        ).buttonProps,
        {
          ref: (el: HostElement) => {
            node = el;
          },
        }
      )
    )
  );
  app.send(node, "keyDown", { key: "space" });
  app.root.unmount();
  expect(transitions).toEqual([true, false]);
  expect(app.send(node, "keyUp", { key: "space" })).toBe(false);
});

test("One outside gesture cannot dismiss both a child and its parent", async () => {
  const app = setup();
  let outer!: HostElement;
  let inner!: HostElement;
  let parentCloses = 0;
  app.root.render(() => {
    const [open, setOpen] = createSignal(true);

    const parent = createOverlay(
      {
        isDismissable: true,
        isOpen: true,
        onClose: () => {
          parentCloses += 1;
        },
      },
      () => outer
    );

    return jsx(
      "div",
      merge(parent.overlayProps, {
        get children() {
          return Show({
            get children() {
              const child = createOverlay(
                {
                  isDismissable: true,
                  isOpen: true,
                  onClose: () => {
                    setOpen(false);
                  },
                },
                () => inner
              );

              return jsx(
                "div",
                merge(child.overlayProps, {
                  ref: (el: HostElement) => {
                    inner = el;
                  },
                })
              );
            },
            get when() {
              return open();
            },
          });
        },
        ref: (el: HostElement) => {
          outer = el;
        },
      })
    );
  });
  app.send(inner, "mouseDownOutside", { x: 500, y: 500 });
  app.send(outer, "mouseDownOutside", { x: 500, y: 500 });
  await Bun.sleep(1);
  app.root.flush();
  expect(inner.mounted).toBe(false);
  expect(parentCloses).toBe(0);
  const container = outer.parent;

  if (!container || container.kind !== "element") {
    throw new Error("Missing root container");
  }

  app.send(container, "mouseDown", { x: 500, y: 500 });
  app.send(outer, "mouseDownOutside", { x: 500, y: 500 });
  await Bun.sleep(1);
  app.root.flush();
  expect(parentCloses).toBe(1);
});

test("Explicit enabled state cannot override a readonly text editor", () => {
  const app = setup();
  let node!: HostElement;
  let changes = 0;
  app.root.render(() =>
    jsx(
      "input",
      merge(
        createTextField({
          defaultValue: "Locked",
          isDisabled: false,
          isReadOnly: true,
          onChange: () => {
            changes += 1;
          },
        }).inputProps,
        {
          ref: (el: HostElement) => {
            node = el;
          },
        }
      )
    )
  );
  expect(node.props.get("readOnly")).toBe(true);
  app.send(node, "change", { value: "Edited" });
  expect(changes).toBe(0);
  expect(node.props.get("value")).toBe("Locked");
});
