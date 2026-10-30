import { afterEach, expect, test } from "bun:test";
import assert from "node:assert/strict";

import { createRoot } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { I18nProvider } from "gpuix-solid2-aria";
import { createSignal, For, Show } from "solid-js";
import type { Setter } from "solid-js";

import {
  Radio,
  RadioContext,
  RadioGroup,
  RadioGroupContext,
} from "../src/index.js";
import type { RadioRenderProps, RadioGroupRenderProps } from "../src/index.js";

const disposers: (() => void)[] = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

const setup = () => {
  const focused: number[] = [];

  const root = createRoot({
    applyBatch: () => [],
    focusElement: (id) => {
      focused.push(id);
    },
  });

  disposers.push(root.unmount);

  return {
    focused,
    root,
    send(node: HostElement, eventType: string, key?: string) {
      root.dispatch({ elementId: node.id, eventType, key });
    },
  };
};

const getNode = (nodes: Map<string, HostElement>, value: string) => {
  const node = nodes.get(value);
  assert.ok(node);

  return node;
};

const tabs = (...nodes: HostElement[]) =>
  nodes.map((node) => node.props.get("tabIndex"));

test("RadioGroup has one Tab stop, wraps arrows, skips disabled radios and selects on Space, not Enter", () => {
  const app = setup();
  const nodes: HostElement[] = [];
  let values!: RadioGroupRenderProps;
  const changes: string[] = [];
  app.root.render(() => (
    <RadioGroup
      aria-label="Shipping"
      onChange={(value) => {
        changes.push(value);
      }}
    >
      {(state) => {
        values = state;

        return (
          <For each={["a", "b", "c"]}>
            {(value) => (
              <Radio
                value={value}
                isDisabled={value === "b"}
                ref={(node) => {
                  nodes.push(node);
                }}
              >
                {value}
              </Radio>
            )}
          </For>
        );
      }}
    </RadioGroup>
  ));
  const [a, b, c] = nodes;
  assert.ok(a && b && c);
  expect(tabs(...nodes)).toEqual([0, -1, -1]);
  app.send(a, "keyDown", "down");
  expect(values.state.selectedValue).toBe("c");
  expect(app.focused.at(-1)).toBe(c.id);
  expect(tabs(...nodes)).toEqual([-1, -1, 0]);
  app.send(c, "keyDown", "right");
  expect(values.state.selectedValue).toBe("a");
  app.send(a, "keyDown", "up");
  expect(values.state.selectedValue).toBe("c");
  app.send(a, "keyDown", "enter");
  app.send(a, "keyUp", "enter");
  expect(values.state.selectedValue).toBe("c");
  app.send(a, "keyDown", "space");
  app.send(a, "keyUp", "space");
  app.send(a, "click");
  app.send(b, "click");
  expect(values.state.selectedValue).toBe("a");
  expect(changes).toEqual(["c", "a", "c", "a"]);
  expect(a.props.get("role")).toBe("radio");
  expect(a.props.get("aria-checked")).toBe(true);
});

test("controlled requests retain rejected values and accept parent changes", () => {
  const app = setup();
  let a!: HostElement;
  let b!: HostElement;
  let set!: Setter<string | null>;
  let reset!: Setter<string>;
  const changes: string[] = [];
  app.root.render(() => {
    const [value, setValue] = createSignal<string | null>("a");
    set = setValue;
    const [initial, setInitial] = createSignal("a");
    reset = setInitial;

    return (
      <RadioGroup
        value={value()}
        defaultValue={initial()}
        onChange={(next) => {
          changes.push(next);
        }}
      >
        <Radio
          value="a"
          ref={(node) => {
            a = node;
          }}
        />
        <Radio
          value="b"
          ref={(node) => {
            b = node;
          }}
        />
      </RadioGroup>
    );
  });
  app.send(b, "click");
  app.send(a, "keyDown", "down");
  expect(changes).toEqual(["b", "b"]);
  expect(tabs(a, b)).toEqual([0, -1]);
  expect(b.props.get("aria-checked")).toBe(false);
  app.root.flushSync(() => {
    set("b");
    reset("b");
  });
  expect(tabs(a, b)).toEqual([-1, 0]);
  app.root.flushSync(() => set(null));
  expect(a.props.get("aria-checked")).toBe(false);
  expect(b.props.get("aria-checked")).toBe(false);
  expect(tabs(a, b)).toEqual([-1, 0]);
});

test("defaults initialize once; disabled selected options and removal retain a usable Tab stop", () => {
  const app = setup();
  let a!: HostElement;
  let b!: HostElement;
  let disable!: Setter<boolean>;
  let show!: Setter<boolean>;
  let initial!: Setter<string>;
  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);
    disable = setDisabled;
    const [visible, setVisible] = createSignal(true);
    show = setVisible;
    const [value, setValue] = createSignal("b");
    initial = setValue;

    return (
      <RadioGroup defaultValue={value()}>
        <Radio
          value="a"
          ref={(node) => {
            a = node;
          }}
        />
        <Show when={visible()}>
          <Radio
            value="b"
            isDisabled={disabled()}
            ref={(node) => {
              b = node;
            }}
          />
        </Show>
      </RadioGroup>
    );
  });
  expect(tabs(a, b)).toEqual([-1, 0]);
  app.root.flushSync(() => initial("a"));
  expect(b.props.get("aria-checked")).toBe(true);
  app.root.flushSync(() => disable(true));
  expect(tabs(a, b)).toEqual([0, -1]);
  app.root.flushSync(() => disable(false));
  expect(tabs(a, b)).toEqual([-1, 0]);
  app.root.flushSync(() => show(false));
  expect(tabs(a)).toEqual([0]);
  expect(b.mounted).toBe(false);
  app.send(a, "keyDown", "down");
  expect(a.props.get("aria-checked")).toBe(true);
});

test("group disabled and readonly guards stay reactive and expose render flags", () => {
  const app = setup();
  let a!: HostElement;
  let b!: HostElement;
  let disable!: Setter<boolean>;
  let readonly!: Setter<boolean>;
  let values!: RadioRenderProps;
  const changes: string[] = [];
  app.root.render(() => {
    const [disabled, setDisabled] = createSignal(false);
    disable = setDisabled;
    const [readOnly, setReadOnly] = createSignal(true);
    readonly = setReadOnly;

    return (
      <RadioGroup
        defaultValue="a"
        isDisabled={disabled()}
        isReadOnly={readOnly()}
        isRequired
        isInvalid
        onChange={(value) => {
          changes.push(value);
        }}
      >
        <Radio
          value="a"
          ref={(node) => {
            a = node;
          }}
        />
        <Radio
          value="b"
          isDisabled={false}
          ref={(node) => {
            b = node;
          }}
          style={(state) => ({ opacity: state.isSelected ? 1 : 0.5 })}
        >
          {(state) => {
            values = state;

            return state.isSelected ? "On" : "Off";
          }}
        </Radio>
      </RadioGroup>
    );
  });
  app.send(a, "keyDown", "down");
  app.send(b, "click");
  expect(changes).toEqual([]);
  expect(app.focused.at(-1)).toBe(b.id);
  expect(values.isReadOnly).toBe(true);
  expect(values.isRequired).toBe(true);
  expect(values.isInvalid).toBe(true);
  app.root.flushSync(() => {
    readonly(false);
    disable(true);
  });
  expect(tabs(a, b)).toEqual([-1, -1]);
  expect(values.isDisabled).toBe(true);
  app.send(b, "keyDown", "space");
  app.send(b, "keyUp", "space");
  app.send(b, "click");
  expect(changes).toEqual([]);
  app.root.flushSync(() => disable(false));
  app.send(b, "keyDown", "space");
  app.send(b, "keyUp", "space");
  expect(changes).toEqual(["b"]);
  expect(b.style.opacity).toBe(1);
});

test("contexts chain string selection callbacks and native refs and support slots", () => {
  const app = setup();
  let group!: HostElement;
  let contextGroup!: HostElement;
  let a!: HostElement;
  let b!: HostElement;
  let input!: HostElement;
  const changes: string[] = [];
  app.root.render(() => (
    <RadioGroupContext
      value={{
        slots: {
          shipping: {
            "aria-label": "Shipping",
            defaultValue: "a",
            onChange: (value) => {
              changes.push(`context ${value}`);
            },
            ref: (node) => {
              contextGroup = node;
            },
          },
        },
      }}
    >
      <RadioGroup
        slot="shipping"
        ref={(node) => {
          group = node;
        }}
        onChange={(value) => {
          changes.push(`local ${value}`);
        }}
      >
        <RadioContext
          value={{
            slots: {
              option: {
                "aria-label": "Express",
                inputRef: (node) => {
                  input = node;
                },
                value: "b",
              },
            },
          }}
        >
          <Radio
            value="a"
            ref={(node) => {
              a = node;
            }}
            slot={null}
          />
          <Radio
            value="b"
            slot="option"
            ref={(node) => {
              b = node;
            }}
          />
        </RadioContext>
      </RadioGroup>
    </RadioGroupContext>
  ));
  expect(group).toBe(contextGroup);
  expect(group.props.get("aria-label")).toBe("Shipping");
  expect(input).toBe(b);
  expect(b.props.get("aria-label")).toBe("Express");
  app.send(b, "click");
  expect(changes).toEqual(["context b", "local b"]);
  expect(tabs(a, b)).toEqual([-1, 0]);
});

test("horizontal RTL reverses Left and Right and navigation follows reordered native children", () => {
  const app = setup();
  const nodes = new Map<string, HostElement>();
  let reorder!: Setter<string[]>;
  app.root.render(() => {
    const [items, setItems] = createSignal(["a", "b", "c"]);
    reorder = setItems;

    return (
      <I18nProvider locale="ar">
        <RadioGroup orientation="horizontal" defaultValue="a">
          <For each={items()}>
            {(value) => (
              <Radio
                value={value}
                ref={(node) => {
                  nodes.set(value, node);
                }}
              />
            )}
          </For>
        </RadioGroup>
      </I18nProvider>
    );
  });
  let a = getNode(nodes, "a");
  let b = getNode(nodes, "b");
  let c = getNode(nodes, "c");
  app.send(a, "keyDown", "right");
  expect(app.focused.at(-1), "rtl right").toBe(c.id);
  app.send(c, "keyDown", "left");
  expect(app.focused.at(-1), "rtl left").toBe(a.id);
  app.root.flushSync(() => reorder(["a", "c", "b"]));
  a = getNode(nodes, "a");
  b = getNode(nodes, "b");
  c = getNode(nodes, "c");
  app.send(a, "keyDown", "left");
  expect(app.focused.at(-1), "reordered left").toBe(c.id);
  app.send(c, "keyDown", "down");
  expect(app.focused.at(-1), "reordered down").toBe(b.id);
});

test("group guards autofocus and disposal cancels active radio presses", () => {
  const app = setup();
  let disabled!: HostElement;
  let active!: HostElement;
  let survivor!: HostElement;
  let show!: Setter<boolean>;
  const changes: string[] = [];
  const pressed: boolean[] = [];
  app.root.render(() => {
    const [visible, setVisible] = createSignal(true);
    show = setVisible;

    return (
      <div>
        <RadioGroup isDisabled>
          <Radio
            value="disabled"
            autoFocus
            ref={(node) => {
              disabled = node;
            }}
          />
        </RadioGroup>
        <RadioGroup
          onChange={(value) => {
            changes.push(value);
          }}
        >
          <Show when={visible()}>
            <Radio
              value="active"
              ref={(node) => {
                active = node;
              }}
              onPressChange={(value) => {
                pressed.push(value);
              }}
            />
          </Show>
          <Radio
            value="survivor"
            ref={(node) => {
              survivor = node;
            }}
          />
        </RadioGroup>
      </div>
    );
  });
  expect(app.focused).not.toContain(disabled.id);
  app.send(active, "keyDown", "space");
  app.root.flushSync(() => show(false));
  app.send(active, "keyUp", "space");
  expect(changes).toEqual([]);
  expect(pressed).toEqual([true, false]);
  expect(tabs(survivor)).toEqual([0]);
  app.send(survivor, "click");
  expect(changes).toEqual(["survivor"]);
  expect(tabs(disabled)).toEqual([-1]);
});

test("native focus preserves the last focused Tab stop when controlled selection clears", () => {
  const app = setup();
  let a!: HostElement;
  let b!: HostElement;
  let clear!: Setter<string | null>;
  const focus: string[] = [];
  app.root.render(() => {
    const [value, setValue] = createSignal<string | null>("b");
    clear = setValue;

    return (
      <RadioGroup value={value()}>
        <Radio
          value="a"
          ref={(node) => {
            a = node;
          }}
        />
        <RadioContext
          value={{
            onFocus: () => {
              focus.push("context");
            },
            value: "b",
          }}
        >
          <Radio
            value="b"
            ref={(node) => {
              b = node;
            }}
            onFocus={() => {
              focus.push("local");
            }}
          />
        </RadioContext>
      </RadioGroup>
    );
  });
  app.send(b, "focus");
  app.root.flushSync(() => clear(null));
  expect(tabs(a, b)).toEqual([-1, 0]);
  expect(focus).toEqual(["context", "local"]);
});
