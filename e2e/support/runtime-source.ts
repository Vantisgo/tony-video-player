// Decides which bundle the LearningSuite page actually executes.
//
// Canary mode (the schedule): nothing happens. LearningSuite's own script tag
// loads the deployed runtime, which is the whole point — we test what learners
// get, not what we uploaded to a test rig.
//
// Preview mode (`E2E_RUNTIME_BASE_URL` set, i.e. the PR job): every
// `/runtime/*.js` request is served from the PR's Vercel preview instead, so the
// PR's runtime is exercised against the real host page before it is deployed.
import type { Page, Route } from "@playwright/test";

import { e2eEnv } from "./env";

// Matches loader.js and each augment bundle, with or without a query string
// (the tenant's script tag carries `?x-vercel-protection-bypass=…`, which a
// glob pattern would not match).
const RUNTIME_SCRIPT = /\/runtime\/[\w-]+\.js$/i;

export type RuntimeSource = {
  readonly mode: "deployed" | "preview";
  // The script URL handed to the runtime as `window.__vpRuntimeBaseUrl`, or ""
  // in deployed mode.
  readonly scriptUrl: string;
};

// `getRuntimeBaseUrl()` computes `new URL(".", scriptUrl)`, so the override is
// read as a *script* URL, not an origin: handing it a bare origin would resolve
// the kill-switch and telemetry relays against the wrong path. A deployment URL
// (what `deployment_status.environment_url` gives CI) is therefore completed to
// the loader's own URL.
//
// The bypass secret rides as a query parameter rather than only as a header
// because the loader copies its own query string onto every child bundle URL
// (runtime-src/loader/gates.ts) — putting it here is what lets the children
// through a protection-gated deployment.
export function previewScriptUrl(): string {
  const raw = e2eEnv.E2E_RUNTIME_BASE_URL;
  if (!raw) return "";

  const url = new URL(raw);
  if (!/\.js$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/+$/, "") + "/runtime/loader.js";
  }

  const secret = e2eEnv.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (secret && !url.searchParams.has("x-vercel-protection-bypass")) {
    url.searchParams.set("x-vercel-protection-bypass", secret);
  }
  return url.href;
}

export async function useRuntimeSource(page: Page): Promise<RuntimeSource> {
  if (!e2eEnv.previewMode) return { mode: "deployed", scriptUrl: "" };

  const scriptUrl = previewScriptUrl();
  const previewDir = new URL(".", scriptUrl);

  // Set before any page script runs. The loader only assigns
  // `__vpRuntimeBaseUrl` when it is still unset, so this value wins and every
  // child bundle, the kill-switch and the telemetry relay resolve to the preview.
  await page.addInitScript((value: string) => {
    (window as unknown as { __vpRuntimeBaseUrl?: string }).__vpRuntimeBaseUrl =
      value;
  }, scriptUrl);

  await page.route(
    (url) => RUNTIME_SCRIPT.test(url.pathname),
    (route) => serveFromPreview(route, previewDir),
  );

  return { mode: "preview", scriptUrl };
}

async function serveFromPreview(route: Route, previewDir: URL): Promise<void> {
  const requested = new URL(route.request().url());

  // Already pointed at the preview (the loader resolves children from the
  // override): let it through untouched rather than round-tripping it.
  if (requested.origin === previewDir.origin) {
    await route.fallback();
    return;
  }

  const filename = requested.pathname.split("/").pop() ?? "";
  const target = new URL(filename, previewDir);
  const secret = e2eEnv.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (secret) target.searchParams.set("x-vercel-protection-bypass", secret);

  const response = await route.fetch({
    url: target.href,
    // Header form as well as the query parameter: Vercel accepts either, and the
    // header survives a redirect that drops the query string.
    headers: secret
      ? {
          ...route.request().headers(),
          "x-vercel-protection-bypass": secret,
        }
      : route.request().headers(),
  });

  // Without this, a protection-gated preview returns 401 HTML, the page runs no
  // runtime at all, and every assertion fails with "status undefined" — which
  // reads like a runtime bug instead of a missing secret.
  if (response.status() !== 200) {
    throw new Error(
      `Preview bundle fetch failed: ${response.status()} for ${target.href}.\n` +
        (secret
          ? "The bypass secret was sent but rejected — is VERCEL_AUTOMATION_BYPASS_SECRET current?"
          : "No VERCEL_AUTOMATION_BYPASS_SECRET was set, and protected Vercel previews 401 without it."),
    );
  }

  await route.fulfill({
    response,
    headers: {
      ...response.headers(),
      "content-type": "text/javascript; charset=utf-8",
    },
  });
}
