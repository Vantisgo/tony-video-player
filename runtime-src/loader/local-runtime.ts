// Local-first runtime resolution: let a developer's `bun dev` serve the bundles
// while everyone else keeps getting the deployed ones — from a single global
// <script> tag the platform never has to change again.
//
// The loader itself always arrives from the deployed origin (it is what the
// tenant's tag points at). Before it injects a child bundle it asks, once,
// whether a local dev server is answering; if so every child comes from there
// instead. A developer starts `bun dev` and reloads; a content author's browser
// makes one request that is refused in ~250ms and never notices.
//
// Three measured facts drive the shape of this file (Chrome 152, https page →
// http://localhost):
//
//  1. This is NOT classic mixed content. Chrome treats http://localhost as a
//     potentially trustworthy origin, so the scheme alone does not block it.
//     What applies is Local Network Access, and its gate is CORS.
//  2. A no-CORS `<script src>` to a loopback origin IS fetched and served, then
//     the response is silently discarded with NO load and NO error event. Hence
//     `crossOrigin` on every local child in ../loader/index.ts — without it the
//     inject() promise never settles and the whole chain stalls in silence.
//  3. Probing with `fetch` costs ~4ms when the dev server is up and ~245ms when
//     the port is dead. Probing by watching a `<script>` fail costs 2350ms, so
//     the probe is a fetch and never a script error.

// Fixed, not configurable. A URL from the page (query string, storage) would
// mean anyone could hand a learner a link that runs their JavaScript inside a
// logged-in lesson; a constant cannot be aimed.
const LOCAL_LOADER = "http://localhost:3000/runtime/loader.js";
const HANDSHAKE = "http://localhost:3000/runtime/dev-handshake.json";

// Port 3000 is a very common dev port, so "something answered" is not enough
// evidence — a learner running an unrelated server that happens to serve
// /runtime/* would otherwise get its code executed on the lesson page. The
// handshake file makes a coincidence indistinguishable from nothing at all.
const MARKER = "vpDevRuntime";

// Long enough for a loopback round-trip on a busy machine, short enough that a
// content author never notices. A dead port rejects well inside it on its own;
// this only bounds the pathological case (a port that accepts and then stalls).
const PROBE_TIMEOUT_MS = 400;

// The loader passes this to `childUrl()` in place of its own script URL, so the
// existing child-URL construction is reused untouched.
export const LOCAL_LOADER_URL = LOCAL_LOADER;

// Unlike the kill-switch, this fails CLOSED: anything other than a positive,
// correctly-marked answer means "use the deployed runtime", which is the safe
// default. A timeout, a refused connection, a CORS or Local-Network-Access
// block and a foreign server all land here identically.
export async function probeLocalRuntime(): Promise<boolean> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(HANDSHAKE, {
      cache: "no-store",
      credentials: "omit",
      signal: controller?.signal,
    });
    if (!res.ok) return false;
    const data: unknown = await res.json();
    return (
      !!data &&
      typeof data === "object" &&
      (data as Record<string, unknown>)[MARKER] === true
    );
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
