/*
 * Copyright 2022 Adobe. All rights reserved.
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
 * Derived from Adobe React Spectrum: packages/react-aria-components/src/RadioGroup.tsx.
 * Modified for Solid Aria: adapted components, contexts, refs, and reactive properties for Solid 2; uses Solid class props.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt at the repository root.
 * Modified for GPUIX: native host refs, styles, interactions, and rendering; browser forms and split field composition omitted. See NOTICE.txt.
 */

import type { HostElement, JSX } from "gpuix-solid2";
import {
  createRadio,
  createRadioGroup,
  createFocusRing,
  createHover,
} from "gpuix-solid2-aria";
import type { NativeControlProps } from "gpuix-solid2-aria";
import { createRadioGroupState } from "gpuix-solid2-stately";
import type { RadioGroupState } from "gpuix-solid2-stately/radio/create-radio-group-state";
import { createContext, merge, omit, untrack, useContext } from "solid-js";

import {
  createContextProps,
  createRenderProps,
  createSurfaceProps,
} from "./utils.js";
import type { ContextValue, NativeOptions, RenderProps } from "./utils.js";

export interface RadioGroupRenderProps {
  isDisabled: boolean;
  isReadOnly: boolean;
  isRequired: boolean;
  isInvalid: boolean;
  orientation: "horizontal" | "vertical";
  state: RadioGroupState;
}

export interface RadioGroupProps
  extends
    Pick<
      NativeOptions<string>,
      | "id"
      | "ref"
      | "slot"
      | "onChange"
      | "aria-label"
      | "aria-description"
      | "isDisabled"
    >,
    RenderProps<RadioGroupRenderProps> {
  value?: string | null;
  defaultValue?: string | null;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  orientation?: "horizontal" | "vertical";
}

export type RadioRenderProps = Omit<
  RadioGroupRenderProps,
  "state" | "orientation"
> & {
  isSelected: boolean;
  isHovered: boolean;
  isPressed: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
};

export interface RadioProps
  extends
    Omit<NativeOptions, "onChange" | "tabIndex">,
    RenderProps<RadioRenderProps> {
  value: string;
}

export const RadioGroupContext =
  createContext<ContextValue<RadioGroupProps>>(null);

export const RadioContext = createContext<ContextValue<RadioProps>>(null);
export const RadioGroupStateContext = createContext<RadioGroupState>();

const RadioGroupContent = (input: {
  options: RadioGroupProps;
  behavior: NativeControlProps;
  values: RadioGroupRenderProps;
  setRef: (node: HostElement) => void;
}): JSX.Element => {
  const render = untrack(() => createRenderProps(input.options, input.values));

  const surface = merge(() => input.behavior, {
    get id() {
      return input.options.id;
    },
  });

  return <div {...surface} {...render} ref={input.setRef} />;
};

export const RadioGroup = (input: RadioGroupProps): JSX.Element => {
  const { props, ref, setRef } = createContextProps<RadioGroupProps, string>(
    input,
    RadioGroupContext
  );

  const state = createRadioGroupState(
    omit(props, "onFocus", "onBlur", "onFocusChange")
  );

  const aria = createRadioGroup(props, state, ref);

  const values: RadioGroupRenderProps = {
    get isDisabled() {
      return state.isDisabled;
    },
    get isInvalid() {
      return state.isInvalid;
    },
    get isReadOnly() {
      return state.isReadOnly;
    },
    get isRequired() {
      return state.isRequired;
    },
    get orientation() {
      return props.orientation ?? "vertical";
    },
    state,
  };

  return (
    <RadioGroupStateContext value={state}>
      <RadioGroupContent
        options={props}
        behavior={aria.radioGroupProps}
        values={values}
        setRef={setRef}
      />
    </RadioGroupStateContext>
  );
};

export const Radio = (input: RadioProps): JSX.Element => {
  const state = useContext(RadioGroupStateContext);

  const { props, ref, setRef } = createContextProps(
    input,
    RadioContext,
    () => state.isDisabled
  );

  const aria = createRadio(
    omit(props, "onFocus", "onBlur", "onFocusChange"),
    state,
    ref
  );

  const options = merge(props, {
    get isDisabled() {
      return aria.isDisabled;
    },
  });

  const focus = untrack(() => createFocusRing(options));

  const hover = createHover(
    merge(props, {
      get isDisabled() {
        return aria.isDisabled || state.isReadOnly;
      },
    })
  );

  const values: RadioRenderProps = {
    get isDisabled() {
      return aria.isDisabled;
    },
    get isFocusVisible() {
      return focus.isFocusVisible;
    },
    get isFocused() {
      return focus.isFocused;
    },
    get isHovered() {
      return hover.isHovered;
    },
    get isInvalid() {
      return state.isInvalid;
    },
    get isPressed() {
      return aria.isPressed;
    },
    get isReadOnly() {
      return state.isReadOnly;
    },
    get isRequired() {
      return state.isRequired;
    },
    get isSelected() {
      return aria.isSelected;
    },
  };

  const render = createRenderProps(props, values);

  const surface = createSurfaceProps(
    options,
    merge(() => aria.inputProps),
    focus,
    hover
  );

  const radioSurface = merge(surface, {
    get tabIndex() {
      return aria.inputProps.tabIndex;
    },
  });

  return <div {...radioSurface} {...render} ref={setRef} />;
};
