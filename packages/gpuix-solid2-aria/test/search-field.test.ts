import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { pushDismissLayer } from "gpuix-solid2";
import { createSearchFieldState } from "gpuix-solid2-stately";
import type { SearchFieldState } from "gpuix-solid2-stately/searchfield/create-search-field-state";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge, Show } from "solid-js";
import type { Setter } from "solid-js";

import { createButton } from "../src/controls.js";
import { createSearchField } from "../src/search-field.js";
import type { SearchFieldProps } from "../src/search-field.js";
import { setup } from "./support.js";

const setupSearch = (
  create: () => { state: SearchFieldState; props?: SearchFieldProps }
) => {
  const app = setup();
  let input!: HostElement;
  let clear!: HostElement;
  let behavior!: ReturnType<typeof createSearchField>;
  app.root.render(() => {
    const options = create();
    behavior = createSearchField(
      options.props ?? {},
      options.state,
      () => input
    );
    const button = createButton(behavior.clearButtonProps, () => clear);

    return [
      jsx(
        "input",
        merge(behavior.inputProps, {
          ref: (node: HostElement) => {
            input = node;
          },
        })
      ),
      jsx(
        "div",
        merge(button.buttonProps, {
          ref: (node: HostElement) => {
            clear = node;
          },
        })
      ),
    ];
  });

  return { ...app, behavior, clear, input };
};

test("SearchField edits shared state and submits once through the native editor", () => {
  const changes: string[] = [];
  const submits: string[] = [];
  const keys: string[] = [];

  const app = setupSearch(() => ({
    props: {
      "aria-description": "Find a document",
      "aria-label": "Search",
      onKeyDown: (event) => {
        keys.push(event.key ?? "");
      },
      onSubmit: (value) => {
        submits.push(value);
      },
      placeholder: "Query",
    },
    state: createSearchFieldState({
      defaultValue: "initial",
      onChange: (value) => {
        changes.push(value);
      },
    }),
  }));

  expect(app.input.props.get("value")).toBe("initial");
  expect(app.input.props.get("role")).toBe("searchbox");
  expect(app.input.props.get("aria-description")).toBe("Find a document");
  expect(app.input.props.get("placeholder")).toBe("Query");
  app.send(app.input, "change", { value: "native" });
  app.send(app.input, "keyDown", { key: "return" });
  app.send(app.input, "submit");
  app.send(app.input, "keyUp", { key: "return" });
  expect(app.behavior.value).toBe("native");
  expect(changes).toEqual(["native"]);
  expect(submits).toEqual(["native"]);
  expect(keys).toEqual(["Enter"]);
});

test("Escape clears once and consumes dismissal only while there is a value", () => {
  let clears = 0;
  let dismissals = 0;

  const app = setupSearch(() => ({
    props: {
      onClear: () => {
        clears += 1;
      },
    },
    state: createSearchFieldState({ defaultValue: "query" }),
  }));

  const pop = pushDismissLayer(app.renderer, {
    onEscapeKeyDown: () => {
      dismissals += 1;
    },
  });

  const key = (keystrokeId: number, isHeld = false) => {
    app.send(app.input, "keyDown", { isHeld, key: "escape", keystrokeId });
    app.root.dispatch({
      elementId: 1,
      eventType: "windowKeyDown",
      isHeld,
      key: "escape",
      keystrokeId,
    });
  };

  try {
    key(1);
    expect(app.behavior.value).toBe("");
    expect(clears).toBe(1);
    expect(dismissals).toBe(0);
    key(2);
    expect(clears).toBe(1);
    expect(dismissals).toBe(1);
    app.send(app.input, "change", { value: "again" });
    key(3, true);
    expect(app.behavior.value).toBe("again");
    expect(clears).toBe(1);
  } finally {
    pop();
  }
});

test("Clear button focuses the editor, stays outside Tab order, and supports OS Click", () => {
  let clears = 0;

  const app = setupSearch(() => ({
    props: {
      onClear: () => {
        clears += 1;
      },
    },
    state: createSearchFieldState({ defaultValue: "query" }),
  }));

  expect(app.clear.props.get("aria-label")).toBe("Clear search");
  expect(app.clear.props.get("tabIndex")).toBe(-1);
  app.send(app.clear, "mouseDown", { button: 0 });
  expect(app.behavior.value).toBe("query");
  expect(app.focusCalls.at(-1)).toBe(app.input.id);
  app.send(app.clear, "mouseUp", { button: 0 });
  app.send(app.clear, "click", { button: 0 });
  expect(app.behavior.value).toBe("");
  expect(clears).toBe(1);
  app.send(app.input, "change", { value: "os" });
  app.send(app.clear, "click");
  expect(app.behavior.value).toBe("");
  expect(clears).toBe(2);
});

test("Controlled search requests preserve rejection and follow external values", () => {
  const requests: string[] = [];
  let accept = false;
  let update!: Setter<string>;
  let clears = 0;

  const app = setupSearch(() => {
    const [value, setValue] = createSignal("parent");
    update = setValue;

    return {
      props: {
        onClear: () => {
          clears += 1;
        },
      },
      state: createSearchFieldState({
        onChange(next) {
          requests.push(next);

          if (accept) {
            setValue(next);
          }
        },
        get value() {
          return value();
        },
      }),
    };
  });

  app.send(app.input, "change", { value: "rejected" });
  expect(app.behavior.value).toBe("parent");
  app.send(app.input, "keyDown", { key: "esc" });
  expect(app.input.props.get("value")).toBe("parent");
  expect(requests).toEqual(["rejected", ""]);
  expect(clears).toBe(1);
  accept = true;
  app.send(app.clear, "click");
  expect(app.behavior.value).toBe("");
  app.root.flushSync(() => update("external"));
  expect(app.input.props.get("value")).toBe("external");
});

test("Reactive disabled and readonly guards block editor, submit, Escape, and clear", () => {
  let disable!: Setter<boolean>;
  let lock!: Setter<boolean>;
  let label!: Setter<string>;
  let actions = 0;

  const app = setupSearch(() => {
    const [disabled, setDisabled] = createSignal(false);
    const [readonly, setReadonly] = createSignal(false);
    const [clearLabel, setLabel] = createSignal("Clear search");
    disable = setDisabled;
    lock = setReadonly;
    label = setLabel;

    return {
      props: {
        get clearButtonLabel() {
          return clearLabel();
        },
        get isDisabled() {
          return disabled();
        },
        get isReadOnly() {
          return readonly();
        },
        onClear: () => {
          actions += 1;
        },
        onSubmit: () => {
          actions += 1;
        },
      },
      state: createSearchFieldState({ defaultValue: "locked" }),
    };
  });

  const attempt = () => {
    app.send(app.input, "change", { value: "changed" });
    app.send(app.input, "submit");
    app.send(app.input, "keyDown", { key: "escape" });
    app.send(app.clear, "click");
  };

  app.send(app.clear, "keyDown", { key: "space" });
  app.root.flushSync(() => disable(true));
  app.send(app.clear, "keyUp", { key: "space" });
  attempt();
  expect(app.behavior.value).toBe("locked");
  expect(actions).toBe(0);
  expect(app.input.props.get("tabIndex")).toBe(-1);
  expect(app.input.props.get("readOnly")).toBe(true);
  app.root.flushSync(() => {
    disable(false);
    lock(true);
    label("검색 지우기");
  });
  attempt();
  expect(app.behavior.value).toBe("locked");
  expect(actions).toBe(0);
  expect(app.input.props.get("tabIndex")).toBe(0);
  expect(app.clear.props.get("aria-disabled")).toBe(true);
  expect(app.clear.props.get("aria-label")).toBe("검색 지우기");
  app.root.flushSync(() => lock(false));
  app.send(app.clear, "click");
  expect(app.behavior.value).toBe("");
  expect(actions).toBe(1);
});

test("Search keyboard cancellation and focus callbacks compose with editor props", () => {
  const events: string[] = [];

  const app = setupSearch(() => ({
    props: {
      onBlur: () => {
        events.push("blur");
      },
      onFocus: () => {
        events.push("focus");
      },
      onFocusChange: (focused) => {
        events.push(String(focused));
      },
      onKeyDown(event) {
        event.preventDefault();
        events.push(event.key ?? "");
      },
      onKeyUp: (event) => {
        events.push(event.key ?? "");
      },
    },
    state: createSearchFieldState({ defaultValue: "query" }),
  }));

  app.send(app.input, "focus");
  app.send(app.input, "keyDown", { key: "esc" });
  app.send(app.input, "keyUp", { key: "esc" });
  app.send(app.input, "blur");
  expect(app.behavior.value).toBe("query");
  expect(events).toEqual([
    "focus",
    "true",
    "Escape",
    "Escape",
    "blur",
    "false",
  ]);
});

test("Unmount removes search and clear handlers and cancels pending presses", () => {
  const app = setup();
  let input!: HostElement;
  let clear!: HostElement;
  let hide!: Setter<boolean>;
  let clears = 0;
  app.root.render(() => {
    const [visible, setVisible] = createSignal(true);
    hide = setVisible;

    return jsx(Show, {
      children: () => {
        const search = createSearchField(
          {
            onClear: () => {
              clears += 1;
            },
          },
          createSearchFieldState({ defaultValue: "query" }),
          () => input
        );

        const button = createButton(search.clearButtonProps, () => clear);

        return [
          jsx(
            "input",
            merge(search.inputProps, {
              ref: (node: HostElement) => {
                input = node;
              },
            })
          ),
          jsx(
            "div",
            merge(button.buttonProps, {
              ref: (node: HostElement) => {
                clear = node;
              },
            })
          ),
        ];
      },
      get when() {
        return visible();
      },
    });
  });
  app.send(clear, "keyDown", { key: "space" });
  app.root.flushSync(() => hide(false));
  expect(input.mounted).toBe(false);
  expect(clear.mounted).toBe(false);
  expect(app.send(input, "keyDown", { key: "escape" })).toBe(false);
  expect(app.send(clear, "keyUp", { key: "space" })).toBe(false);
  expect(app.send(clear, "click")).toBe(false);
  expect(clears).toBe(0);
});
