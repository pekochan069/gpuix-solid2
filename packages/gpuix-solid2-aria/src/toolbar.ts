/*
 * Copyright 2023 Adobe. All rights reserved.
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
 * Derived from Solid Aria's toolbar/create-toolbar, based on Adobe React Spectrum's
 * useToolbar. Modified for GPUIX: registered native controls and roving Tab stops
 * instead of DOM focus queries and capture listeners.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import type { HostElement } from "gpuix-solid2";
import { createMemo, createSignal, merge, onSettled } from "solid-js";

import type { NativeControlProps } from "./controls.js";
import { createLocale } from "./i18n.js";
import { createNativeServices, normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export interface ToolbarProps {
  "aria-label"?: string;
  "aria-description"?: string;
  orientation?: "horizontal" | "vertical";
}

interface RegisteredItem {
  props: NativeControlProps;
  ref: NativeRef;
}

export const createToolbar = (props: ToolbarProps, ref: NativeRef) => {
  const services = createNativeServices();
  const locale = createLocale();
  const [items, setItems] = createSignal<RegisteredItem[]>([]);
  const [lastFocused, setLastFocused] = createSignal<RegisteredItem>();

  const ordered = () => {
    const result: RegisteredItem[] = [];
    const staticItems = items();

    const visit = (node: HostElement) => {
      const item = staticItems.find((entry) => entry.ref() === node);

      if (item && !(item.props["aria-disabled"] === true)) {
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

  return {
    createItem(controlProps: NativeControlProps, itemRef: NativeRef) {
      const item = { props: controlProps, ref: itemRef };
      onSettled(() => {
        setItems((current) => [...current, item]);

        return () => {
          setItems((current) => current.filter((entry) => entry !== item));
        };
      });

      return merge(controlProps, {
        onFocus(event) {
          if (!(controlProps["aria-disabled"] === true)) {
            setLastFocused(item);
          }

          controlProps.onFocus?.(event);
        },
        onKeyDown(event) {
          controlProps.onKeyDown?.(event);

          if (
            event.defaultPrevented ||
            controlProps["aria-disabled"] === true ||
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

          event.preventDefault();
          event.stopPropagation();
          const next = options[index + direction];

          if (next) {
            setLastFocused(next);
            services.focus(next.ref);
            services.scrollIntoView(next.ref);
          }
        },
        get tabIndex() {
          return tabStop() === item ? 0 : -1;
        },
      } satisfies NativeControlProps);
    },
    toolbarProps: {
      get "aria-description"() {
        return props["aria-description"];
      },
      get "aria-label"() {
        return props["aria-label"];
      },
      get "aria-orientation"() {
        return props.orientation ?? "horizontal";
      },
      role: "toolbar",
    } satisfies NativeControlProps & {
      "aria-orientation": "horizontal" | "vertical";
    },
  };
};
