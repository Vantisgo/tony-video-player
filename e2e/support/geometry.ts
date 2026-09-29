// Box math for the mobile canary's layout assertions.
//
// Pure by design — no `@playwright/test` import — for the same reason `diag.ts`
// and `target.ts` are: so the rules can be unit-tested in vitest without a
// browser (see `geometry.test.ts`). The page side reads boxes with
// `getBoundingClientRect()` inside `evaluate`, never `locator.boundingBox()`,
// which returns null for elements Playwright judges invisible even while the
// browser lays them out (see `pressHostControl` in `assertions.ts`).

// A viewport-relative box, as getBoundingClientRect reports it.
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

// Area shared by two boxes. Disjoint or merely touching boxes share 0 — two
// pills that sit edge to edge do not cover each other.
export function intersectionArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// Whether `inner` lies within `outer`, each edge allowed `tolerance` px of
// sub-pixel rounding. A zero-size box (an empty slot) counts as inside when its
// origin is inside.
export function contains(outer: Box, inner: Box, tolerance = 1): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  );
}

// Every pair of named boxes that covers the other, rendered for a failure
// message ("a × b (N px²)"). Null boxes are overlays that are not on screen at
// the moment and are skipped, as are zero-size ones, which cannot cover
// anything.
export function overlappingPairs(
  boxes: Readonly<Record<string, Box | null>>,
): string[] {
  const entries = Object.entries(boxes).filter(
    (e): e is [string, Box] => e[1] !== null && e[1].w > 0 && e[1].h > 0,
  );
  const pairs: string[] = [];
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const [nameA, a] = entries[i]!;
      const [nameB, b] = entries[j]!;
      const area = intersectionArea(a, b);
      if (area > 0) pairs.push(`${nameA} × ${nameB} (${Math.round(area)} px²)`);
    }
  return pairs;
}

export const formatBox = (b: Box): string =>
  `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)}`;
