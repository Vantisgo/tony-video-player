// The contract between the two phases of a run.
//
// Phase 1 (`playwright test --project=resolve`) writes this file; phase 2
// (`--project=canary`) reads it while *loading* the spec, which is what lets the
// spec emit one test per video. It crosses a process boundary, so it is parsed
// with a schema rather than trusted — a hand-edited or stale file must fail
// loudly, not produce a suite that asserts nothing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { z } from "zod";

export const TARGETS_PATH = "e2e/.auth/targets.json";

const resolvedVideoSchema = z.object({
  // 1-based position among the target's *video* lessons, in curriculum order.
  index: z.number().int().positive(),
  total: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
});

const targetsFileSchema = z.object({
  resolvedAt: z.string().min(1),
  // The parameters this file was resolved for — see `targetSpecKey`.
  specKey: z.string().min(1),
  courseLabel: z.string(),
  // `.min(1)`: "resolved successfully, zero videos" is never a valid state. A
  // course that has no videos is a failure to report, not an empty test run that
  // reports green.
  videos: z.array(resolvedVideoSchema).min(1),
});

export type ResolvedVideo = z.infer<typeof resolvedVideoSchema>;
export type TargetsFile = z.infer<typeof targetsFileSchema>;

export function writeTargetsFile(data: TargetsFile): void {
  const parsed = targetsFileSchema.parse(data);
  mkdirSync(dirname(TARGETS_PATH), { recursive: true });
  writeFileSync(TARGETS_PATH, JSON.stringify(parsed, null, 2), "utf8");
}

// Synchronous on purpose: the spec calls this at module scope, before Playwright
// has finished collecting tests.
export function readTargetsFile(expectedSpecKey: string): TargetsFile {
  if (!existsSync(TARGETS_PATH)) {
    throw new Error(
      `No resolved targets at ${TARGETS_PATH}.\n` +
        "The canary runs in two phases: targets are resolved first, then tested.\n" +
        "Run `bun run e2e` (which does both) — not `playwright test` on its own.",
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(readFileSync(TARGETS_PATH, "utf8"));
  } catch (cause) {
    throw new Error(
      `${TARGETS_PATH} is not valid JSON. Delete it and re-run \`bun run e2e\`.`,
      { cause },
    );
  }

  const parsed = targetsFileSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `${TARGETS_PATH} does not match the expected shape ` +
        `(${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}).\n` +
        "Delete it and re-run `bun run e2e`.",
    );
  }

  if (parsed.data.specKey !== expectedSpecKey) {
    throw new Error(
      `${TARGETS_PATH} was resolved for ${parsed.data.specKey}, but this run asks for ${expectedSpecKey}.\n` +
        "The file is a hand-off between the two phases, never a cache — re-run `bun run e2e` " +
        "so the targets match the parameters.",
    );
  }

  return parsed.data;
}
