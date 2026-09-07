// Making the video silent while a dubbed audio track plays.
//
// The obvious way — `mediaEl.muted = true` — does not work on LearningSuite.
// Measured on the live tenant 2026-09-07: the write lands (`muted` really does
// read `true`), and the host's own React player reverts it within ~600ms, on the
// outer custom element and on the inner `<video>` alike. Its own mute button
// works, because it writes the React state that is the authority instead of
// fighting it. We have no access to that state.
//
// So the silence is produced somewhere the host has no handle on: a Web Audio
// graph of our own. `createMediaElementSource()` re-routes the element's output
// into our graph, and a GainNode at 0 multiplies it away. The host can set
// `muted` and `volume` to whatever it likes; both feed *into* the node, and zero
// times anything is still zero.
//
// Why this is safe here specifically: the Web Audio spec makes a
// MediaElementAudioSourceNode output silence if the element's resource is
// CORS-cross-origin, which would defeat the whole thing. It does not apply,
// because hls.js feeds the inner `<video>` through MediaSource Extensions — the
// element's `src` is a `blob:` URL (measured), the HTML spec treats a blob-backed
// media provider object as "mode is local", and such media data is
// unconditionally CORS-same-origin regardless of Bunny's headers.
// https://html.spec.whatwg.org/multipage/media.html#concept-media-load-resource
// https://webaudio.github.io/web-audio-api/#MediaElementAudioSourceOptions-security
import type { MediaEl } from "../common/types";

// Matches MAX_CUE_REPAUSES in demo-overlays: the same "do not fight the host
// forever" rule, for the same reason.
const MAX_MUTE_REASSERTS = 3;

type AudioContextCtor = new () => AudioContext;

export interface SilencerGlobals {
  AudioContext?: AudioContextCtor;
}

export interface Silencer {
  // "idle" until something actually needs silence — see createSilencer for why
  // nothing may touch the audio path before then. Then "webaudio" once a gain
  // node is in place, "reassert" for the capped fallback, or "none" when neither
  // is possible (no reachable media element at all).
  readonly mode: "idle" | "webaudio" | "reassert" | "none";
  silence(): void;
  restore(): void;
  dispose(): void;
}

interface Graph {
  ctx: AudioContext;
  gain: GainNode;
}

// `createMediaElementSource()` throws InvalidStateError if called twice for the
// same element INSTANCE, so the graph is cached against the instance and rebuilt
// only when the host replaces the element with a genuinely new node.
const graphs = new WeakMap<HTMLMediaElement, Graph>();

// The element the audio actually comes out of. `<hls-video>` is a custom element
// and NOT an HTMLMediaElement (measured), so it can neither be passed to
// createMediaElementSource nor hold the MSE blob — the inner `<video>` does both.
export function resolveAudioElement(el: MediaEl): HTMLMediaElement | null {
  if (typeof HTMLMediaElement !== "undefined" && el instanceof HTMLMediaElement)
    return el;
  const withShadow = el as unknown as {
    shadowRoot?: ShadowRoot | null;
    querySelector?: (s: string) => Element | null;
  };
  const inner =
    withShadow.shadowRoot?.querySelector("video, audio") ??
    withShadow.querySelector?.("video, audio") ??
    null;
  return typeof HTMLMediaElement !== "undefined" &&
    inner instanceof HTMLMediaElement
    ? inner
    : null;
}

function buildGraph(
  el: HTMLMediaElement,
  Ctor: AudioContextCtor,
): Graph | null {
  const cached = graphs.get(el);
  if (cached) return cached;
  try {
    const ctx = new Ctor();
    const source = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    const graph = { ctx, gain };
    graphs.set(el, graph);
    return graph;
  } catch (err) {
    console.warn("[vp] web-audio silencer unavailable", err);
    return null;
  }
}

// NOTHING here touches the element's audio path until `silence()` is called.
//
// The graph used to be built eagerly at attach. That broke playback outright on
// lessons with no language pack — which is nearly all of them. An AudioContext
// constructed without a user gesture starts SUSPENDED, and a media element
// routed into a suspended graph cannot render audio, so its clock stops: the
// video reports `paused === false`, `readyState 4`, fully buffered, and sits
// frozen. Measured on the tenant 2026-09-07: it advanced 0.1s and stopped, and
// the host's bar went on showing "pause" because `paused` really was false.
//
// Building lazily fixes both halves at once. A lesson without a dub never has
// its audio rerouted at all, and by the time a dub does need silence the learner
// has pressed play — so sticky activation exists and the context starts running.
export function createSilencer(
  mediaEl: MediaEl,
  globals: SilencerGlobals = window as unknown as SilencerGlobals,
): Silencer {
  const audioEl = resolveAudioElement(mediaEl);
  const target = audioEl ?? (mediaEl as unknown as HTMLMediaElement);
  let mode: Silencer["mode"] = "idle";
  let graph: Graph | null = null;
  let silenced = false;

  // Fallback state (see below): capped re-assertion of `muted`.
  let want = false;
  let reasserts = 0;
  let listening = false;
  const setMuted = (value: boolean): void => {
    try {
      target.muted = value;
    } catch {
      /* ignore */
    }
  };
  const onVolumeChange = (): void => {
    if (!want || target.muted || reasserts >= MAX_MUTE_REASSERTS) return;
    reasserts += 1;
    setMuted(true);
  };

  // Decide the mechanism on first use, never before.
  function engage(): void {
    const Ctor = globals.AudioContext;
    if (audioEl && Ctor) graph = buildGraph(audioEl, Ctor);
    if (graph) {
      mode = "webaudio";
      return;
    }
    if (target && typeof target.addEventListener === "function") {
      mode = "reassert";
      if (!listening) {
        target.addEventListener("volumechange", onVolumeChange);
        listening = true;
      }
      return;
    }
    mode = "none";
  }

  function applyGain(value: number): void {
    if (!graph) return;
    try {
      graph.gain.gain.value = value;
    } catch {
      /* ignore — a disposed context */
    }
    // Should already be running (a gesture started playback), but a context can
    // be interrupted — by a phone call on iOS, for instance.
    // https://webaudio.github.io/web-audio-api/#allowed-to-start
    if (graph.ctx.state === "suspended") void graph.ctx.resume?.();
  }

  return {
    get mode() {
      return mode;
    },
    silence() {
      if (silenced) return;
      silenced = true;
      if (mode === "idle") engage();
      if (mode === "webaudio") applyGain(0);
      else if (mode === "reassert") {
        want = true;
        reasserts = 0;
        setMuted(true);
      }
    },
    restore() {
      if (!silenced) return;
      silenced = false;
      if (mode === "webaudio") applyGain(1);
      else if (mode === "reassert") {
        want = false;
        reasserts = 0;
        setMuted(false);
      }
    },
    dispose() {
      if (silenced && mode === "webaudio") applyGain(1);
      want = false;
      if (listening) {
        target.removeEventListener("volumechange", onVolumeChange);
        listening = false;
      }
    },
  };
}
