// Locale resolution + message lookup, shared by the per-surface catalogues
// beside this file (demo.ts / player.ts / admin.ts — one per entry, so no bundle
// carries copy it never renders; a single pooled catalogue cost ~13KB per
// bundle instead of ~5KB). No i18n library: every byte here is paid for on a
// third-party page. See docs/feature-context.md Standing Constraints.
export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];

// The fallback locale, and each catalogue's completeness reference: the key
// union is derived from its `en` object, so a key missing from another locale is
// a `typecheck:runtime` error, not a runtime hole a learner finds.
export const DEFAULT_LOCALE: Locale = "en";

const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

// BCP 47: match the PRIMARY SUBTAG only. `de-AT`, `de_DE` and `DE` are all `de`;
// matching the full tag would silently fall back for every regional host.
const primarySubtag = (tag: unknown): string =>
  typeof tag === "string" ? tag.trim().toLowerCase().split(/[-_]/)[0] : "";

// Order: host override → the locale the page declares → the browser's own
// preferences → DEFAULT_LOCALE. An unrecognised value at any step is ignored,
// never thrown, so a typo'd override still yields a working UI.
export function resolveLocale(): Locale {
  const override = primarySubtag(window.__vpLocale);
  if (isLocale(override)) return override;

  const declared = primarySubtag(document.documentElement?.lang);
  if (isLocale(declared)) return declared;

  // The host declared nothing usable. DEFAULT_LOCALE is `en`, so without this
  // step a German learner on a page with no `lang` gets an English UI while
  // their browser is plainly asking for German.
  //
  // Walk the whole ORDERED list, not just navigator.language: a visitor whose
  // preferences are ["fr", "de", "en"] wants German, and reading only the first
  // entry would miss it and fall through to the default. `languages` is absent
  // on some older browsers, hence the single-value fallback.
  const preferences = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of preferences) {
    const preferred = primarySubtag(tag);
    if (isLocale(preferred)) return preferred;
  }

  return DEFAULT_LOCALE;
}

// Resolved once per module instance: the lookup sits on the per-`timeupdate`
// render path (~4x/s). No invalidation needed — a remount re-injects the bundle
// as a fresh module instance, so a mid-session `lang` change lands then.
let cachedLocale: Locale | null = null;

export function activeLocale(): Locale {
  if (cachedLocale === null) cachedLocale = resolveLocale();
  return cachedLocale;
}

// One warning per key: a missing message on the render path would otherwise
// flood the host page's console 4x/s.
const warned = new Set<string>();

export type Translate<K extends string> = (
  key: K,
  vars?: Readonly<Record<string, string | number>>,
) => string;

export function createT<K extends string>(
  messages: Record<Locale, Record<K, string>>,
): Translate<K> {
  return (key, vars) => {
    // The `??` is unreachable while the types hold — it is the runtime half of
    // the fallback contract, for a widened Record slipping past tsc.
    let message =
      messages[activeLocale()][key] ?? messages[DEFAULT_LOCALE][key];
    if (message === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn("[vp] missing message", key);
      }
      message = key;
    }
    // Most strings are placeholder-free, and this is a hot path.
    if (!vars) return message;
    return message.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = vars[name];
      // An unmatched placeholder stays literal; never render "undefined".
      return value === undefined ? match : String(value);
    });
  };
}
