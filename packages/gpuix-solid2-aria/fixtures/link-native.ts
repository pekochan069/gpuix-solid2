import assert from "node:assert/strict";

import { GpuixRenderer } from "@gpuix/native";
import { createRoot } from "gpuix-solid2";
import type { HostElement } from "gpuix-solid2";
import { jsx } from "gpuix-solid2/jsx-runtime";
import { createSignal, merge } from "solid-js";
import type { Setter } from "solid-js";

import { createBreadcrumbItem, createBreadcrumbs } from "../src/breadcrumbs.js";
import { createLink } from "../src/link.js";

const renderer = new GpuixRenderer((error, event) => {
  if (error) {
    throw error;
  }

  // oxlint-disable-next-line no-use-before-define -- Native callbacks run after initialization.
  app.dispatch(event);
});

renderer.init({
  height: 390,
  title: "GPUIX Link and Breadcrumbs native verification",
  width: 600,
});

const app = createRoot(renderer, { keyboardFocusDim: false });
const nodes = new Map<string, HostElement>();
let disable!: Setter<boolean>;
let current!: Setter<boolean>;
let actions!: () => number;

const node = (name: string) => {
  const result = nodes.get(name);
  assert.ok(result, `Missing ${name}`);

  return result;
};

app.render(() => {
  const [disabled, setDisabled] = createSignal(false);
  const [isCurrent, setCurrent] = createSignal(true);
  const [count, setCount] = createSignal(0);
  disable = setDisabled;
  current = setCurrent;
  actions = count;

  const link = (name: string, breadcrumb = false) => {
    let element: HostElement | null = null;

    const props = {
      get "aria-description"() {
        return `Navigations: ${count()}.`;
      },
      "aria-label": name,
      get isCurrent() {
        return name === "Current page" && isCurrent();
      },
      get isDisabled() {
        return name === "Unavailable" || (name === "Home" && disabled());
      },
      onPress() {
        setCount((value) => value + 1);
      },
    };

    const linkProps = breadcrumb
      ? createBreadcrumbItem(props, () => element).itemProps
      : createLink(props, () => element).linkProps;

    return jsx(
      "div",
      merge(linkProps, {
        children: name,
        ref(value: HostElement) {
          element = value;
          nodes.set(name, value);
        },
        style: {
          backgroundColor: "#d9e8f2",
          height: 38,
          padding: 8,
          width: 450,
        },
      })
    );
  };

  return jsx("div", {
    children: [
      link("Before navigation"),
      jsx(
        "div",
        merge(
          createBreadcrumbs({
            "aria-description":
              "Links to parent pages. Current page is inactive.",
            "aria-label": "Breadcrumbs",
          }).navProps,
          {
            children: [
              link("Home", true),
              link("Unavailable", true),
              link("Current page", true),
            ],
            style: {
              borderColor: "#466987",
              borderWidth: 2,
              gap: 8,
              padding: 8,
            },
          }
        )
      ),
      link("After navigation"),
    ],
    style: { gap: 8, padding: 16 },
  });
});

const settle = async () => {
  for (let index = 0; index < 8; index += 1) {
    renderer.tick();
    // oxlint-disable-next-line no-await-in-loop -- Pump native events before checking focus.
    await Bun.sleep(15);
    app.flush();
  }
};

const key = async (name: string) => {
  renderer.simulateKeyDown(name);
  renderer.simulateKeyUp(name);
  await settle();
};

const focusIs = (name: string) => {
  assert.equal(renderer.getFocusedElementId(), node(name).id, name);
};

const click = async (name: string) => {
  const element = node(name);
  const bounds = renderer.getElementBounds(element.id);
  assert.ok(bounds && bounds.height > 0 && bounds.width > 0);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  assert.ok(renderer.getElementsAt(x, y).includes(element.id));
  renderer.simulateClick(x, y);
  await settle();
};

const verify = async () => {
  renderer.activateWindow();
  await settle();
  renderer.focusElement(node("Before navigation").id);
  await key("tab");
  focusIs("Home");
  await key("space");
  assert.equal(actions(), 0);
  await key("enter");
  assert.equal(actions(), 1);
  await key("tab");
  focusIs("After navigation");
  await key("shift-tab");
  focusIs("Home");
  await click("Home");
  assert.equal(actions(), 2);
  await click("Unavailable");
  await click("Current page");
  assert.equal(actions(), 2);
  app.flushSync(() => {
    disable(true);
  });
  renderer.focusElement(node("Before navigation").id);
  await key("tab");
  focusIs("After navigation");
  await click("Home");
  assert.equal(actions(), 2);
  app.flushSync(() => {
    disable(false);
    current(false);
  });
  renderer.focusElement(node("Home").id);
  await key("tab");
  focusIs("Current page");
  await key("enter");
  assert.equal(actions(), 3);
  app.flushSync(() => {
    current(true);
  });
  renderer.focusElement(node("Home").id);
  await key("tab");
  focusIs("After navigation");
  console.log(
    "Native Link and Breadcrumbs Enter, Space rejection, Tab traversal, reactive current and disabled guards, and pointer hit testing passed."
  );
};

try {
  if (process.env.GPUIX_ARIA_INSPECT_ONLY !== "1") {
    await verify();
  }

  if (process.env.GPUIX_ARIA_INSPECT === "1") {
    console.log("Link inspection ready for 60 seconds.");

    for (let index = 0; index < 600; index += 1) {
      renderer.tick();
      // oxlint-disable-next-line no-await-in-loop -- Keep the native window alive for OS inspection.
      await Bun.sleep(100);
      app.flush();
    }
  }
} finally {
  app.unmount();
}

process.exit(0);
