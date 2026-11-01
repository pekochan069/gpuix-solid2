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
 * Derived from Solid Aria's link/create-link, based on Adobe React Spectrum's
 * useLink. Modified for GPUIX: native press and focus, Enter-only keyboard
 * activation, and application-owned navigation instead of browser routing.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import { merge } from "solid-js";

import { createButton } from "./controls.js";
import type { ButtonProps, NativeControlProps } from "./controls.js";
import { normalizeKey } from "./native.js";
import type { NativeRef } from "./native.js";

export interface LinkProps extends ButtonProps {
  "aria-current"?:
    | boolean
    | "true"
    | "false"
    | "page"
    | "step"
    | "location"
    | "date"
    | "time";
}

export const createLink = (props: LinkProps, ref: NativeRef) => {
  const button = createButton(props, ref);

  return {
    get isFocused() {
      return button.isFocused;
    },
    get isPressed() {
      return button.isPressed;
    },
    get linkProps(): NativeControlProps & Pick<LinkProps, "aria-current"> {
      return merge(button.buttonProps, {
        get "aria-current"() {
          return props["aria-current"];
        },
        onKeyDown(event) {
          if (normalizeKey(event.key) === "Enter") {
            button.buttonProps.onKeyDown?.(event);
          }
        },
        role: "link",
      } satisfies NativeControlProps & Pick<LinkProps, "aria-current">);
    },
  };
};
