import { afterEach, expect, test } from "bun:test";

import { CalendarDate, createCalendar, Time } from "@internationalized/date";
import {
  createAsyncList,
  createCalendarState,
  createComboBoxState,
  createControlledSignal,
  createDateFieldState,
  createDatePickerState,
  createDateRangePickerState,
  createFormValidationState,
  createListData,
  createListState,
  createNumberFieldState,
  createOverlayTriggerState,
  createSelectState,
  createSingleSelectListState,
  createTimeFieldState,
  createToastState,
  createToggleState,
  createTooltipTriggerState,
  createVirtualizerState,
  Item,
  ListLayout,
  Rect,
  Size,
} from "gpuix-solid2-stately";
import {
  getRangeValidationResult,
  getValidationResult,
} from "gpuix-solid2-stately/datepicker/utils";
import {
  createEffect,
  createRoot,
  createSignal,
  flush,
  onCleanup,
} from "solid-js";

const disposers: (() => void)[] = [];

const setup = <T>(fn: () => T): T =>
  createRoot((dispose) => {
    disposers.push(dispose);

    return fn();
  });

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

test("uncontrolled updates accumulate and notify once per distinct value", () => {
  const changes: number[] = [];
  const [external] = setup(() => createSignal<number>());

  const [value, setValue] = setup(() =>
    createControlledSignal<number>(external, 1, (next) => {
      changes.push(next);
    })
  );

  setValue((previous) => previous + 1);
  setValue((previous) => previous + 1);
  setValue(3);
  flush();
  expect(value()).toBe(3);
  expect(changes).toEqual([2, 3]);
});

test("controlled values follow the application signal after change requests", () => {
  const changes: number[] = [];
  const [external, setExternal] = setup(() => createSignal(2));

  const [value, setValue] = setup(() =>
    createControlledSignal(external, undefined, (next) => {
      changes.push(next);
    })
  );

  setValue(5);
  flush();
  expect(changes).toEqual([5]);
  expect(value()).toBe(2);
  setExternal(5);
  flush();
  expect(value()).toBe(5);
});

test("read-only toggles reject changes and enabled toggles update", () => {
  const state = setup(() => createToggleState({ isReadOnly: true }));
  state.toggle();
  state.setSelected(true);
  flush();
  expect(state.isSelected).toBe(false);
  const enabled = setup(() => createToggleState({ defaultSelected: true }));
  enabled.toggle();
  flush();
  expect(enabled.isSelected).toBe(false);
});

test("overlay visibility supports controlled and uncontrolled applications", () => {
  const overlay = setup(() => createOverlayTriggerState({ defaultOpen: true }));
  overlay.close();
  flush();
  expect(overlay.isOpen).toBe(false);
  overlay.toggle();
  flush();
  expect(overlay.isOpen).toBe(true);
  const changes: boolean[] = [];

  const controlled = setup(() =>
    createOverlayTriggerState({
      isOpen: false,
      onOpenChange: (open) => {
        changes.push(open);
      },
    })
  );

  controlled.open();
  flush();
  expect(controlled.isOpen).toBe(false);
  expect(changes).toEqual([true]);
});

const items = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

const children = (item: (typeof items)[number]) => {
  const nativeView = { nativeView: item.label };

  return Item({ children: nativeView, key: item.id, textValue: item.label });
};

test("native collection children support single selection", () => {
  const state = setup(() =>
    createSingleSelectListState({ children, defaultSelectedKey: "a", items })
  );

  expect(state.collection.size).toBe(3);
  expect(state.selectedItem?.rendered).toHaveProperty("nativeView", "Alpha");
  state.setSelectedKey("b");
  flush();
  expect(state.selectedKey).toBe("b");
  expect(state.selectedItem?.textValue).toBe("Beta");
});

test("multiple selection skips disabled entries and follows collection changes", () => {
  const [currentItems, setItems] = setup(() => createSignal(items));

  const state = setup(() =>
    createListState({
      children,
      disabledKeys: ["b"],
      get items() {
        return currentItems();
      },
      selectionMode: "multiple",
    })
  );

  state.selectionManager.toggleSelection("a");
  flush();
  state.selectionManager.toggleSelection("b");
  flush();
  state.selectionManager.toggleSelection("c");
  flush();
  expect([...state.selectionManager.selectedKeys]).toEqual(["a", "c"]);
  state.selectionManager.setFocusedKey("c");
  flush();
  setItems(items.slice(0, 2));
  flush();
  expect(state.collection.size).toBe(2);
  expect(state.collection.getItem("c")).toBeNull();
  expect(state.selectionManager.focusedKey).toBe("a");
});

test("list data removes selection when selected items are removed", () => {
  const data = setup(() =>
    createListData({ initialItems: items, initialSelectedKeys: ["a"] })
  );

  data.remove("a");
  flush();
  expect(data.items.map((item) => item.id)).toEqual(["b", "c"]);
  expect(data.selectedKeys).toEqual(new Set());
});

test("select and combobox state run with native collection descriptors", () => {
  const select = setup(() =>
    createSelectState({ children, defaultValue: "a", items })
  );

  select.open();
  flush();
  expect(select.isOpen).toBe(true);
  select.setValue("c");
  flush();
  expect(select.selectedItems[0]?.textValue).toBe("Gamma");

  const combo = setup(() =>
    createComboBoxState({ children, defaultValue: "b", items })
  );

  expect(combo.inputValue).toBe("Beta");
  combo.setInputValue("Alpha");
  flush();
  expect(combo.inputValue).toBe("Alpha");
});

test("number parsing and formatting use the explicit locale", () => {
  const state = setup(() =>
    createNumberFieldState({ defaultValue: 1234.5, locale: "de-DE" })
  );

  expect(state.inputValue).toBe("1.234,5");
  state.setInputValue("2.345,5");
  flush();
  state.commit();
  flush();
  expect(state.numberValue).toBe(2345.5);
});

test("controlled number stepping restores rejected drafts and follows accepted values", () => {
  const [value, setValue] = setup(() => createSignal(5));
  let accept = false;
  const requests: number[] = [];

  const state = setup(() =>
    createNumberFieldState({
      locale: "en-US",
      onChange(next) {
        requests.push(next);

        if (accept) {
          setValue(next);
        }
      },
      get value() {
        return value();
      },
    })
  );

  state.setInputValue("8");
  flush();
  state.increment();
  flush();
  expect(requests).toEqual([9]);
  expect(state.inputValue).toBe("5");
  expect(state.numberValue).toBe(5);
  state.setInputValue("8");
  flush();
  accept = true;
  state.decrement();
  flush();
  expect(requests).toEqual([9, 7]);
  expect(value()).toBe(7);
  expect(state.inputValue).toBe("7");
});

const date = new CalendarDate(2026, 10, 30);
const minimum = new CalendarDate(2026, 11, 1);

test("validation messages use the native locale, including reversed ranges", () => {
  const english = getValidationResult(date, minimum, undefined, undefined, {
    granularity: "day",
    locale: "en-US",
  });

  const german = getValidationResult(date, minimum, undefined, undefined, {
    granularity: "day",
    locale: "de-DE",
  });

  expect(german.isInvalid).toBe(true);
  expect(german.validationDetails.rangeUnderflow).toBe(true);
  expect(german.validationErrors[0]).toContain("1.11.2026");
  expect(german.validationErrors).not.toEqual(english.validationErrors);
  expect(
    getValidationResult(date, minimum, undefined, undefined, {
      granularity: "day",
      locale: "bad_locale",
    }).validationErrors
  ).toEqual(english.validationErrors);
  const range = { end: date, start: minimum };
  expect(
    getRangeValidationResult(range, undefined, undefined, undefined, {
      locale: "de-DE",
    }).validationErrors
  ).not.toEqual(
    getRangeValidationResult(range, undefined, undefined, undefined, {
      locale: "en-US",
    }).validationErrors
  );
});

test("date field and picker validation propagate a reactive native locale", () => {
  const [locale, setLocale] = setup(() => createSignal("de-DE"));

  const props = {
    defaultValue: date,
    get locale() {
      return locale();
    },
    minValue: minimum,
  };

  const field = setup(() =>
    createDateFieldState({
      ...props,
      createCalendar,
      get locale() {
        return locale();
      },
    })
  );

  const picker = setup(() => createDatePickerState(props));

  const range = setup(() =>
    createDateRangePickerState({
      defaultValue: { end: date, start: minimum },
      get locale() {
        return locale();
      },
    })
  );

  const german = [field, picker, range].map(
    (state) => state.realtimeValidation.validationErrors
  );

  setLocale("en-US");
  flush();

  for (const [index, state] of [field, picker, range].entries()) {
    expect(state.realtimeValidation.validationErrors).not.toEqual(
      german[index]
    );
  }

  const time = setup(() =>
    createTimeFieldState({ defaultValue: new Time(13, 45), locale: "de-DE" })
  );

  expect(time.timeValue.hour).toBe(13);
});

test("calendar navigation and custom form validation work without DOM inputs", () => {
  const calendar = setup(() =>
    createCalendarState({ createCalendar, defaultValue: date, locale: "de-DE" })
  );

  calendar.focusNextDay();
  flush();
  expect(calendar.focusedDate.toString()).toBe("2026-10-31");

  const form = setup(() =>
    createFormValidationState({
      validate: (value) => (value ? true : "Required"),
      value: "",
    })
  );

  expect(form.realtimeValidation.validationErrors).toEqual(["Required"]);
});

test("virtualization uses host geometry in test and production environments", () => {
  const virtualItems = Array.from({ length: 100 }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`,
  }));

  const list = setup(() => createListState({ children, items: virtualItems }));
  const layout = new ListLayout({ rowSize: 40 });

  const state = setup(() =>
    createVirtualizerState({
      collection: list.collection,
      initialVisibleRect: new Rect(0, 0, 200, 40),
      layout,
      onVisibleRectChange() {},
      renderView: (_type, content) => content,
    })
  );

  expect(state.contentSize.height).toBe(4000);
  expect(state.size.equals(new Size(200, 40))).toBe(true);
  expect(state.visibleViews.length).toBeLessThan(virtualItems.length);
  expect(state.virtualizer.size.width).toBe(200);
  state.setVisibleRect(new Rect(0, 40, 300, 40));
  flush();
  expect(state.visibleViews.length).toBeGreaterThan(0);
  expect(state.virtualizer.size.width).toBe(300);
  expect(state.size.equals(new Size(300, 40))).toBe(true);

  const explicit = setup(() =>
    createVirtualizerState({
      collection: list.collection,
      initialSize: new Size(400, 120),
      initialVisibleRect: new Rect(0, 0, 200, 40),
      layout: new ListLayout({ rowSize: 40 }),
      onVisibleRectChange() {},
      renderView: (_type, content) => content,
      sizeMode: "explicit",
    })
  );

  expect(explicit.visibleViews.length).toBeGreaterThan(0);
  expect(explicit.virtualizer.size.width).toBe(400);
  expect(explicit.size.equals(new Size(400, 120))).toBe(true);
  explicit.setSize(new Size(500, 160));
  flush();
  expect(explicit.virtualizer.size.width).toBe(500);
  expect(explicit.size.equals(new Size(500, 160))).toBe(true);
});

test("application effects and cleanup share the package's Solid owner", () => {
  const observed: boolean[] = [];
  let cleaned = false;

  const dispose = createRoot((stop) => {
    const state = createToggleState({});
    createEffect(
      () => state.isSelected,
      (selected) => {
        observed.push(selected);
      }
    );
    onCleanup(() => {
      cleaned = true;
    });
    flush();
    state.toggle();
    flush();

    return stop;
  });

  expect(observed).toEqual([false, true]);
  dispose();
  expect(cleaned).toBe(true);
});

test("disposing a tooltip owner cancels its pending open", async () => {
  const changes: boolean[] = [];

  const dispose = createRoot((stop) => {
    const tooltip = createTooltipTriggerState({
      delay: 10,
      onOpenChange: (open) => {
        changes.push(open);
      },
    });

    tooltip.open();

    return stop;
  });

  dispose();
  await Bun.sleep(30);
  expect(changes).toEqual([]);
});

test("disposing an owned toast queue cancels its timers", async () => {
  let closed = false;

  const dispose = createRoot((stop) => {
    const toasts = createToastState();
    toasts.add("Hello", {
      onClose() {
        closed = true;
      },
      timeout: 10,
    });
    toasts.resumeAll();
    flush();

    return stop;
  });

  dispose();
  await Bun.sleep(30);
  expect(closed).toBe(false);
});

test("disposing an async list aborts its active native fetch", async () => {
  let signal: AbortSignal | undefined;

  const dispose = createRoot((stop) => {
    createAsyncList({
      load: async (options) => {
        ({ signal } = options);

        await Bun.sleep(30);

        return { items: [] };
      },
    });

    return stop;
  });

  flush();
  await Bun.sleep(0);
  expect(signal?.aborted).toBe(false);
  dispose();
  expect(signal?.aborted).toBe(true);
});
