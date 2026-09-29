import { esc } from "../common/escape";
import { formatTime as fmt } from "../common/format";
import { t as tr } from "../common/i18n/demo";
import type { Intervention } from "../common/types";
import { T } from "./styles";

// One intervention in the Coaching tab: a collapsible card whose open state
// shows the structured breakdown — quote, what's happening, method, function,
// scientific fields. The layout is ported from the native player's
// `components/coaching/intervention-accordion.tsx`, in the dark tokens.
//
// Config sections are passed through unvalidated (see parseVpConfig), so every
// optional field is narrowed here: a wrong-typed value drops its section
// instead of rendering "[object Object]" or throwing mid-render.

const svg = (body: string, color: string, size = 14): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0">${body}</svg>`;

const ICON = {
  quote: `<svg width="20" height="20" viewBox="0 0 24 24" fill="${T.primary}" aria-hidden="true" style="flex-shrink:0;margin-top:2px"><path d="M3 6h7v7a6 6 0 0 1-6 6v-3a3 3 0 0 0 3-3H3zM14 6h7v7a6 6 0 0 1-6 6v-3a3 3 0 0 0 3-3h-4z"/></svg>`,
  happening: svg(
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
    T.mutedFg,
  ),
  method: svg('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>', "#f59e0b"),
  function: svg(
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    "#10b981",
  ),
  fields: svg(
    '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    "#3b82f6",
  ),
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(text).filter(Boolean) : [];

function section(icon: string, label: string, body: string): string {
  return `<div style="display:grid;gap:4px">
    <div style="display:flex;align-items:center;gap:8px;font:600 11px system-ui;letter-spacing:.5px;text-transform:uppercase;color:${T.mutedFg}">${icon}<span>${esc(label)}</span></div>
    <div style="padding-left:22px">${body}</div>
  </div>`;
}

const prose = (value: string, color: string): string =>
  `<p style="margin:0;font:400 13.5px/1.6 system-ui;color:${color}">${esc(value)}</p>`;

export function interventionCard(
  iv: Intervention,
  state: { active: boolean; open: boolean },
): string {
  const { active, open } = state;
  const prompt = text(iv.prompt);
  const desc = text(iv.desc);
  const method = text(iv.method);
  const fn = text(iv.function);
  const fields = list(iv.scienceFields);

  const body = [
    prompt &&
      `<div style="display:flex;gap:8px">${ICON.quote}<p style="margin:0;font:italic 500 15.5px/1.55 system-ui;color:${T.fg}">“${esc(prompt)}”</p></div>`,
    desc &&
      section(ICON.happening, tr("demo.iv.happening"), prose(desc, T.mutedFg)),
    method && section(ICON.method, tr("demo.iv.method"), prose(method, T.fg)),
    fn && section(ICON.function, tr("demo.iv.function"), prose(fn, T.fg)),
    fields.length > 0 &&
      section(
        ICON.fields,
        tr("demo.iv.fields"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${fields
          .map(
            (f) =>
              `<span style="font:500 12px/1.3 system-ui;color:${T.fg};background:rgba(255,255,255,.04);border:1px solid ${T.border};border-radius:999px;padding:4px 10px">${esc(f)}</span>`,
          )
          .join("")}</div>`,
      ),
  ]
    .filter(Boolean)
    .join("");

  return `<div data-iv="${esc(iv.id)}" style="border:1px solid rgba(80,83,82,.6);border-left:2px solid ${active ? T.primary : "rgba(168,191,186,.3)"};background:rgba(255,255,255,.03);border-radius:8px;transition:border-color .2s">
    <button data-iv-toggle="${esc(iv.id)}" aria-expanded="${open}" style="width:100%;display:flex;gap:12px;align-items:center;padding:11px 12px;background:none;border:0;cursor:pointer;text-align:left;color:inherit">
      <span style="min-width:24px;height:24px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:${T.muted};color:${active ? T.primary : T.mutedFg};font:600 11px system-ui;display:flex;align-items:center;justify-content:center;flex-shrink:0">${esc(iv.label)}</span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:5px">
        <span style="font:500 13.5px/1.35 system-ui;color:${active ? T.primary : T.fg}">${esc(iv.title)}</span>
        <span data-seek="${esc(iv.t)}" style="display:inline-flex;align-items:center;gap:4px;font:500 11px ui-monospace,monospace;color:${T.mutedFg};padding:2px 7px;border-radius:6px;border:1px solid ${T.border};cursor:pointer"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 21 12 5 21"/></svg>${fmt(iv.t)}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${T.mutedFg}" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0;transition:transform .2s;${open ? "transform:rotate(180deg)" : ""}"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    ${open && body ? `<div style="display:grid;gap:14px;padding:2px 12px 14px">${body}</div>` : ""}
  </div>`;
}
