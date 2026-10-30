import assert from "node:assert/strict";

import { GpuixRenderer, createRoot } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { createToggleState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import {
  createButton,
  createCheckbox,
  createFocusRing,
  createHover,
  createNativeLayoutDelegate,
  createNativeServices,
  createOverlay,
  createTextField,
} from "../src/index.js";

// Exercise the shipped Linux renderer in a real graphical session, including software Vulkan.
// Native methods dispatch through GPUI hit testing and keyboard dispatch, rather than Root.dispatch.
for (const name of ["window", "document", "navigator", "HTMLElement"]) {
  Reflect.deleteProperty(globalThis, name);
}

let readonlyField!: HostElement;
let readonlyNativeChanges = 0;

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  if (event.eventType === "change" && event.elementId === readonlyField?.id) {
    readonlyNativeChanges += 1;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({
  height: 480,
  title: "GPUIX Aria native verification",
  width: 640,
});

const app = createRoot(renderer);
let button!: HostElement;
let checkbox!: HostElement;
let disabled!: HostElement;
let field!: HostElement;
let scroller!: HostElement;
let scrollTarget!: HostElement;
let scrollIntoView: (() => void) | undefined;
let layout: ReturnType<typeof createNativeLayoutDelegate> | undefined;
let dialog!: HostElement;
let inner!: HostElement;
let firstDialogControl!: HostElement;
let secondDialogControl!: HostElement;
let activations = 0;
let selected = () => false;
let focused = () => false;
let hovered = () => false;
let show: Setter<boolean> | undefined;
let text = () => "";

app.render(() => {
  const services = createNativeServices();
  scrollIntoView = () => {
    services.scrollIntoView(() => scrollTarget);
  };

  layout = createNativeLayoutDelegate({
    getContentSize: () => ({ height: 624, width: 200 }),
    getItem: () => scrollTarget,
    ref: () => scroller,
  });
  const [open, setOpen] = createSignal(false);
  const [count, setCount] = createSignal(0);
  show = setOpen;
  const state = createToggleState();

  const check = createCheckbox(
    {
      get "aria-description"() {
        return state.isSelected ? "Checked" : "Unchecked";
      },
      "aria-label": "Accept terms",
    },
    state,
    () => checkbox
  );

  selected = () => state.isSelected;

  const save = createButton(
    {
      get "aria-description"() {
        return `Activated ${count()} times`;
      },
      "aria-label": "Save",
      onPress: () => {
        activations += 1;
        setCount(activations);
      },
    },
    () => button
  );

  const ring = createFocusRing();
  focused = () => ring.isFocusVisible;
  const hover = createHover();
  hovered = () => hover.isHovered;

  const blocked = createButton(
    {
      "aria-label": "Disabled",
      isDisabled: true,
      onPress: () => {
        throw new Error("Disabled activated");
      },
    },
    () => disabled
  );

  const readonlyInput = createTextField({
    "aria-label": "Readonly",
    defaultValue: "Locked",
    isDisabled: false,
    isReadOnly: true,
  });

  const input = createTextField({ "aria-label": "Name", defaultValue: "Ada" });
  text = () => input.value;

  return jsx("div", {
    get children() {
      return [
        jsx(
          "div",
          merge(save.buttonProps, ring.focusProps, hover.hoverProps, {
            children: "Save",
            ref: (el: HostElement) => {
              button = el;
            },
            style: { backgroundColor: "#cccccc", height: 44, width: 200 },
          })
        ),
        jsx(
          "div",
          merge(check.inputProps, {
            "aria-labelledby": "terms-label",
            get children() {
              return selected() ? "Accepted" : "Accept terms";
            },
            ref: (el: HostElement) => {
              checkbox = el;
            },
            style: { backgroundColor: "#cccccc", height: 44, width: 200 },
          })
        ),
        jsx("text", { "aria-id": "terms-label", children: "Terms label" }),
        jsx(
          "input",
          merge(readonlyInput.inputProps, {
            ref: (el: HostElement) => {
              readonlyField = el;
            },
            style: {
              height: 44,
              left: 340,
              position: "absolute",
              top: 140,
              width: 200,
            },
          })
        ),
        jsx(
          "div",
          merge(blocked.buttonProps, {
            children: "Disabled",
            ref: (el: HostElement) => {
              disabled = el;
            },
            style: { height: 44, width: 200 },
          })
        ),
        jsx(
          "input",
          merge(input.inputProps, {
            ref: (el: HostElement) => {
              field = el;
            },
            style: { height: 44, width: 240 },
          })
        ),
        jsx("div", {
          get children() {
            return [
              jsx("div", {
                children: "Scrollable content",
                style: {
                  flexShrink: 0,
                  height: 600,
                },
              }),
              jsx("div", {
                children: "Scroll target",
                ref: (el: HostElement) => {
                  scrollTarget = el;
                },
                style: {
                  flexShrink: 0,
                  height: 24,
                },
              }),
            ];
          },
          ref: (el: HostElement) => {
            scroller = el;
          },
          style: {
            backgroundColor: "#eeeeee",
            display: "flex",
            flexDirection: "column",
            height: 80,
            left: 340,
            overflow: "scroll",
            position: "absolute",
            top: 20,
            width: 200,
          },
        }),
        Show({
          get children() {
            const [nested, setNested] = createSignal(true);

            const overlay = createOverlay(
              {
                isDismissable: true,
                isModal: true,
                isOpen: true,
                onClose: () => {
                  setOpen(false);
                },
                triggerRef: () => button,
              },
              () => dialog
            );

            return jsx(
              "div",
              merge(overlay.overlayProps, {
                "aria-label": "Dialog",
                get children() {
                  return [
                    jsx("div", {
                      children: "First dialog control",
                      ref: (el: HostElement) => {
                        firstDialogControl = el;
                      },
                      tabIndex: 0,
                    }),
                    jsx("div", {
                      children: "Second dialog control",
                      ref: (el: HostElement) => {
                        secondDialogControl = el;
                      },
                      tabIndex: 0,
                    }),
                    Show({
                      get children() {
                        const layer = createOverlay(
                          {
                            isDismissable: true,
                            isOpen: true,
                            onClose: () => {
                              setNested(false);
                            },
                          },
                          () => inner
                        );

                        return jsx(
                          "div",
                          merge(layer.overlayProps, {
                            children: "Nested overlay",
                            ref: (el: HostElement) => {
                              inner = el;
                            },
                            style: { height: 40, width: 200 },
                          })
                        );
                      },
                      get when() {
                        return nested();
                      },
                    }),
                  ];
                },
                ref: (el: HostElement) => {
                  dialog = el;
                },
                role: "dialog",
                style: { backgroundColor: "#eeeeee", height: 100, width: 300 },
              })
            );
          },
          get when() {
            return open();
          },
        }),
      ];
    },
    style: {
      backgroundColor: "#ffffff",
      color: "#111111",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      height: "100%",
      padding: 20,
    },
  });
});

const settle = async () => {
  app.flush();
  renderer.tick();
  await Bun.sleep(80);
  app.flush();
};

const click = async (node: HostElement) => {
  const box = renderer.getElementBounds(node.id);
  assert.ok(
    box && box.width > 0 && box.height > 0,
    "Native layout must produce bounds"
  );
  renderer.simulateClick(box.x + box.width / 2, box.y + box.height / 2);
  await settle();
};

try {
  if (process.env.GPUIX_ARIA_XDOTOOL !== undefined) {
    const result = Bun.spawnSync([
      process.env.GPUIX_ARIA_XDOTOOL,
      "search",
      "--name",
      "GPUIX Aria native verification",
      "windowfocus",
      "--sync",
    ]);

    assert.equal(result.exitCode, 0);
  }

  renderer.activateWindow();
  await settle();
  await click(button);
  assert.equal(activations, 1);
  renderer.simulateKeyDown("enter");
  renderer.simulateKeyUp("enter");
  renderer.simulateKeyDown("space");
  renderer.simulateKeyUp("space");
  await settle();
  assert.equal(
    activations,
    3,
    "Native keyboard activation must not double fire"
  );
  assert.equal(focused(), true);
  await click(checkbox);
  assert.equal(selected(), true);
  renderer.simulateKeyDown("space");
  renderer.simulateKeyUp("space");
  await settle();
  assert.equal(selected(), false);
  await click(disabled);
  renderer.focusElement(button.id);
  renderer.simulateKeystrokes("tab");
  await settle();
  assert.equal(renderer.getFocusedElementId(), checkbox.id);
  renderer.simulateKeystrokes("tab");
  await settle();
  assert.equal(renderer.getFocusedElementId(), readonlyField.id);
  renderer.simulateKeystrokes("tab");
  await settle();
  assert.equal(
    renderer.getFocusedElementId(),
    field.id,
    "Tab must skip disabled surface"
  );
  renderer.simulateKeystrokes("end x");
  await settle();
  assert.equal(text(), "Adax");
  await click(readonlyField);
  renderer.simulateKeystrokes("end z");
  await settle();
  assert.equal(
    readonlyNativeChanges,
    0,
    "Readonly editor must reject native changes when isDisabled is false"
  );
  const box = renderer.getElementBounds(button.id);
  assert.ok(box);
  renderer.simulateMouseMove(box.x + 5, box.y + 5);
  await settle();
  assert.equal(hovered(), true);
  assert.equal(layout?.getVisibleRect().height, 80);
  scrollIntoView?.();
  await settle();
  const offset = renderer.getScrollOffset(scroller.id);
  assert.ok(
    offset && (offset[1] ?? 0) < 0,
    "Native service must scroll its real parent"
  );
  app.flushSync(() => show?.(true));
  await settle();
  assert.equal(dialog?.mounted, true);
  assert.equal(inner?.mounted, true);
  renderer.simulateKeystrokes("tab");
  await settle();
  assert.equal(renderer.getFocusedElementId(), firstDialogControl.id);
  renderer.simulateKeystrokes("tab");
  await settle();
  assert.equal(renderer.getFocusedElementId(), secondDialogControl.id);
  renderer.simulateKeystrokes("tab");
  await settle();
  assert.equal(
    renderer.getFocusedElementId(),
    firstDialogControl.id,
    "Modal Tab must wrap even with a nonmodal child"
  );
  renderer.simulateKeystrokes("escape");
  await settle();
  assert.equal(inner?.mounted, false);
  assert.equal(dialog?.mounted, true);
  renderer.simulateKeystrokes("escape");
  await settle();
  assert.equal(dialog?.mounted, false);
  assert.equal(renderer.getFocusedElementId(), button.id);
  app.flushSync(() => show?.(true));
  await settle();
  renderer.simulateMouseDown(600, 440);
  renderer.simulateMouseUp(600, 440);
  await settle();
  assert.equal(inner.mounted, false);
  assert.equal(
    dialog.mounted,
    true,
    "One native outside click must close only the child"
  );
  renderer.simulateMouseDown(600, 440);
  renderer.simulateMouseUp(600, 440);
  await settle();
  assert.equal(dialog.mounted, false);
  console.log(
    "Native GPUI hit testing, layout, mouse/keyboard activation, disabled Tab, text editing, hover, nested dismissal, restoration and scrolling passed."
  );

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Inspection window ready; press Ctrl+C when finished.");
    await Bun.sleep(60_000);
  }
} finally {
  app.unmount();
}

process.exit(0);
