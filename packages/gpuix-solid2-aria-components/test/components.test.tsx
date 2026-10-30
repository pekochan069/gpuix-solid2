import { afterEach, expect, test } from "bun:test";

import { createRoot } from "gpuix-solid2";
import type { HostElement, NativeRenderer } from "gpuix-solid2";
import { createSignal, Show } from "solid-js";
import type { Setter } from "solid-js";

import {
  Button,
  ButtonContext,
  Checkbox,
  CheckboxContext,
  DEFAULT_SLOT,
  ToggleButton,
  ToggleButtonContext,
} from "../src/index.js";
import type {
  ButtonRenderProps,
  CheckboxRenderProps,
  ToggleButtonRenderProps,
} from "../src/index.js";

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

const setup = () => {
  const focused: number[] = [];

  const renderer: NativeRenderer = {
    applyBatch: () => [],
    focusElement: (id) => {
      focused.push(id);
    },
  };

  const root = createRoot(renderer);
  disposers.push(root.unmount);

  return {
    focused,
    root,
    send(node: HostElement, eventType: string, key?: string) {
      root.dispatch({ elementId: node.id, eventType, key });
      root.flush();
    },
  };
};

const text = (node: HostElement["children"][number]): string =>
  node.kind === "text" ? node.text : node.children.map(text).join("");

test("Button composes focus and hover callbacks with press cancellation and reactive render props", () => {
  const app = setup();
  let node!: HostElement;
  let values!: ButtonRenderProps;
  let disable!: Setter<boolean>;
  let presses = 0;
  const focus: boolean[] = [];
  const hover: boolean[] = [];
  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);
    disable = setDisabled;

    return (
      <Button
        ref={(el) => {
          node = el;
        }}
        isDisabled={disabled()}
        onPress={() => {
          presses += 1;
        }}
        onFocusChange={(value) => {
          focus.push(value);
        }}
        onHoverChange={(value) => {
          hover.push(value);
        }}
        style={(state) => ({ opacity: state.isDisabled ? 0.5 : 1 })}
      >
        {(state) => {
          values = state;

          return state.isDisabled ? "Disabled" : "Save";
        }}
      </Button>
    );
  });
  app.send(node, "keyDown", "enter");
  app.send(node, "keyUp", "enter");
  app.send(node, "keyDown", "space");
  expect(values.isPressed).toBe(true);
  app.send(node, "keyUp", "space");
  expect(presses).toBe(2);
  expect(values.isPressed).toBe(false);
  app.send(node, "focus");
  expect(values.isFocusVisible).toBe(true);
  expect(focus).toEqual([true]);
  app.send(node, "mouseEnter");
  app.send(node, "mouseDown");
  app.send(node, "mouseLeave");
  expect(values.isPressed).toBe(false);
  expect(values.isHovered).toBe(false);
  expect(hover).toEqual([true, false]);
  app.send(node, "keyDown", "space");
  app.send(node, "blur");
  app.send(node, "keyUp", "space");
  expect(presses).toBe(2);
  expect(focus).toEqual([true, false]);
  app.root.flushSync(() => disable(true));
  app.send(node, "click");
  expect(presses).toBe(2);
  expect(node.props.get("tabIndex")).toBe(-1);
  expect(node.style.opacity).toBe(0.5);
  expect(text(node)).toBe("Disabled");
});

test("pending Button blocks activation while retaining its Tab stop and focus callbacks", () => {
  const app = setup();
  let node!: HostElement;
  let pending!: Setter<boolean>;
  let count = 0;
  let focused = false;
  app.root.render(() => {
    const [value, setValue] = createSignal(false);
    pending = setValue;

    return (
      <Button
        ref={(el) => {
          node = el;
        }}
        isPending={value()}
        onPress={() => {
          count += 1;
        }}
        onFocusChange={(next) => {
          focused = next;
        }}
      >
        {(state) => (state.isPending ? "Saving" : "Save")}
      </Button>
    );
  });
  app.send(node, "keyDown", "space");
  app.root.flushSync(() => pending(true));
  app.send(node, "keyUp", "space");
  app.send(node, "click");
  app.send(node, "keyDown", "enter");
  app.send(node, "focus");
  expect(count).toBe(0);
  expect(focused).toBe(true);
  expect(node.props.get("tabIndex")).toBe(0);
  expect(text(node)).toBe("Saving");
  app.root.flushSync(() => pending(false));
  app.send(node, "click");
  expect(count).toBe(1);
});

test("ToggleButton supports uncontrolled state and controlled change requests", () => {
  const app = setup();
  let uncontrolled!: HostElement;
  let controlled!: HostElement;
  let values!: ToggleButtonRenderProps;
  let select!: Setter<boolean>;
  const changes: boolean[] = [];
  app.root.render(() => {
    const [selected, setSelected] = createSignal(false);
    select = setSelected;

    return (
      <div>
        <ToggleButton
          defaultSelected
          ref={(el) => {
            uncontrolled = el;
          }}
        >
          {(state) => {
            values = state;

            return state.isSelected ? "On" : "Off";
          }}
        </ToggleButton>
        <ToggleButton
          isSelected={selected()}
          ref={(el) => {
            controlled = el;
          }}
          onChange={(value) => {
            changes.push(value);
          }}
        >
          {(state) => (state.isSelected ? "Selected" : "Unselected")}
        </ToggleButton>
      </div>
    );
  });
  expect(values.isSelected).toBe(true);
  app.send(uncontrolled, "click");
  expect(values.isSelected).toBe(false);
  expect(text(uncontrolled)).toBe("Off");
  app.send(controlled, "keyDown", "enter");
  app.send(controlled, "keyUp", "enter");
  expect(changes).toEqual([true]);
  expect(text(controlled)).toBe("Unselected");
  app.root.flushSync(() => select(true));
  expect(text(controlled)).toBe("Selected");
  app.send(controlled, "click");
  expect(changes).toEqual([true, false]);
  expect(text(controlled)).toBe("Selected");
});

test("Checkbox uses one native surface, Space activation, readonly guards, and reactive mixed state", () => {
  const app = setup();
  let node!: HostElement;
  let input!: HostElement;
  let values!: CheckboxRenderProps;
  let readonly!: Setter<boolean>;
  let mixed!: Setter<boolean>;
  const changes: boolean[] = [];
  app.root.render(() => {
    const [readOnly, setReadOnly] = createSignal(false);
    const [indeterminate, setIndeterminate] = createSignal(true);
    readonly = setReadOnly;
    mixed = setIndeterminate;

    return (
      <Checkbox
        ref={(el) => {
          node = el;
        }}
        inputRef={(el) => {
          input = el;
        }}
        isReadOnly={readOnly()}
        isIndeterminate={indeterminate()}
        isRequired
        isInvalid
        onChange={(value) => {
          changes.push(value);
        }}
        style={(state) => ({ opacity: state.isReadOnly ? 0.5 : 1 })}
      >
        {(state) => {
          values = state;

          return state.isSelected ? "Checked" : "Unchecked";
        }}
      </Checkbox>
    );
  });
  expect(input).toBe(node);
  expect(node.type).toBe("div");
  expect(node.props.get("role")).toBe("checkbox");
  expect(node.props.get("aria-checked")).toBe("mixed");
  expect(node.props.get("aria-pressed")).toBeUndefined();
  expect(values.isRequired).toBe(true);
  expect(values.isInvalid).toBe(true);
  app.send(node, "keyDown", "enter");
  app.send(node, "keyUp", "enter");
  expect(changes).toEqual([]);
  app.send(node, "keyDown", "space");
  app.send(node, "keyUp", "space");
  expect(changes).toEqual([true]);
  expect(text(node)).toBe("Checked");
  app.root.flushSync(() => {
    readonly(true);
    mixed(false);
  });
  app.send(node, "click");
  app.send(node, "keyDown", "space");
  app.send(node, "keyUp", "space");
  expect(changes).toEqual([true]);
  expect(values.isIndeterminate).toBe(false);
  expect(node.props.get("aria-checked")).toBe(true);
  expect(node.style.opacity).toBe(0.5);
});

test("context slots compose callbacks and refs, preserve reactive defaults, and allow opting out", () => {
  const app = setup();
  let save!: HostElement;
  let plain!: HostElement;
  let defaultNode!: HostElement;
  let contextNode!: HostElement;
  let disable!: Setter<boolean>;
  const calls: string[] = [];
  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);
    disable = setDisabled;

    return (
      <ButtonContext
        value={{
          slots: {
            [DEFAULT_SLOT]: { "aria-label": "Default" },
            get save() {
              return {
                "aria-label": "Context save",
                isDisabled: disabled(),
                onPress: () => {
                  calls.push("context");
                },
                ref: (node: HostElement) => {
                  contextNode = node;
                },
              };
            },
          },
        }}
      >
        <Button
          slot="save"
          ref={[
            (node) => {
              save = node;
            },
          ]}
          onPress={() => {
            calls.push("local");
          }}
        >
          Save
        </Button>
        <Button
          ref={(node) => {
            defaultNode = node;
          }}
        >
          Default
        </Button>
        <Button
          slot={null}
          ref={(node) => {
            plain = node;
          }}
        >
          Plain
        </Button>
      </ButtonContext>
    );
  });
  expect(contextNode).toBe(save);
  expect(save.props.get("aria-label")).toBe("Context save");
  expect(defaultNode.props.get("aria-label")).toBe("Default");
  expect(plain.props.get("aria-label")).toBeUndefined();
  app.send(save, "click");
  expect(calls).toEqual(["context", "local"]);
  app.root.flushSync(() => disable(true));
  expect(save.props.get("tabIndex")).toBe(-1);
  app.send(save, "click");
  expect(calls).toEqual(["context", "local"]);
});

test("selection contexts chain change callbacks and local props override defaults", () => {
  const app = setup();
  let toggle!: HostElement;
  let checkbox!: HostElement;
  let contextInput!: HostElement;
  let localInput!: HostElement;
  const changes: string[] = [];
  app.root.render(() => (
    <div>
      <ToggleButtonContext
        value={{
          defaultSelected: true,
          onChange: (value) => {
            changes.push(`toggle context ${value}`);
          },
        }}
      >
        <ToggleButton
          defaultSelected={false}
          ref={(node) => {
            toggle = node;
          }}
          onChange={(value) => {
            changes.push(`toggle local ${value}`);
          }}
        />
      </ToggleButtonContext>
      <CheckboxContext
        value={{
          inputRef: (node) => {
            contextInput = node;
          },
          onChange: (value) => {
            changes.push(`checkbox context ${value}`);
          },
        }}
      >
        <Checkbox
          inputRef={(node) => {
            localInput = node;
          }}
          ref={(node) => {
            checkbox = node;
          }}
          onChange={(value) => {
            changes.push(`checkbox local ${value}`);
          }}
        />
      </CheckboxContext>
    </div>
  ));
  expect(contextInput).toBe(checkbox);
  expect(localInput).toBe(checkbox);
  app.send(toggle, "click");
  app.send(checkbox, "click");
  expect(changes).toEqual([
    "toggle context true",
    "toggle local true",
    "checkbox context true",
    "checkbox local true",
  ]);
});

test("mounted components autofocus and dispose active presses and native subscriptions", () => {
  const app = setup();
  let node!: HostElement;
  let show!: Setter<boolean>;
  const changes: boolean[] = [];
  let presses = 0;
  app.root.render(() => {
    const [visible, setVisible] = createSignal(true);
    show = setVisible;

    return (
      <Show when={visible()}>
        <Button
          autoFocus
          ref={(el) => {
            node = el;
          }}
          onPressChange={(value) => {
            changes.push(value);
          }}
          onPress={() => {
            presses += 1;
          }}
        >
          Save
        </Button>
      </Show>
    );
  });
  expect(app.focused).toContain(node.id);
  app.send(node, "keyDown", "space");
  app.root.flushSync(() => show(false));
  expect(changes).toEqual([true, false]);
  app.send(node, "keyUp", "space");
  app.send(node, "click");
  expect(presses).toBe(0);
  expect(node.mounted).toBe(false);
});
