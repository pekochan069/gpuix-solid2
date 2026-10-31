/*
 * Copyright 2024 Adobe. All rights reserved.
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
 * Derived from Solid Aria's button/create-toggle-button-group, based on Adobe React
 * Spectrum's useToggleButtonGroup. Modified for GPUIX: native events, registered
 * item focus, and native host props in place of DOM toolbar listeners.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import type { HostElement, KeyEvent } from "gpuix-solid2";
import type { ToggleGroupState } from "gpuix-solid2-stately/toggle/create-toggle-group-state";
import type { ToggleState } from "gpuix-solid2-stately/toggle/create-toggle-state";
import { createMemo, createSignal, merge, onSettled } from "solid-js";

import { createToggleButton } from "./controls.js";
import type { ButtonProps, NativeControlProps } from "./controls.js";
import { createLocale } from "./i18n.js";
import { createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export interface ToggleButtonGroupProps {
  "aria-label"?: string;
  "aria-description"?: string;
  orientation?: "horizontal" | "vertical";
}

export interface ToggleButtonGroupItemProps extends Omit<
  ButtonProps,
  "tabIndex"
> {
  id: Parameters<ToggleGroupState["toggleKey"]>[0];
  isReadOnly?: boolean;
}

interface RegisteredItem {
  props: ToggleButtonGroupItemProps;
  ref: NativeRef;
}

interface GroupRegistration {
  register: (item: RegisteredItem) => () => void;
  tabStop: () => RegisteredItem | undefined;
  focus: (item: RegisteredItem) => void;
  navigate: (item: RegisteredItem, event: KeyEvent) => void;
}

const groups = new WeakMap<ToggleGroupState, GroupRegistration>();

export const createToggleButtonGroup = (
  props: ToggleButtonGroupProps,
  state: ToggleGroupState,
  ref: NativeRef
) => {
  const services = createNativeServices();
  const locale = createLocale();
  const [items, setItems] = createSignal<RegisteredItem[]>([]);
  const [lastFocused, setLastFocused] = createSignal<RegisteredItem>();

  const enabled = createMemo(() =>
    items().filter(
      (item) => !state.isDisabled && !(item.props.isDisabled === true)
    )
  );

  const ordered = () => {
    const staticOptions = enabled();
    const result: RegisteredItem[] = [];

    const visit = (node: HostElement) => {
      const item = staticOptions.find((option) => option.ref() === node);

      if (item) {
        result.push(item);
      }

      for (const child of node.children) {
        if (child.kind === "element") {
          visit(child);
        }
      }
    };

    const container = ref();

    if (container) {
      visit(container);
    }

    return result;
  };

  const tabStop = createMemo(() => {
    const options = ordered();

    return options.find((item) => item === lastFocused()) ?? options[0];
  });

  groups.set(state, {
    focus(item) {
      setLastFocused(item);
    },
    navigate(item, event) {
      if (
        event.defaultPrevented ||
        state.isDisabled ||
        item.props.isDisabled === true ||
        event.modifiers?.ctrl === true ||
        event.modifiers?.alt === true ||
        event.modifiers?.cmd === true
      ) {
        return;
      }

      const key = normalizeKey(event.key);
      const vertical = props.orientation === "vertical";
      let direction: number;

      if (key === (vertical ? "ArrowDown" : "ArrowRight")) {
        direction = 1;
      } else if (key === (vertical ? "ArrowUp" : "ArrowLeft")) {
        direction = -1;
      } else {
        return;
      }

      if (!vertical && locale.direction === "rtl") {
        direction *= -1;
      }

      const options = ordered();
      const index = options.indexOf(item);

      if (index === -1) {
        return;
      }

      // Toolbar arrows stop at the ends and never change selection.
      event.preventDefault();
      const next = options[index + direction];

      if (next) {
        setLastFocused(next);
        services.focus(next.ref);
        services.scrollIntoView(next.ref);
      }
    },
    register(item) {
      setItems((current) => [...current, item]);

      return () => {
        setItems((current) => current.filter((entry) => entry !== item));
      };
    },
    tabStop,
  });
  onSettled(() => () => {
    groups.delete(state);
  });

  return {
    groupProps: {
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
      get role() {
        return state.selectionMode === "single" ? "radiogroup" : "toolbar";
      },
    } satisfies NativeControlProps & {
      "aria-orientation": "horizontal" | "vertical";
    },
  };
};

export const createToggleButtonGroupItem = (
  props: ToggleButtonGroupItemProps,
  state: ToggleGroupState,
  ref: NativeRef
) => {
  const group = groups.get(state);

  if (!group) {
    throw new Error(
      "createToggleButtonGroupItem requires createToggleButtonGroup with the same state."
    );
  }

  const registration = { props, ref };
  onSettled(() => group.register(registration));

  const toggleState: ToggleState = {
    defaultSelected: false,
    get isSelected() {
      return state.selectedKeys.has(props.id);
    },
    setSelected(isSelected) {
      state.setSelected(props.id, isSelected);
    },
    toggle() {
      state.toggleKey(props.id);
    },
  };

  const button = createToggleButton(
    merge(props, {
      get isDisabled() {
        return state.isDisabled || props.isDisabled === true;
      },
      onFocus(event: Parameters<NonNullable<ButtonProps["onFocus"]>>[0]) {
        group.focus(registration);
        props.onFocus?.(event);
      },
    }),
    toggleState,
    ref
  );

  const buttonProps: NativeControlProps = merge(() => button.buttonProps, {
    get "aria-checked"() {
      return state.selectionMode === "single"
        ? toggleState.isSelected
        : undefined;
    },
    get "aria-pressed"() {
      return state.selectionMode === "multiple"
        ? toggleState.isSelected
        : undefined;
    },
    onKeyDown(event: KeyEvent) {
      group.navigate(registration, event);
      button.buttonProps.onKeyDown?.(event);
    },
    get role() {
      return state.selectionMode === "single" ? "radio" : "button";
    },
    get tabIndex() {
      return group.tabStop() === registration ? 0 : -1;
    },
  });

  return {
    buttonProps,
    get isDisabled() {
      return button.isDisabled;
    },
    get isPressed() {
      return button.isPressed;
    },
    get isSelected() {
      return button.isSelected;
    },
  };
};
