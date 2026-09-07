// Player discovery + host resolution shared by the reskin and demo runtimes.
//
// The runtime is injected into a third-party LearningSuite page whose DOM we do
// not own. Hardcoding the `hls-video` tag means a host update that renames the
// player element makes every overlay vanish. `scanPlayers` degrades from an
// explicit contract attribute, through known tags, to a capability sweep, so a
// renamed-but-still-media element keeps working. `resolveHost` anchors overlays
// to a correctly-sized ancestor instead of assuming `parentElement`.
import type { MediaEl } from "./types";

export type DiscoveryStrategy =
  | "contract"
  | "tag:hls-video"
  | "tag:mux-player"
  | "tag:media-controller"
  | "capability"
  | "none";

export interface PlayerScan {
  readonly players: readonly MediaEl[];
  readonly strategy: DiscoveryStrategy;
}

// Tags we treat as player elements even before they upgrade to a media API.
const KNOWN_TAG_NAMES = new Set(["hls-video", "mux-player", "video"]);

// A media element forwards the standard HTMLMediaElement surface. This mirrors
// the attach() gate the reskin already applies, promoted to the discovery layer.
export function isMediaEl(el: unknown): el is MediaEl {
  return (
    !!el &&
    typeof (el as { play?: unknown }).play === "function" &&
    "currentTime" in (el as object) &&
    "duration" in (el as object)
  );
}

function isPlayerCandidate(el: Element): boolean {
  return isMediaEl(el) || KNOWN_TAG_NAMES.has(el.tagName.toLowerCase());
}

function dedup(elements: readonly Element[]): MediaEl[] {
  return [...new Set(elements)] as MediaEl[];
}

// Collect every element under `root`, descending into open shadow roots. Closed
// shadow roots are unreachable by design. Only the deep fallback calls this, so
// the `*` traversal cost is paid only when the light DOM held no player.
function collectDeep(root: ParentNode, out: Element[] = []): Element[] {
  root.querySelectorAll("*").forEach((el) => {
    out.push(el);
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) collectDeep(sr, out);
  });
  return out;
}

// Match `selector` inside open shadow roots under `root` (light-DOM matches are
// handled separately by the caller's light pass).
function queryShadow(root: ParentNode, selector: string): Element[] {
  const out: Element[] = [];
  collectDeep(root).forEach((el) => {
    const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (sr) out.push(...sr.querySelectorAll(selector));
  });
  return out;
}

// Resolve the player element(s) a `[data-vp-player]` marker points at: the
// marked element itself when it is a player, otherwise candidates within its
// (small) subtree.
function mediaElementsWithin(el: Element): Element[] {
  if (isPlayerCandidate(el)) return [el];
  return collectDeep(el).filter(isPlayerCandidate);
}

const BY_TAG: readonly (readonly [string, DiscoveryStrategy])[] = [
  ["hls-video", "tag:hls-video"],
  ["mux-player", "tag:mux-player"],
  ["media-controller video", "tag:media-controller"],
];

// Run contract + known-tag strategies using the supplied query function, so the
// same logic serves both the cheap light pass and the shadow-DOM fallback.
function scanWith(
  root: ParentNode,
  query: (selector: string) => Element[],
): PlayerScan {
  const marked = query("[data-vp-player]");
  if (marked.length) {
    const players = dedup(marked.flatMap(mediaElementsWithin));
    if (players.length) return { players, strategy: "contract" };
  }
  for (const [selector, strategy] of BY_TAG) {
    const hits = dedup(query(selector));
    if (hits.length) return { players: hits, strategy };
  }
  return { players: [], strategy: "none" };
}

export function scanPlayers(root: ParentNode = document): PlayerScan {
  // Light DOM first — cheap, covers the overwhelmingly common case.
  const light = scanWith(root, (sel) => [...root.querySelectorAll(sel)]);
  if (light.strategy !== "none") return light;

  // Nothing in the light DOM: pay for the shadow-DOM traversal, then a full
  // capability sweep as the last resort.
  const shadow = scanWith(root, (sel) => queryShadow(root, sel));
  if (shadow.strategy !== "none") return shadow;

  const sweep = dedup(collectDeep(root).filter(isMediaEl));
  if (sweep.length) return { players: sweep, strategy: "capability" };

  return { players: [], strategy: "none" };
}

// Convenience wrapper for call sites that don't need the strategy.
export function findPlayers(root?: ParentNode): readonly MediaEl[] {
  return scanPlayers(root).players;
}

// The container overlays anchor to. Walk up to the nearest ancestor with a
// non-zero box (extra wrapper divs may have a zero box), falling back to the
// immediate parent when the whole chain is unsized (e.g. off-screen render).
// Side-effect-free: callers own the `position:relative` assertion, as today.
export function resolveHost(mediaEl: Element): HTMLElement | null {
  const first = mediaEl.parentElement;
  let el: HTMLElement | null = first;
  while (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
    el = el.parentElement;
  }
  return first;
}
