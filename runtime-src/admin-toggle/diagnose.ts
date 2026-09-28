// Why the runtime would not pick up the code saved in a "Code einbetten" block.
//
// The editor shows that code as a raw string, and LearningSuite's sanitiser
// silently drops whatever it does not allow — an empty block renders as no
// block at all (docs/learningsuite-enrichment-research.md). So a broken payload
// looks exactly like a missing one in Vorschau. This replays, on the raw string,
// what common/config.ts expects of the <pre data-vp-config> block and names what
// would stop it from being recognised. Pure: the caller finds the string and
// renders the findings.
import { normalizeQuizConfig } from "../common/config";
import type { AdminKey } from "../common/i18n/admin";

export interface Finding {
  level: "error" | "warning";
  key: AdminKey;
  vars?: Record<string, string | number>;
}

const ARRAY_SECTIONS = ["phases", "sciences", "audios", "metaSteps"] as const;
const CONTENT_SECTIONS = [...ARRAY_SECTIONS, "quiz"] as const;
const KNOWN_KEYS = new Set<string>([...CONTENT_SECTIONS, "assets", "demo"]);

const error = (key: AdminKey, vars?: Finding["vars"]): Finding => ({
  level: "error",
  key,
  vars,
});
const warning = (key: AdminKey, vars?: Finding["vars"]): Finding => ({
  level: "warning",
  key,
  vars,
});

// A line opening with ``` is a Markdown fence. Backticks inside a JSON string
// cannot start a line: JSON strings hold no raw newlines.
const FENCE = /^[ \t]*```/m;

// Returns null for an embed that is not ours: one without a
// <pre data-vp-config> block, the only wrapper LearningSuite's sanitiser keeps.
export function diagnoseEmbed(code: string): Finding[] | null {
  // Most inputs on the page are not embeds at all; skip parsing those.
  if (!/data-vp-config/i.test(code)) return null;
  const doc = new DOMParser().parseFromString(code, "text/html");
  if (!doc.querySelector("pre[data-vp-config]")) return null;

  // Same selector as loadVpConfig in common/config.ts: the runtime reads the
  // first match, so that is the element to diagnose.
  const target = doc.querySelector("[data-vp-config]:not(script)") as Element;
  if (target.tagName !== "PRE")
    return [
      error("admin.diag.precededHtml", { tag: target.tagName.toLowerCase() }),
    ];

  const fenced = FENCE.test(code);
  // Browsers drop the newline right after <pre>; strip it here too, so line 1
  // is the first line of JSON whichever parser built the tree.
  const json = (target.textContent ?? "").replace(/^\r?\n/, "");
  if (!json.trim()) return [error("admin.diag.emptyHtml")];
  // Fences inside the block break the JSON; outside it they render as stray
  // text on the lesson page. Either way they have to go.
  const fences = fenced ? [error("admin.diag.fencesHtml")] : [];
  if (FENCE.test(json)) return fences;

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return [...fences, ...jsonFindings(json, e)];
  }
  return [...fences, ...structureFindings(raw)];
}

function jsonFindings(json: string, e: unknown): Finding[] {
  const message = e instanceof Error ? e.message : String(e);
  const findings: Finding[] = [];
  // V8 reports "at position N"; other engines may not, then the message alone
  // has to do.
  const position = Number(/position (\d+)/.exec(message)?.[1]);
  if (Number.isInteger(position)) {
    const before = json.slice(0, position).split("\n");
    const line = before.length;
    const column = before[line - 1].length + 1;
    const lineText = json.split("\n")[line - 1];
    const from = Math.max(0, column - 40);
    const snippet = lineText.slice(from, from + 80).trim();
    // The editor keeps the saved code in an <input>, which strips newlines, so
    // there a line number would always read 1.
    findings.push(
      json.trim().includes("\n")
        ? error("admin.diag.jsonAtHtml", { line, column, message, snippet })
        : error("admin.diag.jsonAtCharHtml", { column, message, snippet }),
    );
  } else {
    findings.push(error("admin.diag.jsonHtml", { message }));
  }
  if (/[“”„]/.test(json)) findings.push(error("admin.diag.smartQuotesHtml"));
  return findings;
}

function structureFindings(raw: unknown): Finding[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return [
      error("admin.diag.notObjectHtml", {
        kind: Array.isArray(raw) ? "[ … ]" : JSON.stringify(raw),
      }),
    ];
  const config = raw as Record<string, unknown>;

  // `"demo": true` fills absent sections with sample content on purpose.
  if (config.demo !== true && !CONTENT_SECTIONS.some((key) => key in config))
    return [error("admin.diag.noSectionsHtml")];

  const findings: Finding[] = [];
  for (const key of Object.keys(config))
    if (!KNOWN_KEYS.has(key))
      findings.push(warning("admin.diag.unknownKeyHtml", { key }));
  for (const key of ARRAY_SECTIONS)
    if (key in config && !Array.isArray(config[key]))
      findings.push(error("admin.diag.notArrayHtml", { key }));
  if ("quiz" in config && !normalizeQuizConfig(config.quiz))
    findings.push(warning("admin.diag.quizInvalidHtml"));
  if (Array.isArray(config.audios))
    findings.push(...audioFindings(config.audios, config.assets));
  return findings;
}

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const TOKEN = "{{asset:";

// Mirrors common/assets.ts resolveAssetUrl, with one difference: in the editor
// an asset is still the unexpanded `{{asset:…}}` token — the platform only
// expands it at page render — so that shape counts as usable here.
const usableAsset = (value: unknown): boolean =>
  typeof value === "string" &&
  (value.includes(TOKEN) || parseUrl(value.trim())?.protocol === "https:");

function audioFindings(audios: unknown[], assets: unknown): Finding[] {
  const table =
    assets && typeof assets === "object"
      ? (assets as Record<string, unknown>)
      : {};
  return audios.flatMap<Finding>((entry, index) => {
    const cue =
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : {};
    const id = typeof cue.id === "string" && cue.id ? cue.id : `#${index + 1}`;
    const asset = typeof cue.asset === "string" ? cue.asset.trim() : "";
    if (!asset) return [warning("admin.diag.audioNoAssetHtml", { id })];
    // Anything that is not a token or a URL is a key into the assets table.
    const direct = asset.includes(TOKEN) || parseUrl(asset) !== null;
    const resolved = direct ? asset : table[asset];
    return usableAsset(resolved)
      ? []
      : [warning("admin.diag.audioAssetUnknownHtml", { id })];
  });
}
