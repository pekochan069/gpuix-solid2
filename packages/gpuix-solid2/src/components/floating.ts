import type { EventPayload } from "@gpuix/native";
import { pushDismissLayer } from "@gpuix/native/host";
import type {
  DismissLayer,
  HostProps,
  KeyEvent,
  StyleDesc,
} from "@gpuix/native/host";
import {
  merge,
  createComponent,
  createContext,
  untrack,
  onSettled,
  useContext,
} from "solid-js";
import type { Element } from "solid-js";

import { isHostElement, isHostEventHandler } from "../host.js";
import { jsx } from "../jsx-runtime.js";
import type { SolidHostProps } from "../jsx-runtime.js";
import { useGpuix } from "../root.js";
import { spread } from "../universal.js";

export type FloatingSide = "top" | "right" | "bottom" | "left";

export type FloatingAlign = "start" | "center" | "end";

export type StateStyle<State> = StyleDesc | ((state: State) => StyleDesc);

export interface FloatingContentProps extends HostProps {
  children?: Element;
  side?: FloatingSide;
  sideOffset?: number;
  align?: FloatingAlign;
  alignOffset?: number;
  collisionPadding?: number;
}

export const resolveStyle = <State>(
  style: StateStyle<State> | undefined,
  state: State
): StyleDesc | undefined =>
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Select the callback or value form of this typed renderer API.
  typeof style === "function" ? style(state) : style;

export const mergeStyles = (
  base: StyleDesc | undefined,
  override: StyleDesc | undefined
): StyleDesc | undefined => {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  return { ...base, ...override };
};

export const floatingRootStyle = (style?: StyleDesc): StyleDesc => ({
  alignItems: "start",
  display: "flex",
  position: "relative",
  ...style,
});

const DismissLayerContext = createContext<DismissLayer | null>(null);

export interface DismissableLayerProps {
  children?: Element;
  /** Escape reached the window, this layer is on top, and nothing prevented it. */
  onEscapeKeyDown: (event: KeyEvent) => void;
  /** Element to focus when the layer opens on top. Null leaves focus. */
  initialFocus?: () => number | null;
  /** Element to focus on close. `previous` is the focus from before it opened. */
  finalFocus?: (previous: number | null) => number | null;
}

/**
 * Put an open overlay on the window's layer stack while mounted. Escape closes
 * only the top layer. Layers inside this one, such as a Select in a Dialog,
 * are always above it. The stack also moves focus in and out, in stack order.
 */
export const DismissableLayer = (props: DismissableLayerProps): Element => {
  const context = useGpuix();

  const { renderer } = context;

  // Read now: Solid has not created this layer's elements yet.
  const previousFocus = renderer.getFocusedElementId?.() ?? null;

  const layer: DismissLayer = {
    finalFocus: (previous) => props.finalFocus?.(previous) ?? null,
    initialFocus: () => props.initialFocus?.() ?? null,
    onEscapeKeyDown: (event) => {
      props.onEscapeKeyDown(event);
    },
    parent: useContext(DismissLayerContext) ?? undefined,
  };

  // After the children exist, so initialFocus can name one of them.
  onSettled(() => {
    context.flushMutations();

    return pushDismissLayer(renderer, layer, { previousFocus });
  });

  return createComponent(DismissLayerContext, {
    get children() {
      return props.children;
    },
    value: layer,
  });
};

export const composeHandlers = <Event extends EventPayload>(
  first?: (event: Event) => void,
  second?: (event: Event) => void
) => {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return (event: Event) => {
    first(event);

    second(event);
  };
};

/**
 * Render `props` on a `div`, or spread them onto the single `asChild` element.
 *
 * `defaultTabIndex` makes the part a tab stop, like the `<button>` Base UI
 * renders. An explicit `tabIndex` on the part, then on the child, wins. The
 * child's own handlers run before the part's, like React `asChild`.
 */
export const renderSlot = (args: {
  asChild?: boolean;
  children?: Element;
  props: Omit<SolidHostProps, "children">;
  defaultTabIndex?: number;
}): Element => {
  const asChild = untrack(() => args.asChild === true);

  const child = asChild ? untrack(() => args.children) : undefined;

  if (asChild && !isHostElement(child)) {
    throw new Error("asChild requires one GPUIX intrinsic element");
  }

  const childTabIndex = isHostElement(child)
    ? child.props.get("tabIndex")
    : undefined;

  const props = merge(args.props, {
    get tabIndex() {
      return (
        args.props.tabIndex ??
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Select the callback or value form of this typed renderer API.
        (typeof childTabIndex === "number"
          ? childTabIndex
          : args.defaultTabIndex)
      );
    },
  });

  if (!isHostElement(child)) {
    return jsx(
      "div",
      merge(props, {
        get children() {
          return args.children;
        },
      })
    );
  }

  const handlers: Record<string, (event: EventPayload) => void> = {};

  for (const name of Object.keys(args.props)) {
    const own = child.props.get(name);

    if (!name.startsWith("on") || !isHostEventHandler(own)) {
      continue;
    }

    // The child's listener runs before the slot's listener; read the latter at dispatch.
    Object.defineProperty(handlers, name, {
      enumerable: true,
      get() {
        const descriptor = Object.getOwnPropertyDescriptor(args.props, name);

        const handler: unknown = descriptor?.get
          ? descriptor.get()
          : descriptor?.value;

        return (event: EventPayload) => {
          own(event);

          if (isHostEventHandler(handler)) {
            handler(event);
          }
        };
      },
    });
  }

  spread(child, merge(props, handlers), true);

  return child;
};

export const FloatingLayer = (props: FloatingContentProps): Element =>
  jsx("anchored", {
    get align() {
      return props.align ?? "start";
    },
    get children() {
      return jsx(
        "div",
        merge(props, {
          get children() {
            return props.children;
          },
          get style() {
            return mergeStyles({ backgroundColor: "#1A1A1A" }, props.style);
          },
        })
      );
    },
    deferred: true,
    fit: "snap",
    get gap() {
      return props.sideOffset ?? 0;
    },
    get occlude() {
      return props.style?.pointerEvents !== "none";
    },
    get offset() {
      const side = props.side ?? "bottom";

      const alignOffset = props.alignOffset ?? 0;

      return side === "top" || side === "bottom"
        ? { x: alignOffset, y: 0 }
        : { x: 0, y: alignOffset };
    },
    priority: 1,
    get side() {
      return props.side ?? "bottom";
    },
    get snapMargin() {
      return props.collisionPadding ?? 8;
    },
  });
