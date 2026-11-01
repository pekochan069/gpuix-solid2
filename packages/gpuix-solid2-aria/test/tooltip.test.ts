import { afterEach, expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createTooltipTriggerState } from "gpuix-solid2-stately";
import type { TooltipTriggerProps as StateProps } from "gpuix-solid2-stately/tooltip/create-tooltip-trigger-state";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, For, merge } from "solid-js";

import { createButton } from "../src/controls.js";
import { createOverlay } from "../src/overlays.js";
import { createTooltip, createTooltipTrigger } from "../src/tooltip.js";
import type { TooltipTriggerProps } from "../src/tooltip.js";
import { setup } from "./support.js";

const roots = new Set<ReturnType<typeof setup>["root"]>();

afterEach(() => {
  // Bun scopes hooks to their importing file; shared tooltip timers need local cleanup.
  for (const root of roots) {
    root.unmount();
  }

  roots.clear();
});

const mount = (
  props: TooltipTriggerProps = {},
  stateProps: StateProps = {},
  onPress = () => {}
) => {
  const app = setup();
  roots.add(app.root);
  let trigger!: HostElement;
  let content: HostElement | null = null;
  let state!: ReturnType<typeof createTooltipTriggerState>;
  app.root.render(() => {
    // oxlint-disable-next-line solid/reactivity -- Capture the mounted state for imperative assertions.
    state = createTooltipTriggerState(
      merge({ closeDelay: 0, delay: 0 }, stateProps)
    );
    const tooltip = createTooltipTrigger(props, state, () => trigger);

    const button = createButton(
      { "aria-label": "Save", onPress },
      () => trigger
    );

    return jsx("div", {
      children: [
        jsx(
          "div",
          merge(button.buttonProps, tooltip.triggerProps, {
            onBlur(event: Parameters<typeof tooltip.triggerProps.onBlur>[0]) {
              tooltip.triggerProps.onBlur(event);
              button.buttonProps.onBlur?.(event);
            },
            onClick(
              event: Parameters<
                NonNullable<typeof button.buttonProps.onClick>
              >[0]
            ) {
              tooltip.triggerProps.onClick();
              button.buttonProps.onClick?.(event);
            },
            onFocus(event: Parameters<typeof tooltip.triggerProps.onFocus>[0]) {
              tooltip.triggerProps.onFocus(event);
              button.buttonProps.onFocus?.(event);
            },
            onKeyDown(
              event: Parameters<typeof tooltip.triggerProps.onKeyDown>[0]
            ) {
              tooltip.triggerProps.onKeyDown(event);
              button.buttonProps.onKeyDown?.(event);
            },
            onMouseDown(
              event: Parameters<
                NonNullable<typeof button.buttonProps.onMouseDown>
              >[0]
            ) {
              tooltip.triggerProps.onMouseDown();
              button.buttonProps.onMouseDown?.(event);
            },
            onMouseLeave(
              event: Parameters<typeof tooltip.triggerProps.onMouseLeave>[0]
            ) {
              tooltip.triggerProps.onMouseLeave(event);
              button.buttonProps.onMouseLeave?.(event);
            },
            onMouseUp(
              event: Parameters<
                NonNullable<typeof button.buttonProps.onMouseUp>
              >[0]
            ) {
              tooltip.triggerProps.onMouseUp();
              button.buttonProps.onMouseUp?.(event);
            },
            ref: (node: HostElement) => {
              trigger = node;
            },
          })
        ),
        For({
          children: () => {
            const behavior = createTooltip(
              merge(tooltip.tooltipProps, {
                "aria-label": "Save your changes",
              }),
              state
            );

            return jsx(
              "div",
              merge(() => behavior.tooltipProps, {
                ref: (node: HostElement) => {
                  content = node;
                },
              })
            );
          },
          get each() {
            return state.isOpen ? [true] : [];
          },
        }),
      ],
    });
  });

  return {
    ...app,
    get content() {
      return content;
    },
    get state() {
      return state;
    },
    trigger,
  };
};

test("keyboard focus opens immediately, links mounted content, and blur removes it", () => {
  const app = mount({}, { delay: 1000 });
  app.windowKey("tab");
  app.send(app.trigger, "focus");
  expect(app.state.isOpen).toBe(true);
  const { content } = app;
  expect(content?.props.get("role")).toBe("tooltip");
  expect(content?.props.get("aria-label")).toBe("Save your changes");
  const id = content?.props.get("aria-id");
  expect(id).not.toBeUndefined();
  expect(app.trigger.props.get("aria-describedby")).toBe(id);
  expect(app.trigger.props.get("tabIndex")).toBe(0);
  expect(app.trigger.props.get("role")).toBe("button");
  expect(content?.props.has("tabIndex")).toBe(false);
  app.send(app.trigger, "blur");
  expect(app.state.isOpen).toBe(false);
  expect(content?.mounted).toBe(false);
  expect(app.trigger.props.has("aria-describedby")).toBe(false);
  app.send(app.trigger, "focus");
  expect(app.content?.props.get("aria-id")).toBe(id);
});

test("hover waits for state delay and leaving cancels a pending open", async () => {
  const app = mount({}, { delay: 15 });
  app.send(app.trigger, "mouseEnter");
  expect(app.state.isOpen).toBe(false);
  app.send(app.trigger, "mouseLeave");
  await Bun.sleep(30);
  app.root.flush();
  expect(app.state.isOpen).toBe(false);
  app.send(app.trigger, "mouseEnter");
  await Bun.sleep(30);
  app.root.flush();
  expect(app.state.isOpen).toBe(true);
  app.send(app.trigger, "mouseLeave");
  expect(app.state.isOpen).toBe(false);
});

test("hovering content cancels delayed closure without moving focus", async () => {
  const app = mount({}, { closeDelay: 15 });
  app.send(app.trigger, "mouseEnter");
  const { content } = app;
  expect(content).not.toBeNull();
  app.send(app.trigger, "mouseLeave");

  if (!content) {
    throw new Error("Missing tooltip");
  }

  app.send(content, "mouseEnter");
  await Bun.sleep(30);
  app.root.flush();
  expect(app.state.isOpen).toBe(true);
  expect(app.focusCalls).toEqual([]);
  app.send(content, "mouseLeave");
  await Bun.sleep(30);
  app.root.flush();
  expect(app.state.isOpen).toBe(false);
  expect(content.mounted).toBe(false);
});

test("pointer focus does not open, while real motion can reopen after keyboard dismissal", () => {
  const app = mount();
  app.send(app.trigger, "mouseDown");
  app.send(app.trigger, "focus");
  app.send(app.trigger, "mouseUp");
  expect(app.state.isOpen).toBe(false);
  app.windowKey("tab");
  app.send(app.trigger, "focus");
  expect(app.state.isOpen).toBe(true);
  app.send(app.trigger, "keyDown", { key: "escape" });
  expect(app.state.isOpen).toBe(false);
  app.send(app.trigger, "mouseEnter");
  expect(app.state.isOpen).toBe(false);
  app.send(app.trigger, "mouseMove", { x: 20, y: 20 });
  expect(app.state.isOpen).toBe(true);
});

test("native content enter before trigger leave keeps the tooltip open", () => {
  const app = mount();
  app.send(app.trigger, "mouseEnter");
  const { content } = app;

  if (!content) {
    throw new Error("Missing tooltip");
  }

  app.send(content, "mouseEnter");
  app.send(app.trigger, "mouseLeave");
  expect(app.state.isOpen).toBe(true);
  expect(content.mounted).toBe(true);
  app.send(content, "mouseLeave");
  expect(app.state.isOpen).toBe(false);
});

test("focus-only triggers ignore hover and hover exit preserves focused content", () => {
  const app = mount({ trigger: "focus" });
  app.send(app.trigger, "mouseEnter");
  app.send(app.trigger, "mouseMove");
  expect(app.state.isOpen).toBe(false);
  app.windowKey("tab");
  app.send(app.trigger, "focus");
  app.send(app.trigger, "mouseLeave");
  expect(app.state.isOpen).toBe(true);
  app.send(app.trigger, "blur");
  expect(app.state.isOpen).toBe(false);
});

test("native trigger enter before content leave retains help on return", () => {
  const app = mount();
  app.send(app.trigger, "mouseEnter");
  const { content } = app;

  if (!content) {
    throw new Error("Missing tooltip");
  }

  app.send(content, "mouseEnter");
  app.send(app.trigger, "mouseLeave");
  app.send(app.trigger, "mouseEnter");
  app.send(content, "mouseLeave");
  expect(app.state.isOpen).toBe(true);
  expect(content.mounted).toBe(true);
  app.send(app.trigger, "mouseLeave");
  expect(app.state.isOpen).toBe(false);
});

test("composed button cancels a mouse press on exit even after reentry", () => {
  let actions = 0;

  const app = mount({}, {}, () => {
    actions += 1;
  });

  app.send(app.trigger, "mouseEnter");
  app.send(app.trigger, "mouseDown", { button: 0 });
  app.send(app.trigger, "mouseLeave");
  app.send(app.trigger, "mouseEnter");
  app.send(app.trigger, "mouseUp", { button: 0 });
  app.send(app.trigger, "click", { button: 0, x: 1, y: 1 });
  expect(actions).toBe(0);
});

test("captured hover notifications cannot reopen help until mouse release", () => {
  const app = mount();
  app.send(app.trigger, "mouseEnter");
  app.send(app.trigger, "mouseDown", { button: 0 });
  app.send(app.trigger, "mouseEnter");
  app.send(app.trigger, "mouseMove");
  expect(app.state.isOpen).toBe(false);
  app.send(app.trigger, "mouseUp", { button: 0 });
  app.send(app.trigger, "mouseMove");
  expect(app.state.isOpen).toBe(true);
});

test("press dismissal preserves button keyboard and OS Click actions", () => {
  let actions = 0;

  const app = mount({}, {}, () => {
    actions += 1;
  });

  app.send(app.trigger, "focus");
  app.send(app.trigger, "keyDown", { key: "enter" });
  expect(app.state.isOpen).toBe(false);
  expect(actions).toBe(1);
  app.send(app.trigger, "keyUp", { key: "enter" });
  app.send(app.trigger, "focus");
  app.send(app.trigger, "click");
  expect(app.state.isOpen).toBe(false);
  expect(actions).toBe(2);
  app.send(app.trigger, "focus");
  app.send(app.trigger, "mouseDown");
  expect(app.state.isOpen).toBe(false);
});

test("shouldCloseOnPress false keeps content on press but Escape still closes", () => {
  const app = mount({ shouldCloseOnPress: false });
  app.send(app.trigger, "focus");
  app.send(app.trigger, "keyDown", { key: "a" });
  app.send(app.trigger, "click");
  app.send(app.trigger, "mouseDown");
  expect(app.state.isOpen).toBe(true);
  expect(app.send(app.trigger, "keyDown", { key: "Esc" })).toBe(true);
  expect(app.state.isOpen).toBe(false);
});

test("disabling a tooltip cancels delayed opening and leaves its button enabled", async () => {
  const [disabled, setDisabled] = createSignal(false);

  const app = mount(
    {
      get isDisabled() {
        return disabled();
      },
    },
    { delay: 15 }
  );

  app.send(app.trigger, "mouseEnter");
  setDisabled(true);
  app.root.flush();
  await Bun.sleep(30);
  app.root.flush();
  app.send(app.trigger, "focus");
  app.send(app.trigger, "mouseMove");
  expect(app.state.isOpen).toBe(false);
  expect(app.trigger.props.get("tabIndex")).toBe(0);
  setDisabled(false);
  app.root.flush();
  app.windowKey("tab");
  app.send(app.trigger, "focus");
  expect(app.state.isOpen).toBe(true);
  setDisabled(true);
  app.root.flush();
  expect(app.state.isOpen).toBe(false);
});

test("controlled parents can accept and reject open and close requests", () => {
  const [open, setOpen] = createSignal(false);
  const requests: boolean[] = [];
  let accept = false;

  const app = mount(
    {},
    {
      get isOpen() {
        return open();
      },
      onOpenChange(next) {
        requests.push(next);

        if (accept) {
          setOpen(next);
        }
      },
    }
  );

  app.send(app.trigger, "focus");
  expect(requests.at(-1)).toBe(true);
  expect(app.state.isOpen).toBe(false);
  accept = true;
  app.send(app.trigger, "focus");
  expect(app.state.isOpen).toBe(true);
  accept = false;
  app.windowKey("escape");
  expect(requests.at(-1)).toBe(false);
  expect(app.state.isOpen).toBe(true);
  accept = true;
  app.windowKey("escape");
  expect(app.state.isOpen).toBe(false);
});

test("opening another tooltip closes the previous one", () => {
  const first = mount();
  const second = mount();
  first.send(first.trigger, "focus");
  second.send(second.trigger, "focus");
  first.root.flush();
  expect(first.state.isOpen).toBe(false);
  expect(first.content?.mounted).toBe(false);
  expect(second.state.isOpen).toBe(true);
});

test("window Escape dismisses a hovered tooltip before its containing overlay", () => {
  const app = setup();
  roots.add(app.root);
  let trigger!: HostElement;
  let container!: HostElement;
  let tooltipState!: ReturnType<typeof createTooltipTriggerState>;
  let overlayCloses = 0;
  app.root.render(() => {
    const overlay = createOverlay(
      {
        isOpen: true,
        onClose() {
          overlayCloses += 1;
        },
      },
      () => container
    );

    tooltipState = createTooltipTriggerState({ delay: 0 });
    const tooltip = createTooltipTrigger({}, tooltipState, () => trigger);

    return jsx(
      "div",
      merge(overlay.overlayProps, {
        children: jsx(
          "div",
          merge(tooltip.triggerProps, {
            ref: (node: HostElement) => {
              trigger = node;
            },
          })
        ),
        ref: (node: HostElement) => {
          container = node;
        },
      })
    );
  });
  app.send(trigger, "mouseEnter");
  app.windowKey("escape");
  expect(tooltipState.isOpen).toBe(false);
  expect(overlayCloses).toBe(0);
  app.windowKey("escape");
  expect(overlayCloses).toBe(1);
});

test("disposing a pending tooltip cancels timers and removes its Escape layer", async () => {
  const changes: boolean[] = [];

  const pending = mount(
    {},
    {
      delay: 15,
      onOpenChange(open) {
        changes.push(open);
      },
    }
  );

  pending.send(pending.trigger, "mouseEnter");
  pending.root.unmount();
  await Bun.sleep(30);
  expect(changes).toEqual([]);
  const app = mount({}, { defaultOpen: true });
  expect(app.state.isOpen).toBe(true);
  app.root.unmount();
  expect(app.content?.mounted).toBe(false);
  expect(() => {
    app.windowKey("escape");
  }).not.toThrow();
});
