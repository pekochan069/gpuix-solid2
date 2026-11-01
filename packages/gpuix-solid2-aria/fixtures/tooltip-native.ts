import assert from "node:assert/strict";

import { GpuixRenderer } from "@gpuix/native";
import { createRoot } from "gpuix-solid2";
import type { EventPayload, HostElement, KeyEvent } from "gpuix-solid2";
import { createTooltipTriggerState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";

import { createButton } from "../src/controls.js";
import { createOverlayPosition } from "../src/overlays.js";
import { createTooltip, createTooltipTrigger } from "../src/tooltip.js";
import type { TooltipTriggerProps } from "../src/tooltip.js";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({
  height: 560,
  title: "GPUIX Tooltip native verification",
  width: 600,
});

const app = createRoot(renderer, { keyboardFocusDim: false });
let actions!: () => number;
let recordAction!: () => void;
let acceptOpen = true;
const requests: boolean[] = [];

const style = {
  backgroundColor: "#d9e8f2",
  height: 38,
  padding: 8,
  width: 370,
};

const tooltipFixture = (label: string, props: TooltipTriggerProps = {}) => {
  let trigger!: HostElement;
  let content: HostElement | null = null;
  const [open, setOpen] = createSignal(false);

  const state = createTooltipTriggerState({
    closeDelay: 180,
    delay: 180,
    get isDisabled() {
      return props.isDisabled;
    },
    get isOpen() {
      return open();
    },
    onOpenChange(next) {
      requests.push(next);

      if (acceptOpen) {
        setOpen(next);
      }
    },
  });

  const tooltip = createTooltipTrigger(props, state, () => trigger);

  const button = createButton(
    {
      "aria-label": label,
      onPress() {
        recordAction();
      },
    },
    () => trigger
  );

  const position = createOverlayPosition({ offset: 4 });

  return {
    get content() {
      return content;
    },
    state,
    get trigger() {
      return trigger;
    },
    view: jsx("div", {
      children: [
        jsx(
          "div",
          merge(button.buttonProps, tooltip.triggerProps, {
            get "aria-description"() {
              return `Help open: ${state.isOpen}. Actions: ${actions()}`;
            },
            children: label,
            onBlur(event: EventPayload) {
              tooltip.triggerProps.onBlur(event);
              button.buttonProps.onBlur?.(event);
            },
            onClick(event: EventPayload) {
              tooltip.triggerProps.onClick();
              button.buttonProps.onClick?.(event);
            },
            onFocus(event: EventPayload) {
              tooltip.triggerProps.onFocus(event);
              button.buttonProps.onFocus?.(event);
            },
            onKeyDown(event: KeyEvent) {
              tooltip.triggerProps.onKeyDown(event);
              button.buttonProps.onKeyDown?.(event);
            },
            onMouseDown(event: EventPayload) {
              tooltip.triggerProps.onMouseDown();
              button.buttonProps.onMouseDown?.(event);
            },
            onMouseLeave(event: EventPayload) {
              tooltip.triggerProps.onMouseLeave(event);
              button.buttonProps.onMouseLeave?.(event);
            },
            onMouseUp(event: EventPayload) {
              tooltip.triggerProps.onMouseUp();
              button.buttonProps.onMouseUp?.(event);
            },
            ref: (node: HostElement) => {
              trigger = node;
            },
            style,
          })
        ),
        For({
          children: () => {
            const behavior = createTooltip(
              merge(tooltip.tooltipProps, {
                "aria-description":
                  "Keyboard focus or hover shows this description.",
                "aria-label": `${label} help`,
              }),
              state
            );

            return jsx(
              "anchored",
              merge(position.overlayProps, {
                children: jsx(
                  "div",
                  merge(() => behavior.tooltipProps, {
                    children: `${label} help`,
                    ref: (node: HostElement) => {
                      content = node;
                    },
                    style: {
                      backgroundColor: "#16354b",
                      color: "#ffffff",
                      height: 42,
                      padding: 10,
                      width: 390,
                    },
                  })
                ),
              })
            );
          },
          get each() {
            return state.isOpen ? [true] : [];
          },
        }),
      ],
      style: { height: 38, marginBottom: 52, position: "relative", width: 400 },
    }),
  };
};

let standard!: ReturnType<typeof tooltipFixture>;
let focusOnly!: ReturnType<typeof tooltipFixture>;
let disabled!: ReturnType<typeof tooltipFixture>;
let outside!: HostElement;

app.render(() => {
  const [count, setCount] = createSignal(0);
  actions = count;
  recordAction = () => {
    setCount((current) => current + 1);
  };

  standard = tooltipFixture("Save");
  focusOnly = tooltipFixture("Focus only", {
    shouldCloseOnPress: false,
    trigger: "focus",
  });
  disabled = tooltipFixture("Help disabled", { isDisabled: true });
  let show!: HostElement;

  const showButton = createButton(
    {
      "aria-label": "Show Save help",
      onPress() {
        standard.state.open(true);
      },
    },
    () => show
  );

  const outsideButton = createButton(
    { "aria-label": "After tooltips" },
    () => outside
  );

  return jsx("div", {
    children: [
      jsx("text", {
        children: "Native tooltips",
        style: { color: "#102030", fontSize: 24 },
      }),
      jsx("text", {
        children: "Hover waits. Keyboard focus opens immediately.",
        style: { color: "#102030" },
      }),
      standard.view,
      focusOnly.view,
      disabled.view,
      jsx(
        "div",
        merge(outsideButton.buttonProps, {
          children: "After tooltips",
          ref: (node: HostElement) => {
            outside = node;
          },
          style,
        })
      ),
      jsx(
        "div",
        merge(showButton.buttonProps, {
          children: "Show Save help",
          ref: (node: HostElement) => {
            show = node;
          },
          style,
        })
      ),
      jsx("text", {
        get children() {
          return `Button actions: ${actions()}`;
        },
        style: { color: "#102030" },
      }),
    ],
    style: {
      backgroundColor: "#ffffff",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      height: 560,
      padding: 18,
    },
  });
});

const settle = async (milliseconds = 80) => {
  app.flush();
  renderer.tick();
  await Bun.sleep(milliseconds);
  app.flush();
  renderer.tick();
};

const key = async (name: string) => {
  renderer.simulateKeystrokes(name);
  renderer.simulateKeyUp(name);
  await settle();
};

const move = async (element: HostElement) => {
  const box = renderer.getElementBounds(element.id);
  assert.ok(box && box.width > 0 && box.height > 0);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  assert.ok(renderer.getElementsAt(x, y).includes(element.id));
  renderer.simulateMouseMove(x, y);
  await settle();
};

const click = async (element: HostElement) => {
  const box = renderer.getElementBounds(element.id);
  assert.ok(box);
  renderer.simulateClick(box.x + box.width / 2, box.y + box.height / 2);
  await settle();
};

const verify = async () => {
  renderer.activateWindow();
  await settle();
  await move(outside);
  await move(standard.trigger);
  assert.equal(standard.state.isOpen, false, "Cold hover uses state delay");
  await settle(220);
  assert.equal(standard.state.isOpen, true);
  await move(outside);
  await settle(220);
  assert.equal(standard.state.isOpen, false);
  renderer.focusElement(outside.id);
  await key("shift-tab");
  assert.equal(
    renderer.getFocusedElementId(),
    disabled.trigger.id,
    "Disabling help keeps its button in Tab order"
  );
  assert.equal(disabled.state.isOpen, false);
  await key("shift-tab");
  assert.equal(renderer.getFocusedElementId(), focusOnly.trigger.id);
  assert.equal(focusOnly.state.isOpen, true);
  assert.equal(
    renderer.getFocusedElementId(),
    focusOnly.trigger.id,
    "Tooltip content never takes focus"
  );
  await key("enter");
  assert.equal(actions(), 1);
  assert.equal(focusOnly.state.isOpen, true);
  await key("escape");
  assert.equal(focusOnly.state.isOpen, false);
  await key("shift-tab");
  assert.equal(renderer.getFocusedElementId(), standard.trigger.id);
  assert.equal(standard.state.isOpen, true);
  const firstContent = standard.content;
  const id = firstContent?.props.get("aria-id");
  await key("escape");
  assert.equal(standard.state.isOpen, false);
  assert.equal(firstContent?.mounted, false);
  await move(outside);
  await move(standard.trigger);
  await settle(220);
  assert.equal(standard.state.isOpen, true);
  assert.equal(standard.content?.props.get("aria-id"), id);
  assert.ok(standard.content);
  const tooltipBounds = renderer.getElementBounds(standard.content.id);
  const triggerBounds = renderer.getElementBounds(standard.trigger.id);
  assert.ok(tooltipBounds && triggerBounds);
  assert.equal(
    tooltipBounds.y,
    triggerBounds.y + triggerBounds.height + 4,
    "Native anchoring places the tooltip four pixels below its trigger"
  );
  await move(standard.content);
  await settle(220);
  assert.equal(
    standard.state.isOpen,
    true,
    "Hovering content cancels delayed closure"
  );
  await move(standard.trigger);
  await settle(220);
  assert.equal(
    standard.state.isOpen,
    true,
    "Returning to the trigger preserves hover"
  );
  await move(outside);
  await settle(220);
  assert.equal(standard.state.isOpen, false);
  await move(focusOnly.trigger);
  await settle(220);
  assert.equal(focusOnly.state.isOpen, false);
  await move(disabled.trigger);
  await settle(220);
  assert.equal(disabled.state.isOpen, false);
  await move(outside);
  await settle(550);
  acceptOpen = false;
  await move(standard.trigger);
  await settle(220);
  assert.equal(requests.at(-1), true);
  assert.equal(standard.state.isOpen, false);
  acceptOpen = true;
  await move(outside);
  await move(standard.trigger);
  await settle(220);
  assert.equal(standard.state.isOpen, true);
  await click(standard.trigger);
  assert.equal(standard.state.isOpen, false);
  assert.equal(actions(), 2);
  await key("tab");
  await key("shift-tab");
  assert.equal(standard.state.isOpen, true);
  await key("enter");
  assert.equal(standard.state.isOpen, false);
  assert.equal(actions(), 3);
  await key("tab");
  assert.equal(
    renderer.getFocusedElementId(),
    focusOnly.trigger.id,
    "Tooltip adds no Tab stop"
  );
  await key("tab");
  assert.equal(focusOnly.state.isOpen, false, "Blur immediately unmounts help");
  const pressBounds = renderer.getElementBounds(standard.trigger.id);
  assert.ok(pressBounds);
  renderer.simulateMouseDown(
    pressBounds.x + pressBounds.width / 2,
    pressBounds.y + pressBounds.height / 2
  );
  await settle();
  await move(outside);
  assert.equal(
    standard.state.isOpen,
    false,
    "Captured motion outside the trigger cannot reopen help"
  );
  const outsideBox = renderer.getElementBounds(outside.id);
  assert.ok(outsideBox);
  // Captured release activation is a shared createPress gap recorded in PORTING.md.
  renderer.simulateMouseUp(
    outsideBox.x + outsideBox.width / 2,
    outsideBox.y + outsideBox.height / 2
  );
  await settle();
  console.log(
    "Native Tooltip hover delay, focus, anchoring, content hover, dismissal, button actions, guards, controlled rejection and Tab traversal passed."
  );
};

try {
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Tooltip inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Keep the UI alive for external OS actions.
      await Bun.sleep(100);
      app.flush();
    }

    assert.equal(standard.state.isOpen, true);
    assert.equal(disabled.state.isOpen, false);
    assert.equal(actions(), 2);
  }
} finally {
  app.unmount();
}

process.exit(0);
