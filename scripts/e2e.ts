#!/usr/bin/env bun
// The one command: `bun run e2e [--course=X|--lesson=X] [--video=N] [...]`
//
// A run is two Playwright invocations, not one. Phase 1 resolves the target into
// e2e/.auth/targets.json; phase 2 loads that file while collecting tests and
// emits one test per video. They cannot be a single run: Playwright fixes its
// test list while loading spec files, so a targets file written by a project in
// the same run arrives too late — the suite would collect nothing and report
// green. This script exists so nobody has to know that.
//
// The env vars are the contract (CI sets those directly); the flags are sugar
// over them, and anything a flag can say, E2E_TARGET / E2E_VIDEO say identically.
import { spawnSync } from "node:child_process";

type Parsed = {
  readonly target?: string;
  readonly video?: string;
  // Everything we did not consume, forwarded verbatim to phase 2 so --headed,
  // --grep, --list, -x and friends keep working.
  readonly rest: readonly string[];
};

// `--course=X` and `--course X` both work; --lesson is a deliberate alias, since
// which one a value denotes is decided by what it resolves to, not by which flag
// was typed.
const TARGET_FLAGS = new Set(["--course", "--lesson", "--target"]);
const VIDEO_FLAGS = new Set(["--video"]);

function parseArgs(argv: readonly string[]): Parsed {
  let target: string | undefined;
  let video: string | undefined;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;

    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);

    if (TARGET_FLAGS.has(name)) {
      target = inline ?? argv[++i];
      continue;
    }
    if (VIDEO_FLAGS.has(name)) {
      video = inline ?? argv[++i];
      continue;
    }
    rest.push(arg);
  }

  return { target, video, rest };
}

const parsed = parseArgs(process.argv.slice(2));

// Parsed once and shared by both children: phase 2 recomputes the spec key to
// prove the targets file on disk belongs to this run, so the two phases must see
// byte-identical parameters. Re-parsing per phase is how they drift apart.
const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  ...(parsed.target !== undefined ? { E2E_TARGET: parsed.target } : {}),
  ...(parsed.video !== undefined ? { E2E_VIDEO: parsed.video } : {}),
};

function run(label: string, args: readonly string[]): number {
  console.log(`\n▸ ${label}: playwright ${args.join(" ")}`);
  const result = spawnSync("bunx", ["playwright", ...args], {
    stdio: "inherit",
    env: childEnv,
  });
  if (result.error) {
    console.error(`Failed to start playwright: ${result.error.message}`);
    return 1;
  }
  // A signalled child reports a null status; treat that as failure rather than
  // as success-by-omission.
  return result.status ?? 1;
}

// Phase 1's exit code is never swallowed: "course not found" has to surface as
// the run's failure, not as a phase 2 that runs zero tests.
const resolveCode = run("resolve targets", ["test", "--project=resolve"]);
if (resolveCode !== 0) {
  console.error(
    "\nTarget resolution failed — no tests were run. " +
      "The resolve project's attachment in playwright-report/ says why.",
  );
  process.exit(resolveCode);
}

process.exit(run("run canary", ["test", "--project=canary", ...parsed.rest]));
