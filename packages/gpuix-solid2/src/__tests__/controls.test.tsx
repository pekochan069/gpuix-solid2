import { afterEach, expect, test } from "bun:test";

import { createSignal, Show } from "solid-js";
import type { Setter } from "solid-js";

import { AnimatePresence } from "../components/animate-presence.js";
import { Button } from "../components/button.js";
import {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxContent,
  ComboboxItem,
} from "../components/combobox.js";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogPopup,
  DialogClose,
} from "../components/dialog.js";
import { motion } from "../components/motion.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select.js";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../components/tooltip.js";
import type { HostElement } from "../host.js";
import { createRecorder } from "./recorder.js";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

const setup = () => {
  const app = createRecorder();

  cleanups.push(() => {
    app.root.unmount();
  });

  return app;
};

test("Button responds to keyboard and reactive disabled/style props", () => {
  const app = setup();

  let button!: HostElement;

  let disable!: Setter<boolean>;

  let clicks = 0;

  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);

    disable = setDisabled;

    return (
      <Button
        asChild
        disabled={disabled()}
        onClick={() => {
          clicks += 1;
        }}
        style={(state) => ({ opacity: state.disabled ? 0.5 : 1 })}
      >
        <div
          ref={(element) => {
            button = element;
          }}
        >
          Save
        </div>
      </Button>
    );
  });

  app.root.dispatch({
    elementId: button.id,
    eventType: "keyDown",
    key: "enter",
  });

  expect(clicks).toBe(1);

  app.root.flushSync(() => disable(true));

  expect(button.style.opacity).toBe(0.5);

  expect(button.props.get("tabIndex")).toBe(-1);

  app.root.dispatch({ elementId: button.id, eventType: "click" });

  expect(clicks).toBe(1);
});

test("Select opens and selects an item with queued Solid state", () => {
  const app = setup();

  let trigger!: HostElement;

  let item!: HostElement;

  let selected = "a";

  app.root.render(() => (
    <Select
      defaultValue="a"
      onValueChange={(value) => {
        selected = value;
      }}
    >
      <SelectTrigger
        ref={(element) => {
          trigger = element;
        }}
      >
        Open
      </SelectTrigger>
      <SelectValue />
      <SelectContent>
        <SelectItem value="a">A</SelectItem>
        <SelectItem value="b" asChild>
          <div
            ref={(element) => {
              item = element;
            }}
          >
            B
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  ));

  app.root.dispatch({ elementId: trigger.id, eventType: "click" });

  expect(item.mounted).toBe(true);

  app.root.dispatch({ elementId: item.id, eventType: "click" });

  expect(selected).toBe("b");

  expect(item.mounted).toBe(false);
});

test("Combobox filters against the newly staged input and submits its highlighted item", () => {
  const app = setup();

  let input!: HostElement;

  let selected: unknown;

  app.root.render(() => (
    <Combobox
      items={["alpha", "beta"]}
      defaultOpen
      autoHighlight
      onValueChange={(value) => {
        selected = value;
      }}
    >
      <ComboboxInput
        ref={(element) => {
          input = element;
        }}
      />
      <ComboboxContent>
        <ComboboxList>
          {(item) => <ComboboxItem value={item}>{item}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ));

  app.root.dispatch({ elementId: input.id, eventType: "change", value: "be" });

  app.root.dispatch({ elementId: input.id, eventType: "submit" });

  expect(selected).toBe("beta");

  expect(input.props.get("value")).toBe("beta");
});

test("Dialog opens and closes through its controls", () => {
  const app = setup();

  let trigger!: HostElement;

  let close!: HostElement;

  app.root.render(() => (
    <Dialog>
      <DialogTrigger
        ref={(element) => {
          trigger = element;
        }}
      >
        Open
      </DialogTrigger>
      <DialogPortal>
        <DialogPopup>
          <DialogClose asChild>
            <div
              ref={(element) => {
                close = element;
              }}
            >
              Close
            </div>
          </DialogClose>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  ));

  app.root.dispatch({ elementId: trigger.id, eventType: "click" });

  expect(close.mounted).toBe(true);

  app.root.dispatch({ elementId: close.id, eventType: "click" });

  expect(close.mounted).toBe(false);
});

test("Tooltip mounts on hover and disposes on click", () => {
  const app = setup();

  let trigger!: HostElement;

  let help!: HostElement;

  app.root.render(() => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={(element) => {
            trigger = element;
          }}
        >
          Hover
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <text
          ref={(element) => {
            help = element;
          }}
        >
          Help
        </text>
      </TooltipContent>
    </Tooltip>
  ));

  app.root.dispatch({ elementId: trigger.id, eventType: "mouseEnter" });

  expect(help.mounted).toBe(true);

  app.root.dispatch({ elementId: trigger.id, eventType: "click" });

  expect(help.mounted).toBe(false);
});

test("AnimatePresence retains exit motion until matching native completion", () => {
  const app = setup();

  let toast!: HostElement;

  let hide!: Setter<boolean>;

  let exits = 0;

  app.root.render(() => {
    const [visible, setVisible] = createSignal(true);

    hide = setVisible;

    return (
      <AnimatePresence
        onExitComplete={() => {
          exits += 1;
        }}
      >
        <Show when={visible()}>
          <motion.div
            ref={(element) => {
              toast = element;
            }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        </Show>
      </AnimatePresence>
    );
  });

  app.root.flushSync(() => hide(false));

  expect(toast.mounted).toBe(true);

  expect(toast.motion?.animate).toEqual({ opacity: 0 });

  app.root.dispatch({
    elementId: toast.id,
    eventType: "motionComplete",
    motionGeneration: 0,
  });

  expect(toast.mounted).toBe(true);

  app.root.dispatch({
    elementId: toast.id,
    eventType: "motionComplete",
    motionGeneration: toast.motion?.generation,
  });

  expect(toast.mounted).toBe(false);

  expect(exits).toBe(1);
});

test("Dialog applies native mutations before moving initial focus", () => {
  const app = setup();

  const focusedBeforeCreation: number[] = [];

  let field!: HostElement;

  app.renderer.focusElement = (id) => {
    if (
      !app
        .mutations()
        .some(
          (mutation) =>
            Array.isArray(mutation) &&
            mutation[0] === "createElement" &&
            mutation[1] === id
        )
    ) {
      focusedBeforeCreation.push(id);
    }
  };

  app.root.render(() => (
    <Dialog defaultOpen>
      <DialogPortal>
        <DialogPopup initialFocus={() => field}>
          <input
            ref={(element) => {
              field = element;
            }}
          />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  ));

  expect(focusedBeforeCreation).toEqual([]);
});

test("AnimatePresence suppresses initial animation and completes immediate removal", () => {
  const app = setup();

  let element!: HostElement;

  let hide!: Setter<boolean>;

  let exits = 0;

  app.root.render(() => {
    const [visible, setVisible] = createSignal(true);

    hide = setVisible;

    return (
      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          exits += 1;
        }}
      >
        <Show when={visible()}>
          <motion.div
            ref={(value) => {
              element = value;
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        </Show>
      </AnimatePresence>
    );
  });

  expect(element.motion?.initial).toBe(false);

  app.root.flushSync(() => {
    hide(false);
  });

  expect(element.mounted).toBe(false);

  expect(exits).toBe(1);
});
