// Demo POC matching the tony-video-player repo:
//   - Section Indicator (top-left of video) — chapter + subchapter, expands on hover
//   - Science Trigger (top-right) — fires on science timestamps
//   - Audio Overlay (bottom-right) — fires on audio segments
//   - Meta Step Fly-in (bottom-right, violet) — when crossing a new master step
//   - Sidebar with Coaching / Science / Meta Structure tabs
//
// LearningSuite is an SPA: navigating between lessons swaps DOM in place
// without a full page reload. This controller therefore never "runs once" —
// it stays alive for the life of the page, tearing its mount down whenever
// the config/video it was built from disappears or changes, and mounting
// fresh whenever a lesson with both a config and a video appears.
(() => {
  // Controller-global cleanup (permanent observer, popstate handler). A
  // re-inject drains this first so repeated injection never stacks observers.
  if (Array.isArray(window.__vpDemoCleanup)) {
    for (const fn of window.__vpDemoCleanup) { try { fn(); } catch {} }
  }
  window.__vpDemoCleanup = [];

  // Dark LearningSuite enrichment palette. The primary is the configured
  // dark-mode accent; the supporting surfaces use the accompanying teal and
  // charcoal swatches.
  const T = {
    card: '#323333', fg: '#f4f7f6', muted: '#164f49', mutedFg: '#a8bfba',
    border: '#505352',
    primary: '#00e1a5', primaryFg: '#062b22',
    primarySoft: 'rgba(0,225,165,.14)', primaryRing: 'rgba(0,225,165,.42)',
    radius: '12px',
  };

  // ─────────── DATA (shape matches the repo) ───────────
  // Defaults only ever apply under an explicit `cfg.demo === true` opt-in on
  // the lesson's own config. A normal embed with e.g. no `phases` gets an
  // empty array, never DEFAULT_PHASES — absent categories must render as
  // nothing, not as canned demo content.
  //
  // To enrich a video, place a JSON config in the LearningSuite "Code einbetten"
  // block on that lesson, set to "In Seite anzeigen", with this exact wrapper:
  //
  //   <pre data-vp-config style="display:none">{...your JSON...}</pre>
  //
  // Why <pre>? LearningSuite sanitises embed-block HTML on student render and
  // strips <script>, hidden <div>s, and unknown attributes. Standard tags like
  // <pre> with `data-*` attributes survive — the textContent stays intact.
  //
  // Loader matches three shapes (first hit wins, in this order):
  //   1) <script type="application/json" data-vp-config>{...}</script>     // works locally / in our own pages
  //   2) <pre|div|span data-vp-config>{...}</...>                          // works through LearningSuite (preferred)
  //   3) <!--VP_CONFIG {...} VP_CONFIG-->                                  // HTML-comment fallback
  const DEFAULT_PHASES = [
    { id:'p1', title:'Model-Based Framing & Agency Priming', description:'Vorbereitende Phase: das mentale Modell der Klientin wird sichtbar gemacht und neu gerahmt.', startTimeSec:0,   endTimeSec:60,
      interventions:[
        { id:'i11', label:'1.1', title:'Model-Based Self-Localization',     t:4,  desc:'Klientin verortet sich im eigenen Modell der Situation.' },
        { id:'i12', label:'1.2', title:'Playful Inconsistency Highlighting',t:18, desc:'Spielerisch werden Widersprüche im Selbstbild herausgehoben.' },
        { id:'i13', label:'1.3', title:'Audience-Directed Meta-Framing',    t:35, desc:'Re-Framing durch Adressierung der mentalen Beobachter.' },
        { id:'i14', label:'1.4', title:'Metaphor Deconstruction',           t:50, desc:'Trennung metaphorischer Sprache von physiologischer Realität.' },
      ]},
    { id:'p2', title:'From Symptom Story to Process Control', description:'Übergang von der Story über das Symptom zu konkreter Steuerung des Prozesses.', startTimeSec:60,  endTimeSec:120,
      interventions:[
        { id:'i21', label:'2.1', title:'Rapport and Emotional Safety', t:64,  desc:'Aufbau eines emotional sicheren Containers.' },
        { id:'i22', label:'2.2', title:'Testing the Pattern',          t:78,  desc:'Vorsichtiges Re-Entry, um das Muster zu prüfen.' },
        { id:'i23', label:'2.3', title:'You Create the Pattern',       t:96,  desc:'Klientin erkennt sich als aktive Erzeugerin.' },
      ]},
    { id:'p3', title:'Practice & Commitment', description:'Konsolidierung und konkreter Mikro-Vorsatz für die nächsten 24 Stunden.', startTimeSec:120, endTimeSec:152,
      interventions:[
        { id:'i31', label:'3.1', title:'Future Pacing',    t:128, desc:'Mentale Vorwegnahme der erfolgreichen Umsetzung.' },
        { id:'i32', label:'3.2', title:'Mikro-Commitment', t:142, desc:'Kleinster Schritt, sofort umsetzbar.' },
      ]},
  ];

  const DEFAULT_SCIENCES = [
    { id:'s1', name:'Polyvagal Theory', description:'Autonome Nervensystem-Zustände als Erklärungsrahmen.', timestampsSec:[22, 86] },
    { id:'s2', name:'Six Human Needs',  description:'Modell intrinsischer Motivationen.',                  timestampsSec:[70, 105] },
    { id:'s3', name:'Interoception',    description:'Wahrnehmung innerer Körpersignale.',                  timestampsSec:[40] },
  ];

  const DEFAULT_AUDIOS = [
    { id:'a1', t:30, dur:9, title:'Voice-Over: Klarheit als Werkzeug', voice:'Dr. Frederik Hümmeke',
      script:'Klarheit ist nicht nur eine Eigenschaft. Sie ist ein wiederholbares Werkzeug, mit dem du im Alltag wirken kannst.' },
    { id:'a2', t:115, dur:8, title:'Voice-Over: Reflexionsimpuls', voice:'Dr. Frederik Hümmeke',
      script:'Halte einen Moment inne. Frage dich: wo handle ich heute schon klar, und wo zögere ich noch?' },
  ];

  const DEFAULT_META_STEPS = [
    { id:'m1', n:1, title:'Self-Localization',  t:4   },
    { id:'m2', n:2, title:'Pattern Visibility', t:25  },
    { id:'m3', n:3, title:'Agency Reframe',     t:60  },
    { id:'m4', n:4, title:'Decoding Need',      t:90  },
    { id:'m5', n:5, title:'Process Control',    t:110 },
    { id:'m6', n:6, title:'Future Pacing',      t:128 },
    { id:'m7', n:7, title:'Mikro-Commitment',   t:142 },
  ];

  function loadVpConfig() {
    // 1) <script type="application/json" data-vp-config>
    const script = document.querySelector('script[type="application/json"][data-vp-config]');
    if (script?.textContent?.trim()) {
      try { return { source: 'script', data: JSON.parse(script.textContent.trim()) }; }
      catch (e) { console.warn('[vp] config <script> parse failed', e); }
    }
    // 2) any element with data-vp-config attribute carrying JSON in textContent
    const el = document.querySelector('[data-vp-config]:not(script)');
    if (el?.textContent?.trim()) {
      try { return { source: 'element', data: JSON.parse(el.textContent.trim()) }; }
      catch (e) { console.warn('[vp] config element parse failed', e); }
    }
    // 3) HTML comment <!--VP_CONFIG ... VP_CONFIG-->. LearningSuite's embed block
    //    sometimes wraps content in a way that strips scripts; comments usually survive.
    const tw = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_COMMENT);
    let n; while ((n = tw.nextNode())) {
      const v = n.nodeValue || '';
      const m = v.match(/VP_CONFIG\s*([\s\S]*?)\s*VP_CONFIG/);
      if (m) {
        try { return { source: 'comment', data: JSON.parse(m[1]) }; }
        catch (e) { console.warn('[vp] config <!--comment--> parse failed', e); }
      }
    }
    return null;
  }

  // Readiness needs a parsed config, an <hls-video> in the DOM, and the
  // reskin runtime's window.player already installed. Re-read fresh from the
  // DOM every time this is called — never reuse a previous hit.
  function normalizeQuizConfig(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.quizzes)) return null;

    const seenQuizIds = new Set();
    const seenQuestionIds = new Set();
    const quizzes = value.quizzes.flatMap((rawQuiz) => {
      if (!rawQuiz || typeof rawQuiz !== 'object') return [];
      const id = String(rawQuiz.id || '').trim();
      const t = Number(rawQuiz.t);
      if (!id || seenQuizIds.has(id) || !Number.isFinite(t) || t < 0 || !Array.isArray(rawQuiz.questions)) {
        console.warn('[vp] ignoring invalid quiz break', rawQuiz);
        return [];
      }

      const questions = rawQuiz.questions.flatMap((rawQuestion) => {
        if (!rawQuestion || typeof rawQuestion !== 'object') return [];
        const questionId = String(rawQuestion.id || '').trim();
        const prompt = String(rawQuestion.prompt || '').trim();
        const correctOptionId = String(rawQuestion.correctOptionId || '').trim();
        if (!questionId || !prompt || !Array.isArray(rawQuestion.options)) return [];
        if (seenQuestionIds.has(questionId)) {
          console.warn('[vp] ignoring duplicate quiz question id', questionId);
          return [];
        }
        if (rawQuestion.options.length < 1 || rawQuestion.options.length > 4) {
          console.warn('[vp] ignoring quiz question with option count outside 1-4', rawQuestion);
          return [];
        }

        const seenOptionIds = new Set();
        const options = rawQuestion.options.flatMap((rawOption) => {
          if (!rawOption || typeof rawOption !== 'object') return [];
          const optionId = String(rawOption.id || '').trim();
          const text = String(rawOption.text || '').trim();
          if (!optionId || seenOptionIds.has(optionId) || !text) return [];
          seenOptionIds.add(optionId);
          return [{ id: optionId, text }];
        });
        if (options.length < 1 || !options.some((option) => option.id === correctOptionId)) {
          console.warn('[vp] ignoring quiz question with invalid options', rawQuestion);
          return [];
        }

        seenQuestionIds.add(questionId);
        const timeout = Number(rawQuestion.timeoutSec);
        const hasTimeout = rawQuestion.timeoutSec != null;
        const validTimeout = Number.isInteger(timeout) && timeout >= 5 && timeout <= 300;
        if (hasTimeout && !validTimeout) {
          console.warn('[vp] ignoring invalid quiz timeout; expected an integer from 5 to 300', rawQuestion.timeoutSec);
        }
        return [{
          id: questionId,
          prompt,
          options,
          correctOptionId,
          explanation: String(rawQuestion.explanation || '').trim(),
          timeoutSec: validTimeout ? timeout : null,
          showCountdown: rawQuestion.showCountdown !== false,
        }];
      });
      if (!questions.length) {
        console.warn('[vp] ignoring quiz break without valid questions', rawQuiz);
        return [];
      }

      seenQuizIds.add(id);
      return [{
        id,
        t,
        title: String(rawQuiz.title || '').trim(),
        resume: rawQuiz.resume === 'manual' ? 'manual' : 'auto',
        questions,
      }];
    }).sort((a, b) => a.t - b.t);

    if (!quizzes.length) return null;
    const feedbackDuration = Number(value.feedbackDurationSec);
    const passingPercent = Number(value.passingPercent);
    return {
      feedbackDurationSec: Number.isFinite(feedbackDuration)
        ? Math.max(0.5, Math.min(feedbackDuration, 10))
        : 3,
      showScore: value.showScore === true,
      showSummary: value.showSummary === true,
      passingPercent: Number.isFinite(passingPercent)
        ? Math.max(0, Math.min(passingPercent, 100))
        : null,
      quizzes,
    };
  }

  function readyContext() {
    if (!window.player) return null;
    const hit = loadVpConfig();
    if (!hit) return null;
    if (!document.querySelector('hls-video')) return null;
    return hit;
  }

  const fmt = s => { if (!isFinite(s)) return '0:00'; s = Math.max(0, s|0); return `${(s/60)|0}:${String(s%60).padStart(2,'0')}`; };

  // ─────────── STATIC STYLES (process-wide, independent of any config) ───────────
  // Neither block references per-mount data, so they're injected once, ever,
  // and never torn down — there's nothing "mount-owned" about them.
  function ensureBaseStyles() {
    if (!document.getElementById('vp-anim-style')) {
      const s = document.createElement('style');
      s.id = 'vp-anim-style';
      s.textContent = `
        @keyframes vp-slide-in-right { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        @keyframes vp-slide-in-bottom{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes vp-fade-in        { from{opacity:0} to{opacity:1} }
        @keyframes vp-pulse          { 0%,100%{opacity:1} 50%{opacity:.4} }
        .vp-anim-right  { animation: vp-slide-in-right .35s ease-out both; }
        .vp-anim-bottom { animation: vp-slide-in-bottom .35s ease-out both; }
        .vp-anim-fade   { animation: vp-fade-in .35s ease-out both; }
        .vp-pulse       { animation: vp-pulse 1.4s infinite; }
      `;
      document.head.appendChild(s);
    }
    if (!document.getElementById('__vp-section-style')) {
      const s = document.createElement('style');
      s.id = '__vp-section-style';
      s.textContent = `
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
      document.head.appendChild(s);
    }
  }
  ensureBaseStyles();

  // ─────────── SIDEBAR PLACEMENT HELPERS (pure w.r.t. any single mount) ───────────
  // Two strategies, picked at runtime:
  //
  //   (A) Flex-sibling of <main> — used on the regular Student page where
  //       LearningSuite renders <main> alongside a 300px "Sektion / X LEKTIONEN"
  //       right column. We hide that column and slot ourselves in.
  //
  //   (B) Fixed right rail — used in the Editor "Vorschau" preview and any
  //       other page where (A) wouldn't actually land us on the right edge
  //       (no <main>, parent isn't a row-flex with horizontal siblings, or
  //       post-install verification shows the sidebar didn't end up to the
  //       right of <main>). Pinned to the viewport right edge so the sidebar
  //       is always visible regardless of host layout.
  function detectTopNavHeight() {
    // Find the bottom edge of the highest-z-index fixed/sticky bar pinned to
    // the top of the viewport, so our sidebar can dodge under it.
    let bottom = 0;
    const candidates = document.querySelectorAll(
      'header, nav, [role="banner"], [class*="AppBar"], [class*="Toolbar"], [class*="topbar"], [class*="TopBar"], [class*="navbar"]'
    );
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.top > 6 || r.height > 200 || r.height < 24) continue;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    return bottom;
  }

  const SIDEBAR_W = 340;
  const SIDEBAR_GAP = 16;
  const SIDEBAR_MIN_TOP = 24;

  function applyFixedRightRail(sidebar, onCleanup) {
    const topClear = Math.max(SIDEBAR_MIN_TOP, Math.ceil(detectTopNavHeight() + 8));
    sidebar.style.position = 'fixed';
    sidebar.style.top = topClear + 'px';
    sidebar.style.right = SIDEBAR_GAP + 'px';
    sidebar.style.bottom = SIDEBAR_GAP + 'px';
    sidebar.style.maxHeight = `calc(100vh - ${topClear + SIDEBAR_GAP}px)`;
    sidebar.style.zIndex = '50';
    sidebar.style.width = SIDEBAR_W + 'px';
    sidebar.style.alignSelf = '';
    if (sidebar.parentElement !== document.body) document.body.appendChild(sidebar);

    // Reserve horizontal space so the sidebar never overlaps the centered
    // lesson content. Try a few common LS scroll containers; whichever sticks,
    // we clean up on unmount.
    const reservePx = SIDEBAR_W + SIDEBAR_GAP * 2;
    const targets = [
      document.querySelector('main'),
      document.querySelector('[class*="MainScroll"]'),
      document.querySelector('[class*="content-scroll"]'),
      document.body,
    ].filter(Boolean);
    for (const t of targets) {
      const prev = t.style.paddingRight;
      t.style.paddingRight = reservePx + 'px';
      onCleanup(() => { t.style.paddingRight = prev; });
    }

    // If the topnav grows/shrinks (resize, expand-collapse), keep our top
    // edge in sync.
    const onResize = () => {
      const next = Math.max(SIDEBAR_MIN_TOP, Math.ceil(detectTopNavHeight() + 8));
      sidebar.style.top = next + 'px';
      sidebar.style.maxHeight = `calc(100vh - ${next + SIDEBAR_GAP}px)`;
    };
    window.addEventListener('resize', onResize);
    onCleanup(() => window.removeEventListener('resize', onResize));
  }

  function tryFlexSibling(sidebar, onCleanup) {
    const main = document.querySelector('main');
    if (!main) return false;
    const flexParent = main.parentElement;
    if (!flexParent) return false;
    // Snapshot current sibling display values so we can revert if the layout
    // doesn't actually leave us on the right.
    const prevDisplays = new Map();
    [...flexParent.children].forEach(child => {
      if (child !== main && child.id !== 'vp-demo-sidebar') {
        prevDisplays.set(child, child.style.display);
        child.style.display = 'none';
      }
    });
    const prevParentDisplay = flexParent.style.display;
    const prevParentGap = flexParent.style.gap;
    const prevMainFlex = main.style.flex;
    const prevMainMinWidth = main.style.minWidth;
    if (getComputedStyle(flexParent).display !== 'flex') flexParent.style.display = 'flex';
    flexParent.style.gap = '24px';
    main.style.flex = '1 1 0';
    main.style.minWidth = '0';
    flexParent.appendChild(sidebar);

    // Verify: did sidebar actually land to the right of <main>, in the viewport?
    const mainRect = main.getBoundingClientRect();
    const sbRect = sidebar.getBoundingClientRect();
    const fitsToRightOfMain = sbRect.left + 5 >= mainRect.right;
    const visibleInViewport = sbRect.right <= window.innerWidth + 1 && sbRect.width >= 200;

    const revert = () => {
      prevDisplays.forEach((v, child) => { child.style.display = v; });
      flexParent.style.display = prevParentDisplay;
      flexParent.style.gap = prevParentGap;
      main.style.flex = prevMainFlex;
      main.style.minWidth = prevMainMinWidth;
    };

    if (fitsToRightOfMain && visibleInViewport) { onCleanup(revert); return true; }

    // Roll back layout edits — host page may rely on these.
    revert();
    return false;
  }

  // ─────────── LIFECYCLE CONTROLLER ───────────
  // Exactly one mount is active at a time. `generation` is bumped on every
  // teardown and every (re)schedule so a rAF-deferred mount that's since been
  // superseded (React re-render, rapid SPA nav) recognizes it's stale and
  // no-ops instead of double-mounting.
  let generation = 0;
  let currentMount = null;

  function teardownMount() {
    // Bump unconditionally, even with no active mount: a scheduleMount() may
    // already be waiting on its double-rAF with currentMount still null, and
    // this must invalidate it too (e.g. on script reinjection mid-schedule).
    generation++;
    if (!currentMount) return;
    const mount = currentMount;
    currentMount = null;
    mount.disposed = true;
    for (const fn of mount.cleanups.splice(0).reverse()) { try { fn(); } catch {} }
  }

  function scheduleMount() {
    const gen = ++generation;
    // Defer past two animation frames: when a config <pre>/hls-video just
    // appeared, the LearningSuite host (React) is often still mid-reconciliation
    // and would strip DOM we add to the player host on its next pass.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (gen !== generation) return; // superseded — a newer schedule or a teardown ran since
      const fresh = readyContext();
      if (!fresh) return;
      mount(fresh);
    }));
  }

  function evaluate() {
    const hit = readyContext();
    if (!hit) { teardownMount(); return; }
    if (currentMount) {
      const raw = JSON.stringify(hit.data);
      if (raw === currentMount.raw && currentMount.checkAlive()) return; // nothing changed, still intact
      teardownMount(); // config changed, or React stripped our nodes — remount fresh
    }
    scheduleMount();
  }

  function mount(cfgHit) {
    console.info(`[vp] config loaded from ${cfgHit.source}`);
    const cfg = cfgHit.data;
    const isDemo = cfg.demo === true;
    // Never silently substitute demo data for an absent category — an
    // embed's absent phases/sciences/audios/metaSteps must render as
    // nothing. DEFAULT_* only ever kicks in under this explicit opt-in.
    const phases    = Array.isArray(cfg.phases)    ? cfg.phases    : (isDemo ? DEFAULT_PHASES    : []);
    const sciences  = Array.isArray(cfg.sciences)  ? cfg.sciences  : (isDemo ? DEFAULT_SCIENCES  : []);
    const audios    = Array.isArray(cfg.audios)    ? cfg.audios    : (isDemo ? DEFAULT_AUDIOS    : []);
    const metaSteps = Array.isArray(cfg.metaSteps) ? cfg.metaSteps : (isDemo ? DEFAULT_META_STEPS : []);
    const quiz = normalizeQuizConfig(cfg.quiz);

    const showSectionOverlay = phases.length > 1;    // exactly one phase: keep the Coaching tab, no video overlay
    const showCoachingTab = phases.length > 0;
    const showScienceTab = sciences.length > 0;
    const showMetaTab = metaSteps.length > 0;
    const showSidebar = showCoachingTab || showScienceTab || showMetaTab;
    const showAudio = audios.length > 0;
    const showQuiz = !!quiz;

    const mountedPlayer = window.player;
    const mountedVideoEl = document.querySelector('hls-video');
    const playerHost = mountedVideoEl?.parentElement;
    if (!playerHost) { console.warn('[demo] no player host'); return; }

    const cleanups = [];
    const mountState = { cleanups, raw: JSON.stringify(cfg), disposed: false, checkAlive: () => true };
    currentMount = mountState;
    function onCleanup(fn) { cleanups.push(fn); }

    window.__vpConfig = { source: cfgHit.source, data: { phases, sciences, audios, metaSteps, quiz } };
    onCleanup(() => { delete window.__vpConfig; });

    // ─────────── PLAYER OVERLAY SLOTS (positioned inside the player host) ───────────
    const prevHostPosition = playerHost.style.position;
    if (getComputedStyle(playerHost).position === 'static') playerHost.style.position = 'relative';
    onCleanup(() => { playerHost.style.position = prevHostPosition; });

    // Defensive: clear any stray leftover nodes with our ids (e.g. a stale
    // mount from before this controller's own cleanup registry existed).
    ['vp-slot-tl', 'vp-slot-tr', 'vp-slot-br', 'vp-slot-lt', 'vp-slot-quiz', 'vp-demo-sidebar'].forEach(id => document.getElementById(id)?.remove());

    const SLOT_EVENTS = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
    function makeSlot(id, posCss) {
      const el = document.createElement('div');
      el.id = id;
      el.style.cssText = `position:absolute; ${posCss}; pointer-events:none; z-index:8;`;
      // When a click/touch hits a CHILD of this slot (i.e. an actual overlay surface),
      // stop it from bubbling up to the player wrapper which toggles play/pause.
      // The slot itself has pointer-events:none, so empty-area clicks still pass through to the video.
      const swallow = (e) => { if (e.target !== el) e.stopPropagation(); };
      SLOT_EVENTS.forEach(ev => el.addEventListener(ev, swallow));
      playerHost.appendChild(el);
      onCleanup(() => { SLOT_EVENTS.forEach(ev => el.removeEventListener(ev, swallow)); el.remove(); });
      return el;
    }
    const slotTL = showSectionOverlay ? makeSlot('vp-slot-tl', 'top:14px; left:14px; right:14px; max-width:none') : null;
    const slotTR = showScienceTab ? makeSlot('vp-slot-tr', 'top:10px; right:10px;') : null;
    const slotBR = showMetaTab ? makeSlot('vp-slot-br', 'bottom:70px; right:14px;') : null;
    const slotLowerThird = showAudio ? makeSlot('vp-slot-lt', 'left:14px; right:14px; bottom:70px;') : null;
    const slotQuiz = showQuiz ? makeSlot('vp-slot-quiz', 'inset:0; z-index:20; display:flex; align-items:center; justify-content:center;') : null;

    // ─────────── SECTION INDICATOR (top-left) ───────────
    // Mirrors components/video-player/overlays/section-indicator.tsx
    // Hover state is OWNED BY CSS (`:hover`) so it survives DOM updates.
    // The DOM tree is built ONCE; `time` events only patch text/widths/classes.
    let sectionRefs = null;
    let renderedRows = [];
    let renderedPhaseId = null;
    if (showSectionOverlay) {
      const sectionPill = document.createElement('div');
      sectionPill.className = 'vp-section-pill';
      sectionPill.innerHTML = `
        <div class="vp-sec-card">
          <div class="vp-sec-collapsed">
            <span class="vp-sec-title" data-section></span>
            <div class="vp-sec-cur-row" data-cur-row hidden>
              <span style="opacity:.6">›</span>
              <span class="vp-sec-cur-title" data-cur-title></span>
            </div>
          </div>
          <div class="vp-sec-expanded">
            <div class="vp-sec-eyebrow">Course Section</div>
            <h3 class="vp-sec-h3" data-section-h3></h3>
            <div data-progress-block>
              <div class="vp-sec-bar"><div class="vp-sec-bar-fill" data-bar-fill style="width:0%"></div></div>
              <div class="vp-sec-count" data-count></div>
              <div class="vp-sec-rows" data-rows></div>
            </div>
            <div data-empty hidden style="color:rgba(168,191,186,.72); font-size:13px">Starting soon...</div>
          </div>
        </div>`;
      slotTL.appendChild(sectionPill);

      const $ = (sel) => sectionPill.querySelector(sel);
      sectionRefs = {
        title:    $('[data-section]'),
        h3:       $('[data-section-h3]'),
        curRow:   $('[data-cur-row]'),
        curTitle: $('[data-cur-title]'),
        progress: $('[data-progress-block]'),
        barFill:  $('[data-bar-fill]'),
        count:    $('[data-count]'),
        rowsHost: $('[data-rows]'),
        empty:    $('[data-empty]'),
      };

      const onSectionClick = (e) => {
        const row = e.target.closest('[data-seek]');
        if (!row) return;
        e.stopPropagation();
        window.player.seek(+row.dataset.seek + 0.1);
      };
      sectionPill.addEventListener('click', onSectionClick);
      onCleanup(() => sectionPill.removeEventListener('click', onSectionClick));
    }

    function renderSection() {
      if (!showSectionOverlay) return;
      const t = window.player.current ?? 0;
      const phase = phases.find(p => t >= p.startTimeSec && t < p.endTimeSec);
      const section = phase?.title ?? 'Intro';
      const subs = phase ? phase.interventions.map(iv => ({
        ...iv,
        completed: t > iv.t,
        current: phase.interventions.findLast?.(x => t >= x.t)?.id === iv.id,
      })) : [];
      const cur = subs.find(s => s.current);
      const completedCount = subs.filter(s => s.completed).length;

      // Collapsed view
      if (sectionRefs.title.textContent !== section) sectionRefs.title.textContent = section;
      sectionRefs.title.title = section;
      if (cur) {
        sectionRefs.curRow.hidden = false;
        if (sectionRefs.curTitle.textContent !== cur.title) sectionRefs.curTitle.textContent = cur.title;
        sectionRefs.curTitle.title = cur.title;
      } else {
        sectionRefs.curRow.hidden = true;
      }

      // Expanded view: section title
      if (sectionRefs.h3.textContent !== section) sectionRefs.h3.textContent = section;

      // Expanded view: progress + rows
      if (subs.length) {
        sectionRefs.progress.hidden = false;
        sectionRefs.empty.hidden = true;
        const pct = (completedCount / subs.length) * 100;
        sectionRefs.barFill.style.width = pct + '%';
        const countTxt = `${completedCount} of ${subs.length} completed`;
        if (sectionRefs.count.textContent !== countTxt) sectionRefs.count.textContent = countTxt;

        // Rebuild rows ONLY when phase changes (not on every time tick).
        if (renderedPhaseId !== phase.id) {
          renderedPhaseId = phase.id;
          sectionRefs.rowsHost.innerHTML = '';
          renderedRows = subs.map((s) => {
            const el = document.createElement('div');
            el.className = 'vp-sec-row';
            el.dataset.seek = s.timestampSec ?? s.t;
            const dot = document.createElement('div');
            dot.className = 'vp-sec-dot';
            const titleEl = document.createElement('span');
            titleEl.className = 'vp-sec-row-title';
            titleEl.textContent = s.title;
            el.appendChild(dot);
            el.appendChild(titleEl);
            sectionRefs.rowsHost.appendChild(el);
            return { el, dot, titleEl, id: s.id };
          });
        }
        // Patch only state attrs on the existing rows
        subs.forEach((s, i) => {
          const r = renderedRows[i];
          if (!r) return;
          const state = s.completed ? 'completed' : s.current ? 'current' : 'upcoming';
          if (r.el.dataset.state !== state) r.el.dataset.state = state;
          if (r.dot.dataset.state !== state) r.dot.dataset.state = state;
          const cur01 = s.current ? '1' : '0';
          if (r.el.dataset.current !== cur01) r.el.dataset.current = cur01;
        });
      } else {
        sectionRefs.progress.hidden = true;
        sectionRefs.empty.hidden = false;
        renderedPhaseId = null;
        renderedRows = [];
        sectionRefs.rowsHost.innerHTML = '';
      }
    }

    // ─────────── SCIENCE TRIGGER (top-right, compact) ───────────
    function renderScience(t) {
      if (!showScienceTab) return;
      let active = null;
      for (const sc of sciences) for (const ts of sc.timestampsSec) if (t >= ts && t < ts + 5) { active = sc; break; }
      if (!active) {
        if (slotTR.dataset.activeSci) {
          slotTR.innerHTML = '';
          slotTR.dataset.activeSci = '';
          window.__vpHighlightedScience = null;
          renderScienceHighlight();
        }
        return;
      }
      if (slotTR.dataset.activeSci === active.id) return;
      slotTR.dataset.activeSci = active.id;
      window.__vpHighlightedScience = active.id;
      renderScienceHighlight();
      slotTR.innerHTML = `
        <div data-overlay-action="science" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:8px; background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92)); border:1px solid rgba(0,225,165,.38); border-radius:999px; padding:5px 6px 5px 12px; backdrop-filter:blur(10px); box-shadow:0 10px 24px rgba(0,0,0,.30); color:#f4f7f6; pointer-events:auto; cursor:pointer;">
          <span style="font-size:14px;line-height:1">🧪</span>
          <span style="font:600 12px system-ui; color:#f4f7f6; letter-spacing:.2px">Science:</span>
          <span style="font:500 12px system-ui; color:rgba(168,191,186,.9); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${active.name}</span>
          <button style="background:#00e1a5; color:#062b22; border:0; border-radius:999px; padding:4px 11px; font:600 11.5px system-ui; cursor:pointer; flex-shrink:0; line-height:1.3; pointer-events:auto;">Open</button>
        </div>`;
      const openSci = (e) => { e.stopPropagation(); window.__vpSidebarTab?.('science'); };
      slotTR.querySelector('[data-overlay-action="science"]').onclick = openSci;
      slotTR.querySelector('button').onclick = openSci;
    }

    // ─────────── AUDIO STATE MACHINE ───────────
    // When the video crosses an audio's trigger time, pause the video and play the audio (mocked
    // with a tick timer for the POC). When the audio ends or is skipped, resume the video.
    // While audio is active, play/pause + spacebar control the audio, not the video.
    let audioCtrl = null;
    if (showAudio) {
      const videoEl = mountedVideoEl;
      audioCtrl = {
        state: 'idle', // idle | playing | paused
        active: null,
        audioTime: 0,
        videoResumeTime: 0,
        triggered: new Set(),
        _tickHandle: null,

        activate(a, videoT) {
          if (this.state !== 'idle') return;
          this.state = 'playing';
          this.active = a;
          this.audioTime = 0;
          this.videoResumeTime = videoT;
          this.triggered.add(a.id);
          try { videoEl.pause(); } catch {}
          this._speak(a);
          this._scheduleTick();
        },
        togglePlay() {
          if (this.state === 'idle') return;
          if (this.state === 'playing') {
            this.state = 'paused';
            try { speechSynthesis.pause(); } catch {}
          } else {
            this.state = 'playing';
            try { speechSynthesis.resume(); } catch {}
          }
          this._scheduleTick();
          this._render();
        },
        end({ resume = true } = {}) {
          this.state = 'idle';
          this.active = null;
          this.audioTime = 0;
          if (this._tickHandle) { clearTimeout(this._tickHandle); this._tickHandle = null; }
          try { speechSynthesis.cancel(); } catch {}
          if (slotLowerThird) {
            slotLowerThird.innerHTML = '';
            slotLowerThird.dataset.kind = '';
            slotLowerThird.dataset.activeAudio = '';
          }
          if (resume) { try { videoEl.currentTime = this.videoResumeTime; videoEl.play(); } catch {} }
        },
        skip() { this.end({ resume: true }); },
        seekRel(delta) {
          if (this.state === 'idle') return;
          this.audioTime = Math.max(0, Math.min(this.active.dur, this.audioTime + delta));
          this._render();
          // SpeechSynthesis can't seek mid-utterance — advance the visual only.
        },
        _speak(a) {
          try {
            if (!('speechSynthesis' in window)) return;
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(a.script || a.title);
            u.lang = 'de-DE';
            u.rate = 1.0;
            u.pitch = 1.0;
            u.onend = () => { if (mountState.disposed) return; if (this.state !== 'idle') this.end({ resume: true }); };
            speechSynthesis.speak(u);
          } catch {}
        },
        isActive() { return this.state !== 'idle'; },

        _scheduleTick() {
          if (this._tickHandle) clearTimeout(this._tickHandle);
          if (this.state !== 'playing') return;
          this._tickHandle = setTimeout(() => {
            this._tickHandle = null;
            if (mountState.disposed) return;
            if (this.state !== 'playing') return;
            this.audioTime = Math.min(this.active.dur, this.audioTime + 0.1);
            if (this.audioTime >= this.active.dur) { this.end({ resume: true }); return; }
            this._render();
            this._scheduleTick();
          }, 100);
        },

        _render() { renderAudio(); },

        // Stop timers/speech on teardown WITHOUT touching video playback —
        // the underlying <hls-video> may already be mid-detach by the time
        // this runs (SPA nav away from the lesson).
        dispose() {
          this.state = 'idle';
          this.active = null;
          if (this._tickHandle) { clearTimeout(this._tickHandle); this._tickHandle = null; }
          try { speechSynthesis.cancel(); } catch {}
        },
      };
      window.__audioCtrl = audioCtrl;
      onCleanup(() => { audioCtrl.dispose(); delete window.__audioCtrl; });

      // Intercept play/pause clicks on the reskin controls + spacebar when audio is active.
      // Capture phase so we run before the reskin's own handlers.
      const onDocClick = (e) => {
        if (!audioCtrl.isActive()) return;
        const btn = e.target.closest && e.target.closest('[data-vp="playpause"]');
        if (btn) { e.preventDefault(); e.stopPropagation(); audioCtrl.togglePlay(); }
      };
      const onDocKeydown = (e) => {
        if (!audioCtrl.isActive()) return;
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) return;
        if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); audioCtrl.togglePlay(); }
      };
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onDocKeydown, true);
      onCleanup(() => {
        document.removeEventListener('click', onDocClick, true);
        document.removeEventListener('keydown', onDocKeydown, true);
      });
    }

    // Trigger audio when video time crosses an audio's t (one-shot per audio per pass).
    function maybeTriggerAudio(t) {
      if (!showAudio || audioCtrl.isActive()) return;
      // Allow re-trigger if user scrubbed back past the trigger.
      for (const a of audios) if (t < a.t - 0.5) audioCtrl.triggered.delete(a.id);
      const due = audios.find(a => t >= a.t && t < a.t + 1.0 && !audioCtrl.triggered.has(a.id));
      if (due) audioCtrl.activate(due, t);
    }

    const videoEl = mountedVideoEl;
    // ─────────── INTERACTIVE QUIZ STATE MACHINE ───────────
    // Quiz state is deliberately session-only. The controller never writes to
    // storage or calls an API; a reload starts a fresh attempt.
    let quizSeeking = false;
    const onQuizSeeking = () => { quizSeeking = true; };
    const onQuizSeeked = () => {
      quizSeeking = false;
      quizCtrl.previousTime = Number(videoEl.currentTime) || 0;
      quizCtrl.videoEnded = false;
    };
    videoEl.addEventListener('seeking', onQuizSeeking);
    videoEl.addEventListener('seeked', onQuizSeeked);
    onCleanup(() => videoEl.removeEventListener('seeking', onQuizSeeking));
    onCleanup(() => videoEl.removeEventListener('seeked', onQuizSeeked));

    const quizCtrl = {
      mode: 'idle', // idle | question | feedback | awaiting-continue | summary
      activeQuiz: null,
      questionIndex: 0,
      results: new Map(),
      completedQuizIds: new Set(),
      pendingQuizIds: [],
      previousTime: -0.01,
      remainingSec: null,
      resumeWasPlaying: false,
      videoEnded: false,
      _countdownHandle: null,
      _feedbackHandle: null,

      isActive() { return this.mode !== 'idle'; },
      currentQuestion() { return this.activeQuiz?.questions[this.questionIndex] || null; },
      resultKey(quizBreak, question) { return `${quizBreak.id}:${question.id}`; },

      activate(quizBreak, { preserveResume = false } = {}) {
        if (!quizBreak || this.mode !== 'idle' || audioCtrl?.isActive()) return false;
        if (!preserveResume) this.resumeWasPlaying = !videoEl.paused && !videoEl.ended;
        this.activeQuiz = quizBreak;
        this.questionIndex = 0;
        this.mode = 'question';
        this.remainingSec = null;
        try { videoEl.pause(); } catch {}
        this.startCountdown();
        renderQuiz();
        return true;
      },

      startCountdown() {
        this.clearCountdown();
        const question = this.currentQuestion();
        if (!question?.timeoutSec) return;
        const deadline = performance.now() + question.timeoutSec * 1000;
        this.remainingSec = question.timeoutSec;
        this._countdownHandle = setInterval(() => {
          if (this.mode !== 'question') { this.clearCountdown(); return; }
          this.remainingSec = Math.max(0, (deadline - performance.now()) / 1000);
          updateQuizCountdown();
          if (this.remainingSec <= 0) this.answer(null, 'timeout');
        }, 100);
      },

      clearCountdown() {
        if (this._countdownHandle) clearInterval(this._countdownHandle);
        this._countdownHandle = null;
        this.remainingSec = null;
      },

      answer(optionId, forcedOutcome = null) {
        if (this.mode !== 'question') return;
        const question = this.currentQuestion();
        if (!question) return;
        if (optionId !== null && !question.options.some((option) => option.id === optionId)) return;

        this.clearCountdown();
        const outcome = forcedOutcome || (optionId === question.correctOptionId ? 'correct' : 'wrong');
        this.results.set(this.resultKey(this.activeQuiz, question), {
          quizId: this.activeQuiz.id,
          questionId: question.id,
          prompt: question.prompt,
          selectedOptionId: optionId,
          correctOptionId: question.correctOptionId,
          outcome,
        });
        this.mode = 'feedback';
        renderQuiz();
        // Incorrect answers show corrective copy. Keep that feedback visible
        // until the learner explicitly continues so it cannot disappear
        // before they have had time to read it.
        if (outcome === 'wrong') return;
        this._feedbackHandle = setTimeout(() => {
          this._feedbackHandle = null;
          this.advance();
        }, quiz.feedbackDurationSec * 1000);
      },

      skip() { this.answer(null, 'skipped'); },

      continueFeedback() {
        if (this.mode !== 'feedback') return;
        if (this._feedbackHandle) clearTimeout(this._feedbackHandle);
        this._feedbackHandle = null;
        this.advance();
      },

      advance() {
        if (!this.activeQuiz || this.mode !== 'feedback') return;
        if (this.questionIndex < this.activeQuiz.questions.length - 1) {
          this.questionIndex += 1;
          this.mode = 'question';
          this.startCountdown();
          renderQuiz();
          return;
        }

        this.completedQuizIds.add(this.activeQuiz.id);
        if (this.activeQuiz.resume === 'manual' && !this.videoEnded) {
          this.mode = 'awaiting-continue';
          renderQuiz();
          return;
        }
        this.finishBreak();
      },

      continuePlayback() {
        if (this.mode !== 'awaiting-continue') return;
        this.finishBreak();
      },

      finishBreak() {
        this.clearCountdown();
        if (this._feedbackHandle) clearTimeout(this._feedbackHandle);
        this._feedbackHandle = null;
        this.activeQuiz = null;
        this.questionIndex = 0;
        this.mode = 'idle';
        clearQuiz();

        let nextQuiz = null;
        while (this.pendingQuizIds.length && !nextQuiz) {
          const nextId = this.pendingQuizIds.shift();
          if (this.completedQuizIds.has(nextId)) continue;
          nextQuiz = quiz?.quizzes.find((item) => item.id === nextId) || null;
        }
        if (nextQuiz && this.activate(nextQuiz, { preserveResume: true })) return;
        if (this.videoEnded) {
          if (quiz?.showSummary) this.showSummary();
          return;
        }
        if (this.resumeWasPlaying) {
          try { videoEl.play(); } catch {}
        }
      },

      onTime(t) {
        if (!quiz || this.isActive() || audioCtrl?.isActive() || !Number.isFinite(t)) return false;
        const delta = t - this.previousTime;
        this.previousTime = t;
        // Quizzes are intentionally non-gating and do not ambush a learner who
        // scrubs across a trigger. Use the media element's explicit seeking
        // lifecycle rather than guessing from throttled timeupdate intervals.
        if (quizSeeking || delta < 0) return false;
        const due = quiz.quizzes.filter((item) =>
          !this.completedQuizIds.has(item.id) && item.t > t - delta && item.t <= t
        );
        if (!due.length) return false;
        this.pendingQuizIds.push(...due.slice(1).map((item) => item.id));
        return this.activate(due[0]);
      },

      onEnded() {
        if (!quiz) return;
        this.videoEnded = true;
        const endQuizzes = quiz.quizzes.filter((item) =>
          !this.completedQuizIds.has(item.id) &&
          item.id !== this.activeQuiz?.id &&
          !this.pendingQuizIds.includes(item.id) &&
          item.t >= Math.max(0, videoEl.duration - 0.5)
        );
        if (this.isActive()) {
          this.pendingQuizIds.push(...endQuizzes.map((item) => item.id));
          return;
        }
        if (endQuizzes.length) {
          this.pendingQuizIds.push(...endQuizzes.slice(1).map((item) => item.id));
          this.activate(endQuizzes[0]);
        } else if (quiz.showSummary) {
          this.showSummary();
        }
      },

      showSummary() {
        if (!quiz?.showSummary) return;
        this.mode = 'summary';
        this.activeQuiz = null;
        try { videoEl.pause(); } catch {}
        renderQuiz();
      },

      closeSummary() {
        if (this.mode !== 'summary') return;
        this.mode = 'idle';
        clearQuiz();
        playerHost.focus?.();
      },

      restart() {
        this.clearCountdown();
        if (this._feedbackHandle) clearTimeout(this._feedbackHandle);
        this._feedbackHandle = null;
        this.mode = 'idle';
        this.activeQuiz = null;
        this.questionIndex = 0;
        this.results.clear();
        this.completedQuizIds.clear();
        this.pendingQuizIds = [];
        this.previousTime = -0.01;
        this.videoEnded = false;
        clearQuiz();
        try { videoEl.currentTime = 0; videoEl.play(); } catch {}
      },

      summaryRows() {
        if (!quiz) return [];
        return quiz.quizzes.flatMap((quizBreak) => quizBreak.questions.map((question) => ({
          quizId: quizBreak.id,
          questionId: question.id,
          prompt: question.prompt,
          result: this.results.get(this.resultKey(quizBreak, question)) || null,
        })));
      },

      destroy() {
        this.clearCountdown();
        if (this._feedbackHandle) clearTimeout(this._feedbackHandle);
        this._feedbackHandle = null;
      },
    };
    window.__vpQuiz = quizCtrl;
    onCleanup(() => { quizCtrl.destroy(); delete window.__vpQuiz; });

    // Presentation hooks are implemented below so the state machine stays easy

    // ─────────── QUIZ OVERLAY STYLES (injected once) ───────────
    const quizStyleId = '__vp-quiz-style';
    document.getElementById(quizStyleId)?.remove();
    {
      const s = document.createElement('style');
      s.id = quizStyleId;
      s.textContent = `
        #vp-slot-quiz { container-type: inline-size; container-name: vp-quiz; }
        .vp-quiz-scrim {
          position:absolute; inset:0; pointer-events:auto;
          display:flex; align-items:center; justify-content:center;
          padding:16px; box-sizing:border-box;
          background:rgba(8,18,16,.68); backdrop-filter:blur(3px);
        }
        .vp-quiz-card {
          position:relative; width:100%; max-width:440px; max-height:100%; min-height:0;
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
        .vp-quiz-meta-row { display:flex; justify-content:flex-end; margin:-5px 0 8px; }
        .vp-quiz-score-chip { font:600 11.5px system-ui; padding:3px 10px; border-radius:999px; background:rgba(0,225,165,.12); border:1px solid rgba(0,225,165,.28); color:#62dfc1; }
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
        .vp-quiz-option-icon { font-size:13px; flex:0 0 auto; }
        .vp-quiz-countdown { display:flex; align-items:center; gap:8px; margin:0 0 8px; }
        .vp-quiz-ring { width:30px; height:30px; flex:0 0 auto; }
        .vp-quiz-ring-track { fill:none; stroke:rgba(255,255,255,.15); stroke-width:3; }
        .vp-quiz-ring-fill { fill:none; stroke:#00e1a5; stroke-width:3; stroke-linecap:round; transform:rotate(-90deg); transform-origin:50% 50%; transition:stroke-dashoffset .1s linear, stroke .2s ease; }
        .vp-quiz-countdown[data-warn="1"] .vp-quiz-ring-fill { stroke:#f87171; }
        .vp-quiz-countdown-num { font:700 13px ui-monospace,monospace; color:rgba(168,191,186,.9); min-width:2.4ch; text-align:right; }
        .vp-quiz-countdown[data-warn="1"] .vp-quiz-countdown-num { color:#fca5a5; }
        .vp-quiz-feedback-banner { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:10px; font:700 13px system-ui; margin:0 0 10px; }
        .vp-quiz-feedback-banner[data-outcome="correct"] { background:rgba(74,222,128,.16); color:#bbf7d0; border:1px solid rgba(74,222,128,.35); }
        .vp-quiz-feedback-banner[data-outcome="wrong"], .vp-quiz-feedback-banner[data-outcome="timeout"], .vp-quiz-feedback-banner[data-outcome="skipped"] { background:rgba(248,113,113,.14); color:#fecaca; border:1px solid rgba(248,113,113,.32); }
        .vp-quiz-explanation { font:500 12.5px/1.5 system-ui; color:rgba(168,191,186,.88); margin:0 0 12px; }
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
        .vp-quiz-summary-row-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      `;
      document.head.appendChild(s);
    }

    // Minimal safe element builder: attributes go through setAttribute/className
    // (never innerHTML), string children become text nodes — config-authored
    // strings (prompt/option text/explanation/title) are never parsed as HTML.
    function qzEl(tag, props, kids) {
      const node = document.createElement(tag);
      for (const key in (props || {})) {
        const val = props[key];
        if (val == null || val === false) continue;
        if (key === 'class') node.className = val;
        else if (key === 'style') node.style.cssText = val;
        else node.setAttribute(key, val === true ? '' : val);
      }
      for (const kid of [].concat(kids || [])) {
        if (kid == null || kid === false) continue;
        node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
      }
      return node;
    }

    let quizOptionFocusIndex = 0;

    function buildQuizCountdown(question) {
      const size = 30, stroke = 3, radius = (size - stroke) / 2, circ = 2 * Math.PI * radius;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
      svg.setAttribute('class', 'vp-quiz-ring');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('data-vp-quiz-ring', '');
      svg.dataset.circ = String(circ);
      const track = document.createElementNS(svgNS, 'circle');
      track.setAttribute('class', 'vp-quiz-ring-track');
      track.setAttribute('cx', size / 2); track.setAttribute('cy', size / 2); track.setAttribute('r', radius);
      const fill = document.createElementNS(svgNS, 'circle');
      fill.setAttribute('class', 'vp-quiz-ring-fill');
      fill.setAttribute('cx', size / 2); fill.setAttribute('cy', size / 2); fill.setAttribute('r', radius);
      fill.setAttribute('stroke-dasharray', String(circ));
      fill.setAttribute('stroke-dashoffset', '0');
      fill.setAttribute('data-vp-quiz-ring-fill', '');
      svg.appendChild(track);
      svg.appendChild(fill);

      const remaining = Math.max(0, quizCtrl.remainingSec ?? question.timeoutSec);
      const num = qzEl('span', { class: 'vp-quiz-countdown-num', 'data-vp-quiz-countdown-num': '' }, [String(Math.ceil(remaining))]);
      const wrap = qzEl('div', { class: 'vp-quiz-countdown', role: 'timer', 'aria-live': 'off', 'data-vp-quiz-countdown': '' });
      wrap.appendChild(svg);
      wrap.appendChild(num);
      return wrap;
    }

    function buildQuizFeedback(result, question) {
      const copy = {
        correct:  { icon: '✓', text: 'Richtig!' },
        wrong:    { icon: '✕', text: 'Leider falsch.' },
        timeout:  { icon: '⏱', text: 'Zeit abgelaufen.' },
        skipped:  { icon: '—', text: 'Übersprungen.' },
      }[result.outcome] || { icon: '✕', text: 'Leider falsch.' };

      const bannerKids = [
        qzEl('span', { 'aria-hidden': 'true' }, [copy.icon]),
        qzEl('span', {}, [copy.text]),
      ];
      if (result.outcome !== 'correct') {
        const correctOption = question.options.find((o) => o.id === question.correctOptionId);
        if (correctOption) {
          bannerKids.push(qzEl('span', {}, [' Richtig ist: ']));
          bannerKids.push(qzEl('strong', {}, [correctOption.text]));
        }
      }

      const frag = qzEl('div', {});
      frag.appendChild(qzEl('div', { class: 'vp-quiz-feedback-banner', 'data-outcome': result.outcome, role: 'alert', 'data-vp-quiz-feedback': '' }, bannerKids));
      if (question.explanation) {
        frag.appendChild(qzEl('p', { class: 'vp-quiz-explanation', 'data-vp-quiz-explanation': '' }, [question.explanation]));
      }
      return frag;
    }

    function buildQuizOption(option, idx, question, result, mode) {
      const isAnswered = mode === 'feedback' || mode === 'awaiting-continue';
      const selectedId = result?.selectedOptionId ?? null;
      const isCorrectOpt = option.id === question.correctOptionId;
      let state = 'default';
      if (isAnswered) {
        if (isCorrectOpt) state = 'correct';
        else if (option.id === selectedId) state = 'wrong';
      }
      const kids = [
        qzEl('span', { class: 'vp-quiz-option-badge', 'aria-hidden': 'true' }, [String.fromCharCode(65 + idx)]),
        qzEl('span', { class: 'vp-quiz-option-text' }, [option.text]),
      ];
      if (state === 'correct') kids.push(qzEl('span', { class: 'vp-quiz-option-icon', 'aria-hidden': 'true' }, ['✓']));
      if (state === 'wrong')   kids.push(qzEl('span', { class: 'vp-quiz-option-icon', 'aria-hidden': 'true' }, ['✕']));

      const btn = qzEl('button', {
        type: 'button',
        class: 'vp-quiz-option',
        role: 'radio',
        'aria-checked': selectedId != null ? String(option.id === selectedId) : 'false',
        'data-state': state,
        'data-option-id': option.id,
        'data-vp-quiz-option': '',
        tabindex: isAnswered ? null : (idx === quizOptionFocusIndex ? '0' : '-1'),
      }, kids);
      if (isAnswered) btn.disabled = true;
      else btn.addEventListener('click', () => quizCtrl.answer(option.id));
      return btn;
    }

    function wireQuizOptionNav(container, buttons) {
      // Number-key (1-4) selection is handled globally in onQuizGlobalKeydown
      // since it must work from anywhere in the dialog (e.g. while focus is
      // still on the heading), not just while focus is inside this container.
      container.addEventListener('keydown', (e) => {
        const idx = buttons.indexOf(document.activeElement);
        if (idx === -1) return;
        let next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % buttons.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + buttons.length) % buttons.length;
        if (next == null) return;
        e.preventDefault();
        e.stopPropagation();
        buttons[idx].tabIndex = -1;
        buttons[next].tabIndex = 0;
        buttons[next].focus();
        quizOptionFocusIndex = next;
      });
    }

    function buildQuizQuestion(card, question) {
      const mode = quizCtrl.mode;
      const idx = quizCtrl.questionIndex;
      const total = quizCtrl.activeQuiz.questions.length;
      const isAnswered = mode === 'feedback' || mode === 'awaiting-continue';
      const result = quizCtrl.results.get(quizCtrl.resultKey(quizCtrl.activeQuiz, question)) || null;

      if (quizCtrl.activeQuiz.title) {
        card.appendChild(qzEl('div', { class: 'vp-quiz-eyebrow' }, [quizCtrl.activeQuiz.title]));
      }
      card.appendChild(qzEl('h2', { id: 'vp-quiz-heading', class: 'vp-quiz-heading', tabindex: '-1' }, [`Frage ${idx + 1} von ${total}`]));

      if (quiz.showScore) {
        const correctSoFar = [...quizCtrl.results.values()].filter((r) => r.outcome === 'correct').length;
        const answeredSoFar = quizCtrl.results.size;
        card.appendChild(qzEl('div', { class: 'vp-quiz-meta-row' }, [
          qzEl('span', { class: 'vp-quiz-score-chip' }, [`${correctSoFar} / ${answeredSoFar} richtig`]),
        ]));
      }

      if (mode === 'question' && question.timeoutSec && question.showCountdown) {
        card.appendChild(buildQuizCountdown(question));
      }

      card.appendChild(qzEl('p', { class: 'vp-quiz-prompt', id: 'vp-quiz-prompt' }, [question.prompt]));

      if (isAnswered && result) {
        card.appendChild(buildQuizFeedback(result, question));
      }

      if (mode === 'question') quizOptionFocusIndex = 0;
      const optionsHost = qzEl('div', {
        class: 'vp-quiz-options',
        role: 'radiogroup',
        'aria-labelledby': 'vp-quiz-prompt',
        'data-cols': question.options.length === 4 ? '2' : '1',
        'data-vp-quiz-options': '',
      });
      const buttons = question.options.map((option, i) => buildQuizOption(option, i, question, result, mode));
      buttons.forEach((b) => optionsHost.appendChild(b));
      card.appendChild(optionsHost);
      if (mode === 'question') wireQuizOptionNav(optionsHost, buttons);

      if (mode === 'question') {
        const skipBtn = qzEl('button', { type: 'button', class: 'vp-quiz-skip', 'data-vp-quiz-skip': '' }, ['Frage überspringen']);
        skipBtn.addEventListener('click', () => quizCtrl.skip());
        card.appendChild(skipBtn);
      }

      if (mode === 'feedback' && result?.outcome === 'wrong') {
        const actions = qzEl('div', { class: 'vp-quiz-actions' });
        const cont = qzEl('button', { type: 'button', class: 'vp-quiz-btn vp-quiz-btn-primary', 'data-vp-quiz-feedback-continue': '' }, ['Continue']);
        cont.addEventListener('click', () => quizCtrl.continueFeedback());
        actions.appendChild(cont);
        card.appendChild(actions);
      }

      if (mode === 'awaiting-continue') {
        const actions = qzEl('div', { class: 'vp-quiz-actions' });
        const cont = qzEl('button', { type: 'button', class: 'vp-quiz-btn vp-quiz-btn-primary', 'data-vp-quiz-continue': '' }, ['Video fortsetzen']);
        cont.addEventListener('click', () => quizCtrl.continuePlayback());
        actions.appendChild(cont);
        card.appendChild(actions);
      }
    }

    function buildQuizSummary(card) {
      card.appendChild(qzEl('h2', { id: 'vp-quiz-heading', class: 'vp-quiz-heading', tabindex: '-1' }, ['Zusammenfassung']));

      const rows = quizCtrl.summaryRows();
      const total = rows.length;
      const correct = rows.filter((r) => r.result?.outcome === 'correct').length;

      if (quiz.showScore) {
        const pct = total ? Math.round((correct / total) * 100) : 0;
        const scoreWrap = qzEl('div', { class: 'vp-quiz-summary-score' });
        scoreWrap.appendChild(qzEl('div', { class: 'vp-quiz-score-big' }, [`${correct} / ${total}`]));
        scoreWrap.appendChild(qzEl('div', { class: 'vp-quiz-score-sub' }, [`${pct}% richtig beantwortet`]));
        if (quiz.passingPercent != null) {
          const passed = pct >= quiz.passingPercent;
          scoreWrap.appendChild(qzEl('div', { class: 'vp-quiz-pass-badge', 'data-pass': passed ? '1' : '0' }, [passed ? 'Bestanden' : 'Nicht bestanden']));
        }
        card.appendChild(scoreWrap);
      }

      const rowsHost = qzEl('div', { class: 'vp-quiz-summary-rows', 'data-vp-quiz-summary-rows': '' });
      const iconMap = { correct: '✓', wrong: '✕', timeout: '✕', skipped: '–', none: '–' };
      rows.forEach((row) => {
        const outcome = row.result?.outcome || 'none';
        const r = qzEl('div', { class: 'vp-quiz-summary-row', 'data-outcome': outcome });
        r.appendChild(qzEl('span', { class: 'vp-quiz-summary-row-icon', 'aria-hidden': 'true' }, [iconMap[outcome]]));
        r.appendChild(qzEl('span', { class: 'vp-quiz-summary-row-text' }, [row.prompt]));
        rowsHost.appendChild(r);
      });
      card.appendChild(rowsHost);

      const actions = qzEl('div', { class: 'vp-quiz-actions' });
      const closeBtn = qzEl('button', { type: 'button', class: 'vp-quiz-btn vp-quiz-btn-ghost', 'data-vp-quiz-close': '' }, ['Schließen']);
      closeBtn.addEventListener('click', () => quizCtrl.closeSummary());
      const againBtn = qzEl('button', { type: 'button', class: 'vp-quiz-btn vp-quiz-btn-primary', 'data-vp-quiz-restart': '' }, ['Nochmal ansehen']);
      againBtn.addEventListener('click', () => quizCtrl.restart());
      actions.appendChild(closeBtn);
      actions.appendChild(againBtn);
      card.appendChild(actions);
    }

    function quizFocusableEls(card) {
      return Array.from(card.querySelectorAll('button, [tabindex]'))
        .filter((el) => !el.disabled && el.tabIndex > -1);
    }

    function trapQuizTabKey(e) {
      const card = slotQuiz.querySelector('[data-vp-quiz-card]');
      if (!card) return;
      const list = quizFocusableEls(card);
      if (!list.length) { e.preventDefault(); card.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !card.contains(active)) { e.preventDefault(); last.focus(); }
      } else if (active === last || !card.contains(active)) {
        e.preventDefault(); first.focus();
      }
    }

    // Capture-phase so we run before the reskin's own Space/K play-pause
    // handler (attached on `window`, bubble phase) and before the play/pause
    // button's own click handler — mirrors the audioCtrl interception below.
    function onQuizGlobalKeydown(e) {
      if (!quizCtrl.isActive()) return;
      // Don't steal keys from a LearningSuite note/comment field elsewhere on
      // the page — only capture when focus is on a form field INSIDE the quiz
      // card itself (keyboard handling inside the card is unaffected).
      const active = document.activeElement;
      const tag = (active?.tagName || '').toLowerCase();
      const isFormField = tag === 'input' || tag === 'textarea' || tag === 'select' || active?.isContentEditable;
      if (isFormField) {
        const card = slotQuiz.querySelector('[data-vp-quiz-card]');
        if (!card || !card.contains(active)) return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (quizCtrl.mode === 'summary') { e.preventDefault(); quizCtrl.closeSummary(); }
        return;
      }
      if (e.key === 'Tab') { trapQuizTabKey(e); return; }
      // Number keys select an option from anywhere in the active question
      // dialog (not just while focus happens to be inside the options
      // container — e.g. initial focus sits on the heading).
      if (quizCtrl.mode === 'question' && /^[1-4]$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.stopPropagation();
        const card = slotQuiz.querySelector('[data-vp-quiz-card]');
        const btn = card ? card.querySelectorAll('[data-vp-quiz-option]')[Number(e.key) - 1] : null;
        if (btn) { e.preventDefault(); btn.click(); }
        return;
      }
      // Space/Enter must activate a focused quiz radio ourselves: the Space
      // suppression below (needed to stop the underlying player's play/pause
      // shortcut) runs in capture phase and would otherwise swallow the event
      // before the button's own native activation ever fires.
      if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
        if (quizCtrl.mode === 'question' && active && active.matches?.('[data-vp-quiz-option]')) {
          e.preventDefault();
          e.stopPropagation();
          active.click();
          return;
        }
      }
      // General suppression: also preventDefault so Space on the initially
      // focused heading (or anywhere else in the dialog) can't scroll the
      // underlying LMS page in addition to being kept from the player shortcut.
      if (e.key === ' ' || e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    function onQuizGlobalClick(e) {
      if (!quizCtrl.isActive()) return;
      const btn = e.target.closest && e.target.closest('.vp-controls');
      if (btn) { e.preventDefault(); e.stopPropagation(); }
    }
    // Range inputs (seek/volume) update their value on pointerdown-driven drag
    // before any 'click' ever fires, so the click guard above is too late for
    // them — block pointer interaction with the controls bar at pointerdown too.
    function onQuizGlobalPointerDown(e) {
      if (!quizCtrl.isActive()) return;
      const target = e.target.closest && e.target.closest('.vp-controls');
      if (target) { e.preventDefault(); e.stopPropagation(); }
    }
    document.addEventListener('keydown', onQuizGlobalKeydown, true);
    document.addEventListener('click', onQuizGlobalClick, true);
    document.addEventListener('pointerdown', onQuizGlobalPointerDown, true);
    onCleanup(() => document.removeEventListener('keydown', onQuizGlobalKeydown, true));
    onCleanup(() => document.removeEventListener('click', onQuizGlobalClick, true));
    onCleanup(() => document.removeEventListener('pointerdown', onQuizGlobalPointerDown, true));

    function renderQuiz() {
      if (!quizCtrl.isActive()) return;
      slotQuiz.innerHTML = '';
      slotQuiz.dataset.mode = quizCtrl.mode;

      const scrim = qzEl('div', { class: 'vp-quiz-scrim vp-quiz-anim-scrim', 'data-vp-quiz-scrim': '' });
      const card = qzEl('div', {
        class: 'vp-quiz-card vp-quiz-anim-card',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'vp-quiz-heading',
        tabindex: '-1',
        'data-vp-quiz-card': '',
        'data-vp-quiz-mode': quizCtrl.mode,
      });
      scrim.appendChild(card);
      slotQuiz.appendChild(scrim);

      let focusTarget = null;
      if (quizCtrl.mode === 'summary') {
        buildQuizSummary(card);
        focusTarget = card.querySelector('#vp-quiz-heading');
      } else {
        const question = quizCtrl.currentQuestion();
        if (!question) { clearQuiz(); return; }
        buildQuizQuestion(card, question);
        if (quizCtrl.mode === 'question') focusTarget = card.querySelector('#vp-quiz-heading');
        else if (quizCtrl.mode === 'feedback') focusTarget = card.querySelector('[data-vp-quiz-feedback-continue]');
        else if (quizCtrl.mode === 'awaiting-continue') focusTarget = card.querySelector('[data-vp-quiz-continue]');
      }

      if (focusTarget) {
        requestAnimationFrame(() => { try { focusTarget.focus(); } catch {} });
      }
    }

    function updateQuizCountdown() {
      if (quizCtrl.mode !== 'question') return;
      const wrap = slotQuiz.querySelector('[data-vp-quiz-countdown]');
      if (!wrap) return;
      const question = quizCtrl.currentQuestion();
      if (!question?.timeoutSec) return;
      const remaining = Math.max(0, quizCtrl.remainingSec ?? 0);
      const pct = Math.max(0, Math.min(1, remaining / question.timeoutSec));
      const warn = remaining <= 5;
      const svg  = wrap.querySelector('[data-vp-quiz-ring]');
      const fill = wrap.querySelector('[data-vp-quiz-ring-fill]');
      const num  = wrap.querySelector('[data-vp-quiz-countdown-num]');
      if (svg && fill) {
        const circ = Number(svg.dataset.circ || 0);
        fill.setAttribute('stroke-dashoffset', String(circ * (1 - pct)));
      }
      wrap.dataset.warn = warn ? '1' : '0';
      if (num) num.textContent = String(Math.ceil(remaining));
    }

    function clearQuiz() {
      slotQuiz.innerHTML = '';
      slotQuiz.dataset.mode = '';
      if (!playerHost.hasAttribute('tabindex')) playerHost.setAttribute('tabindex', '-1');
      try { playerHost.focus(); } catch {}
    }

    // ─────────── AUDIO OVERLAY (lower-third banner — driven by audioCtrl) ───────────
    function renderAudio() {
      if (!showAudio) return false;
      if (!audioCtrl.isActive()) {
        if (slotLowerThird.dataset.kind === 'audio') { slotLowerThird.innerHTML = ''; slotLowerThird.dataset.kind = ''; slotLowerThird.dataset.activeAudio = ''; }
        return false;
      }
      const active = audioCtrl.active;
      const elapsed = audioCtrl.audioTime;
      const pct = Math.min(100, (elapsed / active.dur) * 100);
      const isPlaying = audioCtrl.state === 'playing';
      if (slotLowerThird.dataset.activeAudio === active.id) {
        const fill = slotLowerThird.querySelector('[data-fill]');
        const tEl  = slotLowerThird.querySelector('[data-elapsed]');
        const pp   = slotLowerThird.querySelector('[data-action="audio-playpause"]');
        if (fill) fill.style.width = pct + '%';
        if (tEl)  tEl.textContent = fmt(elapsed);
        if (pp)   pp.textContent = isPlaying ? '⏸' : '▶';
        return true;
      }
      slotLowerThird.dataset.kind = 'audio';
      slotLowerThird.dataset.activeAudio = active.id;
      slotLowerThird.innerHTML = `
        <div class="vp-anim-bottom" style="display:flex; align-items:center; gap:14px; background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92)); border:1px solid rgba(0,225,165,.38); border-radius:14px; padding:10px 14px; backdrop-filter:blur(10px); box-shadow:0 14px 32px rgba(0,0,0,.35); color:#f4f7f6; pointer-events:auto;">
          <div style="position:relative;flex-shrink:0">
            <div style="width:40px;height:40px;border-radius:50%;background:#00e1a5;border:2px solid #62dfc1;display:flex;align-items:center;justify-content:center;font:700 14px system-ui;color:#062b22">FH</div>
            <div style="position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;border:2px solid #323333;background:#00e1a5;display:flex;align-items:center;justify-content:center;font-size:9px">🎙️</div>
          </div>
          <div style="flex:0 0 auto; min-width:0; max-width:35%;">
            <div style="font:700 13.5px system-ui;color:#f4f7f6; overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${active.title}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:1px">
              <span style="font:500 11px system-ui;color:rgba(168,191,186,.8); overflow:hidden;text-overflow:ellipsis;white-space:nowrap">by ${active.voice}</span>
              <span style="width:4px;height:4px;border-radius:50%;background:#00e1a5" class="vp-pulse"></span>
              <span style="font:500 10.5px system-ui;color:rgba(168,191,186,.62);text-transform:uppercase;letter-spacing:.4px">${isPlaying ? 'Playing' : 'Paused'}</span>
            </div>
          </div>
          <div style="flex:1; display:flex; align-items:center; gap:10px; min-width:0;">
            <span data-elapsed style="font:500 11px ui-monospace,monospace;color:rgba(168,191,186,.8);min-width:36px">${fmt(elapsed)}</span>
            <div style="flex:1;height:6px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden">
              <div data-fill style="width:${pct}%; height:100%; background:linear-gradient(90deg,#00e1a5,#2edbb1,#62dfc1); transition:width .15s linear;"></div>
            </div>
            <span style="font:500 11px ui-monospace,monospace;color:rgba(168,191,186,.8);min-width:36px;text-align:right">${fmt(active.dur)}</span>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button data-action="audio-back" title="-10s" style="background:rgba(22,79,73,.72);color:#f4f7f6;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">−10s</button>
            <button data-action="audio-playpause" title="Play/Pause" style="background:#00e1a5;color:#062b22;border:0;border-radius:8px;padding:7px 12px;font:500 13px system-ui;cursor:pointer;min-width:36px">${isPlaying ? '⏸' : '▶'}</button>
            <button data-action="audio-fwd" title="+10s" style="background:rgba(22,79,73,.72);color:#f4f7f6;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">+10s</button>
            <button data-action="audio-skip" title="Skip" style="background:rgba(22,79,73,.72);color:#f4f7f6;border:0;border-radius:8px;padding:7px 10px;font:500 12px system-ui;cursor:pointer">⏭</button>
          </div>
        </div>`;
      // Wire button actions
      const stop = (e) => e.stopPropagation();
      slotLowerThird.querySelector('[data-action="audio-back"]').onclick = (e) => { stop(e); audioCtrl.seekRel(-10); };
      slotLowerThird.querySelector('[data-action="audio-fwd"]').onclick  = (e) => { stop(e); audioCtrl.seekRel(+10); };
      slotLowerThird.querySelector('[data-action="audio-playpause"]').onclick = (e) => { stop(e); audioCtrl.togglePlay(); };
      slotLowerThird.querySelector('[data-action="audio-skip"]').onclick = (e) => { stop(e); audioCtrl.skip(); };
      return true;
    }

    // ─────────── META STEP FLY-IN (bottom-right lower-third pill, dynamic width) ───────────
    function renderMetaStep(t) {
      if (!showMetaTab) return;
      const active = metaSteps.find(m => t >= m.t && t < m.t + 5);
      if (!active) { if (slotBR.dataset.kind === 'meta') { slotBR.innerHTML = ''; slotBR.dataset.kind = ''; } return; }
      if (slotBR.dataset.activeMeta === active.id) return;
      slotBR.dataset.kind = 'meta';
      slotBR.dataset.activeMeta = active.id;
      slotBR.innerHTML = `
        <div data-overlay-action="meta" class="vp-anim-right" style="display:inline-flex; align-items:center; gap:10px; background:linear-gradient(135deg, rgba(50,51,51,.94), rgba(22,79,73,.92)); border:1px solid rgba(0,225,165,.38); border-radius:999px; padding:5px 14px 5px 5px; backdrop-filter:blur(10px); box-shadow:0 12px 28px rgba(0,0,0,.30); color:#f4f7f6; pointer-events:auto; white-space:nowrap; cursor:pointer;" title="Open Meta Structure">
          <div style="width:28px; height:28px; border-radius:50%; background:#00e1a5; color:#062b22; display:flex; align-items:center; justify-content:center; font:700 13px system-ui; flex-shrink:0">${active.n}</div>
          <span style="font:600 10.5px system-ui; letter-spacing:.5px; text-transform:uppercase; color:rgba(168,191,186,.82)">Step ${active.n} / ${metaSteps.length}</span>
          <span style="width:1px; height:14px; background:rgba(0,225,165,.28)"></span>
          <span style="font:600 13px system-ui; color:#f4f7f6; line-height:1">${active.title}</span>
        </div>`;
      slotBR.querySelector('[data-overlay-action="meta"]').onclick = (e) => { e.stopPropagation(); window.__vpSidebarTab?.('meta'); };
    }

    // ─────────── SIDEBAR (Coaching / Science / Meta Structure) ───────────
    // Tabs are built dynamically from whichever categories actually have
    // content; the first available tab is selected by default.
    let sidebar = null;
    const panelEls = {};
    if (showSidebar) {
      const tabDefs = [];
      if (showCoachingTab) tabDefs.push({ key: 'coaching', label: 'Coaching' });
      if (showScienceTab) tabDefs.push({ key: 'science', label: 'Science' });
      if (showMetaTab) tabDefs.push({ key: 'meta', label: 'Meta Structure' });

      sidebar = document.createElement('aside');
      sidebar.id = 'vp-demo-sidebar';
      sidebar.style.cssText = `width:380px; flex-shrink:0; background:${T.card}; color:${T.fg}; color-scheme:dark; border-radius:14px; box-shadow:0 8px 24px rgba(0,0,0,.24); font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif; border:1px solid ${T.border}; display:flex; flex-direction:column; overflow:hidden; align-self:flex-start; position:sticky; top:16px; max-height:calc(100vh - 32px);`;
      sidebar.innerHTML = `
        <div style="padding:12px 14px 0">
          <div data-tabbar style="display:flex;gap:4px;background:${T.muted};padding:4px;border-radius:10px;"></div>
        </div>
        <div id="vp-panels" style="flex:1;overflow:auto;min-height:0;padding:14px" data-panels></div>
      `;
      const tabbar = sidebar.querySelector('[data-tabbar]');
      const panelsHost = sidebar.querySelector('[data-panels]');
      tabDefs.forEach(({ key, label }) => {
        const btn = document.createElement('button');
        btn.dataset.tab = key;
        btn.className = 'vp-tab';
        btn.textContent = label;
        btn.style.cssText = 'flex:1;padding:7px 10px;border:0;border-radius:7px;cursor:pointer;';
        tabbar.appendChild(btn);

        const panel = document.createElement('div');
        panel.dataset.panel = key;
        panelsHost.appendChild(panel);
        panelEls[key] = panel;
      });

      const setTab = (name) => {
        const target = tabDefs.some(t => t.key === name) ? name : tabDefs[0]?.key;
        if (!target) return;
        sidebar.querySelectorAll('.vp-tab').forEach(b => {
          const active = b.dataset.tab === target;
          b.style.background = active ? T.card : 'transparent';
          b.style.color = active ? T.fg : T.mutedFg;
          b.style.fontWeight = active ? '600' : '500';
          b.style.boxShadow = active ? '0 1px 3px rgba(0,0,0,.28)' : 'none';
          b.style.font = (active ? '600' : '500') + ' 13px system-ui';
        });
        Object.entries(panelEls).forEach(([k, p]) => { p.style.display = (k === target) ? '' : 'none'; });
      };
      window.__vpSidebarTab = setTab;
      onCleanup(() => { delete window.__vpSidebarTab; });
      sidebar.querySelectorAll('.vp-tab').forEach(btn => { btn.onclick = () => setTab(btn.dataset.tab); });
      setTab(tabDefs[0].key);

      if (!tryFlexSibling(sidebar, onCleanup)) applyFixedRightRail(sidebar, onCleanup);
      onCleanup(() => { sidebar.remove(); });
    }

    // Coaching panel — phase accordion
    function renderCoaching() {
      if (!showCoachingTab) return;
      const coachingPanel = panelEls.coaching;
      coachingPanel.innerHTML = phases.map((p, i) => {
        const open   = p.id === window.__vpExpandedPhase;
        const active = p.id === window.__vpActivePhase;
        const dur = Math.round((p.endTimeSec - p.startTimeSec) / 60) || 1;
        return `
          <div style="margin-bottom:10px;border:2px solid ${active ? T.primary : T.border};background:${T.card};border-radius:${T.radius};overflow:hidden;${active ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ''}transition:all .2s">
            <button data-phase-toggle="${p.id}" style="width:100%;text-align:left;background:none;border:0;padding:12px;cursor:pointer;display:flex;gap:12px;align-items:flex-start">
              <div style="flex-shrink:0;width:36px;height:36px;border-radius:8px;background:${active ? T.primary : T.muted};color:${active ? T.primaryFg : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px">${i+1}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <h3 style="margin:0;font:600 14.5px system-ui;color:${active ? T.primary : T.fg}">${p.title}</h3>
                  <span data-seek="${p.startTimeSec}" style="font:500 11px ui-monospace,monospace;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:6px;border:1px solid ${T.border};cursor:pointer">${fmt(p.startTimeSec)}</span>
                </div>
                <p style="margin:6px 0 0;color:${T.mutedFg};font-size:13px;line-height:1.5;${open ? '' : 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden'}">${p.description}</p>
                ${!open ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
                  <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">${p.interventions.length} interventions</span>
                  <span style="font:500 11px ui-monospace,monospace;background:transparent;color:${T.mutedFg};padding:2px 8px;border-radius:999px;border:1px solid ${T.border}">⏱ ${dur}m</span>
                </div>` : ''}
              </div>
            </button>
            ${open ? `<div style="padding:0 12px 12px">
              <div style="border-top:1px solid ${T.border};padding-top:12px">
                <div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:8px">Interventions</div>
                <div style="display:grid;gap:6px">
                  ${p.interventions.map(iv => {
                    const ivActive = iv.id === window.__vpActiveIntervention;
                    return `<div data-seek="${iv.t}" style="padding:9px 11px;border-radius:8px;background:${ivActive ? T.primarySoft : T.muted};border:1px solid ${ivActive ? T.primaryRing : T.border};cursor:pointer">
                      <div style="display:flex;gap:8px;align-items:baseline">
                        <span style="font:700 11.5px ui-monospace,monospace;color:${ivActive ? T.primary : T.mutedFg};min-width:28px">${iv.label}</span>
                        <strong style="flex:1;font:600 13px system-ui;color:${T.fg}">${iv.title}</strong>
                        <span style="font:500 11px ui-monospace,monospace;color:${T.mutedFg}">${fmt(iv.t)}</span>
                      </div>
                      <div style="margin:4px 0 0 36px;color:${T.mutedFg};font-size:12.5px">${iv.desc}</div>
                    </div>`;
                  }).join('')}
                </div>
              </div>
            </div>` : ''}
          </div>`;
      }).join('');

      coachingPanel.querySelectorAll('[data-phase-toggle]').forEach(btn => {
        btn.onclick = (e) => {
          const seekEl = e.target.closest('[data-seek]');
          if (seekEl) { e.stopPropagation(); window.player.seek(+seekEl.dataset.seek + 0.1); return; }
          const id = btn.dataset.phaseToggle;
          window.__vpExpandedPhase = (window.__vpExpandedPhase === id) ? null : id;
          renderCoaching();
        };
      });
      coachingPanel.querySelectorAll('[data-seek]').forEach(el => { el.onclick = (e) => { e.stopPropagation(); window.player.seek(+el.dataset.seek + 0.1); }; });
    }

    // Science panel
    function renderSciencePanel() {
      if (!showScienceTab) return;
      const sciencePanel = panelEls.science;
      sciencePanel.innerHTML = `<div style="display:grid;gap:8px">
        ${sciences.map(s => {
          const hl = window.__vpHighlightedScience === s.id;
          return `<div data-sci-card="${s.id}" style="border:1px solid ${hl ? T.primary : T.border};border-radius:${T.radius};padding:12px;background:${T.card};${hl ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ''}transition:all .2s">
            <div style="display:flex;align-items:baseline;gap:8px">
              <h3 style="margin:0;font:600 14px system-ui;color:${hl ? T.primary : T.fg};flex:1">${s.name}</h3>
              <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:999px">${s.timestampsSec.length} mentions</span>
            </div>
            <p style="margin:6px 0 0;color:${T.mutedFg};font-size:13px;line-height:1.5">${s.description}</p>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
              ${s.timestampsSec.map(t => `<span data-seek="${t}" style="font:500 11.5px ui-monospace,monospace;color:${T.primary};background:${T.primarySoft};padding:3px 8px;border-radius:6px;border:1px solid ${T.primaryRing};cursor:pointer">${fmt(t)}</span>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
      sciencePanel.querySelectorAll('[data-seek]').forEach(el => { el.onclick = () => window.player.seek(+el.dataset.seek + 0.1); });
    }
    function renderScienceHighlight() {
      if (!showScienceTab) return;
      renderSciencePanel();
      const id = window.__vpHighlightedScience;
      if (!id) return;
      const card = panelEls.science.querySelector(`[data-sci-card="${id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Meta Structure panel
    function renderMeta() {
      if (!showMetaTab) return;
      const metaPanel = panelEls.meta;
      metaPanel.innerHTML = `<div style="font:600 11px system-ui;letter-spacing:.6px;text-transform:uppercase;color:${T.mutedFg};margin-bottom:10px">${metaSteps.length} Master Steps</div>
        <ol style="list-style:none;padding:0;margin:0;display:grid;gap:6px">
          ${metaSteps.map(m => {
            const active = window.__vpActiveMeta === m.id;
            return `<li data-seek="${m.t}" style="padding:10px 11px;border-radius:${T.radius};background:${active ? T.primarySoft : T.card};border:1px solid ${active ? T.primaryRing : T.border};cursor:pointer;display:flex;gap:10px;align-items:flex-start">
              <div style="flex-shrink:0;width:28px;height:28px;border-radius:7px;background:${active ? T.primary : T.muted};color:${active ? T.primaryFg : T.mutedFg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${m.n}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;gap:8px;align-items:baseline">
                  <strong style="font:600 13.5px system-ui;color:${T.fg};flex:1">${m.title}</strong>
                  <span style="font:500 11px ui-monospace,monospace;color:${T.mutedFg}">${fmt(m.t)}</span>
                </div>
              </div>
            </li>`;
          }).join('')}
        </ol>`;
      metaPanel.querySelectorAll('[data-seek]').forEach(el => { el.onclick = () => window.player.seek(+el.dataset.seek + 0.1); });
    }

    if (showCoachingTab) { window.__vpExpandedPhase = phases[0]?.id ?? null; renderCoaching(); }
    if (showScienceTab) renderSciencePanel();
    if (showMetaTab) renderMeta();

    onCleanup(() => {
      delete window.__vpExpandedPhase;
      delete window.__vpActivePhase;
      delete window.__vpActiveIntervention;
      delete window.__vpActiveMeta;
      delete window.__vpHighlightedScience;
    });

    // ─────────── TIME SYNC: drives every overlay + sidebar highlight ───────────
    function recomputeActive(t) {
      const phase = phases.find(p => t >= p.startTimeSec && t < p.endTimeSec) || null;
      let intervention = null;
      if (phase) for (const iv of [...phase.interventions].sort((a,b) => a.t - b.t)) if (t >= iv.t) intervention = iv.id;
      let meta = null;
      for (const m of metaSteps) if (t >= m.t) meta = m.id;

      const phaseChanged = window.__vpActivePhase !== phase?.id;
      window.__vpActivePhase = phase?.id ?? null;
      window.__vpActiveIntervention = intervention;
      window.__vpActiveMeta = meta;
      if (phaseChanged && phase) window.__vpExpandedPhase = phase.id;

      renderCoaching();
      renderMeta();
      renderSection();

      // Quiz breaks have priority over passive overlays and audio.
      quizCtrl.onTime(t);
      if (!quizCtrl.isActive()) maybeTriggerAudio(t);
      if (quizCtrl.isActive()) {
        if (slotBR && slotBR.dataset.kind === 'meta') { slotBR.innerHTML = ''; slotBR.dataset.kind = ''; slotBR.dataset.activeMeta = ''; }
        if (slotTR && slotTR.dataset.activeSci) { slotTR.innerHTML = ''; slotTR.dataset.activeSci = ''; }
      } else if (showAudio && audioCtrl.isActive()) {
        renderAudio();
        // Hide meta-step pill while audio is active.
        if (slotBR && slotBR.dataset.kind === 'meta') { slotBR.innerHTML = ''; slotBR.dataset.kind = ''; slotBR.dataset.activeMeta = ''; }
        renderScience(t);
      } else {
        renderMetaStep(t);
        renderScience(t);
      }
    }

    // Replace any existing player.setOverlays usage — we drive overlays directly now
    window.player.setOverlays([]);
    const offBus = window.player.on('any', (e) => {
      if (mountState.disposed) return;
      if (e.type === 'play') quizCtrl.videoEnded = false;
      if (e.type === 'time' || e.type === 'overlay-show' || e.type === 'overlay-hide' || e.type === 'play' || e.type === 'pause') {
        recomputeActive(e.time ?? window.player.current ?? 0);
      }
      if (e.type === 'ended') quizCtrl.onEnded();
    });
    if (typeof offBus === 'function') onCleanup(offBus);
    recomputeActive(window.player.current ?? 0);

    // React sometimes strips DOM we appended to the player host on its next
    // reconciliation pass even though the config/video context is unchanged.
    // The debounced observer calls this each tick to decide whether to remount.
    mountState.checkAlive = () => {
      if (!playerHost.isConnected) return false;
      if (window.player !== mountedPlayer) return false;
      if (document.querySelector('hls-video') !== mountedVideoEl) return false;
      if (showSidebar && (!sidebar || !sidebar.isConnected)) return false;
      if (showSectionOverlay && (!slotTL || !slotTL.isConnected)) return false;
      if (showScienceTab && (!slotTR || !slotTR.isConnected)) return false;
      if (showMetaTab && (!slotBR || !slotBR.isConnected)) return false;
      if (showAudio && (!slotLowerThird || !slotLowerThird.isConnected)) return false;
      if (showQuiz && (!slotQuiz || !slotQuiz.isConnected)) return false;
      return true;
    };

    console.info('[vp] demo overlays mounted');
  }

  // ─────────── PERMANENT WATCHERS ───────────
  // Debounced so React's chatty re-renders don't trigger a full re-evaluation
  // on every single mutation.
  let scanPending = 0;
  function scheduleScan() {
    if (scanPending) return;
    scanPending = setTimeout(() => { scanPending = 0; evaluate(); }, 200);
  }
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body || document.documentElement, { subtree: true, childList: true, characterData: true });
  window.__vpDemoCleanup.push(() => { observer.disconnect(); if (scanPending) clearTimeout(scanPending); teardownMount(); });

  let popTimeout = 0;
  const popHandler = () => {
    if (popTimeout) clearTimeout(popTimeout);
    popTimeout = setTimeout(() => { popTimeout = 0; scheduleScan(); }, 50);
  };
  window.addEventListener('popstate', popHandler);
  window.__vpDemoCleanup.push(() => {
    window.removeEventListener('popstate', popHandler);
    if (popTimeout) clearTimeout(popTimeout);
  });

  evaluate();
  return 'demo overlay controller active';
})();
