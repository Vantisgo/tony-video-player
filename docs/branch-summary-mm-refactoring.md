# Zusammenfassung: `feature/mm-refactoring`

> Stand: 2026-07-28 · Basis: `main` · 24 Commits · 87 Dateien, ~14.400 Zeilen hinzugefügt
> (2 gelöscht) · ~120 Unit-Tests neu

## Worum es geht

Der Branch baut eine **Runtime-Erweiterung für LearningSuite-Videos**: drei
JavaScript-Dateien werden in die fremde LearningSuite-Seite injiziert und legen
eigene Player-Controls, Overlays, eine Sidebar und Mehrsprachigkeit über das
dort gehostete Video — **ohne** den bestehenden Player zu ersetzen.

**Warum dieser Ansatz:** Die Analyse (`docs/learningsuite-enrichment-research.md`)
hat ergeben, dass LearningSuite Mux' `<hls-video>`-Webcomponent (hls.js, Bunny CDN,
kein DRM) verwendet. Das Element spiegelt die `HTMLMediaElement`-API und feuert
Standard-Media-Events, auf die die React-App der Plattform ihr **Fortschritts-Tracking**
stützt. Ein vollständiges Hijacking würde dieses Tracking zerstören — ein
"Re-Skin" (native Chrome ausblenden, eigene Controls auf dasselbe Media-Element
setzen) erhält es. Das ist die zentrale Architekturentscheidung des Branches.

Der Branch ist von einem Spike zu einem produktionsnah gehärteten Artefakt
gewachsen. Grob in vier Phasen:

1. **Spike** — POC von Re-Skin, Overlays, Authoring-UX
2. **Betrieb** — Hosting auf Vercel, Cross-Origin-Auslieferung, SPA-Robustheit
3. **Refactoring** — TypeScript-Quellen + esbuild-Build + Tests + CI
4. **Härtung** — Security, Resilienz, Kill-Switch/Telemetrie, Performance, echtes Audio

---

## Die drei Runtime-Skripte

| Skript             | Aufgabe                                                                                | Aktivierungs-Gate                            |
| ------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| `reskin-player.js` | Native Mux/Vidstack-UI verstecken, eigene Controls, `window.player`-API, Sprach-Tracks | `[data-vp-config]` im DOM vorhanden          |
| `demo-overlays.js` | Section-Indicator, Science Corner, Audio-Lower-Third, 7 Master Steps, Sidebar          | `<pre data-vp-config>` **und** Player im DOM |
| `admin-toggle.js`  | Editor-Banner mit kopierbarem LLM-Prompt + JSON-Schema für Autor:innen                 | `/admin/editor/`-URL ohne `?view=preview`    |

Alle drei sind eigenständige **klassische IIFEs**, per `<script src>` cross-origin
ladbar, mehrfach injizierbar und selbst-gated (auf Seiten ohne Config passiert
nichts).

---

## 1 · Spike-Phase: Re-Skin, Overlays, Authoring

**Re-Skin-Runtime** (`reskin-player`): versteckt die Vidstack/Mux-UI, mountet eigene
Controls, exponiert eine `window.player`-API plus Event-Bus und übersteht React-
Re-Renders sowie SPA-Navigation.

**Demo-Overlays**: Inhalte/UI in der Design-Sprache dieses Repos (Coaching/Science/
Meta-Structure-Tabs, Orange als Primärfarbe, MUI-Light-Card). Section-Indicator
oben links, Science-Corner-Pill oben rechts, Audio-Banner als Lower-Third mit
Voice-Over und Pause/Resume-Zustandsautomat, 7-Master-Steps-Fly-in. Die Sidebar
ersetzt die rechte Spalte von LearningSuite; Klick auf Science-/Meta-Pills
fokussiert den passenden Sidebar-Tab.

**Authoring-Workflow** (`admin-toggle`): Statt eines eigenen Backends bekommen
Autor:innen im LearningSuite-Editor über jedem Video ein Banner, das einen Dialog
mit kopierbarem LLM-Prompt und JSON-Schema öffnet. Die fertige JSON-Config wird als
`<pre data-vp-config>` in einen LearningSuite-Embed-Block gepastet.
**Begründung:** kein zusätzlicher Datenspeicher, keine Sync-Probleme — die Config
liegt beim Content, wo sie inhaltlich hingehört.

### Gelernte Lektionen aus dem Spike (jeweils mit Fix)

- **Self-Cleanup-Registry** (`window.__vp{Admin,Reskin,Demo}Cleanup`): wird bei
  Re-Injection geleert. _Warum:_ Ohne das stapelten sich bei jedem erneuten Laden
  Listener, Observer und DOM-Knoten.
- **`history.pushState`/`replaceState`-Patches entfernt.** _Warum:_ Sie verschachtelten
  sich bei jeder Injection ineinander.
- **Attribut-MutationObserver auf `body` + Subtree entfernt**, MutationObserver auf
  250 ms entprellt. _Warum:_ Die sehr gesprächigen React-State-Änderungen von
  LearningSuite haben den Renderer damit auf 100 % CPU gezogen.
- **Section-Indicator mit stabilem DOM** statt `innerHTML`-Neuaufbau bei Time-Events,
  Hover-State per CSS, `white-space`-Override gegen das geerbte `pre-wrap` von
  LearningSuite.
- **Dual-Mount-Sidebar**: zur Laufzeit wird zwischen "Flex-Sibling von `<main>`" und
  einer fixierten rechten Leiste entschieden; landet die erste Strategie nicht im
  Viewport, werden die Layout-Änderungen zurückgerollt.

---

## 2 · Betriebsphase: Hosting und SPA-Robustheit

**Skripte nach `public/runtime/`** verschoben (vorher `scripts/`), damit Next.js sie
als statische Assets unter `/runtime/<name>.js` ausliefert.

**Cross-Origin-Header** in `next.config.ts` für `/runtime/:path*`
(`Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin`).
_Warum:_ Die Skripte und ihre Assets werden von der LearningSuite-Origin aus geladen.

**Vercel Deployment Protection:** Der Query-Parameter `?x-vercel-protection-bypass=…`
autorisiert jeden Request einzeln — das ursprünglich zusätzlich gesetzte
`x-vercel-set-bypass-cookie` wurde entfernt. _Warum:_ Vercel setzt das Bypass-Cookie
als `SameSite=Lax`; bei cross-origin Subresource-Requests wird es nicht mitgesendet,
das Redirect-Ziel antwortet mit 401 und der `<script>`-Tag feuert `onerror`.
Ergänzend wird der Bypass-Parameter auf same-origin Asset-Fetches weitergegeben
(`FORWARDED_QUERY_PARAMS`, nur dieser eine Parameter — damit keine fremden Params
auf Subresource-Requests durchsickern).

### React-/SPA-Timing (vier aufeinander aufbauende Fixes)

Diese Klasse von Fehlern hat den meisten Debugging-Aufwand gekostet und ist
dokumentiert, weil sie bei jeder Änderung am Mount-Pfad wieder auftreten kann:

1. **Auf `<pre data-vp-config>` warten statt früh aussteigen.** LearningSuite rendert
   Embed-Block-Inhalte per React _nach_ dem Parsen der `<head>`-Skripte. `defer` half
   nicht: `loadVpConfig()` lief zu früh, bekam `null` und brach ab — Sidebar und
   Overlays mounteten nie. Jetzt: MutationObserver auf den Body-Subtree, Retry bei
   jeder Mutation, `setup()` genau einmal.
2. **30-s-Timeout des Watchers entfernt.** Admins wechseln minutenlang zwischen Editor
   und Vorschau; das Timeout konnte den Watcher abschalten, bevor das `<pre>` je
   gemountet war. Ohne Timeout ist der Kostenpunkt klein: pro Body-Mutation nur ein
   günstiger `loadVpConfig()`-Aufruf, und der Watcher trennt sich nach dem ersten
   Treffer selbst.
3. **`applySetup` per doppeltem `requestAnimationFrame` verzögern.** Synchron aus dem
   MutationObserver-Callback aufgerufen, wurden unsere Slot-DIVs angehängt, während
   React noch mitten in der Reconciliation war — der nächste Render verwarf alle
   Kinder, die React nicht kannte. Konkret überlebte `slotTL`, aber `slotTR`/`BR`/`LT`
   verschwanden, obwohl `window.__vpConfig` gesetzt war. Zwei rAF sind die
   Standard-Redewendung für "warte auf React": danach ist der Render committed und
   folgende Reconciliations behandeln unsere DIVs als opake Geschwister.
4. **Watcher wartet auf `<pre>` **und** Player.** Beide werden in unterschiedlichen
   Render-Pässen gemountet; mit nur dem `<pre>` als Gate lief `applySetup` und meldete
   "no player host". Neues Gate: `readyContext()`.

**`admin-toggle` reagiert auf den SPA-Toggle Editor↔Vorschau**, nicht nur auf die
Initial-URL. LearningSuite wechselt per `pushState` zwischen `…/page` und
`…/page?view=preview` ohne Reload. Vorher: Banner mountete nie, wenn man in der
Vorschau startete — bzw. blieb in der Vorschau sichtbar, wenn man im Editor startete.
Jetzt steuert `applyMode()` den Zustand (`isEditMode() ? scan() : teardownBanners()`),
aufgerufen beim Start, bei jeder Body-Mutation, bei `popstate` und über ein 600-ms-
URL-Polling (`pushState` feuert kein `popstate`).

---

## 3 · Refactoring: TypeScript-Quellen + Build + Tests

Das größte strukturelle Change des Branches: Aus drei handgeschriebenen IIFE-Dateien
wurden **TypeScript-Module unter `runtime-src/`**, gebündelt von esbuild zu je einem
klassischen IIFE in `public/runtime/`.

```
runtime-src/
  common/          geteilter Code: attachments, beacon, bus, cleanup, config, dom,
                   escape, format, killswitch, origins, player, runtime-url,
                   tracks, types
  reskin-player/   index.ts, language-pack.ts, styles.ts
  demo-overlays/   index.ts, data.ts, styles.ts
  admin-toggle/    index.ts, prompt.ts, styles.ts
  tests/           gespiegelte Testordner
```

**Begründung:** Das ausgelieferte Artefakt und das Lademodell bleiben _unverändert_
(ein `<script src>` pro Entry, cross-origin ladbar, re-injizierbar, self-gating) —
nur die Quelle wird vom Output entkoppelt. Damit werden geteilter `common/`-Code,
Typen und Unit-Tests überhaupt erst möglich.

Entscheidungen und Randbedingungen:

- **Generierte `.js` sind eingecheckt**, CI prüft auf Drift
  (`git diff --exit-code -- public/runtime` in `.github/workflows/runtime.yml`:
  build → drift → typecheck → test). _Warum eingecheckt:_ Die Skripte werden direkt
  aus `public/` ausgeliefert; ohne Commit gäbe es keine deploybare Version.
  `.prettierignore` nimmt die Bundles aus, damit der `pretty-quick`-Pre-Commit-Hook
  nicht gegen den Drift-Check arbeitet.
- **Output unminifiziert, Target es2019**, Source-Maps extern und gitignored.
  _Warum unminifiziert:_ Debuggability in einer fremden Seite.
- **Kein Schema-Framework im Runtime-Bundle.** zod hätte ~50 KB in das injizierte
  Skript inlined. `parseVpConfig` bleibt tolerant; strenge Validierung gehört in den
  serverseitigen Content-Service.
- **Gotcha:** esbuild-IIFEs sind ES-Module → kein Top-Level-`return`. Jeder Entry
  kapselt seine Logik in `main()` und schreibt den Status nach `window.__vp*Status`.
- **Bewusste Abweichung:** Die eng gekoppelte Renderer-/Attach-Logik blieb als
  verschachtelte Funktionen in `index.ts` (ausgelagert wurden nur `styles`,
  `language-pack`, `data`, `prompt`) — Verhaltens-Parität ging vor maximaler
  Datei-Aufteilung.

**Test-Setup:** Vitest + happy-dom (`vitest.config.ts`, Include:
`runtime-src/**/*.test.ts` und `app/**/*.test.ts`), ~120 Tests. Neue npm-Scripts:
`build:runtime`, `watch:runtime`, `typecheck:runtime`, `test`, sowie `predev`/`prebuild`,
die die Bundles automatisch bauen.

> **Verbindliche Regel daraus:** `runtime-src/` editieren, **nie** `public/runtime/*.js`.

---

## 4 · Sicherheit

- **Die `[data-vp-config]`-JSON ist untrusted Input** — sie wird von Kursautor:innen
  geschrieben (später von einem Content-Endpoint). Jeder config-abgeleitete Wert, der
  nach `innerHTML` geht, läuft durch `esc()`; IDs in Selektoren durch `CSS.escape`.
  _Warum an der Interpolationsstelle escapen_ statt auf DOM-Konstruktion umzuschreiben:
  chirurgisch und verhaltenserhaltend — das größere Rendering-Refactoring (Preact/JSX,
  das die XSS-Klasse strukturell entfernt) ist als Folgearbeit vorgesehen.
- **`window.__vpTrustedOrigins`** ist die _einzige_ Opt-in-Liste für Cross-Origin-
  Vertrauen und deckt sowohl den `postMessage`-Origin-Check als auch die Asset-Origins
  der Language-Packs ab (`common/origins.ts`). Default: nur same-origin. Ausgehende
  Player-Events zielen auf eine konkrete Iframe-Origin, **nie** auf `'*'`.
- **Allowlist der weitergegebenen Query-Parameter** (siehe oben) und
  Finite-Time-Guard beim postMessage-Handshake.

---

## 5 · Resilienz: die Runtime darf den Player nie kaputtmachen

Grundgedanke: Wir injizieren in eine SaaS-Seite, die wir nicht kontrollieren. Ändert
LearningSuite sein HTML, ist der schlimmste denkbare Ausgang nicht "unsere Overlays
fehlen", sondern "das Video hat gar keine Controls mehr". Drei Pläne adressieren das.

### Adaptierbarkeit — zentrale Player-Discovery

`runtime-src/common/player.ts` (`scanPlayers` / `findPlayers` / `resolveHost`) ersetzt
den hartcodierten `hls-video`-Selektor. Suchreihenfolge:

1. `[data-vp-player]`-Contract (der langlebige, strukturunabhängige Haken)
2. bekannte Tags (`hls-video`, `mux-player`, `media-controller video`)
3. Capability-Sweep inkl. offenem Shadow DOM
4. keiner

_Warum Light-DOM-first:_ `scan()` läuft bei jeder Mutation — der tiefe `*`-Walk darf
nicht auf dem Hot Path liegen und startet nur, wenn im Light DOM kein Player ist.
`resolveHost` läuft bis zum nächsten Vorfahren mit **nicht-leerer Box** hoch (leere
Wrapper-DIVs kommen vor) und ist seiteneffektfrei. Ein `ResizeObserver` setzt den
Positionierungs-Kontext des Hosts neu (ein Host-Re-Render kann ihn auf `static`
zurückwerfen); er reparentet die Shell nicht — dafür ist der MutationObserver da.
`_diag().discovery` verrät, welche Strategie gegriffen hat — damit ein stiller Fallback
auf den Capability-Sweep (= LearningSuite hat den Player umbenannt) im Feld auffällt.
`admin-toggle` fragt weiterhin direkt `hls-video` ab — ein Editor-only-Banner, absichtlich
nicht migriert.

### Sicherheitsnetz — Rollback statt halb-mutierter Seite

- **Chrome-Hiding-CSS ist an den Erfolgsmarker `[data-vp-reskinned="true"]` gekoppelt**
  (wird erst nach erfolgreichem `attach()` gesetzt, beim Teardown entfernt).
  _Warum:_ Das schließt die CSS/JS-Asymmetrie, bei der ein fehlgeschlagener Attach
  die native Bedienung ausgeblendet und keine eigene mounted hat. Es darf **nie** eine
  unbedingte Chrome-Hiding-Regel geben.
- `attach()` / `applySetup()` sind in einen dünnen Wrapper plus `…Inner()`-Geschwister
  aufgeteilt, damit der Body in try/catch mit Rollback läuft, **ohne ~900 Zeilen neu
  einzurücken**. Reskin rollt über eine inkrementelle `undo`-Liste zurück, Demo über
  `resetCleanup` plus Entfernen der erzeugten Knoten-IDs.
- Reskin bricht per **`throw`** ab (fehlender Host, fehlender Pflicht-Shell-Knoten),
  damit ein einziger Catch-Pfad den Rollback einheitlich behandelt.
- Vorbedingungen vor Mutationen, Selbstverifikation der Overlays nach dem Attach.
- **Abweichung:** Die geplante "≥2 Kinder"-Vorbedingung für `tryFlexSibling()` wurde
  gestrichen — im Normal-Layout ist `<main>` das einzige Kind (die Sidebar wird das
  zweite), die Prüfung hätte fälschlich immer den Fixed-Rail-Pfad erzwungen.

### Betrieb — Kill-Switch und Telemetrie

- **Kill-Switch** (`common/killswitch.ts` → `app/api/runtime-config`, Vercel Edge Config
  per REST): gated `main()` über eine async IIFE mit 3-s-Fetch-Timeout.
  _Warum:_ Die Runtime lässt sich nicht pro Embed hot-patchen — ein Flag-Flip
  deaktiviert alle Embeds beim nächsten Laden ohne Redeploy. Edge Config wird über die
  REST-API gelesen, deshalb keine neue Runtime-Dependency und keine Lockfile-Änderung.
- **Telemetrie** (`common/beacon.ts` → `app/api/runtime-telemetry` →
  `RUNTIME_ALERT_WEBHOOK_URL`): Die Sink-URL wird **nie** vom Client aus angesprochen,
  immer über das Server-Relay.
- **Beides muss fail-open sein.** Netzwerkfehler, Timeout, CSP-Block oder unbekannte
  Origin dürfen eine funktionierende Runtime niemals abschalten — nur ein explizites
  `{ enabled: false }`.
- **Abweichung:** Beacons senden **`text/plain`** statt `application/json`. Letzteres
  erzwingt einen CORS-Preflight, den `sendBeacon` nicht erfüllen kann — der Beacon wäre
  still verworfen worden. Das Relay parst das JSON aus dem Body.
- **Ops-Env-Vars sind optional** (`EDGE_CONFIG`, `RUNTIME_ALERT_WEBHOOK_URL`,
  `RUNTIME_TELEMETRY_ALLOWED_ORIGINS`), damit App-Build und Tests ohne Ops-Infrastruktur
  laufen; Kill-Switch ist per Default aktiv, das Relay überspringt das Forwarding bei
  fehlender Sink.
- **Datenschutz:** Payload ist minimal `{ errorType, videoId, config }` (Config bei 32 KB
  gekappt) — Autoren-Config und Bunny-UUID, niemals href/Query/Cookies/Tokens.
- Weil die Runtime auf der LearningSuite-Origin läuft, wird _unsere_ Origin über
  `common/runtime-url.ts` aus der URL des injizierten Skripts (bzw.
  `window.__vpRuntimeBaseUrl`) abgeleitet.
- Testbare Route-Logik liegt in framework-/env-freien Modulen (`relay.ts`,
  `config-flag.ts`); `route.ts` ist nur dünne Verdrahtung. Setup-Anleitung:
  `docs/runtime-ops-setup.md`.

---

## 6 · Performance: der `timeupdate`-Hot-Path

Der Pfad, der bei laufender Wiedergabe ~4× pro Sekunde läuft, ist die
performance-kritische Oberfläche. Vier verhaltenserhaltende Guards:

- **Reskin:** `apollo.cache.extract()` (ein voller Store-Snapshot) nur noch, wenn
  tatsächlich ein LearningSuite-Untertitel gewählt ist — der Default-Pfad snapshottet
  den Store nicht mehr.
- **Demo:** `renderCoaching`/`renderMeta` prüfen eine Signatur (aktive Phase /
  Intervention / expandierte Phase, aktives Meta) per Dirty-Check, bevor `innerHTML`
  neu gebaut und Listener neu gebunden werden. `renderSection` ist die Referenz-
  Implementierung dafür.
- **Reskin:** Cross-Frame-Broadcast nutzt eine **gecachte** Liste vertrauter Iframes,
  aktualisiert vom bestehenden entprellten `scan()` (der MutationObserver beobachtet
  dafür zusätzlich `attributes: ["src"]`) — statt `querySelectorAll("iframe")` plus
  `new URL()` pro Emit. Alternative wäre gewesen, Time-Broadcasts zu throtteln; nicht
  gewählt.
- **Reskin:** Der Untertitel-Cue-DOM wird nicht neu geschrieben, solange der angezeigte
  Cue-Text unverändert ist.

---

## 7 · Mehrsprachigkeit: Language-Packs und externes Audio

`reskin-player` bekommt Sprach-Track-Controls; die Assets liegen als **Language-Pack**
unter `public/runtime/language-packs/<bunny-video-uuid>/` mit `manifest.json`,
`audio-<lang>.m4a` (Source-AAC) und `subtitles-<lang>.vtt`. Ein Track kann
`useNative: true` tragen (die Sprache steckt schon im HLS-Stream) oder über ein
externes Audio-Element laufen.

- **Sidecar-Untertitel haben Vorrang** vor Vendor-Captions.
- **Externe Audio-Wiedergabe ist passiv**: Bei Drift wird kein Auto-Sync erzwungen,
  sondern ein Badge (`[data-vp-sync-drift]`, ab Schwellwert, Anzeige `Audio ±x.x s`)
  eingeblendet. _Warum:_ Ein Auto-Seek gegen `hls.js` erzeugt sichtbare Ruckler und
  Rebuffering; die Abweichung sichtbar zu machen ist ehrlicher und störungsfreier.
  Zusätzlich sind Sync-Diagnosen über die `_diag()`-Oberfläche abrufbar.
- Asset-Origins werden über `makeAssetOriginChecker` gegen `__vpTrustedOrigins` plus
  die Base-URL des Packs geprüft.

---

## 8 · Voice-Over aus LearningSuite-Attachments

Das Audio-Overlay hat vorher immer `script` per `SpeechSynthesis` synthetisiert; echte
Assets waren nicht referenzierbar. Neu: `audios[].audioFile` enthält den **exakten
Dateinamen eines Lesson-Attachments**.

**Auflösung** (`common/attachments.ts`, `resolveAttachmentUrl`): **lazy zum Cue-Zeitpunkt**
aus dem gerenderten DOM — `a[href*="/courses/steps/"]`, dessen getrimmter Text dem
Dateinamen entspricht; zurückgegeben wird nur ein `https:`-href, bei jedem Miss `""`,
niemals ein Throw (exakter Match zuerst, dann case-insensitiv).

**Warum so:**

- Das Audio **bleibt in LearningSuite** hinter dessen eigener Auth — nichts liegt auf
  unserer Infrastruktur, und es wird kein LearningSuite-Auth-Token angefasst.
- Die signierte GCS-URL wird bei jedem Seitenaufruf neu ausgestellt, deshalb wird sie
  lazy pro Cue aufgelöst und **nie** gecacht, gespeichert oder in die Config geschrieben.
- Alternativen verworfen: GraphQL/`StepFileQuery` (bräuchte Persisted-Query-Hashes) und
  CUID-basiertes Matching (schlechtere Authoring-UX).

**TTS bleibt der universelle Fallback:** nicht gesetzter, nicht gefundener oder
nicht-`https`-Dateiname, ein abgelehntes `play()` oder ein Media-`error` degradieren
auf das vorherige Verhalten bei unverändertem Banner. Bestehende Configs und
`DEFAULT_AUDIOS` sind damit unberührt — `DEFAULT_AUDIOS` hat absichtlich kein
`audioFile`, damit die Demo-Defaults den Fallback weiter durchtesten.

Weitere Entscheidungen:

- `AudioController` ist **modus-bewusst** (`"file" | "tts"`). Im File-Modus kommt die
  Overlay-Uhr aus dem echten `timeupdate`, der Cue endet auf `ended`, und der 100-ms-
  Simulations-Tick ist TTS-only. `dur` aus der Config dimensioniert nur noch den
  Progress-Balken — echte Wiedergabe gewinnt.
- **Genau ein** persistentes verstecktes `<audio>` (`#vp-audio-el`) pro Mount, Listener
  einmal verdrahtet, beides in der Cleanup-Registry. Nie ein Element oder Listener in
  `activate()` erzeugen — sonst stapelt Re-Injection sie.
- Das Element trägt **absichtlich kein `crossorigin`**: ein nacktes Media-Element spielt
  die signierte GCS-URL im no-cors-Modus ohne CORS-Header, und `currentTime`/`duration`/
  `ended` funktionieren cross-origin weiterhin.
- `admin-toggle/prompt.ts` dokumentiert `audioFile` im deutschen Autor:innen-Prompt.

---

## Test-Gotchas (happy-dom)

Beim Weiterentwickeln relevant, weil sie nicht offensichtlich sind:

- happy-dom feuert **kein** `timeupdate`/`ended` — Controller-Tests dispatchen sie
  manuell.
- `<hls-video>` ist dort ein unbekanntes Element ohne Media-Methoden; für Assertions zu
  Video-Pause/Resume braucht man ein echtes `<video data-vp-player>` (die
  "Contract"-Discovery-Strategie).
- happy-dom navigiert ein `<iframe>` mit http-`src` wirklich — im Test das Iframe **ohne**
  `src` anhängen und vertrauenswürdige `src`/`contentWindow` per
  `Object.defineProperty` auf der Instanz bereitstellen.
- happy-dom berechnet die Descendant-CSS-Kaskade, deshalb wird die Marker-Gating-Regel
  über `getComputedStyle` verifiziert (`''` vs. `none`); Fehler werden per `vi.spyOn` auf
  `Element.prototype.{querySelector,getBoundingClientRect}` und einen werfenden
  `audioTracks`-Getter injiziert.
- **Bekannt:** `npm run build` schlägt lokal ohne `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN`
  fehl — unabhängig von den Runtime-Skripten (statische `public/`-Assets liegen außerhalb
  des Compile-Graphen).

---

## Dokumentation im Branch

| Datei                                       | Inhalt                                                                |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `docs/learningsuite-enrichment-research.md` | Plattform-Analyse, Architekturentscheidung, GraphQL-Flow, Hosting     |
| `docs/reskin-player-resilience-analysis.md` | Bruchstellen-Analyse der Runtime gegen Host-HTML-Änderungen           |
| `docs/runtime-ops-setup.md`                 | Edge-Config-/Webhook-Setup für Kill-Switch und Telemetrie             |
| `docs/feature-context.md`                   | Destillierte Entscheidungen und Constraints (von `/prp-plan` gelesen) |
| `.claude/PRPs/plans/completed/`             | 7 archivierte Umsetzungspläne                                         |
| `.claude/PRPs/reports/`                     | 7 Umsetzungsberichte                                                  |

Zum GraphQL-Flow wurde außerdem festgehalten: Der Video-Fortschritt läuft über
reguläres GraphQL (`MutateSubmitEvents`), nicht über `sendBeacon` — die frühere
Vermutung war falsch. Page-seitige Hooks haben es nur nicht gesehen, weil Apollo seine
`fetch`-Referenz bei Modul-Init cacht und die Plattform Persisted Queries nutzt (auf
der Leitung stehen nur SHA-Hashes).

---

## Offene Punkte / Folgearbeiten

**Noch nicht committet (untracked im Working Tree):**

- `.claude/PRPs/plans/2026-07-27_e2e-canary_learningsuite-overlay-playwright.plan.md` —
  Playwright-Suite, die sich in die echte, auth-gated LearningSuite-Instanz einloggt und
  prüft, dass die Runtime dort noch mountet und spielt. _Motivation:_ Kein existierender
  Check führt die Runtime auf einer `learningsuite.io`-Seite aus — Vitest testet gegen
  eigene DOM-Fixtures, `typecheck` gegen Typen, der Drift-Check gegen die Bundles. Genau
  der Fehlermodus, der das Feature bedroht (LearningSuite benennt `<hls-video>` um,
  strukturiert den Host um, ändert Control-Klassennamen, liefert eine blockierende CSP
  aus), wird heute erst bemerkt, wenn ein Mensch eine Lesson öffnet.
- `docs/e2e-overlay-canary-decisions.md`

**Operativ (kein Code):** Edge Config provisionieren (`EDGE_CONFIG` +
`runtimeConfig`-Key), `RUNTIME_ALERT_WEBHOOK_URL` und
`RUNTIME_TELEMETRY_ALLOWED_ORIGINS` setzen, prüfen, ob die LearningSuite-CSP
`connect-src` auf unsere Origin zulässt (Fail-open deckt es ab, falls nicht).

**Code:**

- Preact/JSX für die `demo-overlays`-UI — entfernt die `innerHTML`-XSS-Klasse strukturell.
- `admin-toggle`-Button "Attachment-Dateinamen übernehmen".
- Aufräumen: die jetzt toten `public/uploads/audio/*.mp3` und die Audio-Zweige in
  `app/api/upload/route.ts`.
- Strikte Config-Validierung serverseitig (bewusst nicht im Runtime-Bundle).
