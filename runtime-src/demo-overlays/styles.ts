// Theme tokens translated from app/globals.css `.dark` OKLCH — that block is the
// single source of truth. This bundle executes on the LearningSuite origin, where
// globals.css is never loaded, so `getPropertyValue("--card")` there returns "";
// the sRGB translation has to be inlined. Change globals.css first, then
// re-translate here. Each token names the var it came from.
export const T = {
  card: "#323333", //      --card
  neutral: "#3d3f3f", //   --vp-neutral (inactive rows — must NOT read as active)
  fg: "#f4f7f6", //        --card-foreground
  muted: "#164f49", //     --muted
  mutedFg: "#a8bfba", //   --muted-foreground
  border: "#505352", //    --border
  primary: "#00e1a5", //   --primary
  primaryFg: "#062b22", // --primary-foreground
  primarySoft: "rgba(0,225,165,.14)", // --primary @ 14%
  primaryRing: "rgba(0,225,165,.42)", // --primary @ 42%
  radius: "12px",
} as const;

// The LearningSuite "Code einbetten" block renders its content inside a
// `white-space: pre-wrap` wrapper, and `white-space` inherits — so it reaches
// every node this runtime appends to the player host. Under `pre-wrap` a space
// run is non-collapsible (CSS Text 3 §4.1.1) and a segment break is a *forced*
// line break, so the "anonymous blocks of collapsible white space are removed"
// rule never applies: each newline of an indented template literal generates a
// real line box at the host's inherited line-height.
//
// Only **block** containers are affected. A whitespace-only text run directly
// inside a flex container is not rendered at all (CSS Flexbox 1 §4, "just as if
// its text nodes were display:none"), which is why the science and meta pills —
// both `inline-flex` — never broke, and why the quiz card is immune too (it is
// built with createElement, so it has no stray text nodes). That immunity is
// incidental: measured on the live tenant, the voice-over banner's two
// `display:block` wrappers rendered 160px and 178px tall against a 62px design,
// taking the card to 200px. Resetting at the slot roots covers every renderer,
// present and future, instead of one template at a time.
export const SLOT_CSS = `
      .vp-slot, .vp-slot * { white-space:normal; }
    `;

export const ANIM_CSS = `
      @keyframes vp-slide-in-right { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      @keyframes vp-slide-in-bottom{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes vp-fade-in        { from{opacity:0} to{opacity:1} }
      @keyframes vp-pulse          { 0%,100%{opacity:1} 50%{opacity:.4} }
      .vp-anim-right  { animation: vp-slide-in-right .35s ease-out both; }
      .vp-anim-bottom { animation: vp-slide-in-bottom .35s ease-out both; }
      .vp-anim-fade   { animation: vp-fade-in .35s ease-out both; }
      .vp-pulse       { animation: vp-pulse 1.4s infinite; }
    `;

export const SECTION_CSS = `
      .vp-section-pill, .vp-section-pill * { white-space:normal; }
      .vp-section-pill { pointer-events:auto; max-width:min(384px, calc(100% - 28px)); display:block; width:fit-content; }
      .vp-section-pill .vp-sec-title, .vp-section-pill .vp-sec-cur-title { white-space:nowrap; }
      .vp-section-pill .vp-sec-card {
        background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92));
        border:1px solid rgba(0,225,165,.38);
        backdrop-filter:blur(10px);
        box-shadow:0 18px 40px rgba(0,0,0,.35);
        color:#f4f7f6; font:500 13px system-ui;
        border-radius:12px; padding:8px 14px;
        transition: padding .3s ease, border-radius .3s ease;
      }
      .vp-section-pill .vp-sec-collapsed { display:flex; flex-direction:column; gap:2px; min-width:0; }
      .vp-section-pill .vp-sec-expanded  { display:none; }
      .vp-section-pill:hover .vp-sec-card,
      .vp-section-pill[data-pinned="1"] .vp-sec-card { border-radius:18px; padding:18px 18px 16px; }
      .vp-section-pill:hover .vp-sec-collapsed,
      .vp-section-pill[data-pinned="1"] .vp-sec-collapsed { display:none; }
      .vp-section-pill:hover .vp-sec-expanded,
      .vp-section-pill[data-pinned="1"] .vp-sec-expanded { display:block; }
      .vp-section-pill .vp-sec-title { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .vp-section-pill .vp-sec-cur-row { display:flex; align-items:center; gap:6px; color:rgba(168,191,186,.9); min-width:0; }
      .vp-section-pill .vp-sec-cur-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .vp-section-pill .vp-sec-cur-row[hidden] { display:none; }
      .vp-section-pill .vp-sec-eyebrow { font:600 11px system-ui; letter-spacing:.6px; text-transform:uppercase; color:rgba(168,191,186,.72); }
      .vp-section-pill .vp-sec-h3 { margin:4px 0 12px; font:700 18px system-ui; color:#f4f7f6; line-height:1.25; }
      .vp-section-pill .vp-sec-bar { height:6px; background:rgba(255,255,255,.10); border-radius:999px; overflow:hidden; }
      .vp-section-pill .vp-sec-bar-fill { height:100%; background:linear-gradient(90deg, #00e1a5, #2edbb1, #62dfc1); transition:width .6s ease; }
      .vp-section-pill .vp-sec-count { margin:4px 0 12px; font:500 11px system-ui; color:rgba(168,191,186,.68); }
      .vp-section-pill .vp-sec-rows { display:grid; gap:4px; }
      .vp-section-pill .vp-sec-row { display:flex; gap:10px; align-items:flex-start; padding:6px 8px; border-radius:8px; cursor:pointer; transition:background .2s; }
      .vp-section-pill .vp-sec-row[data-current="1"] { background:rgba(255,255,255,.12); }
      .vp-section-pill .vp-sec-row[data-current="0"]:hover { background:rgba(255,255,255,.06); }
      .vp-section-pill .vp-sec-dot { width:16px; height:16px; border-radius:50%; flex-shrink:0; margin-top:2px; display:flex; align-items:center; justify-content:center; }
      .vp-section-pill .vp-sec-dot[data-state="completed"] { background:#00e1a5; }
      .vp-section-pill .vp-sec-dot[data-state="completed"]::after { content:"✓"; color:#062b22; font-size:10px; font-weight:700; }
      .vp-section-pill .vp-sec-dot[data-state="current"] { border:2px solid #00e1a5; }
      .vp-section-pill .vp-sec-dot[data-state="current"]::after { content:""; width:6px; height:6px; border-radius:50%; background:#00e1a5; }
      .vp-section-pill .vp-sec-dot[data-state="upcoming"] { border:1px solid rgba(0,225,165,.4); }
      .vp-section-pill .vp-sec-row-title { flex:1; line-height:1.35; }
      .vp-section-pill .vp-sec-row[data-state="current"]   .vp-sec-row-title { color:#f4f7f6; font-weight:500; }
      .vp-section-pill .vp-sec-row[data-state="completed"] .vp-sec-row-title { color:rgba(168,191,186,.68); font-weight:400; }
      .vp-section-pill .vp-sec-row[data-state="upcoming"]  .vp-sec-row-title { color:rgba(168,191,186,.48); font-weight:400; }
    `;

// Voice-over card (lower-third slot, bottom-right). Composition ported from the
// reference player's `components/video-player/overlays/audio-overlay.tsx` —
// avatar + title stack, progress bar above the time row, four-button transport
// ending in a labelled Skip — rendered in the dark tokens rather than that
// component's orange-amber gradient (the palette was settled 2026-08-04).
//
// Two structural notes:
//   * Both transport icons live in the DOM at once and CSS picks between them
//     off `[data-playing]`. The per-`timeupdate` fast path in renderAudio then
//     flips one attribute instead of writing textContent, which is what makes
//     inline SVG possible on a path that runs ~4x/s.
//   * The `white-space` declarations use TWO classes (0,2,0) so they outrank
//     SLOT_CSS's `.vp-slot *` reset (0,1,0) on specificity rather than on
//     stylesheet order. Order would work — AUDIO_CSS is injected later — but a
//     0,1,0 tie is invisible to the unit suite (happy-dom does not model
//     equal-specificity source order) and silently breaks if injection moves.
export const AUDIO_CSS = `
      .vp-audio-card {
        display:grid; gap:12px; pointer-events:auto; box-sizing:border-box;
        background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92));
        border:1px solid rgba(0,225,165,.38);
        border-radius:16px; padding:14px;
        backdrop-filter:blur(10px);
        box-shadow:0 18px 40px rgba(0,0,0,.38);
        color:${T.fg}; font-family:system-ui;
      }
      .vp-audio-head { display:flex; align-items:flex-start; gap:11px; min-width:0; }
      .vp-audio-avatar { position:relative; flex:0 0 auto; width:44px; height:44px; }
      .vp-audio-portrait {
        width:44px; height:44px; border-radius:50%; object-fit:cover; display:block;
        border:2px solid ${T.primary}; box-shadow:0 4px 12px rgba(0,0,0,.3);
      }
      .vp-audio-initials {
        width:44px; height:44px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:${T.primary}; color:${T.primaryFg};
        font:700 15px system-ui; border:2px solid #62dfc1;
      }
      .vp-audio-badge {
        position:absolute; right:-3px; bottom:-3px;
        width:18px; height:18px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:${T.primary}; color:${T.primaryFg};
        border:2px solid ${T.card};
      }
      .vp-audio-badge svg { width:9px; height:9px; }
      .vp-audio-meta { flex:1 1 auto; min-width:0; }
      .vp-audio-card .vp-audio-title {
        font:700 14.5px/1.3 system-ui; color:${T.fg};
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      .vp-audio-card .vp-audio-byline {
        font:500 11.5px system-ui; color:rgba(168,191,186,.8); margin-top:2px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      .vp-audio-state { display:flex; align-items:center; gap:5px; margin-top:4px; }
      .vp-audio-dot { width:6px; height:6px; border-radius:50%; background:${T.primary}; flex:0 0 auto; }
      .vp-audio-card .vp-audio-status {
        font:600 10px system-ui; letter-spacing:.5px; text-transform:uppercase;
        color:rgba(168,191,186,.62); white-space:nowrap;
      }
      .vp-audio-progress { display:grid; gap:6px; }
      .vp-audio-bar { height:7px; background:rgba(255,255,255,.10); border-radius:999px; overflow:hidden; }
      .vp-audio-fill {
        height:100%; border-radius:999px;
        background:linear-gradient(90deg,#00e1a5,#2edbb1,#62dfc1);
        transition:width .15s linear;
      }
      .vp-audio-times { display:flex; justify-content:space-between; }
      .vp-audio-card .vp-audio-time {
        font:500 11px ui-monospace,monospace; color:rgba(168,191,186,.7); white-space:nowrap;
      }
      .vp-audio-controls { display:flex; align-items:center; gap:7px; min-width:0; }
      .vp-audio-btn {
        display:flex; align-items:center; justify-content:center; gap:5px;
        border:0; border-radius:11px; cursor:pointer; box-sizing:border-box;
        background:rgba(22,79,73,.72); color:${T.fg};
        font:600 11.5px system-ui; padding:9px 10px; min-width:0; flex:0 0 auto;
      }
      .vp-audio-btn:hover { background:rgba(22,79,73,.95); }
      .vp-audio-btn:focus-visible { outline:2px solid ${T.primary}; outline-offset:2px; }
      .vp-audio-btn-primary {
        background:${T.primary}; color:${T.primaryFg}; padding:9px 13px;
      }
      .vp-audio-btn-primary:hover { background:#2edbb1; }
      /* Skip absorbs the leftover width and truncates instead of overflowing —
         "Überspringen" is 12 characters in a 320px card. */
      .vp-audio-btn-skip { flex:1 1 auto; }
      .vp-audio-card .vp-audio-skip-label {
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;
      }
      .vp-audio-btn svg { width:14px; height:14px; flex:0 0 auto; }
      .vp-audio-btn-primary svg { width:16px; height:16px; }
      /* The transport icon swap: one attribute write per state change. */
      .vp-audio-card[data-playing="1"] .vp-audio-icon-play { display:none; }
      .vp-audio-card[data-playing="0"] .vp-audio-icon-pause { display:none; }
    `;

// Quiz-break dialog. #vp-slot-quiz is a container so the option grid can go
// two-up on a wide player without a media query (the slot's width, not the
// viewport's, is what matters here).
export const QUIZ_CSS = `
      #vp-slot-quiz { container-type: inline-size; container-name: vp-quiz; }
      @keyframes vp-quiz-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
      @keyframes vp-quiz-in    { from{opacity:0} to{opacity:1} }
      @keyframes vp-quiz-pop   { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
      .vp-quiz-anim-scrim { animation: vp-quiz-in .2s ease-out both; }
      .vp-quiz-anim-card  { animation: vp-quiz-pop .22s ease-out both; }
      .vp-quiz-scrim {
        position:absolute; inset:0; pointer-events:auto;
        display:flex; align-items:center; justify-content:center;
        padding:16px; box-sizing:border-box;
        background:rgba(8,18,16,.68); backdrop-filter:blur(3px);
      }
      .vp-quiz-card {
        position:relative; width:100%; max-width:560px; max-height:100%; min-height:0;
        overflow-y:auto; box-sizing:border-box;
        background:linear-gradient(160deg, rgba(50,51,51,.98), rgba(18,55,50,.98));
        border:1px solid rgba(0,225,165,.34);
        border-radius:18px;
        box-shadow:0 24px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
        color:#f4f7f6; font-family:system-ui; padding:14px 16px 12px; outline:none;
        scrollbar-width:thin; scrollbar-color:rgba(0,225,165,.35) transparent;
      }
      .vp-quiz-eyebrow { font:600 11px system-ui; letter-spacing:.6px; text-transform:uppercase; color:rgba(168,191,186,.7); margin-bottom:2px; }
      .vp-quiz-heading { margin:2px 0 8px; font:700 18px system-ui; color:#f4f7f6; }
      .vp-quiz-prompt { font:600 15.5px/1.4 system-ui; color:#f4f7f6; margin:0 0 10px; }
      .vp-quiz-options { display:grid; grid-template-columns:1fr; gap:8px; margin:0 0 4px; }
      @container vp-quiz (min-width: 380px) {
        .vp-quiz-options[data-cols="2"] { grid-template-columns:1fr 1fr; }
      }
      .vp-quiz-option {
        display:flex; align-items:center; gap:10px; width:100%;
        text-align:left; cursor:pointer; font:500 13.5px system-ui; color:#f4f7f6;
        background:rgba(22,79,73,.38); border:1px solid rgba(0,225,165,.2);
        border-radius:12px; padding:9px 11px;
        transition:background .18s ease, border-color .18s ease;
      }
      .vp-quiz-option:hover:not(:disabled) { background:rgba(22,79,73,.7); }
      .vp-quiz-option:focus-visible { outline:2px solid #00e1a5; outline-offset:2px; }
      .vp-quiz-option[data-state="correct"] { border-color:#4ade80; background:rgba(74,222,128,.16); }
      .vp-quiz-option[data-state="wrong"] { border-color:#f87171; background:rgba(248,113,113,.16); animation:vp-quiz-shake .4s ease; }
      .vp-quiz-option:disabled { cursor:default; }
      .vp-quiz-option:disabled:not([data-state="correct"]):not([data-state="wrong"]) { opacity:.55; }
      .vp-quiz-option-badge { width:22px; height:22px; border-radius:50%; flex:0 0 auto; display:flex; align-items:center; justify-content:center; font:700 11px system-ui; background:rgba(0,225,165,.14); color:#a8bfba; }
      .vp-quiz-option[data-state="correct"] .vp-quiz-option-badge { background:#22c55e; color:#052e12; }
      .vp-quiz-option[data-state="wrong"] .vp-quiz-option-badge { background:#ef4444; color:#2a0505; }
      .vp-quiz-option-text { flex:1; line-height:1.35; }
      .vp-quiz-option-wrap { display:grid; gap:6px; min-width:0; }
      .vp-quiz-inline-explanation { font:500 12.5px/1.5 system-ui; color:rgba(168,191,186,.88); margin:0 4px 2px; }
      .vp-quiz-countdown { display:flex; align-items:center; gap:8px; margin:0 0 8px; }
      .vp-quiz-ring { width:30px; height:30px; flex:0 0 auto; }
      .vp-quiz-ring-track { fill:none; stroke:rgba(255,255,255,.15); stroke-width:3; }
      .vp-quiz-ring-fill { fill:none; stroke:#00e1a5; stroke-width:3; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; transition:stroke-dashoffset .1s linear, stroke .2s ease; }
      .vp-quiz-countdown[data-warn="1"] .vp-quiz-ring-fill { stroke:#f87171; }
      .vp-quiz-countdown-num { font:700 13px ui-monospace,monospace; color:rgba(168,191,186,.9); min-width:2.4ch; text-align:right; }
      .vp-quiz-countdown[data-warn="1"] .vp-quiz-countdown-num { color:#fca5a5; }
      .vp-quiz-card[data-vp-quiz-mode="feedback"] .vp-quiz-options { gap:6px; margin-bottom:2px; }
      .vp-quiz-card[data-vp-quiz-mode="feedback"] .vp-quiz-option { padding:7px 10px; }
      .vp-quiz-card[data-vp-quiz-mode="feedback"] .vp-quiz-actions { margin-top:8px; }
      .vp-quiz-skip { display:block; background:none; border:0; color:rgba(168,191,186,.62); font:500 12px system-ui; text-decoration:underline; cursor:pointer; padding:2px 0 0; margin-top:0; }
      .vp-quiz-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; flex-wrap:wrap; }
      .vp-quiz-btn { border:0; border-radius:10px; padding:9px 16px; font:600 13px system-ui; cursor:pointer; }
      .vp-quiz-btn-primary { background:#00e1a5; color:#062b22; }
      .vp-quiz-btn-ghost { background:rgba(22,79,73,.55); color:#a8bfba; border:1px solid rgba(0,225,165,.2); }
      .vp-quiz-btn:focus-visible { outline:2px solid #00e1a5; outline-offset:2px; }
      .vp-quiz-summary-score { text-align:center; margin:4px 0 14px; }
      .vp-quiz-score-big { font:700 34px system-ui; color:#f4f7f6; }
      .vp-quiz-score-sub { font:600 13px system-ui; color:rgba(168,191,186,.78); margin-top:2px; }
      .vp-quiz-pass-badge { display:inline-block; margin-top:8px; padding:4px 12px; border-radius:999px; font:700 11.5px system-ui; letter-spacing:.3px; }
      .vp-quiz-pass-badge[data-pass="1"] { background:rgba(74,222,128,.18); color:#bbf7d0; border:1px solid rgba(74,222,128,.4); }
      .vp-quiz-pass-badge[data-pass="0"] { background:rgba(248,113,113,.16); color:#fecaca; border:1px solid rgba(248,113,113,.35); }
      .vp-quiz-summary-rows { display:grid; gap:6px; margin:4px 0 4px; max-height:220px; overflow-y:auto; }
      .vp-quiz-summary-row { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:9px; background:rgba(255,255,255,.05); font:500 12.5px system-ui; }
      .vp-quiz-summary-row-icon { width:18px; text-align:center; flex:0 0 auto; font-weight:700; }
      .vp-quiz-summary-row[data-outcome="correct"] .vp-quiz-summary-row-icon { color:#4ade80; }
      .vp-quiz-summary-row[data-outcome="wrong"] .vp-quiz-summary-row-icon, .vp-quiz-summary-row[data-outcome="timeout"] .vp-quiz-summary-row-icon { color:#f87171; }
      .vp-quiz-summary-row[data-outcome="skipped"] .vp-quiz-summary-row-icon, .vp-quiz-summary-row[data-outcome="none"] .vp-quiz-summary-row-icon { color:rgba(168,191,186,.5); }
      /* Two classes on purpose (0,2,0). SLOT_CSS's \`.vp-slot *\` reset is
         (0,1,0) and a bare \`.vp-quiz-summary-row-text\` would only tie it,
         leaving the ellipsis truncation to be decided by which stylesheet
         happens to be appended last. Verified in Chrome 152: at equal
         specificity the later rule wins, so the tie was survivable only while
         SLOT_CSS stays injected first — and happy-dom does not model that
         tiebreak at all, so no unit test could have guarded it. Raising the
         specificity makes the outcome order-independent and testable. */
      .vp-quiz-card .vp-quiz-summary-row-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    `;
