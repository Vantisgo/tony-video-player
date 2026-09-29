// Resolve a voice-over cue's `asset` reference to a playable URL.
//
// Audio lives as an **asset of the LearningSuite custom-code block**, not as a
// lesson attachment. In the code editor the admin uploads a file and copies a
// placeholder token — `{{asset:2025-12-22-at-00-22-27-intro}}` — which the
// platform expands **at page render**, per request, into a freshly signed
// Google-Cloud-Storage URL. So by the time the runtime reads
// `[data-vp-config]`, the placeholder is already a live https URL: nothing here
// mints, caches, or persists a signature, and no LearningSuite auth token is
// touched.
//
// `Audio.asset` accepts two shapes, told apart by prefix with no overlap:
//
//   "https://storage.googleapis.com/…"   an expanded placeholder (the normal
//                                        case) or any direct https URL
//   "intro"                              a key into the optional top-level
//                                        `assets` table — for one file cued
//                                        twice, or to keep stored config free
//                                        of host-specific tokens
//
// A third shape is always an error: a value that still reads `{{asset:…}}` means
// the platform never expanded it (see UNEXPANDED below).
//
// Pure and defensive like `getBunnyVideoId` in ./tracks: returns a reason code
// instead of throwing, and never logs or reports on its own — the caller owns
// the policy (learners get TTS, operators get telemetry).

// The literal an unexpanded placeholder still carries. Matched anywhere in the
// string, not just at position 0, because the block may render the token with
// surrounding whitespace or an HTML-escaped wrapper.
const PLACEHOLDER = "{{asset:";

export type AssetFailure =
  // The value still contains `{{asset:` — the platform did not expand it. In
  // practice: the embed block is set to "In Pop-Up anzeigen" (its content is not
  // mounted on first paint), the asset was renamed or deleted after the token
  // was pasted, or the token was typed by hand rather than copied.
  | "unexpanded"
  // A bare key with no matching entry in the `assets` table.
  | "missing"
  // Resolved to something that is not an https URL. Defense-in-depth: the config
  // comes from a DOM we do not own, so an `http:` / `javascript:` / `data:`
  // value is refused rather than assigned to a media element's `src`.
  | "insecure";

export type AssetResolution =
  | { url: string; failure: null }
  | { url: ""; failure: AssetFailure };

const ok = (url: string): AssetResolution => ({ url, failure: null });
const fail = (failure: AssetFailure): AssetResolution => ({
  url: "",
  failure,
});

function httpsUrl(value: string): string {
  try {
    return new URL(value).protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

// A reference is a direct URL if it parses as one at all. Bare keys ("intro")
// are not absolute URLs, so this never mistakes a key for a URL — but it does
// catch an `http://` or `javascript:` value, which must fail as "insecure"
// rather than fall through to a table lookup that would report "missing".
function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function resolveAssetUrl(
  reference: string | null | undefined,
  assets: Readonly<Record<string, string>> = {},
): AssetResolution {
  const ref = String(reference ?? "").trim();
  // An absent reference is not a failure: a cue may deliberately carry no audio
  // file and be spoken from `script` instead.
  if (!ref) return ok("");

  if (ref.includes(PLACEHOLDER)) return fail("unexpanded");

  if (isAbsoluteUrl(ref)) {
    const url = httpsUrl(ref);
    return url ? ok(url) : fail("insecure");
  }

  // Bare key → table. Missing and empty-string entries are the same mistake.
  const mapped = String(assets[ref] ?? "").trim();
  if (!mapped) return fail("missing");
  // The table can hold placeholders too, so re-run both checks on the value.
  if (mapped.includes(PLACEHOLDER)) return fail("unexpanded");
  const url = httpsUrl(mapped);
  return url ? ok(url) : fail("insecure");
}
