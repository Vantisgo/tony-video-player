import type { PlayerApi } from "./common/types";

declare global {
  interface Window {
    // Exposed by reskin-player.js, consumed by demo-overlays.js.
    player: PlayerApi;
  }
}

export {};
