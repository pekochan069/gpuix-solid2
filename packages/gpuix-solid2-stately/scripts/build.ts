import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dir, "..");
const output = path.join(root, "dist");

const upstream = path.dirname(
  fileURLToPath(import.meta.resolve("@solid2-aria/stately/package.json"))
);

const shared = path.dirname(
  fileURLToPath(import.meta.resolve("@solid2-aria/types-shared/package.json"))
);

const modificationNotice =
  "/* Modified for GPUIX: explicit native platform contracts. See NOTICE.txt. */\n";

/** Fail closed when a pinned upstream patch no longer matches. */
const replaceExactly = (
  source: string,
  before: string,
  after: string,
  count = 1
): string => {
  assert.equal(
    source.split(before).length - 1,
    count,
    `Upstream drift: ${before}`
  );

  return source.replaceAll(before, after);
};

const adapt = async (
  relative: string,
  transform: (source: string) => string
) => {
  const destination = path.join(output, relative);
  const source = await readFile(destination, "utf-8");
  await writeFile(destination, modificationNotice + transform(source));
};

const relativeModule = (from: string, to: string): string => {
  const relative = path
    .relative(path.dirname(from), to)
    .split(path.sep)
    .join("/");

  return relative.startsWith(".") ? relative : `./${relative}`;
};

await rm(output, { force: true, recursive: true });

await mkdir(output, { recursive: true });

// Keep upstream algorithms, translations, and copyright blocks together.
const upstreamFiles = await readdir(path.join(upstream, "dist"), {
  recursive: true,
});

const files = upstreamFiles
  .filter((file) => file.endsWith(".js") || file.endsWith(".d.ts"))
  .map((file) => file.split(path.sep).join("/"))
  .toSorted();

await Promise.all(
  files.map(async (file) => {
    const destination = path.join(output, file);
    let source = await readFile(path.join(upstream, "dist", file), "utf-8");
    source = source.replace(/\n\/\/# sourceMappingURL=.*$/u, "\n");

    if (file.endsWith(".d.ts")) {
      const sharedImport = relativeModule(
        destination,
        path.join(output, "shared/index.js")
      );

      source = source.replaceAll(
        '"@solid2-aria/types-shared"',
        `"${sharedImport}"`
      );

      if (/HTMLInputElement|PointerEvent/u.test(source)) {
        const nativeImport = relativeModule(
          destination,
          path.join(output, "native-platform.js")
        );

        const imports = [
          ...(source.includes("HTMLInputElement") ? ["NativeTarget"] : []),
          ...(source.includes("PointerEvent") ? ["NativePointerEvent"] : []),
        ];

        source = `import type { ${imports.join(", ")} } from "${nativeImport}";\n${source.replaceAll("HTMLInputElement", "NativeTarget").replaceAll("PointerEvent", "NativePointerEvent")}`;
      }

      source = modificationNotice + source;
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, source);
  })
);

await cp(path.join(shared, "types"), path.join(output, "shared"), {
  recursive: true,
});

await cp(
  path.join(root, "src/native-platform.d.ts"),
  path.join(output, "native-platform.d.ts")
);

const sharedFiles = await readdir(path.join(output, "shared"));

await Promise.all(
  sharedFiles.map(async (file) => {
    if (!file.endsWith(".d.ts")) {
      return;
    }

    await adapt(`shared/${file}`, (source) =>
      source.replaceAll('"@solid2-aria/types-shared"', '"./index.js"')
    );
  })
);

await adapt(
  "shared/platform.d.ts",
  () => `
import type { NativeEvent, NativeFocusEvent, NativeKeyboardEvent as KeyEvent, NativeMouseEvent, NativeTarget } from "../native-platform.js";
export type TargetedEvent<T = NativeTarget, E = NativeEvent<T>> = E & { readonly currentTarget: T };
export type FocusEvent<T = NativeTarget> = NativeFocusEvent<T>;
export type MouseEvent<T = NativeTarget> = NativeMouseEvent<T>;
export type NativeKeyboardEvent<T = NativeTarget> = KeyEvent<T>;
export type SubmitEvent<T = NativeTarget> = NativeEvent<T>;
export type HTMLAttributeAnchorTarget = string | false;
export type HTMLAttributeReferrerPolicy = string | false;
`
);

await adapt(
  "shared/dom.d.ts",
  (source) =>
    `import type { NativeTarget } from "../native-platform.js";\n${replaceExactly(
      source,
      "export interface FocusableElement extends Element, HTMLOrSVGElement {}",
      "export type FocusableElement = NativeTarget;"
    )}`
);

await adapt("shared/events.d.ts", (source) => {
  let result = source.replace(
    /export type EventMapType[\s\S]*?GlobalEventHandlersEventMap;/u,
    "export type EventMapType<T extends NativeTarget> = { focus: FocusEvent<T>; blur: FocusEvent<T>; keydown: NativeKeyboardEvent<T>; keyup: NativeKeyboardEvent<T> };"
  );

  assert.notEqual(result, source, "Upstream event map changed");
  result = result
    .replaceAll("EventTarget", "NativeTarget")
    .replaceAll("extends Event>", "extends NativeEvent>")
    .replaceAll("NativeKeyboardEvent<any>", "NativeKeyboardEvent<NativeTarget>")
    .replaceAll(/\b(?:HTMLElement|Element)\b/gu, "NativeTarget");
  // Keep the upstream helper's public name while changing its fallback target.
  result = result.replaceAll("NativeTargetType", "EventTargetType");

  return `import type { NativeEvent, NativeTarget } from "../native-platform.js";\n${result}`;
});

await adapt(
  "shared/inputs.d.ts",
  (source) =>
    `import type { NativeValidationDetails } from "../native-platform.js";\n${replaceExactly(
      source,
      "validationDetails: ValidityState;",
      "validationDetails: NativeValidationDetails;"
    )}`
);

await adapt(
  "shared/dnd.d.ts",
  (source) =>
    `import type { NativeFile, NativeTarget } from "../native-platform.js";\n${replaceExactly(
      replaceExactly(source, "Promise<File>", "Promise<NativeFile>"),
      "HTMLElement | null",
      "NativeTarget | null"
    )}`
);

await adapt("datepicker/utils.js", (source) => {
  let result = replaceExactly(
    source,
    "function getLocale() {",
    'function getLocale(locale = "en-US") {'
  );

  result = replaceExactly(
    result,
    '\tlet locale = typeof navigator !== "undefined" && (navigator.language || ("userLanguage" in navigator ? String(navigator.userLanguage) : "")) || "en-US";\n',
    ""
  );
  result = replaceExactly(
    result,
    "getLocale()",
    "getLocale(options.locale)",
    2
  );
  result = replaceExactly(
    result,
    'LocalizedStringDictionary.getGlobalDictionaryForPackage("@react-stately/datepicker") ?? dictionary',
    "dictionary",
    2
  );

  // The published translations contain plain placeholders, rather than formatter functions.
  for (const [message, boundary] of [
    ["rangeUnderflow", "minValue"],
    ["rangeOverflow", "maxValue"],
  ]) {
    result = replaceExactly(
      result,
      `formatter.format("${message}", { ${boundary}: dateFormatter.format(${boundary}.toDate(timeZone)) })`,
      `formatter.format("${message}").replaceAll("{${boundary}}", dateFormatter.format(${boundary}.toDate(timeZone)))`
    );
  }

  return result;
});

await adapt("datepicker/utils.d.ts", (source) =>
  replaceExactly(
    source,
    "export interface FormatterOptions {",
    "export interface FormatterOptions {\n  /** Locale for validation messages. Defaults to en-US. */\n  locale?: string;"
  )
);

await Promise.all(
  ["date-field", "date-picker", "date-range-picker"].map(async (module) => {
    await adapt(`datepicker/create-${module}-state.js`, (source) =>
      replaceExactly(
        source,
        module === "date-range-picker"
          ? "currentIsDateUnavailable ? (date) => currentIsDateUnavailable(date, null) : void 0, currentFormatOpts)"
          : "currentIsDateUnavailable, currentFormatOpts)",
        module === "date-range-picker"
          ? "currentIsDateUnavailable ? (date) => currentIsDateUnavailable(date, null) : void 0, { ...currentFormatOpts, locale: props.locale })"
          : "currentIsDateUnavailable, { ...currentFormatOpts, locale: props.locale })"
      )
    );
  })
);

await Promise.all(
  ["date-picker", "date-range-picker"].map(async (module) => {
    await adapt(`datepicker/create-${module}-state.d.ts`, (source) =>
      replaceExactly(
        source,
        "  shouldCloseOnSelect?:",
        "  /** Locale for validation messages. Defaults to en-US. */\n  locale?: string;\n  shouldCloseOnSelect?:"
      )
    );
  })
);

await adapt("virtualizer/create-virtualizer-state.js", (source) => {
  let result = replaceExactly(
    source,
    "new Rect(0, 0, 0, 0)",
    "untrack(() => opts.initialVisibleRect)"
  );

  result = replaceExactly(
    result,
    "new Size()",
    "untrack(() => opts.initialSize ?? new Size(opts.initialVisibleRect.width, opts.initialVisibleRect.height))"
  );

  result = replaceExactly(
    result,
    "\tconst [isScrolling, setScrolling]",
    '\tconst layoutSize = createMemo(() => opts.sizeMode === "explicit" ? size() : new Size(visibleRect().width, visibleRect().height));\n\tconst [isScrolling, setScrolling]'
  );
  result = replaceExactly(result, "return size();", "return layoutSize();");

  return replaceExactly(
    result,
    "opts.allowsWindowScrolling === true ? size() : visibleRect()",
    "layoutSize()"
  );
});

await adapt("virtualizer/create-virtualizer-state.d.ts", (source) =>
  replaceExactly(
    source,
    "  allowsWindowScrolling?: boolean;",
    `  /** Initial viewport supplied by the native host. */
  initialVisibleRect: Rect;
  /** Initial layout size; defaults to initialVisibleRect. */
  initialSize?: Size;
  /** Use setSize for explicit layout sizing, or follow the viewport (default). */
  sizeMode?: "viewport" | "explicit";`
  )
);

await adapt("virtualizer/virtualizer.js", (source) => {
  const result = source.replace(
    /\t\tconst isTestEnv =[^\n]+\n\t\tconst isClientWidthMocked =[^\n]+\n\t\tconst isClientHeightMocked =[^\n]+\n\t\tconst rect =[^\n]+/u,
    "\t\tconst rect = this._overscanManager.getOverscannedRect();"
  );

  assert.notEqual(result, source, "Upstream virtualizer test fallback changed");

  return result;
});

// The controlled primitive is useful without a component and was subpath-only upstream.
await Promise.all(
  ["js", "d.ts"].map(async (extension) => {
    const entry = path.join(output, `index.${extension}`);
    const source = await readFile(entry, "utf-8");
    await writeFile(
      entry,
      `${modificationNotice}${source}\nexport { createControlledSignal } from "./utils/create-controlled-signal.js";\n`
    );
  })
);

await adapt("numberfield/create-number-field-state.js", (source) =>
  replaceExactly(
    source,
    "\t\tif (v === numberValue()) setInputValue(format(v));\n\t\tsetNumberValue(v);",
    "\t\tsetNumberValue(v);\n\t\tsetInputValue(format(numberValue()));"
  )
);

await cp(path.join(root, "LICENSES"), path.join(output, "LICENSES"), {
  recursive: true,
});

await cp(path.join(root, "NOTICE.txt"), path.join(output, "NOTICE.txt"));

await writeFile(
  path.join(output, "native-audit.json"),
  `${JSON.stringify(
    {
      modules: files
        .filter((file) => file.endsWith(".js"))
        .map((file) => ({
          module: file.slice(0, -3),
          status:
            (file.startsWith("datepicker/") &&
              /utils|create-date-/u.test(file)) ||
            [
              "virtualizer/create-virtualizer-state.js",
              "virtualizer/virtualizer.js",
              "index.js",
              "numberfield/create-number-field-state.js",
            ].includes(file)
              ? "adapted"
              : "unchanged",
        })),
      sharedTypes: "@solid2-aria/types-shared@0.0.1",
      upstream: "@solid2-aria/stately@0.0.1",
    },
    null,
    2
  )}\n`
);
