import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Every test re-imports the modules. core.ts caches the resolved locale in a
// module-level `let` (deliberately — the lookup is on the render path), so
// without vi.resetModules() the first test's locale leaks into all the others.
const fresh = async () => {
  vi.resetModules();
  const [core, demo, player, admin] = await Promise.all([
    import("../../common/i18n/core"),
    import("../../common/i18n/demo"),
    import("../../common/i18n/player"),
    import("../../common/i18n/admin"),
  ]);
  return { core, demo, player, admin };
};

// The three per-surface catalogues, so the invariants below cover all of them.
const catalogues = async () => {
  const { core, demo, player, admin } = await fresh();
  return {
    LOCALES: core.LOCALES,
    surfaces: [
      {
        name: "demo",
        MESSAGES: demo.MESSAGES as Record<string, Record<string, string>>,
      },
      {
        name: "player",
        MESSAGES: player.MESSAGES as Record<string, Record<string, string>>,
      },
      {
        name: "admin",
        MESSAGES: admin.MESSAGES as Record<string, Record<string, string>>,
      },
    ],
  };
};

// happy-dom reports navigator.language "en-US" / languages ["en-US", "en"].
// Left alone, that silently satisfies every "falls back to DEFAULT_LOCALE" case
// (because the default IS "en") and the assertions would stop meaning what they
// say. So each test declares the browser preferences it wants, and beforeEach
// resets them to a locale the catalogues deliberately do NOT carry.
const setBrowserLanguages = (...tags: readonly string[]): void => {
  Object.defineProperty(navigator, "languages", {
    value: tags,
    configurable: true,
  });
  Object.defineProperty(navigator, "language", {
    value: tags[0] ?? "",
    configurable: true,
  });
};

const NO_BROWSER_PREFERENCE = "fr-CA";

beforeEach(() => {
  document.documentElement.removeAttribute("lang");
  delete window.__vpLocale;
  setBrowserLanguages(NO_BROWSER_PREFERENCE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveLocale", () => {
  it("falls back to DEFAULT_LOCALE with no signal at all", async () => {
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe(core.DEFAULT_LOCALE);
  });

  it("reads the locale the host page declares", async () => {
    document.documentElement.lang = "de";
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("matches the primary subtag, not the full tag", async () => {
    for (const tag of ["de-AT", "de-DE", "de_CH", "DE", " de "]) {
      document.documentElement.lang = tag;
      const { core } = await fresh();
      expect(core.resolveLocale(), tag).toBe("de");
    }
  });

  it("ignores an unknown language rather than crashing", async () => {
    document.documentElement.lang = "fr-CA";
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe(core.DEFAULT_LOCALE);
  });

  it("treats an empty lang attribute as no signal", async () => {
    document.documentElement.lang = "";
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe(core.DEFAULT_LOCALE);
  });

  it("lets __vpLocale win over the page's own lang", async () => {
    document.documentElement.lang = "de";
    window.__vpLocale = "en";
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("en");
  });

  it("subtag-matches the override too, so de-DE is a usable value", async () => {
    window.__vpLocale = "de-DE";
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("falls through to lang when the override is not a known locale", async () => {
    document.documentElement.lang = "de";
    window.__vpLocale = "klingon";
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("falls through when the override is not a string", async () => {
    document.documentElement.lang = "de";
    // A host can assign anything to a window global; the guard is `typeof`.
    (window as unknown as { __vpLocale?: unknown }).__vpLocale = 42;
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("uses the browser's language when the page declares none", async () => {
    setBrowserLanguages("de-DE", "de", "en");
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("walks the whole preference list, not just the first entry", async () => {
    // The visitor's top choice is unsupported; their SECOND is German. Reading
    // only navigator.language would miss it and fall through to the default.
    setBrowserLanguages("fr-CA", "de-AT", "en-GB");
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("honours the order of the preference list", async () => {
    setBrowserLanguages("en-GB", "de-DE");
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("en");
  });

  it("lets the page's lang outrank the browser's preference", async () => {
    // A lesson explicitly declared German must stay German even for a visitor
    // whose browser asks for English — the page is the stronger signal.
    document.documentElement.lang = "de";
    setBrowserLanguages("en-US", "en");
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("lets __vpLocale outrank the browser's preference", async () => {
    setBrowserLanguages("de-DE", "de");
    window.__vpLocale = "en";
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("en");
  });

  it("falls back to the default when no browser preference is supported", async () => {
    setBrowserLanguages("fr-CA", "es-MX");
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe(core.DEFAULT_LOCALE);
  });

  it("survives a browser that exposes no `languages` list", async () => {
    Object.defineProperty(navigator, "languages", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "language", {
      value: "de-CH",
      configurable: true,
    });
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe("de");
  });

  it("survives an empty `languages` list", async () => {
    setBrowserLanguages();
    const { core } = await fresh();
    expect(core.resolveLocale()).toBe(core.DEFAULT_LOCALE);
  });
});

describe("activeLocale", () => {
  it("caches the resolution instead of re-reading the DOM per call", async () => {
    document.documentElement.lang = "de";
    const { core } = await fresh();
    expect(core.activeLocale()).toBe("de");

    // A mid-session lang change must NOT take effect until the next remount
    // (which re-evaluates the module).
    document.documentElement.lang = "en";
    expect(core.activeLocale()).toBe("de");
  });

  it("is shared by every surface, so one mount cannot mix languages", async () => {
    document.documentElement.lang = "de";
    const { demo, player, admin } = await fresh();
    expect(demo.t("demo.tab.science")).toBe("Wissenschaft");
    expect(player.t("player.label.off")).toBe("Aus");
    expect(admin.t("admin.dialog.close")).toBe("Schließen");
  });
});

describe("t", () => {
  it("returns the active locale's string", async () => {
    document.documentElement.lang = "de";
    const { demo } = await fresh();
    expect(demo.t("demo.tab.science")).toBe("Wissenschaft");
  });

  it("returns the default locale's string when nothing is declared", async () => {
    const { demo } = await fresh();
    expect(demo.t("demo.tab.science")).toBe("Science");
  });

  it("interpolates every placeholder in the inventory", async () => {
    const { demo, player } = await fresh();
    expect(demo.t("demo.science.mentions", { count: 3 })).toBe("3 mentions");
    expect(demo.t("demo.phase.count", { count: 7 })).toBe("7 interventions");
    expect(demo.t("demo.audio.by", { voice: "Tony" })).toBe("by Tony");
    expect(demo.t("quiz.summary.score", { pct: 67 })).toBe(
      "67% answered correctly",
    );
    expect(demo.t("demo.meta.step", { n: 3, total: 7 })).toBe("Step 3 / 7");
    expect(demo.t("demo.section.progress", { done: 2, total: 5 })).toBe(
      "2 of 5 completed",
    );
    expect(player.t("player.title.audio", { track: "Deutsch" })).toBe(
      "Audio: Deutsch",
    );
    expect(player.t("player.drift.badge", { offset: "+1.4" })).toBe(
      "Audio +1.4s",
    );
  });

  it("leaves an unmatched placeholder literal and never renders undefined", async () => {
    const { demo } = await fresh();
    expect(demo.t("demo.meta.step", { n: 3 })).toBe("Step 3 / {total}");
    expect(demo.t("demo.audio.by", {})).toBe("by {voice}");
  });

  it("ignores vars the message does not reference", async () => {
    const { demo } = await fresh();
    expect(demo.t("demo.science.mentions", { count: 1, unused: "x" })).toBe(
      "1 mentions",
    );
  });

  it("falls back to the default locale for a key the active locale lacks", async () => {
    document.documentElement.lang = "de";
    const { demo } = await fresh();
    // Simulate a Record widening that the compiler would normally have caught.
    delete (demo.MESSAGES.de as Partial<Record<string, string>>)[
      "demo.tab.coaching"
    ];
    expect(demo.t("demo.tab.coaching")).toBe("Coaching");
  });

  it("returns the key and warns exactly once for a genuinely missing message", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { core, demo } = await fresh();
    for (const locale of core.LOCALES) {
      delete (demo.MESSAGES[locale] as Partial<Record<string, string>>)[
        "demo.tab.coaching"
      ];
    }

    expect(demo.t("demo.tab.coaching")).toBe("demo.tab.coaching");
    expect(demo.t("demo.tab.coaching")).toBe("demo.tab.coaching");
    expect(demo.t("demo.tab.coaching")).toBe("demo.tab.coaching");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[vp] missing message",
      "demo.tab.coaching",
    );
  });
});

describe("catalogues", () => {
  it("give every locale exactly the same keys", async () => {
    const { LOCALES, surfaces } = await catalogues();
    for (const { name, MESSAGES } of surfaces) {
      const reference = Object.keys(MESSAGES.en).sort();
      expect(reference.length, name).toBeGreaterThan(0);
      for (const locale of LOCALES) {
        expect(
          Object.keys(MESSAGES[locale]).sort(),
          `${name}/${locale}`,
        ).toEqual(reference);
      }
    }
  });

  it("leave no message empty", async () => {
    const { LOCALES, surfaces } = await catalogues();
    for (const { name, MESSAGES } of surfaces) {
      for (const locale of LOCALES) {
        for (const [key, value] of Object.entries(MESSAGES[locale])) {
          expect(value.trim(), `${name}/${locale}/${key}`).not.toBe("");
        }
      }
    }
  });

  // The escaping contract, enforced as data: only an `admin.*Html` key may carry
  // markup, because those are the only strings interpolated into innerHTML
  // without esc(). A `<` or `&` anywhere else would either be double-escaped
  // into visible entities or, worse, injected raw.
  it("confine markup to the admin.*Html keys", async () => {
    const { LOCALES, surfaces } = await catalogues();
    for (const { name, MESSAGES } of surfaces) {
      for (const locale of LOCALES) {
        for (const [key, value] of Object.entries(MESSAGES[locale])) {
          if (key.startsWith("admin.") && key.endsWith("Html")) continue;
          expect(value, `${name}/${locale}/${key}`).not.toMatch(/[<>&]/);
        }
      }
    }
  });

  it("keep the placeholder set identical across locales", async () => {
    const { LOCALES, surfaces } = await catalogues();
    // A placeholder present in `en` must exist in every other locale too, or the
    // interpolated value silently disappears from that translation.
    const placeholders = (message: string) =>
      (message.match(/\{\w+\}/g) ?? []).sort();
    for (const { name, MESSAGES } of surfaces) {
      for (const key of Object.keys(MESSAGES.en)) {
        const expected = placeholders(MESSAGES.en[key]);
        for (const locale of LOCALES) {
          expect(
            placeholders(MESSAGES[locale][key]),
            `${name}/${locale}/${key}`,
          ).toEqual(expected);
        }
      }
    }
  });

  it("keep the key namespaces disjoint, so no surface shadows another", async () => {
    const { surfaces } = await catalogues();
    const seen = new Map<string, string>();
    for (const { name, MESSAGES } of surfaces) {
      for (const key of Object.keys(MESSAGES.en)) {
        expect(
          seen.get(key),
          `${key} is in both ${seen.get(key)} and ${name}`,
        ).toBeUndefined();
        seen.set(key, name);
      }
    }
  });
});
