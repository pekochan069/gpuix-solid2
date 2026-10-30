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
 * Derived from Adobe React Spectrum: packages/react-aria-components/src/utils.tsx.
 * Modified for Solid Aria: adapted components, contexts, refs, and reactive properties for Solid 2; uses Solid class props.
 * Licensed under Apache-2.0. See LICENSES/Apache-2.0.txt and NOTICE.txt at the repository root.
 * Modified for GPUIX: native host refs, styles, interactions, and rendering; browser and group integrations omitted. See NOTICE.txt.
 */

import type { HostElement, StyleDesc } from "gpuix-solid2";
import type {
  ButtonProps as AriaButtonProps,
  HoverProps,
  NativeControlProps,
  createFocusRing,
  createHover,
} from "gpuix-solid2-aria";
import { createNativeServices } from "gpuix-solid2-aria";
import { createMemo, merge, onSettled, untrack, useContext } from "solid-js";
import type { Context, Element, Merge } from "solid-js";

export type Ref =
  | ((element: HostElement) => void)
  | ((element: HostElement) => void)[];

export const DEFAULT_SLOT = Symbol("default");

export type ContextValue<Props> =
  | (Props & { slots?: never })
  | { slots: Record<string | symbol, Props> }
  | null;

export interface NativeOptions extends AriaButtonProps, HoverProps {
  id?: string;
  ref?: Ref;
  inputRef?: Ref;
  slot?: string | null | false;
  autoFocus?: boolean;
  onChange?: (selected: boolean) => void;
}

export interface RenderProps<State> {
  children?:
    | Element
    | ((values: State & { defaultChildren: Element | undefined }) => Element);
  style?:
    | StyleDesc
    | ((values: State & { defaultStyle: StyleDesc }) => StyleDesc | undefined);
}

type ChainedEvents = Pick<
  NativeOptions,
  | "onPress"
  | "onPressStart"
  | "onPressEnd"
  | "onPressUp"
  | "onPressChange"
  | "onFocus"
  | "onBlur"
  | "onFocusChange"
  | "onHoverStart"
  | "onHoverEnd"
  | "onHoverChange"
  | "onChange"
>;

interface ContextPropsResult<Props> {
  props: Merge<[() => Props, Props, ChainedEvents]>;
  ref: () => HostElement | null;
  setRef: (node: HostElement) => void;
}

interface ResolvedRenderProps {
  readonly children: Element;
  readonly style: StyleDesc | undefined;
}

export const createContextProps = <Props extends NativeOptions>(
  input: Props,
  context: Context<ContextValue<Props>>
): ContextPropsResult<Props> => {
  const value = useContext(context);
  const slot = untrack(() => input.slot);

  const defaults = () => {
    if (slot === null || value === null) {
      return null;
    }

    if (value.slots !== undefined) {
      const key =
        slot !== false && slot !== undefined && slot.length > 0
          ? slot
          : DEFAULT_SLOT;

      if (!(key in value.slots)) {
        throw new Error(`Unknown component slot: ${String(key)}`);
      }

      return value.slots[key];
    }

    return value;
  };

  const events: ChainedEvents = {
    onBlur(event: Parameters<NonNullable<AriaButtonProps["onBlur"]>>[0]) {
      defaults()?.onBlur?.(event);
      input.onBlur?.(event);
    },
    onChange(selected: boolean) {
      defaults()?.onChange?.(selected);
      input.onChange?.(selected);
    },
    onFocus(event: Parameters<NonNullable<AriaButtonProps["onFocus"]>>[0]) {
      defaults()?.onFocus?.(event);
      input.onFocus?.(event);
    },
    onFocusChange(focused: boolean) {
      defaults()?.onFocusChange?.(focused);
      input.onFocusChange?.(focused);
    },
    onHoverChange(hovered: boolean) {
      defaults()?.onHoverChange?.(hovered);
      input.onHoverChange?.(hovered);
    },
    onHoverEnd(event: Parameters<NonNullable<HoverProps["onHoverEnd"]>>[0]) {
      defaults()?.onHoverEnd?.(event);
      input.onHoverEnd?.(event);
    },
    onHoverStart(
      event: Parameters<NonNullable<HoverProps["onHoverStart"]>>[0]
    ) {
      defaults()?.onHoverStart?.(event);
      input.onHoverStart?.(event);
    },
    onPress(event: Parameters<NonNullable<AriaButtonProps["onPress"]>>[0]) {
      defaults()?.onPress?.(event);
      input.onPress?.(event);
    },
    onPressChange(pressed: boolean) {
      defaults()?.onPressChange?.(pressed);
      input.onPressChange?.(pressed);
    },
    onPressEnd(
      event: Parameters<NonNullable<AriaButtonProps["onPressEnd"]>>[0]
    ) {
      defaults()?.onPressEnd?.(event);
      input.onPressEnd?.(event);
    },
    onPressStart(
      event: Parameters<NonNullable<AriaButtonProps["onPressStart"]>>[0]
    ) {
      defaults()?.onPressStart?.(event);
      input.onPressStart?.(event);
    },
    onPressUp(event: Parameters<NonNullable<AriaButtonProps["onPressUp"]>>[0]) {
      defaults()?.onPressUp?.(event);
      input.onPressUp?.(event);
    },
  };

  const props = merge(() => defaults() ?? input, input, events);

  let element: HostElement | null = null;
  const services = createNativeServices();
  const ref = () => element;
  onSettled(() => {
    if (props.autoFocus === true && !(props.isDisabled === true)) {
      services.focus(ref);
    }

    return () => {
      element = null;
    };
  });

  return {
    props,
    ref,
    setRef(node: HostElement) {
      element = node;
      untrack(() => {
        for (const attach of [
          defaults()?.ref,
          input.ref,
          defaults()?.inputRef,
          input.inputRef,
        ].flat()) {
          attach?.(node);
        }
      });
    },
  };
};

export const createRenderProps = <State extends object>(
  props: RenderProps<State>,
  values: State
): ResolvedRenderProps => {
  const content = createMemo(() => {
    const child = props.children;

    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Resolve the documented render callback or native children union.
    return typeof child === "function"
      ? child(merge(values, { defaultChildren: undefined }))
      : child;
  });

  const style = createMemo(() => {
    const value = props.style;

    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Resolve the documented style callback or native style union.
    return typeof value === "function"
      ? value(merge(values, { defaultStyle: {} }))
      : value;
  });

  return {
    get children() {
      return content();
    },
    get style() {
      return style();
    },
  };
};

export const createSurfaceProps = (
  props: NativeOptions,
  behavior: NativeControlProps,
  focus: ReturnType<typeof createFocusRing>,
  hover: ReturnType<typeof createHover>
): NativeControlProps =>
  merge(behavior, focus.focusProps, hover.hoverProps, {
    get id() {
      return props.id;
    },
    onBlur(event: Parameters<NonNullable<NativeControlProps["onBlur"]>>[0]) {
      behavior.onBlur?.(event);
      focus.focusProps.onBlur?.(event);
    },
    onMouseLeave(
      event: Parameters<NonNullable<NativeControlProps["onMouseLeave"]>>[0]
    ) {
      behavior.onMouseLeave?.(event);
      hover.hoverProps.onMouseLeave(event);
    },
    get tabIndex() {
      return props.isDisabled === true ? -1 : (props.tabIndex ?? 0);
    },
  });
