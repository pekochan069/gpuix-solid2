import type {
  AnchoredProps,
  CodeProps,
  DiffProps,
  HostProps,
  ImgProps,
  InputProps,
  MarkdownProps,
  SvgProps,
  TextareaProps,
  VirtualListProps,
} from "@gpuix/native/host";
import { createComponent, untrack } from "solid-js";
import type * as Solid from "solid-js";

import { createHostElement } from "./host.js";
import type { HostElement } from "./host.js";
import { spread } from "./universal.js";

export { type MotionProps } from "@gpuix/native/host";

export type HostRef = (element: HostElement) => void;

export type SolidHostProps<Props = HostProps> = Props & {
  children?: Solid.Element;
  ref?: HostRef | HostRef[];
};

export function jsx<P extends object>(
  type: (props: P) => Solid.Element,
  props: P
): Solid.Element;

export function jsx<Tag extends keyof JSX.IntrinsicElements>(
  type: Tag,
  props?: JSX.IntrinsicElements[Tag] | null
): Solid.Element;

export function jsx<P extends object>(
  type: string | ((props: P) => Solid.Element),
  props?: P | null
): Solid.Element {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Select the callback or value form of this typed renderer API.
  if (typeof type === "function") {
    if (!props) {
      throw new TypeError("Component props are required");
    }

    return createComponent(type, props);
  }

  const element = createHostElement(type);

  spread(element, props ?? {});

  return element;
}

export const jsxs = jsx;

export const jsxDEV = jsx;

export const Fragment = (props: { children?: Solid.Element }): Solid.Element =>
  untrack(() => props.children);

// oxlint-disable-next-line typescript/no-namespace -- TypeScript resolves intrinsic types through the renderer-owned JSX namespace.
export namespace JSX {
  export type Element = Solid.Element;

  export interface ElementChildrenAttribute {
    children: unknown;
  }

  export interface IntrinsicElements {
    div: SolidHostProps;
    text: SolidHostProps;
    img: SolidHostProps<ImgProps>;
    svg: SolidHostProps<SvgProps>;
    canvas: SolidHostProps;
    input: SolidHostProps<InputProps>;
    textarea: SolidHostProps<TextareaProps>;
    anchored: SolidHostProps<AnchoredProps>;
    code: SolidHostProps<CodeProps>;
    diff: SolidHostProps<DiffProps>;
    markdown: SolidHostProps<MarkdownProps>;
    "virtual-list": SolidHostProps<VirtualListProps>;
  }
}
