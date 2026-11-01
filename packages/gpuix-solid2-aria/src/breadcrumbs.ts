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
 * Derived from Solid Aria's breadcrumbs/create-breadcrumbs and create-breadcrumb-item,
 * based on Adobe React Spectrum's useBreadcrumbs and useBreadcrumbItem. Modified
 * for GPUIX: native navigation role, reactive current items, application labels,
 * and native links instead of DOM elements and browser routing.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import { merge } from "solid-js";

import type { NativeControlProps } from "./controls.js";
import { createLink } from "./link.js";
import type { LinkProps } from "./link.js";
import type { NativeRef } from "./native.js";

export interface BreadcrumbsProps {
  "aria-label": string;
  "aria-description"?: string;
}

export interface BreadcrumbItemProps extends LinkProps {
  isCurrent?: boolean;
}

export const createBreadcrumbs = (props: BreadcrumbsProps) => ({
  navProps: {
    get "aria-description"() {
      return props["aria-description"];
    },
    get "aria-label"() {
      return props["aria-label"];
    },
    role: "navigation",
  } satisfies NativeControlProps,
});

export const createBreadcrumbItem = (
  props: BreadcrumbItemProps,
  ref: NativeRef
) => {
  const link = createLink(
    merge(props, {
      get isDisabled() {
        return props.isDisabled === true || props.isCurrent === true;
      },
    }),
    ref
  );

  return {
    get itemProps(): NativeControlProps & Pick<LinkProps, "aria-current"> {
      return merge(link.linkProps, {
        get "aria-current"() {
          return props.isCurrent === true
            ? (props["aria-current"] ?? "page")
            : undefined;
        },
        get "aria-disabled"() {
          return props.isDisabled === true;
        },
      } satisfies NativeControlProps & Pick<LinkProps, "aria-current">);
    },
  };
};
