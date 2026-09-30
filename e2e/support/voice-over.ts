// Which voice-over cue the phone canary can measure.
//
// Pure by design — no `@playwright/test` import — like `geometry.ts`, so the
// rule is unit-tested in vitest (see `voice-over.test.ts`). A cue plays only
// its uploaded audio asset: the runtime skips one without an `asset`, or with
// one `resolveAssetUrl` refuses, and never mounts its card. So the canary
// decides with that same function instead of taking `audios[0]` — the
// text-to-speech era did, and on 2026-09-30 it waited 20s for a card the
// runtime had skipped without a word (an absent `asset` logs nothing).
import {
  type AssetFailure,
  resolveAssetUrl,
} from "../../runtime-src/common/assets";

export type VoiceOverCue = {
  readonly id: string;
  readonly t: number;
  readonly asset?: string;
};

export type SkippedCue = {
  readonly id: string;
  readonly reason: AssetFailure | "no-asset";
};

// "none": the lesson has no voice-over, so there is nothing to measure.
// "unplayable": it has cues, but the runtime will skip every one — a lesson
// config that needs fixing, never a reason to skip the test.
export type VoiceOverPick =
  | { readonly kind: "none" }
  | { readonly kind: "unplayable"; readonly skipped: readonly SkippedCue[] }
  | { readonly kind: "playable"; readonly id: string; readonly t: number };

// The first cue in config order the runtime will play — the order its own
// due-cue lookup walks.
export function pickVoiceOver(
  audios: readonly VoiceOverCue[],
  assets: Readonly<Record<string, string>> = {},
): VoiceOverPick {
  if (audios.length === 0) return { kind: "none" };
  const skipped: SkippedCue[] = [];
  for (const cue of audios) {
    const { url, failure } = resolveAssetUrl(cue.asset, assets);
    if (url) return { kind: "playable", id: cue.id, t: cue.t };
    skipped.push({ id: cue.id, reason: failure ?? "no-asset" });
  }
  return { kind: "unplayable", skipped };
}
