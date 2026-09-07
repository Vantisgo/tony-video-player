// CSS for the overlay shell, subtitles, the external-audio drift badge and the
// language-pack control's menu.
//
// It deliberately hides NOTHING of LearningSuite's own player. Until 2026-09-07
// this file's first four rules `display:none`d the host's chrome so our own
// control bar could take its place; that bar is gone, and the host's controls —
// which work, including their subtitles — are back. Two of those four rules were
// also dead: measured on the tenant, no `media-*` elements exist under the
// player at all.
//
// If you are tempted to add a chrome-hiding rule here, read the 2026-09-07
// entry in docs/feature-context.md first.
export const RESKIN_CSS = `
      .vp-shell { position: absolute; inset: 0; pointer-events: none; font: 14px system-ui, sans-serif; color: #fff; z-index: 5; }
      .vp-shell > * { pointer-events: auto; }
      .vp-overlay-layer { position: absolute; inset: 0 0 60px 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
      .vp-overlay-layer > * { pointer-events: auto; }
      .vp-subtitle-layer { position: absolute; left: 8%; right: 8%; bottom: 58px; display: flex; justify-content: center; pointer-events: none; z-index: 6; }
      .vp-subtitle-layer[hidden] { display: none !important; }
      .vp-subtitle-cue { max-width: 100%; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,.72); color: #fff; font: 600 16px/1.35 system-ui, sans-serif; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,.75); box-decoration-break: clone; -webkit-box-decoration-break: clone; }
      .vp-sync-badge { position: absolute; right: 12px; bottom: 56px; z-index: 7; padding: 4px 7px; border-radius: 6px; background: rgba(180, 83, 9, .92); color: #fff; font: 600 12px/1.2 system-ui, sans-serif; letter-spacing: 0; pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,.28); }
      .vp-sync-badge[hidden] { display: none !important; }
      .vp-langpack { position: absolute; left: 14px; bottom: 58px; z-index: 15; display: inline-flex; pointer-events: auto; }
      .vp-langpack-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(17,17,20,.82); border: 1px solid rgba(255,255,255,.18); color: #fff; cursor: pointer; padding: 6px 10px; border-radius: 8px; font: 13px system-ui, sans-serif; backdrop-filter: blur(6px); }
      .vp-langpack-btn:hover { background: rgba(17,17,20,.94); }
      .vp-menu { position: absolute; left: 0; bottom: calc(100% + 8px); min-width: 190px; max-width: min(260px, 70vw); max-height: 240px; overflow: auto; padding: 6px; background: rgba(17, 17, 20, .96); border: 1px solid rgba(255,255,255,.16); border-radius: 8px; box-shadow: 0 16px 40px rgba(0,0,0,.38); color: #fff; pointer-events: auto; }
      .vp-menu[hidden] { display: none !important; }
      .vp-menu-title { padding: 6px 8px 5px; font-size: 11px; font-weight: 700; line-height: 1.2; text-transform: uppercase; color: rgba(255,255,255,.58); }
      .vp-menu-option { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 8px; border: 0; border-radius: 6px; background: transparent; color: #fff; font: 13px system-ui, sans-serif; text-align: left; }
      .vp-menu-option:hover { background: rgba(255,255,255,.12); }
      .vp-menu-option[aria-checked="true"] { background: rgba(255,255,255,.18); }
      .vp-menu-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vp-menu-current { flex-shrink: 0; font-size: 11px; color: rgba(255,255,255,.62); }
    `;
