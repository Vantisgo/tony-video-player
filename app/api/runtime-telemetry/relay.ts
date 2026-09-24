import { z } from "zod";

// Pure, framework-free logic for the runtime-telemetry relay, so it is unit
// testable without Next.js or env coupling. route.ts wires these to the request.

// Mirrors the runtime beacon payload (common/beacon.ts). `config` is arbitrary
// author JSON (or a truncation marker), so it is validated as unknown.
export const telemetrySchema = z.object({
  errorType: z.string().min(1).max(200),
  videoId: z.string().max(200),
  config: z.unknown(),
});

export type TelemetryPayload = z.infer<typeof telemetrySchema>;

export function parseTelemetry(
  raw: string,
): { ok: true; data: TelemetryPayload } | { ok: false } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  const result = telemetrySchema.safeParse(json);
  return result.success ? { ok: true, data: result.data } : { ok: false };
}

// CORS: reflect the request origin only when it is on the configured allowlist.
// `allowed` is the parsed RUNTIME_TELEMETRY_ALLOWED_ORIGINS list.
export function corsHeaders(
  origin: string | null,
  allowed: readonly string[],
): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowed.includes(origin))
    base["Access-Control-Allow-Origin"] = origin;
  return base;
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// In-memory, per-instance fixed-window rate limiter. Best-effort only: Vercel is
// multi-instance, so the effective ceiling is limit × live instances and resets
// on cold start (accepted — see plan decision #5). `now` is injectable for tests.
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
}): (key: string, now?: number) => boolean {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now: number = Date.now()): boolean => {
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }
    if (entry.count >= options.limit) return false;
    entry.count += 1;
    return true;
  };
}

// Forward the validated payload to the configured REST sink. `fetchImpl` is
// injectable for tests. Never throws (telemetry is best-effort).
export async function forwardToSink(
  sinkUrl: string,
  payload: TelemetryPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchImpl(sinkUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* best-effort */
  }
}
