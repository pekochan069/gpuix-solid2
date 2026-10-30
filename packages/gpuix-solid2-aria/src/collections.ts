import type { HostElement, HostProps } from "gpuix-solid2";
import type { ListState } from "gpuix-solid2-stately/list/create-list-state";
import type {
  Collection,
  Key,
  KeyboardDelegate,
  LayoutDelegate,
  Node,
  Rect,
  Size,
} from "gpuix-solid2-stately/shared-types";
import { createEffect } from "solid-js";

import { createPress } from "./interactions.js";
import { createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

/** Coordinates and scroll offsets come from GPUI; content size is supplied by the layout owner. */
export const createNativeLayoutDelegate = (options: {
  ref: NativeRef;
  getItem: (key: Key) => HostElement | null;
  getContentSize: () => Size;
}): LayoutDelegate => {
  const services = createNativeServices();
  const { renderer } = services;

  const offset = () => {
    const node = options.ref();

    const [x = 0, y = 0] = node
      ? (renderer.getScrollOffset?.(node.id) ?? [])
      : [];

    return { x: -x, y: -y };
  };

  return {
    getContentSize: () => options.getContentSize(),
    getItemRect(key): Rect | null {
      const container = services.bounds(options.ref);
      const item = services.bounds(() => options.getItem(key));

      if (!container || !item) {
        return null;
      }

      const scroll = offset();

      return {
        height: item.height,
        width: item.width,
        x: item.x - container.x + scroll.x,
        y: item.y - container.y + scroll.y,
      };
    },
    getVisibleRect(): Rect {
      const container = services.bounds(options.ref);

      return {
        ...offset(),
        height: container?.height ?? 0,
        width: container?.width ?? 0,
      };
    },
  };
};

export interface ListKeyboardDelegateOptions<T> {
  collection: Collection<Node<T>>;
  disabledKeys?: ReadonlySet<Key>;
  collator?: Pick<Intl.Collator, "compare">;
  orientation?: "vertical" | "horizontal";
  direction?: "ltr" | "rtl";
}

/** Linear collection navigation; spatial grids supply their own KeyboardDelegate. */
export class ListKeyboardDelegate<T> implements KeyboardDelegate {
  private readonly options: ListKeyboardDelegateOptions<T>;
  constructor(options: ListKeyboardDelegateOptions<T>) {
    this.options = options;
  }
  private seek(key: Key | null, direction: "before" | "after"): Key | null {
    const { collection } = this.options;
    let next = key;

    while (next !== null) {
      if (
        collection.getItem(next)?.type === "item" &&
        this.options.disabledKeys?.has(next) !== true
      ) {
        return next;
      }

      next =
        direction === "after"
          ? collection.getKeyAfter(next)
          : collection.getKeyBefore(next);
    }

    return null;
  }
  getFirstKey(): Key | null {
    return this.seek(this.options.collection.getFirstKey(), "after");
  }
  getLastKey(): Key | null {
    return this.seek(this.options.collection.getLastKey(), "before");
  }
  getKeyBelow(key: Key): Key | null {
    return this.options.orientation === "horizontal"
      ? null
      : this.seek(this.options.collection.getKeyAfter(key), "after");
  }
  getKeyAbove(key: Key): Key | null {
    return this.options.orientation === "horizontal"
      ? null
      : this.seek(this.options.collection.getKeyBefore(key), "before");
  }
  getKeyRightOf(key: Key): Key | null {
    if (this.options.orientation !== "horizontal") {
      return null;
    }

    return this.options.direction === "rtl"
      ? this.seek(this.options.collection.getKeyBefore(key), "before")
      : this.seek(this.options.collection.getKeyAfter(key), "after");
  }
  getKeyLeftOf(key: Key): Key | null {
    if (this.options.orientation !== "horizontal") {
      return null;
    }

    return this.options.direction === "rtl"
      ? this.seek(this.options.collection.getKeyAfter(key), "after")
      : this.seek(this.options.collection.getKeyBefore(key), "before");
  }
  getKeyForSearch(search: string, fromKey?: Key): Key | null {
    const { collection } = this.options;
    const keys = [...collection.getKeys()];
    const start = fromKey === undefined ? -1 : keys.indexOf(fromKey);

    const collator =
      this.options.collator ??
      new Intl.Collator("en-US", { sensitivity: "base", usage: "search" });

    for (let index = 1; index <= keys.length; index += 1) {
      const key = keys[(start + index) % keys.length];

      if (key === undefined || this.options.disabledKeys?.has(key) === true) {
        continue;
      }

      const node = collection.getItem(key);

      if (
        node?.type === "item" &&
        collator.compare(node.textValue.slice(0, search.length), search) === 0
      ) {
        return key;
      }
    }

    return null;
  }
}

export const createListBox = <T>(
  props: {
    "aria-label"?: string;
    shouldSelectOnFocus?: boolean;
    shouldFocusWrap?: boolean;
  },
  state: ListState<T>,
  getItem: (key: Key) => HostElement | null
) => {
  const services = createNativeServices();

  const delegate = new ListKeyboardDelegate({
    get collection() {
      return state.collection;
    },
    get disabledKeys() {
      return state.disabledKeys;
    },
  });

  const focusKey = (key: Key | null, select: boolean) => {
    if (key === null) {
      return;
    }

    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(key);

    if (select && props.shouldSelectOnFocus === true) {
      state.selectionManager.replaceSelection(key);
    }

    services.focus(() => getItem(key));
    services.scrollIntoView(() => getItem(key));
  };

  createEffect(
    () => ({
      focused: state.selectionManager.isFocused,
      key: state.selectionManager.focusedKey,
    }),
    ({ key, focused }) => {
      if (key !== null && focused) {
        services.focus(() => getItem(key));
        services.scrollIntoView(() => getItem(key));
      }
    }
  );

  return {
    listBoxProps: {
      get "aria-label"() {
        return props["aria-label"];
      },
      onFocus() {
        if (state.selectionManager.focusedKey === null) {
          focusKey(delegate.getFirstKey(), false);
        }
      },

      // oxlint-disable-next-line complexity -- Exhaustive collection key dispatch with native modifier guards.
      onKeyDown(event) {
        if (event.defaultPrevented) {
          return;
        }

        const key = normalizeKey(event.key);
        const focused = state.selectionManager.focusedKey;
        let next: Key | null = null;

        switch (key) {
          case "Home": {
            next = delegate.getFirstKey();
            break;
          }

          case "End": {
            next = delegate.getLastKey();
            break;
          }

          case "ArrowDown": {
            next =
              focused === null
                ? delegate.getFirstKey()
                : delegate.getKeyBelow(focused);
            break;
          }

          case "ArrowUp": {
            next =
              focused === null
                ? delegate.getLastKey()
                : delegate.getKeyAbove(focused);

            break;
          }

          case " ": {
            if (focused !== null) {
              state.selectionManager.toggleSelection(focused);
            }

            event.preventDefault();

            return;
          }

          default: {
            if (
              key.length !== 1 ||
              event.modifiers?.ctrl === true ||
              event.modifiers?.cmd === true ||
              event.modifiers?.alt === true
            ) {
              return;
            }

            next = delegate.getKeyForSearch(key, focused ?? undefined);
          }
        }

        if (next === null && props.shouldFocusWrap === true) {
          if (key === "ArrowDown") {
            next = delegate.getFirstKey();
          }

          if (key === "ArrowUp") {
            next = delegate.getLastKey();
          }
        }

        event.preventDefault();
        focusKey(next, true);
      },
      role: "listbox",
      get tabIndex() {
        return state.selectionManager.focusedKey === null ? 0 : -1;
      },
    } satisfies HostProps,
  };
};

export const createOption = <T>(
  props: { key: Key },
  state: ListState<T>,
  ref: NativeRef
) => {
  const press = createPress(
    {
      get isDisabled() {
        return state.disabledKeys.has(props.key);
      },
      onPress() {
        state.selectionManager.toggleSelection(props.key);
      },
    },
    ref
  );

  return {
    get isSelected() {
      return state.selectionManager.isSelected(props.key);
    },
    optionProps: {
      ...press.pressProps,
      get "aria-label"() {
        return state.collection.getItem(props.key)?.textValue;
      },
      get "aria-selected"() {
        return state.selectionManager.isSelected(props.key);
      },
      onFocus() {
        state.selectionManager.setFocusedKey(props.key);
      },
      role: "option",
      get tabIndex() {
        return !state.disabledKeys.has(props.key) &&
          state.selectionManager.focusedKey === props.key
          ? 0
          : -1;
      },
    } satisfies HostProps,
  };
};
