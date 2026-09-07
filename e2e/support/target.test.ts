// Unit tests for the two pure functions in the e2e harness. They classify the
// suite's parameters and key the hand-off between its two phases — branchy logic
// with no browser involved, so it is covered here rather than only by a live run.
//
// This file is `*.test.ts` (vitest) while the Playwright suite is `*.spec.ts`.
// That split is load-bearing: vitest's include globs `*.test.ts` and Playwright's
// `testMatch` globs `*.spec.ts`, so neither runner can ever collect the other's
// files.
import { describe, expect, it } from "vitest";

// Relative, not `~/`: vitest's config declares no path aliases, so the `~/`
// mapping in tsconfig.json resolves for tsc but not for the test runner.
import type { E2eEnv } from "./env";
import { describeTarget, parseTargetSpec, targetSpecKey } from "./target";

// `target.ts` imports E2eEnv as a type only, so building one here costs nothing
// and never triggers env.ts's validation (which would demand real credentials).
function env(overrides: Partial<E2eEnv> = {}): E2eEnv {
  return {
    E2E_LS_BASE_URL: "https://robbins.greator.com",
    E2E_LS_EMAIL: "test@example.test",
    E2E_LS_PASSWORD: "hunter2",
    E2E_LS_LOGIN_PATH: "/auth",
    E2E_LS_COURSES_PATH: "/student/courses",
    E2E_RUNTIME_BASE_URL: undefined,
    VERCEL_AUTOMATION_BYPASS_SECRET: undefined,
    E2E_TARGET: undefined,
    E2E_VIDEO: undefined,
    previewMode: false,
    ...overrides,
  } as E2eEnv;
}

describe("parseTargetSpec", () => {
  it("falls back to the default fixtures when no target is given", () => {
    expect(parseTargetSpec(env()).ref).toEqual({ kind: "default" });
  });

  it("defaults the video parameter to every video", () => {
    expect(parseTargetSpec(env()).video).toBe("all");
  });

  it("keeps an explicit video index", () => {
    const spec = parseTargetSpec(env({ E2E_TARGET: "abc123", E2E_VIDEO: 4 }));
    expect(spec.video).toBe(4);
  });

  it("classifies an http(s) target as a URL", () => {
    const url = "https://robbins.greator.com/student/course/x/a/b/c";
    expect(parseTargetSpec(env({ E2E_TARGET: url })).ref).toEqual({
      kind: "url",
      url,
    });
  });

  // A path is the form the fixture file uses and the form a person copies out of
  // the address bar, so the `E2E_CANARY_TARGET` repository variable has to accept
  // it. Without this it would fall through to the name branch and fail with
  // "No course matches the name /student/course/…", which names the wrong problem.
  it("resolves a leading-slash path against the configured tenant", () => {
    const path = "/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk";
    expect(parseTargetSpec(env({ E2E_TARGET: path })).ref).toEqual({
      kind: "url",
      url: `https://robbins.greator.com${path}`,
    });
  });

  it("resolves a path even when the base URL carries a trailing slash", () => {
    const spec = parseTargetSpec(
      env({
        E2E_LS_BASE_URL: "https://robbins.greator.com/",
        E2E_TARGET: "/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk",
      }),
    );
    expect(spec.ref).toEqual({
      kind: "url",
      url: "https://robbins.greator.com/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk",
    });
  });

  // The two phases must agree on the spec key or phase 2 refuses the targets
  // file, so a path and its absolute form have to key identically.
  it("keys a path identically to the same lesson given as a full URL", () => {
    const path = "/student/course/test/bksCcNnT/yPClsb9h/pgWcT1Bk";
    expect(targetSpecKey(parseTargetSpec(env({ E2E_TARGET: path })))).toBe(
      targetSpecKey(
        parseTargetSpec(
          env({ E2E_TARGET: `https://robbins.greator.com${path}` }),
        ),
      ),
    );
  });

  // "//host/path" looks like a path but `new URL()` resolves it to a different
  // origin, which would send a logged-in browser off-tenant with a live session.
  it("refuses a protocol-relative target that only looks like a path", () => {
    expect(() =>
      parseTargetSpec(env({ E2E_TARGET: "//evil.example/student/course/x" })),
    ).toThrow(/evil\.example/);
  });

  it("classifies a URL-safe token as an id or slug", () => {
    expect(parseTargetSpec(env({ E2E_TARGET: "mx2QDgyH" })).ref).toEqual({
      kind: "id",
      id: "mx2QDgyH",
    });
    expect(
      parseTargetSpec(env({ E2E_TARGET: "onboarding-interne-akademie" })).ref,
    ).toEqual({ kind: "id", id: "onboarding-interne-akademie" });
  });

  // Real shape on this tenant: a course is addressed by slug AND id together.
  it("treats a slug/id pair as one id", () => {
    const id = "robbins-greator-coaching-practitioner/k5GFQsnw";
    expect(parseTargetSpec(env({ E2E_TARGET: id })).ref).toEqual({
      kind: "id",
      id,
    });
  });

  it("classifies anything with whitespace as a visible name", () => {
    expect(
      parseTargetSpec(env({ E2E_TARGET: "Onboarding Akademie" })).ref,
    ).toEqual({ kind: "name", name: "Onboarding Akademie" });
  });

  // A pasted URL from another tenant would send a logged-in browser somewhere
  // nobody asked for, carrying a live session.
  it("refuses a URL on a different origin, naming both", () => {
    // `[\s\S]` rather than the `s` flag: tsconfig targets ES2017.
    expect(() =>
      parseTargetSpec(env({ E2E_TARGET: "https://evil.example.com/course/1" })),
    ).toThrow(/evil\.example\.com[\s\S]*robbins\.greator\.com/);
  });

  it("accepts a URL on the configured tenant regardless of trailing slash in the base", () => {
    const spec = parseTargetSpec(
      env({
        E2E_LS_BASE_URL: "https://robbins.greator.com",
        E2E_TARGET: "https://robbins.greator.com/student",
      }),
    );
    expect(spec.ref.kind).toBe("url");
  });

  it("rejects an unparseable URL-ish target", () => {
    expect(() => parseTargetSpec(env({ E2E_TARGET: "https://" }))).toThrow(
      /not a parseable URL/,
    );
  });
});

describe("targetSpecKey", () => {
  // Both phases compute this from the same env; if they could disagree, phase 2
  // would happily test targets resolved for different parameters.
  it("distinguishes every target kind", () => {
    const keys = [
      env(),
      env({ E2E_TARGET: "abc123" }),
      env({ E2E_TARGET: "Some Course" }),
      env({ E2E_TARGET: "https://robbins.greator.com/student" }),
    ].map((e) => targetSpecKey(parseTargetSpec(e)));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("distinguishes a video index from all videos", () => {
    const all = targetSpecKey(parseTargetSpec(env({ E2E_TARGET: "abc123" })));
    const one = targetSpecKey(
      parseTargetSpec(env({ E2E_TARGET: "abc123", E2E_VIDEO: 2 })),
    );
    expect(all).not.toBe(one);
    expect(all).toContain("all");
    expect(one).toContain("2");
  });

  it("is stable across runs for the same parameters", () => {
    const e = env({ E2E_TARGET: "abc123", E2E_VIDEO: 3 });
    expect(targetSpecKey(parseTargetSpec(e))).toBe(
      targetSpecKey(parseTargetSpec(e)),
    );
  });

  // Name matching is case-insensitive and trimmed, so the key must be too —
  // otherwise `--course="onboarding"` would reject targets resolved by
  // `--course="Onboarding"` even though they name the same course.
  it("normalises a name the same way the resolver matches it", () => {
    const a = targetSpecKey(parseTargetSpec(env({ E2E_TARGET: "My Course" })));
    const b = targetSpecKey(parseTargetSpec(env({ E2E_TARGET: "my course" })));
    expect(a).toBe(b);
  });
});

describe("describeTarget", () => {
  it("names the default fixtures", () => {
    expect(describeTarget(parseTargetSpec(env()))).toContain(
      "default fixtures",
    );
  });

  it("mentions the video index when one is given", () => {
    expect(
      describeTarget(
        parseTargetSpec(env({ E2E_TARGET: "abc123", E2E_VIDEO: 7 })),
      ),
    ).toContain("video 7");
  });
});
