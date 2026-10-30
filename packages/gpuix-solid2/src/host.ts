import type { EventPayload } from "@gpuix/native";
// Host-tree shape is based on jhomra21/gpuix-solid (MIT), stripped to GPUIX's
// native elements and event contract.
import {
  BUILT_IN_TYPES,
  EVENT_PROP_NAMES,
  EVENT_TYPE_BY_PROP,
  UNIVERSAL_PROPS,
  registerEventHandler,
  serializeCustomProp,
  unregisterEventHandler,
  unregisterEventHandlers,
} from "@gpuix/native/host";
import type {
  ElementType,
  EventHandlerMap,
  HostProps,
  ImagePixelsOptions,
  MutationRenderer,
  NativeRenderer,
  StyleDesc,
} from "@gpuix/native/host";

import type { NativeMotionProps } from "./components/motion.js";

export type HostNode = HostElement | HostText;

export type HostParent = HostRoot | HostElement;

export type HostPropertyValue =
  | object
  | string
  | number
  | boolean
  | ((event: EventPayload) => void)
  | null
  | undefined;

export interface HostRoot {
  readonly kind: "root";
  readonly children: HostNode[];
  readonly mutations: MutationRenderer;
  readonly nativeRenderer: NativeRenderer;
  readonly eventHandlers: EventHandlerMap;
  readonly allocateId: () => number;
}

export class HostElement {
  readonly kind = "element" as const;
  readonly children: HostNode[] = [];
  readonly props = new Map<string, HostPropertyValue>();
  parent: HostParent | null = null;
  root: HostRoot | null = null;
  id = 0;
  mounted = false;
  style: StyleDesc = {};
  motion?: NativeMotionProps;

  readonly type: ElementType;
  constructor(type: ElementType) {
    this.type = type;
  }

  scrollIntoView(): void {
    this.root?.nativeRenderer.scrollIntoView?.(this.id);
  }

  setImage(bytes: Buffer | Uint8Array): void {
    this.root?.nativeRenderer.setImage?.(this.id, Buffer.from(bytes));
  }

  setImagePixels(
    width: number,
    height: number,
    pixels: Buffer | Uint8Array,
    options?: ImagePixelsOptions
  ): void {
    this.root?.nativeRenderer.setImagePixels?.(
      this.id,
      width,
      height,
      Buffer.from(pixels),
      options?.format
    );
  }
}

export interface HostText {
  readonly kind: "text";
  readonly children: HostNode[];
  parent: HostParent | null;
  root: HostRoot | null;
  id: number;
  mounted: boolean;
  text: string;
}

export type SolidHostProps = HostProps & {
  children?: unknown;
  ref?: (element: HostElement) => void;
};

export const isHostPropertyValue = <Value>(
  value: Value
): value is Value & HostPropertyValue => {
  const type = typeof value;

  return (
    value === null ||
    value === undefined ||
    type === "object" ||
    type === "string" ||
    type === "number" ||
    type === "boolean" ||
    type === "function"
  );
};

export const createHostRoot = (
  options: Omit<HostRoot, "kind" | "children">
): HostRoot => ({
  ...options,
  children: [],
  kind: "root",
});

const isElementType = (type: string): type is ElementType => {
  switch (type) {
    case "div":
    case "text":
    case "img":
    case "svg":
    case "canvas":
    case "input":
    case "textarea":
    case "anchored":
    case "code":
    case "diff":
    case "markdown":
    case "virtual-list": {
      return true;
    }

    default: {
      return false;
    }
  }
};

export const createHostElement = (type: string): HostElement => {
  if (!isElementType(type)) {
    throw new Error(`Unsupported GPUIX element <${type}>`);
  }

  return new HostElement(type);
};

export const createHostText = (value: string | number): HostText => ({
  children: [],
  id: 0,
  kind: "text",
  mounted: false,
  parent: null,
  root: null,
  text: String(value),
});

export const replaceHostText = (
  node: HostText,
  value: string | number
): void => {
  const next = String(value);

  if (node.text === next) {
    return;
  }

  node.text = next;

  if (node.root && node.mounted) {
    node.root.mutations.setText(node.id, next);
  }
};

const eventTypeFor = (name: string): string | undefined =>
  EVENT_TYPE_BY_PROP.get(name);

const customPropAllowed = (node: HostElement, name: string): boolean =>
  !BUILT_IN_TYPES.has(node.type) || UNIVERSAL_PROPS.has(name);

const isStyle = (value: unknown): value is StyleDesc =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isHostEventHandler = (
  value: unknown
): value is (event: EventPayload) => void => typeof value === "function";

/* oxlint-disable anti-slop/no-object-parameters -- Native properties include structured style, motion, and custom-element values. */
export const setHostProperty = (
  node: HostNode,
  name: string,
  value: HostPropertyValue,
  previous?: HostPropertyValue
): void => {
  if (
    node.kind === "text" ||
    name === "children" ||
    name === "ref" ||
    name === "key"
  ) {
    return;
  }

  if (name === "style") {
    node.style = isStyle(value) ? value : {};

    if (node.root && node.mounted) {
      node.root.mutations.setStyle(node.id, node.style);
    }

    return;
  }

  const eventType = eventTypeFor(name);

  if (eventType !== undefined) {
    if (isHostEventHandler(value)) {
      node.props.set(name, value);
    } else {
      node.props.delete(name);
    }

    if (!node.root || !node.mounted) {
      return;
    }

    if (isHostEventHandler(previous)) {
      unregisterEventHandler(node.root.eventHandlers, node.id, eventType);
    }

    if (isHostEventHandler(value)) {
      registerEventHandler(node.root.eventHandlers, node.id, eventType, value);
    }

    if (isHostEventHandler(previous) !== isHostEventHandler(value)) {
      node.root.mutations.setEventListener(
        node.id,
        eventType,
        isHostEventHandler(value)
      );
    }

    return;
  }

  if (value === undefined) {
    node.props.delete(name);
  } else {
    node.props.set(name, value);
  }

  if (!node.root || !node.mounted || !customPropAllowed(node, name)) {
    return;
  }

  node.root.mutations.setCustomProp(node.id, name, serializeCustomProp(value));
};
/* oxlint-enable anti-slop/no-object-parameters */

const mount = (root: HostRoot, node: HostNode): void => {
  if (node.root && node.root !== root) {
    throw new Error("Cannot move a GPUIX host node between roots");
  }

  node.root = root;

  if (!node.id) {
    node.id = root.allocateId();
  }

  if (node.mounted) {
    return;
  }

  node.mounted = true;

  root.mutations.createElement(
    node.id,
    node.kind === "text" ? "text" : node.type
  );

  if (node.kind === "text") {
    root.mutations.setText(node.id, node.text);
  } else {
    if (Object.keys(node.style).length > 0) {
      root.mutations.setStyle(node.id, node.style);
    }

    for (const [name, value] of node.props) {
      const eventType = eventTypeFor(name);

      if (eventType !== undefined && isHostEventHandler(value)) {
        registerEventHandler(root.eventHandlers, node.id, eventType, value);

        root.mutations.setEventListener(node.id, eventType, true);
      } else if (!EVENT_PROP_NAMES.has(name) && customPropAllowed(node, name)) {
        root.mutations.setCustomProp(node.id, name, serializeCustomProp(value));
      }
    }
  }

  for (const child of node.children) {
    mount(root, child);

    root.mutations.appendChild(node.id, child.id);
  }
};

const removeFromParent = (node: HostNode): void => {
  const { parent } = node;

  if (!parent) {
    return;
  }

  const index = parent.children.indexOf(node);

  if (index !== -1) {
    parent.children.splice(index, 1);
  }

  node.parent = null;
};

export const insertHostNode = (
  parent: HostParent,
  node: HostNode,
  anchor?: HostNode | null
): void => {
  if (anchor && anchor.parent !== parent) {
    throw new Error("GPUIX Solid anchor is not a child of its parent");
  }

  removeFromParent(node);

  const index = anchor
    ? parent.children.indexOf(anchor)
    : parent.children.length;

  parent.children.splice(index, 0, node);

  node.parent = parent;

  const root = parent.kind === "root" ? parent : parent.root;

  if (!root) {
    return;
  }

  mount(root, node);

  if (parent.kind === "root") {
    root.mutations.setRoot(node.id);
  } else if (anchor) {
    root.mutations.insertBefore(parent.id, node.id, anchor.id);
  } else {
    root.mutations.appendChild(parent.id, node.id);
  }
};

const markUnmounted = (node: HostNode): void => {
  node.mounted = false;

  if (node.root) {
    unregisterEventHandlers(node.root.eventHandlers, node.id);
  }

  for (const child of node.children) {
    markUnmounted(child);
  }
};

export const removeHostNode = (parent: HostParent, node: HostNode): void => {
  if (node.parent !== parent) {
    return;
  }

  removeFromParent(node);

  const root = parent.kind === "root" ? parent : parent.root;

  if (!root || !node.mounted) {
    return;
  }

  markUnmounted(node);

  root.mutations.destroyElement(node.id);
};

export const getParentNode = (node: HostNode): HostParent | undefined =>
  node.parent ?? undefined;

export const getFirstChild = (parent: HostParent): HostNode | undefined =>
  parent.children[0];

export const getNextSibling = (node: HostNode): HostNode | undefined => {
  const { parent } = node;

  if (!parent) {
    return undefined;
  }

  const index = parent.children.indexOf(node);

  return index === -1 ? undefined : parent.children[index + 1];
};

export const isHostText = (node: HostNode | HostParent): node is HostText =>
  node.kind === "text";

/** Structural, not `instanceof`: a JSX file compiled against the published
 *  package and a component from source build nodes from two class copies. */
export const isHostElement = (value: unknown): value is HostElement =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "element";
