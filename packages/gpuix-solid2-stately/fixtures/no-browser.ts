// Detect browser access even through `typeof`, before loading any state modules.
for (const name of ["document", "window", "navigator", "HTMLElement"]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      throw new Error(`Browser global accessed: ${name}`);
    },
  });
}
