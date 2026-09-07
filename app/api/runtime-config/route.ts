import { NextResponse } from "next/server";

import { env } from "~/env";
import { edgeConfigItemUrl, resolveFlag } from "./config-flag";

// Remote kill-switch flag read by the injected runtime (common/killswitch.ts).
// Backed by Vercel Edge Config (read via its REST API — no SDK dependency) so it
// can be flipped with no redeploy. The flag is public and non-sensitive (enabled
// true/false), so CORS is open `*` — the runtime fetches it credential-less from
// arbitrary LearningSuite origins.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS(): Response {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(): Promise<Response> {
  let raw: unknown;
  const url = edgeConfigItemUrl(env.EDGE_CONFIG, "runtimeConfig");
  if (url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) raw = await res.json();
    } catch {
      raw = undefined; // Edge Config unreachable → fail open below
    }
  }
  return NextResponse.json(resolveFlag(raw), {
    headers: { ...CORS, "Cache-Control": "public, max-age=60" },
  });
}
