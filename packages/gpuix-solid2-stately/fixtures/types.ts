import type {
  ComboBoxProps,
  ToggleProps,
  ToggleStateOptions,
} from "gpuix-solid2-stately";
import { Item } from "gpuix-solid2-stately";
import type {
  NativeKeyboardEvent,
  NativeTarget,
} from "gpuix-solid2-stately/native-platform";
import type { FocusableElement } from "gpuix-solid2-stately/shared-types";
import type { Element } from "solid-js";

const nativeView = { nativeId: 1 };
const child: Element = nativeView;

Item({ children: child, key: "native", textValue: "Native view" });

const target: FocusableElement = nativeView;
const nativeTarget: NativeTarget = target;
const options: ToggleStateOptions = { isDisabled: true };

const toggle: ToggleProps = {
  onFocus: (event) => {
    const view: object = event.currentTarget;
    void view;
  },
};

const combo: Pick<ComboBoxProps<object>, "onKeyDown"> = {
  onKeyDown: (event) => {
    const key: string = event.key;
    void key;
  },
};

const keyboardTarget = (event: NativeKeyboardEvent) => event.currentTarget;

void [child, nativeTarget, options, toggle, combo, keyboardTarget];

// @ts-expect-error Native handles do not expose browser element methods.
const browserTarget = nativeTarget satisfies {
  querySelector: (selector: string) => object;
};

void browserTarget;
