import {
  createComponent,
  createContext,
  createMemo,
  useContext,
} from "solid-js";
import type { Element } from "solid-js";

export interface Locale {
  locale: string;
  direction: "ltr" | "rtl";
}

const LocaleContext = createContext<Locale>({
  direction: "ltr",
  locale: "en-US",
});

export const isRTL = (locale: string): boolean => {
  const language = new Intl.Locale(locale).maximize();

  return ["Arab", "Hebr", "Thaa", "Nkoo", "Adlm", "Rohg", "Syrc"].includes(
    language.script ?? ""
  );
};

export const I18nProvider = (props: { locale: string; children?: Element }) =>
  createComponent(LocaleContext, {
    get children() {
      return props.children;
    },
    value: {
      get direction() {
        return isRTL(props.locale) ? "rtl" : "ltr";
      },
      get locale() {
        return props.locale;
      },
    },
  });

export const createLocale = (): Locale => useContext(LocaleContext);

export const createCollator = (options?: Intl.CollatorOptions) => {
  const locale = createLocale();
  const formatter = createMemo(() => new Intl.Collator(locale.locale, options));

  return {
    compare: (a: string, b: string) => formatter().compare(a, b),
    resolvedOptions: () => formatter().resolvedOptions(),
  };
};

export const createNumberFormatter = (options?: Intl.NumberFormatOptions) => {
  const locale = createLocale();

  const formatter = createMemo(
    () => new Intl.NumberFormat(locale.locale, options)
  );

  return {
    format: (value: number) => formatter().format(value),
    formatToParts: (value: number) => formatter().formatToParts(value),
    resolvedOptions: () => formatter().resolvedOptions(),
  };
};

export const createDateFormatter = (options?: Intl.DateTimeFormatOptions) => {
  const locale = createLocale();

  const formatter = createMemo(
    () => new Intl.DateTimeFormat(locale.locale, options)
  );

  return {
    format: (value: Date | number) => formatter().format(value),
    formatToParts: (value: Date | number) => formatter().formatToParts(value),
    resolvedOptions: () => formatter().resolvedOptions(),
  };
};

export const createListFormatter = (options?: Intl.ListFormatOptions) => {
  const locale = createLocale();

  const formatter = createMemo(
    () => new Intl.ListFormat(locale.locale, options)
  );

  return {
    format: (value: Iterable<string>) => formatter().format(value),
    resolvedOptions: () => formatter().resolvedOptions(),
  };
};
