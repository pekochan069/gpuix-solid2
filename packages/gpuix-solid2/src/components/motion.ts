import type { EventPayload } from "@gpuix/native";
import type { MotionProps } from "@gpuix/native/host";
import { createRenderEffect, omit, useContext } from "solid-js";
import type { Element } from "solid-js";

import { createHostElement, setHostProperty } from "../host.js";
import type { SolidHostProps } from "../jsx-runtime.js";
import { spread } from "../universal.js";
import { PresenceContext } from "./animate-presence.js";

export interface MotionDivProps extends SolidHostProps, MotionProps {}

export interface NativeMotionProps extends MotionProps {
  generation: number;
  isExit: boolean;
}

const MotionDiv = (props: MotionDivProps): Element => {
  const hostProps = omit(
    props,
    "initial",
    "animate",
    "exit",
    "transition",
    "onMotionComplete"
  );

  const presence = useContext(PresenceContext);

  const element = createHostElement("div");

  let generation = 0;

  let targetKey: string | undefined;

  spread(element, hostProps);

  createRenderEffect(
    () => {
      const { exit } = props;

      const isExit = Boolean(presence && !presence.isPresent() && exit);

      const initial = presence?.initial === false ? false : props.initial;

      const animate = isExit && exit ? exit : props.animate;

      const { transition } = props;

      return {
        animate,
        exit,
        initial,
        isExit,
        key: JSON.stringify([isExit, initial, animate, transition]),
        transition,
      };
    },
    ({ key, ...target }) => {
      if (key !== targetKey) {
        targetKey = key;

        generation += 1;
      }

      const motion = { ...target, generation };

      const previous = element.motion;

      element.motion = motion;

      setHostProperty(element, "motion", motion, previous);

      if (presence && target.isExit && !target.exit) {
        presence.safeToRemove();
      }
    }
  );

  // oxlint-disable-next-line solid/reactivity -- The native event dispatcher invokes this callback outside reactive computations.
  setHostProperty(element, "onMotionComplete", (event: EventPayload) => {
    if (event.motionGeneration !== element.motion?.generation) {
      return;
    }

    props.onMotionComplete?.(event);

    if (presence && !presence.isPresent()) {
      presence.safeToRemove();
    }
  });

  return element;
};

export const motion = { div: MotionDiv };
