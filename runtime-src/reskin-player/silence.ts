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
  // "webaudio" once a gain node is in place; "reassert" for the capped fallback;
  // "none" when neither is possible (no reachable media element at all).
  readonly mode: "webaudio" | "reassert" | "none";
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

export function createSilencer(
  mediaEl: MediaEl,
  globals: SilencerGlobals = window as unknown as SilencerGlobals,
): Silencer {
  const audioEl = resolveAudioElement(mediaEl);
  const Ctor = globals.AudioContext;
  const graph = audioEl && Ctor ? buildGraph(audioEl, Ctor) : null;

  if (graph) {
    let silenced = false;
    const apply = (value: number): void => {
      try {
        graph.gain.gain.value = value;
      } catch {
        /* ignore — a disposed context */
      }
      // An AudioContext constructed before any user gesture starts "suspended".
      // Sticky activation persists for the document's lifetime once granted, and
      // playback already required a gesture, so this resolves without one of its
      // own. https://webaudio.github.io/web-audio-api/#allowed-to-start
      if (graph.ctx.state === "suspended") void graph.ctx.resume?.();
    };
    return {
      mode: "webaudio",
      silence() {
        if (silenced) return;
        silenced = true;
        apply(0);
      },
      restore() {
        if (!silenced) return;
        silenced = false;
        apply(1);
      },
      dispose() {
        if (silenced) apply(1);
      },
    };
  }

  // Fallback: no Web Audio (an old WebView, a hardened policy, or no reachable
  // media element). Re-assert `muted` a bounded number of times, then stop.
  // Capped rather than endless for the same reason enforceCuePause is: a host
  // that fought back on every write would turn this into a mute/unmute war, and
  // a stuttering player is worse for the learner than audible dub bleed.
  const target = audioEl ?? (mediaEl as unknown as HTMLMediaElement);
  if (!target || typeof target.addEventListener !== "function")
    return {
      mode: "none",
      silence() {},
      restore() {},
      dispose() {},
    };

  let want = false;
  let reasserts = 0;
  const set = (value: boolean): void => {
    try {
      target.muted = value;
    } catch {
      /* ignore */
    }
  };
  const onVolumeChange = (): void => {
    if (!want || target.muted || reasserts >= MAX_MUTE_REASSERTS) return;
    reasserts += 1;
    set(true);
  };
  target.addEventListener("volumechange", onVolumeChange);
  return {
    mode: "reassert",
    silence() {
      want = true;
      reasserts = 0;
      set(true);
    },
    restore() {
      want = false;
      reasserts = 0;
      set(false);
    },
    dispose() {
      want = false;
      target.removeEventListener("volumechange", onVolumeChange);
    },
  };
}
