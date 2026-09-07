import { runtimeApiUrl } from "./runtime-url";

// Fire-and-forget failure telemetry. The runtime posts to our own relay
// (app/api/runtime-telemetry), which forwards to a configured REST sink. Sent as
// `text/plain` so it is a CORS-safelisted request — `sendBeacon` then works
// cross-origin WITHOUT a preflight the beacon could never satisfy; the relay
// parses JSON from the text body.
const TELEMETRY_PATH = "/api/runtime-telemetry";

// Cap the serialized config so a large author config can't bloat the beacon.
export const MAX_CONFIG_BYTES = 32 * 1024;

export interface TelemetryPayload {
  errorType: string;
  videoId: string;
  config: unknown;
}

export function capConfig(config: unknown): unknown {
  let serialized: string;
  try {
    serialized = JSON.stringify(config ?? null);
  } catch {
    return { __unserializable: true };
  }
  if (serialized.length > MAX_CONFIG_BYTES)
    return { __truncated: true, bytes: serialized.length };
  return config ?? null;
}

// Dedup per (errorType, videoId) for the lifetime of this bundle instance (one
// page session), mirroring the runtime's `activeOverlays` Set pattern.
const reported = new Set<string>();

export function report(baseUrl: string, payload: TelemetryPayload): void {
  try {
    const key = `${payload.errorType}|${payload.videoId}`;
    if (reported.has(key)) return;

    const url = runtimeApiUrl(baseUrl, TELEMETRY_PATH);
    if (!url) return; // unknown origin → nowhere to send

    reported.add(key);
    const body = JSON.stringify({
      errorType: payload.errorType,
      videoId: payload.videoId,
      config: capConfig(payload.config),
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain" });
      if (navigator.sendBeacon(url, blob)) return;
    }
    if (typeof fetch !== "undefined")
      void fetch(url, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "text/plain" },
        body,
        credentials: "omit",
      }).catch(() => {
        /* fire-and-forget */
      });
  } catch {
    /* telemetry must never throw into the runtime */
  }
}
