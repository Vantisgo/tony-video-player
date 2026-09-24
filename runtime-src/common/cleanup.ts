// Idempotency registry shared by all three scripts. Each script re-injection
// must tear down the previous run first — otherwise MutationObservers and
// listeners stack and peg the renderer at 100% CPU.
//
// The registry lives on a named window global (e.g. "__vpReskinCleanup") so the
// public surface is identical to the original hand-written scripts.
type CleanupFn = () => void;

const registry = (): Record<string, CleanupFn[] | undefined> =>
  // The cleanup arrays are a deliberate dynamic global registry keyed by name;
  // there is no static shape to type here.
  window as unknown as Record<string, CleanupFn[] | undefined>;

// Run and clear any cleanups left by a previous run, then arm a fresh array.
export function resetCleanup(key: string): void {
  const store = registry();
  const existing = store[key];
  if (Array.isArray(existing)) {
    for (const fn of existing) {
      try {
        fn();
      } catch {
        /* ignore teardown errors */
      }
    }
  }
  store[key] = [];
}

export function pushCleanup(key: string, fn: CleanupFn): void {
  const store = registry();
  (store[key] ??= []).push(fn);
}
