import { expect, test } from "bun:test";

import type { HostElement } from "gpuix-solid2";
import { createCheckboxGroupState } from "gpuix-solid2-stately";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import {
  createCheckboxGroup,
  createCheckboxGroupItem,
} from "../src/checkbox-group.js";
import type { CheckboxGroupItemProps } from "../src/checkbox-group.js";
import { setup } from "./support.js";

test("CheckboxGroup adds and removes values, exposes validation, and gives each item a Tab stop", () => {
  const app = setup();
  let group!: HostElement;
  let news!: HostElement;
  let offers!: HostElement;
  let values!: () => readonly string[];
  let aria!: ReturnType<typeof createCheckboxGroup>;
  const changes: string[][] = [];
  const itemChanges: boolean[] = [];
  app.root.render(() => {
    const state = createCheckboxGroupState({
      defaultValue: ["news"],
      isRequired: true,
      onChange: (next) => {
        changes.push(next);
      },
      validate: (next) => (next.length === 0 ? "Choose a topic" : null),
    });

    values = () => state.value;
    aria = createCheckboxGroup({ "aria-label": "Topics" }, state);
    const first = createCheckboxGroupItem({ value: "news" }, state, () => news);

    const second = createCheckboxGroupItem(
      {
        onChange: (next) => {
          itemChanges.push(next);
        },
        value: "offers",
      },
      state,
      () => offers
    );

    return jsx(
      "div",
      merge(aria.groupProps, {
        children: [
          jsx(
            "div",
            merge(first.inputProps, {
              ref: (el: HostElement) => {
                news = el;
              },
            })
          ),
          jsx(
            "div",
            merge(second.inputProps, {
              ref: (el: HostElement) => {
                offers = el;
              },
            })
          ),
        ],
        ref: (el: HostElement) => {
          group = el;
        },
      })
    );
  });
  expect(group.props.get("role")).toBe("group");
  expect(group.props.get("aria-label")).toBe("Topics");
  expect(news.props.get("role")).toBe("checkbox");
  expect(news.props.get("tabIndex")).toBe(0);
  expect(offers.props.get("tabIndex")).toBe(0);
  app.send(offers, "keyDown", { key: "enter" });
  app.send(offers, "keyUp", { key: "enter" });
  expect(values()).toEqual(["news"]);
  app.send(offers, "keyDown", { key: "space" });
  expect(values()).toEqual(["news"]);
  app.send(offers, "keyUp", { key: "space" });
  expect(values()).toEqual(["news", "offers"]);
  expect(offers.props.get("aria-checked")).toBe(true);
  app.send(news, "mouseDown", { button: 0 });
  app.send(news, "mouseUp", { button: 0 });
  app.send(news, "click", { button: 0, x: 1, y: 1 });
  expect(values()).toEqual(["offers"]);
  app.send(offers, "click");
  expect(values()).toEqual([]);
  expect(changes).toEqual([["news", "offers"], ["offers"], []]);
  expect(itemChanges).toEqual([true, false]);
  expect(news.props.get("aria-required")).toBe(true);
  expect(offers.props.get("aria-required")).toBe(true);
  expect(aria.isInvalid).toBe(true);
  expect(aria.validationErrors).toEqual(["Choose a topic"]);
  expect(aria.validationDetails.customError).toBe(true);
  expect(group.props.get("aria-invalid")).toBe(true);
  expect(news.props.get("aria-invalid")).toBe(true);
  app.send(news, "click");
  expect(aria.isInvalid).toBe(false);
  expect(aria.validationErrors).toEqual([]);
  expect(offers.props.get("aria-required")).toBe(false);
});

test("CheckboxGroup controlled requests follow the parent, including rejected changes and reactive item values", () => {
  const app = setup();
  let item!: HostElement;
  let update!: Setter<string[]>;
  let rename!: Setter<string>;
  let accept = false;
  const requests: string[][] = [];
  const itemChanges: boolean[] = [];
  app.root.render(() => {
    const [value, setValue] = createSignal<string[]>([]);
    const [name, setName] = createSignal("news");
    update = setValue;
    rename = setName;

    const state = createCheckboxGroupState({
      onChange: (next) => {
        requests.push(next);

        if (accept) {
          setValue(next);
        }
      },
      get value() {
        return value();
      },
    });

    const checkbox = createCheckboxGroupItem(
      {
        onChange: (next) => {
          itemChanges.push(next);
        },
        get value() {
          return name();
        },
      },
      state,
      () => item
    );

    return jsx(
      "div",
      merge(checkbox.inputProps, {
        ref: (el: HostElement) => {
          item = el;
        },
      })
    );
  });
  app.send(item, "click");
  expect(requests).toEqual([["news"]]);
  expect(item.props.get("aria-checked")).toBe(false);
  accept = true;
  app.send(item, "click");
  expect(item.props.get("aria-checked")).toBe(true);
  accept = false;
  app.send(item, "click");
  expect(item.props.get("aria-checked")).toBe(true);
  expect(itemChanges).toEqual([true, true, false]);
  app.root.flushSync(() => {
    update(["offers"]);
    rename("offers");
  });
  expect(item.props.get("aria-checked")).toBe(true);
  app.send(item, "click");
  expect(requests.at(-1)).toEqual([]);
});

for (const guard of ["isDisabled", "isReadOnly"] as const) {
  test(`CheckboxGroup enforces reactive group and item ${guard} guards`, () => {
    const app = setup();
    let item!: HostElement;
    let groupGuard!: Setter<boolean>;
    let itemGuard!: Setter<boolean>;
    let callbacks = 0;
    app.root.render(() => {
      const [groupBlocked, setGroupBlocked] = createSignal(false);
      const [itemBlocked, setItemBlocked] = createSignal(false);
      groupGuard = setGroupBlocked;
      itemGuard = setItemBlocked;

      const state = createCheckboxGroupState({
        get [guard]() {
          return groupBlocked();
        },
        onChange: () => {
          callbacks += 1;
        },
      });

      const props: CheckboxGroupItemProps = {
        get [guard]() {
          return itemBlocked();
        },
        onChange: () => {
          callbacks += 1;
        },
        value: "news",
      };

      const checkbox = createCheckboxGroupItem(props, state, () => item);

      return jsx(
        "div",
        merge(checkbox.inputProps, {
          ref: (el: HostElement) => {
            item = el;
          },
        })
      );
    });
    app.send(item, "keyDown", { key: "space" });
    app.root.flushSync(() => {
      groupGuard(true);
    });
    app.send(item, "keyUp", { key: "space" });
    app.send(item, "click");
    expect(item.props.get("aria-checked")).toBe(false);
    expect(item.props.get("tabIndex")).toBe(guard === "isDisabled" ? -1 : 0);
    expect(callbacks).toBe(0);
    app.root.flushSync(() => {
      groupGuard(false);
      itemGuard(true);
    });
    app.send(item, "click");
    expect(callbacks).toBe(0);
    app.root.flushSync(() => {
      itemGuard(false);
    });
    app.send(item, "click");
    expect(item.props.get("aria-checked")).toBe(true);
    expect(callbacks).toBe(2);
  });
}

test("CheckboxGroup cancels Space on blur and unmount, and defaults do not reset selection", () => {
  const app = setup();
  let item!: HostElement;
  let defaults!: Setter<string[]>;
  const requests: string[][] = [];
  app.root.render(() => {
    const [value, setValue] = createSignal<string[]>([]);
    defaults = setValue;

    const state = createCheckboxGroupState({
      get defaultValue() {
        return value();
      },
      onChange: (next) => {
        requests.push(next);
      },
    });

    const checkbox = createCheckboxGroupItem(
      { value: "news" },
      state,
      () => item
    );

    return jsx(
      "div",
      merge(checkbox.inputProps, {
        ref: (el: HostElement) => {
          item = el;
        },
      })
    );
  });
  app.root.flushSync(() => {
    defaults(["news"]);
  });
  expect(item.props.get("aria-checked")).toBe(false);
  app.send(item, "keyDown", { key: "space" });
  app.send(item, "blur");
  app.send(item, "keyUp", { key: "space" });
  expect(requests).toEqual([]);
  app.send(item, "keyDown", { key: "space" });
  app.root.unmount();
  expect(item.mounted).toBe(false);
  app.send(item, "keyUp", { key: "space" });
  app.send(item, "click");
  expect(requests).toEqual([]);
});
