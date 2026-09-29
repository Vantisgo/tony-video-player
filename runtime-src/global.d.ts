import type { PlayerApi } from "./common/types";

declare global {
  interface Window {
    // Exposed by reskin-player.js, consumed by demo-overlays.js.
    player: PlayerApi;
    // Set by loader.js (or a test/e2e harness): the URL the runtime was served
    // from, so children skip their own document.currentScript resolution.
    __vpRuntimeBaseUrl?: string;
    // The kill-switch verdict loader.js already fetched — children honour it
    // instead of asking again (see common/killswitch.ts).
    __vpRuntimeGate?: boolean;
    // Loader diagnostics: its status string and the bundles it injected, in
    // injection order.
    __vpLoaderStatus?: string;
    __vpLoaded?: string[];
    // Which origin the bundles were taken from: "local" when a dev server
    // answered the handshake probe (loader/local-runtime.ts), else "deployed".
    __vpLocalRuntime?: "local" | "deployed";
    // Host override for the UI locale, honoured ahead of
    // document.documentElement.lang and navigator.languages (see
    // common/i18n/core.ts). Typed `string`, not `Locale`, because a host can set
    // anything — resolveLocale() validates it and ignores what it cannot use.
    __vpLocale?: string;
  }
}

export {};
