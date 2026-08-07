// The two suite parameters, turned into one typed spec.
//
// Pure by design: environment in, spec out. No IO, no `process.env` read of its
// own, no navigation — so the classification rules can be reasoned about (and
// unit-tested) without a browser.
import type { E2eEnv } from "./env";

export type TargetRef =
  // No target given: the committed default fixtures.
  | { readonly kind: "default" }
  // A full URL to a course or lesson on the configured tenant.
  | { readonly kind: "url"; readonly url: string }
  // A LearningSuite id or course slug — the URL-safe token form.
  | { readonly kind: "id"; readonly id: string }
  // A visible course title, matched exactly (trimmed, case-insensitive).
  | { readonly kind: "name"; readonly name: string };

export type TargetSpec = {
  readonly ref: TargetRef;
  // 1-based index into the target course's ordered video lessons, or every one.
  readonly video: number | "all";
};

// A discriminated union rather than `{ isUrl, isId, isName }` so the compiler
// forces the resolver to handle every kind — a new kind must not be able to
// slip through as "nothing matched, so do the default".

// A course is addressed by the URL-safe part of its path. On this tenant that is
// a slug AND an id together — `robbins-greator-coaching-practitioner/k5GFQsnw` —
// so the separator is allowed inside the token; a course *name* is a human title.
// Whitespace is the honest split between the two: anything a person types as a
// name has spaces in it, and anything appearing in a URL path cannot.
const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._~/-]*$/;

export function parseTargetSpec(env: E2eEnv): TargetSpec {
  const video: number | "all" = env.E2E_VIDEO ?? "all";
  const raw = env.E2E_TARGET;

  if (raw === undefined) return { ref: { kind: "default" }, video };

  if (/^https?:\/\//i.test(raw)) {
    return { ref: { kind: "url", url: assertSameTenant(raw, env) }, video };
  }

  if (ID_SHAPE.test(raw)) return { ref: { kind: "id", id: raw }, video };

  return { ref: { kind: "name", name: raw }, video };
}

// A pasted URL from another tenant (or a phished lookalike) would send a
// logged-in browser somewhere nobody asked for, carrying a live session. Reject
// it by name rather than following it.
function assertSameTenant(raw: string, env: E2eEnv): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`E2E_TARGET is not a parseable URL: ${raw}`);
  }
  const expected = new URL(env.E2E_LS_BASE_URL).origin;
  if (parsed.origin !== expected) {
    throw new Error(
      `E2E_TARGET points at ${parsed.origin}, but this run is configured for ${expected}. ` +
        "Pass a URL on the configured tenant, or change E2E_LS_BASE_URL.",
    );
  }
  return parsed.href;
}

// A stable, human-readable rendering of the spec. Both phases compute it from
// the same env, so the test phase can prove the targets file on disk was
// resolved for the parameters it is about to run under.
export function targetSpecKey(spec: TargetSpec): string {
  const ref = spec.ref;
  const head =
    ref.kind === "default"
      ? "default"
      : ref.kind === "url"
        ? `url:${ref.url}`
        : ref.kind === "id"
          ? `id:${ref.id}`
          : `name:${ref.name.trim().toLowerCase()}`;
  return `${head}#${spec.video}`;
}

// A short label for logs and error messages.
export function describeTarget(spec: TargetSpec): string {
  const ref = spec.ref;
  const what =
    ref.kind === "default"
      ? "the default fixtures"
      : ref.kind === "url"
        ? ref.url
        : ref.kind === "id"
          ? `id/slug "${ref.id}"`
          : `name "${ref.name}"`;
  return spec.video === "all" ? what : `${what} (video ${spec.video})`;
}
