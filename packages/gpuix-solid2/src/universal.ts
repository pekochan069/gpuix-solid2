/* oxlint-disable typescript/unbound-method -- Universal renderer helpers are closure functions and never use this. */
import { createRenderer } from "@solidjs/universal";
import { runWithOwner } from "solid-js";
import type { Element } from "solid-js";

import {
  createHostElement,
  createHostText,
  getFirstChild,
  getNextSibling,
  getParentNode,
  insertHostNode,
  isHostText,
  isHostPropertyValue,
  removeHostNode,
  replaceHostText,
  setHostProperty,
} from "./host.js";
import type { HostNode, HostParent } from "./host.js";

export { createComponent } from "solid-js";

const runtime = createRenderer<HostNode | HostParent>({
  createElement(type, staticProps) {
    const node = createHostElement(type);

    for (const [name, value] of Object.entries(staticProps ?? {})) {
      if (isHostPropertyValue(value)) {
        setHostProperty(node, name, value);
      }
    }

    return node;
  },
  createTextNode: createHostText,
  getFirstChild(node) {
    return node.kind === "text" ? undefined : getFirstChild(node);
  },
  getNextSibling(node) {
    return node.kind === "root" ? undefined : getNextSibling(node);
  },
  getParentNode(node) {
    return node.kind === "root" ? undefined : getParentNode(node);
  },
  insertNode(parent, node, anchor) {
    if (
      parent.kind === "text" ||
      node.kind === "root" ||
      anchor?.kind === "root"
    ) {
      throw new TypeError("Expected GPUIX host nodes");
    }

    insertHostNode(parent, node, anchor);
  },
  isTextNode: isHostText,
  removeNode(parent, node) {
    if (parent.kind === "text" || node.kind === "root") {
      throw new TypeError("Expected GPUIX host nodes");
    }

    removeHostNode(parent, node);
  },
  replaceText(node, value) {
    if (!isHostText(node)) {
      throw new TypeError("Expected a GPUIX text node");
    }

    replaceHostText(node, value);
  },
  setProperty(node, name, value, previous) {
    if (
      node.kind !== "root" &&
      isHostPropertyValue(value) &&
      isHostPropertyValue(previous)
    ) {
      setHostProperty(node, name, value, previous);
    }
  },
});

export const universalRender = (
  code: () => Element,
  root: HostParent
): (() => void) =>
  runWithOwner(null, () =>
    runtime.render(() => {
      const container = createHostElement("div");

      setHostProperty(container, "style", {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      });

      runtime.insert(container, code());

      return container;
    }, root)
  );

export const { effect } = runtime;

export const { memo } = runtime;

export const { createElement } = runtime;

export const { createTextNode } = runtime;

export const { insertNode } = runtime;

export const { insert } = runtime;

export const { spread } = runtime;

export const { setProp } = runtime;

export const { mergeProps } = runtime;

export const { ref } = runtime;

export const { applyRef } = runtime;
