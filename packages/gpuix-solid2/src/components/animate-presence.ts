import type { EventPayload } from "@gpuix/native";
import {
  children,
  createContext,
  createRenderEffect,
  createSignal,
  For,
  untrack,
  useContext,
} from "solid-js";
import type { Accessor, Element } from "solid-js";

import { isHostElement, isHostEventHandler, setHostProperty } from "../host.js";

export interface PresenceContextValue {
  isPresent: Accessor<boolean>;
  initial: false | undefined;
  safeToRemove: () => void;
}

export const PresenceContext = createContext<PresenceContextValue | null>(null);

export const usePresence = (): [Accessor<boolean>, () => void] => {
  const context = useContext(PresenceContext);

  return context
    ? [context.isPresent, context.safeToRemove]
    : [
        () => true,
        () => {
          /* empty */
        },
      ];
};

export const useIsPresent = (): Accessor<boolean> => usePresence()[0];

export interface AnimatePresenceProps {
  children?: Element;
  initial?: boolean;
  onExitComplete?: () => void;
}

interface Entry {
  item: Element;
  present: boolean;
  isPresent: Accessor<boolean>;
  setPresent: (value: boolean) => void;
}

const normalize = (value: Element): Element[] => {
  if (
    value === null ||
    value === undefined ||
    value === true ||
    value === false
  ) {
    return [];
  }

  return Array.isArray(value) ? value.flatMap(normalize) : [value];
};

export const AnimatePresence = (props: AnimatePresenceProps): Element => {
  const resolved = children(() => props.children);

  const entries = new Map<Element, Entry>();

  // The renderer retains exiting host nodes independently of source ownership.
  const [rendered, setRendered] = createSignal<Entry[]>([], {
    ownedWrite: true,
  });

  const initialAnimation = untrack(() => props.initial);

  let initial = true;

  let current: Entry[] = [];

  const remove = (entry: Entry) => {
    if (entry.present || !entries.delete(entry.item)) {
      return;
    }

    current = current.filter((candidate) => candidate !== entry);

    setRendered(current);

    if (![...entries.values()].some((candidate) => !candidate.present)) {
      props.onExitComplete?.();
    }
  };

  createRenderEffect(
    () => ({
      items: normalize(resolved()),
      onExitComplete: props.onExitComplete,
    }),
    ({ items, onExitComplete }) => {
      const next: Entry[] = [];

      let removedImmediately = false;

      for (const item of items) {
        let entry = entries.get(item);

        if (!entry) {
          const [isPresent, setPresent] = createSignal(true, {
            ownedWrite: true,
          });

          entry = {
            isPresent,
            item,
            present: true,
            setPresent: (present) => {
              setPresent(present);
            },
          };

          entries.set(item, entry);
        }

        entry.present = true;

        entry.setPresent(true);

        if (
          initial &&
          initialAnimation === false &&
          isHostElement(item) &&
          item.motion
        ) {
          const previous = item.motion;

          item.motion = { ...previous, initial: false };

          setHostProperty(item, "motion", item.motion, previous);
        }

        next.push(entry);
      }

      for (const entry of current) {
        if (items.includes(entry.item)) {
          continue;
        }

        const { item } = entry;

        if (!isHostElement(item) || !item.motion?.exit) {
          entries.delete(item);

          removedImmediately = true;

          continue;
        }

        if (entry.present) {
          entry.present = false;

          entry.setPresent(false);

          const previous = item.motion;

          item.motion = {
            ...previous,
            animate: previous.exit ?? previous.animate,
            generation: previous.generation + 1,
            isExit: true,
          };

          setHostProperty(item, "motion", item.motion, previous);

          const handler = item.props.get("onMotionComplete");

          setHostProperty(
            item,
            "onMotionComplete",
            // oxlint-disable-next-line solid/reactivity -- Native completion invokes this callback after the animation.
            (event: EventPayload) => {
              if (event.motionGeneration !== item.motion?.generation) {
                return;
              }

              if (isHostEventHandler(handler)) {
                handler(event);
              }

              remove(entry);
            },
            handler
          );
        }

        next.push(entry);
      }

      current = next;

      setRendered(next);

      initial = false;

      if (removedImmediately && next.every((entry) => entry.present)) {
        onExitComplete?.();
      }
    }
  );

  return For({
    children(entry) {
      return PresenceContext({
        get children() {
          return entry.item;
        },
        value: {
          initial: initialAnimation === false ? false : undefined,
          isPresent: entry.isPresent,
          safeToRemove: () => {
            remove(entry);
          },
        },
      });
    },
    get each() {
      return rendered();
    },
  });
};
