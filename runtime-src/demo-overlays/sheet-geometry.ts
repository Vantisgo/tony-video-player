// Where the mobile sheet's top edge goes.
//
// Pure on purpose: happy-dom has no layout, and e2e/overlay-mobile.spec.ts
// imports this to compute the expected position on the real page, so it must
// stay free of DOM, i18n and style imports.
//
// The rule (spec P3): scroll the page as far as it can toward the player's top,
// dock the sheet at the player's bottom edge as it will be AFTER that scroll —
// computed, not measured, because iOS before 26.2 fires no `scrollend` — and
// never let the sheet shrink below 45% of the viewport in portrait or 60% in
// landscape. Measured on the live lesson at 390×844 (spec M9): player 315–534,
// max scroll 106 → top 428, a 416px sheet under a fully visible video.
//
// A page too short to scroll the video above that minimum (2026-09-30: 24px of
// scroll left the sheet over the video's timeline and play control) gets the
// difference as `room`: temporary scroll room the sheet adds while open, so the
// video stays whole and the sheet keeps its minimum. Only when that CAN work —
// a player taller than the space above the sheet (landscape, M10) is clamped as
// before, since no room makes it fully visible.

// The lowest the sheet's top may sit, i.e. the minimum sheet height expressed
// as a top coordinate.
export function sheetMaxTop(vw: number, vh: number): number {
  return Math.round(vh * (vh >= vw ? 0.55 : 0.4));
}

export interface SheetTopInput {
  // The player's box relative to the viewport, before any scrolling.
  readonly playerTop: number;
  readonly playerBottom: number;
  readonly scrollY: number;
  // scrollHeight - innerHeight, not counting room the sheet has already added;
  // ≤ 0 when the page cannot scroll.
  readonly maxScroll: number;
  readonly vw: number;
  readonly vh: number;
}

export function sheetTop(i: SheetTopInput): {
  top: number;
  targetScroll: number;
  // Scroll room to add at the end of the page, in px; 0 when none is needed.
  room: number;
} {
  const maxTop = sheetMaxTop(i.vw, i.vh);
  const available = Math.max(i.maxScroll, 0);
  const playerAtTop = Math.max(i.scrollY + i.playerTop, 0);
  // The scroll at which the player's bottom meets the sheet at its minimum.
  const clear = i.scrollY + i.playerBottom - maxTop;
  let targetScroll = Math.min(playerAtTop, available);
  let room = 0;
  if (targetScroll < clear && clear <= playerAtTop) {
    room = clear - available;
    targetScroll = clear;
  }
  const bottomAfter = i.playerBottom - (targetScroll - i.scrollY);
  const top = Math.min(Math.max(bottomAfter, 0), maxTop);
  return {
    top: Math.round(top),
    targetScroll: Math.round(targetScroll),
    room: Math.ceil(room),
  };
}
