/* oxlint-disable solid/style-prop -- GPUIX uses its native StyleDesc with camelCase names and numeric dimensions. */
import { Button, createWindowSize, render } from "gpuix-solid2";
import { createSignal } from "solid-js";

const App = () => {
  const [count, setCount] = createSignal(0);

  const size = createWindowSize();

  return (
    <div style={{ flexDirection: "column", gap: 12, padding: 24 }}>
      <text>
        Window: {size().width} × {size().height}
      </text>
      <Button
        style={{ backgroundColor: "#334155", padding: 12 }}
        onClick={() => {
          setCount((value) => value + 1);
        }}
      >
        <text>Count: {count()}</text>
      </Button>
    </div>
  );
};

render(() => <App />, { height: 480, title: "Solid 2 GPUIX", width: 640 });
