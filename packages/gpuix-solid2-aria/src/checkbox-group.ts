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
 * Derived from Solid Aria's checkbox/create-checkbox-group and create-checkbox-group-item,
 * based on Adobe React Spectrum's useCheckboxGroup and useCheckboxGroupItem.
 * Modified for GPUIX: native host props and events, explicit state, and no DOM fields or forms.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt.
 */

import type { CheckboxGroupState } from "gpuix-solid2-stately/checkbox/create-checkbox-group-state";
import { createToggleState } from "gpuix-solid2-stately/toggle/create-toggle-state";
import { merge } from "solid-js";

import { createCheckbox } from "./controls.js";
import type { CheckboxProps, NativeControlProps } from "./controls.js";
import type { NativeRef } from "./native.js";

export interface CheckboxGroupProps {
  "aria-label"?: string;
  "aria-description"?: string;
}

export interface CheckboxGroupItemProps extends CheckboxProps {
  value: string;
  onChange?: (isSelected: boolean) => void;
}

export const createCheckboxGroup = (
  props: CheckboxGroupProps,
  state: CheckboxGroupState
) => ({
  groupProps: {
    get "aria-description"() {
      return props["aria-description"];
    },
    get "aria-disabled"() {
      return state.isDisabled;
    },
    get "aria-invalid"() {
      return state.isInvalid;
    },
    get "aria-label"() {
      return props["aria-label"];
    },
    get "aria-readonly"() {
      return state.isReadOnly;
    },
    role: "group",
  } satisfies NativeControlProps,
  get isInvalid() {
    return state.isInvalid;
  },
  get validationDetails() {
    return state.displayValidation.validationDetails;
  },
  get validationErrors() {
    return state.displayValidation.validationErrors;
  },
});

export const createCheckboxGroupItem = (
  props: CheckboxGroupItemProps,
  state: CheckboxGroupState,
  ref: NativeRef
) => {
  const options = merge(props, {
    get isDisabled() {
      return state.isDisabled || props.isDisabled === true;
    },
    get isInvalid() {
      return state.isInvalid || props.isInvalid === true;
    },
    get isReadOnly() {
      return state.isReadOnly || props.isReadOnly === true;
    },
    get isRequired() {
      return props.isRequired ?? state.isRequired;
    },
  });

  const toggle = createToggleState({
    get isReadOnly() {
      return options.isReadOnly;
    },
    get isSelected() {
      return state.isSelected(props.value);
    },
    onChange(isSelected) {
      if (isSelected) {
        state.addValue(props.value);
      } else {
        state.removeValue(props.value);
      }

      props.onChange?.(isSelected);
    },
  });

  return createCheckbox(options, toggle, ref);
};
