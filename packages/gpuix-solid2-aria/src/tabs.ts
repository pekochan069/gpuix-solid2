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
 * Derived from Solid Aria's tabs/create-tab-list, create-tab, create-tab-panel,
 * and tabs-keyboard-delegate, based on Adobe React Spectrum's tabs hooks.
 * Modified for GPUIX: native events, mounted tab registration, native focus and
 * scrolling, and conditional panels instead of DOM visibility and child detection.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import type { KeyEvent } from "gpuix-solid2";
import type { Key } from "gpuix-solid2-stately/shared-types";
import type { TabListState } from "gpuix-solid2-stately/tabs/create-tab-list-state";
import { getNodeProps } from "gpuix-solid2-stately/utils/get-node-props";
import {
  createMemo,
  createSignal,
  createUniqueId,
  merge,
  onSettled,
} from "solid-js";

import { createButton } from "./controls.js";
import type { ButtonProps, NativeControlProps } from "./controls.js";
import { createLocale } from "./i18n.js";
import type { PressEvent } from "./interactions.js";
import { contains, createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export interface TabListProps {
  "aria-label"?: string;
  "aria-description"?: string;
  orientation?: "horizontal" | "vertical";
  keyboardActivation?: "automatic" | "manual";
}

export interface TabProps extends Omit<ButtonProps, "tabIndex"> {
  key: Key;
}

export interface TabPanelProps {
  id?: Key;
  "aria-label"?: string;
  "aria-description"?: string;
  /** Set to -1 when the panel contains its own Tab stops. Defaults to 0. */
  tabIndex?: number;
}

interface RegisteredTab {
  props: TabProps;
  ref: NativeRef;
}

interface TabRegistration {
  register: (tab: RegisteredTab) => () => void;
  isDisabled: (tab: RegisteredTab) => boolean;
  tabStop: () => RegisteredTab | undefined;
  id: (key: Key, kind: "tab" | "panel") => string;
  navigate: (tab: RegisteredTab, event: KeyEvent) => void;
}

const lists = new WeakMap<object, TabRegistration>();

export const createTabList = <T>(
  props: TabListProps,
  state: TabListState<T>,
  ref: NativeRef
) => {
  const services = createNativeServices();
  const locale = createLocale();
  const prefix = `tabs-${createUniqueId()}`;
  const ids = new Map<Key, number>();
  const [tabs, setTabs] = createSignal<RegisteredTab[]>([]);

  const isDisabled = (tab: RegisteredTab) =>
    state.isDisabled ||
    state.disabledKeys.has(tab.props.key) ||
    tab.props.isDisabled === true ||
    getNodeProps(state.collection.getItem(tab.props.key)).isDisabled;

  const enabled = createMemo(() => {
    const mounted = tabs();

    return [...state.collection.getKeys()].flatMap((key) => {
      const tab = mounted.find((item) => item.props.key === key);
      const node = tab?.ref();

      return tab &&
        node?.mounted === true &&
        contains(ref(), node.id) &&
        !isDisabled(tab)
        ? [tab]
        : [];
    });
  });

  const registration: TabRegistration = {
    id(key, kind) {
      let id = ids.get(key);

      if (id === undefined) {
        id = ids.size;
        ids.set(key, id);
      }

      return `${prefix}-${id}-${kind}`;
    },
    isDisabled,
    // oxlint-disable-next-line complexity -- Native modifier guards and orientation-aware tab key dispatch.
    navigate(tab, event) {
      if (
        event.defaultPrevented ||
        isDisabled(tab) ||
        event.modifiers?.ctrl === true ||
        event.modifiers?.alt === true ||
        event.modifiers?.cmd === true
      ) {
        return;
      }

      const key = normalizeKey(event.key);
      const options = enabled();
      const index = options.indexOf(tab);
      const vertical = props.orientation === "vertical";
      let next: RegisteredTab | undefined;

      if (key === "Home") {
        [next] = options;
      } else if (key === "End") {
        next = options.at(-1);
      } else {
        let direction: number;

        if (key === "ArrowRight" || (vertical && key === "ArrowDown")) {
          direction = 1;
        } else if (key === "ArrowLeft" || (vertical && key === "ArrowUp")) {
          direction = -1;
        } else {
          return;
        }

        if (
          (key === "ArrowRight" || key === "ArrowLeft") &&
          locale.direction === "rtl"
        ) {
          direction *= -1;
        }

        next = options[(index + direction + options.length) % options.length];
      }

      if (index === -1 || !next) {
        return;
      }

      event.preventDefault();
      state.selectionManager.setFocused(true);
      state.selectionManager.setFocusedKey(next.props.key);

      if (props.keyboardActivation !== "manual") {
        state.setSelectedKey(next.props.key);
      }

      services.focus(next.ref);
      services.scrollIntoView(next.ref);
    },
    register(tab) {
      setTabs((current) => [...current, tab]);

      return () => {
        setTabs((current) => current.filter((item) => item !== tab));
      };
    },
    tabStop() {
      const options = enabled();

      return (
        options.find(
          (tab) => tab.props.key === state.selectionManager.focusedKey
        ) ??
        options.find((tab) => tab.props.key === state.selectedKey) ??
        options[0]
      );
    },
  };

  lists.set(state, registration);
  onSettled(() => () => {
    lists.delete(state);
  });

  return {
    tabListProps: {
      get "aria-description"() {
        return props["aria-description"];
      },
      get "aria-disabled"() {
        return state.isDisabled;
      },
      get "aria-label"() {
        return props["aria-label"];
      },
      get "aria-orientation"() {
        return props.orientation ?? "horizontal";
      },
      role: "tablist",
    } satisfies NativeControlProps & {
      "aria-orientation": "horizontal" | "vertical";
    },
  };
};

const getRegistration = <T>(state: TabListState<T>) => {
  const list = lists.get(state);

  if (!list) {
    throw new Error("Tabs require createTabList with the same state.");
  }

  return list;
};

export const createTab = <T>(
  props: TabProps,
  state: TabListState<T>,
  ref: NativeRef
) => {
  const list = getRegistration(state);
  const tab = { props, ref };
  onSettled(() => list.register(tab));

  const select = () => {
    if (!list.isDisabled(tab)) {
      state.setSelectedKey(props.key);
    }
  };

  const button = createButton(
    merge(props, {
      get isDisabled() {
        return list.isDisabled(tab);
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
        if (event.pointerType === "virtual") {
          select();
        }

        props.onPress?.(event);
      },
      onPressStart(event: PressEvent) {
        select();
        props.onPressStart?.(event);
      },
    }),
    ref
  );

  return {
    get isDisabled() {
      return list.isDisabled(tab);
    },
    get isPressed() {
      return button.isPressed;
    },
    get isSelected() {
      return state.selectedKey === props.key;
    },
    tabProps: merge(() => button.buttonProps, {
      get "aria-controls"() {
        return state.selectedKey === props.key
          ? list.id(props.key, "panel")
          : undefined;
      },
      get "aria-id"() {
        return list.id(props.key, "tab");
      },
      get "aria-selected"() {
        return state.selectedKey === props.key;
      },
      onKeyDown(event: KeyEvent) {
        list.navigate(tab, event);
        button.buttonProps.onKeyDown?.(event);
      },
      role: "tab",
      get tabIndex() {
        return list.tabStop() === tab ? 0 : -1;
      },
    }) satisfies NativeControlProps,
  };
};

/** Mount only the selected panel. Panel-local state is recreated after switching. */
export const createTabPanel = <T>(
  props: TabPanelProps,
  state: TabListState<T>
) => {
  const list = getRegistration(state);
  const key = () => props.id ?? state.selectedKey;

  return {
    tabPanelProps: {
      get "aria-description"() {
        return props["aria-description"];
      },
      get "aria-id"() {
        const value = key();

        return value === null ? undefined : list.id(value, "panel");
      },
      get "aria-label"() {
        return props["aria-label"];
      },
      get "aria-labelledby"() {
        const value = key();

        return value === null ? undefined : list.id(value, "tab");
      },
      role: "tabpanel",
      get tabIndex() {
        return props.tabIndex ?? 0;
      },
    } satisfies NativeControlProps,
  };
};
