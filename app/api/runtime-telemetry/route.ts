import { NextResponse } from "next/server";

import { env } from "~/env";
import {
  corsHeaders,
  createRateLimiter,
  forwardToSink,
  parseAllowedOrigins,
  parseTelemetry,
} from "./relay";

// Relay for runtime failure telemetry: the injected runtime beacons here, and we
// forward to the configured (software-agnostic) REST sink. We own the sink URL
// (server-only), CORS, and rate limiting so the sink URL never ships to clients.

// Per-instance limiter (see relay.ts): 30 reports / minute / client.
const rateLimit = createRateLimiter({ limit: 30, windowMs: 60_000 });

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("origin") || "unknown";
}

export function OPTIONS(request: Request): Response {
  const allowed = parseAllowedOrigins(env.RUNTIME_TELEMETRY_ALLOWED_ORIGINS);
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin"), allowed),
  });
}

export async function POST(request: Request): Promise<Response> {
  const allowed = parseAllowedOrigins(env.RUNTIME_TELEMETRY_ALLOWED_ORIGINS);
  const headers = corsHeaders(request.headers.get("origin"), allowed);

  if (!rateLimit(clientKey(request)))
    return new NextResponse(null, { status: 429, headers });

  const raw = await request.text();
  const parsed = parseTelemetry(raw);
  if (!parsed.ok) return new NextResponse(null, { status: 400, headers });

  const sink = env.RUNTIME_ALERT_WEBHOOK_URL;
  if (sink) await forwardToSink(sink, parsed.data);

  return new NextResponse(null, { status: 204, headers });
}
