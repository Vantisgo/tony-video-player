// Whether the in-player overlays use their compact variants. Keyed on the
// PLAYER's box, not the viewport: at 1024px desktop the player is 461×260
// (narrower than a tablet's 708×399), measured 2026-09-29, spec M12/M14.
//
// Agreed rule (spec amendment (b), 2026-09-29): compact when width < 750 or
// height < 280.
//   750 — typical top pills need ~494px side by side; the worst case
//         (max-length section title + science name) needs 753, accepted as a
//         1–3px risk so 1920 desktops (752×424) keep the full overlays.
//   280 — the full voice-over card under the science pill needs
//         10 + 35 + 8 + 168 + 58 = 279.
// Measured players (fresh loads, spec M14 corrected):
//   compact: 390×219 phone · 441×249 @1280 · 461×260 @1024 · 501×283 @1366
//            553×312 @1440 · 632×356 tablet · 641×361 @1600 · 708×399 tablet
//            732×413 phone landscape
//   full:    752×424 @1920
// No hysteresis: compact mode never changes the player's own size (the slots
// are absolutely positioned), so the rule can only flip once per crossing.
const FULL_MIN_WIDTH = 750;
const FULL_MIN_HEIGHT = 280;

export function isCompact(width: number, height: number): boolean {
  return width < FULL_MIN_WIDTH || height < FULL_MIN_HEIGHT;
}

// Watches `target` and calls `apply` with the compact state: once at start,
// then only when it changes. An unsized box (not laid out yet, or happy-dom)
// counts as NOT compact — the same precondition as tryFlexSibling's "an
// unsized <main> means the layout isn't ready".
//
// `classify` defaults to isCompact; it is a parameter so the observer's own
// behaviour can be tested independently of the rule.
export function observeCompact(
  target: HTMLElement,
  apply: (compact: boolean) => void,
  onCleanup: (fn: () => void) => void,
  classify: (width: number, height: number) => boolean = isCompact,
): () => boolean {
  const measure = (): boolean => {
    const r = target.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return classify(r.width, r.height);
  };

  let state = measure();
  apply(state);

  const update = (): void => {
    const next = measure();
    if (next === state) return;
    state = next;
    apply(next);
  };

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(update);
    ro.observe(target);
    onCleanup(() => ro.disconnect());
  } else {
    window.addEventListener("resize", update);
    onCleanup(() => window.removeEventListener("resize", update));
  }

  return () => state;
}
