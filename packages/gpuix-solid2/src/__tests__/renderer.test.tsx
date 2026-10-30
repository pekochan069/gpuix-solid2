import { afterEach, describe, expect, test } from "bun:test";

import { createSignal, For, Show, onSettled } from "solid-js";
import type { Setter } from "solid-js";

import type { HostElement } from "../host.js";
import { createSelectedText, createWindowSize } from "../primitives.js";
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

describe("Solid 2 universal renderer", () => {
  test("commits queued signal, text, and style updates in flushSync", () => {
    const app = setup();

    let update!: Setter<number>;

    app.root.render(() => {
      const [count, setCount] = createSignal(0);

      update = setCount;

      return (
        <div style={{ padding: count() }}>
          <text>count {count()}</text>
        </div>
      );
    });

    expect(app.mutations()).toContainEqual([
      "setText",
      expect.any(Number),
      "0",
    ]);

    app.root.flushSync(() => update(2));

    expect(app.mutations()).toContainEqual([
      "setText",
      expect.any(Number),
      "2",
    ]);

    expect(app.mutations()).toContainEqual([
      "setStyle",
      expect.any(Number),
      { padding: 2 },
    ]);
  });

  test("updates automatically after microtasks", async () => {
    const app = setup();

    let update!: Setter<string>;

    app.root.render(() => {
      const [value, setValue] = createSignal("before");

      update = setValue;

      return <text>{value()}</text>;
    });

    update("after");

    await Promise.resolve();

    await Promise.resolve();

    expect(app.mutations()).toContainEqual([
      "setText",
      expect.any(Number),
      "after",
    ]);
  });

  test("dispatch commits updates and ignores listeners after disposal", () => {
    const app = setup();

    let button!: HostElement;

    app.root.render(() => {
      const [count, setCount] = createSignal(0);

      return (
        <div
          ref={(element) => {
            button = element;
          }}
          onClick={() => {
            setCount((value) => value + 1);
          }}
        >
          <text>{count()}</text>
        </div>
      );
    });

    expect(
      app.root.dispatch({ elementId: button.id, eventType: "click" })
    ).toBe(true);

    expect(app.mutations()).toContainEqual([
      "setText",
      expect.any(Number),
      "1",
    ]);

    app.root.unmount();

    expect(
      app.root.dispatch({ elementId: button.id, eventType: "click" })
    ).toBe(false);
  });

  test("supports fragment roots, keyed moves, and conditional removal", () => {
    const app = setup();

    let change!: () => void;

    let list!: HostElement;

    app.root.render(() => {
      const [items, setItems] = createSignal(["a", "b", "c"]);

      const [show, setShow] = createSignal(true);

      change = () => {
        setItems(["c", "a"]);

        setShow(false);
      };

      return (
        <>
          <text>first</text>
          <div
            ref={(element) => {
              list = element;
            }}
          >
            <Show when={show()}>
              <text>shown</text>
            </Show>
            <For each={items()}>{(item) => <text>{item}</text>}</For>
          </div>
        </>
      );
    });

    app.root.flushSync(change);

    expect(
      list.children
        .filter((node) => node.kind === "element")
        .map((node) =>
          node.children
            .map((child) => (child.kind === "text" ? child.text : ""))
            .join("")
        )
    ).toEqual(["c", "a"]);

    app.root.unmount();

    expect(
      app
        .mutations()
        .some(
          (mutation) =>
            Array.isArray(mutation) && mutation[0] === "destroyElement"
        )
    ).toBe(true);
  });

  test("composes callback refs and cleans component resources on remount", () => {
    const app = setup();

    const refs: HostElement[] = [];

    let disposed = 0;

    app.root.render(() => {
      onSettled(() => () => {
        disposed += 1;
      });

      return (
        <input
          ref={[
            (element) => {
              refs.push(element);
            },
            (element) => {
              refs.push(element);
            },
          ]}
          value="hello"
        />
      );
    });

    expect(refs).toHaveLength(2);

    expect(refs[0]).toBe(refs[1]);

    app.root.render(() => <text>replacement</text>);

    expect(disposed).toBe(1);
  });

  test("owns native selection and window subscriptions", () => {
    const app = setup();

    app.root.render(() => {
      const selected = createSelectedText();

      const size = createWindowSize({ intervalMs: 60_000 });

      return (
        <text>
          {size().width}:{selected() ?? "empty"}
        </text>
      );
    });

    expect(app.mutations()).toContainEqual([
      "setText",
      expect.any(Number),
      "800",
    ]);

    expect(app.mutations()).toContainEqual([
      "setText",
      expect.any(Number),
      "empty",
    ]);
  });
});

test("replaces spread listeners and removes undefined handlers", () => {
  const app = setup();

  let target!: HostElement;

  let replace!: Setter<{ onClick?: () => void }>;

  const calls: string[] = [];

  app.root.render(() => {
    const [handlers, setHandlers] = createSignal<{ onClick?: () => void }>({
      onClick: () => {
        calls.push("first");
      },
    });

    replace = setHandlers;

    return (
      <div
        ref={(element) => {
          target = element;
        }}
        {...handlers()}
      />
    );
  });

  app.root.dispatch({ elementId: target.id, eventType: "click" });

  app.root.flushSync(() => {
    replace({
      onClick: () => {
        calls.push("second");
      },
    });
  });

  app.root.dispatch({ elementId: target.id, eventType: "click" });

  app.root.flushSync(() => {
    replace({ onClick: undefined });
  });

  expect(app.root.dispatch({ elementId: target.id, eventType: "click" })).toBe(
    false
  );

  expect(calls).toEqual(["first", "second"]);
});
