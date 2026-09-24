import { esc } from "../common/escape";
import { formatTime as fmt } from "../common/format";
import { t as tr } from "../common/i18n/demo";
import type { Science } from "../common/types";
import { T } from "./styles";

// One entry in the Science tab: a collapsible card, like the native player's
// `components/science/science-accordion.tsx`, in the dark tokens. Science
// descriptions are long-form articles, so the body keeps their structure — see
// richText — instead of collapsing everything into one paragraph.

const BODY = "rgba(244,247,246,.82)"; // --card-foreground @ 82%, for long reads

type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; start: number; items: string[] };

// A deliberately tiny Markdown subset: blank-line paragraphs, `#` headings and
// `-` / `1.` list items. Plain text written before this existed still renders,
// just as paragraphs. A blank line between list items keeps the list going, so
// a "loose" list is not split into single-item lists.
function parse(src: string): Block[] {
  const blocks: Block[] = [];
  let paragraphOpen = false;
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const last = blocks.at(-1);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (!line) {
      paragraphOpen = false;
    } else if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
      paragraphOpen = false;
    } else if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
      paragraphOpen = false;
    } else if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[2]);
      else
        blocks.push({
          kind: "ol",
          start: Number(numbered[1]),
          items: [numbered[2]],
        });
      paragraphOpen = false;
    } else if (paragraphOpen && last?.kind === "p") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
      paragraphOpen = true;
    }
  }
  return blocks;
}

const LIST = `margin:0;padding-left:20px;display:grid;gap:4px;font:400 13.5px/1.6 system-ui;color:${BODY}`;

const heading = (text: string): string =>
  `<h4 style="margin:6px 0 0;font:600 14.5px/1.4 system-ui;color:${T.fg}">${esc(text)}</h4>`;

export function richText(src: string): string {
  return parse(src)
    .map((b) => {
      switch (b.kind) {
        case "h":
          return heading(b.text);
        case "p":
          return `<p style="margin:0;font:400 13.5px/1.6 system-ui;color:${BODY};overflow-wrap:anywhere">${b.lines.map(esc).join("<br>")}</p>`;
        case "ul":
          return `<ul style="${LIST}">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
        case "ol":
          // A lone numbered line between paragraphs is a numbered section
          // title ("2. Neurobiological Stabilization"), not a one-item list —
          // that is how the existing science texts are written.
          if (b.items.length === 1) return heading(`${b.start}. ${b.items[0]}`);
          return `<ol start="${b.start}" style="${LIST}">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`;
      }
    })
    .join("");
}

const FLASK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/></svg>`;

export function scienceCard(
  s: Science,
  state: { highlighted: boolean; open: boolean },
): string {
  const { highlighted, open } = state;
  const description = typeof s.description === "string" ? s.description : "";
  const stamps = Array.isArray(s.timestampsSec) ? s.timestampsSec : [];

  return `<div data-sci-card="${esc(s.id)}" style="border:1px solid ${highlighted ? T.primary : T.border};border-radius:${T.radius};background:${T.card};${highlighted ? `box-shadow:0 0 0 4px ${T.primarySoft};` : ""}transition:all .2s">
    <button data-sci-toggle="${esc(s.id)}" aria-expanded="${open}" style="width:100%;display:flex;gap:10px;align-items:center;padding:12px;background:none;border:0;cursor:pointer;text-align:left;color:${highlighted ? T.primary : T.mutedFg}">
      ${FLASK}
      <span style="flex:1;min-width:0;font:600 14px/1.35 system-ui;color:${highlighted ? T.primary : T.fg}">${esc(s.name)}</span>
      <span style="font:500 11px system-ui;background:${T.muted};color:${T.mutedFg};padding:2px 7px;border-radius:999px;flex-shrink:0">${esc(
        tr("demo.science.mentions", { count: stamps.length }),
      )}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${T.mutedFg}" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0;transition:transform .2s;${open ? "transform:rotate(180deg)" : ""}"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    ${
      open
        ? `<div style="display:grid;gap:12px;padding:0 14px 16px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${stamps
        .map(
          (t) =>
            `<span data-seek="${esc(t)}" style="font:500 11.5px ui-monospace,monospace;color:${T.primary};background:${T.primarySoft};padding:3px 8px;border-radius:6px;border:1px solid ${T.primaryRing};cursor:pointer">${fmt(t)}</span>`,
        )
        .join("")}</div>
      ${richText(description)}
    </div>`
        : ""
    }
  </div>`;
}
