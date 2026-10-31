/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/*
 * Derived from Solid Aria's menu/create-menu.ts and create-menu-item.ts,
 * based on Adobe React Spectrum's useMenu.ts and useMenuItem.ts.
 * Modified for GPUIX: native item registration, focus, events and scrolling,
 * explicit state, and direct labels instead of DOM queries and relationships.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import type { KeyEvent } from "gpuix-solid2";
import type { Key } from "gpuix-solid2-stately/shared-types";
import type { TreeState } from "gpuix-solid2-stately/tree/create-tree-state";
import { getNodeProps } from "gpuix-solid2-stately/utils/get-node-props";
import {
  createEffect,
  createMemo,
  createSignal,
  merge,
  onSettled,
  untrack,
} from "solid-js";

import { ListKeyboardDelegate } from "./collections.js";
import { createButton } from "./controls.js";
import type { ButtonProps, NativeControlProps } from "./controls.js";
import { createCollator } from "./i18n.js";
import { createHover } from "./interactions.js";
import type { HoverProps, PressEvent } from "./interactions.js";
import { contains, createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export interface MenuProps<T> {
  "aria-label"?: string;
  "aria-description"?: string;
  autoFocus?: boolean | "first" | "last";
  shouldFocusWrap?: boolean;
  onAction?: (key: Key, value: T | null) => void;
  onClose?: () => void;
}

export interface MenuItemProps
  extends
    Omit<ButtonProps, "isDisabled" | "tabIndex">,
    Omit<HoverProps, "isDisabled"> {
  key: Key;
  shouldCloseOnSelect?: boolean;
}

interface MenuItem {
  props: MenuItemProps;
  ref: NativeRef;
}

interface MenuRegistration {
  register: (item: MenuItem) => () => void;
  isDisabled: (key: Key) => boolean;
  tabStop: () => Key | null;
  focus: (key: Key | null) => void;
  activate: (item: MenuItem, event: PressEvent) => void;
}

const menus = new WeakMap<object, MenuRegistration>();

/** Mount the menu and its items together. Compose dismissal with createOverlay. */
export const createMenu = <T>(
  props: MenuProps<T>,
  state: TreeState<T>,
  ref: NativeRef
) => {
  const services = createNativeServices();
  const collator = createCollator({ sensitivity: "base", usage: "search" });
  const [items, setItems] = createSignal<MenuItem[]>([]);

  const isDisabled = (key: Key) =>
    state.disabledKeys.has(key) ||
    getNodeProps(state.collection.getItem(key)).isDisabled;

  const enabled = createMemo(() =>
    items().filter((item) => {
      const node = item.ref();

      return (
        node?.mounted === true &&
        contains(ref(), node.id) &&
        state.collection.getItem(item.props.key)?.type === "item" &&
        !isDisabled(item.props.key)
      );
    })
  );

  const delegate = new ListKeyboardDelegate({
    collator,
    get collection() {
      return state.collection;
    },
    get disabledKeys() {
      const keys = new Set(enabled().map((item) => item.props.key));

      return new Set(
        [...state.collection.getKeys()].filter((key) => !keys.has(key))
      );
    },
  });

  const registration: MenuRegistration = {
    activate(item, event) {
      if (!enabled().includes(item)) {
        return;
      }

      const node = state.collection.getItem(item.props.key);

      if (!node || node.type !== "item") {
        return;
      }

      state.selectionManager.select(item.props.key);
      props.onAction?.(item.props.key, node.value);

      const close =
        event.pointerType === "keyboard"
          ? normalizeKey(event.nativeEvent.key) === "Enter" ||
            state.selectionManager.selectionMode === "none"
          : state.selectionManager.selectionMode !== "multiple";

      if (item.props.shouldCloseOnSelect ?? close) {
        props.onClose?.();
      }
    },
    focus(key) {
      const item = enabled().find((candidate) => candidate.props.key === key);

      if (!item) {
        return;
      }

      state.selectionManager.setFocused(true);
      state.selectionManager.setFocusedKey(item.props.key);
      services.focus(item.ref);
      services.scrollIntoView(item.ref);
    },
    isDisabled,
    register(item) {
      setItems((current) => [...current, item]);

      return () => {
        setItems((current) =>
          current.filter((candidate) => candidate !== item)
        );
      };
    },
    tabStop() {
      return (
        enabled().find(
          (item) => item.props.key === state.selectionManager.focusedKey
        )?.props.key ?? delegate.getFirstKey()
      );
    },
  };

  menus.set(state, registration);
  onSettled(() => () => {
    menus.delete(state);
  });
  let didAutoFocus = false;
  createEffect(
    () => ({ autoFocus: props.autoFocus, options: enabled() }),
    ({ autoFocus, options }) => {
      if (
        didAutoFocus ||
        autoFocus === false ||
        autoFocus === undefined ||
        options.length === 0
      ) {
        return;
      }

      didAutoFocus = true;

      untrack(() => {
        const selected = options.find((item) =>
          state.selectionManager.isSelected(item.props.key)
        );

        registration.focus(
          selected?.props.key ??
            (autoFocus === "last"
              ? delegate.getLastKey()
              : delegate.getFirstKey())
        );
      });
    }
  );

  return {
    menuProps: {
      get "aria-description"() {
        return props["aria-description"];
      },
      get "aria-label"() {
        return props["aria-label"];
      },
      onFocus(event) {
        if (event.elementId === ref()?.id) {
          registration.focus(registration.tabStop());
        }
      },
      // oxlint-disable-next-line complexity -- Native modifier guards and collection navigation key dispatch.
      onKeyDown(event: KeyEvent) {
        if (
          event.defaultPrevented ||
          event.modifiers?.ctrl === true ||
          event.modifiers?.cmd === true ||
          event.modifiers?.alt === true
        ) {
          return;
        }

        const key = normalizeKey(event.key);
        const focused = state.selectionManager.focusedKey;
        let next: Key | null;

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

            if (next === null && props.shouldFocusWrap !== false) {
              next = delegate.getFirstKey();
            }

            break;
          }

          case "ArrowUp": {
            next =
              focused === null
                ? delegate.getLastKey()
                : delegate.getKeyAbove(focused);

            if (next === null && props.shouldFocusWrap !== false) {
              next = delegate.getLastKey();
            }

            break;
          }

          default: {
            if (key.length !== 1 || key === " ") {
              return;
            }

            next = delegate.getKeyForSearch(key, focused ?? undefined);
          }
        }

        event.preventDefault();
        registration.focus(next);
      },
      role: "menu",
      get tabIndex() {
        return enabled().length === 0 ? 0 : -1;
      },
    } satisfies NativeControlProps,
  };
};

export const createMenuItem = <T>(
  props: MenuItemProps,
  state: TreeState<T>,
  ref: NativeRef
) => {
  const menu = menus.get(state);

  if (!menu) {
    throw new Error("Menu items require createMenu with the same state.");
  }

  const item = { props, ref };
  const services = createNativeServices();
  onSettled(() => menu.register(item));

  const button = createButton(
    merge(props, {
      get isDisabled() {
        return menu.isDisabled(props.key);
      },
      onBlur(event: Parameters<NonNullable<ButtonProps["onBlur"]>>[0]) {
        if (state.selectionManager.focusedKey === props.key) {
          state.selectionManager.setFocused(false);
        }

        props.onBlur?.(event);
      },
      onFocus(event: Parameters<NonNullable<ButtonProps["onFocus"]>>[0]) {
        state.selectionManager.setFocused(true);
        state.selectionManager.setFocusedKey(props.key);
        props.onFocus?.(event);
      },
      onPress(event: PressEvent) {
        if (event.pointerType !== "keyboard") {
          menu.activate(item, event);
        }

        props.onPress?.(event);
      },
      onPressStart(event: PressEvent) {
        if (event.pointerType === "keyboard") {
          menu.activate(item, event);
        }

        props.onPressStart?.(event);
      },
    }),
    ref
  );

  const hover = createHover(
    merge(props, {
      get isDisabled() {
        return menu.isDisabled(props.key);
      },
      onHoverStart(
        event: Parameters<NonNullable<HoverProps["onHoverStart"]>>[0]
      ) {
        if (services.getInteractionModality() !== "keyboard") {
          menu.focus(props.key);
        }

        props.onHoverStart?.(event);
      },
    })
  );

  return {
    get isDisabled() {
      return menu.isDisabled(props.key);
    },
    get isFocused() {
      return (
        state.selectionManager.isFocused &&
        state.selectionManager.focusedKey === props.key
      );
    },
    get isPressed() {
      return button.isPressed;
    },
    get isSelected() {
      return state.selectionManager.isSelected(props.key);
    },
    menuItemProps: merge(
      () => button.buttonProps,
      () => hover.hoverProps,
      {
        get "aria-checked"() {
          return state.selectionManager.selectionMode === "none"
            ? undefined
            : state.selectionManager.isSelected(props.key);
        },
        get "aria-label"() {
          return (
            props["aria-label"] ??
            state.collection.getItem(props.key)?.textValue
          );
        },
        onMouseLeave(
          event: Parameters<NonNullable<HoverProps["onHoverEnd"]>>[0]
        ) {
          button.buttonProps.onMouseLeave?.(event);
          hover.hoverProps.onMouseLeave(event);
        },
        onMouseMove() {
          if (
            !state.selectionManager.isFocused ||
            state.selectionManager.focusedKey !== props.key
          ) {
            menu.focus(props.key);
          }
        },
        get role() {
          switch (state.selectionManager.selectionMode) {
            case "single": {
              return "menuitemradio";
            }

            case "multiple": {
              return "menuitemcheckbox";
            }

            case "none": {
              return "menuitem";
            }

            default: {
              const exhaustive: never = state.selectionManager.selectionMode;

              return exhaustive;
            }
          }
        },
        get tabIndex() {
          return menu.tabStop() === props.key ? 0 : -1;
        },
      }
    ) satisfies NativeControlProps,
  };
};
