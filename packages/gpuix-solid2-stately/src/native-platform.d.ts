/** An opaque native view or host handle. No browser element methods are assumed. */
export type NativeTarget = object;

export interface NativeEvent<T = NativeTarget> {
  readonly type: string;
  readonly target: T;
  readonly currentTarget: T;
}

export interface NativeFocusEvent<T = NativeTarget> extends NativeEvent<T> {
  readonly relatedTarget: NativeTarget | null;
}

export interface NativeMouseEvent<T = NativeTarget> extends NativeEvent<T> {
  readonly x: number;
  readonly y: number;
  readonly button: number;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export interface NativeKeyboardEvent<T = NativeTarget> extends NativeEvent<T> {
  readonly key: string;
  readonly code: string;
  readonly repeat: boolean;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export interface NativePointerEvent<
  T = NativeTarget,
> extends NativeMouseEvent<T> {
  readonly pointerType: "mouse" | "pen" | "touch" | "keyboard" | "virtual";
}

/** Plain validation flags, independent of the browser ValidityState interface. */
export interface NativeValidationDetails {
  readonly badInput: boolean;
  readonly customError: boolean;
  readonly patternMismatch: boolean;
  readonly rangeOverflow: boolean;
  readonly rangeUnderflow: boolean;
  readonly stepMismatch: boolean;
  readonly tooLong: boolean;
  readonly tooShort: boolean;
  readonly typeMismatch: boolean;
  readonly valid: boolean;
  readonly valueMissing: boolean;
}

/** File data supplied by a native drag-and-drop adapter. */
export interface NativeFile {
  readonly name: string;
  readonly type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
}
