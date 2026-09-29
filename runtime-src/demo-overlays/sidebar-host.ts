import { createMobileSheet } from "./mobile-sheet";

// Where the sidebar <aside> lives. Its content and renderers are one
// implementation (index.ts); only the host differs (spec P3, approach A):
//   desktop — beside <main> as a flex sibling, or the fixed right rail
//   sheet   — below 1024px, a tab bar under the player plus a docked sheet
//   none    — no coaching/science/meta content, so nothing is installed

export type HostMode = "desktop" | "sheet" | "none";

// The 1024px query decides the page layout (is there room beside <main>?);
// content decides whether anything is installed at all — installing the
// desktop sidebar hides LearningSuite's own right column, so an empty one must
// not touch the host layout (feature-context).
export function chooseHostMode(
  viewportFits: boolean,
  hasContent: boolean,
): HostMode {
  if (!hasContent) return "none";
  return viewportFits ? "desktop" : "sheet";
}

export interface SidebarHostDeps {
  mode: "desktop" | "sheet";
  sidebar: HTMLElement;
  playerHost: HTMLElement;
  tabs: ReadonlyArray<{ key: string; label: string }>;
  setTab: (key: string) => void;
  onCleanup: (fn: () => void) => void;
}

export interface SidebarHost {
  readonly mode: "desktop" | "sheet";
  // Shows the tab — and, for the sheet, opens it. What every pill calls.
  open(tab: string): void;
  // For checkAlive: false once the host's nodes are gone (a React pass can
  // strip them), which triggers a remount.
  isConnected(): boolean;
}

export function installSidebarHost(deps: SidebarHostDeps): SidebarHost {
  if (deps.mode === "sheet") {
    const sheet = createMobileSheet(deps);
    return {
      mode: "sheet",
      open: sheet.open,
      isConnected: sheet.isConnected,
    };
  }
  installDesktop(deps.sidebar, deps.onCleanup);
  return {
    mode: "desktop",
    open: deps.setTab,
    isConnected: () => deps.sidebar.isConnected,
  };
}

// Moved verbatim from index.ts's mountInner (P3); `sidebar` and `onCleanup`
// were closure variables there and are parameters here.
function installDesktop(
  sidebar: HTMLElement,
  onCleanup: (fn: () => void) => void,
): void {
  function detectTopNavHeight(): number {
    let bottom = 0;
    const candidates = document.querySelectorAll(
      'header, nav, [role="banner"], [class*="AppBar"], [class*="Toolbar"], [class*="topbar"], [class*="TopBar"], [class*="navbar"]',
    );
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      const r = el.getBoundingClientRect();
      if (r.top > 6 || r.height > 200 || r.height < 24) continue;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    return bottom;
  }

  const SIDEBAR_W = "clamp(340px, 30vw, 476px)";
  const SIDEBAR_GAP = 16;
  const SIDEBAR_MIN_TOP = 24;

  function applyFixedRightRail(): void {
    const topClear = Math.max(
      SIDEBAR_MIN_TOP,
      Math.ceil(detectTopNavHeight() + 8),
    );
    sidebar.style.position = "fixed";
    sidebar.style.top = topClear + "px";
    sidebar.style.right = SIDEBAR_GAP + "px";
    sidebar.style.bottom = SIDEBAR_GAP + "px";
    sidebar.style.maxHeight = `calc(100vh - ${topClear + SIDEBAR_GAP}px)`;
    sidebar.style.zIndex = "50";
    sidebar.style.width = SIDEBAR_W;
    sidebar.style.alignSelf = "";
    if (sidebar.parentElement !== document.body)
      document.body.appendChild(sidebar);

    const reserve = `calc(${SIDEBAR_W} + ${SIDEBAR_GAP * 2}px)`;
    const targets = [
      document.querySelector("main"),
      document.querySelector('[class*="MainScroll"]'),
      document.querySelector('[class*="content-scroll"]'),
      document.body,
    ].filter(Boolean) as HTMLElement[];
    for (const t of targets) {
      const prev = t.style.paddingRight;
      t.style.paddingRight = reserve;
      onCleanup(() => {
        t.style.paddingRight = prev;
      });
    }

    const onResize = () => {
      const next = Math.max(
        SIDEBAR_MIN_TOP,
        Math.ceil(detectTopNavHeight() + 8),
      );
      sidebar.style.top = next + "px";
      sidebar.style.maxHeight = `calc(100vh - ${next + SIDEBAR_GAP}px)`;
    };
    window.addEventListener("resize", onResize);
    onCleanup(() => window.removeEventListener("resize", onResize));
  }

  function tryFlexSibling(): boolean {
    const mainEl = document.querySelector("main") as HTMLElement | null;
    if (!mainEl) return false;
    const flexParent = mainEl.parentElement;
    if (!flexParent) return false;
    // Precondition: only run the invasive sibling reshuffle on a real, laid-out
    // layout. An unsized <main> means the layout isn't ready/valid — fall back
    // to the non-invasive fixed rail instead of mutating a collapsed layout.
    const mainBox = mainEl.getBoundingClientRect();
    if (mainBox.width <= 0 || mainBox.height <= 0) return false;
    const prevDisplays = new Map<HTMLElement, string>();
    [...flexParent.children].forEach((child) => {
      const c = child as HTMLElement;
      if (c !== mainEl && c.id !== "vp-demo-sidebar") {
        prevDisplays.set(c, c.style.display);
        c.style.display = "none";
      }
    });
    const prevParentDisplay = flexParent.style.display;
    const prevParentGap = flexParent.style.gap;
    const prevMainFlex = mainEl.style.flex;
    const prevMainMinWidth = mainEl.style.minWidth;
    if (getComputedStyle(flexParent).display !== "flex")
      flexParent.style.display = "flex";
    flexParent.style.gap = "24px";
    mainEl.style.flex = "1 1 0";
    mainEl.style.minWidth = "0";
    flexParent.appendChild(sidebar);

    const mainRect = mainEl.getBoundingClientRect();
    const sbRect = sidebar.getBoundingClientRect();
    const fitsToRightOfMain = sbRect.left + 5 >= mainRect.right;
    const visibleInViewport =
      sbRect.right <= window.innerWidth + 1 && sbRect.width >= 200;

    const restoreHost = (): void => {
      prevDisplays.forEach((v, child) => {
        child.style.display = v;
      });
      flexParent.style.display = prevParentDisplay;
      flexParent.style.gap = prevParentGap;
      mainEl.style.flex = prevMainFlex;
      mainEl.style.minWidth = prevMainMinWidth;
    };

    // On success the host stays reshuffled only for this mount's lifetime: a
    // remount onto a narrow viewport installs no sidebar, and LearningSuite's
    // own column must come back rather than stay hidden with nothing beside it.
    if (fitsToRightOfMain && visibleInViewport) {
      onCleanup(restoreHost);

      // LearningSuite renders some columns only at certain widths: its lesson
      // column is inserted as a NEW sibling of <main> whenever the window
      // crosses 1536px (MUI xl), long after the loop above ran. Unhidden, it
      // squeezed the player from 553×312 to 317×179 (measured 2026-09-29,
      // spec M15). Keep the invariant — only <main> and our sidebar are
      // visible here — instead of the mount-time snapshot.
      //
      // Synchronous in the callback, never debounced: records arrive as a
      // microtask, before the next paint, so the column is never drawn. Moves
      // arrive as remove+add; `has()` keeps the first-seen display so a moved
      // node never records our own "none". A <main> (or a wrapper around one)
      // is never hidden: a replaced lesson is checkAlive's remount, not ours.
      // Registered after restoreHost so it disconnects first (LIFO); disconnect
      // also drops queued records, e.g. the one sidebar.remove() produces
      // during the same teardown.
      const siblingWatch = new MutationObserver((records) => {
        for (const rec of records)
          rec.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            if (n === mainEl || n.id === "vp-demo-sidebar") return;
            if (n.tagName === "MAIN" || n.querySelector("main")) return;
            if (!prevDisplays.has(n)) prevDisplays.set(n, n.style.display);
            n.style.display = "none";
          });
      });
      siblingWatch.observe(flexParent, { childList: true });
      onCleanup(() => siblingWatch.disconnect());
      return true;
    }
    restoreHost();
    return false;
  }

  if (!tryFlexSibling()) applyFixedRightRail();
  onCleanup(() => sidebar.remove());
}
