import { Button, createRoot } from "gpuix-solid2";
import type { HostElement, NativeRenderer } from "gpuix-solid2";
import { createSignal } from "solid-js";

export const verifyConsumer = (): string[] => {
  const renderer: NativeRenderer = { applyBatch: () => [] };

  const root = createRoot(renderer);

  let button!: HostElement;

  let label!: HostElement;

  const Counter = () => {
    const [count, setCount] = createSignal(0);

    return (
      <Button
        asChild
        onClick={() => {
          setCount((value) => value + 1);
        }}
      >
        <div
          ref={(element) => {
            button = element;
          }}
        >
          <text
            ref={(element) => {
              label = element;
            }}
          >
            {count()}
          </text>
        </div>
      </Button>
    );
  };

  root.render(() => <Counter />);

  const text = () =>
    label.children
      .map((node) => (node.kind === "text" ? node.text : ""))
      .join("");

  const initial = text();

  root.dispatch({ elementId: button.id, eventType: "click" });

  const updated = text();

  root.unmount();

  return [initial, updated, String(button.mounted)];
};
