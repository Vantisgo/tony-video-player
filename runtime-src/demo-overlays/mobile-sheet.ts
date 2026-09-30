import { t as tr } from "../common/i18n/demo";
import { sheetMaxTop, sheetTop } from "./sheet-geometry";
import { T } from "./styles";

// The sidebar's mobile host: a tab bar directly under the player and the same
// <aside> restyled as a sheet docked under the video (spec P3, approved
// 2026-09-29). Below 1024px there is no room beside the lesson, and the old
// answer — not installing the sidebar at all (159bf36) — left its content
// unreachable on phones.
//
// Deliberately touches no LearningSuite style: the tab bar is our own node after
// the player, the sheet lives in <body> (or in the fullscreen element), and page
// scrolling is never locked.

// Not `vp-slot-*` and not `*sidebar`: mountInner's defensive sweep deletes ids
// matching either before every mount (index.ts).
export const TAB_BAR_ID = "vp-mobile-tabs";

// Same naming constraint as TAB_BAR_ID.
const ROOM_ID = "vp-sheet-room";

// Above LearningSuite's fixed bottom bar (z-index 999), below its full-viewport
// overlay layers (1200) so their menus still cover us (measured 2026-09-29).
const SHEET_Z = 1100;

export interface MobileSheetDeps {
  sidebar: HTMLElement;
  playerHost: HTMLElement;
  tabs: ReadonlyArray<{ key: string; label: string }>;
  setTab: (key: string) => void;
  onCleanup: (fn: () => void) => void;
}

export interface MobileSheet {
  open(tab: string): void;
  close(): void;
  isOpen(): boolean;
  isConnected(): boolean;
}

export function createMobileSheet(deps: MobileSheetDeps): MobileSheet {
  const { sidebar, playerHost, tabs, setTab, onCleanup } = deps;
  let opened = false;
  let opener: Element | null = null;
  let frame = 0;

  // ── The sheet: the same <aside>, restyled ──
  sidebar.classList.add("vp-sheet-ui");
  sidebar.setAttribute("role", "dialog");
  sidebar.setAttribute("aria-modal", "false");
  sidebar.setAttribute("aria-label", tr("demo.sheet.label"));
  sidebar.style.cssText = `position:fixed; left:0; right:0; bottom:0; top:0; width:auto; max-height:none; z-index:${SHEET_Z}; box-sizing:border-box; background:${T.card}; color:${T.fg}; color-scheme:dark; font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif; border:1px solid ${T.border}; border-bottom:0; border-radius:14px 14px 0 0; box-shadow:0 -8px 24px rgba(0,0,0,.35); display:flex; flex-direction:column; overflow:hidden;`;
  sidebar
    .querySelectorAll<HTMLElement>(".vp-tab")
    .forEach((b) => (b.style.minHeight = "44px"));
  // Scrolling inside the sheet must not drag the page behind it. iOS 16+ only
  // honours this on a container with scrollable overflow, which #vp-panels is.
  const panels = sidebar.querySelector<HTMLElement>("#vp-panels");
  if (panels) panels.style.overscrollBehavior = "contain";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "vp-sheet-close";
  closeBtn.setAttribute("aria-label", tr("demo.sheet.close"));
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = `flex:0 0 44px; height:44px; border:0; border-radius:8px; background:transparent; color:${T.mutedFg}; font:600 16px system-ui; cursor:pointer;`;
  closeBtn.onclick = () => close();
  sidebar.querySelector(".vp-tab")?.parentElement?.appendChild(closeBtn);

  // Closed: off-screen and inert (no focus, no clicks, out of the a11y tree).
  function applyClosed(animate: boolean): void {
    sidebar.style.transition = animate
      ? "transform .25s ease, visibility 0s linear .25s"
      : "";
    sidebar.style.transform = "translateY(100%)";
    sidebar.style.visibility = "hidden";
    sidebar.inert = true;
    delete sidebar.dataset.open;
  }
  applyClosed(false);

  // In fullscreen only the fullscreen element's subtree is rendered, so a
  // body-level sheet would be invisible there (verified, Chrome 154). The player
  // host itself may be the fullscreen element; `contains` covers both.
  const fullscreenHost = (): Element | null => {
    const fs = document.fullscreenElement ?? null;
    return fs && fs.contains(playerHost) ? fs : null;
  };
  const place = (): void => {
    const parent = fullscreenHost() ?? document.body;
    if (sidebar.parentElement !== parent) parent.appendChild(sidebar);
  };
  place();

  // ── The tab bar under the player ──
  // Built with createElement: LearningSuite's pre-wrap reaches this sibling of
  // the player too, and createElement DOM has no stray whitespace text nodes.
  const nav = document.createElement("nav");
  nav.id = TAB_BAR_ID;
  nav.className = "vp-sheet-ui";
  nav.setAttribute("aria-label", tr("demo.sheet.tabs"));
  nav.style.cssText =
    "display:flex; gap:6px; padding:8px 0; box-sizing:border-box; font:600 13px system-ui;";
  const tabButtons = tabs.map((tab) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.sheetTab = tab.key;
    b.setAttribute("aria-controls", sidebar.id);
    b.setAttribute("aria-expanded", "false");
    b.textContent = tab.label;
    b.style.cssText = `flex:1; min-height:44px; border:0; border-radius:10px; background:${T.muted}; color:${T.fg}; font:inherit; cursor:pointer;`;
    b.onclick = () => open(tab.key);
    nav.appendChild(b);
    return b;
  });
  playerHost.after(nav);

  // ── Scroll room for a page too short to lift the video above the sheet ──
  // An empty block at the end of <body>, present only while the sheet is open
  // (see `room` in sheet-geometry). Closing drops it and the browser clamps the
  // scroll back, so nothing of ours outlives the sheet.
  const room = document.createElement("div");
  room.id = ROOM_ID;
  room.setAttribute("aria-hidden", "true");
  room.style.cssText =
    "display:block; margin:0; padding:0; border:0; pointer-events:none;";
  let roomPx = 0;
  function setRoom(px: number): void {
    roomPx = px;
    if (px <= 0) {
      room.remove();
      return;
    }
    room.style.height = `${px}px`;
    if (room.parentElement !== document.body) document.body.appendChild(room);
  }

  function open(tab: string): void {
    setTab(tab);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: number;
    if (fullscreenHost()) {
      // The player fills the screen; the sheet takes its minimum share.
      top = sheetMaxTop(vw, vh);
    } else {
      // Computed from the scroll target, not measured after scrolling: iOS
      // before 26.2 fires no `scrollend` (the follow listener below tracks the
      // smooth scroll anyway).
      const r = playerHost.getBoundingClientRect();
      const se = document.scrollingElement ?? document.documentElement;
      const next = sheetTop({
        playerTop: r.top,
        playerBottom: r.bottom,
        scrollY: window.scrollY,
        // The page's own scroll: a tab switch re-measures with our room in it.
        maxScroll: se.scrollHeight - vh - roomPx,
        vw,
        vh,
      });
      top = next.top;
      // Before scrolling, or the smooth scroll stops at the old page end.
      setRoom(next.room);
      if (Math.abs(next.targetScroll - window.scrollY) >= 1)
        window.scrollTo({ top: next.targetScroll, behavior: "smooth" });
    }
    if (!opened) opener = document.activeElement;
    opened = true;
    sidebar.style.top = `${top}px`;
    sidebar.style.transition = "transform .25s ease";
    sidebar.style.transform = "none";
    sidebar.style.visibility = "visible";
    sidebar.inert = false;
    sidebar.dataset.open = "1";
    tabButtons.forEach((b) =>
      b.setAttribute("aria-expanded", String(b.dataset.sheetTab === tab)),
    );
    try {
      closeBtn.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  function close(): void {
    if (!opened) return;
    opened = false;
    applyClosed(true);
    setRoom(0);
    tabButtons.forEach((b) => b.setAttribute("aria-expanded", "false"));
    const back = opener;
    opener = null;
    if (back instanceof HTMLElement && back.isConnected)
      try {
        back.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
  }

  // While open, the top edge follows the player's bottom (page scroll, rotation,
  // toolbar changes), within the same minimum-height clamp. One update per frame.
  const follow = (): void => {
    if (!opened || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!opened) return;
      const max = sheetMaxTop(window.innerWidth, window.innerHeight);
      const bottom = fullscreenHost()
        ? max
        : playerHost.getBoundingClientRect().bottom;
      sidebar.style.top = `${Math.round(Math.min(Math.max(bottom, 0), max))}px`;
    });
  };
  // Bubble phase on purpose: the quiz handles its keys in the capture phase and
  // stops them while it is open, so Escape reaches a quiz before the sheet.
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && opened) close();
  };
  const onFullscreen = (): void => {
    place();
    follow();
  };
  window.addEventListener("scroll", follow, { passive: true });
  window.addEventListener("resize", follow);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("fullscreenchange", onFullscreen);
  document.addEventListener("webkitfullscreenchange", onFullscreen);

  onCleanup(() => {
    window.removeEventListener("scroll", follow);
    window.removeEventListener("resize", follow);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("fullscreenchange", onFullscreen);
    document.removeEventListener("webkitfullscreenchange", onFullscreen);
    if (frame) cancelAnimationFrame(frame);
    nav.remove();
    sidebar.remove();
    room.remove();
  });

  return {
    open,
    close,
    isOpen: () => opened,
    isConnected: () => nav.isConnected && sidebar.isConnected,
  };
}
