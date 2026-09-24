// The e2e trust boundary: everything this suite learns from the outside world
// arrives as an environment variable, so it is validated once, here, and never
// read from `process.env` again.
//
// Deliberately standalone: importing `~/env` would drag in `DATABASE_URL` and
// `BLOB_READ_WRITE_TOKEN` (plus Next's runtime wiring), none of which a
// Playwright process has — validation would fail before a browser ever opens.
// `.gitignore` ignores `.env*`, so there is no committed `.env.example`; the
// authoritative list of these variables lives in `docs/e2e-canary.md`.
import dotenv from "dotenv";
import { z } from "zod";

// Loaded here rather than in playwright.config.ts so that every entry point —
// the config, both setup projects, the spec, and scripts/e2e.ts — sees the same
// environment no matter which one Node reaches first. dotenv never overwrites an
// already-set variable, so CI's real secrets always beat a stray local file.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

// An unset variable and one exported as "" mean the same thing to a shell user
// and to GitHub Actions (an unfilled `workflow_dispatch` input is ""), so both
// become `undefined` before validation.
const blankToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());

const optionalText = z.preprocess(
  blankToUndefined,
  z.string().min(1).optional(),
);

const schema = z.object({
  // --- LearningSuite (required) -------------------------------------------
  E2E_LS_BASE_URL: z.string().url(),
  E2E_LS_EMAIL: z.string().email(),
  E2E_LS_PASSWORD: z.string().min(1),

  // --- LearningSuite navigation (optional; Task 1 facts) -------------------
  // Paths, not selectors: which page the login form and the course list live on
  // is a fact about the tenant, so it is configuration rather than a guess baked
  // into `auth.setup.ts` / `resolve.setup.ts`. Defaults are the observed shapes.
  E2E_LS_LOGIN_PATH: z.preprocess(
    blankToUndefined,
    z.string().min(1).default("/login"),
  ),
  E2E_LS_COURSES_PATH: z.preprocess(
    blankToUndefined,
    z.string().min(1).default("/student"),
  ),

  // --- PR / preview mode (optional) ----------------------------------------
  // Set => preview mode: the LearningSuite page runs the PR's bundle instead of
  // the deployed one. Accepts either a deployment origin or a full script URL
  // (see `runtime-source.ts`, which normalises it).
  E2E_RUNTIME_BASE_URL: optionalUrl,
  // Vercel preview deployments are protection-gated; without this the bundle
  // fetch returns Vercel's 401 HTML instead of JavaScript.
  VERCEL_AUTOMATION_BYPASS_SECRET: optionalText,

  // --- Suite parameters (optional) -----------------------------------------
  // What to test. Empty => the committed default fixtures (what the schedule
  // runs). A course or lesson, given as a URL, a LearningSuite id, or a name.
  E2E_TARGET: z.preprocess(
    blankToUndefined,
    z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1))
      .optional(),
  ),
  // Which video of that course. Empty => all of them. 1-based on purpose: "the
  // 4th video" reads as 4. Rejected here rather than as an out-of-range array
  // read three modules later.
  E2E_VIDEO: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
});

export type E2eEnv = Readonly<z.infer<typeof schema>> & {
  // True when the LearningSuite page should execute a preview bundle instead of
  // the deployed one.
  readonly previewMode: boolean;
};

function describe(error: z.ZodError): string {
  // Built by hand from path + message: zod's default rendering can echo the
  // received value, and one of these keys is a password.
  const lines = error.issues.map((issue) => {
    const key = issue.path.join(".") || "(root)";
    return `  - ${key}: ${issue.message}`;
  });
  return [
    "Invalid e2e environment. Fix these variables in .env.local (local) or the",
    "workflow's env/secrets (CI) — see docs/e2e-canary.md:",
    ...lines,
  ].join("\n");
}

function load(source: NodeJS.ProcessEnv): E2eEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(describe(parsed.error));

  const value = parsed.data;

  // Cross-field rule: a video index has nothing to index into without a target.
  // The default fixtures are a fixed list of lessons, not a course, so silently
  // indexing them would answer a question the caller did not ask.
  if (value.E2E_VIDEO !== undefined && value.E2E_TARGET === undefined) {
    throw new Error(
      "E2E_VIDEO (--video) needs a target: it selects the Nth video of a course. " +
        "Pass E2E_TARGET (--course=<url|id|name>) as well, or drop the video index.",
    );
  }

  return Object.freeze({
    ...value,
    // A trailing slash makes every `new URL(path, base)` downstream ambiguous.
    E2E_LS_BASE_URL: value.E2E_LS_BASE_URL.replace(/\/+$/, ""),
    previewMode: value.E2E_RUNTIME_BASE_URL !== undefined,
  });
}

export const e2eEnv: E2eEnv = load(process.env);
