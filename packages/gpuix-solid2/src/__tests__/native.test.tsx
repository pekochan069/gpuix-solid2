import { expect, test } from "bun:test";

const native = await import("@gpuix/native/testing").catch(() => null);

const nativeTest = native?.hasNativeTestRenderer === true ? test : test.skip;

nativeTest(
  "native offscreen rendering (requires GPUIX test-support binary)",
  async () => {
    const { createTestRoot } = await import("../testing.js");

    const app = createTestRoot();

    try {
      app.render(() => <text>Solid 2 native</text>);

      expect(app.renderer.getAllText()).toContain("Solid 2 native");
    } finally {
      app.unmount();
    }
  }
);
